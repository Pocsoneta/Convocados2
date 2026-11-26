package api

import (
	"database/sql"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"time"

	"convocados/internal/auth"
)

/* =========================================================
   Partidos: listado (Buscar / Inicio), detalle, alta e
   inscripciones (individual y por equipo).
   ========================================================= */

type partido struct {
	ID           int64
	Fecha        time.Time
	CupoTotal    int
	Faltantes    int
	Estado       string
	Descripcion  string
	Costo        sql.NullFloat64
	Modalidad    string
	Nivel        string
	IDComplejo   sql.NullInt64
	IDCancha     sql.NullInt64
	IDCreador    sql.NullInt64
	Complejo     string
	Direccion    string
	Barrio       string
	Ciudad       string
	Lat          float64
	Lng          float64
	Cancha       string
	NumeroCancha int
	Inscriptos   int
}

var colsPartido = `SELECT
	p.id_partido, p.fecha_hora, p.cupo_total, p.jugadores_faltantes, p.estado,
	COALESCE(p.descripcion, ''), p.costo_total, COALESCE(p.modalidad, ''), COALESCE(p.nivel, ''),
	p.id_complejo, p.id_cancha, p.id_usuario_creador,
	COALESCE(c.nombre, ''), COALESCE(c.direccion, ''), COALESCE(c.barrio, ''), COALESCE(c.ciudad, ''),
	COALESCE(c.lat, 0), COALESCE(c.lng, 0),
	COALESCE(ca.nombre, ''), COALESCE(ca.numero_cancha, 0),
	` + sqlInscriptos("p.id_partido", "p.id_usuario_creador") + ` AS inscriptos
	FROM PARTIDO p
	LEFT JOIN COMPLEJO c ON c.id_complejo = p.id_complejo
	LEFT JOIN CANCHA ca  ON ca.id_cancha  = p.id_cancha`

// sqlInscriptos arma la expresión que cuenta los lugares ocupados de un
// partido: los jugadores confirmados uno por uno más, por cada equipo
// inscripto **confirmado**, sus integrantes. Las solicitudes pendientes
// (de jugadores o de equipos) no ocupan lugar hasta que el organizador
// las acepta.
//
// Un equipo ocupa tantos cupos como integrantes tenga, con dos excepciones:
//   - el organizador del partido no ocupa cupo (él es quien busca jugadores);
//   - quien ya está confirmado de forma individual no cuenta dos veces.
//
// Los dos parámetros que recibe son el id del partido y su organizador.
func sqlInscriptos(idPartido, idCreador string) string {
	return `(SELECT COUNT(*) FROM USUARIO_PARTIDO up
	WHERE up.id_partido = ` + idPartido + ` AND up.fecha_baja IS NULL AND up.estado = 'Confirmado')
	+ COALESCE((
		SELECT SUM((SELECT COUNT(*) FROM USUARIO_EQUIPO ue
		     WHERE ue.id_equipo = ep.id_equipo
		       AND ue.id_usuario <> COALESCE(` + idCreador + `, -1)
		       AND NOT EXISTS (SELECT 1 FROM USUARIO_PARTIDO up2
		              WHERE up2.id_partido = ep.id_partido
		                AND up2.id_usuario = ue.id_usuario
		                AND up2.estado = 'Confirmado'
		                AND up2.fecha_baja IS NULL)))
		  FROM EQUIPO_PARTIDO ep
		 WHERE ep.id_partido = ` + idPartido + ` AND ep.fecha_baja IS NULL
		   AND ep.estado = 'Confirmado'), 0)`
}

// sqlOcupados cuenta los lugares ocupados de un partido dentro de una
// transacción. Recibe tres parámetros: id_partido, id_usuario_creador,
// id_partido (el mismo id, para los dos usos de la expresión).
var sqlOcupados = `SELECT ` + sqlInscriptos("?", "?")

// rower es lo que comparten *sql.DB y *sql.Tx para leer una fila.
type rower interface {
	QueryRow(query string, args ...any) *sql.Row
}

// cuposQueOcupaEquipo dice cuántos lugares ocupa un equipo en un partido:
// sus integrantes, sin contar al organizador del partido ni a los que ya
// están confirmados de forma individual. Tiene que dar lo mismo que la
// parte de equipo de sqlInscriptos.
func cuposQueOcupaEquipo(q rower, idPartido, idEquipo, idCreador int64) (int, error) {
	var n int
	err := q.QueryRow(`
		SELECT COUNT(*) FROM USUARIO_EQUIPO ue
		 WHERE ue.id_equipo = ?
		   AND ue.id_usuario <> ?
		   AND NOT EXISTS (SELECT 1 FROM USUARIO_PARTIDO up
		          WHERE up.id_partido = ? AND up.id_usuario = ue.id_usuario
		            AND up.estado = 'Confirmado' AND up.fecha_baja IS NULL)`,
		idEquipo, idCreador, idPartido).Scan(&n)
	return n, err
}

// equipoConfirmadoDe devuelve el nombre de un equipo confirmado en el
// partido del que el usuario es integrante. Ese usuario ya ocupa un lugar
// por el equipo, así que no necesita (ni puede tomar) un cupo individual.
func equipoConfirmadoDe(q rower, idPartido, idUsuario int64) (string, bool, error) {
	var nombre string
	err := q.QueryRow(`
		SELECT e.nombre
		  FROM EQUIPO_PARTIDO ep
		  JOIN EQUIPO e ON e.id_equipo = ep.id_equipo
		  JOIN USUARIO_EQUIPO ue ON ue.id_equipo = ep.id_equipo
		 WHERE ep.id_partido = ? AND ue.id_usuario = ?
		   AND ep.estado = 'Confirmado' AND ep.fecha_baja IS NULL
		 LIMIT 1`, idPartido, idUsuario).Scan(&nombre)
	if err == sql.ErrNoRows {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return capitalizar(nombre), true, nil
}

// aIDCreador devuelve el organizador para comparaciones, o -1 si el
// partido no tiene organizador guardado.
func aIDCreador(creador sql.NullInt64) int64 {
	if creador.Valid {
		return creador.Int64
	}
	return -1
}

func escanearPartido(sc interface{ Scan(...any) error }) (*partido, error) {
	p := &partido{}
	err := sc.Scan(&p.ID, &p.Fecha, &p.CupoTotal, &p.Faltantes, &p.Estado,
		&p.Descripcion, &p.Costo, &p.Modalidad, &p.Nivel,
		&p.IDComplejo, &p.IDCancha, &p.IDCreador,
		&p.Complejo, &p.Direccion, &p.Barrio, &p.Ciudad, &p.Lat, &p.Lng,
		&p.Cancha, &p.NumeroCancha, &p.Inscriptos)
	if err != nil {
		return nil, err
	}
	return p, nil
}

func (p *partido) Disponibles() int {
	d := p.CupoTotal - p.Inscriptos
	if d < 0 {
		return 0
	}
	return d
}

func (p *partido) Zona() string { return zonaTexto(p.Barrio, p.Ciudad) }

func (p *partido) Nombre() string {
	if strings.TrimSpace(p.Complejo) != "" {
		return p.Complejo
	}
	return "Partido"
}

// FechaISO replica el formato que usa el front en el demo:
// "2026-11-02T21:00:00" (hora local, sin zona).
func (p *partido) FechaISO() string { return p.Fecha.Format("2006-01-02T15:04:05") }

/* ---------- Listado ---------- */

type partidoJSON struct {
	ID            int64    `json:"id"`
	Nombre        string   `json:"nombre"`
	Modalidad     string   `json:"modalidad"`
	Zona          string   `json:"zona"`
	ZonasCercanas []string `json:"zonasCercanas"`
	DistanciaKm   float64  `json:"distanciaKm"`
	Fecha         string   `json:"fecha"`
	Cupos         int      `json:"cupos"`
	Lat           float64  `json:"lat"`
	Lng           float64  `json:"lng"`
	// SinUbicacion avisa que el complejo no tiene coordenadas (nunca
	// se geolocalizó). El front evita mostrar una distancia falsa y
	// no lo dibuja en el mapa.
	SinUbicacion  bool     `json:"sinUbicacion"`
	Nivel         string   `json:"nivel"`
	Inscripciones int      `json:"inscripciones"`
	CupoTotal     int      `json:"cupoTotal"`
	Estado        string   `json:"estado"`
	Direccion     string   `json:"direccion"`
	Descripcion   string   `json:"descripcion"`
	CostoTotal    *float64 `json:"costoTotal"`
	IDComplejo    *int64   `json:"idComplejo,omitempty"`
	IDCancha      *int64   `json:"idCancha,omitempty"`
	Cancha        string   `json:"cancha,omitempty"`
}

func (p *partido) aJSON(complejos map[int64]complejoGeo, latOrigen, lngOrigen float64) partidoJSON {
	conUbicacion := tieneUbicacion(p.Lat, p.Lng)
	distancia := 0.0
	if conUbicacion {
		distancia = km1(distKm(latOrigen, lngOrigen, p.Lat, p.Lng))
	}
	item := partidoJSON{
		ID:            p.ID,
		Nombre:        p.Nombre(),
		Modalidad:     p.Modalidad,
		Zona:          p.Zona(),
		ZonasCercanas: []string{},
		DistanciaKm:   distancia,
		Fecha:         p.FechaISO(),
		Cupos:         p.Disponibles(),
		Lat:           p.Lat,
		Lng:           p.Lng,
		SinUbicacion:  !conUbicacion,
		Nivel:         p.Nivel,
		Inscripciones: p.Inscriptos,
		CupoTotal:     p.CupoTotal,
		Estado:        p.Estado,
		Direccion:     p.Direccion,
		Descripcion:   p.Descripcion,
		Cancha:        p.Cancha,
	}
	if p.Costo.Valid {
		c := p.Costo.Float64
		item.CostoTotal = &c
	}
	if p.IDComplejo.Valid {
		id := p.IDComplejo.Int64
		item.IDComplejo = &id
		if c, ok := complejos[id]; ok {
			item.ZonasCercanas = zonasCercanas(complejos, c)
		}
	}
	if p.IDCancha.Valid {
		id := p.IDCancha.Int64
		item.IDCancha = &id
	}
	return item
}

// filtros del query string de GET /api/partidos
type filtros struct {
	Q              string
	Zona           string
	Modalidad      string
	Nivel          string
	Desde          string
	Hasta          string
	Estado         string
	Orden          string
	Lat            float64
	Lng            float64
	Limit          int
	IncluirPasados bool
}

func leerFiltros(r *http.Request) filtros {
	q := r.URL.Query()
	f := filtros{
		Q:              strings.TrimSpace(q.Get("q")),
		Zona:           strings.TrimSpace(q.Get("zona")),
		Modalidad:      strings.TrimSpace(q.Get("modalidad")),
		Nivel:          strings.TrimSpace(q.Get("nivel")),
		Desde:          strings.TrimSpace(q.Get("desde")),
		Hasta:          strings.TrimSpace(q.Get("hasta")),
		Estado:         strings.TrimSpace(q.Get("estado")),
		Orden:          strings.TrimSpace(q.Get("orden")),
		Lat:            porDefectoFloat(q.Get("lat"), LatPorDefecto),
		Lng:            porDefectoFloat(q.Get("lng"), LngPorDefecto),
		IncluirPasados: q.Get("pasados") == "1" || q.Get("pasados") == "true",
	}
	f.Limit, _ = strconv.Atoi(q.Get("limit"))
	if f.Estado == "" {
		f.Estado = "Publicado"
	}
	return f
}

func porDefectoFloat(valor string, porDefecto float64) float64 {
	if strings.TrimSpace(valor) == "" {
		return porDefecto
	}
	v, err := strconv.ParseFloat(valor, 64)
	if err != nil {
		return porDefecto
	}
	return v
}

func (f filtros) where() (string, []any) {
	cond := []string{"p.estado = ?"}
	args := []any{f.Estado}

	if !f.IncluirPasados {
		cond = append(cond, "p.fecha_hora >= NOW()")
	}
	if f.Q != "" {
		cond = append(cond, "(c.nombre LIKE ? OR c.direccion LIKE ? OR p.descripcion LIKE ?)")
		like := "%" + f.Q + "%"
		args = append(args, like, like, like)
	}
	if f.Zona != "" {
		cond = append(cond, "(c.barrio LIKE ? OR c.direccion LIKE ?)")
		like := "%" + f.Zona + "%"
		args = append(args, like, like)
	}
	if f.Modalidad != "" {
		cond = append(cond, "p.modalidad = ?")
		args = append(args, f.Modalidad)
	}
	if f.Nivel != "" {
		cond = append(cond, "p.nivel = ?")
		args = append(args, f.Nivel)
	}
	if f.Desde != "" {
		cond = append(cond, "p.fecha_hora >= ?")
		args = append(args, f.Desde)
	}
	if f.Hasta != "" {
		cond = append(cond, "p.fecha_hora <= ?")
		args = append(args, f.Hasta)
	}
	return strings.Join(cond, " AND "), args
}

func (s *Server) consultarPartidos(f filtros) ([]partido, map[int64]complejoGeo, error) {
	complejos, err := cargarComplejos(s.DB)
	if err != nil {
		return nil, nil, err
	}

	cond, args := f.where()
	query := colsPartido + " WHERE " + cond + " ORDER BY p.fecha_hora ASC"
	if f.Limit > 0 {
		query += " LIMIT " + strconv.Itoa(f.Limit)
	}

	filas, err := s.DB.Query(query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer filas.Close()

	lista := []partido{}
	for filas.Next() {
		p, err := escanearPartido(filas)
		if err != nil {
			return nil, nil, err
		}
		lista = append(lista, *p)
	}
	if err := filas.Err(); err != nil {
		return nil, nil, err
	}

	if f.Orden == "distancia" {
		sort.SliceStable(lista, func(i, j int) bool {
			di := distKm(f.Lat, f.Lng, lista[i].Lat, lista[i].Lng)
			dj := distKm(f.Lat, f.Lng, lista[j].Lat, lista[j].Lng)
			return di < dj
		})
	}
	return lista, complejos, nil
}

// GET /api/partidos
func (s *Server) listarPartidos(w http.ResponseWriter, r *http.Request) {
	f := leerFiltros(r)
	lista, complejos, err := s.consultarPartidos(f)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	salida := make([]partidoJSON, 0, len(lista))
	for i := range lista {
		salida = append(salida, lista[i].aJSON(complejos, f.Lat, f.Lng))
	}
	JSON(w, http.StatusOK, salida)
}

/* ---------- Detalle ---------- */

type participante struct {
	Tipo        string `json:"tipo"` // "usuario" | "equipo"
	ID          int64  `json:"id"`
	Nombre      string `json:"nombre"`
	Apellido    string `json:"apellido"`
	Foto        string `json:"foto"`
	Estado      string `json:"estado"`
	Integrantes int    `json:"integrantes"` // solo equipos: cuántos ocupa
}

// GET /api/partidos/{id}
func (s *Server) detallePartido(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return
	}

	row := s.DB.QueryRow(colsPartido+" WHERE p.id_partido = ?", id)
	p, err := escanearPartido(row)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "No encontramos ese partido.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}

	complejos, _ := cargarComplejos(s.DB)
	claims := auth.ConClaims(r)

	latOrigen := porDefectoFloat(r.URL.Query().Get("lat"), LatPorDefecto)
	lngOrigen := porDefectoFloat(r.URL.Query().Get("lng"), LngPorDefecto)

	var costo any
	if p.Costo.Valid {
		costo = p.Costo.Float64
	}

	// ¿Qué estado tengo en este partido? ("" | "pendiente" | "confirmado")
	miEstado := ""
	esOrganizador := claims != nil && p.IDCreador.Valid && p.IDCreador.Int64 == claims.Sub
	if claims != nil {
		var estado string
		err := s.DB.QueryRow(`SELECT estado FROM USUARIO_PARTIDO
		                       WHERE id_partido = ? AND id_usuario = ? AND fecha_baja IS NULL`,
			id, claims.Sub).Scan(&estado)
		if err == nil {
			miEstado = strings.ToLower(estado)
		}
	}

	// ¿Y mi equipo? Solo si no tengo inscripción individual: si alguno
	// de mis equipos está anotado en el partido, esa es mi situación.
	miEquipo := map[string]any(nil)
	if claims != nil && miEstado == "" {
		var idEq int64
		var nombreEq, estadoEq string
		err := s.DB.QueryRow(`
			SELECT ep.id_equipo, e.nombre, ep.estado
			  FROM EQUIPO_PARTIDO ep
			  JOIN EQUIPO e ON e.id_equipo = ep.id_equipo
			  JOIN USUARIO_EQUIPO ue ON ue.id_equipo = ep.id_equipo
			 WHERE ep.id_partido = ? AND ue.id_usuario = ? AND ep.fecha_baja IS NULL
			 ORDER BY ep.estado = 'Confirmado' DESC
			 LIMIT 1`, id, claims.Sub).Scan(&idEq, &nombreEq, &estadoEq)
		if err == nil {
			miEstado = strings.ToLower(estadoEq)
			miEquipo = map[string]any{
				"id": idEq, "nombre": nombreEq, "estado": miEstado,
			}
		}
	}

	// En el detalle solo se muestran los que ya tienen lugar confirmado
	// (las solicitudes pendientes las ve el organizador).
	participantes := []participante{}
	for _, q := range s.listarParticipantes(id) {
		if q.Estado == "Confirmado" {
			participantes = append(participantes, q)
		}
	}

	JSON(w, http.StatusOK, map[string]any{
		"partido":            p.aJSON(complejos, latOrigen, lngOrigen),
		"descripcion":        p.Descripcion,
		"costoTotal":         costo,
		"jugadoresFaltantes": p.Faltantes,
		"cancha":             p.Cancha,
		"numeroCancha":       p.NumeroCancha,
		"creador":            s.usuarioPublico(p.IDCreador),
		"participantes":      participantes,
		"miInscripcion":      miEstado != "",
		"miEstado":           miEstado,
		"miEquipo":           miEquipo,
		"esOrganizador":      esOrganizador,
		"puedeInscribirse": miEstado == "" && !esOrganizador && p.Estado == "Publicado" &&
			p.Disponibles() > 0 && p.Fecha.After(time.Now()),
	})
}

func (s *Server) listarParticipantes(idPartido int64) []participante {
	filas, err := s.DB.Query(`
		SELECT 'usuario' AS tipo, up.id_usuario AS id, u.nombre, u.apellido,
		       COALESCE(u.foto, '') AS foto, up.estado, 0 AS integrantes
		  FROM USUARIO_PARTIDO up
		  JOIN USUARIO u ON u.id_usuario = up.id_usuario
		 WHERE up.id_partido = ? AND up.fecha_baja IS NULL AND up.estado = 'Confirmado'
		UNION ALL
		SELECT 'equipo', ep.id_equipo, e.nombre, '', '', ep.estado,
		       (SELECT COUNT(*) FROM USUARIO_EQUIPO ue WHERE ue.id_equipo = e.id_equipo)
		  FROM EQUIPO_PARTIDO ep
		  JOIN EQUIPO e ON e.id_equipo = ep.id_equipo
		 WHERE ep.id_partido = ? AND ep.fecha_baja IS NULL`, idPartido, idPartido)
	if err != nil {
		return []participante{}
	}
	defer filas.Close()

	lista := []participante{}
	for filas.Next() {
		var p participante
		if err := filas.Scan(&p.Tipo, &p.ID, &p.Nombre, &p.Apellido, &p.Foto, &p.Estado, &p.Integrantes); err != nil {
			return []participante{}
		}
		lista = append(lista, p)
	}
	return lista
}

func (s *Server) usuarioPublico(id sql.NullInt64) map[string]any {
	if !id.Valid {
		return nil
	}
	u, err := s.buscarPorID(id.Int64)
	if err != nil {
		return nil
	}
	return map[string]any{
		"id":       u.ID,
		"nombre":   capitalizar(u.Nombre),
		"apellido": capitalizar(u.Apellido),
		"foto":     aString(u.Foto),
		"promedio": u.Promedio,
	}
}

/* ---------- Alta ---------- */

type partidoReq struct {
	IDComplejo         int64          `json:"idComplejo"`
	Complejo           *complejoNuevo `json:"complejo"`
	IDCancha           int64          `json:"idCancha"`
	FechaHora          string         `json:"fechaHora"`
	CupoTotal          int            `json:"cupoTotal"`
	JugadoresFaltantes int            `json:"jugadoresFaltantes"`
	Descripcion        string         `json:"descripcion"`
	CostoTotal         *float64       `json:"costoTotal"`
	Modalidad          string         `json:"modalidad"`
	Nivel              string         `json:"nivel"`
	// IDEquipo es opcional: el equipo con el que se publica el partido.
	// Se inscribe en EQUIPO_PARTIDO como confirmado.
	IDEquipo int64 `json:"idEquipo"`
}

// POST /api/partidos
func (s *Server) crearPartido(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)

	var req partidoReq
	if err := decodificar(w, r, &req); err != nil {
		Error(w, http.StatusBadRequest, "Revisá los datos enviados.")
		return
	}

	if req.IDComplejo == 0 && req.Complejo != nil {
		// La ciudad del complejo es la del organizador, así un partido
		// de Mendoza no queda guardado como si fuera de CABA.
		ciudad := ""
		if u, err := s.buscarPorID(claims.Sub); err == nil {
			ciudad = aString(u.Localidad)
		}
		id, err := s.resolverComplejo(r.Context(), req.Complejo, ciudad)
		if err != nil {
			respondeErrJSON(w, err)
			return
		}
		req.IDComplejo = id
	}
	if req.IDComplejo == 0 {
		Error(w, http.StatusBadRequest, "Elegí el complejo donde se juega.")
		return
	}
	fecha, err := time.ParseInLocation("2006-01-02T15:04", req.FechaHora, time.Local)
	if err != nil {
		fecha, err = time.ParseInLocation("2006-01-02T15:04:05", req.FechaHora, time.Local)
		if err != nil {
			Error(w, http.StatusBadRequest, "Revisá la fecha y hora del partido.")
			return
		}
	}
	if !fecha.After(time.Now()) {
		Error(w, http.StatusBadRequest, "La fecha tiene que ser futura.")
		return
	}
	if req.CupoTotal <= 0 || req.CupoTotal > 40 {
		Error(w, http.StatusBadRequest, "El cupo total tiene que estar entre 1 y 40.")
		return
	}
	if req.JugadoresFaltantes < 0 || req.JugadoresFaltantes > req.CupoTotal {
		Error(w, http.StatusBadRequest, "Los jugadores faltantes no pueden superar el cupo total.")
		return
	}

	var existe int
	if err := s.DB.QueryRow("SELECT COUNT(*) FROM COMPLEJO WHERE id_complejo = ?", req.IDComplejo).Scan(&existe); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if existe == 0 {
		Error(w, http.StatusNotFound, "No encontramos ese complejo.")
		return
	}
	if req.IDCancha != 0 {
		s.DB.QueryRow("SELECT COUNT(*) FROM CANCHA WHERE id_cancha = ? AND id_complejo = ?",
			req.IDCancha, req.IDComplejo).Scan(&existe)
		if existe == 0 {
			Error(w, http.StatusBadRequest, "Esa cancha no pertenece al complejo elegido.")
			return
		}
	}

	modalidad := strings.TrimSpace(req.Modalidad)
	if modalidad == "" {
		modalidad = "Fútbol 5"
	}
	nivel := strings.TrimSpace(req.Nivel)
	if nivel == "" {
		nivel = "Amateur"
	}

	var idCancha any
	if req.IDCancha != 0 {
		idCancha = req.IDCancha
	}
	var costo any
	if req.CostoTotal != nil {
		costo = *req.CostoTotal
	}

	// Equipo elegido: tiene que ser tuyo y tener que entrar en el cupo
	// (ocupa un lugar por integrante, sin contar al organizador).
	var ocupanEquipo int
	if req.IDEquipo != 0 {
		var miembro int
		if err := s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
			req.IDEquipo, claims.Sub).Scan(&miembro); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if miembro == 0 {
			Error(w, http.StatusForbidden, "Ese equipo no es tuyo.")
			return
		}
		if err := s.DB.QueryRow(`SELECT COUNT(*) FROM USUARIO_EQUIPO
		                          WHERE id_equipo = ? AND id_usuario <> ?`,
			req.IDEquipo, claims.Sub).Scan(&ocupanEquipo); err != nil {
			respondeErrJSON(w, err)
			return
		}
		if ocupanEquipo > req.CupoTotal {
			Error(w, http.StatusBadRequest,
				"Tu equipo ya supera los jugadores que buscás: subí el cupo o elegí otro equipo.")
			return
		}
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	res, err := tx.Exec(
		`INSERT INTO PARTIDO
		   (id_complejo, id_cancha, id_usuario_creador, fecha_hora, cupo_total,
		    jugadores_faltantes, estado, descripcion, costo_total, modalidad, nivel)
		 VALUES (?, ?, ?, ?, ?, ?, 'Publicado', ?, ?, ?, ?)`,
		req.IDComplejo, idCancha, claims.Sub, fecha.Format("2006-01-02 15:04:05"),
		req.CupoTotal, req.JugadoresFaltantes, strings.TrimSpace(req.Descripcion),
		costo, modalidad, nivel)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	id, _ := res.LastInsertId()

	if req.IDEquipo != 0 {
		if _, err := tx.Exec(`INSERT INTO EQUIPO_PARTIDO (id_partido, id_equipo, estado)
		                       VALUES (?, ?, 'Confirmado')`, id, req.IDEquipo); err != nil {
			respondeErrJSON(w, err)
			return
		}
	}

	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}

	w.Header().Set("Location", "/api/partidos/"+strconv.FormatInt(id, 10))
	JSON(w, http.StatusCreated, map[string]any{"id": id, "ok": "partido publicado"})
}

/* ---------- Inscripción individual ---------- */

// POST /api/partidos/{id}/inscripcion
func (s *Server) inscribirse(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return
	}

	row := s.DB.QueryRow(colsPartido+" WHERE p.id_partido = ?", id)
	p, err := escanearPartido(row)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "No encontramos ese partido.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if p.Fecha.Before(time.Now()) {
		Error(w, http.StatusBadRequest, "Ese partido ya se jugó.")
		return
	}
	if p.Estado != "Publicado" {
		Error(w, http.StatusConflict, "Ese partido ya no está disponible.")
		return
	}
	if p.IDCreador.Valid && p.IDCreador.Int64 == claims.Sub {
		Error(w, http.StatusConflict, "Sos el organizador de ese partido.")
		return
	}

	// Si ya tengo lugar por un equipo confirmado, no me anoto de nuevo
	// (y no importa si el partido está lleno: mi lugar ya está contado).
	if nombreEq, enEquipo, err := equipoConfirmadoDe(s.DB, id, claims.Sub); err != nil {
		respondeErrJSON(w, err)
		return
	} else if enEquipo {
		Error(w, http.StatusConflict,
			"Ya estás en ese partido: tu equipo "+nombreEq+" tiene confirmado tu lugar.")
		return
	}

	if p.Disponibles() <= 0 {
		Error(w, http.StatusConflict, "No quedan cupos libres para ese partido.")
		return
	}

	// ¿Ya tenía algo con este partido?
	var estado string
	var fechaBaja sql.NullTime
	err = s.DB.QueryRow(`SELECT estado, fecha_baja FROM USUARIO_PARTIDO
	                      WHERE id_partido = ? AND id_usuario = ?`, id, claims.Sub).Scan(&estado, &fechaBaja)
	if err == nil && !fechaBaja.Valid {
		if estado == "Pendiente" {
			Error(w, http.StatusConflict, "Ya enviaste una solicitud para ese partido.")
		} else {
			Error(w, http.StatusConflict, "Ya estás inscripto en ese partido.")
		}
		return
	}

	// Entra como solicitud: ocupa cupo recién cuando el organizador la acepta.
	if err == nil { // antes la habían dado de baja o rechazado: vuelve a pedirlo
		if _, err := s.DB.Exec(`UPDATE USUARIO_PARTIDO
		                          SET fecha_baja = NULL, estado = 'Pendiente', fecha_alta = NOW()
		                        WHERE id_partido = ? AND id_usuario = ?`, id, claims.Sub); err != nil {
			respondeErrJSON(w, err)
			return
		}
	} else {
		if _, err := s.DB.Exec(`INSERT INTO USUARIO_PARTIDO (id_partido, id_usuario, estado)
		                          VALUES (?, ?, 'Pendiente')`, id, claims.Sub); err != nil {
			respondeErrJSON(w, err)
			return
		}
	}

	JSON(w, http.StatusCreated, map[string]any{
		"ok": "solicitud enviada, el organizador la va a revisar", "id": id,
	})
}

// DELETE /api/partidos/{id}/inscripcion
func (s *Server) desinscribirse(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return
	}

	res, err := s.DB.Exec(`UPDATE USUARIO_PARTIDO SET fecha_baja = NOW()
	                        WHERE id_partido = ? AND id_usuario = ? AND fecha_baja IS NULL`,
		id, claims.Sub)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, "No figurás inscripto en ese partido.")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "te diste de baja del partido"})
}

/* ---------- Inscripción con equipo ---------- */

type equipoPartidoReq struct {
	IDEquipo int64 `json:"idEquipo"`
}

// POST /api/partidos/{id}/equipos
func (s *Server) sumarEquipo(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		Error(w, http.StatusBadRequest, "Identificador de partido inválido.")
		return
	}
	var req equipoPartidoReq
	if err := decodificar(w, r, &req); err != nil || req.IDEquipo == 0 {
		Error(w, http.StatusBadRequest, "Elegí el equipo con el que te sumás.")
		return
	}

	// El equipo tiene que ser del usuario
	var miembro int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		req.IDEquipo, claims.Sub).Scan(&miembro)
	if miembro == 0 {
		Error(w, http.StatusForbidden, "Ese equipo no es tuyo.")
		return
	}

	tx, err := s.DB.Begin()
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	defer tx.Rollback()

	// Bloquea el partido: dos equipos no pueden tomar el mismo último cupo.
	var estado string
	var cupo int
	var creador sql.NullInt64
	err = tx.QueryRow("SELECT estado, cupo_total, id_usuario_creador FROM PARTIDO WHERE id_partido = ? FOR UPDATE",
		id).Scan(&estado, &cupo, &creador)
	if err == sql.ErrNoRows {
		Error(w, http.StatusNotFound, "No encontramos ese partido.")
		return
	}
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if estado != "Publicado" {
		Error(w, http.StatusConflict, "Ese partido ya no está disponible.")
		return
	}

	var ocupados int
	if err := tx.QueryRow(sqlOcupados, id, creador, id).Scan(&ocupados); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if ocupados >= cupo {
		Error(w, http.StatusConflict, "No quedan cupos libres para ese partido.")
		return
	}

	// El equipo completo tiene que entrar en lo que queda
	ocupa, err := cuposQueOcupaEquipo(tx, id, req.IDEquipo, aIDCreador(creador))
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if ocupados+ocupa > cupo {
		Error(w, http.StatusConflict,
			"No entran todos los integrantes de tu equipo: quedan menos cupos que jugadores.")
		return
	}

	var ya int
	if err := tx.QueryRow(`SELECT COUNT(*) FROM EQUIPO_PARTIDO
	                        WHERE id_partido = ? AND id_equipo = ? AND fecha_baja IS NULL`,
		id, req.IDEquipo).Scan(&ya); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if ya > 0 {
		Error(w, http.StatusConflict, "Tu equipo ya está inscripto en ese partido.")
		return
	}

	if _, err := tx.Exec(`INSERT INTO EQUIPO_PARTIDO (id_partido, id_equipo, estado)
	                       VALUES (?, ?, 'Pendiente')`, id, req.IDEquipo); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusCreated, map[string]any{"ok": "equipo enviado, a la espera de confirmación"})
}

// DELETE /api/partidos/{id}/equipos/{equipo}
func (s *Server) bajarEquipo(w http.ResponseWriter, r *http.Request) {
	claims := auth.ConClaims(r)
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	equipo, _ := strconv.ParseInt(r.PathValue("equipo"), 10, 64)

	// Puede darse de baja cualquiera que integre el equipo, o sacarlo
	// el organizador del partido desde la administración.
	var miembro, organizador int
	s.DB.QueryRow("SELECT COUNT(*) FROM USUARIO_EQUIPO WHERE id_equipo = ? AND id_usuario = ?",
		equipo, claims.Sub).Scan(&miembro)
	s.DB.QueryRow("SELECT COUNT(*) FROM PARTIDO WHERE id_partido = ? AND id_usuario_creador = ?",
		id, claims.Sub).Scan(&organizador)
	if miembro == 0 && organizador == 0 {
		Error(w, http.StatusForbidden, "Ese equipo no es tuyo.")
		return
	}

	res, err := s.DB.Exec(`UPDATE EQUIPO_PARTIDO SET fecha_baja = NOW()
	                        WHERE id_partido = ? AND id_equipo = ? AND fecha_baja IS NULL`, id, equipo)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, "Tu equipo no estaba en ese partido.")
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "equipo dado de baja"})
}

// POST /api/partidos/{id}/equipos/{equipo}/aceptar
// El organizador confirma la solicitud de un equipo: recién ahí ocupa cupos.
func (s *Server) aceptarEquipo(w http.ResponseWriter, r *http.Request) {
	id, ok := s.partidoDelOrganizador(w, r)
	if !ok {
		return
	}
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

	// Bloquea el partido: dos aceptaciones seguidas no pueden pasarse del cupo.
	var estado string
	var cupo int
	var creador sql.NullInt64
	if err := tx.QueryRow("SELECT estado, cupo_total, id_usuario_creador FROM PARTIDO WHERE id_partido = ? FOR UPDATE",
		id).Scan(&estado, &cupo, &creador); err != nil {
		respondeErrJSON(w, err)
		return
	}
	if estado != "Publicado" {
		Error(w, http.StatusConflict, "Ese partido ya no está publicado.")
		return
	}

	var ocupados int
	if err := tx.QueryRow(sqlOcupados, id, creador, id).Scan(&ocupados); err != nil {
		respondeErrJSON(w, err)
		return
	}

	// El equipo completo tiene que entrar en lo que queda
	ocupa, err := cuposQueOcupaEquipo(tx, id, equipo, aIDCreador(creador))
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if ocupados+ocupa > cupo {
		Error(w, http.StatusConflict,
			"No entran todos los integrantes de ese equipo: quedan menos cupos que jugadores.")
		return
	}

	res, err := tx.Exec(`UPDATE EQUIPO_PARTIDO SET estado = 'Confirmado'
	                      WHERE id_partido = ? AND id_equipo = ? AND estado = 'Pendiente' AND fecha_baja IS NULL`,
		id, equipo)
	if err != nil {
		respondeErrJSON(w, err)
		return
	}
	if filas, _ := res.RowsAffected(); filas == 0 {
		Error(w, http.StatusNotFound, "Ese equipo no tiene una solicitud pendiente.")
		return
	}
	if err := tx.Commit(); err != nil {
		respondeErrJSON(w, err)
		return
	}
	JSON(w, http.StatusOK, map[string]any{"ok": "equipo aceptado"})
}
