-- 009: la ciudad del complejo deja de forzarse a 'CABA'.
--
-- Antes, cada complejo nuevo quedaba etiquetado como 'CABA' aunque
-- estuviera en otra provincia (por ejemplo Mendoza), y eso se veía en
-- la zona de los partidos. Ahora la ciudad se deriva de la localidad
-- del organizador o del reverse-geocode; si no hay dato, queda NULL.
--
-- (Los comentarios de línea los filtra el runner de migraciones.)

ALTER TABLE COMPLEJO ALTER COLUMN ciudad DROP DEFAULT;

-- Corrige los complejos mal etiquetados como 'CABA' cuyas coordenadas
-- caen dentro de la provincia de Mendoza (el caso reportado: El Picadito
-- y San Martín 61). Es idempotente: si ya están bien, no toca filas.
UPDATE COMPLEJO
   SET ciudad = 'Mendoza'
 WHERE ciudad = 'CABA'
   AND lat IS NOT NULL
   AND lng IS NOT NULL
   AND lat BETWEEN -37.8 AND -31.9
   AND lng BETWEEN -70.5 AND -66.4;
