-- =========================================================
-- 014_rol_equipo.sql
-- Rol dentro del equipo: hasta ahora cualquier integrante podía
-- quitar a cualquiera (incluso al creador). Se agrega la columna
-- `rol` y el que creó cada equipo (la fila más vieja) queda como
-- 'Dueno'. Solo el dueño administra: invitar, quitar integrantes,
-- cancelar invitaciones y manejar el link.
-- =========================================================

ALTER TABLE USUARIO_EQUIPO
    ADD COLUMN rol VARCHAR(20) NOT NULL DEFAULT 'Miembro' AFTER id_equipo;

-- Backfill: el integrante más antiguo de cada equipo pasa a dueño.
UPDATE USUARIO_EQUIPO ue
  JOIN (
        SELECT id_equipo, MIN(id_usuario_equipo) AS primera
          FROM USUARIO_EQUIPO
         GROUP BY id_equipo
       ) vieja ON vieja.id_equipo = ue.id_equipo
              AND vieja.primera = ue.id_usuario_equipo
   SET ue.rol = 'Dueno';
