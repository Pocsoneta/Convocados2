package api

import (
	"database/sql"
	"testing"
)

/* ---------- tieneUbicacion ---------- */

func TestTieneUbicacion(t *testing.T) {
	casos := []struct {
		nombre   string
		lat, lng float64
		ok       bool
	}{
		{"cero cero es nada geolocalizado", 0, 0, false},
		{"CABA", -34.6037, -58.3816, true},
		{"Mendoza", -32.8895, -68.8441, true},
		{"lat fuera de rango", 100, 10, false},
		{"lng fuera de rango", 10, 200, false},
		{"negativos fuera de rango", -95, 0, false},
	}
	for _, c := range casos {
		if got := tieneUbicacion(c.lat, c.lng); got != c.ok {
			t.Errorf("%s: tieneUbicacion(%v,%v) = %v, esperaba %v", c.nombre, c.lat, c.lng, got, c.ok)
		}
	}
}

/* ---------- distKm ---------- */

func TestDistKm(t *testing.T) {
	if d := distKm(-32.8895, -68.8441, -32.8895, -68.8441); d != 0 {
		t.Errorf("distancia al mismo punto = %v, esperaba 0", d)
	}
	// Mendoza -> CABA: en línea recta son ~985 km.
	d := distKm(-32.8895, -68.8441, -34.6037, -58.3816)
	if d < 950 || d > 1020 {
		t.Errorf("distancia Mendoza-CABA = %v km, esperaba ~985", d)
	}
	// Simétrica.
	if distKm(-34.6037, -58.3816, -32.8895, -68.8441) != d {
		t.Error("distKm no es simétrica")
	}
}

/* ---------- km1 ---------- */

func TestKm1(t *testing.T) {
	casos := []struct {
		in, out float64
	}{{1234.56, 1234.6}, {10, 10}, {0.04, 0}, {3.95, 4}}
	for _, c := range casos {
		if got := km1(c.in); got != c.out {
			t.Errorf("km1(%v) = %v, esperaba %v", c.in, got, c.out)
		}
	}
}

/* ---------- slugModalidad ---------- */

func TestSlugModalidad(t *testing.T) {
	casos := []struct{ in, out string }{
		{"Fútbol 5", "futbol-5"},
		{"  FÚTBOL 11  ", "futbol-11"},
		{"Fútbol ñoqui", "futbol-noqui"},
		{"", ""},
	}
	for _, c := range casos {
		if got := slugModalidad(c.in); got != c.out {
			t.Errorf("slugModalidad(%q) = %q, esperaba %q", c.in, got, c.out)
		}
	}
}

/* ---------- zonaTexto ---------- */

func TestZonaTexto(t *testing.T) {
	casos := []struct{ barrio, ciudad, out string }{
		{"Palermo", "CABA", "Palermo, CABA"},
		{"", "CABA", "CABA"},
		{"Palermo", "", "Palermo"},
		{"", "", ""},
		{"  ", "  ", ""}, // solo espacios = vacío
	}
	for _, c := range casos {
		if got := zonaTexto(c.barrio, c.ciudad); got != c.out {
			t.Errorf("zonaTexto(%q,%q) = %q, esperaba %q", c.barrio, c.ciudad, got, c.out)
		}
	}
}

/* ---------- capitalizar ---------- */

func TestCapitalizar(t *testing.T) {
	casos := []struct{ in, out string }{
		{"juan", "Juan"},
		{" Juan ", "Juan"},
		{"", ""},
		{"á", "Á"},
	}
	for _, c := range casos {
		if got := capitalizar(c.in); got != c.out {
			t.Errorf("capitalizar(%q) = %q, esperaba %q", c.in, got, c.out)
		}
	}
}

/* ---------- conversiones de Null ---------- */

func TestConversionesNull(t *testing.T) {
	if got := aFloat64(sql.NullFloat64{Valid: true, Float64: 7.5}); got != 7.5 {
		t.Errorf("aFloat64 válido = %v, esperaba 7.5", got)
	}
	if got := aFloat64(sql.NullFloat64{}); got != 0 {
		t.Errorf("aFloat64 inválido = %v, esperaba 0", got)
	}
	if got := aString(sql.NullString{Valid: true, String: "hola"}); got != "hola" {
		t.Errorf("aString válido = %q, esperaba \"hola\"", got)
	}
	if got := aString(sql.NullString{}); got != "" {
		t.Errorf("aString inválido = %q, esperaba \"\"", got)
	}
}

/* ---------- estadoRespuesta ---------- */

func TestEstadoRespuesta(t *testing.T) {
	if got := estadoRespuesta(true); got != "Aceptada" {
		t.Errorf("estadoRespuesta(true) = %q, esperaba \"Aceptada\"", got)
	}
	if got := estadoRespuesta(false); got != "Rechazada" {
		t.Errorf("estadoRespuesta(false) = %q, esperaba \"Rechazada\"", got)
	}
}
