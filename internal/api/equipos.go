package api

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"convocados/internal/auth"
)

/* =========================================================
   Equipos
     GET    /api/equipos
     GET    /api/equipos/mis-equipos
     GET    /api/equipos/{id}
     POST   /api/equipos
     POST   /api/equipos/{id}/integrantes
     DELETE /api/equipos/{id}/integrantes/{usuario}
   ========================================================= */

type equipoJSON struct {
	ID          int64  `json:"id"`
	Nombre      string `json:"nombre"`
	Integrantes int    `json:"integrantes"`
	EsMio       bool   `json:"esMio"`
}

func (s *Server) equiposDelUsuario(idUsuario int64) ([]equipoJSON, error) {
	filas, err := s.DB.Query(`
		SELECT e.id_equipo, e.nombre,
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = e.id_equipo),
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = e.id_equipo AND id_usuario = ?)
		  FROM EQUIPO e
		  JOIN USUARIO_EQUIPO ue ON ue.id_equipo = e.id_equipo
		 WHERE ue.id_usuario = ?
		 ORDER BY e.nombre`, idUsuario, idUsuario)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	lista := []equipoJSON{}
	for filas.Next() {
		var eq equipoJSON
		var esMio int
		if err := filas.Scan(&eq.ID, &eq.Nombre, &eq.Integrantes, &esMio); err != nil {
			return nil, err
		}
		eq.EsMio = esMio > 0
		lista = append(lista, eq)
	}
	return lista, filas.Err()
}

// GET /api/equipos/mis-equipos
func (s *Server) misEquipos(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	lista, err := s.equiposDelUsuario(claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, lista)
}

// GET /api/equipos?q=
func (s *Server) listarEquipos(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	q := strings.TrimSpace(r.URL.Query().Get("q"))

	query := `
		SELECT e.id_equipo, e.nombre,
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = e.id_equipo),
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = e.id_equipo AND id_usuario = ?)
		  FROM EQUIPO e`
	args := []any{claims.Sub}
	if q != "" {
		query += " WHERE e.nombre LIKE ?"
		args = append(args, "%"+q+"%")
	}
	query += " ORDER BY e.nombre LIMIT 100"

	filas, err := s.DB.Query(query, args...)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	lista := []equipoJSON{}
	for filas.Next() {
		var eq equipoJSON
		var esMio int
		if err := filas.Scan(&eq.ID, &eq.Nombre, &eq.Integrantes, &esMio); err != nil {
			respondeErrJSON(w, err)
			return
		}
		eq.EsMio = esMio > 0
		lista = append(lista, eq)
	}
	JSON(w, http.StatusOK, lista)
}

type equipoReq struct {
	Nombre string `json:"nombre"`
}

// POST /api/equipos
func (s *Server) crearEquipo(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)

	var req equipoReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	req.Nombre = strings.TrimSpace(req.Nombre)
	if req.Nombre == "" {
		Error(w, http.StatusBadRequest, "Poné un nombre para el equipo.")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec("INSERT INTO EQUIPO (nombre) VALUES (?)", req.Nombre)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	id, _ := res.LastInsertId()
	if _, err := tx.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo) VALUES (?, ?)",
		claims.Sub, id); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusCreated, equipoJSON{ID: id, Nombre: req.Nombre, Integrantes: 1, EsMio: true})
}

// GET /api/equipos/{id}
func (s *Server) detalleEquipo(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}
	var nombre string
	if err := s.DB.QueryRow("SELECT nombre FROM EQUIPO WHERE id_equipo = ?", id).Scan(&nombre); err != nil {
		if err == sql.ErrNoRows {
			Error(w, http.StatusNotFound, "No encontramos ese equipo.")
			return
		}
		respondeErrJSON(w, err)
		return
	}

	filas, err := s.DB.Query(`
		SELECT u.id_usuario, u.nombre, u.apellido, COALESCE(u.foto, ''), COALESCE(u.posicion, '')
		  FROM USUARIO_EQUIPO ue
		  JOIN USUARIO u ON u.id_usuario = ue.id_usuario
		 WHERE ue.id_equipo = ? ORDER BY u.nombre`, id)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	integrantes := []map[string]any{}
	for filas.Next() {
		var idU int64
		var nombreU, apellido, foto, posicion string
		if err := filas.Scan(&idU, &nombreU, &apellido, &foto, &posicion); err != nil {
			respondeErrJSON(w, err)
			return
		}
		integrantes = append(integrantes, map[string]any{
			"id": idU, "nombre": capitalizar(nombreU), "apellido": capitalizar(apellido),
			"foto": foto, "posicion": posicion,
		})
	}

	claims := auth.ConClaims(r)
	var esMio int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		id, claims.Sub).Scan(&esMio)

	JSON(w, http.StatusOK, map[string]any{
		"id":          id,
		"nombre":      nombre,
		"esMio":       esMio > 0,
		"integrantes": integrantes,
	})
}

type integranteReq struct {
	IDUsuario int64 `json:"idUsuario"`
}

// POST /api/equipos/{id}/integrantes
func (s *Server) sumarIntegrante(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}
	var req integranteReq
	if err := decodificar(w, r, &req); err != nil || req.IDUsuario == 0 {
		Error(w, http.StatusBadRequest, "Indicá al jugador que querés sumar.")
		return
	}

	// Solo quien ya integra el equipo puede sumar gente
	var yo int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		id, claims.Sub).Scan(&yo)
	if yo == 0 {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}

	var existe int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO WHERE id_usuario = ?", req.IDUsuario).Scan(&existe)
	if existe == 0 {
		Error(w, http.StatusNotFound, "No encontramos a ese jugador.")
		return
	}

	if _, err := s.DB.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo) VALUES (?, ?)",
		req.IDUsuario, id); err != nil {
		Error(w, http.StatusConflict, "Ese jugador ya está en el equipo.")
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"ok": "jugador sumado al equipo"})
}

// DELETE /api/equipos/{id}/integrantes/{usuario}
func (s *Server) quitarIntegrante(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	quien, _ := strconv.ParseInt(r.PathValue("usuario"), 10, 64)

	// Se puede ir uno mismo, o sacar a otro si ya es integrante
	var yo, objetivo int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?", id, claims.Sub).Scan(&yo)
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?", id, quien).Scan(&objetivo)
	if yo == 0 {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}
	if objetivo == 0 {
		Error(w, http.StatusNotFound, "Ese jugador no está en el equipo.")
		return
	}

	if _, err := s.DB.Exec("DELETE FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		id, quien); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "jugador quitado del equipo"})
}
