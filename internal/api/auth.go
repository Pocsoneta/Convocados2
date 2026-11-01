package api

import (
	"database/sql"
	"net/http"
	"regexp"
	"strings"
	"time"

	"convocados/internal/auth"
)

/* =========================================================
   Registro, login, logout y "quién soy".
   Rutas:
     POST /api/auth/registro
     POST /api/auth/login
     POST /api/auth/logout
     GET  /api/auth/me
   ========================================================= */

var reEmail = regexp.MustCompile(`^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`)

const minEdad = 16
const minPassword = 8

// usuario en BD (todos los campos que el front puede mostrar)
type usuario struct {
	ID           int64
	Nombre       string
	Apellido     string
	Email        string
	PasswordHash string
	Telefono     sql.NullString
	FechaNac     sql.NullTime
	Localidad    sql.NullString
	Posicion     sql.NullString
	Posiciones   sql.NullString
	Nivel        sql.NullString
	Foto         sql.NullString
	Promedio     float64
}

const colsUsuario = `id_usuario, nombre, apellido, email, password_hash,
       telefono, fecha_nacimiento, localidad, posicion, posiciones, nivel, foto,
       COALESCE(promedio_calificacion, 0)`

func escanearUsuario(sc interface{ Scan(...any) error }) (*usuario, error) {
	u := &usuario{}
	err := sc.Scan(&u.ID, &u.Nombre, &u.Apellido, &u.Email, &u.PasswordHash,
		&u.Telefono, &u.FechaNac, &u.Localidad, &u.Posicion, &u.Posiciones,
		&u.Nivel, &u.Foto, &u.Promedio)
	if err != nil {
		return nil, err
	}
	return u, nil
}

func (s *Server) buscarPorEmail(email string) (*usuario, error) {
	row := s.DB.QueryRow("SELECT "+colsUsuario+" FROM USUARIO WHERE email = ?", email)
	return escanearUsuario(row)
}

func (s *Server) buscarPorID(id int64) (*usuario, error) {
	row := s.DB.QueryRow("SELECT "+colsUsuario+" FROM USUARIO WHERE id_usuario = ?", id)
	return escanearUsuario(row)
}

/* ---------- Registro ---------- */

type registroReq struct {
	Nombre     string `json:"nombre"`
	Apellido   string `json:"apellido"`
	Email      string `json:"email"`
	Password   string `json:"password"`
	Nacimiento string `json:"nacimiento"`
}

func (s *Server) registrar(w http.ResponseWriter, r *http.Request) {
	var req registroReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}

	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Apellido = strings.TrimSpace(req.Apellido)
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	// Mismas reglas que aplica el front
	if len(req.Nombre) < 2 {
		Error(w, http.StatusBadRequest, "Ingresá tu nombre.")
		return
	}
	if len(req.Apellido) < 2 {
		Error(w, http.StatusBadRequest, "Ingresá tu apellido.")
		return
	}
	if !reEmail.MatchString(req.Email) {
		Error(w, http.StatusBadRequest, "Revisá el formato del email.")
		return
	}
	if len(req.Password) < minPassword {
		Error(w, http.StatusBadRequest, "Usá al menos 8 caracteres.")
		return
	}

	nacimiento, err := time.Parse("2006-01-02", req.Nacimiento)
	if err != nil {
		Error(w, http.StatusBadRequest, "Ingresá tu fecha de nacimiento.")
		return
	}
	edad := int(time.Since(nacimiento).Hours() / 24 / 365.25)
	if edad < 0 || edad > 100 {
		Error(w, http.StatusBadRequest, "Revisá la fecha ingresada.")
		return
	}
	if edad < minEdad {
		Error(w, http.StatusBadRequest, "Tenés que tener al menos 16 años.")
		return
	}

	// ¿Ya existe?
	if existente, _ := s.buscarPorEmail(req.Email); existente != nil {
		Error(w, http.StatusConflict, "Ya existe una cuenta con ese email. Probá iniciando sesión.")
		return
	}

	hash, err := auth.HashearPassword(req.Password)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	res, err := s.DB.Exec(
		`INSERT INTO USUARIO (nombre, apellido, email, password_hash, fecha_nacimiento)
		 VALUES (?, ?, ?, ?, ?)`,
		req.Nombre, req.Apellido, req.Email, hash, nacimiento.Format("2006-01-02"))
	if err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			Error(w, http.StatusConflict, "Ya existe una cuenta con ese email. Probá iniciando sesión.")
			return
		}
		respondeErrJSON(w, err)
		return
	}
	id, _ := res.LastInsertId()

	if err := auth.GuardarSesión(w, s.Cfg.JWTSecret, s.Cfg.JWTExpira, id, req.Email, req.Nombre); err != nil {
		respondeErrJSON(w, err)
		return
	}

	JSON(w, http.StatusCreated, map[string]any{
		"id":     id,
		"email":  req.Email,
		"nombre": capitalizar(req.Nombre),
	})
}

/* ---------- Login ---------- */

type loginReq struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	var req loginReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	req.Email = strings.ToLower(strings.TrimSpace(req.Email))

	u, err := s.buscarPorEmail(req.Email)
	if err == sql.ErrNoRows || u == nil {
		Error(w, http.StatusUnauthorized, "El email o la contraseña no son correctos.")
		return
	}
	if !auth.VerificarPassword(u.PasswordHash, req.Password) {
		Error(w, http.StatusUnauthorized, "El email o la contraseña no son correctos.")
		return
	}

	if err := auth.GuardarSesión(w, s.Cfg.JWTSecret, s.Cfg.JWTExpira, u.ID, u.Email, u.Nombre); err != nil {
		respondeErrJSON(w, err)
		return
	}

	JSON(w, http.StatusOK, map[string]any{
		"id":     u.ID,
		"email":  u.Email,
		"nombre": capitalizar(u.Nombre),
	})
}

/* ---------- Logout ---------- */

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	auth.BorrarSesión(w)
	JSON(w, http.StatusOK, map[string]string{"ok": "sesión cerrada"})
}

/* ---------- Yo ---------- */

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	if claims == nil {
		Error(w, http.StatusUnauthorized, "Sesión inválida o vencida.")
		return
	}
	u, err := s.buscarPorID(claims.Sub)
	if err == sql.ErrNoRows {
		Error(w, http.StatusUnauthorized, "La cuenta ya no existe.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, perfilJSON(u))
}

// perfilJSON arma la ficha que consume el sidebar y el perfil.
func perfilJSON(u *usuario) map[string]any {
	var nacimiento any
	if u.FechaNac.Valid {
		nacimiento = u.FechaNac.Time.Format("2006-01-02")
	}
	foto := any(nil)
	if u.Foto.Valid && u.Foto.String != "" {
		foto = u.Foto.String
	}
	return map[string]any{
		"id":         u.ID,
		"email":      u.Email,
		"nombre":     capitalizar(u.Nombre),
		"apellido":   capitalizar(u.Apellido),
		"localidad":  aString(u.Localidad),
		"foto":       foto,
		"posiciones": csvALista(aString(u.Posiciones)),
		"posicion":   aString(u.Posicion),
		"nivel":      aString(u.Nivel),
		"telefono":   aString(u.Telefono),
		"nacimiento": nacimiento,
		"promedio":   u.Promedio,
	}
}
