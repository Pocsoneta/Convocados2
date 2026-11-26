-- 011: completa el barrio de El Picadito.
--
-- El Picadito ya existía en la base (cargado a mano con su pin), así que
-- la migración 010 no volvió a insertar el complejo y quedó sin barrio,
-- mostrando la zona como "Mendoza" en lugar de "Rivadavia, Mendoza".
-- Se completa solo si está vacío: si alguien ya lo cargó, no se pisa.

UPDATE COMPLEJO
   SET barrio = 'Rivadavia'
 WHERE LOWER(nombre) = 'el picadito'
   AND barrio IS NULL;
