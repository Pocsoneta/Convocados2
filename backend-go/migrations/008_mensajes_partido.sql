-- =========================================================
-- 008_mensajes_partido.sql
-- Chat del partido: lo pueden leer y escribir el organizador y
-- los jugadores confirmados (individualmente o por equipo).
--
-- El rango se calcula al leer (organizador = creador del partido;
-- capitán = integrante más antiguo de un equipo inscripto), así
-- que no hace falta guardarlo en cada mensaje.
-- =========================================================

CREATE TABLE IF NOT EXISTS MENSAJE_PARTIDO (
    id_mensaje INT AUTO_INCREMENT PRIMARY KEY,
    id_partido INT NOT NULL,
    id_usuario INT NOT NULL,
    texto VARCHAR(500) NOT NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_mensajes_partido (id_partido, id_mensaje),
    FOREIGN KEY (id_partido) REFERENCES PARTIDO(id_partido) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);
