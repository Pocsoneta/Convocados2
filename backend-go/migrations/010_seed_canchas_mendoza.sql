-- 010: canchas de fútbol de Mendoza (Rivadavia, Junín, San Martín).
-- Generado por scripts/generar_seed_canchas.py a partir de
-- canchas_de_futbol_mendoza_actualizado.json. NO editar a mano.
--
-- Mapeo: el JSON trae la superficie en `tipo_cancha` y las
-- modalidades en `modalidad[]`; acá van invertidas (la base guarda
-- la modalidad en CANCHA.tipo_cancha y la superficie en tipo_suelo).
-- 1 fila de CANCHA por cancha física, modalidades unidas con ' / '.
-- Los complejos sin coordenadas (11) se omiten a propósito.

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'El Picadito', 'Lavalle 1265, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.187713, -68.461009
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('El Picadito'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('El Picadito')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'El Templo', 'Falucho, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.180066, -68.482616
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('El Templo'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('El Templo')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 2, 'Cancha 2', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('El Templo')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 2);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'El Olimpico', 'Colón, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.198289, -68.47987
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('El Olimpico'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('El Olimpico')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas García (Fútbol y Paddle)', 'Leandro N. Alem 1110, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.197442, -68.452377
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas García (Fútbol y Paddle)'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas García (Fútbol y Paddle)')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Casa D''Italia', 'Mariano Moreno 76 (junto a El Cuyucho), M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.196216, -68.466656
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Casa D''Italia'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Baldosa, parquet o cemento'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Casa D''Italia')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'FUTSAL RIVADAVIA', 'Almte. G. Brown S/N, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.201278, -68.474299
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('FUTSAL RIVADAVIA'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8', 'Baldosa, parquet o cemento'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('FUTSAL RIVADAVIA')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Camping Pennacchio', 'M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.184442, -68.449178
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Camping Pennacchio'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Camping Pennacchio')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Cancha Pare', 'Cabrera 5577, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.17107, -68.441691
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Cancha Pare'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Cancha Pare')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Central', 'M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.182771, -68.45385
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Central'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Central')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Deportivo La Central', 'Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.273959, -68.315269
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Deportivo La Central'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Deportivo La Central')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Cancha de fútbol Almafuerte', 'Interior de Camping San Agustín, Calle Falucho, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.181932, -68.473836
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Cancha de fútbol Almafuerte'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Cancha de fútbol Almafuerte')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Centro Deportivo Rivadavia', 'Dr Rúben Muzzino, M5577 Rivadavia, Mendoza', 'Rivadavia', 'Mendoza', -33.202939, -68.475812
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Centro Deportivo Rivadavia'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Centro Deportivo Rivadavia')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Estadio Cubierto La Colonia', 'Av. Mitre y Paso de los Andes, La Colonia, M5573 Junín, Mendoza', 'Junín', 'Mendoza', -33.092363, -68.480379
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Estadio Cubierto La Colonia'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Parquet'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Estadio Cubierto La Colonia')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Polideportivo Municipal Posta del Retamo', 'Salvador González 485, M5573 Junín, Mendoza', 'Junín', 'Mendoza', -33.149728, -68.486071
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Polideportivo Municipal Posta del Retamo'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Parquet'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Polideportivo Municipal Posta del Retamo')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Escuela Deportiva Junín', 'M5573 Junín, Mendoza', 'Junín', 'Mendoza', -33.148537, -68.485341
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Escuela Deportiva Junín'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Escuela Deportiva Junín')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Estrella (La Colonia)', 'La Colonia, M5573 Junín, Mendoza', 'Junín', 'Mendoza', -33.151505, -68.40482
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Estrella (La Colonia)'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Estrella (La Colonia)')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Social y Deportivo La Amistad (Ingenio Giagnoni)', 'Ingeniero Giagnoni, Junín, Mendoza', 'Junín', 'Mendoza', -33.126071, -68.405913
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Social y Deportivo La Amistad (Ingenio Giagnoni)'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Social y Deportivo La Amistad (Ingenio Giagnoni)')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Social y Deportivo Rodríguez Peña', 'Rodríguez Peña, Junín, Mendoza', 'Junín', 'Mendoza', -33.127362, -68.597958
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Social y Deportivo Rodríguez Peña'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Social y Deportivo Rodríguez Peña')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Social y Deportivo Mundo Nuevo', 'Mundo Nuevo, Junín, Mendoza', 'Junín', 'Mendoza', -33.172103, -68.427873
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Social y Deportivo Mundo Nuevo'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Social y Deportivo Mundo Nuevo')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas Maturana', 'Junín, Mendoza', 'Junín', 'Mendoza', -33.157651, -68.448649
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas Maturana'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas Maturana')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'La Posta Club', 'Junín, Mendoza', 'Junín', 'Mendoza', -33.133095, -68.477234
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('La Posta Club'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('La Posta Club')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'FYMA Futbol Club', 'Junín, Mendoza', 'Junín', 'Mendoza', -33.124613, -68.483242
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('FYMA Futbol Club'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('FYMA Futbol Club')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Campus La Cofradía', 'Junín, Mendoza', 'Junín', 'Mendoza', -33.115873, -68.490957
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Campus La Cofradía'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Campus La Cofradía')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Nuevo Estadio Los Hornos', 'Junín, Mendoza', 'Junín', 'Mendoza', -33.152916, -68.472997
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Nuevo Estadio Los Hornos'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Nuevo Estadio Los Hornos')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'LA 6 Futbol', 'Junín, Mendoza', 'Junín', 'Mendoza', -33.119826, -68.458409
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('LA 6 Futbol'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('LA 6 Futbol')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Atlético Club San Martín (Estadio Libertador General San Martín)', 'Lavalle y Ruta 50, M5570 San Martín, Mendoza', 'San Martín', 'Mendoza', -33.078572, -68.480428
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Atlético Club San Martín (Estadio Libertador General San Martín)'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Atlético Club San Martín (Estadio Libertador General San Martín)')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Polideportivo Gustavo "Torito" Rodríguez', 'Av. Eva Duarte de Perón y Av. Boulogne Sur Mer, M5570 San Martín, Mendoza', 'San Martín', 'Mendoza', -33.072601, -68.484576
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Polideportivo Gustavo "Torito" Rodríguez'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8', 'Parquet'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Polideportivo Gustavo "Torito" Rodríguez')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 2, 'Cancha 2', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8', 'Baldosa o cemento'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Polideportivo Gustavo "Torito" Rodríguez')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 2);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Polideportivo Municipal San Pedro (Duperial)', 'Av. Eva Duarte de Perón, Palmira, M5584 San Martín, Mendoza', 'San Martín', 'Mendoza', -33.05296, -68.564553
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Polideportivo Municipal San Pedro (Duperial)'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7', 'Baldosa o cemento'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Polideportivo Municipal San Pedro (Duperial)')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Club Atlético Palmira (Estadio José Castro)', '28 de Diciembre y Av. Alem, Palmira, M5584 San Martín, Mendoza', 'San Martín', 'Mendoza', -33.053587, -68.553839
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Club Atlético Palmira (Estadio José Castro)'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Club Atlético Palmira (Estadio José Castro)')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas de fútbol La Reserva', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.113718, -68.409045
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas de fútbol La Reserva'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas de fútbol La Reserva')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas del Felipe', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.094993, -68.447914
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas del Felipe'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas del Felipe')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'El Alargue - bar y futbol', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.089802, -68.446564
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('El Alargue - bar y futbol'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('El Alargue - bar y futbol')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'La Isla', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.087716, -68.455863
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('La Isla'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('La Isla')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Horacio futbol 5', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.086103, -68.45433
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Horacio futbol 5'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Horacio futbol 5')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas de fútbol Aruta', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.088188, -68.43372
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas de fútbol Aruta'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas de fútbol Aruta')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas de fútbol Lopez', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.060813, -68.459678
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas de fútbol Lopez'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas de fútbol Lopez')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Al ángulo futbol', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.065651, -68.440829
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Al ángulo futbol'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Al ángulo futbol')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Cancha Abdala', 'San Martín, Mendoza', 'San Martín', 'Mendoza', -33.04518, -68.440277
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Cancha Abdala'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 7 / Fútbol 8 / Fútbol 11', 'Césped natural'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Cancha Abdala')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas de fútbol La Cantera', 'Palmira / San Martín, Mendoza', 'San Martín', 'Mendoza', -33.061982, -68.525333
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas de fútbol La Cantera'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas de fútbol La Cantera')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);

INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)
SELECT 'Canchas El Chiqui', 'Palmira / San Martín, Mendoza', 'San Martín', 'Mendoza', -33.087299, -68.578033
 WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('Canchas El Chiqui'));
INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)
SELECT c.id_complejo, 1, 'Cancha 1', '', 'Fútbol 5 / Fútbol 7 / Fútbol 8', 'Césped sintético'
  FROM COMPLEJO c
 WHERE LOWER(c.nombre) = LOWER('Canchas El Chiqui')
   AND NOT EXISTS (SELECT 1 FROM CANCHA ca
                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = 1);
