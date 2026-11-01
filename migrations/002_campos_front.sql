-- =========================================================
-- 002_campos_front.sql
-- Campos que el front necesita y que no existían en el esquema base.
-- Se agregan columnas (nada se borra ni se modifica).
-- =========================================================

-- ---------- USUARIO: ficha del registro + perfil deportivo ----------
ALTER TABLE USUARIO
    ADD COLUMN fecha_nacimiento DATE NULL AFTER password_hash,
    ADD COLUMN localidad VARCHAR(100) NULL AFTER telefono,
    ADD COLUMN posiciones VARCHAR(100) NULL AFTER posicion,
    ADD COLUMN nivel VARCHAR(50) NULL AFTER posiciones,
    ADD COLUMN foto MEDIUMTEXT NULL AFTER nivel,
    ADD COLUMN creado_en DATETIME NULL DEFAULT CURRENT_TIMESTAMP;

-- ---------- COMPLEJO: geolocalización para "partidos cerca tuyo" ----------
ALTER TABLE COMPLEJO
    ADD COLUMN barrio VARCHAR(100) NULL AFTER direccion,
    ADD COLUMN ciudad VARCHAR(100) NULL DEFAULT 'CABA' AFTER barrio,
    ADD COLUMN lat DECIMAL(9, 6) NULL AFTER ciudad,
    ADD COLUMN lng DECIMAL(9, 6) NULL AFTER lat;

-- ---------- CANCHA: cada cancha pertenece a un complejo ----------
ALTER TABLE CANCHA
    ADD COLUMN id_complejo INT NULL AFTER id_cancha,
    ADD CONSTRAINT fk_cancha_complejo
        FOREIGN KEY (id_complejo) REFERENCES COMPLEJO(id_complejo) ON DELETE CASCADE;

-- ---------- PARTIDO: autor, cancha, modalidad y nivel ----------
ALTER TABLE PARTIDO
    ADD COLUMN id_usuario_creador INT NULL AFTER id_complejo,
    ADD COLUMN id_cancha INT NULL AFTER id_complejo,
    ADD COLUMN modalidad VARCHAR(30) NULL DEFAULT 'Fútbol 5' AFTER estado,
    ADD COLUMN nivel VARCHAR(50) NULL DEFAULT 'Amateur' AFTER modalidad,
    ADD COLUMN creado_en DATETIME NULL DEFAULT CURRENT_TIMESTAMP AFTER costo_total,
    ADD CONSTRAINT fk_partido_creador
        FOREIGN KEY (id_usuario_creador) REFERENCES USUARIO(id_usuario) ON DELETE SET NULL,
    ADD CONSTRAINT fk_partido_cancha
        FOREIGN KEY (id_cancha) REFERENCES CANCHA(id_cancha) ON DELETE SET NULL;

-- ---------- Inscripción individual ----------
-- El esquema base solo permitía sumar equipos (EQUIPO_PARTIDO).
-- El front también deja inscribirse "solo" desde Buscar / Detalle.
CREATE TABLE IF NOT EXISTS USUARIO_PARTIDO (
    id_inscripcion INT AUTO_INCREMENT PRIMARY KEY,
    id_partido INT NOT NULL,
    id_usuario INT NOT NULL,
    estado VARCHAR(50) NOT NULL DEFAULT 'Pendiente',
    fecha_alta DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    fecha_baja DATETIME NULL,
    UNIQUE KEY uq_usuario_partido (id_partido, id_usuario),
    FOREIGN KEY (id_partido) REFERENCES PARTIDO(id_partido) ON DELETE CASCADE,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE
);

-- Índices para las consultas frecuentes del front.
-- (MySQL no admite "CREATE INDEX IF NOT EXISTS", pero cada migración
--  corre una sola vez: queda registrada en schema_migrations.)
CREATE INDEX idx_partido_fecha ON PARTIDO (fecha_hora);
CREATE INDEX idx_usuario_partido_usuario ON USUARIO_PARTIDO (id_usuario);
