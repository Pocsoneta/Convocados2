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
│   │   ├── equipos.go        equipos, integrantes e invitaciones
│   │   ├── links.go          link de invitación e invitados sin cuenta
│   │   ├── chat.go           chat del partido
│   │   ├── administrar.go    administración del partido (solicitudes)
│   │   ├── usuarios.go       perfil público y buscador de jugadores
│   │   ├── helpers.go        distancias, normalización, formatos
│   │   └── respond.go        JSON y errores {"error": "..."}
│   ├── auth/                 bcrypt, JWT (HS256), cookie, middleware
│   ├── config/               variables de entorno + .env
│   └── database/             pool MySQL + runner de migraciones
├── migrations/               los .sql que se aplican (una sola vez c/u)
├── .env.example              plantilla de configuración
├── iniciar.sh                compila y levanta
└── tunel.sh                  publica la API con ngrok o cloudflared
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
| `GET` | `/api/invitacion/{token}` | – | `{idEquipo, equipo, integrantes}` — público: qué equipo muestra ese link de invitación (404 si no existe o está revocado) |
| `POST` | `/api/invitacion/{token}` | `{nombre, apellido}` | Pública. **Con sesión**: me suma con mi cuenta. **Sin sesión**: crea (o reusa, por la cookie `convocados_invitado`) un usuario **invitado** sin contraseña y me suma al equipo |

### Sesión y perfil

| Método | Ruta | Body |
|---|---|---|
| `POST` | `/api/auth/logout` | – |
| `GET` | `/api/auth/me` | – |
| `GET` | `/api/perfil` | – |
| `PUT` | `/api/perfil` | `{localidad, nivel, foto}` |
| `PUT` | `/api/cuenta` | `{nombre, apellido, telefono}` |
| `GET` | `/api/usuarios?q=` | – → `[{id, nombre, apellido, foto, localidad}]`, busca por nombre / apellido / email (excluye la cuenta propia y los **invitados** sin cuenta). Lo usa **Equipo** para sumar integrantes |
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
| `POST` | `/api/partidos` | `{idComplejo, idCancha, fechaHora, cupoTotal, jugadoresFaltantes, descripcion, costoTotal, modalidad, nivel, idEquipo}` — `idEquipo` es opcional: si viene, el equipo queda inscripto en el partido como **Confirmado** |
| `GET` | `/api/partidos/{id}` | `lat, lng` |
| `POST` | `/api/partidos/{id}/inscripcion` | – |
| `DELETE` | `/api/partidos/{id}/inscripcion` | – |
| `POST` | `/api/partidos/{id}/equipos` | `{idEquipo}` — el equipo queda **Pendiente** hasta que el organizador lo acepte (no ocupa cupos mientras tanto) |
| `POST` | `/api/partidos/{id}/equipos/{equipo}/aceptar` | – — solo el organizador: pasa a **Confirmado** si entran todos los integrantes en los cupos libres |
| `DELETE` | `/api/partidos/{id}/equipos/{equipo}` | – — cancela la solicitud del equipo (la puede hacer un integrante) o lo saca del partido (el organizador) |
| `GET` | `/api/partidos/{id}/mensajes` | `desde` — chat: devuelve las últimas 50 (o solo las posteriores a `desde`), con `ultimo` para el próximo sondeo. Cada mensaje trae `autor`, `organizador`, `capitan` y `mio` |
| `POST` | `/api/partidos/{id}/mensajes` | `{texto}` (1–500) — escribe en el chat |

### Chat del partido

Lo pueden leer y escribir **el organizador y los jugadores confirmados**
(individualmente o a través de un equipo confirmado); el resto recibe
403. El front lo sondea cada 5 s con `?desde=` (migración `008`).

Los rangos **no se guardan en el mensaje**: se calculan al leer
(`sqlMensajes` de `chat.go`):

- `organizador` — quien creó el partido;
- `capitan` — el integrante más antiguo (`MIN(id_usuario_equipo)`) de
  un equipo confirmado en el partido.

El front resalta los mensajes del organizador (verde) y del capitán (ámbar).

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
| `GET` | `/api/equipos/{id}` | – (trae `integrantes` — con `esInvitado` en los que entraron por link —, `invitaciones` pendientes y `link`, solo para integrantes) |
| `POST` | `/api/equipos` | `{nombre}` |
| `POST` | `/api/equipos/{id}/integrantes` | `{idUsuario}` — **envía una invitación**, no suma a la fuerza |
| `DELETE` | `/api/equipos/{id}/integrantes/{usuario}` | – |
| `POST` | `/api/equipos/{id}/link` | – — genera (o regenera, rotando el token) el link de invitación. Solo integrantes |
| `DELETE` | `/api/equipos/{id}/link` | – — revoca el link vigente. Solo integrantes |
| `GET` | `/api/equipos/{id}/invitaciones` | – — las que mandó el equipo (solo integrantes) |
| `DELETE` | `/api/equipos/{id}/invitaciones/{usuario}` | – — cancela una invitación enviada |
| `GET` | `/api/invitaciones` | – — las que me llegaron y no respondí |
| `POST` | `/api/invitaciones/{equipo}/aceptar` | – — me suma al equipo |
| `POST` | `/api/invitaciones/{equipo}/rechazar` | – |

**Invitaciones a equipo:** hay una fila por equipo/jugador en
`INVITACION_EQUIPO` (migración `005`), con estado `Pendiente`,
`Aceptada` o `Rechazada`. Cualquier integrante puede invitar; el
jugador acepta o rechaza desde su pantalla de Equipos, y al aceptar
el alta en `USUARIO_EQUIPO` y el cambio de estado ocurren en la misma
transacción.

**Link de invitación (invitados sin cuenta):** cada equipo tiene como
mucho un link activo en `LINK_INVITACION` (migración `006`). Cualquiera
que lo abre entra en `invitar.html` y, si no tiene sesión, se suma como
**invitado**: un usuario con `es_invitado = 1` (migración `007`),
contraseña inutilizable y email sintético, que **no puede iniciar
sesión**, **no aparece en el buscador de jugadores** y no chatea. Sí
ocupa cupo en los partidos como cualquier integrante y se muestra con
la etiqueta "Invitado". La cookie `convocados_invitado` (path
`/api/invitacion`, 30 días) hace que el mismo navegador reutilice al
mismo invitado en vez de duplicarlo; regenerar el link rota el token
(deja de valer el anterior) y revocarlo lo desactiva por completo.

**Cupos que ocupa un equipo:** cada equipo inscripto descuenta un lugar
por integrante. No cuentan dos veces los que ya están confirmados de
forma individual en ese mismo partido, y tampoco el organizador del
partido (él es quien busca jugadores). Esa cuenta la hace la expresión
`sqlInscriptos` de `partidos.go`, usada tanto en el listado como en las
transacciones que bloquean el cupo.

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

## Cambios de esta versión

**Equipos e invitaciones**
- Migración `005_invitaciones_equipo.sql` (tabla `INVITACION_EQUIPO`).
- Sumar un integrante envía una invitación que el jugador acepta o rechaza.
  Endpoints: `GET/DELETE /api/equipos/{id}/invitaciones`,
  `GET /api/invitaciones`, `POST /api/invitaciones/{equipo}/aceptar|rechazar`.
- `GET /api/equipos/{id}` devuelve `invitaciones`, `link` y `linkUrl` (solo
  para integrantes), y cada integrante trae `esInvitado`.

**Link de invitación e invitados sin cuenta** (`links.go`)
- Migraciones `006_link_invitacion.sql` (tabla `LINK_INVITACION`) y
  `007_usuario_invitado.sql` (columna `es_invitado`).
- `POST /api/equipos/{id}/link` genera o regenera el link (rota el token);
  `DELETE /api/equipos/{id}/link` lo revoca. Solo integrantes.
- `GET /api/invitacion/{token}` y `POST /api/invitacion/{token}` son públicos.
  Con sesión, se suma con la cuenta; sin sesión, crea un usuario invitado sin
  contraseña. La cookie `convocados_invitado` (path `/api/invitacion`) hace que
  el mismo navegador reutilice a su invitado.
- Los invitados no aparecen en `GET /api/usuarios?q=`.
- `PUBLIC_URL` (opcional, en `config.go`) fija la dirección del link. Si no
  está, se usa el host con el que entró quien pidió el link.

**Chat del partido** (`chat.go`)
- Migración `008_mensajes_partido.sql` (tabla `MENSAJE_PARTIDO`).
- `GET /api/partidos/{id}/mensajes?desde=` devuelve las últimas 50 o los
  mensajes posteriores a `desde`, junto con `ultimo`.
- `POST /api/partidos/{id}/mensajes` (1 a 500 caracteres).
- Solo leen y escriben el organizador y los jugadores confirmados (en forma
  individual o por un equipo confirmado). El resto recibe 403.
- Cada mensaje indica `organizador` y `capitan` (integrante más antiguo de un
  equipo inscripto). Se calculan al leer, no se guardan.

**Partidos y cupos**
- `equipoConfirmadoDe` (`partidos.go`): un jugador que ya ocupa lugar por un
  equipo confirmado no puede pedir entrar individualmente, y el organizador
  puede aceptar su solicitud individual sin que cuente otro cupo.
- `sqlInscriptos` cuenta solo los equipos confirmados y no duplica a los
  jugadores ya confirmados de forma individual ni al organizador.
- Endpoints de equipos en el partido: `POST /api/partidos/{id}/equipos`,
  `DELETE /api/partidos/{id}/equipos/{equipo}` y
  `POST /api/partidos/{id}/equipos/{equipo}/aceptar`.

**Otros**
- `router.go`: rutas nuevas (públicas en `raiz`, protegidas en `protegido`).
- `usuarios.go`: el buscador excluye a los invitados.
- `config/config.go`: variable `PUBLIC_URL`.
- `tunel.sh`: túnel con ngrok (si está `NGROK_DOMAIN`) o cloudflared.
- `.env.example`: documenta `PUBLIC_URL` y `NGROK_DOMAIN`.
