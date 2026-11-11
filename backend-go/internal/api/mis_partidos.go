package api

import "strings"

/* =========================================================
   Situación del usuario en cada partido de "Mis partidos".
   Un partido puede ser organizado por el usuario o haber
   sido sumado por él (en forma individual o con su equipo).
   ========================================================= */

type misPartidoJSON struct {
	partidoJSON
	// "organizador" | "jugador"
	Rol string `json:"rol"`
	// solo para jugadores: "confirmado" | "pendiente" | "rechazado"
	Estado string `json:"estado"`
	// solo para organizadores: solicitudes que esperan respuesta
	SolicitudesPendientes int `json:"solicitudesPendientes"`
}

// miSituacion devuelve el rol del usuario en el partido, su estado como
// jugador y cuántas solicitudes tiene para revisar si organiza.
func (s *Server) miSituacion(p *partido, idUsuario int64) (rol, estado string, pendientes int) {
	if p.IDCreador.Valid && p.IDCreador.Int64 == idUsuario {
		s.DB.QueryRow(`SELECT COUNT(*) FROM USUARIO_PARTIDO
		                WHERE id_partido = ? AND estado = 'Pendiente' AND fecha_baja IS NULL`,
			p.ID).Scan(&pendientes)
		return "organizador", "", pendientes
	}

	var estadoUsuario string
	err := s.DB.QueryRow(`SELECT estado FROM USUARIO_PARTIDO
	                       WHERE id_partido = ? AND id_usuario = ? AND fecha_baja IS NULL`,
		p.ID, idUsuario).Scan(&estadoUsuario)
	if err == nil {
		return "jugador", estadoJugador(estadoUsuario), 0
	}

	var estadoEquipo string
	s.DB.QueryRow(`SELECT ep.estado FROM EQUIPO_PARTIDO ep
	                 JOIN USUARIO_EQUIPO ue ON ue.id_equipo = ep.id_equipo
	                WHERE ep.id_partido = ? AND ue.id_usuario = ? AND ep.fecha_baja IS NULL
	                LIMIT 1`, p.ID, idUsuario).Scan(&estadoEquipo)
	return "jugador", estadoJugador(estadoEquipo), 0
}

// estadoJugador traduce el estado de la base al que usa el front.
func estadoJugador(estadoBD string) string {
	switch strings.ToLower(estadoBD) {
	case "confirmado":
		return "confirmado"
	case "pendiente":
		return "pendiente"
	default:
		return "rechazado"
	}
}
