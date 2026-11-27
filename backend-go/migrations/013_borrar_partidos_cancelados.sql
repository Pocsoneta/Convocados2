-- 013: limpia los partidos cancelados que quedaron acumulados.
--
-- Desde ahora, cancelar un partido lo ELIMINA (ver cancelarPartido en
-- internal/api/administrar.go): ya no quedan partidos con estado
-- 'Cancelado' ni sus inscripciones y mensajes como residuo. Esta
-- migracion borra los que quedaron de antes para que el historial
-- arranque limpio.
--
-- Los hijos (USUARIO_PARTIDO, EQUIPO_PARTIDO, MENSAJE_PARTIDO) caen por
-- ON DELETE CASCADE. Los equipos de los usuarios y sus links de
-- invitacion no dependen del partido: no se tocan.
--
-- Idempotente: si no hay cancelados, no borra nada.

DELETE FROM PARTIDO WHERE estado = 'Cancelado';
