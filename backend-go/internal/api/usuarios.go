package api

import (
	"database/sql"
	"net/http"
	"strconv"
)

/* =========================================================
   Perfil público de otro jugador (lo usa Detalle de partido
   y la lista de equipos).
     GET /api/usuarios/{id}
   ========================================================= */

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
		"nivel":     aString(u.Nivel),
		"promedio":  u.Promedio,
		"equipos":   equipos,
	})
}
