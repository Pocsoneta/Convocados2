package api

import (
	"net/http/httptest"
	"strings"
	"testing"
)

/* ---------- porDefectoFloat ---------- */

func TestPorDefectoFloat(t *testing.T) {
	casos := []struct {
		valor    string
		porDef   float64
		esperado float64
	}{
		{"", 99, 99},       // vacío -> default
		{"  ", 99, 99},     // solo espacios -> default
		{"5", 99, 5},       // número válido
		{"-3.5", 99, -3.5}, // negativo con decimal
		{"abc", 99, 99},    // no numérico -> default
		{"7.5xyz", 99, 99}, // parcialmente numérico -> default
	}
	for _, c := range casos {
		if got := porDefectoFloat(c.valor, c.porDef); got != c.esperado {
			t.Errorf("porDefectoFloat(%q, 99) = %v, esperaba %v", c.valor, got, c.esperado)
		}
	}
}

/* ---------- partido.Disponibles ---------- */

func TestDisponibles(t *testing.T) {
	casos := []struct {
		nombre           string
		cupo, inscriptos int
		disponibles      int
	}{
		{"quedan lugares", 10, 3, 7},
		{"lleno justo", 10, 10, 0},
		{"pasado de cupo no da negativo", 10, 12, 0},
		{"sin inscriptos", 6, 0, 6},
	}
	for _, c := range casos {
		p := partido{CupoTotal: c.cupo, Inscriptos: c.inscriptos}
		if got := p.Disponibles(); got != c.disponibles {
			t.Errorf("%s: Disponibles() = %v, esperaba %v", c.nombre, got, c.disponibles)
		}
	}
}

/* ---------- filtros.where: armado de la cláusula SQL ---------- */

// Sin filtros: solo el estado (por defecto Publicado) y los futuros.
func TestWherePorDefecto(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/partidos", nil)
	f := leerFiltros(r)

	cond, args := f.where()
	if f.Estado != "Publicado" {
		t.Errorf("leerFiltros sin estado debería dejar Publicado, dejó %q", f.Estado)
	}
	if !strings.Contains(cond, "p.estado = ?") || !strings.Contains(cond, "p.fecha_hora >= NOW()") {
		t.Errorf("condición por defecto inesperada: %q", cond)
	}
	if len(args) != 1 || args[0] != "Publicado" {
		t.Errorf("argumentos por defecto = %v, esperaba [Publicado]", args)
	}
}

// Cada filtro se traduce a su condición con los parámetros en orden.
func TestWhereConFiltros(t *testing.T) {
	r := httptest.NewRequest("GET", "/api/partidos?q=cancha%201&zona=Mendoza&modalidad=F%C3%BAtbol%205&desde=2026-12-01&hasta=2026-12-31&pasados=1", nil)
	f := leerFiltros(r)

	cond, args := f.where()
	for _, esperado := range []string{"p.estado = ?", "p.fecha_hora >= ?", "p.fecha_hora <= ?",
		"p.descripcion LIKE ?", "c.direccion LIKE ?", "c.nombre LIKE ?", "c.barrio LIKE ?", "p.modalidad = ?"} {
		if !strings.Contains(cond, esperado) {
			t.Errorf("falta %q en la condición: %q", esperado, cond)
		}
	}
	if !f.IncluirPasados {
		t.Error("pasados=1 debería habilitar IncluirPasados")
	}
	if strings.Contains(cond, "p.fecha_hora >= NOW()") {
		t.Error("con pasados=1 no debería exigir fecha futura")
	}
	// q genera 3 LIKE con el mismo patrón; zona 2; modalidad 1; desde 1; hasta 1; estado 1 = 9 args
	if len(args) != 9 {
		t.Errorf("esperaba 9 argumentos, hay %d: %v", len(args), args)
	}
}

/* ---------- partido.Nombre y FechaISO ---------- */

func TestPartidoNombre(t *testing.T) {
	p := partido{Complejo: "Complejo QA"}
	if p.Nombre() != "Complejo QA" {
		t.Errorf("Nombre() = %q, esperaba \"Complejo QA\"", p.Nombre())
	}
	vacio := partido{}
	if vacio.Nombre() != "Partido" {
		t.Errorf("Nombre() sin complejo = %q, esperaba \"Partido\"", vacio.Nombre())
	}
}
