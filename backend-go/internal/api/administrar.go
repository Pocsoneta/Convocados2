package api

import (
	"database/sql"
	"net/http"
	"strconv"

	"convocados/internal/auth"
)

/* =========================================================
   Administración de un partido (solo el organizador).
     GET    /api/partidos/{id}/administracion
     POST   /api/partidos/{id}/solicitudes/{usuario}/aceptar
     DELETE /api/partidos/{id}/solicitudes/{usuario}
     DELETE /api/partidos/{id}/participantes/{usuario}
     POST   /api/partidos/{id}/cancelar
   ========================================================= */

// partidoDelOrganizador devuelve el id del partido si quien llama es su
// organizador. Si no, responde el error y devuelve false.
func (s *Server) partidoDelOrganizador(w http.ResponseWriter, r *http.Request) (int64, bool) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return 0, false
	}

	var creador sql.NullInt64
	err = s.DB.QueryRow("SELECT id_usuario_creador FROM PARTIDO WHERE id_partido = ?", id).Scan(&creador)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "No encontramos ese partido.")
		return 0, false
	}
	if err != nil {
		respondeErrJSON(w, err)
		return 0, false
	}
	if !creador.Valid || creador.Int64 != claims.Sub {
		Error(w, http.StatusForbidden, "Solo el organizador puede administrar este partido.")
		return 0, false
	}
	return id, true
}

// usuarioDeRuta lee {usuario} de la ruta.
func usuarioDeRuta(r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("usuario"), 10, 64)
	return id, err == nil
}

type jugadorJSON struct {
	ID       int64  `json:"id"`
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
	Foto     string `json:"foto"`
}

// listarJugadores devuelve los jugadores de un partido con un estado dado
// ("Pendiente" o "Confirmado"), en el orden en que se sumaron.
func (s *Server) listarJugadores(idPartido int64, estado string) ([]jugadorJSON, error) {
	filas, err := s.DB.Query(`
		SELECT u.id_usuario, u.nombre, u.apellido, COALESCE(u.foto, '')
		  FROM USUARIO_PARTIDO up
		  JOIN USUARIO u ON u.id_usuario = up.id_usuario
		 WHERE up.id_partido = ? AND up.estado = ? AND up.fecha_baja IS NULL
		 ORDER BY up.fecha_alta`, idPartido, estado)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	lista := []jugadorJSON{}
	for filas.Next() {
		var j jugadorJSON
		if err := filas.Scan(&j.ID, &j.Nombre, &j.Apellido, &j.Foto); err != nil {
			return nil, err
		}
		j.Nombre = capitalizar(j.Nombre)
		j.Apellido = capitalizar(j.Apellido)
		lista = append(lista, j)
	}
	return lista, filas.Err()
}

// GET /api/partidos/{id}/administracion
func (s *Server) administrarPartido(w http.ResponseWriter, r *http.Request) {
	id, ok := s.partidoDelOrganizador(w, r)
	if !ok {
		return
	}

	p, err := escanearPartido(s.DB.QueryRow(colsPartido+" WHERE p.id_partido = ?", id))
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	complejos, _ := cargarComplejos(s.DB)

	solicitudes, err := s.listarJugadores(id, "Pendiente")
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	confirmados, err := s.listarJugadores(id, "Confirmado")
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	JSON(w, http.StatusOK, map[string]any{
		"partido":     p.aJSON(complejos, p.Lat, p.Lng),
		"solicitudes": solicitudes,
		"confirmados": confirmados,
	})
}

// POST /api/partidos/{id}/solicitudes/{usuario}/aceptar
func (s *Server) aceptarSolicitud(w http.ResponseWriter, r *http.Request) {
	id, ok := s.partidoDelOrganizador(w, r)
	if !ok {
		return
	}
	usuario, ok := usuarioDeRuta(r)
	if !ok {
		Error(w, http.StatusBadRequest, "Identificador de jugador inválido.")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	// Bloquea el partido: dos aceptaciones seguidas no pueden pasarse del cupo.
	var estado string
	var cupo int
	if err := tx.QueryRow("SELECT estado, cupo_total FROM PARTIDO WHERE id_partido = ? FOR UPDATE",
		id).Scan(&estado, &cupo); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if estado != "Publicado" {
		respondeErrJSON(w, mal("Ese partido ya no está publicado."))
		return
	}

	var ocupados int
	if err := tx.QueryRow(sqlOcupados, id, id).Scan(&ocupados); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if ocupados >= cupo {
		Error(w, http.StatusConflict, "No quedan cupos libres para ese partido.")
		return
	}

	res, err := tx.Exec(`UPDATE USUARIO_PARTIDO SET estado = 'Confirmado'
	                      WHERE id_partido = ? AND id_usuario = ? AND estado = 'Pendiente' AND fecha_baja IS NULL`,
		id, usuario)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, "Ese jugador no tiene una solicitud pendiente.")
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "solicitud aceptada"})
}

// cambiarJugador da de baja a un jugador que esté en el estado dado.
func (s *Server) cambiarJugador(w http.ResponseWriter, r *http.Request, estado, mensaje string) {
	id, ok := s.partidoDelOrganizador(w, r)
	if !ok {
		return
	}
	usuario, ok := usuarioDeRuta(r)
	if !ok {
		Error(w, http.StatusBadRequest, "Identificador de jugador inválido.")
		return
	}

	res, err := s.DB.Exec(`UPDATE USUARIO_PARTIDO SET fecha_baja = NOW()
	                        WHERE id_partido = ? AND id_usuario = ? AND estado = ? AND fecha_baja IS NULL`,
		id, usuario, estado)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, mensaje)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "listo"})
}

// DELETE /api/partidos/{id}/solicitudes/{usuario}
func (s *Server) rechazarSolicitud(w http.ResponseWriter, r *http.Request) {
	s.cambiarJugador(w, r, "Pendiente", "Ese jugador no tiene una solicitud pendiente.")
}

// DELETE /api/partidos/{id}/participantes/{usuario}
func (s *Server) quitarParticipante(w http.ResponseWriter, r *http.Request) {
	s.cambiarJugador(w, r, "Confirmado", "Ese jugador no está confirmado en el partido.")
}

// POST /api/partidos/{id}/cancelar
func (s *Server) cancelarPartido(w http.ResponseWriter, r *http.Request) {
	id, ok := s.partidoDelOrganizador(w, r)
	if !ok {
		return
	}
	res, err := s.DB.Exec(`UPDATE PARTIDO SET estado = 'Cancelado'
	                        WHERE id_partido = ? AND estado = 'Publicado'`, id)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusConflict, "El partido ya no está publicado.")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "partido cancelado"})
}
