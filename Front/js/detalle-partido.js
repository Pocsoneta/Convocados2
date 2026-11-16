/* =========================================================
   detalle-partido.js — lógica de esta pantalla

   Muestra un partido y deja al usuario sumarse. La inscripción
   es una solicitud: queda pendiente hasta que el organizador
   la acepte. También puede sumar su equipo completo, que sigue
   el mismo camino (queda pendiente hasta el aceptarlo).

   Endpoints (backend Go):
     GET    /api/partidos/{id}
     POST   /api/partidos/{id}/inscripcion     (solicitar unirme)
     DELETE /api/partidos/{id}/inscripcion     (cancelar solicitud o darse de baja)
     GET    /api/equipos/mis-equipos           (equipos para el selector)
     POST   /api/partidos/{id}/equipos         (sumar mi equipo, body {idEquipo})
     DELETE /api/partidos/{id}/equipos/{equipo} (cancelar la solicitud del equipo)

   Chat del partido (organizador y confirmados), con polling cada 5 s:
     GET  /api/partidos/{id}/mensajes?desde=   (lo nuevo desde ese id)
     POST /api/partidos/{id}/mensajes          (body {texto})
   ========================================================= */

(() => {
  if (!Auth.sesion()) return;

  const $ = (id) => document.getElementById(id);
  const ID = new URLSearchParams(location.search).get("id");

  const DIAS_CORTOS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const MESES_CORTOS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const dos = (n) => String(n).padStart(2, "0");

  const el = {
    detalle: $("detalle"),
    modalidad: $("modalidad"),
    nombre: $("nombre"),
    lugar: $("lugar"),
    ubicacionDireccion: $("ubicacion-direccion"),
    btnMapa: $("btn-mapa"),
    fecha: $("fecha"),
    horario: $("horario"),
    precio: $("precio"),
    bloqueDescripcion: $("bloque-descripcion"),
    descripcion: $("descripcion"),
    orgAvatar: $("org-avatar"),
    orgNombre: $("org-nombre"),
    contador: $("contador"),
    jugadores: $("jugadores"),
    notaTitulo: $("nota-titulo"),
    notaTexto: $("nota-texto"),
    btnAccion: $("btn-accion"),
    bloqueEquipo: $("bloque-equipo"),
    selectorEquipo: $("selector-equipo"),
    btnEquipo: $("btn-equipo"),
    equipoHint: $("equipo-hint"),
    error: $("error"),
    bloqueChat: $("bloque-chat"),
    chatMensajes: $("chat-mensajes"),
    chatEstado: $("chat-estado"),
    chatForm: $("chat-form"),
    chatTexto: $("chat-texto"),
    chatEnviar: $("chat-enviar"),
    chatError: $("chat-error")
  };

  let datos = null;
  let misEquipos = [];

  /* ---------- Helpers ---------- */
  function nodo(tag, clase, texto) {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  }

  function iniciales(texto) {
    return texto.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  }

  // "Martin P." — nombre y la inicial del apellido
  function nombreCorto(p) {
    const inicial = p.apellido ? ` ${p.apellido.charAt(0)}.` : "";
    return `${p.nombre}${inicial}`;
  }

  // Llena un contenedor con la foto del jugador o con sus iniciales
  function pintarAvatar(contenedor, nombre, foto) {
    contenedor.replaceChildren();
    if (foto) {
      const img = nodo("img");
      img.src = foto;
      img.alt = "";
      contenedor.appendChild(img);
    } else {
      contenedor.textContent = iniciales(nombre);
    }
    return contenedor;
  }

  function avatar(nombre, foto) {
    return pintarAvatar(nodo("span", "persona__avatar"), nombre, foto);
  }

  function fechaTexto(iso) {
    const f = new Date(iso);
    const hoy = new Date();
    const manana = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + 1);
    if (f.toDateString() === hoy.toDateString()) return `Hoy, ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
    if (f.toDateString() === manana.toDateString()) return `Mañana, ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
    return `${DIAS_CORTOS[f.getDay()]} ${f.getDate()} ${MESES_CORTOS[f.getMonth()]}`;
  }

  function horarioTexto(iso) {
    const f = new Date(iso);
    return `${dos(f.getHours())}:${dos(f.getMinutes())} hs`;
  }

  function precioTexto(costoTotal) {
    if (costoTotal == null) return "A confirmar";
    return `$${Math.round(costoTotal).toLocaleString("es-AR")}`;
  }

  /* ---------- Render de la información ---------- */
  function renderInfo(d) {
    const p = d.partido;
    const direccion = p.direccion || p.zona || "";

    document.title = `${p.nombre} · Convocados`;
    el.modalidad.textContent = p.modalidad;
    el.nombre.textContent = p.nombre;
    el.lugar.textContent = direccion;
    el.ubicacionDireccion.textContent = direccion;
    el.btnMapa.href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      p.lat && p.lng ? `${p.lat},${p.lng}` : direccion
    )}`;
    el.fecha.textContent = fechaTexto(p.fecha);
    el.horario.textContent = horarioTexto(p.fecha);
    el.precio.textContent = precioTexto(d.costoTotal);

    el.bloqueDescripcion.hidden = !d.descripcion;
    el.descripcion.textContent = d.descripcion || "";
  }

  function renderOrganizador(d) {
    const org = d.creador;
    if (!org) {
      el.orgNombre.textContent = "Sin organizador";
      return;
    }
    const nombre = `${org.nombre} ${org.apellido}`.trim();
    pintarAvatar(el.orgAvatar, nombre, org.foto);
    el.orgNombre.textContent = nombre;
  }

  // Lista de confirmados, con lugares vacíos para completar el cupo.
  // Los equipos ocupan un lugar por integrante (partido.inscripciones
  // ya trae esa cuenta hecha desde el backend).
  function renderJugadores(d) {
    const confirmados = d.participantes || [];
    const cupo = d.partido.cupoTotal;
    const ocupados = Number(d.partido.inscripciones) || confirmados.length;
    el.contador.textContent = `${ocupados} de ${cupo}`;

    const items = confirmados.map((p) => {
      const esEquipo = p.tipo === "equipo";
      const nombre = esEquipo ? p.nombre : nombreCorto(p);
      const li = nodo("li", "jugador");
      li.append(avatar(nombre, p.foto), nodo("span", "", nombre));

      // Aclaro cuántos jugadores aporta el equipo
      if (esEquipo && p.integrantes > 0) {
        const extra = nodo("small", "jugador__extra",
          `${p.integrantes} ${p.integrantes === 1 ? "integrante" : "integrantes"}`);
        li.appendChild(extra);
      }
      return li;
    });

    const libres = Math.max(0, cupo - ocupados);
    for (let i = 0; i < Math.min(libres, 12); i++) {
      const li = nodo("li", "jugador jugador--libre");
      li.append(avatar("?", null), nodo("span", "", "Buscando"));
      items.push(li);
    }

    el.jugadores.replaceChildren(...items);
  }

  /* ---------- Acción según el estado del usuario ---------- */
  function estadoDeAccion(d) {
    const p = d.partido;
    const pasado = new Date(p.fecha) < new Date();

    if (d.esOrganizador) {
      return {
        titulo: "Sos el organizador",
        texto: "Desde acá podés aceptar solicitudes, quitar jugadores o cancelar el partido.",
        boton: "Administrar partido",
        accion: () => { window.location.href = `administrar-partido.html?id=${encodeURIComponent(p.id)}`; }
      };
    }
    if (d.miEstado === "confirmado") {
      if (d.miEquipo) {
        return {
          titulo: "Tu equipo está confirmado",
          texto: `El organizador aceptó a ${d.miEquipo.nombre}: cada integrante ocupa un cupo.`,
          boton: "No disponible"
        };
      }
      return {
        titulo: "Tenés tu lugar confirmado",
        texto: "El organizador ya te confirmó para este partido.",
        boton: "Darme de baja",
        peligro: true,
        accion: () => darseDeBaja("¿Darte de baja del partido?")
      };
    }
    if (d.miEstado === "pendiente") {
      if (d.miEquipo) {
        return {
          titulo: "La solicitud de tu equipo está en revisión",
          texto: `El organizador va a aceptar o rechazar a ${d.miEquipo.nombre} para este partido.`,
          boton: "Cancelar solicitud",
          peligro: true,
          accion: () => cancelarEquipo("¿Cancelar la solicitud de tu equipo?")
        };
      }
      return {
        titulo: "Tu solicitud está en revisión",
        texto: "El organizador va a confirmar tu lugar en el equipo.",
        boton: "Cancelar solicitud",
        peligro: true,
        accion: () => darseDeBaja("¿Cancelar tu solicitud?")
      };
    }
    if (p.estado === "Cancelado") {
      return { titulo: "Partido cancelado", texto: "Este partido ya no se juega.", boton: "No disponible" };
    }
    if (pasado) {
      return { titulo: "Partido finalizado", texto: "Ya no se pueden enviar solicitudes.", boton: "No disponible" };
    }
    if (p.cupos <= 0) {
      return { titulo: "Sin cupos", texto: "Ya no quedan lugares libres en este partido.", boton: "Sin cupos" };
    }
    return {
      titulo: "Tu solicitud será revisada",
      texto: "El organizador confirmará tu lugar en el equipo.",
      boton: "Solicitar unirme",
      accion: solicitar
    };
  }

  function renderAccion() {
    const a = estadoDeAccion(datos);
    el.notaTitulo.textContent = a.titulo;
    el.notaTexto.textContent = a.texto;
    el.btnAccion.textContent = a.boton;
    el.btnAccion.disabled = !a.accion;
    el.btnAccion.classList.toggle("btn--danger-outline", Boolean(a.peligro));
    el.btnAccion.onclick = a.accion || null;
    renderEquipo();
  }

  /* ---------- Sumar mi equipo ---------- */
  // Muestra el selector + botón si todavía no tengo inscripción y el
  // partido admite solicitudes. Si no tengo equipos, un aviso para crear uno.
  function renderEquipo() {
    const d = datos;
    el.bloqueEquipo.hidden = true;
    el.equipoHint.hidden = true;
    el.equipoHint.textContent = "";
    el.btnEquipo.onclick = null;
    el.btnEquipo.disabled = true;

    if (!d || !d.puedeInscribirse || d.miEquipo) return;

    if (!misEquipos.length) {
      el.equipoHint.hidden = false;
      el.equipoHint.innerHTML =
        '¿Jugás con un equipo? <a class="link-green" href="equipos.html">Crealo desde el menú Equipo</a> ' +
        "y sumalo a este partido.";
      return;
    }

    const elegido = el.selectorEquipo.value;
    el.selectorEquipo.replaceChildren(
      ...misEquipos.map((eq) => {
        const op = document.createElement("option");
        op.value = String(eq.id);
        op.textContent = `${eq.nombre} · ${eq.integrantes} ${eq.integrantes === 1 ? "integrante" : "integrantes"}`;
        return op;
      })
    );
    if ([...el.selectorEquipo.options].some((op) => op.value === elegido)) {
      el.selectorEquipo.value = elegido;
    }

    el.bloqueEquipo.hidden = false;
    el.btnEquipo.disabled = false;
    el.btnEquipo.onclick = sumarEquipo;
  }

  /* ---------- Chat del partido ---------- */
  const chat = {
    timer: null,   // polling cada 5 s
    ultimo: 0,     // último id de mensaje que ya tengo
    vistos: new Set(),
    cargando: false
  };

  // Solo el organizador y los confirmados (individualmente o con su
  // equipo confirmado) entran al chat.
  function puedeChatear(d) {
    return Boolean(d && (d.esOrganizador || d.miEstado === "confirmado"));
  }

  function horaTexto(iso) {
    const f = new Date(iso);
    return `${dos(f.getHours())}:${dos(f.getMinutes())}`;
  }

  function nombreDe(autor) {
    return [autor.nombre, autor.apellido].filter(Boolean).join(" ");
  }

  function pintarMensaje(m) {
    if (chat.vistos.has(m.id)) return null;
    chat.vistos.add(m.id);

    const li = nodo("li", "mensaje");
    if (m.mio) li.classList.add("mensaje--mio");
    if (m.organizador) li.classList.add("mensaje--org");
    else if (m.capitan) li.classList.add("mensaje--capitan");

    li.appendChild(avatar(nombreDe(m.autor), m.autor.foto));

    const cuerpo = nodo("div", "mensaje__cuerpo");
    const fila = nodo("div", "mensaje__fila");
    fila.appendChild(nodo("strong", "mensaje__autor", nombreDe(m.autor) || "Jugador"));
    if (m.organizador) {
      fila.appendChild(nodo("span", "mensaje__rango mensaje__rango--org", "Organizador"));
    }
    if (m.capitan) {
      fila.appendChild(nodo("span", "mensaje__rango mensaje__rango--capitan", "Capitán"));
    }
    fila.appendChild(nodo("span", "mensaje__hora", horaTexto(m.creadoEn)));
    cuerpo.appendChild(fila);
    cuerpo.appendChild(nodo("p", "mensaje__texto", m.texto));
    li.appendChild(cuerpo);
    return li;
  }

  function cercaDelFondo() {
    const c = el.chatMensajes;
    return c.scrollHeight - c.scrollTop - c.clientHeight < 90;
  }

  function agregarMensajes(mensajes) {
    const nuevos = (mensajes || []).map(pintarMensaje).filter(Boolean);
    if (!nuevos.length) return;
    const primeraCarga = !el.chatMensajes.children.length;
    const pegado = cercaDelFondo();

    const frag = document.createDocumentFragment();
    for (const li of nuevos) frag.appendChild(li);
    el.chatMensajes.appendChild(frag);

    if (primeraCarga || pegado) {
      el.chatMensajes.scrollTop = el.chatMensajes.scrollHeight;
    }
  }

  async function refrescarMensajes() {
    if (chat.cargando || !ID) return;
    chat.cargando = true;
    try {
      const ruta = `/api/partidos/${encodeURIComponent(ID)}/mensajes` +
        (chat.ultimo > 0 ? `?desde=${chat.ultimo}` : "");
      const res = await API.get(ruta);
      agregarMensajes(res.mensajes);
      if (res.ultimo > chat.ultimo) chat.ultimo = res.ultimo;
      el.chatError.textContent = "";
      el.chatEstado.textContent = "En vivo · cada 5 s";
    } catch (err) {
      // Si dejé de poder chatear (me saqué del partido), oculto el chat
      if (String(err.message).includes("Solo los jugadores")) {
        pararChat();
        el.bloqueChat.hidden = true;
      } else {
        el.chatError.textContent = err.message;
      }
    } finally {
      chat.cargando = false;
    }
  }

  function pararChat() {
    if (chat.timer) {
      clearInterval(chat.timer);
      chat.timer = null;
    }
    el.chatEstado.textContent = "";
  }

  function renderChat() {
    const activo = puedeChatear(datos);
    el.bloqueChat.hidden = !activo;
    if (!activo) {
      pararChat();
      return;
    }
    el.chatEnviar.disabled = !el.chatTexto.value.trim();
    if (!chat.timer) {
      refrescarMensajes();
      chat.timer = setInterval(refrescarMensajes, 5000);
    }
  }

  el.chatTexto.addEventListener("input", () => {
    el.chatEnviar.disabled = !el.chatTexto.value.trim();
    el.chatError.textContent = "";
  });

  el.chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const texto = el.chatTexto.value.trim();
    if (!texto) return;

    el.chatEnviar.disabled = true;
    el.chatError.textContent = "";
    try {
      const m = await API.post(
        `/api/partidos/${encodeURIComponent(ID)}/mensajes`, { texto });
      el.chatTexto.value = "";
      agregarMensajes([m]);
      if (m && m.id > chat.ultimo) chat.ultimo = m.id;
    } catch (err) {
      el.chatError.textContent = err.message;
    } finally {
      el.chatEnviar.disabled = !el.chatTexto.value.trim();
      el.chatTexto.focus();
    }
  });

  window.addEventListener("pagehide", pararChat);

  /* ---------- Acciones ---------- */
  function mostrarError(mensaje) {
    el.error.textContent = mensaje || "";
  }

  async function recargar() {
    datos = await API.get(`/api/partidos/${encodeURIComponent(ID)}`);
    renderInfo(datos);
    renderOrganizador(datos);
    renderJugadores(datos);
    renderAccion();
    renderChat();
  }

  async function ejecutar(peticion) {
    el.btnAccion.disabled = true;
    el.btnEquipo.disabled = true;
    mostrarError("");
    try {
      await peticion();
      await recargar();
    } catch (err) {
      mostrarError(err.message);
      renderAccion();
    }
  }

  function solicitar() {
    return ejecutar(() => API.post(`/api/partidos/${encodeURIComponent(ID)}/inscripcion`));
  }

  function darseDeBaja(pregunta) {
    if (!window.confirm(pregunta)) return;
    return ejecutar(() => API.del(`/api/partidos/${encodeURIComponent(ID)}/inscripcion`));
  }

  // Suma mi equipo al partido: queda pendiente hasta que el organizador
  // lo acepte (recién ahí ocupa cupos).
  function sumarEquipo() {
    const id = Number(el.selectorEquipo.value);
    const eq = misEquipos.find((x) => x.id === id);
    if (!eq) return;
    const cupos = `${eq.integrantes} ${eq.integrantes === 1 ? "cupo" : "cupos"}`;
    if (!window.confirm(
      `¿Sumar a ${eq.nombre} a este partido? Van a ocupar ${cupos} ` +
      "cuando el organizador lo acepte.")) return;
    return ejecutar(() =>
      API.post(`/api/partidos/${encodeURIComponent(ID)}/equipos`, { idEquipo: eq.id }));
  }

  // Cancela (o baja) la solicitud del equipo en el partido
  function cancelarEquipo(pregunta) {
    const eq = datos && datos.miEquipo;
    if (!eq || !window.confirm(pregunta)) return;
    return ejecutar(() =>
      API.del(`/api/partidos/${encodeURIComponent(ID)}/equipos/${encodeURIComponent(eq.id)}`));
  }

  async function cargarEquipos() {
    try {
      misEquipos = await API.get("/api/equipos/mis-equipos");
    } catch {
      misEquipos = [];
    }
    if (datos) renderEquipo();
  }

  /* ---------- Inicio ---------- */
  async function iniciar() {
    if (!ID) {
      mostrarError("Falta el partido que querés ver.");
      return;
    }
    el.detalle.setAttribute("aria-busy", "true");
    try {
      await recargar();
    } catch (err) {
      mostrarError(err.message || "No pudimos cargar el partido.");
    }
    el.detalle.setAttribute("aria-busy", "false");
    cargarEquipos();
  }

  iniciar();
})();
