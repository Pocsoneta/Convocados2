package api

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
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
// coordenadas llegan del selector de Google Maps y son opcionales: si el
// registro existente no las tiene, se completan con las nuevas.
func (s *Server) resolverComplejo(c *complejoNuevo) (int64, error) {
	nombre := strings.TrimSpace(c.Nombre)
	direccion := strings.TrimSpace(c.Direccion)
	if nombre == "" {
		return 0, mal("Ingresá el nombre de la cancha.")
	}
	if direccion == "" {
		direccion = nombre
	}

	var lat, lng any
	if c.Lat != nil && c.Lng != nil {
		lat, lng = *c.Lat, *c.Lng
	}

	var id int64
	err := s.DB.QueryRow(`SELECT id_complejo FROM COMPLEJO
	                       WHERE LOWER(nombre) = LOWER(?) AND LOWER(direccion) = LOWER(?)
	                       LIMIT 1`, nombre, direccion).Scan(&id)
	if err == nil {
		if lat != nil {
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
	                        VALUES (?, ?, 'CABA', ?, ?)`, nombre, direccion, lat, lng)
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
	if req.Ciudad == "" {
		req.Ciudad = "CABA"
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
	                      VALUES (?, ?, ?, ?, ?, ?)`,
		req.Nombre, req.Direccion, strings.TrimSpace(req.Barrio), req.Ciudad, req.Lat, req.Lng)
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
