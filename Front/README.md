# Convocados · Front

Interfaz web de Convocados: HTML, CSS y JavaScript sin frameworks. La sirve el
backend (`backend-go/`) desde `FRONT_DIR`, así que las cookies de sesión
funcionan sin CORS. Para correrlo, ver el README de la raíz.

## Estructura

```
Front/
├── *.html            una página por pantalla
├── css/              base.css (compartido) y un CSS por pantalla
├── js/
│   ├── core.js       cliente de la API, Store (localStorage) y Auth
│   ├── sidebar.js    barra lateral compartida
│   └── <pantalla>.js lógica de cada pantalla
└── img/              imágenes
```

## Pantallas

| Pantalla | Archivo |
|---|---|
| Inicio / onboarding / login / registro / recuperar clave | `inicio.html`, `onboarding.html`, `login.html`, `registro.html`, `recuperar.html` |
| Buscar partidos | `buscar.html` |
| Crear partido | `crear-partido.html` |
| Mis partidos | `mis-partidos.html` |
| Detalle del partido (con chat) | `detalle-partido.html` |
| Administrar partido | `administrar-partido.html` |
| Mis equipos | `equipos.html` |
| Invitación a un equipo (link público) | `invitar.html` |
| Perfil deportivo | `perfil-deportivo.html` |

## Cambios de esta versión

**Pantallas nuevas**
- `equipos.html`, `js/equipos.js`, `css/equipos.css`: gestión de equipos e
  invitaciones (enviar, cancelar, aceptar y rechazar). Invitar, quitar
  integrantes, cancelar invitaciones y el link de invitación (generar,
  regenerar, copiar, revocar) son acciones del **dueño** del equipo; el resto
  solo puede ver e irse con **Salir**. Cada fila marca al **Dueño**. Al aceptar
  una invitación se muestra un aviso de éxito. Los integrantes que entraron
  por link se marcan como **Invitado**.
- `invitar.html`, `js/invitar.js`, `css/invitar.css`: página pública del link.
  Con sesión, el usuario se suma con su cuenta; sin sesión, se suma como
  invitado con nombre y apellido.

**Pantallas modificadas**
- `perfil-deportivo.html`, `js/perfil-deportivo.js`,
  `css/perfil-deportivo.css`: se editan **nombre y apellido** además de
  localidad y foto; se quitó el selector de **nivel**. Si la ficha ya estaba
  completa, la pantalla pasa a modo edición (títulos y botón cambiados, aviso
  de éxito y sin redirigir al inicio).
- `detalle-partido.html`, `js/detalle-partido.js`, `css/detalle-partido.css`:
  - Botón **Sumar mi equipo** con selector de equipos, y cancelación de la
    solicitud del equipo.
  - Estados distintos según la inscripción sea individual o por equipo.
  - **Chat del partido** (solo organizador y jugadores confirmados), que se
    actualiza cada 5 segundos. Los mensajes del organizador se resaltan en verde
    y los del capitán de un equipo inscripto en ámbar.
- `administrar-partido.html`, `js/administrar-partido.js`,
  `css/administrar-partido.css`: solicitudes de equipos con etiqueta, y acciones
  para aceptarlas o rechazarlas.
- `crear-partido.html`, `js/crear-partido.js`: selector de equipo para publicar
  un partido con un equipo inscripto.
- `js/core.js`: nueva ruta `equipos` en `APP.rutas`.
- `inicio.html`, `buscar.html`, `mis-partidos.html`: enlace **Equipo** en la
  barra lateral.
