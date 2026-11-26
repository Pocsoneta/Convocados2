/* =========================================================
   mapa-zona.js — mapa real de la pantalla Buscar

   Reemplaza la vista previa decorativa por un mapa de
   OpenStreetMap (Leaflet) sin cambiar la interfaz que ya usa
   buscar.js:

     MapaZona.iniciar(contenedor, {
       alSeleccionar(id),        // tocar el punto lleva a la fila de la lista
       alResaltar(id|null),
       alIrAlPartido(id)         // "Ir al partido" desde el popup (si hay partido)
     })
     MapaZona.canchas(lista)     // GET /api/canchas (una vez por pantalla)
     MapaZona.mostrar(partidos)  // GET /api/partidos (en cada búsqueda)
     MapaZona.resaltar(id|null)
     MapaZona.ubicacion()        // Promise con el punto de partida

   Qué dibuja
   ----------
   Un punto por LUGAR: el lugar es el punto exacto donde están
   las canchas (y los partidos) de una misma dirección. Las
   canchas y los partidos del mismo complejo llegan con la
   misma coordenada, así que se juntan solos.

   - Si el lugar tiene partidos, el punto lleva el número de la
     lista, para seguir pudiendo tocarlo y que se resalte la
     fila correspondiente.
   - Si solo tiene canchas, lleva el ícono de cancha.

   Los lugares que caen juntos se agrupan en un solo punto con
   el conteo: al tocarlo el mapa acerca y reparte los que había
   ahí (y los abre en rueda si siguen encimados).

   Un partido sin coordenadas (su complejo se cargó a mano y
   nunca se pudo geolocalizar) no entra al mapa: se sigue viendo
   en la lista. El back manda 0 en ese caso, no una coordenada
   válida.
   ========================================================= */

const MapaZona = (() => {
  let contenedor = null;
  let eventos = {};
  let mapa = null;
  let grupo = null;
  let datos = { canchas: [], partidos: [] };
  let lugares = new Map();
  let activo = null;

  /* ---------- Utilidades ---------- */
  const ubicable = (lat, lng) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  // 5 decimales ≈ 1,1 m: alcanza para juntar lo que está en el
  // mismo lugar sin mezclar direcciones distintas.
  const clave = (lat, lng) => (ubicable(lat, lng) ? `${lat.toFixed(5)},${lng.toFixed(5)}` : null);

  const dos = (n) => String(n).padStart(2, "0");

  // "24/11 21:00" — la fecha exacta ya está en la lista.
  function fechaCorta(iso) {
    const f = new Date(iso);
    if (Number.isNaN(+f)) return "";
    return `${dos(f.getDate())}/${dos(f.getMonth() + 1)} ${dos(f.getHours())}:${dos(f.getMinutes())}`;
  }

  /* ---------- Armado ---------- */
  function iniciar(el, opciones = {}) {
    contenedor = el;
    eventos = opciones;
    if (!contenedor) return;

    MapaBase.cargar({ cluster: true })
      .then(arrancar)
      .catch(() =>
        aviso("No pudimos cargar el mapa. Los partidos se siguen viendo en la lista.")
      );
  }

  let promesaPunto = null;

  // Punto de partida del mapa: GPS → ciudad del perfil → CABA. Se
  // calcula una sola vez y lo comparten el mapa y la pantalla que lo
  // usa (para medir distancias desde el mismo lugar).
  function puntoPartida() {
    if (!promesaPunto) promesaPunto = MapaBase.puntoInicial(eventos.respaldo);
    return promesaPunto;
  }

  async function arrancar() {
    mapa = MapaBase.crear(contenedor, { zoom: 12 });

    grupo = L.markerClusterGroup({
      maxClusterRadius: 48,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.4,
      iconCreateFunction: (cluster) =>
        L.divIcon({
          html: `<span>${cluster.getChildCount()}</span>`,
          className: "pin-agrupado",
          iconSize: [46, 46],
          iconAnchor: [23, 23]
        })
    });
    grupo.on("animationend", aplicarResaltado);
    mapa.addLayer(grupo);

    // Primero el punto de partida y recién después los datos,
    // para no centrar el mapa dos veces.
    const donde = await puntoPartida();
    mapa.setView([donde.lat, donde.lng], donde.origen === "gps" ? 14 : 12);

    // Botón para volver a pedir la ubicación: si el navegador no la dio
    // al abrir, acá el usuario puede reintentar y recentrar el mapa.
    MapaBase.controlUbicacion(mapa, (p) => {
      mapa.setView([p.lat, p.lng], 15);
      eventos.alUbicar?.(p);
    });

    pintar();
  }

  function aviso(texto) {
    if (!contenedor) return;
    const p = document.createElement("p");
    p.className = "mapa-fallo";
    p.textContent = texto;
    contenedor.replaceChildren(p);
  }

  /* ---------- Datos ---------- */
  function canchas(lista) {
    datos.canchas = Array.isArray(lista) ? lista : [];
    pintar();
  }

  function mostrar(partidos) {
    datos.partidos = Array.isArray(partidos) ? partidos : [];
    pintar();
  }

  function ubicacion() {
    return puntoPartida();
  }

  // Centro y radio (km) de lo que se está viendo. Lo usa el botón
  // "Buscar en esta zona" para pedir lo que hay en el mapa y no en
  // toda la ciudad.
  function zona() {
    if (!mapa) return { ...MapaBase.CENTRO, radio: 0 };
    const c = mapa.getCenter();
    const ne = mapa.getBounds().getNorthEast();
    return { lat: c.lat, lng: c.lng, radio: kmEntre(c.lat, c.lng, ne.lat, ne.lng) };
  }

  // Distancia en línea recta (haversine), igual que distKm en el back.
  function kmEntre(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLng = (lng2 - lng1) * rad;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function lugarDe(lat, lng) {
    const k = clave(lat, lng);
    if (!k) return null;
    let lugar = lugares.get(k);
    if (!lugar) {
      lugar = {
        lat,
        lng,
        nombre: "",
        direccion: "",
        zona: "",
        canchas: [],
        partidos: [],
        num: 0
      };
      lugares.set(k, lugar);
    }
    return lugar;
  }

  function pintar() {
    if (!grupo) return; // todavía no cargó Leaflet: los datos quedan guardados

    grupo.clearLayers();
    lugares = new Map();

    datos.canchas.forEach((c) => {
      const l = lugarDe(c.lat, c.lng);
      if (!l) return;
      l.canchas.push(c);
      if (!l.nombre) l.nombre = c.complejo || c.nombre || "";
      if (!l.direccion) l.direccion = c.direccion || "";
      if (!l.zona) l.zona = c.zona || "";
    });

    datos.partidos.forEach((p, i) => {
      const l = lugarDe(p.lat, p.lng);
      if (!l) return;
      l.partidos.push(p);
      if (!l.num) l.num = i + 1; // el número de la lista
      if (!l.nombre) l.nombre = p.nombre || "";
      if (!l.direccion) l.direccion = p.direccion || "";
      if (!l.zona) l.zona = p.zona || "";
    });

    for (const lugar of lugares.values()) grupo.addLayer(marcar(lugar));
    aplicarResaltado();
  }

  /* ---------- Punto ---------- */
  function marcar(lugar) {
    const conPartidos = lugar.partidos.length > 0;

    const icono = L.divIcon({
      className: "pin-lugar",
      html: conPartidos
        ? `<span class="pin-lugar__num">${lugar.num}</span>`
        : '<span class="pin-lugar__punto"></span>',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      popupAnchor: [0, -15]
    });

    const m = L.marker([lugar.lat, lugar.lng], {
      icon: icono,
      title: lugar.nombre || "Cancha",
      riseOnHover: true
    });
    m.lugar = lugar;

    m.bindPopup(popup(lugar), { minWidth: 220, maxWidth: 300 });

    // Tocar el punto sigue llevando a la fila de la lista.
    m.on("click", () => {
      if (lugar.partidos.length) eventos.alSeleccionar?.(lugar.partidos[0].id);
    });
    m.on("mouseover", () => {
      if (lugar.partidos.length) eventos.alResaltar?.(lugar.partidos[0].id);
    });
    m.on("mouseout", () => eventos.alResaltar?.(null));

    // El punto se dibuja y se borra según el zoom (los agrupados
    // no tienen ícono): al volver a aparecer, vuelve su marca.
    m.on("add", () => {
      const el = m.getElement();
      if (el) el.classList.toggle("is-active", estaMarcado(m));
    });

    return m;
  }

  /* ---------- Popup ---------- */
  const etiqueta = (texto) => {
    const p = document.createElement("p");
    p.className = "pop__label";
    p.textContent = texto;
    return p;
  };

  function popup(lugar) {
    const caja = document.createElement("div");
    caja.className = "pop";

    const titulo = document.createElement("p");
    titulo.className = "pop__titulo";
    titulo.textContent = lugar.nombre || "Cancha";
    caja.appendChild(titulo);

    const pie = [lugar.direccion, lugar.zona].filter(Boolean).join(" · ");
    if (pie) {
      const p = document.createElement("p");
      p.className = "pop__pie";
      p.textContent = pie;
      caja.appendChild(p);
    }

    if (lugar.canchas.length) {
      const bloque = document.createElement("div");
      bloque.className = "pop__bloque";
      bloque.appendChild(etiqueta(lugar.canchas.length === 1 ? "Cancha" : "Canchas"));

      const ul = document.createElement("ul");
      ul.className = "pop__lista";
      lugar.canchas.forEach((c) => {
        const li = document.createElement("li");
        li.textContent = [c.nombre, c.tipoCancha, c.tipoSuelo].filter(Boolean).join(" · ");
        ul.appendChild(li);
      });

      bloque.appendChild(ul);
      caja.appendChild(bloque);
    }

    if (lugar.partidos.length) {
      const bloque = document.createElement("div");
      bloque.className = "pop__bloque";
      bloque.appendChild(
        etiqueta(lugar.partidos.length === 1 ? "Partido" : "Partidos")
      );

      const ul = document.createElement("ul");
      ul.className = "pop__lista";
      lugar.partidos.forEach((p) => {
        const li = document.createElement("li");
        li.className = "pop__fila";

        const texto = document.createElement("span");
        texto.textContent = [
          p.modalidad,
          fechaCorta(p.fecha),
          p.cupos > 0 ? `${p.cupos} cupos` : "Completo"
        ]
          .filter(Boolean)
          .join(" · ");

        // Si hay un partido en esta cancha, el popup ofrece entrar
        // directo a su ficha. Si la pantalla no pasó el callback,
        // cae al comportamiento anterior (resaltar la fila).
        const ir = document.createElement("button");
        ir.type = "button";
        ir.className = "pop__btn pop__btn--ir";
        ir.textContent = "Ir al partido";
        // Cada partido del lugar necesita un nombre accesible distinto.
        ir.setAttribute("aria-label", `Ir al partido: ${[p.modalidad, fechaCorta(p.fecha)].filter(Boolean).join(" ")}`);
        ir.addEventListener("click", () => {
          if (typeof eventos.alIrAlPartido === "function") eventos.alIrAlPartido(p.id);
          else eventos.alSeleccionar?.(p.id);
        });

        li.append(texto, ir);
        ul.appendChild(li);
      });

      bloque.appendChild(ul);
      caja.appendChild(bloque);
    }

    return caja;
  }

  /* ---------- Resaltado lista ↔ mapa ---------- */
  const estaMarcado = (m) =>
    activo !== null &&
    m.lugar.partidos.some((p) => String(p.id) === activo);

  function resaltar(id) {
    activo = id == null ? null : String(id);
    aplicarResaltado();
  }

  function aplicarResaltado() {
    if (!grupo) return;
    grupo.getLayers().forEach((m) => {
      const el = m.getElement();
      if (el) el.classList.toggle("is-active", estaMarcado(m));
    });
  }

  return { iniciar, canchas, mostrar, resaltar, ubicacion, zona };
})();
