/* =========================================================
   crear-partido.js — lógica de esta pantalla (solo front)

   - El resumen de la derecha se arma en vivo con lo que se
     va completando.
   - "Publicar partido" valida, lo envía al backend (POST
     /api/partidos) y abre la ventana de "Partido confirmado".

   La seña (30 %) y su aprobación están SIMULADAS: no hay
   integración de pago todavía.
   ========================================================= */

(() => {
  if (!Auth.requerir()) return;

  const $ = (id) => document.getElementById(id);

  const PORCENTAJE_SENA = 0.3;
  const MAX_JUGADORES_GENERAL = 21;

  // jugadoresTotales: todos los jugadores de la modalidad, organizador incluido.
  // Sin equipo armado, el organizador busca a todos los demás.
  const MODALIDADES = {
    "futbol-5": { nombre: "Fútbol 5", jugadoresTotales: 10 },
    "futbol-7": { nombre: "Fútbol 7", jugadoresTotales: 14 },
    "futbol-8": { nombre: "Fútbol 8", jugadoresTotales: 16 },
    "futbol-11": { nombre: "Fútbol 11", jugadoresTotales: 22 }
  };

  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
    "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

  const dos = (n) => String(n).padStart(2, "0");
  const claveFecha = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const desdeClave = (s) => {
    const [a, m, d] = s.split("-").map(Number);
    return new Date(a, m - 1, d);
  };

  /* ---------- Elementos ---------- */
  const form = $("form-partido");
  const el = {
    fecha: $("fecha"),
    hora: $("hora"),
    precio: $("precio"),
    ubicacion: $("ubicacion"),
    detalle: $("detalle"),
    jugadores: $("jugadores"),
    menos: $("jug-menos"),
    mas: $("jug-mas"),
    calendario: $("abrir-calendario"),
    publicar: $("btn-publicar"),
    errorGeneral: $("error-general")
  };

  const campos = {
    modalidad: { grupo: $("field-modalidad"), error: $("error-modalidad") },
    fecha: { grupo: $("field-fecha"), error: $("error-fecha") },
    hora: { grupo: $("field-hora"), error: $("error-hora") },
    jugadores: { grupo: $("field-jugadores"), error: $("error-jugadores") },
    precio: { grupo: $("field-precio"), error: $("error-precio") },
    ubicacion: { grupo: $("field-ubicacion"), error: $("error-ubicacion") },
    equipo: { grupo: $("field-equipo"), error: $("error-equipo") }
  };

  let jugadores = 1;

  /* =======================================================
     Equipo del partido (opcional)

     Se carga desde GET /api/equipos/mis-equipos. Si se elige
     uno, se envía idEquipo en el POST /api/partidos y el
     equipo queda inscripto (ocupa cupos por integrante).
     ======================================================= */
  let misEquipos = [];

  const equipoElegido = () => {
    const marcado = form.querySelector('input[name="equipo"]:checked');
    if (!marcado || !marcado.value) return null;
    return misEquipos.find((eq) => String(eq.id) === marcado.value) || null;
  };

  function pintarEquipos() {
    const cont = $("chips-equipo");
    cont.replaceChildren();

    // Primera opción: publicar sin equipo (como hasta ahora)
    const opciones = [{ id: 0, nombre: "Sin equipo", integrantes: 0 }, ...misEquipos];

    opciones.forEach((eq, i) => {
      const label = document.createElement("label");
      label.className = "chip";

      const input = document.createElement("input");
      input.className = "chip__input";
      input.type = "radio";
      input.name = "equipo";
      input.value = String(eq.id);
      if (i === 0) input.checked = true;

      const texto = document.createElement("span");
      texto.className = "chip__label";
      texto.textContent = eq.id
        ? `${eq.nombre} · ${eq.integrantes} ${eq.integrantes === 1 ? "integrante" : "integrantes"}`
        : "Sin equipo";

      label.append(input, texto);
      cont.appendChild(label);
    });

    // Sin equipos: invitamos a crear uno desde el menú Equipo
    const hint = document.querySelector("#field-equipo .field__hint");
    if (hint) {
      hint.innerHTML = misEquipos.length
        ? "Si elegís un equipo, queda inscripto en el partido y ocupa un cupo por cada integrante " +
          "(vos, como organizador, no ocupás cupo)."
        : 'Todavía no tenés equipos. <a class="link-green" href="equipos.html">Creá uno</a> ' +
          "y volvé a publicar tu partido.";
    }
  }

  async function cargarEquipos() {
    try {
      misEquipos = await API.get("/api/equipos/mis-equipos");
    } catch {
      misEquipos = [];
    }
    pintarEquipos();
    renderResumen();
  }

  /* ---------- Opciones de hora (cada 30 minutos) ---------- */
  for (let h = 6; h <= 23; h++) {
    for (const m of [0, 30]) {
      const valor = `${dos(h)}:${dos(m)}`;
      const op = document.createElement("option");
      op.value = valor;
      op.textContent = `${valor} hs`;
      el.hora.appendChild(op);
    }
  }

  /* ---------- Fecha ---------- */
  const hoy = new Date();
  const hoyDia = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  el.fecha.min = claveFecha(hoy);

  el.calendario.addEventListener("click", () => {
    if (typeof el.fecha.showPicker === "function") {
      try { el.fecha.showPicker(); return; } catch { /* cae al foco */ }
    }
    el.fecha.focus();
  });

  /* ---------- Precio de la cancha ---------- */
  const leerPrecio = () => {
    const digitos = el.precio.value.replace(/\D/g, "");
    return digitos ? Number(digitos) : null;
  };
  const formatoPesos = (n) => "$" + n.toLocaleString("es-AR");

  el.precio.addEventListener("input", () => {
    el.precio.value = el.precio.value.replace(/[^\d$.\s]/g, "");
  });
  el.precio.addEventListener("blur", () => {
    const n = leerPrecio();
    el.precio.value = n === null ? "" : formatoPesos(n);
  });

  /* ---------- Jugadores faltantes ---------- */
  const modalidadActual = () => form.elements["modalidad"].value;
  // Lo máximo que se puede buscar: la modalidad menos el organizador
  const tope = () => (MODALIDADES[modalidadActual()]?.jugadoresTotales - 1) || MAX_JUGADORES_GENERAL;

  function pintarJugadores() {
    jugadores = Math.min(Math.max(jugadores, 1), tope());
    el.jugadores.textContent = jugadores;
    el.menos.disabled = jugadores <= 1;
    el.mas.disabled = jugadores >= tope();
  }

  el.menos.addEventListener("click", () => { jugadores -= 1; pintarJugadores(); renderResumen(); });
  el.mas.addEventListener("click", () => { jugadores += 1; pintarJugadores(); renderResumen(); });

  /* ---------- Lectura del formulario ---------- */
  function leer() {
    return {
      modalidad: modalidadActual(),
      fecha: el.fecha.value,
      hora: el.hora.value,
      jugadores,
      precio: leerPrecio(),
      ubicacion: el.ubicacion.value.trim(),
      detalle: el.detalle.value.trim(),
      equipo: equipoElegido()
    };
  }

  /* =======================================================
     Resumen en vivo
     ======================================================= */
  function etiquetaDia(fechaISO) {
    const d = desdeClave(fechaISO);
    if (Number.isNaN(d.getTime())) return "";

    const dif = Math.round((d - hoyDia) / 86400000);
    const nombre = dif === 0 ? "Hoy" : dif === 1 ? "Mañana" : DIAS[d.getDay()];
    return `${nombre}, ${d.getDate()} de ${MESES[d.getMonth()]}`;
  }

  // Cuántos de los datos obligatorios ya están completos
  function porcentaje(v) {
    const completos = [
      Boolean(v.modalidad),
      Boolean(v.fecha),
      Boolean(v.hora),
      v.jugadores >= 1,
      v.precio !== null && v.precio > 0,
      tieneCoords()
    ];
    return Math.round((completos.filter(Boolean).length / completos.length) * 100);
  }

  // "Nombre, dirección…" → { nombre, direccion }
  function partirUbicacion(texto) {
    const [nombre, ...resto] = texto.split(",");
    return { nombre: nombre.trim(), direccion: resto.join(",").trim() };
  }

  /* =======================================================
     Ubicación de la cancha

     Hay dos caminos de autocompletado, y el back decide cuál:
       - Si hay MAPS_API_KEY, se carga Google Places y el
         campo se autocompleta con su API.
       - Si no hay (o el script no carga), se usa el buscador
         gratuito de OpenStreetMap vía GET /api/geocode, sin
         clave ni tarjeta.
     En los dos casos se guardan lat/lng al publicar. Y si el
     lugar no figura en ninguno (cancha de barrio), el mapa de
     abajo deja marcar el punto a mano. Si ninguna vía está
     disponible, la dirección se escribe a mano.
     ======================================================= */
  const mapa = {
    elegida: null,
    conGoogle: false,
    cargandoGoogle: false,
    pinAbierto: false,     // ¿está desplegado el mapa con el pin?
    googleAbierto: false,  // ¿se ve la vista previa de Google?
    googleTexto: ""        // texto del último iframe mostrado
  };

  // Canchas ya guardadas en la app (GET /api/canchas). Cumplen dos
  // funciones: sugerirlas mientras se escribe y dibujarlas en el mapa
  // del pin, para que el usuario elija una en vez de marcarla a mano.
  const canchas = { guardadas: [], cargadas: false, capa: null };

  // Sin acentos ni mayúsculas, para comparar "PICADITO" con "Picadito".
  const normalizar = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

  // Leaflet mete los strings como HTML (innerHTML). Los nombres vienen de
  // la base y los escribió otro usuario, así que para mostrarlos usamos un
  // nodo de texto: queda escapado y no se puede inyectar nada.
  const nombreNodo = (texto) => {
    const span = document.createElement("span");
    span.textContent = String(texto || "");
    return span;
  };

  // ¿Es un par de coordenadas real (ni 0,0 ni fuera de rango)? Mismo
  // criterio que el back (tieneUbicacion) y el mapa de Buscar.
  const ubicable = (lat, lng) =>
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180;

  // Une partes de una ubicación sin repetir lo que ya está contenido en
  // otra ("Palmira / San Martín, Mendoza" + "San Martín, Mendoza").
  function unirUbicacion(...partes) {
    const salida = [];
    const vistos = [];
    for (const p of partes) {
      const t = String(p || "").trim();
      if (!t) continue;
      const n = normalizar(t);
      if (vistos.some((v) => v.includes(n) || n.includes(v))) continue;
      salida.push(t);
      vistos.push(n);
    }
    return salida.join(" · ");
  }

  // Convierte una cancha guardada en una sugerencia del buscador.
  const itemDeCancha = (c) => ({
    titulo: c.complejo || c.nombre || "Cancha",
    subtitulo: unirUbicacion(c.direccion, c.zona),
    lat: c.lat,
    lng: c.lng,
    idComplejo: c.idComplejo,
    guardada: true
  });

  // Canchas guardadas cuyo nombre/dirección/zona contienen todo lo que
  // el usuario escribió (sin importar mayúsculas ni acentos). Un complejo
  // con varias canchas aparece una sola vez (dedup por idComplejo).
  function canchasQueCoinciden(texto) {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    if (!palabras.length) return [];
    const vistos = new Set();
    return canchas.guardadas
      .filter((c) => {
        const heno = normalizar(
          [c.complejo, c.nombre, c.direccion, c.zona].filter(Boolean).join(" ")
        );
        if (!palabras.every((p) => heno.includes(p))) return false;
        const idComplejo = c.idComplejo || c.id;
        if (vistos.has(idComplejo)) return false;
        vistos.add(idComplejo);
        return true;
      })
      .slice(0, 6);
  }

  // Se piden una sola vez al abrir la pantalla (el back devuelve las que
  // tienen coordenadas, más cercanas primero).
  async function cargarCanchasGuardadas() {
    try {
      const lista = await API.get("/api/canchas?limit=1000");
      canchas.guardadas = Array.isArray(lista) ? lista : [];
    } catch {
      canchas.guardadas = [];
    }
    canchas.cargadas = true;
    pintarCanchasEnMapa();
    // Si el usuario ya venía escribiendo, repetimos la búsqueda para que
    // aparezcan las canchas guardadas que coincidan.
    if (el.ubicacion.value.trim().length >= 4) programarBusqueda();
  }

  // ¿Hay coordenadas válidas para publicar? Salen de una sugerencia
  // elegida en el buscador o del pin que el usuario suelta en el mapa.
  const tieneCoords = () => Boolean(mapa.elegida && ubicable(mapa.elegida.lat, mapa.elegida.lng));

  function pintarAyuda(texto) {
    const hint = $("hint-ubicacion");
    if (!hint) return;
    hint.hidden = false;
    hint.textContent = texto;
  }

  // El usuario eligió un lugar: tomamos su nombre,
  // su dirección y sus coordenadas.
  function ubicacionElegida(lugar) {
    el.ubicacion.value = [lugar.nombre, lugar.direccion].filter(Boolean).join(", ");
    mapa.elegida = lugar;
    setError("ubicacion", "");
    ocultarVistaGoogle(); // ya la encontramos: la vista previa no hace falta
    ubicarMarcador(lugar.lat, lugar.lng); // el punto viaja con la sugerencia
    renderResumen();
  }

  function activarAutocomplete() {
    if (!window.google || !google.maps || !google.maps.places) return;

    const ac = new google.maps.places.Autocomplete(el.ubicacion, {
      types: ["geocode"],
      fields: ["name", "formatted_address", "geometry"]
    });
    ac.addListener("place_changed", () => {
      const p = ac.getPlace();
      if (!p || !p.geometry || !p.geometry.location) {
        mapa.elegida = null;
        return;
      }
      ubicacionElegida({
        nombre: p.name || "",
        direccion: p.formatted_address || "",
        lat: p.geometry.location.lat(),
        lng: p.geometry.location.lng()
      });
    });

    mapa.conGoogle = true;
    pintarAyuda("Buscá la cancha en el mapa o escribí la dirección a mano.");
  }

  async function cargarMaps() {
    let clave = "";
    try {
      clave = (await API.get("/api/config")).mapsKey || "";
    } catch {
      /* sin configuración: usamos el buscador gratuito */
    }
    if (clave) {
      mapa.cargandoGoogle = true;
      const cargo = await new Promise((ok) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(clave)}` +
                     "&libraries=places&language=es&region=AR";
        script.async = true;
        script.onload = () => ok(true);
        script.onerror = () => ok(false);
        document.head.appendChild(script);
      });
      mapa.cargandoGoogle = false;
      if (cargo) {
        activarAutocomplete();
        if (mapa.conGoogle) return;
      }
    }
    // Sin clave de Google (o no cargó): OpenStreetMap, gratis y sin registro.
    pintarAyuda("Buscá la cancha mientras escribís; si no aparece, escribí la dirección a mano.");
  }

  /* =======================================================
     Sugerencias de OpenStreetMap (GET /api/geocode)
     ======================================================= */
  const geo = { items: [], activo: -1, vacio: false, timer: null, ultimo: 0, pedido: 0 };

  const listaSugerencias = () => $("sugerencias-ubicacion");

  function cerrarSugerencias() {
    const lista = listaSugerencias();
    geo.pedido++; // invalida cualquier respuesta que esté en vuelo
    geo.items = [];
    geo.activo = -1;
    geo.vacio = false;
    if (lista) {
      lista.hidden = true;
      lista.replaceChildren();
    }
    el.ubicacion.setAttribute("aria-expanded", "false");
    el.ubicacion.removeAttribute("aria-activedescendant");
  }

  function pintarSugerencias() {
    const lista = listaSugerencias();
    if (!lista) return;

    // Sin resultados: un mensaje, no una lista vacía
    if (!geo.items.length) {
      if (!geo.vacio) {
        cerrarSugerencias();
        return;
      }
      const aviso = document.createElement("li");
      aviso.className = "sug-vacio";
      aviso.setAttribute("role", "option");
      aviso.setAttribute("aria-disabled", "true");
      aviso.textContent = "No la encontramos. Mirá la vista previa o marcala con el pin.";
      lista.replaceChildren(aviso);
      lista.hidden = false;
      el.ubicacion.setAttribute("aria-expanded", "true");
      el.ubicacion.removeAttribute("aria-activedescendant");
      return;
    }

    const opciones = geo.items.map((it, i) => {
      const li = document.createElement("li");
      li.id = `sugerencia-${i}`;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", String(i === geo.activo));

      const cab = document.createElement("span");
      cab.className = "sug-cab";

      const titulo = document.createElement("span");
      titulo.className = "sug-titulo";
      titulo.textContent = it.titulo;
      cab.appendChild(titulo);

      // Las que ya están guardadas en la app se distinguen de las que
      // resuelve OpenStreetMap: son las que no necesitan marcar el pin.
      if (it.guardada) {
        const tag = document.createElement("span");
        tag.className = "sug-tag";
        tag.textContent = "Guardada";
        cab.appendChild(tag);
      }
      li.appendChild(cab);

      if (it.subtitulo) {
        const sub = document.createElement("span");
        sub.className = "sug-sub";
        sub.textContent = it.subtitulo;
        li.appendChild(sub);
      }

      // mousedown (y no click) para que no pierda el foco el campo
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        elegirSugerencia(i);
      });
      return li;
    });

    const pie = document.createElement("li");
    pie.className = "sugerencias__pie";
    pie.setAttribute("role", "presentation");
    pie.textContent = geo.items.some((i) => i.guardada)
      ? "Canchas guardadas y OpenStreetMap"
      : "Ubicaciones de OpenStreetMap";

    lista.replaceChildren(...opciones, pie);
    lista.hidden = false;
    el.ubicacion.setAttribute("aria-expanded", "true");
    if (geo.activo >= 0) {
      el.ubicacion.setAttribute("aria-activedescendant", `sugerencia-${geo.activo}`);
    } else {
      el.ubicacion.removeAttribute("aria-activedescendant");
    }

    const activo = geo.activo >= 0 && lista.querySelector(`#sugerencia-${geo.activo}`);
    if (activo) activo.scrollIntoView({ block: "nearest" });
  }

  function elegirSugerencia(i) {
    const it = geo.items[i];
    if (!it) return;
    ubicacionElegida({
      nombre: it.titulo,
      direccion: it.subtitulo,
      lat: it.lat,
      lng: it.lng,
      idComplejo: it.idComplejo // si es una cancha guardada, se reutiliza
    });
    cerrarSugerencias();
    el.ubicacion.focus();
  }

  function programarBusqueda() {
    // Con Google activo no se consulta OpenStreetMap
    if (mapa.conGoogle || mapa.cargandoGoogle) return;
    clearTimeout(geo.timer);
    // Nominatim pide máximo 1 consulta por segundo
    const espera = Math.max(500, geo.ultimo + 1000 - Date.now());
    geo.timer = setTimeout(buscarUbicacion, espera);
  }

  async function buscarUbicacion() {
    const texto = el.ubicacion.value.trim();
    if (texto.length < 4) {
      cerrarSugerencias();
      ocultarVistaGoogle();
      return;
    }
    geo.ultimo = Date.now();
    const pedido = ++geo.pedido;

    // Las canchas guardadas aparecen al instante: no dependen de la red.
    const locales = canchasQueCoinciden(texto).map(itemDeCancha);

    const pintarCon = (osm) => {
      if (pedido !== geo.pedido) return; // respuesta que ya no sirve
      if (el.ubicacion.value.trim() !== texto) return; // el texto cambió mientras tanto
      geo.items = [...locales, ...osm];
      geo.vacio = geo.items.length === 0;
      geo.activo = geo.items.length ? 0 : -1;
      pintarSugerencias();
      // Nada en el buscador ni guardado: ofrecemos la vista previa de Google.
      if (geo.vacio) mostrarVistaGoogle(texto);
      else ocultarVistaGoogle();
    };

    // Resultado inmediato con lo que ya conocemos (si hay).
    if (locales.length) pintarCon([]);

    // Después se suman los resultados de OpenStreetMap, cuando llegan.
    let osm = [];
    try {
      const items = await API.get(`/api/geocode?q=${encodeURIComponent(texto)}`);
      osm = Array.isArray(items) ? items : [];
    } catch {
      osm = []; // sin OpenStreetMap seguimos con las canchas guardadas
    }
    pintarCon(osm);
  }

  function manejarTeclasSugerencias(e) {
    if (e.key === "Escape") {
      cerrarSugerencias();
      return;
    }
    if (!geo.items.length || listaSugerencias()?.hidden) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      geo.activo = (geo.activo + 1) % geo.items.length;
      pintarSugerencias();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      geo.activo = (geo.activo - 1 + geo.items.length) % geo.items.length;
      pintarSugerencias();
    } else if (e.key === "Enter" && geo.activo >= 0) {
      e.preventDefault();
      elegirSugerencia(geo.activo);
    }
  }

  /* =======================================================
     Vista previa en Google Maps (sin API key)

     Cuando el buscador de OpenStreetMap no encuentra la cancha,
     mostramos el embed público de Google Maps con lo que escribió
     el usuario, para que la reconozca. Es SOLO una vista previa:
     las coordenadas que se publican salen de la sugerencia elegida
     o del pin que el usuario suelta en el mapa.
     ======================================================= */
  const embedGoogle = (q) =>
    `https://maps.google.com/maps?q=${encodeURIComponent(q)}&z=15&output=embed`;
  const enlaceGoogle = (q) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

  function mostrarVistaGoogle(texto) {
    const caja = $("mapa-google");
    const iframe = $("mapa-google-iframe");
    if (!caja || !iframe) return;

    const q = String(texto || "").trim();
    if (q.length < 4) {
      ocultarVistaGoogle();
      return;
    }
    if (mapa.googleAbierto && mapa.googleTexto === q) return; // ya está a la vista

    mapa.googleAbierto = true;
    mapa.googleTexto = q;
    iframe.src = embedGoogle(q);
    iframe.title = `Vista previa en Google Maps de ${q}`;

    const enlace = $("mapa-google-link");
    if (enlace) enlace.href = enlaceGoogle(q);

    caja.hidden = false;
  }

  function ocultarVistaGoogle() {
    const caja = $("mapa-google");
    const iframe = $("mapa-google-iframe");
    if (!caja || !iframe || !mapa.googleAbierto) return;

    mapa.googleAbierto = false;
    mapa.googleTexto = "";
    caja.hidden = true;
    iframe.removeAttribute("src"); // cortamos la carga de Google
  }

  /* =======================================================
     Mapa para fijar la ubicación exacta (Leaflet + OpenStreetMap)

     Muchas canchas de barrio no figuran en ningún buscador: con
     esto el usuario toca el mapa (o arrastra el punto) y las
     coordenadas quedan en mapa.elegida, que es lo mismo que
     manda el POST /api/partidos cuando salió de las sugerencias.
     ======================================================= */
  const punto = { mapa: null, marcador: null, listo: false, pedido: 0 };

  // Crea el mapa la primera vez que hace falta: nace oculto y se
  // muestra con el botón "Marcar con pin". Devuelve una promesa para
  // poder recalcular el tamaño cuando el contenedor se hace visible.
  let promesaMapa = null;
  function iniciarMapaUbicacion() {
    if (promesaMapa) return promesaMapa;

    const cont = $("mapa-ubicacion");
    if (!cont) return Promise.resolve();

    promesaMapa = new Promise((resolver) => {
      // La ciudad del perfil sirve de respaldo si el navegador no da la
      // ubicación (así el mapa abre en Mendoza y no en CABA).
      const arrancarMapa = (respaldo) =>
        MapaBase.cargar({ cluster: true })
          .then(() => {
            if (punto.listo) return; // ya estaba creado
            punto.mapa = MapaBase.crear(cont, { zoom: 13 });
            punto.listo = true;
            punto.mapa.on("click", (e) => marcarEn(e.latlng.lat, e.latlng.lng));

            // Botón para volver a pedir la ubicación y recentrar (sin
            // soltar el punto que el usuario ya haya marcado).
            MapaBase.controlUbicacion(punto.mapa, (p) => {
              if (!punto.marcador) punto.mapa.setView([p.lat, p.lng], 15);
            });

            // Las canchas guardadas, para elegirlas sin marcar el pin.
            pintarCanchasEnMapa();

            // Si ya hay un punto elegido (sugerencia o pin), lo mostramos;
            // si no, arranca donde está el usuario, o en su ciudad, o en CABA.
            if (mapa.elegida && Number.isFinite(mapa.elegida.lat)) {
              ubicarMarcador(mapa.elegida.lat, mapa.elegida.lng);
            } else {
              MapaBase.puntoInicial(respaldo).then((d) => {
                if (!punto.marcador) {
                  punto.mapa.setView([d.lat, d.lng], d.origen === "gps" ? 15 : 12);
                }
              });
            }
          })
          .catch(() => {
            // Sin mapa se sigue pudiendo publicar: la dirección se
            // escribe a mano, como antes.
            cont.classList.add("mapa-ubicacion--fallo");
            cont.textContent = "No pudimos cargar el mapa. Escribí la dirección a mano.";
          })
          .then(() => resolver());

      Auth.usuario()
        .then((u) => arrancarMapa(u?.localidad || ""))
        .catch(() => arrancarMapa(""));
    });

    return promesaMapa;
  }

  // Dibuja o mueve el punto. No toca la dirección escrita.
  function pintarMarcador(lat, lng, centrar) {
    if (!punto.mapa || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (!punto.marcador) {
      punto.marcador = L.marker([lat, lng], {
        draggable: true,
        keyboard: true,
        icon: L.divIcon({
          className: "pin-elegido",
          html: '<span class="pin-elegido__punto"></span>',
          iconSize: [34, 34],
          iconAnchor: [17, 17]
        })
      })
        .addTo(punto.mapa)
        .bindTooltip("Arrastrame para ajustar el punto", {
          direction: "top",
          offset: [0, -16]
        });
      punto.marcador.on("dragend", () => {
        const p = punto.marcador.getLatLng();
        ubicacionMarcada(p.lat, p.lng);
      });
    } else {
      punto.marcador.setLatLng([lat, lng]);
    }

    if (centrar) {
      punto.mapa.flyTo([lat, lng], Math.max(punto.mapa.getZoom(), 16), { duration: 0.6 });
    }
  }

  // Tocó el mapa (o arrastró el punto): las coordenadas quedan en
  // mapa.elegida. Si no había dirección escrita, la buscamos en el
  // punto elegido con GET /api/geocode?lat=&lng= (ubicación inversa).
  async function ubicacionMarcada(lat, lng) {
    const escrito = el.ubicacion.value.trim();

    // Fijamos las coordenadas YA (con lo que tengamos) para que el partido
    // se pueda publicar aunque el geocoder inverso tarde o falle.
    let nombre = "";
    let direccion = "";
    if (escrito) {
      // Ya hay una dirección: se respeta y solo cambian las coordenadas.
      ({ nombre, direccion } = partirUbicacion(escrito));
    } else {
      nombre = "Punto en el mapa";
    }

    mapa.elegida = { nombre, direccion, lat, lng };
    setError("ubicacion", "");
    ocultarVistaGoogle(); // ya la fijamos con el pin
    renderResumen();

    // Sin dirección escrita: la buscamos por el punto para completar el texto.
    if (!escrito) {
      const pedido = ++punto.pedido;
      let items = null;
      try {
        items = await API.get(`/api/geocode?lat=${lat}&lng=${lng}`);
      } catch {
        /* sin dirección: queda "Punto en el mapa" */
      }
      if (pedido !== punto.pedido) return; // ya hubo otro movimiento
      // Si el usuario ya escribió algo, su texto manda: no lo pisamos.
      if (el.ubicacion.value.trim() !== "") return;

      if (Array.isArray(items) && items.length) {
        nombre = items[0].titulo || nombre;
        direccion = items[0].subtitulo || "";
        mapa.elegida = { nombre, direccion, lat, lng };
      }
      el.ubicacion.value = [nombre, direccion].filter(Boolean).join(", ");
      renderResumen();
    }
  }

  function marcarEn(lat, lng) {
    pintarMarcador(lat, lng, false);
    ubicacionMarcada(lat, lng);
  }

  // Elegido en el buscador (o en Google): el punto viaja con él.
  function ubicarMarcador(lat, lng) {
    if (!punto.listo || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    pintarMarcador(lat, lng, true);
  }

  // Si el usuario vuelve a escribir a mano, el punto anterior ya
  // no corresponde: se borra y se guardan las coordenadas nuevas.
  function quitarMarcador() {
    if (!punto.marcador) return;
    punto.marcador.remove();
    punto.marcador = null;
  }

  /* =======================================================
     Canchas ya guardadas en el mapa

     Ya no hace falta marcar el pin cuando la cancha existe: se
     dibujan las que hay en la app (GET /api/canchas) y se elige
     una con un clic. El pin queda para canchas nuevas o para
     ajustar un punto que no sea exacto.
     ======================================================= */
  function iconoCancha() {
    return L.divIcon({
      className: "pin-cancha",
      html: '<span class="pin-cancha__punto"></span>',
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
  }

  function pintarCanchasEnMapa() {
    if (!punto.mapa || typeof L === "undefined") return;
    if (!canchas.capa) {
      // Con clustering: si hay muchas canchas, se agrupan y no se llena
      // el mapa de nodos DOM ni se encima los puntos del mismo complejo.
      canchas.capa = (L.markerClusterGroup
        ? L.markerClusterGroup({
            maxClusterRadius: 46,
            showCoverageOnHover: false,
            spiderfyOnMaxZoom: true,
            iconCreateFunction: (cluster) =>
              L.divIcon({
                html: `<span>${cluster.getChildCount()}</span>`,
                className: "pin-cancha-grupo",
                iconSize: [40, 40],
                iconAnchor: [20, 20]
              })
          })
        : L.layerGroup()
      ).addTo(punto.mapa);
    }
    canchas.capa.clearLayers();

    // Un punto por complejo (no por cancha): varias canchas del mismo
    // predio comparten coordenada y no aportan nada repetidas.
    const vistos = new Set();
    canchas.guardadas.forEach((c) => {
      if (!ubicable(c.lat, c.lng)) return;
      const idComplejo = c.idComplejo || c.id;
      if (vistos.has(idComplejo)) return;
      vistos.add(idComplejo);

      const nombre = c.complejo || c.nombre || "Cancha";
      const m = L.marker([c.lat, c.lng], {
        icon: iconoCancha(),
        title: nombre,
        keyboard: true,
        // Que elegir una cancha no dispare también el "marcar acá" del mapa.
        bubblingMouseEvents: false
      });
      m.bindTooltip(nombreNodo(nombre), { direction: "top", offset: [0, -12] });
      m.on("click", () => elegirCanchaGuardada(c));
      m.addTo(canchas.capa);
    });
  }

  // El usuario tocó una cancha guardada: queda elegida con sus datos,
  // igual que si la hubiera sacado del buscador (no hace falta el pin).
  function elegirCanchaGuardada(c) {
    const nombre = c.complejo || c.nombre || "Cancha";
    ubicacionElegida({
      nombre,
      direccion: unirUbicacion(c.direccion, c.zona),
      lat: c.lat,
      lng: c.lng,
      idComplejo: c.idComplejo
    });
    cerrarSugerencias(); // si el buscador estaba abierto, se cierra
    pintarAyuda(`Elegiste "${nombre}". Si el punto no es exacto, arrastralo.`);
  }

  /* =======================================================
     Desplegar el mapa con el pin

     El mapa de Leaflet queda oculto por defecto: se muestra con
     el botón "Marcar con pin". Al abrirlo hay que recalcular su
     tamaño, porque Leaflet no lo mide bien si el contenedor nace
     oculto.
     ======================================================= */
  function abrirMapaPin() {
    const caja = $("mapa-ubicacion-caja");
    const btn = $("btn-marcar-pin");
    if (!caja) return;

    caja.hidden = false;
    mapa.pinAbierto = true;
    if (btn) btn.setAttribute("aria-expanded", "true");
    // Que quede a la vista cuando lo abren la validación o el botón de la vista previa.
    caja.scrollIntoView({ block: "nearest", behavior: "smooth" });

    iniciarMapaUbicacion().then(() => {
      if (!punto.mapa) return;
      punto.mapa.invalidateSize(); // el contenedor recién ahora se ve
      if (mapa.elegida && Number.isFinite(mapa.elegida.lat)) {
        ubicarMarcador(mapa.elegida.lat, mapa.elegida.lng);
      }
    });
  }

  function alternarMapaPin() {
    const caja = $("mapa-ubicacion-caja");
    if (!caja) return;

    if (caja.hidden) {
      abrirMapaPin();
      return;
    }
    caja.hidden = true;
    mapa.pinAbierto = false;
    const btn = $("btn-marcar-pin");
    if (btn) btn.setAttribute("aria-expanded", "false");
  }

  function renderResumen() {
    const v = leer();

    const badge = $("prev-modalidad");
    badge.textContent = MODALIDADES[v.modalidad]?.nombre || "Modalidad";
    badge.classList.toggle("badge--empty", !v.modalidad);

    const { nombre, direccion } = partirUbicacion(v.ubicacion);
    const titulo = $("prev-nombre");
    titulo.textContent = nombre || "Nombre de la cancha";
    titulo.classList.toggle("is-empty", !nombre);

    let linea = "Elegí fecha y hora";
    if (v.fecha && v.hora) linea = `${etiquetaDia(v.fecha)} · ${v.hora} hs`;
    else if (v.fecha) linea = etiquetaDia(v.fecha);
    else if (v.hora) linea = `${v.hora} hs`;
    $("prev-fecha").textContent = linea;

    const pDireccion = $("prev-direccion");
    pDireccion.textContent = direccion;
    pDireccion.hidden = !direccion;

    $("prev-jugadores").textContent = `Buscás ${v.jugadores} jugador${v.jugadores === 1 ? "" : "es"}`;

    const pEquipo = $("prev-equipo");
    if (v.equipo && v.equipo.id) {
      const n = v.equipo.integrantes;
      pEquipo.textContent = `Con ${v.equipo.nombre} · ${n} ${n === 1 ? "integrante" : "integrantes"}`;
      pEquipo.hidden = false;
    } else {
      pEquipo.hidden = true;
    }

    const p = porcentaje(v);
    $("prog-texto").textContent = `${p}%`;
    $("prog-relleno").style.width = `${p}%`;
    $("prog-barra").setAttribute("aria-valuenow", String(p));
  }

  /* =======================================================
     Validación
     ======================================================= */
  function setError(nombre, mensaje) {
    const { grupo, error } = campos[nombre];
    grupo.classList.toggle("has-error", Boolean(mensaje));
    error.textContent = mensaje;
  }

  function validar() {
    const v = leer();
    const fallas = [];

    const marcar = (nombre, mensaje, foco) => {
      setError(nombre, mensaje);
      if (mensaje) fallas.push(foco);
    };

    marcar("modalidad", v.modalidad ? "" : "Elegí la modalidad de la cancha.",
      form.querySelector('input[name="modalidad"]'));

    let msg = "";
    if (!v.fecha) msg = "Elegí el día del partido.";
    else if (desdeClave(v.fecha) < hoyDia) msg = "La fecha no puede ser anterior a hoy.";
    marcar("fecha", msg, el.fecha);

    // Si es hoy, la hora tiene que ser futura
    msg = "";
    if (!v.hora) msg = "Elegí la hora de inicio.";
    else if (v.fecha === claveFecha(hoy)) {
      const [h, m] = v.hora.split(":").map(Number);
      const inicio = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), h, m);
      if (inicio <= new Date()) msg = "Esa hora ya pasó. Elegí una posterior.";
    }
    marcar("hora", msg, el.hora);

    marcar("jugadores",
      v.jugadores >= 1 && v.jugadores <= tope() ? "" : `Tienen que ser entre 1 y ${tope()} jugadores.`,
      el.mas);

    marcar("precio", v.precio !== null && v.precio > 0 ? "" : "Ingresá el precio de la cancha.", el.precio);

    msg = "";
    if (!tieneCoords()) {
      // Las coordenadas son obligatorias, pero se consiguen de dos formas:
      // eligiendo una sugerencia del buscador o marcando el pin en el mapa.
      msg = v.ubicacion
        ? "Todavía no fijaste el punto: elegí una sugerencia de la lista o marcalo con el pin en el mapa."
        : "Fijá la ubicación exacta con el pin en el mapa.";
      abrirMapaPin(); // le abrimos el mapa para que la marque
    }
    marcar("ubicacion", msg, el.ubicacion);

    // El equipo tiene que entrar en el cupo que estás publicando
    // (ocupa un lugar por integrante; el organizador no cuenta).
    msg = "";
    if (v.equipo && v.equipo.id) {
      const ocupan = Math.max(0, v.equipo.integrantes - 1);
      if (ocupan > v.jugadores) {
        msg = `Tu equipo ocupa ${ocupan} cupos y solo buscás ${v.jugadores}. ` +
              "Subí los jugadores que buscás o elegí otro equipo.";
      }
    }
    marcar("equipo", msg, document.querySelector("#chips-equipo .chip__input"));

    return fallas;
  }

  // Limpia cada error apenas el usuario corrige ese campo
  form.addEventListener("input", (e) => {
    const id = e.target.id || e.target.name;
    if (campos[id]) setError(id, "");
    // Si el usuario vuelve a editar la dirección a mano, las
    // coordenadas del lugar elegido ya no corresponden. Se conservan
    // solo si el texto sigue nombrando la misma cancha (así no se pierde
    // el idComplejo por corregir la dirección).
    if (id === "ubicacion") {
      const elegida = mapa.elegida;
      const texto = el.ubicacion.value.trim();
      const sigueIgual =
        Boolean(elegida && elegida.nombre) &&
        normalizar(texto).includes(normalizar(elegida.nombre));
      if (!sigueIgual) {
        mapa.elegida = null;
        quitarMarcador();
      }
      punto.pedido++; // invalida el geocoder inverso en vuelo
      programarBusqueda();
    }
    el.errorGeneral.classList.remove("is-visible");
    renderResumen();
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "modalidad") {
      setError("modalidad", "");
      jugadores = tope(); // arranca buscando a todos los demás jugadores
      pintarJugadores();
    }
    if (e.target.id === "fecha") setError("hora", "");
    renderResumen();
  });

  /* =======================================================
     Publicación (backend Go)
     POST /api/partidos
     ======================================================= */
  async function publicarPartido(datos) {
    const modalidad = MODALIDADES[datos.modalidad];
    const { nombre, direccion } = partirUbicacion(datos.ubicacion);

    // Si el lugar salió del buscador, usamos sus datos tal cual
    // (no hay que partir el texto, que puede tener comas).
    const lugar = mapa.elegida;

    const cuerpo = {
      fechaHora: `${datos.fecha}T${datos.hora}`,
      cupoTotal: datos.jugadores,
      jugadoresFaltantes: datos.jugadores,
      descripcion: datos.detalle,
      costoTotal: datos.precio,
      modalidad: modalidad.nombre,
      nivel: "Amateur",
      // Equipo elegido (si lo hay): queda inscripto en el partido
      idEquipo: datos.equipo && datos.equipo.id ? datos.equipo.id : 0
    };

    // Cancha ya existente (elegida del buscador o de los puntos del mapa):
    // mandamos su idComplejo y el back la reutiliza tal cual, sin duplicar.
    if (lugar && lugar.idComplejo) {
      cuerpo.idComplejo = lugar.idComplejo;
    } else {
      const complejo = {
        nombre: (lugar && lugar.nombre) || nombre,
        direccion: (lugar && lugar.direccion) || direccion || nombre
      };
      if (lugar) {
        complejo.lat = lugar.lat;
        complejo.lng = lugar.lng;
      }
      cuerpo.complejo = complejo;
    }

    const creado = await API.post("/api/partidos", cuerpo);

    return {
      id: creado.id,
      modalidad: modalidad.nombre,
      equipo: datos.equipo && datos.equipo.id ? datos.equipo.nombre : ""
    };
  }

  function cargando(estado) {
    el.publicar.disabled = estado;
    el.publicar.classList.toggle("is-loading", estado);
  }

  function reiniciarFormulario() {
    form.reset();
    jugadores = 1;
    mapa.elegida = null;
    cerrarSugerencias();
    ocultarVistaGoogle();
    quitarMarcador();
    // Cerramos el mapa de pin para arrancar de cero.
    const caja = $("mapa-ubicacion-caja");
    if (caja) caja.hidden = true;
    const btn = $("btn-marcar-pin");
    if (btn) btn.setAttribute("aria-expanded", "false");
    mapa.pinAbierto = false;
    Object.keys(campos).forEach((n) => setError(n, ""));
    el.errorGeneral.classList.remove("is-visible");
    pintarEquipos(); // vuelve a marcar "Sin equipo"
    pintarJugadores();
    renderResumen();
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    el.errorGeneral.classList.remove("is-visible");

    const fallas = validar();
    if (fallas.length) {
      fallas[0].focus();
      return;
    }

    const datos = leer();
    cargando(true);
    try {
      const partido = await publicarPartido(datos);
      cargando(false);
      abrirModal(partido, datos);
    } catch (err) {
      el.errorGeneral.textContent = err.message;
      el.errorGeneral.classList.add("is-visible");
      cargando(false);
    }
  });

  /* =======================================================
     Ventana emergente: partido confirmado
     ======================================================= */
  const modal = $("modal-confirmado");
  const dialogo = modal.querySelector(".modal__dialog");
  let focoPrevio = null;

  const formatoFechaCorta = (iso) => {
    const d = desdeClave(iso);
    return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  function abrirModal(partido, datos) {
    const { nombre, direccion } = partirUbicacion(datos.ubicacion);
    const cuando = `${formatoFechaCorta(datos.fecha)} · ${datos.hora} hs`;

    // El mapa del pin y la vista previa ya cumplieron: los ocultamos para
    // que no queden ni asomando detrás de la ventana.
    const cajaMapa = $("mapa-ubicacion-caja");
    if (cajaMapa) cajaMapa.hidden = true;
    const btnPin = $("btn-marcar-pin");
    if (btnPin) btnPin.setAttribute("aria-expanded", "false");
    mapa.pinAbierto = false;
    ocultarVistaGoogle();

    // Cuentas: seña del 30 % (simulada) y saldo restante
    const total = datos.precio;
    const sena = Math.round(total * PORCENTAJE_SENA);
    const saldo = total - sena;

    $("mc-modalidad").textContent = partido.modalidad;
    $("mc-nombre").textContent = nombre;
    $("mc-cuando").textContent = cuando;
    $("mc-total").textContent = `${formatoPesos(total)} ARS`;
    $("mc-sena").textContent = formatoPesos(sena);
    $("mc-saldo").textContent = formatoPesos(saldo);

    const pEquipo = $("mc-equipo");
    pEquipo.textContent = partido.equipo ? `Con el equipo ${partido.equipo}` : "";
    pEquipo.hidden = !partido.equipo;

    const pDireccion = $("mc-direccion");
    pDireccion.textContent = direccion;
    pDireccion.hidden = !direccion;

    // Ver partido
    const rutaDetalle = `${APP.rutas.detallePartido}?id=${encodeURIComponent(partido.id)}`;
    $("mc-ver").href = rutaDetalle;

    // Compartir por WhatsApp
    const enlace = new URL(rutaDetalle, window.location.href).href;
    const lugar = direccion ? `${nombre}, ${direccion}` : nombre;
    const mensaje =
      `¡Sumate a mi partido en Convocados! ${partido.modalidad} en ${lugar} · ${cuando}. ` +
      `Mirá los detalles: ${enlace}`;
    $("mc-whatsapp").href = `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

    focoPrevio = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-abierto");
    $("mc-ver").focus();
  }

  function cerrarModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-abierto");
    reiniciarFormulario(); // el partido ya se publicó: se parte de un formulario limpio
    if (focoPrevio && typeof focoPrevio.focus === "function") focoPrevio.focus();
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-cerrar]")) cerrarModal();
  });

  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;

    if (e.key === "Escape") {
      cerrarModal();
      return;
    }

    // Mantiene el foco dentro de la ventana
    if (e.key === "Tab") {
      const enfocables = [...dialogo.querySelectorAll("a[href], button:not([disabled])")];
      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  });

  /* ---------- Inicio ---------- */
  el.ubicacion.addEventListener("keydown", manejarTeclasSugerencias);
  el.ubicacion.addEventListener("blur", () => setTimeout(cerrarSugerencias, 120));
  $("btn-marcar-pin")?.addEventListener("click", alternarMapaPin);
  $("btn-google-pin")?.addEventListener("click", abrirMapaPin);
  pintarJugadores();
  renderResumen();
  cargarEquipos(); // chips con mis equipos (si no hay, queda "Sin equipo")
  cargarMaps(); // autocompletado: Google si hay clave, si no OpenStreetMap
  cargarCanchasGuardadas(); // canchas ya cargadas: sugerencias + puntos del mapa
  // El mapa con el pin se crea recién cuando el usuario lo abre.
})();