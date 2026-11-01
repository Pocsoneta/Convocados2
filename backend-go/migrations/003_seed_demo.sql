-- =========================================================
-- 003_seed_demo.sql
-- Datos de ejemplo (barrios de CABA) para poder probar Buscar,
-- Inicio y Detalle sin cargar nada a mano.
-- Las coordenadas coinciden con las del front (partidos-demo.js).
-- Corre una sola vez.
-- =========================================================

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng) VALUES
  ('Palermo Arena Canchas', 'Costa Rica 5400',        'Palermo',     'CABA', -34.580600, -58.437200),
  ('El Templario Fútbol',   'Gorriti 5500',           'Palermo',     'CABA', -34.585700, -58.431100),
  ('Predio Palermo',        'Av. Santa Fe 4200',      'Palermo',     'CABA', -34.579000, -58.423500),
  ('Club Social Colegiales','Vuelta de Obligado 2800','Colegiales',  'CABA', -34.574500, -58.448800),
  ('Canchas de Villa Crespo','Av. Corrientes 6100',   'Villa Crespo','CABA', -34.598300, -58.441700),
  ('Predio Núñez',          'Rivadavia 13800',        'Núñez',       'CABA', -34.548800, -58.464700);

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', c.direccion, 'Fútbol 5', 'Césped sintético'
FROM COMPLEJO c WHERE c.nombre = 'Palermo Arena Canchas';

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 2, 'Cancha 2', c.direccion, 'Fútbol 7', 'Césped sintético'
FROM COMPLEJO c WHERE c.nombre = 'Palermo Arena Canchas';

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha principal', c.direccion, 'Fútbol 7', 'Césped sintético'
FROM COMPLEJO c WHERE c.nombre = 'El Templario Fútbol';

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', c.direccion, 'Fútbol 11', 'Césped sintético'
FROM COMPLEJO c WHERE c.nombre = 'Predio Palermo';

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', c.direccion, 'Fútbol 5', 'Parquet'
FROM COMPLEJO c WHERE c.nombre = 'Club Social Colegiales';

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', c.direccion, 'Fútbol 5', 'Césped sintético'
FROM COMPLEJO c WHERE c.nombre = 'Canchas de Villa Crespo';

INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', c.direccion, 'Fútbol 11', 'Césped sintético'
FROM COMPLEJO c WHERE c.nombre = 'Predio Núñez';

-- Partidos de ejemplo (estado 'Publicado', fechas relativas a hoy)
INSERT INTO PARTIDO
  (id_complejo, fecha_hora, cupo_total, jugadores_faltantes, estado, descripcion, costo_total, modalidad, nivel)
SELECT c.id_complejo, DATE_ADD(NOW(), INTERVAL 3 HOUR), 10, 3, 'Publicado',
       'Se necesita arquero y dos defensores. Nivel amateur, sin árbitro.',
       3500.00, 'Fútbol 5', 'Amateur'
FROM COMPLEJO c WHERE c.nombre = 'Palermo Arena Canchas';

INSERT INTO PARTIDO
  (id_complejo, fecha_hora, cupo_total, jugadores_faltantes, estado, descripcion, costo_total, modalidad, nivel)
SELECT c.id_complejo, DATE_ADD(NOW(), INTERVAL 26 HOUR), 14, 5, 'Publicado',
       'Partido amistoso, se agradece puntualidad.',
       4200.00, 'Fútbol 7', 'Intermedio'
FROM COMPLEJO c WHERE c.nombre = 'El Templario Fútbol';

INSERT INTO PARTIDO
  (id_complejo, fecha_hora, cupo_total, jugadores_faltantes, estado, descripcion, costo_total, modalidad, nivel)
SELECT c.id_complejo, DATE_ADD(NOW(), INTERVAL 3 DAY), 22, 8, 'Publicado',
       'Fútbol 11 completo, se juega cancha entera.',
       6000.00, 'Fútbol 11', 'Avanzado'
FROM COMPLEJO c WHERE c.nombre = 'Predio Palermo';

INSERT INTO PARTIDO
  (id_complejo, fecha_hora, cupo_total, jugadores_faltantes, estado, descripcion, costo_total, modalidad, nivel)
SELECT c.id_complejo, DATE_ADD(NOW(), INTERVAL 50 HOUR), 10, 2, 'Publicado',
       'Futbolito entre amigos, faltan dos jugadores.',
       3000.00, 'Fútbol 5', 'Amateur'
FROM COMPLEJO c WHERE c.nombre = 'Club Social Colegiales';
