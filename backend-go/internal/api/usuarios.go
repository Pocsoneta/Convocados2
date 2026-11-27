package api

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"convocados/internal/auth"
)

/* =========================================================
   Perfil público de otro jugador (lo usa Detalle de partido
   y la lista de equipos).
      GET /api/usuarios?q=   buscador (para sumar integrantes)
      GET /api/usuarios/{id}
   ========================================================= */

// GET /api/usuarios?q= — busca jugadores por nombre, apellido o
// email para sumarlos a un equipo. No devuelve la cuenta propia.
func (s *Server) listarUsuarios(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if len(q) < 2 {
		JSON(w, http.StatusOK, []any{})
		return
	}
	like := "%" + q + "%"

	filas, err := s.DB.Query(`
		SELECT id_usuario, nombre, apellido, COALESCE(foto, ''), COALESCE(localidad, '')
		  FROM USUARIO
		 WHERE (nombre LIKE ? OR apellido LIKE ? OR email LIKE ?)
		   AND id_usuario <> ?
		   AND es_invitado = 0
		 ORDER BY nombre, apellido
		 LIMIT 20`, like, like, like, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	lista := []map[string]any{}
	for filas.Next() {
		var id int64
		var nombre, apellido, foto, localidad string
		if err := filas.Scan(&id, &nombre, &apellido, &foto, &localidad); err != nil {
			respondeErrJSON(w, err)
			return
		}
		lista = append(lista, map[string]any{
			"id":        id,
			"nombre":    capitalizar(nombre),
			"apellido":  capitalizar(apellido),
			"foto":      foto,
			"localidad": localidad,
		})
	}
	JSON(w, http.StatusOK, lista)
}

func (s *Server) usuarioPublicoDetalle(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de jugador inválido.")
		return
	}

	u, err := s.buscarPorID(id)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "No encontramos a ese jugador.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	equipos, err := s.equiposDelUsuario(u.ID)
	if err != nil {
		equipos = []equipoJSON{}
	}

	JSON(w, http.StatusOK, map[string]any{
		"id":        u.ID,
		"nombre":    capitalizar(u.Nombre),
		"apellido":  capitalizar(u.Apellido),
		"localidad": aString(u.Localidad),
		"foto":      aString(u.Foto),
		"promedio":  u.Promedio,
		"equipos":   equipos,
	})
}
