package api

import (
	"database/sql"
	"net/http"
	"sort"
	"strconv"
)

/* =========================================================
   GET /api/canchas  (sesión requerida)

   Las canchas que tienen coordenadas, más cercanas al punto que
   pasa el front. La coordenada sale del complejo al que
   pertenece la cancha (ahí es donde se geolocaliza el lugar).

   Son pocos registros: se cargan todos y se ordena en Go, igual
   que hace cargarComplejos. No hace falta un índice espacial
   para esto.

   Query string:
     lat, lng  punto de partida (si no vienen, CABA, igual que
               usa GET /api/partidos)
     radio     distancia máxima en km (opcional; 0 = sin límite)
     limit     cuántas devolver (por defecto 200, tope 1000)
   ========================================================= */

type canchaMapa struct {
	ID          int64   `json:"id"`
	IDComplejo  *int64  `json:"idComplejo,omitempty"`
	Numero      *int    `json:"numero,omitempty"`
	Nombre      string  `json:"nombre"`
	Complejo    string  `json:"complejo"`
	Direccion   string  `json:"direccion"`
	Barrio      string  `json:"barrio"`
	Ciudad      string  `json:"ciudad"`
	Zona        string  `json:"zona"`
	TipoCancha  string  `json:"tipoCancha"`
	TipoSuelo   string  `json:"tipoSuelo"`
	Lat         float64 `json:"lat"`
	Lng         float64 `json:"lng"`
	DistanciaKm float64 `json:"distanciaKm"`
}

// c.lat/c.lng = 0 significa "el complejo se cargó a mano y nunca se
// pudo geolocalizar": esas canchas no se pueden dibujar en un mapa.
//
// Se recorre desde COMPLEJO con LEFT JOIN a CANCHA: así también
// aparecen los complejos que todavía no tienen filas en CANCHA (los
// que se crean al publicar un partido, marcando la cancha con el pin).
// Para esos, el id es negativo (el del complejo) para no chocar con los
// id de cancha reales.
const sqlCanchasMapa = `
SELECT COALESCE(ca.id_cancha, -c.id_complejo), c.id_complejo, ca.numero_cancha,
       COALESCE(NULLIF(ca.nombre, ''), c.nombre, ''),
       COALESCE(NULLIF(ca.direccion, ''), c.direccion, ''),
       COALESCE(ca.tipo_cancha, ''), COALESCE(ca.tipo_suelo, ''),
       COALESCE(c.nombre, ''), COALESCE(c.barrio, ''), COALESCE(c.ciudad, ''),
       c.lat, c.lng
  FROM COMPLEJO c
  LEFT JOIN CANCHA ca ON ca.id_complejo = c.id_complejo
 WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
   AND c.lat BETWEEN -90 AND 90
   AND c.lng BETWEEN -180 AND 180
   AND NOT (c.lat = 0 AND c.lng = 0)`

func (s *Server) listarCanchas(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	lat := porDefectoFloat(q.Get("lat"), LatPorDefecto)
	lng := porDefectoFloat(q.Get("lng"), LngPorDefecto)
	radio, _ := strconv.ParseFloat(q.Get("radio"), 64)
	limit, _ := strconv.Atoi(q.Get("limit"))
	if limit <= 0 {
		limit = 200
	}
	if limit > 1000 {
		limit = 1000
	}

	filas, err := s.DB.Query(sqlCanchasMapa)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	lista := []canchaMapa{}
	for filas.Next() {
		var c canchaMapa
		var idComplejo sql.NullInt64
		var numero sql.NullInt64
		if err := filas.Scan(&c.ID, &idComplejo, &numero, &c.Nombre, &c.Direccion,
			&c.TipoCancha, &c.TipoSuelo, &c.Complejo, &c.Barrio, &c.Ciudad,
			&c.Lat, &c.Lng); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if idComplejo.Valid {
			id := idComplejo.Int64
			c.IDComplejo = &id
		}
		if numero.Valid {
			n := int(numero.Int64)
			c.Numero = &n
		}
		c.Zona = zonaTexto(c.Barrio, c.Ciudad)
		c.DistanciaKm = km1(distKm(lat, lng, c.Lat, c.Lng))
		lista = append(lista, c)
	}
	if err := filas.Err(); err != nil {
		respondeErrJSON(w, err)
		return
	}

	// Más cercanas primero
	sort.Slice(lista, func(i, j int) bool {
		return lista[i].DistanciaKm < lista[j].DistanciaKm
	})

	if radio > 0 {
		dentro := lista[:0]
		for _, c := range lista {
			if c.DistanciaKm <= radio {
				dentro = append(dentro, c)
			}
		}
		lista = dentro
	}
	if len(lista) > limit {
		lista = lista[:limit]
	}

	JSON(w, http.StatusOK, lista)
}
