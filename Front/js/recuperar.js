/* =========================================================
   recuperar.js — lógica de esta pantalla

   Dos pasos en la misma página:
     - Sin ?token: se pide el email y el backend envía el enlace.
     - Con ?token: se elige la nueva contraseña.

   Endpoints (backend Go):
     POST /api/auth/recuperar    { email }
     POST /api/auth/restablecer  { token, password }
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  const hero = $("login-hero");
  hero.addEventListener("error", () => hero.remove());

  const token = new URLSearchParams(window.location.search).get("token");
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  /* ---------- Helpers de formulario ---------- */
  function setError(grupo, error, input, mensaje) {
    grupo.classList.toggle("has-error", Boolean(mensaje));
    if (input) input.setAttribute("aria-invalid", mensaje ? "true" : "false");
    error.textContent = mensaje;
  }

  function errorGeneral(elemento, mensaje) {
    elemento.textContent = mensaje || "";
    elemento.classList.toggle("is-visible", Boolean(mensaje));
  }

  function cargando(boton, estado) {
    boton.disabled = estado;
    boton.classList.toggle("is-loading", estado);
  }

  function avisoEnviado(paso, titulo, texto) {
    const caja = document.createElement("div");
    caja.className = "aviso-enviado";
    caja.setAttribute("role", "status");
    const t = document.createElement("p");
    t.className = "aviso-enviado__titulo";
    t.textContent = titulo;
    const x = document.createElement("p");
    x.className = "aviso-enviado__texto";
    x.textContent = texto;
    caja.append(t, x);
    paso.appendChild(caja);
  }

  /* =======================================================
     Paso 1: pedir el enlace
     ======================================================= */
  const formEmail = $("form-email");
  const email = { input: $("email"), grupo: $("field-email"), error: $("error-email") };
  const btnEmail = $("btn-email");
  const errEmail = $("error-general-email");

  formEmail.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorGeneral(errEmail, "");

    const valor = email.input.value.trim().toLowerCase();
    let msg = "";
    if (!valor) msg = "Ingresá tu email.";
    else if (!EMAIL_RE.test(valor)) msg = "Revisá el formato del email.";
    setError(email.grupo, email.error, email.input, msg);
    if (msg) {
      email.input.focus();
      return;
    }

    cargando(btnEmail, true);
    try {
      const datos = await API.post("/api/auth/recuperar", { email: valor });
      formEmail.hidden = true;
      $("enviado-texto").textContent = datos.ok;
      $("enviado").hidden = false;
    } catch (err) {
      errorGeneral(errEmail, err.message);
      cargando(btnEmail, false);
    }
  });

  email.input.addEventListener("input", () => {
    setError(email.grupo, email.error, email.input, "");
    errorGeneral(errEmail, "");
  });

  /* =======================================================
     Paso 2: nueva contraseña
     ======================================================= */
  const formClave = $("form-clave");
  const clave = { input: $("password"), grupo: $("field-password"), error: $("error-password") };
  const repetir = { input: $("repetir"), grupo: $("field-repetir"), error: $("error-repetir") };
  const btnClave = $("btn-clave");
  const errClave = $("error-general-clave");
  const btnToggle = $("toggle-password");

  btnToggle.addEventListener("click", () => {
    const visible = clave.input.type === "password";
    clave.input.type = visible ? "text" : "password";
    btnToggle.setAttribute("aria-pressed", String(visible));
    btnToggle.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
    clave.input.focus();
  });

  formClave.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorGeneral(errClave, "");

    let primero = null;
    let msg = clave.input.value.length >= 8 ? "" : "Usá al menos 8 caracteres.";
    setError(clave.grupo, clave.error, clave.input, msg);
    if (msg) primero = clave.input;

    msg = repetir.input.value === clave.input.value ? "" : "Las contraseñas no coinciden.";
    setError(repetir.grupo, repetir.error, repetir.input, msg);
    if (msg && !primero) primero = repetir.input;

    if (primero) {
      primero.focus();
      return;
    }

    cargando(btnClave, true);
    try {
      const datos = await API.post("/api/auth/restablecer", {
        token,
        password: clave.input.value
      });
      formClave.hidden = true;
      avisoEnviado($("paso-clave"), "Listo", datos.ok);
    } catch (err) {
      errorGeneral(errClave, err.message);
      cargando(btnClave, false);
    }
  });

  [clave, repetir].forEach(({ input, grupo, error }) => {
    input.addEventListener("input", () => {
      setError(grupo, error, input, "");
      errorGeneral(errClave, "");
    });
  });

  /* ---------- Inicio: qué paso mostrar ---------- */
  if (token) {
    $("paso-clave").hidden = false;
    clave.input.focus();
  } else {
    $("paso-email").hidden = false;
    email.input.focus();
  }
})();
