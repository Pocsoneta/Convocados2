-- =========================================================
-- 004_recuperacion_clave.sql
-- Enlaces para recuperar la contraseña. Solo se guarda el hash
-- del token (nunca el token), con vencimiento y uso único.
-- =========================================================

CREATE TABLE IF NOT EXISTS RECUPERACION_CLAVE (
    id_recuperacion INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE,
    expira_en DATETIME NOT NULL,
    usado_en DATETIME NULL,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);
