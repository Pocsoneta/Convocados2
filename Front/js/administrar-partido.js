/* =========================================================
   administrar-partido.js — lógica de esta pantalla

   Solo la organiza el usuario que creó el partido. Desde acá
   acepta o rechaza solicitudes, quita participantes y cancela.
   El cupo es un número: no hay lugares por posición.

   Endpoints (backend Go):
     GET    /api/partidos/{id}/administracion
     POST   /api/partidos/{id}/solicitudes/{usuario}/aceptar
     DELETE /api/partidos/{id}/solicitudes/{usuario}
     DELETE /api/partidos/{id}/participantes/{usuario}
     POST   /api/partidos/{id}/equipos/{equipo}/aceptar
     DELETE /api/partidos/{id}/equipos/{equipo}   (rechaza o quita un equipo)
     POST   /api/partidos/{id}/cancelar
   ========================================================= */

(() => {
  if (!Auth.sesion()) return;

  const $ = (id) => document.getElementById(id);
  const ID = new URLSearchParams(location.search).get("id");

  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const dos = (n) => String(n).padStart(2, "0");

  const estado = {
    partido: null,
    solicitudes: [],
    solicitudesEquipos: [],
    confirmados: [],
    equipos: []
  };

  const el = {
    subtitulo: $("subtitulo"),
    btnVer: $("btn-ver"),
    modalidad: $("modalidad"),
    cuenta: $("cuenta"),
    solicitudesN: $("solicitudes-n"),
    solicitudes: $("solicitudes"),
    confirmados: $("confirmados"),
    faltan: $("faltan"),
    aviso: $("aviso"),
    avisoTitulo: $("aviso-titulo"),
    avisoTexto: $("aviso-texto"),
    btnCancelar: $("btn-cancelar"),
    admin: $("admin")
  };

  /* ---------- Helpers ---------- */
  function nodo(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }

  function iniciales(nombre) {
    return nombre.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  // Lugares ocupados: los confirmados uno por uno más los integrantes
  // de cada equipo inscripto (lo trae calculado el backend en
  // partido.inscripciones).
  function ocupados() {
    const n = Number(estado.partido.inscripciones);
    return Number.isFinite(n) ? n : estado.confirmados.length;
  }

  // Lugares que todavía se pueden ocupar
  function lugaresLibres() {
    return Math.max(0, estado.partido.cupoTotal - ocupados());
  }

  function formatoFecha(iso) {
    const f = new Date(iso);
    const hoy = new Date();
    const mismoDia = f.toDateString() === hoy.toDateString();
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    const hora = `${dos(f.getHours())}:${dos(f.getMinutes())} hs`;
    if (mismoDia) return `Hoy, ${hora}`;
    if (f.toDateString() === manana.toDateString()) return `Mañana, ${hora}`;
    return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}, ${hora}`;
  }

  function persona(p) {
    const wrap = nodo("div", "persona");
    const nombre = [p.nombre, p.apellido].filter(Boolean).join(" ");
    const avatar = nodo("span", "persona__avatar");
    if (p.foto) {
      const img = nodo("img");
      img.src = p.foto;
      img.alt = "";
      avatar.appendChild(img);
    } else {
      avatar.textContent = iniciales(nombre);
    }
    wrap.append(avatar, nodo("span", "persona__nombre", nombre));
    return wrap;
  }

  /* =======================================================
     Render
     ======================================================= */
  function renderEncabezado() {
    const p = estado.partido;
    el.subtitulo.textContent = `${p.nombre} · ${formatoFecha(p.fecha)} · ${p.zona}`;
    el.btnVer.href = `detalle-partido.html?id=${encodeURIComponent(p.id)}`;
    el.modalidad.textContent = p.modalidad;
    el.cuenta.textContent = `${ocupados()}/${p.cupoTotal}`;
  }

  // Todas las solicitudes pendientes: las de jugadores (una por una)
  // y las de equipos, que ocupan un cupo por integrante.
  function pendientes() {
    const jugadores = (estado.solicitudes || []).map((s) => ({ ...s, tipo: "usuario" }));
    const equipos = (estado.solicitudesEquipos || []).map((e) => ({ ...e, tipo: "equipo" }));
    return [...jugadores, ...equipos];
  }

  function renderSolicitudes() {
    const lista = pendientes();
    const n = lista.length;
    el.solicitudesN.hidden = n === 0;
    el.solicitudesN.textContent = n === 1 ? "1 nueva" : `${n} nuevas`;

    if (!n) {
      el.solicitudes.replaceChildren(nodo("li", "vacio", "No hay solicitudes pendientes."));
      return;
    }

    const libres = lugaresLibres();
    el.solicitudes.replaceChildren(
      ...lista.map((s) => {
        const esEquipo = s.tipo === "equipo";
        const ocupa = esEquipo ? s.integrantes : 1;
        const sinLugar = libres < ocupa;

        const li = nodo("li", "solicitud");
        const acciones = nodo("div", "solicitud__acciones");

        const rechazar = nodo("button", "btn btn--reject", "Rechazar");
        rechazar.type = "button";
        rechazar.dataset.accion = esEquipo ? "rechazar-equipo" : "rechazar";
        rechazar.dataset.id = s.id;

        const aceptar = nodo("button", "btn btn--accept", "Aceptar");
        aceptar.type = "button";
        aceptar.dataset.accion = esEquipo ? "aceptar-equipo" : "aceptar";
        aceptar.dataset.id = s.id;
        aceptar.disabled = sinLugar;
        aceptar.title = sinLugar
          ? "No entran todos los integrantes en los cupos libres"
          : "";

        acciones.append(rechazar, aceptar);

        const quien = esEquipo
          ? persona({ nombre: s.nombre, apellido: "", foto: "" })
          : persona(s);
        if (esEquipo) {
          quien.appendChild(nodo("span", "persona__tag", "Equipo"));
          quien.appendChild(nodo("span", "persona__extra",
            `${s.integrantes} ${s.integrantes === 1 ? "integrante" : "integrantes"}`));
        }

        li.append(quien, acciones);
        return li;
      })
    );
  }

  function renderConfirmados() {
    const equipos = estado.equipos || [];

    if (!estado.confirmados.length && !equipos.length) {
      el.confirmados.replaceChildren(nodo("li", "vacio", "Todavía no hay participantes confirmados."));
      return;
    }

    const items = estado.confirmados.map((c) => {
      const li = nodo("li", "confirmado");
      const quitar = nodo("button", "btn btn--quit", "Quitar");
      quitar.type = "button";
      quitar.dataset.accion = "quitar";
      quitar.dataset.id = c.id;
      li.append(persona(c), quitar);
      return li;
    });

    // Equipos inscriptos: ocupan un cupo por integrante
    for (const eq of equipos) {
      const li = nodo("li", "confirmado");
      const quitar = nodo("button", "btn btn--quit", "Quitar");
      quitar.type = "button";
      quitar.dataset.accion = "quitar-equipo";
      quitar.dataset.id = eq.id;

      const quien = persona({ nombre: eq.nombre, apellido: "", foto: "" });
      quien.appendChild(nodo("span", "persona__extra",
        `${eq.integrantes} ${eq.integrantes === 1 ? "integrante" : "integrantes"}`));

      li.append(quien, quitar);
      items.push(li);
    }

    el.confirmados.replaceChildren(...items);
  }

  // Cuántos lugares faltan por cubrir
  function renderFaltan() {
    const libres = lugaresLibres();

    if (!libres) {
      el.faltan.replaceChildren(nodo("li", "chip chip--completo", "Convocatoria completa"));
      el.aviso.hidden = true;
      return;
    }

    el.faltan.replaceChildren(nodo("li", "chip", libres === 1 ? "1 lugar libre" : `${libres} lugares libres`));
    el.aviso.hidden = false;
    el.avisoTitulo.textContent = "Completá la convocatoria";
    el.avisoTexto.textContent = "Aceptá a los jugadores que quieren sumarse hasta llenar el cupo.";
  }

  function renderTodo() {
    renderEncabezado();
    renderSolicitudes();
    renderConfirmados();
    renderFaltan();
    if (estado.partido.estado === "Cancelado") bloquear();
  }

  // Partido cancelado: la pantalla queda solo para consulta
  function bloquear() {
    el.subtitulo.textContent = `${el.subtitulo.textContent} · Cancelado`;
    el.btnCancelar.disabled = true;
    el.btnCancelar.textContent = "Partido cancelado";
    el.admin.querySelectorAll("button[data-accion]").forEach((b) => { b.disabled = true; });
  }

  /* =======================================================
     Datos y acciones
     ======================================================= */
  async function cargar() {
    const datos = await API.get(`/api/partidos/${encodeURIComponent(ID)}/administracion`);
    estado.partido = datos.partido;
    estado.solicitudes = datos.solicitudes;
    estado.solicitudesEquipos = datos.solicitudesEquipos || [];
    estado.confirmados = datos.confirmados;
    estado.equipos = datos.equipos || [];
  }

  // Ejecuta una acción contra el backend y vuelve a leer el partido
  async function accion(peticion) {
    try {
      await peticion();
      await cargar();
      renderTodo();
    } catch (err) {
      window.alert(err.message);
      try { await cargar(); renderTodo(); } catch { /* se queda con lo último que se vio */ }
    }
  }

  function aceptar(id) {
    return accion(() => API.post(`/api/partidos/${ID}/solicitudes/${id}/aceptar`));
  }

  function rechazar(id) {
    return accion(() => API.del(`/api/partidos/${ID}/solicitudes/${id}`));
  }

  // Aceptar la solicitud de un equipo: recién ahí ocupa cupos
  function aceptarEquipo(id) {
    const eq = (estado.solicitudesEquipos || []).find((x) => x.id === id);
    if (!eq) return;
    return accion(() => API.post(`/api/partidos/${ID}/equipos/${id}/aceptar`));
  }

  // Rechazar la solicitud de un equipo (borra la inscripción del equipo
  // en el partido; no ocupa cupos porque estaba pendiente)
  function rechazarEquipo(id) {
    return accion(() => API.del(`/api/partidos/${ID}/equipos/${id}`));
  }

  function quitar(id) {
    const c = estado.confirmados.find((x) => x.id === id);
    if (!c || !window.confirm(`¿Quitar a ${c.nombre} ${c.apellido} del partido?`)) return;
    return accion(() => API.del(`/api/partidos/${ID}/participantes/${id}`));
  }

  function quitarEquipo(id) {
    const eq = (estado.equipos || []).find((x) => x.id === id);
    if (!eq || !window.confirm(`¿Quitar al equipo ${eq.nombre} del partido?`)) return;
    return accion(() => API.del(`/api/partidos/${ID}/equipos/${id}`));
  }

  function cancelar() {
    if (!window.confirm("¿Cancelar el partido?")) return;
    return accion(() => API.post(`/api/partidos/${ID}/cancelar`));
  }

  el.admin.addEventListener("click", (e) => {
    const boton = e.target.closest("button[data-accion]");
    if (boton) {
      const id = Number(boton.dataset.id);
      const acciones = {
        aceptar, rechazar, quitar,
        "aceptar-equipo": aceptarEquipo,
        "rechazar-equipo": rechazarEquipo,
        "quitar-equipo": quitarEquipo
      };
      acciones[boton.dataset.accion]?.(id);
      return;
    }
    if (e.target === el.btnCancelar) cancelar();
  });

  /* ---------- Inicio ---------- */
  async function iniciar() {
    if (!ID) {
      el.subtitulo.textContent = "Falta el partido a administrar.";
      return;
    }
    el.admin.setAttribute("aria-busy", "true");
    try {
      await cargar();
    } catch (err) {
      el.subtitulo.textContent = err.message || "No pudimos cargar el partido.";
      el.admin.setAttribute("aria-busy", "false");
      return;
    }
    renderTodo();
    el.admin.setAttribute("aria-busy", "false");
  }

  iniciar();
})();
