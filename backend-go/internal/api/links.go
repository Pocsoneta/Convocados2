package api

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"net/http"
	"strconv"
	"strings"

	"convocados/internal/auth"
)

/* =========================================================
   Link de invitación (gente sin cuenta)
     POST   /api/equipos/{id}/link      genera o regenera (miembros)
     DELETE /api/equipos/{id}/link      lo revoca (miembros)
     GET    /api/invitacion/{token}     público: qué equipo es
     POST   /api/invitacion/{token}     público: me sumo como invitado

   Quien entra por link queda como "invitado": tiene fila en
   USUARIO con es_invitado = 1, sin contraseña, así que no puede
   iniciar sesión. Ocupa cupo en los partidos como cualquier
   integrante, y no aparece en el buscador de jugadores.
   ========================================================= */

const cookieInvitado = "convocados_invitado"

type equipoLink struct {
	IDEquipo    int64  `json:"idEquipo"`
	Equipo      string `json:"equipo"`
	Integrantes int    `json:"integrantes"`
	Token       string `json:"token,omitempty"`
}

// urlDelLink arma la dirección completa del link para compartirla.
// Usa PUBLIC_URL si está seteada; si no, el host con el que entró quien
// pidió el link (así funciona desde la IP de la red, no solo localhost).
func (s *Server) urlDelLink(r *http.Request, token string) string {
	base := s.Cfg.PublicURL
	if base == "" {
		esquema := "http"
		if r.TLS != nil || r.Header.Get("X-Forwarded-Proto") == "https" {
			esquema = "https"
		}
		base = esquema + "://" + r.Host
	}
	return base + "/invitar.html?token=" + token
}

// tokenAleatorio deja 16 bytes en hexadecimal (32 caracteres).
func tokenAleatorio() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

func (s *Server) soyIntegrante(idEquipo, idUsuario int64) bool {
	var n int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		idEquipo, idUsuario).Scan(&n)
	return n > 0
}

// linkDelEquipo devuelve el link activo del equipo (vacío si no hay).
func (s *Server) linkDelEquipo(idEquipo int64) string {
	var token string
	err := s.DB.QueryRow("SELECT token FROM LINK_INVITACION WHERE id_equipo = ? AND activo = 1",
		idEquipo).Scan(&token)
	if err != nil {
		return ""
	}
	return token
}

// buscarLink deja en equipo los datos del link (público).
func (s *Server) buscarLink(token string) (equipoLink, bool, error) {
	var l equipoLink
	var activo int
	err := s.DB.QueryRow(`
		SELECT l.id_equipo, e.nombre, l.activo,
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO ue WHERE ue.id_equipo = e.id_equipo)
		  FROM LINK_INVITACION l
		  JOIN EQUIPO e ON e.id_equipo = l.id_equipo
		 WHERE l.token = ?`, token).Scan(&l.IDEquipo, &l.Equipo, &activo, &l.Integrantes)
	if err == sql.ErrNoRows {
		return equipoLink{}, false, nil
	}
	if err != nil {
		return equipoLink{}, false, err
	}
	if activo == 0 {
		return equipoLink{}, false, nil
	}
	l.Equipo = capitalizar(l.Equipo)
	return l, true, nil
}

// POST /api/equipos/{id}/link — genera (o regenera) el link del equipo.
func (s *Server) generarLink(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}
	if !s.soyIntegrante(id, claims.Sub) {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}

	token, err := tokenAleatorio()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	// Un link por equipo: si ya existía, se pisa con uno nuevo.
	if _, err := s.DB.Exec(`
		INSERT INTO LINK_INVITACION (id_equipo, token, activo, creado_en)
		VALUES (?, ?, 1, NOW())
		ON DUPLICATE KEY UPDATE token = VALUES(token), activo = 1, creado_en = NOW()`,
		id, token); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"token": token, "url": s.urlDelLink(r, token)})
}

// DELETE /api/equipos/{id}/link — el link deja de funcionar.
func (s *Server) revocarLink(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}
	if !s.soyIntegrante(id, claims.Sub) {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}

	res, err := s.DB.Exec("UPDATE LINK_INVITACION SET activo = 0 WHERE id_equipo = ? AND activo = 1", id)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, "Este equipo no tiene un link activo.")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "link desactivado"})
}

// GET /api/invitacion/{token} — público: qué equipo estoy por unirme.
func (s *Server) verLink(w http.ResponseWriter, r *http.Request) {
	l, ok, err := s.buscarLink(r.PathValue("token"))
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if !ok {
		Error(w, http.StatusNotFound, "Ese link no existe o ya no está activo.")
		return
	}
	JSON(w, http.StatusOK, l)
}

type unirseReq struct {
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
}

// invitadoDeCookie devuelve el id del invitado que se unió desde
// este navegador, si hay.
func invitadoDeCookie(r *http.Request) (int64, bool) {
	c, err := r.Cookie(cookieInvitado)
	if err != nil || c.Value == "" {
		return 0, false
	}
	id, err := strconv.ParseInt(c.Value, 10, 64)
	if err != nil || id <= 0 {
		return 0, false
	}
	return id, true
}

// POST /api/invitacion/{token} — público. Si hay sesión, se suma con
// esa cuenta; si no, crea un usuario "invitado" sin contraseña.
func (s *Server) unirsePorLink(w http.ResponseWriter, r *http.Request) {
	token := r.PathValue("token")
	l, ok, err := s.buscarLink(token)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if !ok {
		Error(w, http.StatusNotFound, "Ese link no existe o ya no está activo.")
		return
	}

	var req unirseReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Apellido = strings.TrimSpace(req.Apellido)
	if req.Nombre == "" {
		Error(w, http.StatusBadRequest, "Poné tu nombre para unirte al equipo.")
		return
	}

	// Con sesión: se suma con su propia cuenta (no crea invitado).
	if claims := auth.ConClaims(r); claims != nil {
		if s.soyIntegrante(l.IDEquipo, claims.Sub) {
			JSON(w, http.StatusOK, map[string]any{"ok": "ya formas parte del equipo", "equipo": l.Equipo})
			return
		}
		if _, err := s.DB.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo) VALUES (?, ?)",
			claims.Sub, l.IDEquipo); err != nil {
			respondeErrJSON(w, err)
			return
		}
		JSON(w, http.StatusOK, map[string]any{"ok": "te sumaste al equipo", "equipo": l.Equipo})
		return
	}

	// Sin sesión: reutiliza al invitado de este navegador si ya existe.
	if idPrevio, okCookie := invitadoDeCookie(r); okCookie {
		var invitado int
		s.DB.QueryRow("SELECT es_invitado FROM USUARIO WHERE id_usuario = ?", idPrevio).Scan(&invitado)
		if invitado == 1 {
			if s.soyIntegrante(l.IDEquipo, idPrevio) {
				JSON(w, http.StatusOK, map[string]any{"ok": "ya formas parte del equipo", "equipo": l.Equipo})
				return
			}
			if _, err := s.DB.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo) VALUES (?, ?)",
				idPrevio, l.IDEquipo); err != nil {
				respondeErrJSON(w, err)
				return
			}
			JSON(w, http.StatusOK, map[string]any{"ok": "te sumaste al equipo", "equipo": l.Equipo})
			return
		}
	}

	clave, err := tokenAleatorio()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	hash, err := auth.HashearPassword(clave)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	email, err := tokenAleatorio()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(`INSERT INTO USUARIO
	    (nombre, apellido, email, password_hash, es_invitado)
	    VALUES (?, ?, ?, ?, 1)`,
		req.Nombre, req.Apellido, "invitado."+email+"@invitados.convocados", hash)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	idInvitado, _ := res.LastInsertId()

	if _, err := tx.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo) VALUES (?, ?)",
		idInvitado, l.IDEquipo); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:     cookieInvitado,
		Value:    strconv.FormatInt(idInvitado, 10),
		Path:     "/api/invitacion",
		MaxAge:   60 * 60 * 24 * 30,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})
	JSON(w, http.StatusCreated, map[string]any{"ok": "te sumaste al equipo", "equipo": l.Equipo})
}
