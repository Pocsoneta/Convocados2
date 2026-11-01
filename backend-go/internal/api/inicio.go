package api

import (
	"net/http"
	"strings"

	"convocados/internal/auth"
)

/* =========================================================
   Pantalla de Inicio. El front llama a tres funciones:
     obtenerPartidosCercanos() -> GET /api/inicio/cercanos
     obtenerProximoPartido()   -> GET /api/inicio/proximo
     obtenerConteoModalidades()-> GET /api/inicio/conteos
   ========================================================= */

// GET /api/inicio/cercanos?lat=&lng=&limit=
func (s *Server) cercanos(w http.ResponseWriter, r *http.Request) {
	f := leerFiltros(r)
	f.Orden = "distancia"
	if f.Limit <= 0 {
		f.Limit = 3
	}
	if f.Limit > 12 {
		f.Limit = 12
	}

	lista, complejos, err := s.consultarPartidos(f)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	salida := make([]partidoJSON, 0, len(lista))
	for i := range lista {
		salida = append(salida, lista[i].aJSON(complejos, f.Lat, f.Lng))
	}
	JSON(w, http.StatusOK, salida)
}

// GET /api/inicio/proximo?lat=&lng=
func (s *Server) proximoPartido(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	if claims == nil {
		JSON(w, http.StatusOK, nil)
		return
	}
	lat := porDefectoFloat(r.URL.Query().Get("lat"), LatPorDefecto)
	lng := porDefectoFloat(r.URL.Query().Get("lng"), LngPorDefecto)

	const consulta = colsPartido + `
		 WHERE p.estado = 'Publicado'
		   AND p.fecha_hora >= NOW()
		   AND (
		        EXISTS (SELECT 1 FROM USUARIO_PARTIDO up
		                 WHERE up.id_partido = p.id_partido
		                   AND up.id_usuario = ? AND up.fecha_baja IS NULL)
		     OR EXISTS (SELECT 1 FROM EQUIPO_PARTIDO ep
		                 JOIN USUARIO_EQUIPO ue ON ue.id_equipo = ep.id_equipo
		                WHERE ep.id_partido = p.id_partido
		                  AND ue.id_usuario = ? AND ep.fecha_baja IS NULL)
		   )
		 ORDER BY p.fecha_hora ASC
		 LIMIT 1`

	p, err := escanearPartido(s.DB.QueryRow(consulta, claims.Sub, claims.Sub))
	if err != nil {
		// sin resultados (o error): el front muestra el estado vacío
		JSON(w, http.StatusOK, nil)
		return
	}

	complejos, _ := cargarComplejos(s.DB)
	direccion := p.Direccion
	if direccion == "" {
		direccion = p.Zona()
	}

	JSON(w, http.StatusOK, map[string]any{
		"id":          p.ID,
		"nombre":      p.Nombre(),
		"fecha":       p.FechaISO(),
		"direccion":   direccion,
		"modalidad":   p.Modalidad,
		"nivel":       p.Nivel,
		"cupos":       p.Disponibles(),
		"zona":        p.Zona(),
		"lat":         p.Lat,
		"lng":         p.Lng,
		"distanciaKm": km1(distKm(lat, lng, p.Lat, p.Lng)),
		"item":        p.aJSON(complejos, lat, lng),
	})
}

// GET /api/inicio/conteos
// Devuelve { "futbol-5": 12, "futbol-7": 4, ... } (claves slug, como
// las usa el front en data-modalidad).
func (s *Server) conteoModalidades(w http.ResponseWriter, r *http.Request) {
	filas, err := s.DB.Query(`
		SELECT COALESCE(modalidad, 'Fútbol 5'), COUNT(*)
		  FROM PARTIDO
		 WHERE estado = 'Publicado' AND fecha_hora >= NOW()
		 GROUP BY modalidad`)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	salida := map[string]int{}
	total := 0
	for filas.Next() {
		var modalidad string
		var cantidad int
		if err := filas.Scan(&modalidad, &cantidad); err != nil {
			respondeErrJSON(w, err)
			return
		}
		salida[slugModalidad(modalidad)] = cantidad
		total += cantidad
	}
	salida["total"] = total
	JSON(w, http.StatusOK, salida)
}

// GET /api/mis-partidos?momento=proximos|pasados
func (s *Server) misPartidos(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	if claims == nil {
		Error(w, http.StatusUnauthorized, "Sesión inválida o vencida.")
		return
	}

	pasados := strings.EqualFold(r.URL.Query().Get("momento"), "pasados")

	condFecha := "p.fecha_hora >= NOW()"
	orden := "p.fecha_hora ASC"
	if pasados {
		condFecha = "p.fecha_hora < NOW()"
		orden = "p.fecha_hora DESC"
	}

	consulta := colsPartido + `
		 WHERE ` + condFecha + `
		   AND (
		        EXISTS (SELECT 1 FROM USUARIO_PARTIDO up
		                 WHERE up.id_partido = p.id_partido
		                   AND up.id_usuario = ? AND up.fecha_baja IS NULL)
		     OR EXISTS (SELECT 1 FROM EQUIPO_PARTIDO ep
		                 JOIN USUARIO_EQUIPO ue ON ue.id_equipo = ep.id_equipo
		                WHERE ep.id_partido = p.id_partido
		                  AND ue.id_usuario = ? AND ep.fecha_baja IS NULL)
		   )
		 ORDER BY ` + orden + `
		 LIMIT 50`

	filas, err := s.DB.Query(consulta, claims.Sub, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	f := leerFiltros(r)
	complejos, _ := cargarComplejos(s.DB)

	lista := []partidoJSON{}
	for filas.Next() {
		p, err := escanearPartido(filas)
		if err != nil {
			respondeErrJSON(w, err)
			return
		}
		lista = append(lista, p.aJSON(complejos, f.Lat, f.Lng))
	}
	JSON(w, http.StatusOK, lista)
}
