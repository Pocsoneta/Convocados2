/* =========================================================
   buscar.js — lógica de esta pantalla (solo front)

   - Buscador por nombre de cancha o localidad.
   - Filtros: fecha (rango en el calendario) y zona.
   - La lista y el mapa muestran los mismos resultados, en
     el mismo orden (fecha más próxima primero).

   Todavía no hay API: la lista y el mapa quedan vacíos hasta
   que se conecte el backend. Para conectarlo, completá solo
   `obtenerPartidos`. Para conectar Google Maps, reemplazá
   js/mapa-zona.js.
   ========================================================= */

(() => {
  if (!Auth.sesion()) return;

  const $ = (id) => document.getElementById(id);
  const usuario = Auth.usuario();

  /* ---------- Utilidades de fecha y texto ---------- */
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
    "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MODALIDADES = { "futbol-5": "Fútbol 5", "futbol-7": "Fútbol 7", "futbol-11": "Fútbol 11" };

  const dos = (n) => String(n).padStart(2, "0");
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const clave = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const desdeClave = (s) => {
    const [a, m, d] = s.split("-").map(Number);
    return new Date(a, m - 1, d);
  };

  /* ---------- Estado ---------- */
  const hoy = inicioDia(new Date());
  const params = new URLSearchParams(window.location.search);

  const estado = {
    texto: "",
    zona: usuario.localidad || "",
    desde: hoy,                      // por defecto: hoy y los próximos 3 días
    hasta: sumarDias(hoy, 3),
    modalidad: params.get("modalidad") || "",   // viene del filtro de la pantalla de inicio
    mes: new Date(hoy.getFullYear(), hoy.getMonth(), 1),
    resultados: [],
    buscado: false,                  // el aviso de "sin resultados" aparece recién tras una búsqueda
    pedido: 0                        // evita que una respuesta lenta pise a una más nueva
  };

  /* ---------- Elementos ---------- */
  const el = {
    form: $("form-busqueda"),
    texto: $("texto"),
    zona: $("zona"),
    fechaEtiqueta: $("fecha-etiqueta"),
    calTitulo: $("cal-titulo"),
    calGrid: $("cal-grid"),
    calPrev: $("cal-prev"),
    calNext: $("cal-next"),
    limpiar: $("btn-limpiar"),
    titulo: $("res-titulo"),
    lista: $("lista"),
    mapaZona: $("mapa-zona"),
    btnZonaMapa: $("btn-zona-mapa"),
    tag: $("tag-modalidad"),
    tagTexto: $("tag-modalidad-texto"),
    tagQuitar: $("tag-modalidad-quitar")
  };

  /* =======================================================
     API (pendiente) — completar cuando exista el backend

     Recibe los filtros:
       { texto, desde, hasta, zona, modalidad }
       (desde / hasta son objetos Date, o null si no hay fecha;
        modalidad viene como "futbol-5", "futbol-7" o "futbol-11")

     Debe devolver un array de partidos con esta forma:
       { id, nombre, modalidad: "Fútbol 5", zona: "Palermo, CABA",
         distanciaKm: 0.8, fecha: "2026-11-02T21:00:00",
         cupos: 3, lat: -34.58, lng: -58.43 }
     ======================================================= */
  async function obtenerPartidos(/* filtros */) {
    return [];
  }

  /* ---------- Helpers de DOM ---------- */
  function nodo(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }

  const ICONO_MARCA =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>';

  const ICONO_PIN =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<path d="M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>';

  /* ---------- Formatos de los resultados ---------- */
  const formatoKm = (km) =>
    km.toLocaleString("es-AR", { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + " km";

  function formatoFechaPartido(iso) {
    const f = new Date(iso);
    const hora = `${dos(f.getHours())}:${dos(f.getMinutes())} hs`;
    const dia = inicioDia(f);

    let nombre;
    if (+dia === +hoy) nombre = "Hoy";
    else if (+dia === +sumarDias(hoy, 1)) nombre = "Mañana";
    else nombre = DIAS_CORTOS[f.getDay()];

    return `${nombre}, ${hora}`;
  }

  function textoCupos(n) {
    if (n <= 0) return { texto: "Completo", bajo: true };
    if (n === 1) return { texto: "1 cupo libre", bajo: true };
    return { texto: `${n} cupos libres`, bajo: false };
  }

  /* =======================================================
     Calendario (rango de fechas)
     ======================================================= */
  function etiquetaFecha() {
    const { desde } = estado;
    if (!desde) return "Fecha · Cualquier día";

    const hasta = estado.hasta || desde;
    const corto = (d) => `${d.getDate()} ${MESES_CORTOS[d.getMonth()]}`;

    if (+desde === +hasta) return `Fecha · ${corto(desde)}`;
    if (desde.getMonth() === hasta.getMonth()) {
      return `Fecha · ${desde.getDate()}–${hasta.getDate()} ${MESES_CORTOS[hasta.getMonth()]}`;
    }
    return `Fecha · ${corto(desde)} – ${corto(hasta)}`;
  }

  function renderCalendario() {
    const { mes } = estado;
    el.calTitulo.textContent = `${MESES[mes.getMonth()]} ${mes.getFullYear()}`;
    el.fechaEtiqueta.textContent = etiquetaFecha();

    // La semana empieza el lunes; se dibujan 6 filas fijas
    const offset = (mes.getDay() + 6) % 7;
    const primero = sumarDias(mes, -offset);
    const fin = estado.hasta || estado.desde;
    const celdas = [];

    for (let i = 0; i < 42; i++) {
      const d = sumarDias(primero, i);
      const b = nodo("button", "cal__day", String(d.getDate()));
      b.type = "button";
      b.dataset.fecha = clave(d);
      b.setAttribute("aria-label", `${d.getDate()} de ${MESES[d.getMonth()].toLowerCase()} de ${d.getFullYear()}`);

      if (d.getMonth() !== mes.getMonth()) b.classList.add("is-out");
      if (d < hoy) b.disabled = true; // no se buscan partidos pasados
      if (+d === +hoy) {
        b.classList.add("is-today");
        b.setAttribute("aria-current", "date");
      }

      if (estado.desde) {
        if (+d === +estado.desde || +d === +fin) {
          b.classList.add("is-edge");
          b.setAttribute("aria-pressed", "true");
        } else if (d > estado.desde && d < fin) {
          b.classList.add("is-range");
        }
      }
      celdas.push(b);
    }

    el.calGrid.replaceChildren(...celdas);
    el.calPrev.disabled = mes <= new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }

  function elegirDia(d) {
    if (!estado.desde || estado.hasta) {
      // Empieza un rango nuevo
      estado.desde = d;
      estado.hasta = null;
    } else if (d < estado.desde) {
      estado.hasta = estado.desde;
      estado.desde = d;
    } else {
      estado.hasta = d; // mismo día dos veces = un solo día
    }
    renderCalendario();
    ejecutar();
  }

  el.calGrid.addEventListener("click", (e) => {
    const boton = e.target.closest(".cal__day");
    if (boton && !boton.disabled) elegirDia(desdeClave(boton.dataset.fecha));
  });

  el.calPrev.addEventListener("click", () => {
    estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() - 1, 1);
    renderCalendario();
  });
  el.calNext.addEventListener("click", () => {
    estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + 1, 1);
    renderCalendario();
  });

  /* =======================================================
     Resultados: lista + mapa
     ======================================================= */
  function filaResultado(p, i) {
    const li = nodo("li", "result");
    li.dataset.id = p.id;

    const icono = nodo("span", "result__icon");
    icono.innerHTML = ICONO_MARCA;

    const meta = nodo("p", "result__meta");
    meta.append(
      nodo("span", "result__mod", p.modalidad),
      nodo("span", "result__sep"),
      nodo("span", null, formatoKm(p.distanciaKm)),
      nodo("span", "result__sep"),
      nodo("span", null, formatoFechaPartido(p.fecha))
    );

    const info = nodo("div", "result__info");
    info.append(nodo("h3", "result__name", `${i + 1}. ${p.nombre}`), meta);

    const cupos = textoCupos(p.cupos);
    const lado = nodo("div", "result__side");
    const enlace = nodo("a", "btn btn--ver", "Ver partido");
    enlace.href = `${APP.rutas.detallePartido}?id=${encodeURIComponent(p.id)}`;
    lado.append(
      nodo("span", `result__cupos${cupos.bajo ? " result__cupos--low" : ""}`, cupos.texto),
      enlace
    );

    li.append(icono, info, lado);

    // Fila ↔ pin del mapa
    li.addEventListener("mouseenter", () => resaltar(p.id));
    li.addEventListener("mouseleave", () => resaltar(null));
    li.addEventListener("focusin", () => resaltar(p.id));
    li.addEventListener("focusout", () => resaltar(null));

    return li;
  }

  function bloqueVacio(titulo, texto) {
    const caja = nodo("li", "empty");
    const icono = nodo("span", "empty__icon");
    icono.innerHTML = ICONO_PIN;
    caja.append(icono, nodo("p", "empty__title", titulo), nodo("p", "empty__text", texto));
    return caja;
  }

  // Marca la fila y el pin del partido activo (o ninguno)
  function resaltar(id) {
    el.lista.querySelectorAll(".result").forEach((fila) => {
      fila.classList.toggle("is-active", fila.dataset.id === id);
    });
    MapaZona.resaltar(id);
  }

  // Al tocar un pin: lleva la fila a la vista y la destaca un momento
  function seleccionar(id) {
    const fila = [...el.lista.querySelectorAll(".result")].find((f) => f.dataset.id === id);
    if (!fila) return;
    fila.scrollIntoView({ block: "nearest", behavior: "smooth" });
    fila.classList.add("is-selected");
    setTimeout(() => fila.classList.remove("is-selected"), 1400);
  }

  function renderResultados() {
    const { resultados } = estado;

    el.titulo.textContent = `Resultados encontrados (${resultados.length})`;
    el.mapaZona.textContent = estado.zona.trim() || "Todas las zonas";

    if (resultados.length) {
      el.lista.replaceChildren(...resultados.map(filaResultado));
    } else if (estado.buscado) {
      el.lista.replaceChildren(
        bloqueVacio(
          "No encontramos partidos",
          "Probá con otra fecha o zona, o quitá algún filtro para ver más resultados."
        )
      );
    } else {
      el.lista.replaceChildren(); // carga inicial: el espacio queda vacío
    }

    MapaZona.mostrar(resultados);
  }

  function renderError() {
    estado.resultados = [];
    el.titulo.textContent = "Resultados encontrados (0)";
    el.lista.replaceChildren(
      bloqueVacio("No pudimos cargar los partidos", "Revisá tu conexión e intentá buscar de nuevo.")
    );
    MapaZona.mostrar([]);
  }

  function renderModalidad() {
    const activa = Boolean(estado.modalidad);
    el.tag.hidden = !activa;
    if (activa) el.tagTexto.textContent = MODALIDADES[estado.modalidad] || estado.modalidad;
  }

  /* ---------- Búsqueda ---------- */
  async function ejecutar(porUsuario = true) {
    if (porUsuario) estado.buscado = true;
    const pedido = ++estado.pedido;
    el.lista.setAttribute("aria-busy", "true");

    try {
      const resultados = await obtenerPartidos({
        texto: estado.texto,
        desde: estado.desde,
        hasta: estado.desde ? estado.hasta || estado.desde : null,
        zona: estado.zona,
        modalidad: estado.modalidad
      });
      if (pedido !== estado.pedido) return;

      // Orden: fecha más próxima primero. La lista y el mapa comparten este orden.
      estado.resultados = [...resultados].sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
      renderResultados();
    } catch {
      if (pedido === estado.pedido) renderError();
    } finally {
      if (pedido === estado.pedido) el.lista.setAttribute("aria-busy", "false");
    }
  }

  /* ---------- Eventos ---------- */
  el.form.addEventListener("submit", (e) => {
    e.preventDefault();
    estado.texto = el.texto.value.trim();
    ejecutar();
  });

  // La zona filtra mientras se escribe, con una pequeña espera
  let esperaZona;
  el.zona.addEventListener("input", () => {
    clearTimeout(esperaZona);
    esperaZona = setTimeout(() => {
      estado.zona = el.zona.value;
      ejecutar();
    }, 350);
  });

  // Con Google Maps, esto buscará según el área visible del mapa
  el.btnZonaMapa.addEventListener("click", () => ejecutar());

  el.tagQuitar.addEventListener("click", () => {
    estado.modalidad = "";
    renderModalidad();
    window.history.replaceState(null, "", window.location.pathname);
    ejecutar();
  });

  el.limpiar.addEventListener("click", () => {
    estado.texto = "";
    estado.zona = "";
    estado.desde = null;
    estado.hasta = null;
    estado.modalidad = "";
    el.texto.value = "";
    el.zona.value = "";
    window.history.replaceState(null, "", window.location.pathname);

    renderCalendario();
    renderModalidad();
    ejecutar();
  });

  /* ---------- Inicio ---------- */
  MapaZona.iniciar($("mapa"), { alSeleccionar: seleccionar, alResaltar: resaltar });

  el.zona.value = estado.zona;
  renderCalendario();
  renderModalidad();
  ejecutar(Boolean(estado.modalidad));
})();