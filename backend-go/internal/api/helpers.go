package api

import (
	"database/sql"
	"math"
	"strings"
)

/* =========================================================
   Helpers compartidos: geo, normalización y formatos.
   ========================================================= */

// Centro por defecto (CABA) cuando el navegador no pasa coordenadas.
const (
	LatPorDefecto = -34.6037
	LngPorDefecto = -58.3816
	// Radio para armar "zonasCercanas" (km)
	RadioZonas = 8.0
)

// distKm calcula la distancia en línea recta entre dos puntos.
func distKm(lat1, lng1, lat2, lng2 float64) float64 {
	const R = 6371.0
	a := math.Pi / 180
	dLat := (lat2 - lat1) * a
	dLng := (lng2 - lng1) * a
	h := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(lat1*a)*math.Cos(lat2*a)*math.Sin(dLng/2)*math.Sin(dLng/2)
	return 2 * R * math.Asin(math.Min(1, math.Sqrt(h)))
}

// redondea a un decimal: el front muestra "1,2 km".
func km1(v float64) float64 {
	return math.Round(v*10) / 10
}

// slugModalidad pasa de "Fútbol 5" a "futbol-5"
// (la clave que usa el front en data-modalidad).
func slugModalidad(m string) string {
	m = strings.ToLower(strings.TrimSpace(m))
	m = strings.ReplaceAll(m, "ú", "u")
	m = strings.ReplaceAll(m, "á", "a")
	m = strings.ReplaceAll(m, "é", "e")
	m = strings.ReplaceAll(m, "í", "i")
	m = strings.ReplaceAll(m, "ó", "o")
	m = strings.ReplaceAll(m, "ú", "u")
	m = strings.ReplaceAll(m, "ñ", "n")
	m = strings.ReplaceAll(m, " ", "-")
	return m
}

// zonaTexto arma "Palermo, CABA".
func zonaTexto(barrio, ciudad string) string {
	b := strings.TrimSpace(barrio)
	c := strings.TrimSpace(ciudad)
	switch {
	case b != "" && c != "":
		return b + ", " + c
	case b != "":
		return b
	case c != "":
		return c
	default:
		return ""
	}
}

// normaliza las posiciones enviadas por el front ("AR,DEF,MC").
func normalizarPosiciones(posiciones []string) string {
	limpias := make([]string, 0, len(posiciones))
	vistas := map[string]bool{}
	for _, p := range posiciones {
		p = strings.ToUpper(strings.TrimSpace(p))
		if p == "" || vistas[p] {
			continue
		}
		vistas[p] = true
		limpias = append(limpias, p)
	}
	return strings.Join(limpias, ",")
}

func csvALista(csv string) []string {
	if strings.TrimSpace(csv) == "" {
		return []string{}
	}
	parte := strings.Split(csv, ",")
	salida := make([]string, 0, len(parte))
	for _, p := range parte {
		if p = strings.TrimSpace(p); p != "" {
			salida = append(salida, p)
		}
	}
	return salida
}

func aFloat64(v sql.NullFloat64) float64 {
	if v.Valid {
		return v.Float64
	}
	return 0
}

func aString(v sql.NullString) string {
	if v.Valid {
		return v.String
	}
	return ""
}

// capitalizar pone mayúscula inicial (igual que hace el front al mostrar).
func capitalizar(s string) string {
	s = strings.TrimSpace(s)
	if s == "" {
		return s
	}
	return strings.ToUpper(s[:1]) + s[1:]
}
