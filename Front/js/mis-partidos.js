/* =========================================================
   mis-partidos.js — lógica de esta pantalla (solo front)

   Muestra los partidos que el usuario creó y los partidos a
   los que se unió. En los que organiza, cada tarjeta indica
   cuántas personas quieren unirse.

   Los datos vienen de GET /api/mis-partidos (ver obtenerMisPartidos).
   ========================================================= */

(() => {
  if (!Auth.sesion()) return;

  const $ = (id) => document.getElementById(id);

  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
    "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const dos = (n) => String(n).padStart(2, "0");
  const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const estado = {
    partidos: [],
    pestana: "proximos"
  };

  const el = {
    lista: $("lista"),
    titulo: $("panel-titulo"),
    panel: $("panel"),
    tabs: [...document.querySelectorAll(".tab")],
    solicitudesN: $("tab-solicitudes-n"),
    mes: $("resumen-mes"),
    statPartidos: $("stat-partidos"),
    statConfirmados: $("stat-confirmados")
  };

  /* =======================================================
     API (backend Go) — GET /api/mis-partidos
     Devuelve los partidos que organiza el usuario y los que
     se sumó (individual o con su equipo), próximos y pasados.
     ======================================================= */
  async function obtenerMisPartidos() {
    const [proximos, pasados] = await Promise.all([
      API.get("/api/mis-partidos?momento=proximos"),
      API.get("/api/mis-partidos?momento=pasados")
    ]);
    return [...proximos, ...pasados].map((p) => ({
      id: p.id,
      rol: p.rol,
      modalidad: p.modalidad,
      nombre: p.nombre,
      zona: p.zona,
      fecha: p.fecha,
      foto: null,
      cuposLibres: p.cupos,
      estado: p.estado,
      solicitudesPendientes: p.solicitudesPendientes
    }));
  }

  /* ---------- Helpers de DOM ---------- */
  function nodo(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }

  const ICONO_MARCA =
    '<svg viewBox="0 0 24 24" width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true">' +
    '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5l5 5M14.5 9.5l-5 5"/></svg>';

  const ICONO_CALENDARIO =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M8 3v4M16 3v4"/></svg>';

  /* ---------- Reglas de cada partido ---------- */
  const esFuturo = (p) => new Date(p.fecha) >= new Date();
  const esOrganizador = (p) => p.rol === "organizador";
  const solicitudesDe = (p) => (esOrganizador(p) ? Number(p.solicitudesPendientes) || 0 : 0);
  const esConfirmado = (p) => esOrganizador(p) || p.estado === "confirmado";

  function formatoFecha(iso) {
    const f = new Date(iso);
    const hora = `${dos(f.getHours())}:${dos(f.getMinutes())} hs`;
    const hoy = inicioDia(new Date());
    const dia = inicioDia(f);
    const dif = Math.round((dia - hoy) / 86400000);

    if (dif === 0) return `Hoy, ${hora}`;
    if (dif === 1) return `Mañana, ${hora}`;
    return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}, ${hora}`;
  }

  // Columna "Estado": qué pasa con este partido para el usuario
  function textoEstado(p) {
    if (esOrganizador(p)) return { texto: "Organizás vos" };
    if (p.estado === "confirmado") return { texto: "Confirmado" };
    if (p.estado === "rechazado") return { texto: "Rechazado", clase: "partido__valor--alerta" };
    return { texto: "Pendiente" };
  }

  // Columna "Disponibles": cuántos puestos faltan
  function textoDisponibles(p) {
    const n = Number(p.cuposLibres) || 0;
    if (n <= 0) return "Completado";
    if (n === 1) return "Falta 1 jugador";
    return `${n} cupos`;
  }

  // Columna "Solicitudes": solo en los partidos que organiza el usuario
  function textoSolicitudes(p) {
    const n = solicitudesDe(p);
    if (n === 0) return { texto: "Sin solicitudes", clase: "partido__valor--muted" };
    return {
      texto: n === 1 ? "1 quiere unirse" : `${n} quieren unirse`,
      clase: "partido__valor--accent"
    };
  }

  /* =======================================================
     Tarjetas
     ======================================================= */
  function columna(etiqueta, valor, claseValor, alFinal) {
    const col = nodo("div", `partido__col${alFinal ? " partido__col--end" : ""}`);
    col.append(
      nodo("span", "partido__label", etiqueta),
      nodo("span", `partido__valor${claseValor ? " " + claseValor : ""}`, valor)
    );
    return col;
  }

  function tarjeta(p) {
    const li = nodo("li");
    const enlace = nodo("a", "partido");
    const ruta = esOrganizador(p) ? APP.rutas.administrarPartido : APP.rutas.detallePartido;
    enlace.href = `${ruta}?id=${encodeURIComponent(p.id)}`;

    // Foto
    const media = nodo("div", "partido__media");
    media.innerHTML = ICONO_MARCA;
    if (p.foto) {
      const img = nodo("img");
      img.src = p.foto;
      img.alt = "";
      img.loading = "lazy";
      img.addEventListener("error", () => img.remove()); // queda el fondo con la marca
      media.appendChild(img);
    }

    // Datos
    const top = nodo("div", "partido__top");
    top.append(nodo("span", "badge", p.modalidad), nodo("span", "partido__fecha", formatoFecha(p.fecha)));

    const pie = nodo("div", "partido__foot");
    const st = textoEstado(p);
    pie.appendChild(columna("Estado", st.texto, st.clase));

    // Solo en los partidos que crea el usuario: cuántos quieren unirse
    if (esOrganizador(p)) {
      const sol = textoSolicitudes(p);
      pie.appendChild(columna("Solicitudes", sol.texto, sol.clase));
    }

    pie.appendChild(columna("Disponibles", textoDisponibles(p), "partido__valor--accent", true));

    const cuerpo = nodo("div", "partido__body");
    cuerpo.append(top, nodo("h3", "partido__name", p.nombre), nodo("p", "partido__zona", p.zona), pie);

    enlace.append(media, cuerpo);
    li.appendChild(enlace);
    return li;
  }

  /* ---------- Estados vacíos (uno por pestaña) ---------- */
  const VACIOS = {
    proximos: {
      titulo: "Todavía no tenés partidos próximos",
      texto: "Creá una convocatoria o buscá un partido para sumarte.",
      enlaces: true
    },
    solicitudes: {
      titulo: "No tenés solicitudes pendientes",
      texto: "Cuando alguien quiera sumarse a un partido que organizás, lo vas a ver acá."
    },
    historial: {
      titulo: "Todavía no tenés partidos jugados",
      texto: "Tus partidos anteriores van a aparecer acá."
    }
  };

  function bloqueVacio(clave) {
    const datos = VACIOS[clave];
    const li = nodo("li");
    const caja = nodo("div", "empty");
    const icono = nodo("span", "empty__icon");
    icono.innerHTML = ICONO_CALENDARIO;
    caja.append(icono, nodo("p", "empty__title", datos.titulo), nodo("p", "empty__text", datos.texto));

    if (datos.enlaces) {
      const enlaces = nodo("div", "empty__links");
      const crear = nodo("a", "link-green", "Crear partido");
      crear.href = APP.rutas.crearPartido;
      const buscar = nodo("a", "link-green", "Buscar partidos");
      buscar.href = APP.rutas.buscar;
      enlaces.append(crear, buscar);
      caja.appendChild(enlaces);
    }

    li.appendChild(caja);
    return li;
  }

  /* =======================================================
     Render
     ======================================================= */
  const TITULOS = {
    proximos: "Tus próximas fechas",
    solicitudes: "Solicitudes pendientes",
    historial: "Historial de partidos"
  };

  function partidosDe(pestana) {
    const todos = estado.partidos;
    const fecha = (p) => new Date(p.fecha);

    if (pestana === "historial") {
      return todos.filter((p) => !esFuturo(p)).sort((a, b) => fecha(b) - fecha(a)); // más reciente primero
    }

    const proximos = todos.filter(esFuturo).sort((a, b) => fecha(a) - fecha(b)); // más cercano primero
    if (pestana === "solicitudes") return proximos.filter((p) => solicitudesDe(p) > 0);
    return proximos;
  }

  function renderPestanas() {
    el.tabs.forEach((tab) => {
      const activa = tab.dataset.tab === estado.pestana;
      tab.classList.toggle("is-active", activa);
      tab.setAttribute("aria-selected", String(activa));
      if (activa) el.panel.setAttribute("aria-labelledby", tab.id);
    });

    // "Solicitudes · 3": total de personas que esperan respuesta
    const total = estado.partidos.filter(esFuturo).reduce((suma, p) => suma + solicitudesDe(p), 0);
    el.solicitudesN.textContent = total > 0 ? ` · ${total}` : "";
  }

  function renderResumenMes() {
    const hoy = new Date();
    el.mes.textContent = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;

    const delMes = estado.partidos.filter((p) => {
      const f = new Date(p.fecha);
      return esFuturo(p) && f.getMonth() === hoy.getMonth() && f.getFullYear() === hoy.getFullYear();
    });
    el.statPartidos.textContent = delMes.length;
    el.statConfirmados.textContent = delMes.filter(esConfirmado).length;
  }

  function renderLista() {
    el.titulo.textContent = TITULOS[estado.pestana];
    const partidos = partidosDe(estado.pestana);

    el.lista.replaceChildren(
      ...(partidos.length ? partidos.map(tarjeta) : [bloqueVacio(estado.pestana)])
    );
  }

  function renderTodo() {
    renderPestanas();
    renderResumenMes();
    renderLista();
  }

  /* ---------- Eventos ---------- */
  el.tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      estado.pestana = tab.dataset.tab;
      renderPestanas();
      renderLista();
    });
  });

  /* ---------- Inicio ---------- */
  async function iniciar() {
    el.lista.setAttribute("aria-busy", "true");
    try {
      estado.partidos = await obtenerMisPartidos();
    } catch {
      estado.partidos = [];
    }
    renderTodo();
    el.lista.setAttribute("aria-busy", "false");
  }

  iniciar();
})();