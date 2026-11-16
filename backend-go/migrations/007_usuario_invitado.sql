-- =========================================================
-- 007_usuario_invitado.sql
-- Marca a los usuarios que se sumaron por link de invitación,
-- sin cuenta ni contraseña (no pueden iniciar sesión).
-- Se los muestra con la etiqueta "Invitado" y no aparecen en el
-- buscador de jugadores.
-- =========================================================

ALTER TABLE USUARIO ADD COLUMN es_invitado TINYINT(1) NOT NULL DEFAULT 0;
