// Package config centraliza la configuración del backend.
// Todo sale de variables de entorno, con valores por defecto pensados
// para correr en local. Si existe un archivo `.env` en la carpeta
// desde donde se arranca, se usa como respaldo (no pisa lo que ya
// esté seteado en el entorno).
package config

import (
	"log"
	"os"
	"strconv"
	"strings"
	"time"
)

// Valores por defecto SOLO para desarrollo. En producción hay que
// cambiarlos (por entorno o con .env); si no, el arranque avisa.
const (
	SecretDev = "convocados-dev-secret-cambiame-en-produccion"
	PassDev   = "admin"
)

type Config struct {
	// Base de datos
	DBHost string
	DBPort string
	DBUser string
	DBPass string
	DBName string

	// HTTP
	HTTPAddr string

	// Sesión
	JWTSecret string
	JWTExpira time.Duration

	// Front
	FrontDir string
	// Origen permitido para CORS (vacío = solo mismo origen, lo normal)
	AllowOrigin string

	// Migraciones
	MigrationsDir string
	AutoMigrate   bool

	// Google Maps (autocompletado de ubicación en Crear partido).
	// Vacío = la pantalla queda con ingreso manual de dirección.
	MapsKey string
}

func Load() *Config {
	cargarEnv(".env")

	return &Config{
		DBHost:        env("DB_HOST", "127.0.0.1"),
		DBPort:        env("DB_PORT", "3306"),
		DBUser:        env("DB_USER", "root"),
		DBPass:        env("DB_PASS", PassDev),
		DBName:        env("DB_NAME", "Convocados"),
		HTTPAddr:      env("HTTP_ADDR", ":8080"),
		JWTSecret:     env("JWT_SECRET", SecretDev),
		JWTExpira:     envDur("JWT_EXPIRA_HORAS", 24*time.Hour),
		FrontDir:      env("FRONT_DIR", ""),
		AllowOrigin:   env("ALLOW_ORIGIN", ""),
		MigrationsDir: env("MIGRATIONS_DIR", "migrations"),
		AutoMigrate:   envBool("AUTO_MIGRATE", true),
		MapsKey:       env("MAPS_API_KEY", ""),
	}
}

// Avisos devuelve advertencias de configuración (secretos por defecto,
// etc.) para mostrarlas al arrancar.
func (c *Config) Avisos() []string {
	avisos := []string{}
	if c.JWTSecret == SecretDev {
		avisos = append(avisos, "JWT_SECRET sigue con el valor por defecto: cambiálo (o en .env) antes de usarlo en serio.")
	}
	if c.DBPass == PassDev {
		avisos = append(avisos, "DB_PASS usa la contraseña por defecto (admin).")
	}
	return avisos
}

// cargarEnv lee un archivo .env simple (CLAVE=valor, # comentarios)
// y setea cada variable que todavía no esté definida en el entorno.
func cargarEnv(ruta string) {
	datos, err := os.ReadFile(ruta)
	if err != nil {
		return // no hay .env: se usan las variables de entorno o los defaults
	}

	for _, linea := range strings.Split(string(datos), "\n") {
		linea = strings.TrimSpace(linea)
		if linea == "" || strings.HasPrefix(linea, "#") {
			continue
		}
		clave, valor, ok := strings.Cut(linea, "=")
		if !ok {
			continue
		}
		clave = strings.TrimSpace(clave)
		valor = strings.TrimSpace(valor)

		// quita comillas simples o dobles
		if len(valor) > 1 {
			primero, ultimo := valor[0], valor[len(valor)-1]
			if (primero == '"' && ultimo == '"') || (primero == '\'' && ultimo == '\'') {
				valor = valor[1 : len(valor)-1]
			}
		}

		if clave == "" {
			continue
		}
		if _, yaDefinida := os.LookupEnv(clave); !yaDefinida {
			os.Setenv(clave, valor)
		}
	}
	log.Printf("configuración leída de %s (las variables del entorno tienen prioridad)", ruta)
}

// DSN sin base de datos: sirve para crearla si no existe.
func (c *Config) DSNRaiz() string {
	return c.DBUser + ":" + c.DBPass + "@tcp(" + c.DBHost + ":" + c.DBPort + ")/" +
		"?charset=utf8mb4&collation=utf8mb4_unicode_ci&parseTime=true&loc=Local&timeout=5s"
}

// DSN normal para consultas (una sentencia por vez).
func (c *Config) DSN() string {
	return c.DSNBase(c.DBName, false)
}

// DSN con multiStatements: solo se usa para aplicar archivos .sql.
func (c *Config) DSNMigracion() string {
	return c.DSNBase("", true)
}

func (c *Config) DSNBase(db string, multi bool) string {
	dsn := c.DBUser + ":" + c.DBPass + "@tcp(" + c.DBHost + ":" + c.DBPort + ")/" + db +
		"?charset=utf8mb4&collation=utf8mb4_unicode_ci&parseTime=true&loc=Local&timeout=5s&readTimeout=10s&writeTimeout=10s"
	if multi {
		dsn += "&multiStatements=true"
	}
	return dsn
}

func env(clave, porDefecto string) string {
	if v := strings.TrimSpace(os.Getenv(clave)); v != "" {
		return v
	}
	return porDefecto
}

func envBool(clave string, porDefecto bool) bool {
	v := strings.TrimSpace(os.Getenv(clave))
	if v == "" {
		return porDefecto
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return porDefecto
	}
	return b
}

func envDur(clave string, porDefecto time.Duration) time.Duration {
	v := strings.TrimSpace(os.Getenv(clave))
	if v == "" {
		return porDefecto
	}
	h, err := strconv.Atoi(v)
	if err != nil || h <= 0 {
		return porDefecto
	}
	return time.Duration(h) * time.Hour
}
