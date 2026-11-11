// Package database abre la conexión a MySQL y aplica las migraciones.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"

	"convocados/internal/config"
)

// Connect abre el pool de conexiones y verifica que responda.
func Connect(cfg *config.Config) (*sql.DB, error) {
	db, err := sql.Open("mysql", cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("abriendo MySQL: %w", err)
	}
	db.SetMaxOpenConns(20)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)
	db.SetConnMaxIdleTime(2 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("sin conexión con MySQL (%s): %w", cfg.DBHost+":"+cfg.DBPort, err)
	}
	return db, nil
}

// Migrate crea la base de datos si hace falta y aplica los .sql pendientes.
// Cada archivo corre exactamente una vez (queda registrado en schema_migrations).
func Migrate(cfg *config.Config) ([]string, error) {
	aplicadas := []string{}

	// 1) Crear la base de datos si no existe (conexión a la raíz)
	dbRaiz, err := sql.Open("mysql", cfg.DSNMigracion())
	if err != nil {
		return nil, err
	}
	defer dbRaiz.Close()

	crear := fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", cfg.DBName)
	if _, err := dbRaiz.Exec(crear); err != nil {
		return nil, fmt.Errorf("creando la base de datos: %w", err)
	}
	dbRaiz.Close()

	// 2) Conexión con multiStatements (solo para ejecutar los scripts completos)
	dbMig, err := sql.Open("mysql", cfg.DSNBase(cfg.DBName, true))
	if err != nil {
		return nil, err
	}
	defer dbMig.Close()

	// Tabla de control
	if _, err := dbMig.Exec(
		"CREATE TABLE IF NOT EXISTS schema_migrations (" +
			"nombre VARCHAR(191) PRIMARY KEY," +
			"aplicada_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"); err != nil {
		return nil, fmt.Errorf("creando schema_migrations: %w", err)
	}

	archivos, err := listarSQL(cfg.MigrationsDir)
	if err != nil {
		return nil, err
	}
	if len(archivos) == 0 {
		return nil, fmt.Errorf("no encontré archivos .sql en %q", cfg.MigrationsDir)
	}

	for _, archivo := range archivos {
		if migracionAplicada(dbMig, archivo) {
			continue
		}

		contenido, err := os.ReadFile(archivo)
		if err != nil {
			return nil, err
		}
		sqlTexto := limpiarSQL(string(contenido))

		// Cada archivo corre en su propia transacción cuando se puede.
		tx, err := dbMig.Begin()
		if err != nil {
			return nil, err
		}
		if _, err := tx.Exec(sqlTexto); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("aplicando %s: %w", filepath.Base(archivo), err)
		}
		if _, err := tx.Exec("INSERT INTO schema_migrations (nombre) VALUES (?)", archivo); err != nil {
			tx.Rollback()
			return nil, err
		}
		if err := tx.Commit(); err != nil {
			return nil, err
		}
		aplicadas = append(aplicadas, filepath.Base(archivo))
	}

	_ = dbMig.Close()
	return aplicadas, nil
}

func migracionAplicada(db *sql.DB, archivo string) bool {
	var existe string
	err := db.QueryRow("SELECT nombre FROM schema_migrations WHERE nombre = ?", archivo).Scan(&existe)
	return err == nil
}

func listarSQL(dir string) ([]string, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, fmt.Errorf("leyendo %s: %w", dir, err)
	}
	rutas := []string{}
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(strings.ToLower(e.Name()), ".sql") {
			continue
		}
		rutas = append(rutas, filepath.Join(dir, e.Name()))
	}
	sort.Strings(rutas)
	return rutas, nil
}

// limpiarSQL saca comentarios de línea para no romper la ejecución batch.
// (Los comentarios multi-línea /* */ se mantienen.)
func limpiarSQL(texto string) string {
	lineas := strings.Split(texto, "\n")
	limpias := make([]string, 0, len(lineas))
	for _, l := range lineas {
		if strings.HasPrefix(strings.TrimSpace(l), "--") {
			continue
		}
		limpias = append(limpias, l)
	}
	out := strings.Join(limpias, "\n")
	return strings.TrimSpace(out)
}

func Log(cantidad int, detalle []string) {
	if cantidad == 0 {
		log.Print("migraciones: ninguna pendiente")
		return
	}
	log.Printf("migraciones aplicadas (%d): %s", cantidad, strings.Join(detalle, ", "))
}
