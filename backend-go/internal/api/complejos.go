package api

import (
	"context"
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"
)

/* =========================================================
   Complejos: se cargan enteros porque son pocos y así se
   pueden calcular distancias y "zonas cercanas" en Go.
   ========================================================= */

type complejoGeo struct {
	ID      int64
	Nombre  string
	Direc   string
	Barrio  string
	Ciudad  string
	Lat     float64
	Lng     float64
	Canchas []cancha
}

type cancha struct {
	ID         int64  `json:"id"`
	Numero     *int   `json:"numero"`
	Nombre     string `json:"nombre"`
	Direccion  string `json:"direccion"`
	TipoCancha string `json:"tipoCancha"`
	TipoSuelo  string `json:"tipoSuelo"`
}

// juntarComas une las partes no vacías con ", " para armar la consulta de
// geocodificación sin dejar comas sueltas.
func juntarComas(partes ...string) string {
	limpias := make([]string, 0, len(partes))
	for _, p := range partes {
		if s := strings.TrimSpace(p); s != "" {
			limpias = append(limpias, s)
		}
	}
	return strings.Join(limpias, ", ")
}

const sqlComplejos = `
SELECT id_complejo, nombre, direccion,
       COALESCE(barrio, ''), COALESCE(ciudad, ''),
       COALESCE(lat, 0), COALESCE(lng, 0)
FROM COMPLEJO
ORDER BY nombre`

func cargarComplejos(db *sql.DB) (map[int64]complejoGeo, error) {
	filas, err := db.Query(sqlComplejos)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	mapa := map[int64]complejoGeo{}
	for filas.Next() {
		var c complejoGeo
		if err := filas.Scan(&c.ID, &c.Nombre, &c.Direc, &c.Barrio, &c.Ciudad, &c.Lat, &c.Lng); err != nil {
			return nil, err
		}
		mapa[c.ID] = c
	}
	return mapa, filas.Err()
}

// zonasCercanas devuelve los barrios de otros complejos dentro del radio,
// ordenados por distancia (máx 3, como en el demo del front).
func zonasCercanas(mapa map[int64]complejoGeo, desde complejoGeo) []string {
	type par struct {
		barrio string
		km     float64
	}
	vistas := map[string]bool{}
	lista := []par{}

	for _, c := range mapa {
		if c.ID == desde.ID || strings.TrimSpace(c.Barrio) == "" {
			continue
		}
		if strings.EqualFold(c.Barrio, desde.Barrio) {
			continue
		}
		km := distKm(desde.Lat, desde.Lng, c.Lat, c.Lng)
		if km > RadioZonas || vistas[c.Barrio] {
			continue
		}
		vistas[c.Barrio] = true
		lista = append(lista, par{barrio: c.Barrio, km: km})
	}

	// orden por distancia
	for i := 1; i < len(lista); i++ {
		for j := i; j > 0 && lista[j].km < lista[j-1].km; j-- {
			lista[j], lista[j-1] = lista[j-1], lista[j]
		}
	}

	salida := make([]string, 0, 3)
	for _, p := range lista {
		if len(salida) == 3 {
			break
		}
		salida = append(salida, p.barrio)
	}
	return salida
}

/* =========================================================
   Endpoints de complejos y canchas
     GET  /api/complejos
     POST /api/complejos
     GET  /api/complejos/{id}/canchas
   ========================================================= */

type complejoJSON struct {
	ID        int64    `json:"id"`
	Nombre    string   `json:"nombre"`
	Direccion string   `json:"direccion"`
	Barrio    string   `json:"barrio"`
	Ciudad    string   `json:"ciudad"`
	Zona      string   `json:"zona"`
	Lat       float64  `json:"lat"`
	Lng       float64  `json:"lng"`
	Canchas   []cancha `json:"canchas"`
}

func (s *Server) cargarCanchas() (map[int64][]cancha, error) {
	filas, err := s.DB.Query(`
		SELECT id_cancha, id_complejo, numero_cancha, nombre, direccion,
		       COALESCE(tipo_cancha, ''), COALESCE(tipo_suelo, '')
		  FROM CANCHA ORDER BY numero_cancha`)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	mapa := map[int64][]cancha{}
	for filas.Next() {
		var c cancha
		var idComplejo sql.NullInt64
		var numero sql.NullInt64
		if err := filas.Scan(&c.ID, &idComplejo, &numero, &c.Nombre, &c.Direccion,
			&c.TipoCancha, &c.TipoSuelo); err != nil {
			return nil, err
		}
		if numero.Valid {
			n := int(numero.Int64)
			c.Numero = &n
		}
		if idComplejo.Valid {
			mapa[idComplejo.Int64] = append(mapa[idComplejo.Int64], c)
		}
	}
	return mapa, filas.Err()
}

// GET /api/complejos
func (s *Server) listarComplejos(w http.ResponseWriter, r *http.Request) {
	filas, err := s.DB.Query(sqlComplejos)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	canchas, err := s.cargarCanchas()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	lista := []complejoJSON{}
	for filas.Next() {
		var c complejoGeo
		if err := filas.Scan(&c.ID, &c.Nombre, &c.Direc, &c.Barrio, &c.Ciudad, &c.Lat, &c.Lng); err != nil {
			respondeErrJSON(w, err)
			return
		}
		lista = append(lista, complejoJSON{
			ID:        c.ID,
			Nombre:    c.Nombre,
			Direccion: c.Direc,
			Barrio:    c.Barrio,
			Ciudad:    c.Ciudad,
			Zona:      zonaTexto(c.Barrio, c.Ciudad),
			Lat:       c.Lat,
			Lng:       c.Lng,
			Canchas:   canchas[c.ID],
		})
	}
	JSON(w, http.StatusOK, lista)
}

// complejoNuevo es la cancha que escribe el organizador al crear un partido.
type complejoNuevo struct {
	Nombre    string   `json:"nombre"`
	Direccion string   `json:"direccion"`
	Lat       *float64 `json:"lat"`
	Lng       *float64 `json:"lng"`
}

// resolverComplejo devuelve el id de la cancha. Si ya existe (mismo nombre
// y dirección, sin importar mayúsculas) la reutiliza; si no, la crea. Las
// coordenadas llegan del selector de Google Maps (o del pin en el mapa) y
// son opcionales: si el registro existente no las tiene, se completan.
//
// Si el front no manda coordenadas, intenta geocodificar la dirección
// escrita a mano para que el partido no quede sin ubicación (sin esto
// aparecía a miles de km, en el punto 0,0). La ciudad del complejo es la
// del organizador (ej. "Mendoza"), no siempre CABA.
func (s *Server) resolverComplejo(ctx context.Context, c *complejoNuevo, ciudad string) (int64, error) {
	nombre := strings.TrimSpace(c.Nombre)
	direccion := strings.TrimSpace(c.Direccion)
	if nombre == "" {
		return 0, mal("Ingresá el nombre de la cancha.")
	}
	if direccion == "" {
		direccion = nombre
	}
	ciudad = strings.TrimSpace(ciudad)

	// Las consultas a Nominatim son best-effort y pueden tardar; con un
	// tope total evitamos que el alta de un partido quede colgada cuando
	// no vinieron coordenadas (peor caso: forward + forward + reverse).
	geoctx, cancelar := context.WithTimeout(ctx, 4*time.Second)
	defer cancelar()

	// Coordenadas: primero las que mandó el front. Si no vinieron,
	// probamos geocodificar "nombre, dirección[, ciudad]" y, si falla,
	// "nombre[, ciudad]".
	lat, lng, hay := 0.0, 0.0, false
	if c.Lat != nil && c.Lng != nil && tieneUbicacion(*c.Lat, *c.Lng) {
		lat, lng, hay = *c.Lat, *c.Lng, true
	} else {
		lat, lng, hay = coordenadasDeTexto(geoctx, juntarComas(nombre, direccion, ciudad))
		if !hay {
			lat, lng, hay = coordenadasDeTexto(geoctx, juntarComas(nombre, ciudad))
		}
	}

	// La ciudad no se fuerza a "CABA": si no la mandaron (p. ej. el
	// organizador no tiene localidad), se deriva del punto con el
	// reverse de OpenStreetMap y, si tampoco, queda sin ciudad (NULL).
	if ciudad == "" && hay {
		ciudad = ciudadDeCoords(geoctx, lat, lng)
	}

	var latArg, lngArg any
	if hay {
		latArg, lngArg = lat, lng
	}
	var ciudadArg any
	if ciudad != "" {
		ciudadArg = ciudad
	}

	var id int64
	err := s.DB.QueryRow(`SELECT id_complejo FROM COMPLEJO
	                       WHERE LOWER(nombre) = LOWER(?) AND LOWER(direccion) = LOWER(?)
	                       LIMIT 1`, nombre, direccion).Scan(&id)
	if err == nil {
		if hay {
			_, _ = s.DB.Exec(`UPDATE COMPLEJO
			                     SET lat = COALESCE(lat, ?), lng = COALESCE(lng, ?)
			                   WHERE id_complejo = ?`, lat, lng, id)
		}
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}

	res, err := s.DB.Exec(`INSERT INTO COMPLEJO (nombre, direccion, ciudad, lat, lng)
	                        VALUES (?, ?, ?, ?, ?)`, nombre, direccion, ciudadArg, latArg, lngArg)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

type canchaReq struct {
	Numero     *int   `json:"numero"`
	Nombre     string `json:"nombre"`
	TipoCancha string `json:"tipoCancha"`
	TipoSuelo  string `json:"tipoSuelo"`
}

type complejoReq struct {
	Nombre    string      `json:"nombre"`
	Direccion string      `json:"direccion"`
	Barrio    string      `json:"barrio"`
	Ciudad    string      `json:"ciudad"`
	Lat       float64     `json:"lat"`
	Lng       float64     `json:"lng"`
	Canchas   []canchaReq `json:"canchas"`
}

// POST /api/complejos  (lo usa la pantalla "Crear partido")
func (s *Server) crearComplejo(w http.ResponseWriter, r *http.Request) {
	var req complejoReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Direccion = strings.TrimSpace(req.Direccion)
	if req.Nombre == "" {
		Error(w, http.StatusBadRequest, "Ingresá el nombre del complejo.")
		return
	}
	if req.Direccion == "" {
		Error(w, http.StatusBadRequest, "Ingresá la dirección.")
		return
	}
	// La ciudad no se fuerza a "CABA": si no vino y hay coordenadas, se
	// deriva del punto; si no, queda vacía (NULL en la base).
	req.Ciudad = strings.TrimSpace(req.Ciudad)
	if req.Ciudad == "" && tieneUbicacion(req.Lat, req.Lng) {
		geoctx, cancelar := context.WithTimeout(r.Context(), 4*time.Second)
		req.Ciudad = ciudadDeCoords(geoctx, req.Lat, req.Lng)
		cancelar()
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	var ciudadArg any
	if req.Ciudad != "" {
		ciudadArg = req.Ciudad
	}
	res, err := tx.Exec(`INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
	                      VALUES (?, ?, ?, ?, ?, ?)`,
		req.Nombre, req.Direccion, strings.TrimSpace(req.Barrio), ciudadArg, req.Lat, req.Lng)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	id, _ := res.LastInsertId()

	for _, c := range req.Canchas {
		var numero any
		if c.Numero != nil {
			numero = *c.Numero
		}
		if _, err := tx.Exec(
			`INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			id, numero, strings.TrimSpace(c.Nombre), req.Direccion,
			strings.TrimSpace(c.TipoCancha), strings.TrimSpace(c.TipoSuelo)); err != nil {
			respondeErrJSON(w, err)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	w.Header().Set("Location", "/api/complejos/"+strconv.FormatInt(id, 10))
	JSON(w, http.StatusCreated, map[string]any{"id": id, "ok": "complejo creado"})
}

// GET /api/complejos/{id}/canchas
func (s *Server) canchasDeComplejo(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de complejo inválido.")
		return
	}
	filas, err := s.DB.Query(`
		SELECT id_cancha, numero_cancha, nombre, direccion, COALESCE(tipo_cancha,''), COALESCE(tipo_suelo,'')
		  FROM CANCHA WHERE id_complejo = ? ORDER BY numero_cancha`, id)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	lista := []cancha{}
	for filas.Next() {
		var c cancha
		var numero sql.NullInt64
		if err := filas.Scan(&c.ID, &numero, &c.Nombre, &c.Direccion, &c.TipoCancha, &c.TipoSuelo); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if numero.Valid {
			n := int(numero.Int64)
			c.Numero = &n
		}
		lista = append(lista, c)
	}
	JSON(w, http.StatusOK, lista)
}
