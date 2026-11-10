/* =========================================================
   crear-partido.js — lógica de esta pantalla (solo front)

   - El resumen de la derecha se arma en vivo con lo que se
     va completando.
   - "Publicar partido" valida, guarda el partido de forma
     simulada y abre la ventana de "Partido confirmado".
     Para conectar el backend, reemplazá solo `publicarPartido`.

   La seña (30 %) y su aprobación están SIMULADAS: no hay
   integración de pago todavía.
   ========================================================= */

(() => {
  if (!Auth.requerir()) return;

  const usuario = Auth.usuario();
  const $ = (id) => document.getElementById(id);

  const PORCENTAJE_SENA = 0.3;
  const MAX_JUGADORES_GENERAL = 22;

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
    duracion: $("duracion"),
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
    ubicacion: { grupo: $("field-ubicacion"), error: $("error-ubicacion") }
  };

  let jugadores = 1;

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
  const tope = () => MODALIDADES[modalidadActual()]?.jugadoresTotales || MAX_JUGADORES_GENERAL;

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
      duracion: Number(el.duracion.value),
      jugadores,
      precio: leerPrecio(),
      ubicacion: el.ubicacion.value.trim(),
      detalle: el.detalle.value.trim()
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
      Boolean(v.duracion),
      v.jugadores >= 1,
      v.precio !== null && v.precio > 0,
      v.ubicacion.length > 0
    ];
    return Math.round((completos.filter(Boolean).length / completos.length) * 100);
  }

  // "Nombre, dirección…" → { nombre, direccion }
  function partirUbicacion(texto) {
    const [nombre, ...resto] = texto.split(",");
    return { nombre: nombre.trim(), direccion: resto.join(",").trim() };
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
    if (!v.ubicacion) msg = "Ingresá la cancha y su dirección.";
    else if (v.ubicacion.length < 5) msg = "Es muy corto. Sumá el nombre y la dirección.";
    marcar("ubicacion", msg, el.ubicacion);

    return fallas;
  }

  // Limpia cada error apenas el usuario corrige ese campo
  form.addEventListener("input", (e) => {
    const id = e.target.id || e.target.name;
    if (campos[id]) setError(id, "");
    el.errorGeneral.classList.remove("is-visible");
    renderResumen();
  });
  form.addEventListener("change", (e) => {
    if (e.target.name === "modalidad") {
      setError("modalidad", "");
      pintarJugadores(); // el máximo depende de la modalidad
    }
    if (e.target.id === "fecha") setError("hora", "");
    renderResumen();
  });

  /* =======================================================
     Publicación (simulada)
     ======================================================= */
  async function publicarPartido(datos) {
    await new Promise((r) => setTimeout(r, 700));

    const partido = {
      id: `p-${Date.now()}`,
      creadorEmail: usuario.email,
      modalidad: MODALIDADES[datos.modalidad].nombre,
      fecha: `${datos.fecha}T${datos.hora}:00`,
      duracionMin: datos.duracion,
      jugadoresFaltantes: datos.jugadores,
      precioCancha: datos.precio,
      ubicacion: datos.ubicacion,
      detalle: datos.detalle,
      creadoEn: new Date().toISOString()
    };

    const partidos = Store.get("partidos_publicados", []);
    partidos.push(partido);
    if (!Store.set("partidos_publicados", partidos)) {
      throw new Error("No pudimos guardar el partido: el almacenamiento del navegador está lleno.");
    }
    return partido;
  }

  function cargando(estado) {
    el.publicar.disabled = estado;
    el.publicar.classList.toggle("is-loading", estado);
  }

  function reiniciarFormulario() {
    form.reset();
    jugadores = 1;
    Object.keys(campos).forEach((n) => setError(n, ""));
    el.errorGeneral.classList.remove("is-visible");
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

  // "21:00" + 90 min → "22:30"
  function horaFin(hora, minutos) {
    const [h, m] = hora.split(":").map(Number);
    const total = (h * 60 + m + minutos) % (24 * 60);
    return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
  }

  function abrirModal(partido, datos) {
    const { nombre, direccion } = partirUbicacion(datos.ubicacion);
    const cuando = `${formatoFechaCorta(datos.fecha)} · ${datos.hora}–${horaFin(datos.hora, datos.duracion)}`;

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
  pintarJugadores();
  renderResumen();
})();