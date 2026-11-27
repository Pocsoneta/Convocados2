-- 012: elimina las ubicaciones de Buenos Aires (CABA/GBA) del catalogo.
--
-- Contexto: el seed demo (003) cargo complejos y canchas de CABA; los
-- partidos de ejemplo de ese seed ya no existen en la base (quedan 0
-- partidos sobre esas ubicaciones). Por decision del usuario se borran
-- TODAS las ubicaciones detectadas en CABA/GBA, no solo las del seed.
--
-- Criterio de deteccion:
--   ciudad = 'CABA' o 'Buenos Aires'
--   o coordenadas dentro del area metropolitana:
--     lat  BETWEEN -35.3 AND -34.2
--     lng  BETWEEN -59.8 AND -57.8
--
-- (Es el mismo esquema de coordenadas por rangos que usa 009 para
-- detectar Mendoza; los dos rangos no se superponen.)
--
-- Orden a prueba de FKs:
--   1) PARTIDO de esas ubicaciones (hoy no hay ninguno; queda para que
--      la migracion siga siendo correcta si alguno aparece). Los hijos
--      USUARIO_PARTIDO, EQUIPO_PARTIDO y MENSAJE_PARTIDO caen solos por
--      ON DELETE CASCADE.
--   2) CANCHA. El FK CANCHA.id_complejo es ON DELETE CASCADE, pero se
--      borra explicita para no depender del comportamiento del runner.
--   3) COMPLEJO. OJO: PARTIDO.id_complejo es ON DELETE SET NULL; por eso
--      el paso 1 borra los partidos ANTES de borrar los complejos, si no
--      quedarian partidos huerfanos sin complejo.
--
-- Los EQUIPOS de los usuarios no se tocan: son entidades propias y no
-- dependen de los complejos. Idempotente: borrar filas inexistentes no
-- es error y no modifica nada.

DELETE FROM PARTIDO
 WHERE id_complejo IN (
       SELECT id_complejo FROM COMPLEJO
        WHERE ciudad = 'CABA' OR ciudad LIKE '%Buenos%'
           OR (lat IS NOT NULL AND lng IS NOT NULL
               AND lat BETWEEN -35.3 AND -34.2
               AND lng BETWEEN -59.8 AND -57.8));

DELETE FROM PARTIDO
 WHERE id_cancha IN (
       SELECT cn.id_cancha FROM CANCHA cn
       JOIN COMPLEJO c ON c.id_complejo = cn.id_complejo
        WHERE c.ciudad = 'CABA' OR c.ciudad LIKE '%Buenos%'
           OR (c.lat IS NOT NULL AND c.lng IS NOT NULL
               AND c.lat BETWEEN -35.3 AND -34.2
               AND c.lng BETWEEN -59.8 AND -57.8));

DELETE FROM CANCHA
 WHERE id_complejo IN (
       SELECT id_complejo FROM COMPLEJO
        WHERE ciudad = 'CABA' OR ciudad LIKE '%Buenos%'
           OR (lat IS NOT NULL AND lng IS NOT NULL
               AND lat BETWEEN -35.3 AND -34.2
               AND lng BETWEEN -59.8 AND -57.8));

DELETE FROM COMPLEJO
 WHERE ciudad = 'CABA' OR ciudad LIKE '%Buenos%'
    OR (lat IS NOT NULL AND lng IS NOT NULL
        AND lat BETWEEN -35.3 AND -34.2
        AND lng BETWEEN -59.8 AND -57.8);
