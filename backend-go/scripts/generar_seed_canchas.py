#!/usr/bin/env python3
"""Genera la migración SQL que carga las canchas de Mendoza.

Lee `canchas_de_futbol_mendoza_actualizado.json` y escribe
`migrations/010_seed_canchas_mendoza.sql`.

Mapeo (el JSON y la base usan nombres invertidos):
  JSON canchas[].tipo_cancha  ->  DB CANCHA.tipo_suelo    (superficie)
  JSON canchas[].modalidad[]  ->  DB CANCHA.tipo_cancha   (modalidad)
  JSON ubicacion "Rivadavia, Mendoza, Argentina"
        ->  barrio "Rivadavia" + ciudad "Mendoza"

Decisiones tomadas con el usuario:
  - 1 fila de CANCHA por cancha física (modalidades unidas con " / ").
  - Se descarta el bloque `acceso` (no hay columnas).
  - Se omiten los complejos sin coordenadas.
  - Nada de `origen`/`verificado` por ahora.

El script es idempotente por diseño (`NOT EXISTS` por nombre de complejo y
por numero_cancha), así que re-ejecutarlo no duplica datos.
"""

import json
import pathlib
import sys

RAIZ = pathlib.Path(__file__).resolve().parent.parent
ENTRADA = RAIZ / "canchas_de_futbol_mendoza_actualizado.json"
SALIDA = RAIZ / "migrations" / "010_seed_canchas_mendoza.sql"

# superficie: JSON -> texto de la base
SUELO = {
    "cesped_sintetico": "Césped sintético",
    "cesped_natural": "Césped natural",
    "baldosa_o_cemento": "Baldosa o cemento",
    "baldosa_parquet_o_cemento": "Baldosa, parquet o cemento",
    "parquet": "Parquet",
}

# modalidad: JSON -> texto de la base
MODALIDAD = {
    "futbol_5": "Fútbol 5",
    "futbol_7": "Fútbol 7",
    "futbol_8": "Fútbol 8",
    "futbol_11": "Fútbol 11",
}


def esc(texto: str) -> str:
    """Escapa una cadena para un literal SQL entre comillas simples."""
    return texto.replace("\\", "\\\\").replace("'", "''")


def ciudad_y_barrio(ubicacion: str):
    """`"Rivadavia, Mendoza, Argentina"` -> ("Rivadavia", "Mendoza")."""
    partes = [p.strip() for p in (ubicacion or "").split(",") if p.strip()]
    barrio = partes[0] if partes else ""
    ciudad = partes[1] if len(partes) > 1 else "Mendoza"
    return barrio, ciudad


def sql_insert_complejo(c) -> str:
    coords = c["coordenadas"]
    lat = round(float(coords["latitud"]), 6)
    lng = round(float(coords["longitud"]), 6)
    barrio, ciudad = ciudad_y_barrio(c.get("ubicacion", ""))
    nombre = esc(c["nombre"])
    return (
        "INSERT INTO COMPLEJO (nombre, direccion, barrio, ciudad, lat, lng)\n"
        "SELECT '{nombre}', '{direccion}', {barrio}, {ciudad}, {lat}, {lng}\n"
        " WHERE NOT EXISTS (SELECT 1 FROM COMPLEJO WHERE LOWER(nombre) = LOWER('{nombre}'));".format(
            nombre=nombre,
            direccion=esc(c["direccion"]),
            barrio="NULL" if barrio == "" else "'%s'" % esc(barrio),
            ciudad="NULL" if ciudad == "" else "'%s'" % esc(ciudad),
            lat=lat,
            lng=lng,
        )
    )


def sql_insert_canchas(c) -> list:
    nombre = esc(c["nombre"])
    filas = []
    for i, cancha in enumerate(c.get("canchas", []), start=1):
        suelo = SUELO.get(cancha.get("tipo_cancha"), "")
        modos = [MODALIDAD[m] for m in (cancha.get("modalidad") or []) if m in MODALIDAD]
        modalidad = " / ".join(modos)
        filas.append(
            "INSERT INTO CANCHA (id_complejo, numero_cancha, nombre, direccion, tipo_cancha, tipo_suelo)\n"
            "SELECT c.id_complejo, {n}, 'Cancha {n}', '', {tc}, {ts}\n"
            "  FROM COMPLEJO c\n"
            " WHERE LOWER(c.nombre) = LOWER('{nombre}')\n"
            "   AND NOT EXISTS (SELECT 1 FROM CANCHA ca\n"
            "                    WHERE ca.id_complejo = c.id_complejo AND ca.numero_cancha = {n});".format(
                n=i,
                nombre=nombre,
                tc="NULL" if modalidad == "" else "'%s'" % esc(modalidad),
                ts="NULL" if suelo == "" else "'%s'" % esc(suelo),
            )
        )
    return filas


def main() -> int:
    datos = json.loads(ENTRADA.read_text(encoding="utf-8"))["canchas_de_futbol"]
    con_coords = [
        c for c in datos if (c.get("coordenadas") or {}).get("latitud") is not None
    ]
    sin_coords = len(datos) - len(con_coords)

    bloques = [
        "-- 010: canchas de fútbol de Mendoza (Rivadavia, Junín, San Martín).",
        "-- Generado por scripts/generar_seed_canchas.py a partir de",
        "-- canchas_de_futbol_mendoza_actualizado.json. NO editar a mano.",
        "--",
        "-- Mapeo: el JSON trae la superficie en `tipo_cancha` y las",
        "-- modalidades en `modalidad[]`; acá van invertidas (la base guarda",
        "-- la modalidad en CANCHA.tipo_cancha y la superficie en tipo_suelo).",
        "-- 1 fila de CANCHA por cancha física, modalidades unidas con ' / '.",
        "-- Los complejos sin coordenadas (%d) se omiten a propósito." % sin_coords,
    ]

    total_canchas = 0
    for c in con_coords:
        bloques.append("")
        bloques.append(sql_insert_complejo(c))
        for fila in sql_insert_canchas(c):
            bloques.append(fila)
            total_canchas += 1

    SALIDA.write_text("\n".join(bloques) + "\n", encoding="utf-8")
    print("complejos con coordenadas: %d (de %d)" % (len(con_coords), len(datos)))
    print("complejos omitidos (sin coords): %d" % sin_coords)
    print("filas de CANCHA: %d" % total_canchas)
    print("escrito:", SALIDA.relative_to(RAIZ))
    return 0


if __name__ == "__main__":
    sys.exit(main())
