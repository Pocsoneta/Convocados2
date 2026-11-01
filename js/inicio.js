/* =========================================================
   inicio.js — lógica de esta pantalla

   Las tres funciones `obtener...` van al backend:
     GET /api/inicio/cercanos
     GET /api/inicio/proximo
     GET /api/inicio/conteos
   Si el backend no responde se ven los estados vacíos.
   ========================================================= */

(() => {
  if (!Auth.sesion()) return;

  const $ = (id) => document.getElementById(id);

  /* ---------- Ubicación (para "cerca tuyo") ---------- */
  // Si el navegador da la posición, la mandamos; si no (o si el
  // permiso se rechaza), usamos el centro de CABA como respaldo.
  const UBICACION_POR_DEFECTO = { lat: -34.6037, lng: -58.3816 };

  function coordenadas() {
    return new Promise((resolver) => {
      if (!navigator.geolocation) return resolver(UBICACION_POR_DEFECTO);
      const alTiempo = setTimeout(() => resolver(UBICACION_POR_DEFECTO), 4000);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(alTiempo);
          resolver({ lat: p.coords.latitude, lng: p.coords.longitude });
        },
        () => {
          clearTimeout(alTiempo);
          resolver(UBICACION_POR_DEFECTO);
        },
        { timeout: 4000, maximumAge: 600000 }
      );
    });
  }

  const conCoords = async (ruta) => {
    const c = await coordenadas();
    return `${ruta}?lat=${encodeURIComponent(c.lat)}&lng=${encodeURIComponent(c.lng)}`;
  };

  /* =======================================================
     API
     ======================================================= */

  // Debe devolver un array de partidos cercanos, por ejemplo:
  // { id, modalidad: "Fútbol 7", nombre: "Club Palermo Soho", zona: "Palermo, CABA",
  //   distanciaKm: 1.2, nivel: "Amateur", cupos: 2 }
  async function obtenerPartidosCercanos() {
    const datos = await API.get(await conCoords("/api/inicio/cercanos") + "&limit=6");
    return Array.isArray(datos) ? datos : [];
  }

  // Debe devolver el próximo partido del usuario o null, por ejemplo:
  // { id, nombre: "Club Palermo Soho", fecha: "2026-11-02T21:00:00", direccion: "Honduras 5050, Palermo" }
  async function obtenerProximoPartido() {
    return API.get(await conCoords("/api/inicio/proximo"));
  }

  // Debe devolver la cantidad de partidos por modalidad, por ejemplo:
  // { "futbol-5": 12, "futbol-7": 12, "futbol-11": 12 }
  async function obtenerConteoModalidades() {
    return API.get("/api/inicio/conteos");
  }

  /* ---------- Helpers de DOM ---------- */
  function el(tag, clase, texto) {
    const nodo = document.createElement(tag);
    if (clase) nodo.className = clase;
    if (texto !== undefined) nodo.textContent = texto;
    return nodo;
  }

  const ICONO_PIN =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

  /* ---------- Formatos ---------- */
  const formatoKm = (km) =>
    km.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " km";

  const formatoCupos = (n) => (n <= 0 ? "Completo" : n === 1 ? "1 cupo" : `${n} cupos`);

  function formatoFecha(iso) {
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime())) return "";

    const hora = fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) + " hs";
    const hoy = new Date();
    const manana = new Date();
    manana.setDate(hoy.getDate() + 1);
    const mismoDia = (a, b) => a.toDateString() === b.toDateString();

    let dia;
    if (mismoDia(fecha, hoy)) dia = "Hoy";
    else if (mismoDia(fecha, manana)) dia = "Mañana";
    else dia = fecha.toLocaleDateString("es-AR", { weekday: "short", day: "numeric", month: "short" });

    return `${dia} · ${hora}`;
  }

  /* ---------- Partidos cerca tuyo ---------- */
  function tarjetaPartido(p) {
    const link = el("a", "match");
    link.href = `${APP.rutas.detallePartido}?id=${encodeURIComponent(p.id)}`;

    const top = el("div", "match__top");
    top.append(el("span", "badge", p.modalidad), el("span", "match__dist", formatoKm(p.distanciaKm)));

    const pie = el("div", "match__foot");
    const nivel = el("div");
    nivel.append(el("span", "match__label", "Nivel"), el("span", "match__value", p.nivel));
    const cupos = el("div");
    cupos.append(
      el("span", "match__label", "Disponibles"),
      el("span", "match__value match__value--accent", formatoCupos(p.cupos))
    );
    pie.append(nivel, cupos);

    link.append(top, el("h3", "match__name", p.nombre), el("p", "match__zone", p.zona), pie);
    return link;
  }

  function vacioCercanos() {
    const caja = el("div", "empty");
    const icono = el("span", "empty__icon");
    icono.innerHTML = ICONO_PIN;

    const enlace = el("a", "link-green", "Buscar partidos");
    enlace.href = APP.rutas.buscar;

    caja.append(
      icono,
      el("p", "empty__title", "Todavía no hay partidos para mostrar"),
      el("p", "empty__text", "Cuando busques partidos, los que estén cerca tuyo van a aparecer acá."),
      enlace
    );
    return caja;
  }

  function renderCercanos(partidos) {
    const lista = $("lista-cercanos");
    lista.replaceChildren(
      ...(partidos.length ? partidos.slice(0, 3).map(tarjetaPartido) : [vacioCercanos()])
    );
  }

  /* ---------- Tu próximo partido ---------- */
  function renderProximo(partido) {
    const caja = $("proximo");
    caja.classList.toggle("next--empty", !partido);

    if (!partido) {
      const boton = el("a", "btn btn--soft", "Buscar partido");
      boton.href = APP.rutas.buscar;
      caja.replaceChildren(
        el("p", "next__eyebrow", "Tu próximo partido"),
        el("h2", "next__name", "No tenés partidos próximos"),
        el("p", "next__meta", "Cuando te sumes a uno, vas a verlo acá."),
        boton
      );
      return;
    }

    const meta = el("p", "next__meta");
    meta.append(formatoFecha(partido.fecha), document.createElement("br"), partido.direccion);

    const boton = el("a", "btn btn--soft", "Ver detalle");
    boton.href = `${APP.rutas.detallePartido}?id=${encodeURIComponent(partido.id)}`;

    caja.replaceChildren(
      el("p", "next__eyebrow", "Tu próximo partido"),
      el("h2", "next__name", partido.nombre),
      meta,
      boton
    );
  }

  /* ---------- Conteo por modalidad ---------- */
  function renderConteos(conteos) {
    document.querySelectorAll(".modo").forEach((enlace) => {
      const cantidad = conteos[enlace.dataset.modalidad];
      const nodo = enlace.querySelector(".modo__count");
      if (typeof cantidad === "number") {
        nodo.textContent = cantidad === 1 ? "1 partido" : `${cantidad} partidos`;
        nodo.hidden = false;
      } else {
        nodo.hidden = true;
      }
    });
  }

  /* ---------- Inicio ---------- */
  async function iniciar() {
    // Ficha del usuario (saludo del encabezado)
    try {
      const usuario = (await Auth.usuario()) || { nombre: "" };
      $("saludo-nombre").textContent = (usuario.nombre || "").split(" ")[0] || "jugador";
    } catch {
      $("saludo-nombre").textContent = "jugador";
    }

    // Cada bloque se carga por separado: si uno falla, los otros siguen
    const [cercanos, proximo, conteos] = await Promise.all([
      obtenerPartidosCercanos().catch(() => []),
      obtenerProximoPartido().catch(() => null),
      obtenerConteoModalidades().catch(() => ({}))
    ]);

    renderCercanos(Array.isArray(cercanos) ? cercanos : []);
    renderProximo(proximo || null);
    renderConteos(conteos || {});
  }

  iniciar();
})();
