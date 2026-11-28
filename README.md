# Convocados

Aplicación para armar partidos de fútbol y otros deportes: publicar un partido,
sumarse como jugador o con tu equipo, aceptar solicitudes y chatear con los
jugadores confirmados.

El proyecto tiene dos partes:

```
Convocados/
├── Front/        interfaz web (HTML, CSS y JS sin frameworks)
└── backend-go/   API en Go + MySQL (también sirve el Front)
```

## Ramas

| Rama | Contenido |
|---|---|
| `main` | Proyecto completo (Front + backend) |
| `Frontend` | Solo la carpeta `Front/` |
| `Backend` | Solo la carpeta `backend-go/` |

## Cómo correrlo

1. Tener MySQL corriendo y Go 1.22 o superior instalado.
2. Configurar el backend: `cd backend-go && cp .env.example .env` y completar
   `DB_PASS` y `JWT_SECRET`.
3. Levantar la API y el Front: `./iniciar.sh` (queda en `http://localhost:8080`).
4. Para que otras personas entren desde otra red, ver
   [Publicar con ngrok](#publicar-con-ngrok).

Las migraciones de `backend-go/migrations/` se aplican solas al arrancar.

## Publicar con ngrok

Con un dominio estático gratis de ngrok, la API queda accesible desde internet
mientras la PC esté encendida:

1. Crear cuenta en ngrok, copiar el authtoken y ejecutar
   `ngrok config add-authtoken TU_TOKEN`.
2. Reclamar un dominio estático en el panel de ngrok.
3. En `backend-go/.env` agregar `NGROK_DOMAIN=tu-dominio.ngrok-free.app`.
   No usar `PUBLIC_URL` mientras se use el túnel.
4. Con la API corriendo (`./iniciar.sh`), ejecutar `./tunel.sh` en otra terminal.

La primera vez que alguien abre el sitio desde un navegador, ngrok muestra una
pantalla de advertencia: hay que hacer clic en **Visit Site**.

---

## Cambios de esta versión

### Front (`Front/`)

**Pantallas nuevas**
- `equipos.html` (+ `js/equipos.js`, `css/equipos.css`): mis equipos, crear
  equipo, buscar equipos y ventana de integrantes. Invitar, quitar
  integrantes, cancelar invitaciones y generar, regenerar, copiar y revocar
  el **link de invitación** son acciones del **dueño** del equipo; el resto
  de los integrantes puede verlos e irse con **Salir**. Cada fila marca al
  **Dueño** y la tarjeta dice "Es tuyo" solo si el equipo es tuyo. Al aceptar
  una invitación aparece un aviso de éxito: **"¡Listo! Ya formas parte de…"**.
  Los miembros que entraron por link se marcan como **Invitado**.
- `invitar.html` (+ `js/invitar.js`, `css/invitar.css`): página pública del link
  de invitación. Muestra el equipo y permite unirse con la cuenta propia (si hay
  sesión) o como invitado (nombre y apellido, sin cuenta).

**Pantallas modificadas**
- `detalle-partido.html` / `js/detalle-partido.js` / `css/detalle-partido.css`:
  - "Sumar mi equipo": elegir uno de mis equipos y enviar la solicitud, o
    cancelarla.
  - Estado del jugador según sea individual o por equipo.
  - **Chat del partido** (solo organizador y jugadores confirmados): consulta
    cada 5 s, mensajes con autor, hora y resaltado. Los mensajes del
    **Organizador** se resaltan en verde y los del **Capitán** de un equipo
    inscripto en ámbar.
- `administrar-partido.html` / `js/administrar-partido.js` /
  `css/administrar-partido.css`: el organizador ve las solicitudes de equipos
  (con su etiqueta) y puede aceptarlas o rechazarlas, además de las de jugadores.
- `crear-partido.html` / `js/crear-partido.js`: selector de equipo para crear el
  partido con un equipo inscripto (los cupos se calculan por integrante).
- `perfil-deportivo.html` / `js/perfil-deportivo.js` /
  `css/perfil-deportivo.css`: además de localidad y foto, ahora se editan
  **nombre y apellido** (usan `PUT /api/cuenta`). Se quitó el selector de
  **nivel**. Si la ficha ya estaba completa, la pantalla pasa a modo edición:
  otros títulos, botón "Guardar cambios" y aviso de éxito sin redirigir.
- `js/core.js`: nueva ruta `equipos` en `APP.rutas`.
- `inicio.html`, `buscar.html`, `mis-partidos.html`: nuevo enlace **Equipo** en
  la barra lateral.
- `onboarding.html`, `js/onboarding.js`, `js/inicio.js`, `js/crear-partido.js`:
  se borraron todas las menciones al **nivel** (del jugador y del partido).

### Backend (`backend-go/`)

**Equipos e invitaciones**
- Migración `005_invitaciones_equipo.sql`: tabla `INVITACION_EQUIPO`.
- Sumar un integrante ahora envía una **invitación**; el jugador la acepta o
  rechaza. Nuevos endpoints `GET/DELETE /api/equipos/{id}/invitaciones`,
  `GET /api/invitaciones` y `POST /api/invitaciones/{equipo}/aceptar|rechazar`.
- `GET /api/equipos/{id}` devuelve `invitaciones` pendientes y `link`/`linkUrl`
  (solo para el **dueño**), `puedeAdministrar` para quien pregunta, y cada
  integrante trae `rol`, `esDueno` y `esInvitado`.

**Rol de dueño del equipo**
- Migración `014_rol_equipo.sql`: columna `rol` (`Dueno`/`Miembro`) en
  `USUARIO_EQUIPO`, con backfill (el integrante más antiguo de cada equipo
  existente quedó como dueño).
- Solo el dueño invita, quitar integrantes, cancela invitaciones y maneja el
  link. Cualquiera puede irse de un equipo; si el dueño se va, el cargo pasa
  al integrante más antiguo (y el último no puede irse: 409).

**Perfiles sin "nivel"**
- Migración `015_quitar_nivel.sql`: se borran `USUARIO.nivel` y
  `PARTIDO.nivel`, y con ellas el filtro y el campo de nivel en partidos.
- `PUT /api/perfil` recibe `{localidad, foto}`; el front edita nombre y
  apellido con `PUT /api/cuenta`.

**Link de invitación e invitados sin cuenta**
- Migraciones `006_link_invitacion.sql` (tabla `LINK_INVITACION`, un link activo
  por equipo) y `007_usuario_invitado.sql` (columna `es_invitado`).
- `links.go`: `POST` (genera o regenera el token) y `DELETE` (revoca) en
  `/api/equipos/{id}/link`; público `GET` y `POST /api/invitacion/{token}`.
  Quien se une sin sesión queda como usuario invitado sin contraseña; el mismo
  navegador reutiliza al mismo invitado (cookie `convocados_invitado`).
- Los invitados no aparecen en `GET /api/usuarios?q=`.
- `PUBLIC_URL` (opcional) fija la dirección que va en el link. Si no está, se usa
  el host con el que entró quien pidió el link.

**Chat del partido**
- Migración `008_mensajes_partido.sql` (tabla `MENSAJE_PARTIDO`).
- `chat.go`: `GET /api/partidos/{id}/mensajes?desde=` y
  `POST /api/partidos/{id}/mensajes`. Solo leen y escriben el organizador y los
  jugadores confirmados. Cada mensaje indica si es del organizador o del capitán
  (el integrante más antiguo de un equipo inscripto); se calcula al leer.

**Inscripción de equipos y cupos**
- `POST /api/partidos/{id}/equipos` (solicitud del equipo),
  `DELETE /api/partidos/{id}/equipos/{equipo}` y
  `POST /api/partidos/{id}/equipos/{equipo}/aceptar` (el organizador).
- Cada equipo confirmado ocupa un cupo por integrante. No cuentan dos veces los
  jugadores ya confirmados de forma individual, ni el organizador.
- Un jugador que ya ocupa lugar por un equipo confirmado no puede pedir entrar
  individualmente (el sistema responde con un mensaje claro), y el organizador
  puede aceptar su solicitud individual pendiente sin que cuente otro cupo.
- Las solicitudes de equipos pendientes no ocupan cupo hasta ser aceptadas.

**Otros**
- `router.go`: rutas nuevas (públicas y protegidas).
- `config/config.go`: variable `PUBLIC_URL`.
- `tunel.sh`: levanta el túnel de ngrok (con `NGROK_DOMAIN`) o cloudflared.
- `.env.example`: documenta `PUBLIC_URL` y `NGROK_DOMAIN`.
- `README.md` del backend: documenta todos los endpoints.
