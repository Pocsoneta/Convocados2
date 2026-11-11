/* =========================================================
   detalle-partido.js — lógica de esta pantalla

   Muestra un partido y deja al usuario sumarse. La inscripción
   es una solicitud: queda pendiente hasta que el organizador
   la acepte.

   Endpoints (backend Go):
     GET    /api/partidos/{id}
     POST   /api/partidos/{id}/inscripcion     (solicitar unirme)
     DELETE /api/partidos/{id}/inscripcion     (cancelar solicitud o darse de baja)
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
    error: $("error")
  };

  let datos = null;

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

  // Lista de confirmados, con lugares vacíos para completar el cupo
  function renderJugadores(d) {
    const confirmados = d.participantes || [];
    const cupo = d.partido.cupoTotal;
    el.contador.textContent = `${confirmados.length} de ${cupo}`;

    const items = confirmados.map((p) => {
      const nombre = p.tipo === "equipo" ? p.nombre : nombreCorto(p);
      const li = nodo("li", "jugador");
      li.append(avatar(nombre, p.foto), nodo("span", "", nombre));
      return li;
    });

    const libres = Math.max(0, cupo - confirmados.length);
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
      return {
        titulo: "Tenés tu lugar confirmado",
        texto: "El organizador ya te confirmó para este partido.",
        boton: "Darme de baja",
        peligro: true,
        accion: () => darseDeBaja("¿Darte de baja del partido?")
      };
    }
    if (d.miEstado === "pendiente") {
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
  }

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
  }

  async function ejecutar(peticion) {
    el.btnAccion.disabled = true;
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
  }

  iniciar();
})();
