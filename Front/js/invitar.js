/* =========================================================
   invitar.js — link de invitación a un equipo (público)

   Cualquiera con el link puede entrar:
   - Si tiene sesión, se suma con su cuenta.
   - Si no, se suma como "invitado" (sin cuenta ni contraseña).

   Endpoints (backend Go):
     GET  /api/invitacion/{token}   qué equipo es
     POST /api/invitacion/{token}   me sumo al equipo
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  const token = new URLSearchParams(location.search).get("token");
  const sesion = Auth.sesion();

  const estados = {
    cargando: $("estado-cargando"),
    error: $("estado-error"),
    equipo: $("estado-equipo"),
    ok: $("estado-ok")
  };

  function mostrar(estado) {
    for (const [nombre, nodo] of Object.entries(estados)) {
      nodo.hidden = nombre !== estado;
    }
  }

  function setErrorCampo(nombre, mensaje) {
    const campo = $(`field-${nombre}`);
    const error = $(`error-${nombre}`);
    if (campo) campo.classList.toggle("has-error", Boolean(mensaje));
    if (error) error.textContent = mensaje;
  }

  function setErrorGeneral(mensaje) {
    const el = $("error-general");
    el.textContent = mensaje || "";
    el.classList.toggle("is-visible", Boolean(mensaje));
  }

  /* ---------- Cargo el equipo del link ---------- */
  async function cargarEquipo() {
    if (!token) {
      mostrar("error");
      $("error-texto").textContent = "Este link está incompleto. Pedile uno nuevo al equipo.";
      return;
    }

    mostrar("cargando");
    try {
      const eq = await API.get(`/api/invitacion/${encodeURIComponent(token)}`);
      $("equipo-nombre").textContent = eq.equipo;
      $("equipo-meta").textContent =
        `${eq.integrantes} ${eq.integrantes === 1 ? "integrante" : "integrantes"}`;

      if (sesion) {
        const quien = [sesion.nombre, sesion.apellido].filter(Boolean).join(" ") || sesion.email || "";
        $("sesion-nombre").textContent = quien
          ? `Estás ingresando como ${quien}.`
          : "Vas a sumarte con tu cuenta.";
        $("form-sesion").hidden = false;
        $("form-invitar").hidden = true;
      } else {
        $("form-sesion").hidden = true;
        $("form-invitar").hidden = false;
      }
      mostrar("equipo");
    } catch (err) {
      mostrar("error");
      $("error-texto").textContent = err.message ||
        "El link no existe o alguien lo desactivó.";
    }
  }

  /* ---------- Éxito ---------- */
  function listo({ mensaje, conSesion }) {
    $("ok-texto").textContent = mensaje;
    const primario = $("ok-primario");
    if (conSesion) {
      primario.href = APP.rutas.equipos;
      primario.textContent = "Ver mis equipos";
      document.querySelector("#estado-ok .btn--ghost").href = APP.rutas.buscar;
      document.querySelector("#estado-ok .btn--ghost").textContent = "Buscar partidos";
    } else {
      primario.href = APP.rutas.registro;
      primario.textContent = "Crear mi cuenta";
      document.querySelector("#estado-ok .btn--ghost").href = APP.rutas.login;
      document.querySelector("#estado-ok .btn--ghost").textContent = "Iniciar sesión";
    }
    mostrar("ok");
  }

  async function unirse(cuerpo) {
    const res = await API.post(`/api/invitacion/${encodeURIComponent(token)}`, cuerpo);
    listo({
      mensaje: `Ya formas parte de ${res.equipo}.`,
      conSesion: Boolean(sesion)
    });
  }

  /* ---------- Con sesión: una sola acción ---------- */
  $("form-sesion").addEventListener("submit", async (e) => {
    e.preventDefault();
    setErrorGeneral("");
    const btn = $("btn-sesion");
    btn.disabled = true;
    try {
      await unirse({});
    } catch (err) {
      setErrorGeneral(err.message);
      btn.disabled = false;
    }
  });

  // Cambiar de cuenta desde el link
  $("btn-salir").addEventListener("click", async (e) => {
    e.preventDefault();
    try { await API.post("/api/auth/logout"); } catch { /* igual salimos */ }
    Store.remove("sesion");
    location.reload();
  });

  /* ---------- Sin sesión: invitado ---------- */
  const campos = {
    nombre: { input: $("nombre"), obligatorio: true },
    apellido: { input: $("apellido"), obligatorio: false }
  };

  Object.entries(campos).forEach(([nombre, campo]) => {
    campo.input.addEventListener("input", () => {
      setErrorCampo(nombre, "");
      setErrorGeneral("");
    });
  });

  $("form-invitar").addEventListener("submit", async (e) => {
    e.preventDefault();
    setErrorGeneral("");
    setErrorCampo("nombre", "");
    setErrorCampo("apellido", "");

    const nombre = campos.nombre.input.value.trim();
    const apellido = campos.apellido.input.value.trim();
    if (!nombre) {
      setErrorCampo("nombre", "Poné tu nombre para unirte.");
      campos.nombre.input.focus();
      return;
    }

    const btn = $("btn-unirse");
    btn.disabled = true;
    try {
      await unirse({ nombre, apellido });
    } catch (err) {
      setErrorGeneral(err.message);
      btn.disabled = false;
    }
  });

  cargarEquipo();
})();
