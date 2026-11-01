package api

import (
	"net/http"
	"strings"

	"convocados/internal/auth"
)

/* =========================================================
   Perfil deportivo (paso 2 del registro) y datos de la cuenta.
     GET  /api/perfil
     PUT  /api/perfil   { localidad, posiciones[], nivel, foto }
     PUT  /api/cuenta    { nombre, apellido, telefono }
   ========================================================= */

type perfilReq struct {
	Localidad  string   `json:"localidad"`
	Posiciones []string `json:"posiciones"`
	Nivel      string   `json:"nivel"`
	Foto       *string  `json:"foto"`
}

func (s *Server) obtenerPerfil(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	u, err := s.buscarPorID(claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, perfilJSON(u))
}

func (s *Server) guardarPerfil(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)

	var req perfilReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}

	localidad := strings.TrimSpace(req.Localidad)
	if localidad == "" {
		Error(w, http.StatusBadRequest, "Ingresá tu barrio o localidad.")
		return
	}
	if len(localidad) < 3 {
		Error(w, http.StatusBadRequest, "Es muy corto.")
		return
	}
	posiciones := normalizarPosiciones(req.Posiciones)
	if posiciones == "" {
		Error(w, http.StatusBadRequest, "Elegí al menos una posición.")
		return
	}

	nivel := strings.TrimSpace(req.Nivel)
	if nivel == "" {
		nivel = "Amateur"
	}

	// La foto viene como data URL (base64); guardamos tal cual.
	var foto any
	if req.Foto != nil && strings.TrimSpace(*req.Foto) != "" {
		foto = *req.Foto
	}

	// La primera posición pasa a ser la "principal" (columna posicion)
	principal := strings.Split(posiciones, ",")[0]

	_, err := s.DB.Exec(
		`UPDATE USUARIO
		    SET localidad = ?, posiciones = ?, posicion = ?, nivel = ?, foto = ?
		  WHERE id_usuario = ?`,
		localidad, posiciones, principal, nivel, foto, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	u, err := s.buscarPorID(claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, perfilJSON(u))
}

/* ---------- Datos de la cuenta ---------- */

type cuentaReq struct {
	Nombre   string `json:"nombre"`
	Apellido string `json:"apellido"`
	Telefono string `json:"telefono"`
}

func (s *Server) guardarCuenta(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)

	var req cuentaReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}
	req.Nombre = strings.TrimSpace(req.Nombre)
	req.Apellido = strings.TrimSpace(req.Apellido)

	if len(req.Nombre) < 2 || len(req.Apellido) < 2 {
		Error(w, http.StatusBadRequest, "Nombre y apellido no pueden quedar vacíos.")
		return
	}

	if _, err := s.DB.Exec(
		`UPDATE USUARIO SET nombre = ?, apellido = ?, telefono = ? WHERE id_usuario = ?`,
		req.Nombre, req.Apellido, strings.TrimSpace(req.Telefono), claims.Sub); err != nil {
		respondeErrJSON(w, err)
		return
	}

	u, err := s.buscarPorID(claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, perfilJSON(u))
}
