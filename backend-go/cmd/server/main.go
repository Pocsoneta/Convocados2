// Convocados API — backend en Go para el front de Convocados.
//
//	go run ./cmd/server
//
// Variables de entorno (todas opcionales):
//
//	DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
//	HTTP_ADDR        por defecto :8080
//	JWT_SECRET       secreto del token
//	JWT_EXPIRA_HORAS por defecto 24
//	FRONT_DIR        carpeta del front (vacío = solo API, sin archivos estáticos)
//	MIGRATIONS_DIR   default migrations
//	AUTO_MIGRATE     true | false
//	ALLOW_ORIGIN     origen CORS (vacío = deshabilitado)
//
// También se pueden poner en un archivo `.env` (ver `.env.example`).
package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"convocados/internal/api"
	"convocados/internal/config"
	"convocados/internal/database"
)

func main() {
	soloMigrar := flag.Bool("migrate", false, "aplica las migraciones pendientes y sale")
	flag.Parse()

	cfg := config.Load()
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("convocados ")

	// 1) Migraciones (crea la BD si no existe y aplica los .sql pendientes)
	if cfg.AutoMigrate || *soloMigrar {
		aplicadas, err := database.Migrate(cfg)
		if err != nil {
			log.Fatalf("migraciones: %v", err)
		}
		database.Log(len(aplicadas), aplicadas)
		if *soloMigrar {
			return
		}
	}

	// 2) Conexión
	db, err := database.Connect(cfg)
	if err != nil {
		log.Fatalf("%v", err)
	}
	defer db.Close()

	for _, aviso := range cfg.Avisos() {
		log.Printf("AVISO: %s", aviso)
	}

	// 3) Servidor
	srv := &api.Server{DB: db, Cfg: cfg}
	httpSrv := &http.Server{
		Addr:              cfg.HTTPAddr,
		Handler:           srv.Router(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      60 * time.Second,
		IdleTimeout:       90 * time.Second,
	}

	go func() {
		log.Printf("API escuchando en http://localhost%s", cfg.HTTPAddr)
		log.Printf("front servido desde %s", cfg.FrontDir)
		if err := httpSrv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("servidor: %v", err)
		}
	}()

	// 4) Corte limpio con Ctrl+C
	parar := make(chan os.Signal, 1)
	signal.Notify(parar, syscall.SIGINT, syscall.SIGTERM)
	<-parar
	log.Print("cerrando...")

	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	if err := httpSrv.Shutdown(ctx); err != nil {
		log.Printf("al cerrar: %v", err)
	}
}
