-- =========================================================
-- 005_invitaciones_equipo.sql
-- Invitaciones a un equipo. Antes cualquier integrante podía
-- sumar a un jugador a la fuerza; ahora se le envía una
-- solicitud que él acepta o rechaza desde su pantalla de Equipos.
--
-- Guardamos una fila por equipo/jugador (clave única): si se
-- rechaza y se vuelve a invitar, se reutiliza la misma fila.
-- =========================================================

CREATE TABLE IF NOT EXISTS INVITACION_EQUIPO (
    id_invitacion INT AUTO_INCREMENT PRIMARY KEY,
    id_equipo INT NOT NULL,
    id_usuario INT NOT NULL,          -- a quién invitan
    id_invitador INT NOT NULL,        -- quién envía la invitación
    estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente',
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    respondido_en DATETIME NULL,
    UNIQUE KEY uq_invitacion_equipo_usuario (id_equipo, id_usuario),
    KEY idx_invitaciones_usuario (id_usuario, estado),
    FOREIGN KEY (id_equipo) REFERENCES EQUIPO(id_equipo) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_invitador) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);
