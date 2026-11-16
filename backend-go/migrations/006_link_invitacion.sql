-- =========================================================
-- 006_link_invitacion.sql
-- Link de invitación a un equipo: cualquiera que lo abra (sin
-- cuenta) puede sumarse como "invitado".
--
-- Un link por equipo: se regenera (cambia el token) o se revoca
-- (activo = 0) desde la pantalla del equipo.
-- =========================================================

CREATE TABLE IF NOT EXISTS LINK_INVITACION (
    id_link INT AUTO_INCREMENT PRIMARY KEY,
    id_equipo INT NOT NULL UNIQUE,
    token CHAR(32) NOT NULL UNIQUE,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_equipo) REFERENCES EQUIPO(id_equipo) ON DELETE CASCADE
);
