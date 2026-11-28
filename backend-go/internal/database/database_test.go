package database

import (
	"net"
	"os"
	"strings"
	"testing"
	"time"

	"convocados/internal/config"
)

// TestConexionYMigraciones prueba el ciclo real contra MySQL:
// 1) aplicar migraciones es idempotente, 2) Connect abre y responde,
// 3) las tablas del proyecto existen.
//
// Si MySQL no está levantado, el test se salta (no falla): el resto de
// la suite sigue siendo unitaria y no depende de la base.
func TestConexionYMigraciones(t *testing.T) {
	// config.Load() lee el .env desde donde se corre: el módulo es
	// backend-go, o sea dos niveles arriba desde este paquete.
	anterior, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if strings.HasSuffix(anterior, "/internal/database") {
		if err := os.Chdir("../.."); err != nil {
			t.Fatal(err)
		}
		defer func() { _ = os.Chdir(anterior) }()
	}

	cfg := config.Load()

	// Sin MySQL corriendo no hay nada que probar acá.
	conn, err := net.DialTimeout("tcp", cfg.DBHost+":"+cfg.DBPort, 2*time.Second)
	if err != nil {
		t.Skipf("MySQL no disponible en %s:%s (%v): se salta el test de integración",
			cfg.DBHost, cfg.DBPort, err)
	}
	conn.Close()

	// 1) Migraciones: la primera llamada aplica lo pendiente, la segunda
	//    no tiene que aplicar nada (idempotencia).
	aplicadas, err := Migrate(cfg)
	if err != nil {
		t.Fatalf("Migrate: %v", err)
	}
	t.Logf("migraciones aplicadas en la primera pasada: %d", len(aplicadas))

	reaplicadas, err := Migrate(cfg)
	if err != nil {
		t.Fatalf("segunda Migrate: %v", err)
	}
	if len(reaplicadas) != 0 {
		t.Errorf("la segunda pasada volvió a aplicar %d migraciones: no es idempotente", len(reaplicadas))
	}

	// 2) Conexión real con ping.
	db, err := Connect(cfg)
	if err != nil {
		t.Fatalf("Connect: %v", err)
	}
	defer db.Close()

	// 3) Las tablas del proyecto tienen que existir.
	quererExistir := []string{"USUARIO", "PARTIDO", "COMPLEJO", "CANCHA", "EQUIPO", "schema_migrations"}
	for _, tabla := range quererExistir {
		var cantidad int
		if err := db.QueryRow(`SELECT COUNT(*) FROM information_schema.tables
		                       WHERE table_schema = ? AND table_name = ?`, cfg.DBName, tabla).Scan(&cantidad); err != nil {
			t.Fatalf("consultando information_schema: %v", err)
		}
		if cantidad != 1 {
			t.Errorf("la tabla %s no existe en la base %s", tabla, cfg.DBName)
		}
	}

	// 4) Una consulta real de las que usa la app.
	var complejos int
	if err := db.QueryRow("SELECT COUNT(*) FROM COMPLEJO").Scan(&complejos); err != nil {
		t.Errorf("SELECT COUNT(*) FROM COMPLEJO: %v", err)
	}
	t.Logf("complejos cargados: %d", complejos)
}
