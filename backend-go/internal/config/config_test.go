package config

import (
	"os"
	"strings"
	"testing"
	"time"
)

// Las variables que toca la configuración: se limpian antes de cada
// caso para que un test no contamine al siguiente.
var claves = []string{
	"DB_HOST", "DB_PORT", "DB_USER", "DB_PASS", "DB_NAME",
	"HTTP_ADDR", "JWT_SECRET", "JWT_EXPIRA_HORAS", "FRONT_DIR",
	"ALLOW_ORIGIN", "PUBLIC_URL", "MIGRATIONS_DIR", "AUTO_MIGRATE",
	"MAPS_API_KEY",
}

func limpiarEntorno(t *testing.T) {
	t.Helper()
	for _, k := range claves {
		if err := os.Unsetenv(k); err != nil {
			t.Fatalf("limpiando %s: %v", k, err)
		}
	}
}

// Sin .env y sin variables: cae todo a los valores por defecto de desarrollo.
func TestDefaults(t *testing.T) {
	limpiarEntorno(t)
	dir := t.TempDir()
	anterior := debeChdir(t, dir)
	defer os.Chdir(anterior)

	c := Load()
	if c.DBHost != "127.0.0.1" || c.DBPort != "3306" || c.DBUser != "root" || c.DBName != "Convocados" {
		t.Errorf("defaults de DB incorrectos: %+v", c)
	}
	if c.HTTPAddr != ":8080" {
		t.Errorf("HTTP_ADDR por defecto = %q, esperaba \":8080\"", c.HTTPAddr)
	}
	if c.JWTSecret != SecretDev {
		t.Error("sin JWT_SECRET debería usar el secreto de desarrollo")
	}
	if c.JWTExpira != 24*time.Hour {
		t.Errorf("JWTExpira = %v, esperaba 24h", c.JWTExpira)
	}
	if !c.AutoMigrate {
		t.Error("AutoMigrate debería estar activo por defecto")
	}
	if avisos := c.Avisos(); len(avisos) == 0 {
		t.Error("con el secreto por defecto debería haber avisos de configuración")
	}
}

// Con un .env presente: los valores del archivo se usan (y las comillas
// se sacan).
func TestArchivoEnv(t *testing.T) {
	limpiarEntorno(t)
	dir := t.TempDir()
	env := "# comentario\n" +
		"DB_USER=usuariotest\n" +
		"DB_PASS='clavetest'\n" +
		"DB_NAME=ConvocadosTest\n" +
		"HTTP_ADDR=:9999\n" +
		"JWT_SECRET=secreto-de-test\n" +
		"JWT_EXPIRA_HORAS=2\n" +
		"AUTO_MIGRATE=false\n"
	if err := os.WriteFile(dir+"/.env", []byte(env), 0o600); err != nil {
		t.Fatal(err)
	}
	anterior := debeChdir(t, dir)
	defer os.Chdir(anterior)

	c := Load()
	if c.DBUser != "usuariotest" || c.DBPass != "clavetest" || c.DBName != "ConvocadosTest" {
		t.Errorf("valores del .env no se aplicaron: %+v", c)
	}
	if c.HTTPAddr != ":9999" {
		t.Errorf("HTTP_ADDR = %q, esperaba \":9999\"", c.HTTPAddr)
	}
	if c.JWTSecret != "secreto-de-test" {
		t.Errorf("JWT_SECRET = %q, esperaba el del .env", c.JWTSecret)
	}
	if c.JWTExpira != 2*time.Hour {
		t.Errorf("JWTExpira = %v, esperaba 2h", c.JWTExpira)
	}
	if c.AutoMigrate {
		t.Error("AUTO_MIGRATE=false debería desactivar la migración automática")
	}
}

// Las variables de entorno tienen prioridad sobre el .env.
func TestEntornoPisaArchivo(t *testing.T) {
	limpiarEntorno(t)
	dir := t.TempDir()
	if err := os.WriteFile(dir+"/.env", []byte("DB_NAME=DelArchivo\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	anterior := debeChdir(t, dir)
	defer os.Chdir(anterior)

	t.Setenv("DB_NAME", "DelEntorno")
	if c := Load(); c.DBName != "DelEntorno" {
		t.Errorf("DB_NAME = %q, la variable de entorno debería ganar", c.DBName)
	}
}

// Forma de los DSN: la normal apunta a la base y la de migración activa
// multiStatements y va a la raíz.
func TestDSN(t *testing.T) {
	c := &Config{DBHost: "127.0.0.1", DBPort: "3306", DBUser: "root", DBPass: "admin", DBName: "Convocados"}

	if !strings.Contains(c.DSN(), "root:admin@tcp(127.0.0.1:3306)/Convocados?") {
		t.Errorf("DSN con forma inesperada: %q", c.DSN())
	}
	if strings.Contains(c.DSN(), "multiStatements=true") {
		t.Error("el DSN normal no debería activar multiStatements")
	}
	if !strings.Contains(c.DSNMigracion(), ")/?") || !strings.Contains(c.DSNMigracion(), "multiStatements=true") {
		t.Errorf("el DSN de migración debería ir a la raíz con multiStatements: %q", c.DSNMigracion())
	}
}

// Con secretos propios ya no hay avisos.
func TestAvisosSinDefaults(t *testing.T) {
	c := &Config{JWTSecret: "secreto-propio", DBPass: "clave-propia"}
	if avisos := c.Avisos(); len(avisos) != 0 {
		t.Errorf("sin defaults no debería haber avisos, hay: %v", avisos)
	}
}

// debeChdir cambia de directorio y devuelve el anterior (para restaurar).
func debeChdir(t *testing.T, dir string) string {
	t.Helper()
	anterior, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(dir); err != nil {
		t.Fatal(err)
	}
	return anterior
}
