/* =========================================================
   mapa-base.js — capa común del mapa

   Carga Leaflet (y, si hace falta, markercluster) desde el CDN,
   dibuja los tiles, define el centro por defecto y pide la
   geolocalización al navegador.

   Todo es gratis y sin clave: los tiles salen de CARTO sobre
   OpenStreetMap y la dirección la resuelve el back con
   GET /api/geocode. No hay que cargar ninguna API key.

   Lo usan js/mapa-zona.js (pantalla Buscar) y js/crear-partido.js
   (marcador para fijar la ubicación de la cancha).
   ========================================================= */

const MapaBase = (() => {
  // Centro por defecto: el mismo que usa el back (LatPorDefecto /
  // LngPorDefecto en internal/api/helpers.go).
  const CENTRO = { lat: -34.6037, lng: -58.3816 };
  const ZOOM = 13;

  const CDN = {
    css: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css",
    js: "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js",
    clusterCss: [
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css",
      "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css"
    ],
    clusterJs: "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js"
  };

  let promesaLeaflet = null;
  let promesaCluster = null;
  let promesaUbicacion = null;
  const pedidos = new Map(); // src -> resuelto

  /* ---------- Carga de Leaflet ---------- */
  function hoja(href) {
    if (document.querySelector(`link[href="${href}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }

  function script(src, listo) {
    if (pedidos.get(src)) return Promise.resolve();

    return new Promise((ok, mal) => {
      const listoOk = () => !listo || listo();
      const fallo = () => mal(new Error(`No pude cargar ${src}`));
      const resolver = () => {
        // El "load" llegó pero no trajo lo que esperábamos
        if (!listoOk()) {
          fallo();
          return;
        }
        pedidos.set(src, true);
        ok();
      };

      // Si el tag ya está en la página (o se pidió antes), no
      // esperamos un "load" que ya pasó: miramos si está listo.
      const viejo = document.querySelector(`script[src="${src}"]`);
      if (viejo) {
        if (listoOk()) {
          resolver();
          return;
        }
        viejo.addEventListener("load", resolver);
        viejo.addEventListener("error", fallo);
        return;
      }

      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolver;
      s.onerror = fallo;
      document.head.appendChild(s);
    });
  }

  function cargarLeaflet() {
    if (!promesaLeaflet) {
      promesaLeaflet = (async () => {
        hoja(CDN.css);
        await script(CDN.js, () => Boolean(window.L && window.L.map));
      })();
    }
    return promesaLeaflet;
  }

  function cargarCluster() {
    if (!promesaCluster) {
      promesaCluster = (async () => {
        await cargarLeaflet();
        CDN.clusterCss.forEach(hoja);
        await script(CDN.clusterJs, () => Boolean(window.L && window.L.MarkerClusterGroup));
      })();
    }
    return promesaCluster;
  }

  // Devuelve una promesa que se resuelve cuando hay window.L.
  // { cluster: true } suma markercluster, para agrupar puntos.
  function cargar({ cluster = false } = {}) {
    return cluster ? cargarCluster() : cargarLeaflet();
  }

  /* ---------- Mapa ---------- */
  function crear(contenedor, { zoom = ZOOM } = {}) {
    const mapa = L.map(contenedor, {
      center: [CENTRO.lat, CENTRO.lng],
      zoom,
      zoomSnap: 0.5,
      attributionControl: true
    });

    // Tiles de OpenStreetMap: gratis, sin clave y con las
    // etiquetas encima. El filtro CSS de buscar.css /
    // crear-partido.css los pasa al tema oscuro.
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19
    }).addTo(mapa);

    return mapa;
  }

  /* ---------- Punto de partida ---------- */

  // GPS con fallback a CABA. Se pide una sola vez por pantalla y
  // se cachea: si el usuario no da permiso (o el navegador no
  // tiene geolocalización) se resuelve con el centro por defecto
  // y la pantalla no se queda esperando.
  function ubicacion() {
    if (!promesaUbicacion) {
      promesaUbicacion = new Promise((resolver) => {
        if (!navigator.geolocation) {
          resolver({ ...CENTRO, origen: "default" });
          return;
        }

        let listo = false;
        const fin = (valor) => {
          if (listo) return;
          listo = true;
          resolver(valor);
        };

        navigator.geolocation.getCurrentPosition(
          (pos) =>
            fin({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              origen: "gps"
            }),
          () => fin({ ...CENTRO, origen: "default" }),
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 }
        );

        // Algunos navegadores ignoran `timeout`: no dejamos la
        // pantalla colgada esperando una respuesta que no llega.
        setTimeout(() => fin({ ...CENTRO, origen: "default" }), 8000);
      });
    }
    return promesaUbicacion;
  }

  /* ---------- Geocodificación (respaldo por ciudad) ---------- */

  // Convierte un texto (por ejemplo la localidad del perfil: "Mendoza")
  // en coordenadas usando el buscador gratuito del backend. Devuelve
  // null si no se pudo resolver.
  async function geocodificar(texto) {
    const t = String(texto || "").trim();
    if (t.length < 3 || typeof API === "undefined") return null;
    try {
      const items = await API.get(`/api/geocode?q=${encodeURIComponent(t)}`);
      const elegido = typeof Geo !== "undefined" ? Geo.ciudad(items) : items[0];
      if (elegido) return { lat: elegido.lat, lng: elegido.lng };
    } catch {
      /* sin respaldo: se usa el centro por defecto */
    }
    return null;
  }

  // Punto de partida del mapa: la ubicación real del usuario y, si el
  // navegador no la da (permiso denegado, sin GPS, timeout), la ciudad
  // de su perfil. Recién si tampoco hay ciudad caemos a CABA.
  async function puntoInicial(ciudadRespaldo) {
    const gps = await ubicacion();
    if (gps.origen === "gps") return gps;
    const ciudad = await geocodificar(ciudadRespaldo);
    if (ciudad) return { ...ciudad, origen: "perfil" };
    return gps;
  }

  /* ---------- Botón "mi ubicación" ---------- */
  const ICONO_UBICAR =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" ' +
    'stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="3.2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>' +
    '<circle cx="12" cy="12" r="7.5"/></svg>';

  // Agrega al mapa un botón para volver a pedir la ubicación y recentrar.
  // Sirve cuando el navegador no la dio al abrir: acá hay un gesto del
  // usuario, así puede volver a preguntar. `alEncontrar(punto)` recibe
  // las coordenadas cuando las consigue.
  function controlUbicacion(mapa, alEncontrar) {
    if (!mapa || !navigator.geolocation || typeof L === "undefined") return;

    const Ctl = L.Control.extend({
      onAdd() {
        const caja = L.DomUtil.create("div", "leaflet-bar mapa-ubicar");
        const btn = L.DomUtil.create("button", "mapa-ubicar__btn", caja);
        btn.type = "button";
        btn.title = "Centrar en mi ubicación";
        btn.setAttribute("aria-label", "Centrar en mi ubicación");
        btn.innerHTML = ICONO_UBICAR;

        L.DomEvent.disableClickPropagation(caja);
        L.DomEvent.on(btn, "click", () => {
          btn.classList.add("is-buscando");
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              btn.classList.remove("is-buscando", "is-fallo");
              alEncontrar?.({
                lat: pos.coords.latitude,
                lng: pos.coords.longitude,
                origen: "gps"
              });
            },
            () => {
              btn.classList.remove("is-buscando");
              btn.classList.add("is-fallo");
              setTimeout(() => btn.classList.remove("is-fallo"), 2600);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
          );
        });
        return caja;
      }
    });
    new Ctl({ position: "topleft" }).addTo(mapa);
  }

  return {
    CENTRO,
    ZOOM,
    cargar,
    crear,
    ubicacion,
    geocodificar,
    puntoInicial,
    controlUbicacion
  };
})();
