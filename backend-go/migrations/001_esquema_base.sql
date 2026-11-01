-- =========================================================
-- 001_esquema_base.sql
-- Esquema base que definió el equipo (el que ya está en la BD
-- `Convocados`). Idempotente: si las tablas ya existen, no hace nada.
-- =========================================================

-- 1. Tabla USUARIO
CREATE TABLE IF NOT EXISTS USUARIO (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    telefono VARCHAR(50),
    posicion VARCHAR(50),
    promedio_calificacion DECIMAL(3, 2) DEFAULT 0.00
);

-- 2. Tabla EQUIPO
CREATE TABLE IF NOT EXISTS EQUIPO (
    id_equipo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
);

-- 3. Tabla intermedia USUARIO_EQUIPO
CREATE TABLE IF NOT EXISTS USUARIO_EQUIPO (
    id_usuario_equipo INT AUTO_INCREMENT PRIMARY KEY,
    id_usuario INT NOT NULL,
    id_equipo INT NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario) ON DELETE CASCADE,
    FOREIGN KEY (id_equipo) REFERENCES EQUIPO(id_equipo) ON DELETE CASCADE
);

-- 4. Tabla CANCHA
CREATE TABLE IF NOT EXISTS CANCHA (
    id_cancha INT AUTO_INCREMENT PRIMARY KEY,
    numero_cancha INT,
    nombre VARCHAR(100),
    direccion VARCHAR(255),
    tipo_cancha VARCHAR(50),
    tipo_suelo VARCHAR(50)
);

-- 5. Tabla COMPLEJO
CREATE TABLE IF NOT EXISTS COMPLEJO (
    id_complejo INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    direccion VARCHAR(255) NOT NULL
);

-- 6. Tabla PARTIDO
CREATE TABLE IF NOT EXISTS PARTIDO (
    id_partido INT AUTO_INCREMENT PRIMARY KEY,
    id_complejo INT,
    fecha_hora DATETIME NOT NULL,
    cupo_total INT NOT NULL,
    jugadores_faltantes INT NOT NULL,
    estado VARCHAR(50) DEFAULT 'Publicado',
    descripcion TEXT,
    costo_total DECIMAL(10, 2) NULL,
    FOREIGN KEY (id_complejo) REFERENCES COMPLEJO(id_complejo) ON DELETE SET NULL
);

-- 7. Tabla EQUIPO_PARTIDO (Participación de equipos en partidos)
CREATE TABLE IF NOT EXISTS EQUIPO_PARTIDO (
    id_participacion INT AUTO_INCREMENT PRIMARY KEY,
    id_partido INT NOT NULL,
    id_equipo INT NOT NULL,
    estado VARCHAR(50) DEFAULT 'Pendiente',
    fecha_alta DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_baja DATETIME NULL,
    Chat TEXT,
    FOREIGN KEY (id_partido) REFERENCES PARTIDO(id_partido) ON DELETE CASCADE,
    FOREIGN KEY (id_equipo) REFERENCES EQUIPO(id_equipo) ON DELETE CASCADE
);
