/* =========================================================
   equipos.js — lógica de esta pantalla

   - Muestra los equipos del usuario (GET /api/equipos/mis-equipos).
   - Permite crear un equipo (POST /api/equipos).
   - Permite buscar equipos (GET /api/equipos?q=).
   - Al abrir uno, muestra y administra sus integrantes
     (GET /api/equipos/{id}, DELETE .../integrantes).
   - Invitar no es sumar a la fuerza: se le manda una solicitud
     al jugador y él la acepta o rechaza desde acá.

   Endpoints de invitaciones:
     POST   /api/equipos/{id}/integrantes          (envía la invitación)
     GET    /api/equipos/{id}/invitaciones         (las que mandó el equipo)
     DELETE /api/equipos/{id}/invitaciones/{usuario} (la cancela un integrante)
     GET    /api/invitaciones                      (las que me llegaron)
     POST   /api/invitaciones/{equipo}/aceptar
     POST   /api/invitaciones/{equipo}/rechazar

   Link de invitación (gente sin cuenta que se suma como invitado):
     POST   /api/equipos/{id}/link      genera o regenera
     DELETE /api/equipos/{id}/link      lo revoca
   ========================================================= */

(() => {
  if (!Auth.requerir()) return;

  const $ = (id) => document.getElementById(id);

  const estado = {
    mios: [],
    invitaciones: [], // las que me llegaron y no respondí
    equipo: null      // equipo abierto en la ventana modal
  };

  const ICONO_EQUIPO =
    '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="9" cy="8" r="3.2"/>' +
    '<path d="M3 19c0-3.3 2.7-5.2 6-5.2s6 1.9 6 5.2"/>' +
    '<path d="M16.2 5.7a3.2 3.2 0 0 1 0 5.6"/>' +
    '<path d="M17.6 14.2c2 .7 3.4 2.3 3.4 4.8"/></svg>';

  const ICONO_PERSONA =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<circle cx="12" cy="8" r="3.6"/><path d="M4.5 20c0-4 3.4-6.2 7.5-6.2s7.5 2.2 7.5 6.2"/></svg>';

  const nodo = (tag, clase, texto) => {
    const n = document.createElement(tag);
    if (clase) n.className = clase;
    if (texto !== undefined) n.textContent = texto;
    return n;
  };

  const iniciales = (nombre, apellido) =>
    ((nombre || "").charAt(0) + (apellido || "").charAt(0)).toUpperCase() || "?";

  /* =======================================================
     Tus equipos
     ======================================================= */
  function tarjetaEquipo(eq) {
    const li = nodo("li");
    const card = nodo("div", "equipo");

    const marca = nodo("span", "equipo__marca");
    marca.innerHTML = ICONO_EQUIPO;

    const body = nodo("div", "equipo__body");
    body.appendChild(nodo("h3", "equipo__name", eq.nombre));

    const meta = nodo("div", "equipo__meta");
    meta.appendChild(nodo("span", "equipo__meta-item",
      `${eq.integrantes} ${eq.integrantes === 1 ? "integrante" : "integrantes"}`));
    if (eq.esMio) meta.appendChild(nodo("span", "equipo__tag", "Es tuyo"));
    body.appendChild(meta);

    const ver = nodo("button", "equipo__ver", "Ver equipo");
    ver.type = "button";
    ver.addEventListener("click", () => abrirEquipo(eq.id));

    card.append(marca, body, ver);
    li.appendChild(card);
    return li;
  }

  function bloqueVacio(titulo, texto) {
    const li = nodo("li");
    const caja = nodo("div", "empty");
    const icono = nodo("span", "empty__icon");
    icono.innerHTML = ICONO_EQUIPO;
    caja.append(icono, nodo("p", "empty__title", titulo), nodo("p", "empty__text", texto));
    li.appendChild(caja);
    return li;
  }

  function renderMios() {
    const lista = $("lista-mios");
    lista.replaceChildren(
      ...(estado.mios.length
        ? estado.mios.map(tarjetaEquipo)
        : [bloqueVacio(
            "Todavía no tenés equipos",
            "Creá tu primer equipo y usalo para inscribirte en partidos junto a tus jugadores.")])
    );
  }

  async function cargarMios() {
    $("lista-mios").setAttribute("aria-busy", "true");
    try {
      estado.mios = await API.get("/api/equipos/mis-equipos");
    } catch {
      estado.mios = [];
    }
    renderMios();
    $("lista-mios").setAttribute("aria-busy", "false");
  }

  /* =======================================================
     Invitaciones recibidas — GET /api/invitaciones
     ======================================================= */
  function avatarDe(nombre, apellido, foto) {
    const av = nodo("span", "invitacion__avatar");
    if (foto) {
      const img = document.createElement("img");
      img.src = foto;
      img.alt = "";
      av.appendChild(img);
    } else {
      av.textContent = iniciales(nombre, apellido);
    }
    return av;
  }

  function renderInvitaciones() {
    const n = estado.invitaciones.length;
    $("bloque-invitaciones").hidden = n === 0;
    $("invitaciones-n").hidden = n === 0;
    $("invitaciones-n").textContent = n === 1 ? "1 nueva" : `${n} nuevas`;
    if (!n) {
      $("lista-invitaciones").replaceChildren();
      return;
    }

    $("lista-invitaciones").replaceChildren(...estado.invitaciones.map((inv) => {
      const li = nodo("li", "invitacion");
      li.appendChild(avatarDe(inv.nombreInvitador, inv.apellidoInvitador, inv.fotoInvitador));

      const quien = [inv.nombreInvitador, inv.apellidoInvitador].filter(Boolean).join(" ");
      const info = nodo("div", "invitacion__info");
      info.append(
        nodo("strong", "invitacion__nombre", inv.equipo),
        nodo("span", "invitacion__sub", quien ? `Te invitó ${quien}` : "Te invitaron a este equipo")
      );

      const acciones = nodo("div", "invitacion__acciones");

      const rechazar = nodo("button", "invitacion__btn invitacion__btn--no", "Rechazar");
      rechazar.type = "button";
      rechazar.addEventListener("click", () => responderInvitacion(inv, false, rechazar));

      const aceptar = nodo("button", "invitacion__btn invitacion__btn--ok", "Aceptar");
      aceptar.type = "button";
      aceptar.addEventListener("click", () => responderInvitacion(inv, true, aceptar));

      acciones.append(rechazar, aceptar);
      li.append(info, acciones);
      return li;
    }));
  }

  async function responderInvitacion(inv, aceptar, btn) {
    btn.disabled = true;
    btn.textContent = "…";
    errorGeneral("error-invitaciones", "");
    try {
      await API.post(`/api/invitaciones/${inv.idEquipo}/${aceptar ? "aceptar" : "rechazar"}`);
      await Promise.all([cargarInvitaciones(), cargarMios()]);
    } catch (err) {
      btn.disabled = false;
      btn.textContent = aceptar ? "Aceptar" : "Rechazar";
      errorGeneral("error-invitaciones", err.message);
    }
  }

  async function cargarInvitaciones() {
    try {
      estado.invitaciones = (await API.get("/api/invitaciones")) || [];
    } catch {
      estado.invitaciones = [];
    }
    renderInvitaciones();
  }

  /* =======================================================
     Crear equipo — POST /api/equipos
     ======================================================= */
  function setErrorCampo(nombre, mensaje) {
    const campo = $(`field-${nombre}`);
    const error = $(`error-${nombre}`);
    if (campo) campo.classList.toggle("has-error", Boolean(mensaje));
    if (error) error.textContent = mensaje;
  }

  function errorGeneral(id, mensaje) {
    const el = $(id);
    el.textContent = mensaje || "";
    el.classList.toggle("is-visible", Boolean(mensaje));
  }

  $("form-crear").addEventListener("submit", async (e) => {
    e.preventDefault();
    errorGeneral("error-crear", "");
    setErrorCampo("nombre", "");

    const nombre = $("nombre-equipo").value.trim();
    if (!nombre) {
      setErrorCampo("nombre", "Poné un nombre para el equipo.");
      $("nombre-equipo").focus();
      return;
    }

    const btn = $("btn-crear");
    btn.disabled = true;
    btn.classList.add("is-loading");
    try {
      const creado = await API.post("/api/equipos", { nombre });
      $("nombre-equipo").value = "";
      // Lo sumamos a la lista de inmediato para no recargar todo
      estado.mios = [...estado.mios, creado].sort((a, b) => a.nombre.localeCompare(b.nombre));
      renderMios();
      await abrirEquipo(creado.id);
    } catch (err) {
      errorGeneral("error-crear", err.message);
    } finally {
      btn.disabled = false;
      btn.classList.remove("is-loading");
    }
  });

  $("nombre-equipo").addEventListener("input", () => setErrorCampo("nombre", ""));

  /* =======================================================
     Buscar equipos — GET /api/equipos?q=
     ======================================================= */
  const busqueda = { timer: null, pedido: 0 };

  function pintarBusqueda(items) {
    const lista = $("lista-busqueda");
    lista.replaceChildren();

    if (!items) return;
    if (!items.length) {
      lista.appendChild(nodo("li", "resultado__vacio", "No encontramos equipos con ese nombre."));
      return;
    }
    for (const eq of items) {
      const li = nodo("li", "resultado");
      const info = nodo("div", "resultado__info");
      info.append(
        nodo("span", "resultado__nombre", eq.nombre),
        nodo("span", "resultado__sub", `${eq.integrantes} ${eq.integrantes === 1 ? "integrante" : "integrantes"}`)
      );
      const btn = nodo("button", "resultado__btn", "Ver");
      btn.type = "button";
      btn.addEventListener("click", () => abrirEquipo(eq.id));
      li.append(info, btn);
      lista.appendChild(li);
    }
  }

  $("buscar-equipo").addEventListener("input", (e) => {
    const texto = e.target.value.trim();
    clearTimeout(busqueda.timer);
    if (texto.length < 2) {
      $("lista-busqueda").replaceChildren();
      return;
    }
    const pedido = ++busqueda.pedido;
    busqueda.timer = setTimeout(async () => {
      try {
        const items = await API.get(`/api/equipos?q=${encodeURIComponent(texto)}`);
        if (pedido === busqueda.pedido) pintarBusqueda(items);
      } catch { /* sin resultados */ }
    }, 350);
  });

  /* =======================================================
     Detalle del equipo (modal)
     ======================================================= */
  const modal = $("modal-equipo");
  const dialogo = modal.querySelector(".eqmodal__dialog");
  let focoPrevio = null;

  function abrirModal() {
    if (!modal.hidden) return;
    focoPrevio = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("modal-abierto");
    dialogo.focus();
  }

  function cerrarModal() {
    if (modal.hidden) return;
    modal.hidden = true;
    document.body.classList.remove("modal-abierto");
    estado.equipo = null;
    $("lista-jugadores").replaceChildren();
    $("lista-enviadas").replaceChildren();
    $("bloque-enviadas").hidden = true;
    $("bloque-link").hidden = true;
    $("link-activo").hidden = true;
    $("btn-generar-link").hidden = true;
    $("link-url").value = "";
    $("btn-copiar").textContent = "Copiar";
    $("buscar-jugador").value = "";
    errorGeneral("error-equipo", "");
    if (focoPrevio && typeof focoPrevio.focus === "function") focoPrevio.focus();
  }

  function pintarIntegrantes() {
    const eq = estado.equipo;
    const lista = $("lista-integrantes");
    lista.replaceChildren();

    if (!eq) return;
    for (const p of eq.integrantes) {
      const li = nodo("li", "integrante");

      const av = nodo("span", "integrante__avatar");
      if (p.foto) {
        const img = document.createElement("img");
        img.src = p.foto;
        img.alt = "";
        av.appendChild(img);
      } else {
        av.textContent = iniciales(p.nombre, p.apellido);
      }

      const nombre = nodo("span", "integrante__nombre", `${p.nombre} ${p.apellido}`.trim());
      li.append(av, nombre);

      if (p.esInvitado) {
        li.appendChild(nodo("span", "integrante__tag", "Invitado"));
      }

      if (p.id === (Auth.sesion() || {}).id) {
        li.appendChild(nodo("span", "integrante__yo", "Vos"));
      } else if (eq.esMio) {
        const quitar = nodo("button", "integrante__quitar", "Quitar");
        quitar.type = "button";
        quitar.addEventListener("click", () => quitarIntegrante(p.id));
        li.appendChild(quitar);
      }

      lista.appendChild(li);
    }

    if (!eq.integrantes.length) {
      lista.appendChild(nodo("li", "resultado__vacio", "Todavía no hay integrantes."));
    }
  }

  async function abrirEquipo(id) {
    try {
      const eq = await API.get(`/api/equipos/${id}`);
      estado.equipo = eq;
      $("eqmodal-titulo").textContent = eq.nombre;
      $("eqmodal-lead").textContent = eq.esMio
        ? "Integrantes del equipo. Podés invitar o quitar jugadores."
        : "Integrantes del equipo.";
      $("bloque-sumar").hidden = !eq.esMio;
      pintarIntegrantes();
      pintarEnviadas();
      pintarLink();
      abrirModal();
    } catch (err) {
      errorGeneral("error-crear", err.message);
    }
  }

  /* ---------- Invitaciones enviadas (pendientes) ---------- */
  function pintarEnviadas() {
    const eq = estado.equipo;
    const bloque = $("bloque-enviadas");
    const lista = $("lista-enviadas");
    lista.replaceChildren();

    const enviadas = (eq && eq.invitaciones) || [];
    bloque.hidden = !enviadas.length;
    if (!enviadas.length) return;

    for (const inv of enviadas) {
      const li = nodo("li", "resultado");
      const info = nodo("div", "resultado__info");
      info.append(
        nodo("span", "resultado__nombre", `${inv.nombre} ${inv.apellido}`.trim()),
        nodo("span", "resultado__sub", "Esperando respuesta")
      );

      const btn = nodo("button", "resultado__btn resultado__btn--ghost", "Cancelar");
      btn.type = "button";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "…";
        try {
          await API.del(`/api/equipos/${eq.id}/invitaciones/${inv.id}`);
          await abrirEquipo(eq.id);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = "Cancelar";
          errorGeneral("error-equipo", err.message);
        }
      });

      li.append(info, btn);
      lista.appendChild(li);
    }
  }

  /* ---------- Link de invitación ---------- */
  function pintarLink() {
    const eq = estado.equipo;
    const bloque = $("bloque-link");
    // Solo los integrantes del equipo ven (y manejan) el link
    bloque.hidden = !(eq && eq.esMio);
    if (bloque.hidden) return;

    const activo = Boolean(eq.link);
    $("link-activo").hidden = !activo;
    $("btn-generar-link").hidden = activo;
    $("btn-copiar").textContent = "Copiar";
    if (activo) $("link-url").value = eq.linkUrl || "";
  }

  async function generarLink() {
    if (!estado.equipo) return;
    errorGeneral("error-equipo", "");
    try {
      const res = await API.post(`/api/equipos/${estado.equipo.id}/link`);
      estado.equipo.link = res.token;
      estado.equipo.linkUrl = res.url;
      pintarLink();
      await cargarMios();
    } catch (err) {
      errorGeneral("error-equipo", err.message);
    }
  }

  $("btn-generar-link").addEventListener("click", generarLink);

  $("btn-regenerar").addEventListener("click", () => {
    if (!window.confirm(
      "¿Regenerar el link? El anterior va a dejar de funcionar de inmediato.")) return;
    generarLink();
  });

  $("btn-revocar").addEventListener("click", async () => {
    if (!estado.equipo) return;
    if (!window.confirm(
      "¿Revocar el link? Nadie va a poder entrar al equipo por ese link.")) return;
    errorGeneral("error-equipo", "");
    try {
      await API.del(`/api/equipos/${estado.equipo.id}/link`);
      estado.equipo.link = "";
      estado.equipo.linkUrl = "";
      pintarLink();
    } catch (err) {
      errorGeneral("error-equipo", err.message);
    }
  });

  $("btn-copiar").addEventListener("click", async () => {
    const url = $("link-url").value;
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      $("btn-copiar").textContent = "Copiado";
      setTimeout(() => { $("btn-copiar").textContent = "Copiar"; }, 2000);
    } catch {
      // Sin permiso de portapapeles: selecciono el link para copiar a mano
      $("link-url").select();
      $("btn-copiar").textContent = "Seleccionado";
    }
  });

  /* ---------- Invitar integrante ---------- */
  const sumar = { timer: null, pedido: 0 };

  function pintarResultadoJugadores(items, idEquipo) {
    const lista = $("lista-jugadores");
    lista.replaceChildren();
    if (!items) return;

    if (!items.length) {
      lista.appendChild(nodo("li", "resultado__vacio", "No encontramos jugadores con ese nombre."));
      return;
    }

    const eq = estado.equipo || {};
    const integrantes = new Set((eq.integrantes || []).map((p) => p.id));
    const invitados = new Set((eq.invitaciones || []).map((i) => i.id));

    for (const u of items) {
      const li = nodo("li", "resultado");
      const info = nodo("div", "resultado__info");
      info.append(
        nodo("span", "resultado__nombre", `${u.nombre} ${u.apellido}`.trim()),
        nodo("span", "resultado__sub", u.localidad || "Sin localidad")
      );

      let btn;
      if (integrantes.has(u.id)) {
        // Ya forma parte del equipo
        btn = nodo("button", "resultado__btn", "En el equipo");
        btn.type = "button";
        btn.disabled = true;
      } else if (invitados.has(u.id)) {
        // La invitación sigue sin respuesta
        btn = nodo("button", "resultado__btn", "Invitado");
        btn.type = "button";
        btn.disabled = true;
      } else {
        btn = nodo("button", "resultado__btn", "Invitar");
        btn.type = "button";
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          btn.textContent = "…";
          try {
            await API.post(`/api/equipos/${idEquipo}/integrantes`, { idUsuario: u.id });
            await abrirEquipo(idEquipo); // recarga integrantes e invitaciones
            await cargarMios();
            $("buscar-jugador").value = "";
            $("lista-jugadores").replaceChildren();
          } catch (err) {
            btn.disabled = false;
            btn.textContent = "Invitar";
            errorGeneral("error-equipo", err.message);
          }
        });
      }

      li.append(info, btn);
      lista.appendChild(li);
    }
  }

  $("buscar-jugador").addEventListener("input", (e) => {
    const texto = e.target.value.trim();
    clearTimeout(sumar.timer);
    if (texto.length < 2 || !estado.equipo) {
      $("lista-jugadores").replaceChildren();
      return;
    }
    const idEquipo = estado.equipo.id;
    const pedido = ++sumar.pedido;
    sumar.timer = setTimeout(async () => {
      try {
        const items = await API.get(`/api/usuarios?q=${encodeURIComponent(texto)}`);
        if (pedido === sumar.pedido && estado.equipo && estado.equipo.id === idEquipo) {
          pintarResultadoJugadores(items, idEquipo);
        }
      } catch { /* sin resultados */ }
    }, 350);
  });

  async function quitarIntegrante(idUsuario) {
    if (!estado.equipo) return;
    errorGeneral("error-equipo", "");
    try {
      await API.del(`/api/equipos/${estado.equipo.id}/integrantes/${idUsuario}`);
      await abrirEquipo(estado.equipo.id);
      await cargarMios();
    } catch (err) {
      errorGeneral("error-equipo", err.message);
    }
  }

  /* ---------- Cierre de la ventana ---------- */
  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-cerrar]")) cerrarModal();
  });

  document.addEventListener("keydown", (e) => {
    if (modal.hidden) return;
    if (e.key === "Escape") {
      cerrarModal();
      return;
    }
    if (e.key === "Tab") {
      const enfocables = [...dialogo.querySelectorAll("a[href], button:not([disabled]), input:not([disabled])")]
        .filter((el) => el.offsetParent !== null);
      if (!enfocables.length) return;
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
  $("btn-nuevo").addEventListener("click", () => {
    $("nombre-equipo").focus();
    $("nombre-equipo").scrollIntoView({ block: "center", behavior: "smooth" });
  });

  cargarMios();
  cargarInvitaciones();
})();
