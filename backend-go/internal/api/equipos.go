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
   Equipos
     GET    /api/equipos
     GET    /api/equipos/mis-equipos
     GET    /api/equipos/{id}
     POST   /api/equipos
     POST   /api/equipos/{id}/integrantes        (envía invitación)
     DELETE /api/equipos/{id}/integrantes/{usuario}
     GET    /api/equipos/{id}/invitaciones       (enviadas, pendientes)
     DELETE /api/equipos/{id}/invitaciones/{usuario}
     GET    /api/invitaciones                    (recibidas, pendientes)
     POST   /api/invitaciones/{equipo}/aceptar
     POST   /api/invitaciones/{equipo}/rechazar

   Sumar gente a un equipo no es a la fuerza: se le envía una
   invitación y el jugador la acepta o rechaza.

   Quien administra el equipo es solo su dueño (el rol 'Dueno',
   que nace con el que lo crea): invita, quitar integrantes,
   cancela invitaciones y maneja el link. Los demás integrantes
   ven el equipo y pueden irse, nada más.
   ========================================================= */

const (
	rolDueno   = "Dueno"
	rolMiembro = "Miembro"
)

// rolEnEquipo devuelve el rol del usuario en ese equipo
// ('Dueno', 'Miembro' o vacío si no es integrante).
func (s *Server) rolEnEquipo(idEquipo, idUsuario int64) string {
	var rol string
	err := s.DB.QueryRow(
		"SELECT rol FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		idEquipo, idUsuario).Scan(&rol)
	if err != nil {
		return ""
	}
	return rol
}

func (s *Server) soyDueno(idEquipo, idUsuario int64) bool {
	return s.rolEnEquipo(idEquipo, idUsuario) == rolDueno
}

type equipoJSON struct {
	ID          int64  `json:"id"`
	Nombre      string `json:"nombre"`
	Integrantes int    `json:"integrantes"`
	EsDueno     bool   `json:"esDueno"`
}

func (s *Server) equiposDelUsuario(idUsuario int64) ([]equipoJSON, error) {
	filas, err := s.DB.Query(`
		SELECT e.id_equipo, e.nombre,
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = e.id_equipo),
		       ue.rol
		  FROM EQUIPO e
		  JOIN USUARIO_EQUIPO ue ON ue.id_equipo = e.id_equipo
		 WHERE ue.id_usuario = ?
		 ORDER BY e.nombre`, idUsuario)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	lista := []equipoJSON{}
	for filas.Next() {
		var eq equipoJSON
		var rol string
		if err := filas.Scan(&eq.ID, &eq.Nombre, &eq.Integrantes, &rol); err != nil {
			return nil, err
		}
		eq.EsDueno = rol == rolDueno
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
		       COALESCE((SELECT rol FROM USUARIO_EQUIPO
		                  WHERE id_equipo = e.id_equipo AND id_usuario = ?), '')
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
		var rol string
		if err := filas.Scan(&eq.ID, &eq.Nombre, &eq.Integrantes, &rol); err != nil {
			respondeErrJSON(w, err)
			return
		}
		eq.EsDueno = rol == rolDueno
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
	// El que lo crea queda como dueño del equipo.
	if _, err := tx.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo, rol) VALUES (?, ?, ?)",
		claims.Sub, id, rolDueno); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusCreated, equipoJSON{ID: id, Nombre: req.Nombre, Integrantes: 1, EsDueno: true})
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
		SELECT u.id_usuario, u.nombre, u.apellido, COALESCE(u.foto, ''), u.es_invitado, ue.rol
		  FROM USUARIO_EQUIPO ue
		  JOIN USUARIO u ON u.id_usuario = ue.id_usuario
		 WHERE ue.id_equipo = ?
		 ORDER BY CASE WHEN ue.rol = ? THEN 0 ELSE 1 END, u.nombre`, id, rolDueno)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	integrantes := []map[string]any{}
	for filas.Next() {
		var idU int64
		var nombreU, apellido, foto string
		var esInvitado int
		var rol string
		if err := filas.Scan(&idU, &nombreU, &apellido, &foto, &esInvitado, &rol); err != nil {
			respondeErrJSON(w, err)
			return
		}
		integrantes = append(integrantes, map[string]any{
			"id": idU, "nombre": capitalizar(nombreU), "apellido": capitalizar(apellido),
			"foto": foto, "esInvitado": esInvitado > 0,
			"rol": rol, "esDueno": rol == rolDueno,
		})
	}

	claims := auth.ConClaims(r)
	soyIntegrante := s.soyIntegrante(id, claims.Sub)
	puedeAdministrar := soyIntegrante && s.soyDueno(id, claims.Sub)

	// Las invitaciones pendientes y el link son del dueño del equipo:
	// al resto de los integrantes no los interesan ni los competen.
	invitaciones := []invitacionJugador{}
	if puedeAdministrar {
		invitaciones, _ = s.invitacionesPendientes(id)
	}

	link, urlLink := "", ""
	if puedeAdministrar {
		link = s.linkDelEquipo(id)
		if link != "" {
			urlLink = s.urlDelLink(r, link)
		}
	}

	JSON(w, http.StatusOK, map[string]any{
		"id":               id,
		"nombre":           nombre,
		"esMio":            soyIntegrante,
		"puedeAdministrar": puedeAdministrar,
		"integrantes":      integrantes,
		"invitaciones":     invitaciones,
		"link":             link,
		"linkUrl":          urlLink,
	})
}

type integranteReq struct {
	IDUsuario int64 `json:"idUsuario"`
}

// POST /api/equipos/{id}/integrantes
// No suma a la fuerza: le envía una invitación al jugador. Él la
// acepta o rechaza desde su pantalla de Equipos.
func (s *Server) sumarIntegrante(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}
	var req integranteReq
	if err := decodificar(w, r, &req); err != nil || req.IDUsuario == 0 {
		Error(w, http.StatusBadRequest, "Indicá al jugador que querés invitar.")
		return
	}
	if req.IDUsuario == claims.Sub {
		Error(w, http.StatusBadRequest, "Ya formas parte de ese equipo.")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	// Solo el dueño del equipo invita gente.
	var rol string
	err = tx.QueryRow("SELECT rol FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		id, claims.Sub).Scan(&rol)
	if err == sql.ErrNoRows {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if rol != rolDueno {
		Error(w, http.StatusForbidden, "Solo el dueño del equipo puede invitar integrantes.")
		return
	}

	var existe int
	if err := tx.QueryRow("SELECT COUNT(*) FROM USUARIO WHERE id_usuario = ?", req.IDUsuario).
		Scan(&existe); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if existe == 0 {
		Error(w, http.StatusNotFound, "No encontramos a ese jugador.")
		return
	}

	var yaIntegrante int
	if err := tx.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		id, req.IDUsuario).Scan(&yaIntegrante); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if yaIntegrante > 0 {
		Error(w, http.StatusConflict, "Ese jugador ya está en el equipo.")
		return
	}

	// Hay una fila por equipo/jugador: si ya estaba pendiente, no se
	// manda dos veces; si se rechazó (o se fue del equipo), se reutiliza.
	var estado string
	err = tx.QueryRow(`SELECT estado FROM INVITACION_EQUIPO
	                   WHERE id_equipo = ? AND id_usuario = ? FOR UPDATE`,
		id, req.IDUsuario).Scan(&estado)
	switch {
	case err == nil && estado == "Pendiente":
		Error(w, http.StatusConflict, "Ya le enviaste una invitación a ese jugador.")
		return
	case err == nil:
		if _, err := tx.Exec(`UPDATE INVITACION_EQUIPO
		                       SET estado = 'Pendiente', id_invitador = ?, creado_en = NOW(), respondido_en = NULL
		                       WHERE id_equipo = ? AND id_usuario = ?`,
			claims.Sub, id, req.IDUsuario); err != nil {
			respondeErrJSON(w, err)
			return
		}
	case err == sql.ErrNoRows:
		if _, err := tx.Exec(`INSERT INTO INVITACION_EQUIPO (id_equipo, id_usuario, id_invitador)
		                       VALUES (?, ?, ?)`, id, req.IDUsuario, claims.Sub); err != nil {
			respondeErrJSON(w, err)
			return
		}
	default:
		respondeErrJSON(w, err)
		return
	}

	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"ok": "invitación enviada"})
}

/* ---------- Invitaciones ---------- */

// invitacionJugador es una invitación que hicimos hacia un jugador.
type invitacionJugador struct {
	ID       int64     `json:"id"`
	Nombre   string    `json:"nombre"`
	Apellido string    `json:"apellido"`
	Foto     string    `json:"foto"`
	Creado   time.Time `json:"creadoEn"`
}

// invitacionEquipo es la invitación de un equipo hacia mí.
type invitacionEquipo struct {
	IDEquipo          int64     `json:"idEquipo"`
	Equipo            string    `json:"equipo"`
	IDInvitador       int64     `json:"idInvitador"`
	NombreInvitador   string    `json:"nombreInvitador"`
	ApellidoInvitador string    `json:"apellidoInvitador"`
	FotoInvitador     string    `json:"fotoInvitador"`
	Creado            time.Time `json:"creadoEn"`
}

// invitacionesPendientes arma las invitaciones enviadas de un equipo.
func (s *Server) invitacionesPendientes(idEquipo int64) ([]invitacionJugador, error) {
	filas, err := s.DB.Query(`
		SELECT i.id_usuario, u.nombre, u.apellido, COALESCE(u.foto, ''), i.creado_en
		  FROM INVITACION_EQUIPO i
		  JOIN USUARIO u ON u.id_usuario = i.id_usuario
		 WHERE i.id_equipo = ? AND i.estado = 'Pendiente'
		 ORDER BY i.creado_en DESC`, idEquipo)
	if err != nil {
		return nil, err
	}
	defer filas.Close()

	lista := []invitacionJugador{}
	for filas.Next() {
		var inv invitacionJugador
		if err := filas.Scan(&inv.ID, &inv.Nombre, &inv.Apellido, &inv.Foto, &inv.Creado); err != nil {
			return nil, err
		}
		lista = append(lista, inv)
	}
	return lista, filas.Err()
}

// GET /api/equipos/{id}/invitaciones — las que mandó este equipo.
func (s *Server) invitacionesEquipo(w http.ResponseWriter, r *http.Request) {
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
	if !s.soyDueno(id, claims.Sub) {
		Error(w, http.StatusForbidden, "Solo el dueño del equipo puede ver las invitaciones enviadas.")
		return
	}

	lista, err := s.invitacionesPendientes(id)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, lista)
}

// DELETE /api/equipos/{id}/invitaciones/{usuario} — se arrepiente
// un integrante y saca la invitación antes de que el jugador responda.
func (s *Server) cancelarInvitacion(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	jugador, err := strconv.ParseInt(r.PathValue("usuario"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de jugador inválido.")
		return
	}

	if !s.soyIntegrante(id, claims.Sub) {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}
	if !s.soyDueno(id, claims.Sub) {
		Error(w, http.StatusForbidden, "Solo el dueño del equipo puede cancelar invitaciones.")
		return
	}

	res, err := s.DB.Exec(`DELETE FROM INVITACION_EQUIPO
	                        WHERE id_equipo = ? AND id_usuario = ? AND estado = 'Pendiente'`,
		id, jugador)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, "Esa invitación ya no está pendiente.")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "invitación cancelada"})
}

// GET /api/invitaciones — las que me llegaron y todavía no respondí.
func (s *Server) misInvitaciones(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)

	filas, err := s.DB.Query(`
		SELECT i.id_equipo, e.nombre, i.id_invitador,
		       u.nombre, u.apellido, COALESCE(u.foto, ''), i.creado_en
		  FROM INVITACION_EQUIPO i
		  JOIN EQUIPO e ON e.id_equipo = i.id_equipo
		  JOIN USUARIO u ON u.id_usuario = i.id_invitador
		 WHERE i.id_usuario = ? AND i.estado = 'Pendiente'
		 ORDER BY i.creado_en DESC`, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer filas.Close()

	lista := []invitacionEquipo{}
	for filas.Next() {
		var inv invitacionEquipo
		if err := filas.Scan(&inv.IDEquipo, &inv.Equipo, &inv.IDInvitador,
			&inv.NombreInvitador, &inv.ApellidoInvitador, &inv.FotoInvitador, &inv.Creado); err != nil {
			respondeErrJSON(w, err)
			return
		}
		lista = append(lista, inv)
	}
	JSON(w, http.StatusOK, lista)
}

// responderInvitacion pasa la invitación a aceptada o rechazada.
// El aceptar además lo suma al equipo (en la misma transacción).
func (s *Server) responderInvitacion(w http.ResponseWriter, r *http.Request, aceptar bool) {
	claims := auth.ConClaims(r)
	equipo, err := strconv.ParseInt(r.PathValue("equipo"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	// Bloquea la fila: dos respuestas simultáneas no pueden repetir
	// al jugador en el equipo.
	var estado string
	err = tx.QueryRow(`SELECT estado FROM INVITACION_EQUIPO
	                   WHERE id_equipo = ? AND id_usuario = ? FOR UPDATE`,
		equipo, claims.Sub).Scan(&estado)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "No tenés ninguna invitación para ese equipo.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if estado != "Pendiente" {
		Error(w, http.StatusConflict, "Esa invitación ya fue respondida.")
		return
	}

	if aceptar {
		var ya int
		if err := tx.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
			equipo, claims.Sub).Scan(&ya); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if ya == 0 {
			if _, err := tx.Exec("INSERT INTO USUARIO_EQUIPO (id_usuario, id_equipo) VALUES (?, ?)",
				claims.Sub, equipo); err != nil {
				respondeErrJSON(w, err)
				return
			}
		}
	}

	if _, err := tx.Exec(`UPDATE INVITACION_EQUIPO
	                       SET estado = ?, respondido_en = NOW()
	                       WHERE id_equipo = ? AND id_usuario = ?`,
		estadoRespuesta(aceptar), equipo, claims.Sub); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if aceptar {
		JSON(w, http.StatusOK, map[string]any{"ok": "te sumaste al equipo"})
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "invitación rechazada"})
}

func estadoRespuesta(aceptar bool) string {
	if aceptar {
		return "Aceptada"
	}
	return "Rechazada"
}

// POST /api/invitaciones/{equipo}/aceptar
func (s *Server) aceptarInvitacion(w http.ResponseWriter, r *http.Request) {
	s.responderInvitacion(w, r, true)
}

// POST /api/invitaciones/{equipo}/rechazar
func (s *Server) rechazarInvitacion(w http.ResponseWriter, r *http.Request) {
	s.responderInvitacion(w, r, false)
}

// DELETE /api/equipos/{id}/integrantes/{usuario}
// Cualquiera puede irse de un equipo; sacar a otro es exclusivo del
// dueño. Si el dueño se va, el cargo pasa al integrante más antiguo
// que quede (y si es el último, no se puede ir: el equipo quedaría
// sin nadie que lo administre).
func (s *Server) quitarIntegrante(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de equipo inválido.")
		return
	}
	quien, err := strconv.ParseInt(r.PathValue("usuario"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de jugador inválido.")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	// Bloquea ambas filas: dos acciones simultáneas no pueden dejar
	// al equipo con dos dueños o con ninguno.
	var rolYo, rolObjetivo string
	err = tx.QueryRow(`SELECT rol FROM USUARIO_EQUIPO
	                   WHERE id_equipo = ? AND id_usuario = ? FOR UPDATE`,
		id, claims.Sub).Scan(&rolYo)
	if err == sql.ErrNoRows {
		Error(w, http.StatusForbidden, "No formas parte de ese equipo.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	err = tx.QueryRow(`SELECT rol FROM USUARIO_EQUIPO
	                   WHERE id_equipo = ? AND id_usuario = ? FOR UPDATE`,
		id, quien).Scan(&rolObjetivo)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "Ese jugador no está en el equipo.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	irse := quien == claims.Sub
	if !irse && rolYo != rolDueno {
		Error(w, http.StatusForbidden, "Solo el dueño del equipo puede quitar integrantes.")
		return
	}

	// El dueño no se puede ir si no queda nadie a quien dejarle el cargo.
	soyDuenoQueSeVa := irse && rolObjetivo == rolDueno
	if soyDuenoQueSeVa {
		var quedan int
		if err := tx.QueryRow(
			"SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario <> ?",
			id, claims.Sub).Scan(&quedan); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if quedan == 0 {
			Error(w, http.StatusConflict,
				"Sos el único integrante y el dueño: sumá a alguien antes de irte.")
			return
		}
	}

	if _, err := tx.Exec("DELETE FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		id, quien); err != nil {
		respondeErrJSON(w, err)
		return
	}

	// El cargo de dueño queda en el integrante más antiguo.
	if soyDuenoQueSeVa {
		var heredero int64
		if err := tx.QueryRow(
			"SELECT id_usuario FROM USUARIO_EQUIPO WHERE id_equipo = ? ORDER BY id_usuario_equipo ASC LIMIT 1",
			id).Scan(&heredero); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if _, err := tx.Exec("UPDATE USUARIO_EQUIPO SET rol = ? WHERE id_equipo = ? AND id_usuario = ?",
			rolDueno, id, heredero); err != nil {
			respondeErrJSON(w, err)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if irse {
		JSON(w, http.StatusOK, map[string]any{"ok": "saliste del equipo"})
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "jugador quitado del equipo"})
}
