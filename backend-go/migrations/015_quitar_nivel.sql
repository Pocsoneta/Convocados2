-- =========================================================
-- 015_quitar_nivel.sql
-- Se elimina el "nivel" del usuario (principiante/amateur/…) y el
-- "nivel" de los partidos: no se muestran en ningún lado y el
-- usuario pidió sacarlos. Las columnas se borran solo si existen
-- (así corre en MySQL y en MariaDB, y una segunda vez no rompe).
-- =========================================================

-- ---------- USUARIO: nivel del jugador ----------
SET @existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'USUARIO'
       AND COLUMN_NAME  = 'nivel');
SET @sql := IF(@existe > 0, 'ALTER TABLE USUARIO DROP COLUMN nivel', 'SELECT 1');
PREPARE quitar_nivel_usuario FROM @sql;
EXECUTE quitar_nivel_usuario;
DEALLOCATE PREPARE quitar_nivel_usuario;

-- ---------- PARTIDO: nivel del partido ----------
SET @existe := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME   = 'PARTIDO'
       AND COLUMN_NAME  = 'nivel');
SET @sql := IF(@existe > 0, 'ALTER TABLE PARTIDO DROP COLUMN nivel', 'SELECT 1');
PREPARE quitar_nivel_partido FROM @sql;
EXECUTE quitar_nivel_partido;
DEALLOCATE PREPARE quitar_nivel_partido;
