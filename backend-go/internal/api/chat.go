package api

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"
	"time"

	"convocados/internal/auth"
)

/* =========================================================
   Chat del partido
     GET  /api/partidos/{id}/mensajes?desde=
     POST /api/partidos/{id}/mensajes   {texto}

   Lo pueden leer y escribir el organizador y los jugadores
   confirmados (individualmente o a través de un equipo
   inscripto en el partido).

   El rango no se guarda en el mensaje: se calcula al leer.
     organizador = quien creó el partido
     capitán     = integrante más antiguo de un equipo inscripto
   ========================================================= */

// sqlMensajes trae los mensajes con su autor y sus rangos.
const sqlMensajes = `
	SELECT m.id_mensaje, m.texto, m.creado_en,
	       u.id_usuario, u.nombre, u.apellido, COALESCE(u.foto, ''),
	       (m.id_usuario = p.id_usuario_creador),
	       EXISTS (SELECT 1 FROM USUARIO_EQUIPO ue
	                 JOIN EQUIPO_PARTIDO ep ON ep.id_equipo = ue.id_equipo
	                WHERE ue.id_usuario = m.id_usuario
	                  AND ep.id_partido = m.id_partido
	                  AND ep.estado = 'Confirmado'
	                  AND ep.fecha_baja IS NULL
	                  AND ue.id_usuario_equipo = (SELECT MIN(ue2.id_usuario_equipo)
	                                                FROM USUARIO_EQUIPO ue2
	                                               WHERE ue2.id_equipo = ue.id_equipo))
	  FROM MENSAJE_PARTIDO m
	  JOIN USUARIO u ON u.id_usuario = m.id_usuario
	  JOIN PARTIDO p ON p.id_partido = m.id_partido
	 WHERE m.id_partido = ?`

type mensajeJSON struct {
	ID          int64          `json:"id"`
	Texto       string         `json:"texto"`
	Creado      time.Time      `json:"creadoEn"`
	Autor       map[string]any `json:"autor"`
	Organizador bool           `json:"organizador"`
	Capitan     bool           `json:"capitan"`
	Mio         bool           `json:"mio"`
}

// puedeChatear dice si el usuario participa del chat: es el
// organizador, está confirmado individualmente o es integrante de
// un equipo confirmado en el partido.
func (s *Server) puedeChatear(idPartido, idUsuario int64) (bool, error) {
	var n int
	err := s.DB.QueryRow(`
		SELECT COUNT(*) FROM PARTIDO p
		 WHERE p.id_partido = ?
		   AND (p.id_usuario_creador = ?
		     OR EXISTS (SELECT 1 FROM USUARIO_PARTIDO up
		                 WHERE up.id_partido = p.id_partido
		                   AND up.id_usuario = ?
		                   AND up.estado = 'Confirmado'
		                   AND up.fecha_baja IS NULL)
		     OR EXISTS (SELECT 1 FROM EQUIPO_PARTIDO ep
		                 JOIN USUARIO_EQUIPO ue ON ue.id_equipo = ep.id_equipo
		                WHERE ep.id_partido = p.id_partido
		                  AND ep.estado = 'Confirmado'
		                  AND ep.fecha_baja IS NULL
		                  AND ue.id_usuario = ?))`,
		idPartido, idUsuario, idUsuario, idUsuario).Scan(&n)
	return n > 0, err
}

func escanearMensaje(q rower, idPartido, idMensaje int64, mio int64) (mensajeJSON, error) {
	var m mensajeJSON
	var idAutor int64
	var nombre, apellido, foto string
	var org, cap int
	err := q.QueryRow(sqlMensajes+" AND m.id_mensaje = ?", idPartido, idMensaje).
		Scan(&m.ID, &m.Texto, &m.Creado, &idAutor, &nombre, &apellido, &foto, &org, &cap)
	if err != nil {
		return mensajeJSON{}, err
	}
	m.Autor = map[string]any{
		"id":       idAutor,
		"nombre":   capitalizar(nombre),
		"apellido": capitalizar(apellido),
		"foto":     foto,
	}
	m.Organizador = org > 0
	m.Capitan = cap > 0
	m.Mio = idAutor == mio
	return m, nil
}

// GET /api/partidos/{id}/mensajes?desde=
// `desde` es el último id que ya tiene el front: le mando solo lo
// nuevo. Sin `desde` devuelve las últimas 50.
func (s *Server) listarMensajes(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return
	}
	puede, err := s.puedeChatear(id, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if !puede {
		Error(w, http.StatusForbidden, "Solo los jugadores de este partido pueden ver el chat.")
		return
	}

	desde, _ := strconv.ParseInt(r.URL.Query().Get("desde"), 10, 64)

	var filas *sql.Rows
	if desde > 0 {
		filas, err = s.DB.Query(sqlMensajes+" AND m.id_mensaje > ? ORDER BY m.id_mensaje LIMIT 200",
			id, desde)
	} else {
		filas, err = s.DB.Query(sqlMensajes+" ORDER BY m.id_mensaje DESC LIMIT 50", id)
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	mensajes := []mensajeJSON{}
	for filas.Next() {
		var m mensajeJSON
		var idAutor int64
		var nombre, apellido, foto string
		var org, cap int
		if err := filas.Scan(&m.ID, &m.Texto, &m.Creado, &idAutor, &nombre, &apellido, &foto, &org, &cap); err != nil {
			respondeErrJSON(w, err)
			return
		}
		m.Autor = map[string]any{
			"id":       idAutor,
			"nombre":   capitalizar(nombre),
			"apellido": capitalizar(apellido),
			"foto":     foto,
		}
		m.Organizador = org > 0
		m.Capitan = cap > 0
		m.Mio = idAutor == claims.Sub
		mensajes = append(mensajes, m)
	}
	if desde == 0 {
		// Las pedí del final: las doy vuelta para que queden en orden
		for i, j := 0, len(mensajes)-1; i < j; i, j = i+1, j-1 {
			mensajes[i], mensajes[j] = mensajes[j], mensajes[i]
		}
	}

	ultimo := desde
	if n := len(mensajes); n > 0 && mensajes[n-1].ID > ultimo {
		ultimo = mensajes[n-1].ID
	}
	JSON(w, http.StatusOK, map[string]any{"mensajes": mensajes, "ultimo": ultimo})
}

type mensajeReq struct {
	Texto string `json:"texto"`
}

// POST /api/partidos/{id}/mensajes
func (s *Server) enviarMensaje(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return
	}
	puede, err := s.puedeChatear(id, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if !puede {
		Error(w, http.StatusForbidden, "Solo los jugadores de este partido pueden escribir en el chat.")
		return
	}

	var req mensajeReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá el mensaje enviado.")
		return
	}
	texto := strings.TrimSpace(req.Texto)
	if texto == "" {
		Error(w, http.StatusBadRequest, "Escribí un mensaje.")
		return
	}
	if len([]rune(texto)) > 500 {
		Error(w, http.StatusBadRequest, "El mensaje puede tener hasta 500 caracteres.")
		return
	}

	res, err := s.DB.Exec("INSERT INTO MENSAJE_PARTIDO (id_partido, id_usuario, texto) VALUES (?, ?, ?)",
		id, claims.Sub, texto)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	idMensaje, _ := res.LastInsertId()

	m, err := escanearMensaje(s.DB, id, idMensaje, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusCreated, m)
}
