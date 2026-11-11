package api

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"log"
	"net/http"
	"strings"
	"time"

	"convocados/internal/auth"
)

/* =========================================================
   Recuperar la contraseña.
     POST /api/auth/recuperar     { email }
     POST /api/auth/restablecer   { token, password }

   La respuesta de "recuperar" es siempre la misma, exista o no
   el email, para no revelar qué cuentas hay.

   TODO: enviar el enlace por email. Mientras tanto el enlace se
   escribe en el log del servidor (solo para desarrollo).
   ========================================================= */

const vigenciaRecuperacion = time.Hour

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}

type recuperarReq struct {
	Email string `json:"email"`
}

// POST /api/auth/recuperar
func (s *Server) pedirRecuperacion(w http.ResponseWriter, r *http.Request) {
	const aviso = "Si el email está registrado, te enviamos un enlace para cambiar tu contraseña."

	var req recuperarReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	email := strings.ToLower(strings.TrimSpace(req.Email))
	if !reEmail.MatchString(email) {
		Error(w, http.StatusBadRequest, "Revisá el formato del email.")
		return
	}

	u, err := s.buscarPorEmail(email)
	if err != nil {
		JSON(w, http.StatusOK, map[string]string{"ok": aviso})
		return
	}

	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		respondeErrJSON(w, err)
		return
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	// Un solo enlace vigente por cuenta: los anteriores quedan usados.
	if _, err := s.DB.Exec(`UPDATE RECUPERACION_CLAVE SET usado_en = NOW()
	                         WHERE id_usuario = ? AND usado_en IS NULL`, u.ID); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if _, err := s.DB.Exec(`INSERT INTO RECUPERACION_CLAVE (id_usuario, token_hash, expira_en)
	                         VALUES (?, ?, ?)`,
		u.ID, hashToken(token), time.Now().Add(vigenciaRecuperacion)); err != nil {
		respondeErrJSON(w, err)
		return
	}

	enlace := "http://" + r.Host + "/recuperar.html?token=" + token
	log.Printf("recuperar contraseña para %s (válido 1 h): %s", email, enlace)

	JSON(w, http.StatusOK, map[string]string{"ok": aviso})
}

type restablecerReq struct {
	Token    string `json:"token"`
	Password string `json:"password"`
}

// POST /api/auth/restablecer
func (s *Server) restablecerClave(w http.ResponseWriter, r *http.Request) {
	var req restablecerReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	if len(req.Password) < minPassword {
		Error(w, http.StatusBadRequest, "Usá al menos 8 caracteres.")
		return
	}

	var idUsuario int64
	var vigente, disponible bool
	err := s.DB.QueryRow(`SELECT id_usuario, expira_en > NOW(), usado_en IS NULL
	                        FROM RECUPERACION_CLAVE WHERE token_hash = ?`,
		hashToken(strings.TrimSpace(req.Token))).Scan(&idUsuario, &vigente, &disponible)
	if err != nil || !vigente || !disponible {
		Error(w, http.StatusBadRequest, "El enlace no es válido o ya venció. Pedí uno nuevo.")
		return
	}

	hash, err := auth.HashearPassword(req.Password)
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

	if _, err := tx.Exec(`UPDATE USUARIO SET password_hash = ? WHERE id_usuario = ?`, hash, idUsuario); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if _, err := tx.Exec(`UPDATE RECUPERACION_CLAVE SET usado_en = NOW()
	                       WHERE id_usuario = ? AND usado_en IS NULL`, idUsuario); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}

	JSON(w, http.StatusOK, map[string]string{"ok": "Contraseña actualizada. Ya podés iniciar sesión."})
}
