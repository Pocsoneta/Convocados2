# Convocados · API (Go)

Backend en **Go** para el front de Convocados (`../Front`).
Sirve la API en JSON **y** los archivos del front, así que las cookies
de sesión funcionan sin CORS.

## Estructura

```
backend-go/
├── cmd/server/main.go        arranque, migraciones, corte limpio (Ctrl+C)
├── internal/
│   ├── api/                  handlers + router
│   │   ├── router.go         rutas públicas / protegidas / estáticos / CORS
│   │   ├── auth.go           registro, login, logout, /me
│   │   ├── perfil.go         perfil deportivo y datos de la cuenta
│   │   ├── inicio.go         cercanos, próximo partido, conteos, mis partidos
│   │   ├── partidos.go       listado, detalle, alta, inscripciones
│   │   ├── complejos.go      complejos, canchas y geo (haversine)
│   │   ├── equipos.go        equipos e integrantes
│   │   ├── usuarios.go       perfil público
│   │   ├── helpers.go        distancias, normalización, formatos
│   │   └── respond.go        JSON y errores {"error": "..."}
│   ├── auth/                 bcrypt, JWT (HS256), cookie, middleware
│   ├── config/               variables de entorno + .env
│   └── database/             pool MySQL + runner de migraciones
├── migrations/               los .sql que se aplican (una sola vez c/u)
├── .env.example              plantilla de configuración
└── iniciar.sh                compila y levanta
```

## Requisitos

- Go 1.22 o superior
- MySQL corriendo en `127.0.0.1:3306`

## Correr

```bash
cp .env.example .env     # completá DB_PASS y JWT_SECRET
go run ./cmd/server      # o: ./iniciar.sh
```

Abrí <http://localhost:8080> (sirve el front si `FRONT_DIR` apunta a él).

### Configuración

Sale de variables de entorno, con un `.env` como respaldo (las variables
del entorno tienen prioridad). Copiá `.env.example` → `.env` y completalo:

| Variable | Por defecto | Qué hace |
|---|---|---|
| `DB_HOST` | `127.0.0.1` | host de MySQL |
| `DB_PORT` | `3306` | puerto |
| `DB_USER` | `root` | usuario |
| `DB_PASS` | `admin` | contraseña |
| `DB_NAME` | `Convocados` | base de datos (la crea si no existe) |
| `HTTP_ADDR` | `:8080` | dirección de escucha |
| `JWT_SECRET` | valor dev | secreto del token (**cambiar en producción**) |
| `JWT_EXPIRA_HORAS` | `24` | vida del token |
| `FRONT_DIR` | *vacío* | carpeta del front; vacío = solo API |
| `MIGRATIONS_DIR` | `migrations` | carpeta de migraciones |
| `AUTO_MIGRATE` | `true` | aplicar migraciones al arrancar |
| `ALLOW_ORIGIN` | *vacío* | origen CORS (solo si el front corre en otro puerto) |
| `MAPS_API_KEY` | *vacío* | clave de Google Maps (Maps JavaScript API + Places API) para elegir la ubicación con autocompletado en **Crear partido**; vacío = ingreso manual de dirección. La clave se expone en `GET /api/config`, así que es una clave de navegador: restringila a tu dominio |

Si arranca con el `JWT_SECRET` o `DB_PASS` por defecto, imprime un
`AVISO` en el log.

### Migraciones

```bash
go run ./cmd/server -migrate   # solo aplica y sale
```

Cada `.sql` de `migrations/` corre **una sola vez** (queda en
`schema_migrations`). Orden:

1. `001_esquema_base.sql` — el esquema original del equipo (idempotente)
2. `002_campos_front.sql` — columnas que el front necesita + tabla `USUARIO_PARTIDO`
3. `003_seed_demo.sql` — complejos, canchas y partidos de ejemplo

## Endpoints

Todas las respuestas de error son `{"error": "mensaje legible"}`.
Salvo lo indicado, **requieren** la cookie de sesión `convocados_token`.

### Públicas

| Método | Ruta | Body | Devuelve |
|---|---|---|---|
| `GET` | `/api/health` | – | `{"ok":"Convocados API"}` |
| `GET` | `/api/config` | – | `{mapsKey}` (clave de Google Maps si `MAPS_API_KEY` está seteada; vacío si no) |
| `POST` | `/api/auth/registro` | `{nombre, apellido, email, password, nacimiento}` | `{id, email, nombre}` + cookie |
| `POST` | `/api/auth/login` | `{email, password}` | `{id, email, nombre}` + cookie |

### Sesión y perfil

| Método | Ruta | Body |
|---|---|---|
| `POST` | `/api/auth/logout` | – |
| `GET` | `/api/auth/me` | – |
| `GET` | `/api/perfil` | – |
| `PUT` | `/api/perfil` | `{localidad, nivel, foto}` |
| `PUT` | `/api/cuenta` | `{nombre, apellido, telefono}` |
| `GET` | `/api/usuarios/{id}` | – (perfil público) |

### Inicio

| Método | Ruta | Query |
|---|---|---|
| `GET` | `/api/inicio/cercanos` | `lat, lng, limit` |
| `GET` | `/api/inicio/proximo` | `lat, lng` |
| `GET` | `/api/inicio/conteos` | – |
| `GET` | `/api/mis-partidos` | `momento=proximos\|pasados` |

### Partidos

| Método | Ruta | Body / Query |
|---|---|---|
| `GET` | `/api/partidos` | `q, zona, modalidad, nivel, desde, hasta, orden, lat, lng, limit, pasados` |
| `POST` | `/api/partidos` | `{idComplejo, idCancha, fechaHora, cupoTotal, jugadoresFaltantes, descripcion, costoTotal, modalidad, nivel}` |
| `GET` | `/api/partidos/{id}` | `lat, lng` |
| `POST` | `/api/partidos/{id}/inscripcion` | – |
| `DELETE` | `/api/partidos/{id}/inscripcion` | – |
| `POST` | `/api/partidos/{id}/equipos` | `{idEquipo}` |
| `DELETE` | `/api/partidos/{id}/equipos/{equipo}` | – |

### Ubicación

| Método | Ruta | Body |
|---|---|---|
| `GET` | `/api/geocode?q=` | – → `[{titulo, subtitulo, lat, lng}]`. Autocompletado de **Crear partido** vía OpenStreetMap (gratis, sin clave). Caché en memoria de 10 min. Si hay `MAPS_API_KEY`, el front usa Google Places y este queda de respaldo |

### Complejos / canchas

| Método | Ruta | Body |
|---|---|---|
| `GET` | `/api/complejos` | – (con `canchas[]`) |
| `POST` | `/api/complejos` | `{nombre, direccion, barrio, ciudad, lat, lng, canchas[]}` |
| `GET` | `/api/complejos/{id}/canchas` | – |

### Equipos

| Método | Ruta | Body |
|---|---|---|
| `GET` | `/api/equipos` | `?q=` |
| `GET` | `/api/equipos/mis-equipos` | – |
| `GET` | `/api/equipos/{id}` | – |
| `POST` | `/api/equipos` | `{nombre}` |
| `POST` | `/api/equipos/{id}/integrantes` | `{idUsuario}` |
| `DELETE` | `/api/equipos/{id}/integrantes/{usuario}` | – |

## Forma de los partidos (la que espera el front)

```json
{
  "id": 1,
  "nombre": "Palermo Arena Canchas",
  "modalidad": "Fútbol 5",
  "zona": "Palermo, CABA",
  "zonasCercanas": ["Colegiales", "Villa Crespo"],
  "distanciaKm": 1.2,
  "fecha": "2026-11-02T21:00:00",
  "cupos": 7,
  "lat": -34.5806,
  "lng": -58.4372,
  "nivel": "Amateur"
}
```

Es la misma que usan `js/partidos-demo.js` e `js/inicio.js`.

## Cómo se conecta el front

**Esta carpeta es solo el backend.** El front vive en otro repositorio
(`Front`), y ahí están los cambios que lo conectan a la API.

Para servir el front desde este mismo proceso (evita CORS y hace que
las cookies de sesión funcionen tal cual), apuntá `FRONT_DIR` a su
carpeta:

```bash
FRONT_DIR=../Front go run ./cmd/server
```

Si no lo seteás, la API corre sola y responde JSON en `/api/*`.

En `js/core.js` del front hay un helper `api()` que hace `fetch` con
`credentials: "same-origin"`. Las funciones que el propio front marca
como "reemplazar cuando exista el backend" quedaron apuntando a la API:

| Archivo | Función | Llamada |
|---|---|---|
| `js/login.js` | `autenticar` | `POST /api/auth/login` |
| `js/registro.js` | `crearCuenta` | `POST /api/auth/registro` |
| `js/perfil-deportivo.js` | `guardarPerfil` | `PUT /api/perfil` |
| `js/inicio.js` | `obtenerPartidosCercanos` / `obtenerProximoPartido` / `obtenerConteoModalidades` | `GET /api/inicio/...` |
| `js/core.js` | `Auth.usuario` | `GET /api/auth/me` |
