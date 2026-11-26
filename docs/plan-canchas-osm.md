# Plan: Cobertura de canchas de fútbol de Mendoza ("El Picadito" y similares)

> Documento de investigación + plan. No modifica código de la app.
> Autor: subagente planner. Fecha: 2026-11-25.

## 0. Resumen ejecutivo

- **No se pueden copiar datos de Google Maps a OpenStreetMap (ni a nada).** Es
  ilegal por las ToS de Google y por la política de OSM. Ruta descartada de plano.
- La app **no necesita** que "todas las canchas de Mendoza estén en OSM": ya tiene
  su propia base (`COMPLEJO`/`CANCHA`) y un mapa con pin soltable. El problema real
  es que un complejo cargado a mano ("El Picadito", `id_complejo=9`) quedó sin
  `lat/lng` y su partido muestra "Sin ubicación".
- **Cobertura OSM hoy en Mendoza es pobre para lo que el usuario necesita**: de
  ~1042 canchas de fútbol en la provincia solo ~151 tienen nombre; en Capital hay
  0 canchas con nombre y en Rivadavia apenas 1. "El Picadito" **no existe** en OSM
  en toda Argentina.
- **Recomendación**: priorizar la ruta de ingeniería (base propia + pin obligatorio
  + semilla) y, en paralelo, contribuir a OSM de forma legítima como mejora
  comunitaria (no como dependencia).

## 1. Legalidad / licencias (CRÍTICO)

### 1.1 ¿Se puede copiar/extraer de Google Maps hacia OSM? NO.

Tres capas de prohibición, todas citables:

1. **Google Maps Platform ToS**, §3.2.3 "Restrictions Against Misusing the Services":
   *"Customer will not export, extract, or otherwise scrape Google Maps Content for
   use outside the Services… (iii) copy and save business names, addresses, or user
   reviews; (iv) create content based on Google Maps Content…"*
   <https://cloud.google.com/maps-platform/terms>
2. **Google Maps/Google Earth Additional ToS** (usuario final), §2: *"you may not
   … use Google Maps … to create or augment any other mapping-related dataset
   (including a mapping or navigation dataset, business listings database …)"*.
   <https://www.google.com/help/terms_maps/>
3. **Política de OSM/OSMF**: *"OSM contributors are asked never to add data from any
   copyrighted sources (e.g. Google Maps or printed maps) without explicit
   permission…"* y la FAQ, §2.1.5 "Can I copy data from Google?".
   <https://www.openstreetmap.org/copyright> ·
   <https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ> ·
   <https://wiki.openstreetmap.org/wiki/Import/Guidelines>

Motivo de fondo: Google Maps *es gratis como la cerveza, no como la libertad*
("free as in beer, not as in speech"); su dato está licenciado de terceros
(NAVTEQ/Tele Atlas) y usar Google para "armar" un dataset crea una **obra derivada**
sujeta a su copyright.
<https://wiki.openstreetmap.org/wiki/Project_FAQ>

**Corolario práctico**: que el usuario *vea* la cancha en Google Maps está bien;
usar Google Maps para **descubrir** que existe o para tomar su **coordenada** está
prohibido. La distinción clave: Google sirve como *pista de qué buscar* (conocimiento
propio), nunca como *fuente de datos*.

### 1.2 Qué fuentes SÍ son compatibles con la ODbL de OSM

- **Conocimiento propio / relevamiento en terreno** (survey) — la fuente preferida.
- **Ortofotos con permiso explícito**: **Bing Aerial** (permiso desde nov-2010,
  solo para *trazar* en editores OSM), Esri, Mapbox, Landsat.
  <https://wiki.openstreetmap.org/wiki/Bing_Maps>
- **Datos en dominio público** o con licencia **compatible con ODbL**
  (CC0, algunos CC-BY, PD). Ver *ODbL Compatibility*:
  <https://wiki.openstreetmap.org/wiki/Import/ODbL_Compatibility>
- **Datos abiertos de gobierno** con licencia explícita compatible. Para Mendoza ya
  existen candidatos:
  - *Canchas Deportivas* (Ciudad de Mendoza, georreferenciado):
    <https://datos.ciudaddemendoza.gob.ar/dataset/canchas-deportivas>
  - *Instituciones Deportivas* (IDE Mendoza, ArcGIS FeatureServer):
    <https://ide.mendoza.gov.ar/server/rest/services/Hosted/Instituciones_Deportivas/FeatureServer>
  - Portal provincial: <https://datosabiertos.mendoza.gov.ar/>
  **Ojo**: hay que verificar la licencia de cada dataset en el portal antes de
  importar; si dice solo "uso libre" sin licencia compatible, hay que pedir permiso
  por escrito al organismo.

### 1.3 Fuentes NO compatibles

Google Maps/Places, Mapillary sin revisar, Wikimapia, mapas impresos, cualquier
dataset "gratis" que en realidad derive de Google. Regla: *si la licencia no figura
como compatible en forma automática, no se importa sin permiso escrito.*

## 2. Rutas legítimas para que esas canchas existan en OSM

### 2.1 Edición manual (iD / JOSM) — la vía más limpia

Basada en conocimiento propio / visita al predio / ortofoto Bing. Etiquetado:

| Elemento | Tags |
|---|---|
| Cancha de fútbol | `leisure=pitch` + `sport=soccer` |
| Fútbol 5 / futsal | `sport=futsal` (o `sport=soccer;sport=futsal`) |
| Complejo con varias canchas | `leisure=sports_centre` + `sport=soccer` |
| Nombre del complejo | `name=*` (**clave**: sin `name`, Nominatim no lo encuentra por nombre) |
| Superficie | `surface=synthetic` / `grass` / `concrete` |
| Acceso | `access=yes` / `access=customers` |

Datos útiles: `addr:street`, `phone`, `website`. `source=Bing` en el *changeset*.
Lo importante para la app: **el `name` es lo que permite geocodificar** ("El Picadito"
hoy no se encuentra porque no existe ninguna feature con ese nombre en Argentina).

### 2.2 Importar un dataset compatible

Pasos obligatorios (**Import Guidelines**):
<https://wiki.openstreetmap.org/wiki/Import/Guidelines>

1. Verificar que la licencia sea compatible con ODbL (o pedir permiso por escrito).
2. Crear una **página de propuesta en el wiki** describiendo el dataset, alcance y
   método.
3. **Anunciar y consultar** a la comunidad (Argentina) antes de importar.
4. **Cuenta de usuario dedicada** para la importación.
5. **Conflation**: no duplicar features ya mapeadas; convertir el dataset al
   esquema OSM (`leisure=pitch`, `sport=soccer`, `name`).
6. Herramientas: JOSM con conflation, o `osmapi`/`osmium`. Se sube por *changeset*
   con `source=*` y `import=yes`.

### 2.3 Involucrar a la comunidad OSM de Argentina

- Wiki: <https://wiki.openstreetmap.org/wiki/ES:Argentina>
- **Telegram `@osm_ar`** (canal principal, ~470 miembros): <https://t.me/osm_ar>
- Foro comunitario, subcategoría Argentina: <https://community.openstreetmap.org/c/communities/ar>
- Lista `talk-ar` (retirada; se mantiene el archivo): <https://lists.openstreetmap.org/listinfo/talk-ar>
- Web: <https://openstreetmap.org.ar/>

### 2.4 Aclaración conceptual (importante)

Cuando el usuario dice *"todas las canchas de Google Maps"*, en la práctica quiere
decir **"descubrir qué canchas existen y que aparezcan en el mapa de la app"**. Eso
es un problema de **cobertura de datos**, no de importación desde Google. Los
caminos válidos son: (a) relevar/cargar esas canchas por medios propios, y
(b) cargarlas en la **base de la app** (ver §4). Importar de Google a OSM está
descartado.

## 3. Estado real de OSM en Mendoza (medido hoy con Overpass)

### 3.1 Niveles administrativos correctos en Argentina

⚠️ **Aclaración**: el supuesto del pedido (`admin_level 8 = departamento`) es
incorrecto. Para Argentina (<https://wiki.openstreetmap.org/wiki/Key:admin_level>,
fila "Argentina"):

| Nivel | Entidad |
|---|---|
| 4 | Provincia / CABA |
| **5** | **Departamento / partido** (ej. **Departamento Rivadavia**) |
| 6 | Distrito (Mendoza, Entre Ríos) / Pedanía (Córdoba) |
| 7 | Municipio |
| 8 | Localidad (city/town/village) |
| 9 | Barrio |

IDs verificados por Nominatim:
- Provincia de Mendoza (rel **153540**)
- Departamento Capital (rel **2204157**) → area `3602204157`
- Departamento Rivadavia (rel **2941709**) → area `3602941709`

### 3.2 Query Overpass lista para pegar en overpass-turbo

```
/* Canchas de fútbol del Departamento Rivadavia (Mendoza) */
[out:json][timeout:60];
area(3602941709)->.dep;                       /* 3600000000 + id de relación */
nwr["leisure"="pitch"]["sport"~"soccer|futsal"](area.dep);
out center tags;
```

Variante por nombre (más frágil, hay varias Rivadavia en el país):
```
area["name"="Departamento Rivadavia"]["admin_level"="5"]["boundary"="administrative"]->.dep;
nwr["leisure"="pitch"]["sport"~"soccer|futsal"](area.dep);
out center tags;
```

Para el conteo, cambiar `out center tags;` por `out count;`.
Instancia pública que respondió bien desde este entorno:
`https://overpass.openstreetmap.fr/api/interpreter` (el backend puede usar
`https://overpass-api.de/api/interpreter` como respaldo).

### 3.3 Resultados obtenidos (Overpass, snapshot 2026-11-25)

| Área | `leisure=pitch` + `sport=soccer/futsal` | Con `name` | Todos los `pitch` |
|---|---|---|---|
| **Dpto. Capital** | 29 | **0** | 149 |
| **Dpto. Rivadavia** | 18 | **1** ("Cancha de Futbol Club Bestani") | 37 |
| Provincia (bbox) | ~1042 | ~151 | — |
| "El Picadito" (toda AR) | **0** | — | — |

**Interpretación**: OSM tiene *canchas* (polígonos) pero casi ninguna **con nombre**.
Nominatim geocodifica por texto/nombre → sin `name`, una cancha de OSM es
invisible para el autocompletado de la app. Esto confirma que "cargar todo en OSM"
no resuelve el problema del usuario a corto plazo (requiere relevamiento con nombres).

### 3.4 ¿Conviene autopoblar la app desde Overpass?

Sí, **pero como semilla, no como fuente de verdad**. Un script puntual puede leer
Overpass y cargar canchas de referencia de Mendoza. **Cuidado con la licencia**: si
mezclás datos OSM en tu DB propia, esa porción queda bajo ODbL (share-alike) y hay
que atribuir. Ver §4.4. Para *seed* es más seguro usar los **datos abiertos
municipales** (CC-BY, atribución-solo).

## 4. Alternativa de ingeniería (RECOMENDADA)

**No depender de OSM para las canchas de los usuarios.** La app ya tiene lo necesario:

- `COMPLEJO(nombre, direccion, barrio, ciudad, lat, lng)` y `CANCHA` en MySQL.
- `GET /api/canchas` (`canchas.go:47-59`) ya devuelve **toda** cancha cuyo complejo
  tenga coordenadas válidas → las canchas propias ya se dibujan.
- `crear-partido.js` ya tiene **pin soltable** (`punto.marcador`, `ubicacionMarcada`,
  líneas ~461-591) que produce `lat/lng` sin pasar por el geocoder.
- `resolverComplejo` (`complejos.go:197-261`) reutiliza por nombre+dirección y, si no
  hay coords, intenta geocodificar.

El punto único de falla es: **el pin no es obligatorio y el geocoder falla**, entonces
"El Picadito" quedó con `lat/lng = NULL` y su partido muestra `sinUbicacion=true`
(`partidos.go:205-221`).

### 4.1 Estado actual de la base (medido)

- 10 complejos, **8 con coords**, 2 sin: `Barrio 9 de julio manzana i casa 18` y
  **`El Picadito`** (id 9, sin coords) — ambos con `ciudad='CABA'`.
- 7 canchas. 3 partidos, **2 sin ubicación**.
- Bug de datos detectado: complejo 10 `San Martín 61` tiene `ciudad='CABA'` pero
  coords en Mendoza (-33.14, -68.48) → el campo `ciudad` no es confiable.

### 4.2 Cambios propuestos (ruta app)

1. **Pin obligatorio al publicar** (`crear-partido.js`): si no hay `mapa.elegida` ni
   dirección geocodificada, exigir marcar el punto. Con el pin, `lat/lng` salen
   siempre de `POST /api/partidos`.
2. **Geocoder híbrido** (`geocode.go`): que `GET /api/geocode` busque **primero en la
   base propia** (`COMPLEJO`/`CANCHA` por nombre) y luego en Nominatim. Así una cancha
   ya cargada por otro usuario aparece de inmediato, sin depender de OSM.
3. **"Mi cancha no aparece"**: en Crear partido, además del pin, un alta explícita de
   complejo (`POST /api/complejos` ya existe, `complejos.go:281-338`).
4. **Moderación** (opcional Fase 4): columnas `origen` ('usuario'|'seed'|'import') y
   `verificado` en `COMPLEJO`; una vista admin para aprobar.
5. **Semilla** (Fase 3): script `cmd/seed-canchas` que carga canchas de Mendoza desde
   Overpass y/o datos abiertos municipales, con `origen='seed'`.

### 4.3 Pros/contras

| | Base propia (app) | Contribuir a OSM |
|---|---|---|
| Resuelve "El Picadito" ya | ✅ inmediato | ❌ semanas/meses |
| Control del dato | ✅ total | ❌ comunidad |
| Licencia | ✅ propia | ODbL (share-alike) |
| Beneficio público | ➖ | ✅✅ |
| Esfuerzo | Bajo (ya casi está) | Alto (relevamiento + import) |

**Conclusión**: la app **no** debe depender del geocoder para las canchas de sus
usuarios. OSM se usa como **mapa de fondo** (ya se hace, con atribución correcta en
`mapa-base.js:124`) y como mejora comunitaria opcional.

### 4.4 Nota de licencia al mezclar

Si se importan datos OSM a la DB de la app, esa porción es **Derivative Database**
bajo ODbL → obligación de **atribuir** y **compartir igual**. Alternativa más simple:
importar a OSM (ruta OSM) y que la app consuma OSM vía Nominatim/Overpass con solo
atribución; o sembrar la DB con datos **CC-BY municipales** (atribución-solo, sin
share-alike), más seguros para mezclar.

## 5. Plan de implementación por fases

### Si el usuario elige la RUTA APP (recomendada)

**Fase 0 — Diagnóstico (0.5 d)**
- Correr las queries Overpass de §3.2 y volcar conteos.
- Verificar en la DB: `SELECT id_complejo,nombre,lat,lng,ciudad FROM COMPLEJO WHERE lat IS NULL OR lng IS NULL;`
- Verificación: listado de complejos sin coords.

**Fase 1 — Pin obligatorio + alta de cancha (1-2 d)**
- `Front/js/crear-partido.js`: exigir punto en `validar()`; el pin ya existe.
- `Front/crear-partido.html`/CSS: mensaje "Marcá la cancha en el mapa si no aparece".
- `backend-go/internal/api/complejos.go`: `resolverComplejo` ya cubre el alta.
- Riesgo: usuarios sin GPS; mitigar con el mapa centrado en su `localidad`.
- Verificación: publicar un partido en "El Picadito" y ver que aparece en el mapa.

**Fase 2 — Geocoder híbrido (1 d)**
- `backend-go/internal/api/geocode.go`: consultar primero la DB propia por nombre.
- `backend-go/internal/api/canchas.go`: endpoint/consulta de búsqueda por texto.
- Verificación: buscar "El Picadito" tras cargarlo → aparece sin OSM.

**Fase 3 — Semilla de Mendoza (1-2 d)**
- Nuevo `backend-go/cmd/seed-canchas/main.go` (script, no corre en el server).
- Fuente A: Overpass (§3.2). Fuente B (preferida por licencia): datos abiertos
  municipales (Capital) y provinciales (Rivadavia si existen).
- Migración `009_complejo_origen.sql`: `ADD COLUMN origen VARCHAR(20)`,
  `verificado TINYINT(1)` (runner: `database.go`, un `.sql` por archivo).
- Verificación: `SELECT COUNT(*) FROM COMPLEJO WHERE origen='seed';` y que se vean
  en `GET /api/canchas`.

**Fase 4 — Moderación (opcional)**
- Vista admin (`Front/js/administrar-partido.js` como referencia) para aprobar altas.

**Paso de verificación general**
- Backend: `go build ./...`, `go test ./...`.
- Front: probar Buscar y Crear partido en local (`FRONT_DIR`, `AUTO_MIGRATE=true`).

**Riesgos (ruta app)**: duplicados por nombre/dirección (mitigar con el `resolverComplejo`
existente); `ciudad` poco confiable (derivar de coords con reverse-geocode o de
`localidad` del perfil); mezcla de licencias si se siembra desde OSM (§4.4).

### Si el usuario elige la RUTA OSM (checklist operativo)

1. [ ] Crear cuenta OSM y **confirmar** el email; activar 2FA.
2. [ ] Unirse a la comunidad: Telegram `@osm_ar` y foro `communities/ar`.
3. [ ] Relevar en terreno / con **Bing Aerial** las canchas (nombre, deporte, superficie).
4. [ ] Editar en **iD** (web) o **JOSM**; tag `leisure=pitch` + `sport=soccer` + `name`.
5. [ ] *(Solo si se importa)* seguir **Import Guidelines**: página de propuesta en el
   wiki, aviso a la comunidad, cuenta dedicada, conflation.
6. [ ] Verificar con Overpass (§3.2) que las canchas quedaron:
   `nwr["leisure"="pitch"]["sport"~"soccer|futsal"]["name"](area(3602941709));out center;`
7. [ ] Esperar la actualización de Nominatim (días) y probar `GET /api/geocode?q=El Picadito`.
8. [ ] **Sin cuenta dedicada ni propuesta**: no importar; solo edición manual legítima.

## 6. Fuentes

- OSM Import Guidelines — <https://wiki.openstreetmap.org/wiki/Import/Guidelines>
- OSMF Licence & Legal FAQ — <https://osmfoundation.org/wiki/Licence/Licence_and_Legal_FAQ>
- OSM Copyright — <https://www.openstreetmap.org/copyright>
- OSM Project FAQ (Google) — <https://wiki.openstreetmap.org/wiki/Project_FAQ>
- ODbL Compatibility — <https://wiki.openstreetmap.org/wiki/Import/ODbL_Compatibility>
- Bing Maps (permiso de trazado) — <https://wiki.openstreetmap.org/wiki/Bing_Maps>
- Google Maps Platform ToS — <https://cloud.google.com/maps-platform/terms>
- Google Maps Additional ToS — <https://www.google.com/help/terms_maps/>
- admin_level (Argentina) — <https://wiki.openstreetmap.org/wiki/Key:admin_level>
- Comunidad OSM Argentina — <https://wiki.openstreetmap.org/wiki/ES:Argentina>
- Datos abiertos Ciudad de Mendoza (Canchas Deportivas) —
  <https://datos.ciudaddemendoza.gob.ar/dataset/canchas-deportivas>
- IDE Mendoza (Instituciones Deportivas) —
  <https://ide.mendoza.gov.ar/server/rest/services/Hosted/Instituciones_Deportivas/FeatureServer>
