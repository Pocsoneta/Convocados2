/* =========================================================
   login.js — lógica de esta pantalla
   La autenticación es simulada. Para conectar un backend,
   reemplazá solo la función `autenticar`.
   ========================================================= */

(() => {
  const $ = (id) => document.getElementById(id);

  const form = $("form-login");
  const campos = {
    email: { input: $("email"), grupo: $("field-email"), error: $("error-email") },
    password: { input: $("password"), grupo: $("field-password"), error: $("error-password") }
  };
  const errorGeneral = $("error-general");
  const btnSubmit = $("btn-submit");
  const btnToggle = $("toggle-password");
  const hero = $("login-hero");

  // Si la foto aún no está, queda el fondo de respaldo
  hero.addEventListener("error", () => hero.remove());

  // Recordar el último email usado
  const ultimoEmail = Store.get("ultimo_email");
  if (ultimoEmail) campos.email.input.value = ultimoEmail;

  /* ---------- Mostrar / ocultar contraseña ---------- */
  btnToggle.addEventListener("click", () => {
    const visible = campos.password.input.type === "password";
    campos.password.input.type = visible ? "text" : "password";
    btnToggle.setAttribute("aria-pressed", String(visible));
    btnToggle.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
    campos.password.input.focus();
  });

  /* ---------- Validación ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validar(nombre) {
    const { input } = campos[nombre];
    const valor = input.value.trim();

    if (nombre === "email") {
      if (!valor) return "Ingresá tu email.";
      if (!EMAIL_RE.test(valor)) return "Revisá el formato del email.";
    }
    if (nombre === "password") {
      if (!input.value) return "Ingresá tu contraseña.";
      if (input.value.length < 6) return "Debe tener al menos 6 caracteres.";
    }
    return "";
  }

  function mostrarError(nombre, mensaje) {
    const { input, grupo, error } = campos[nombre];
    grupo.classList.toggle("has-error", Boolean(mensaje));
    input.setAttribute("aria-invalid", mensaje ? "true" : "false");
    error.textContent = mensaje;
  }

  function mostrarErrorGeneral(mensaje) {
    errorGeneral.textContent = mensaje;
    errorGeneral.classList.toggle("is-visible", Boolean(mensaje));
  }

  // Validar al salir del campo y limpiar el error al volver a escribir
  Object.keys(campos).forEach((nombre) => {
    const { input } = campos[nombre];
    input.addEventListener("blur", () => {
      if (input.value) mostrarError(nombre, validar(nombre));
    });
    input.addEventListener("input", () => {
      mostrarError(nombre, "");
      mostrarErrorGeneral("");
    });
  });

  /* ---------- Autenticación (backend Go) ---------- */
  function autenticar({ email, password }) {
    // POST /api/auth/login → guarda la cookie de sesión en el servidor
    return API.post("/api/auth/login", { email, password });
  }

  function cargando(estado) {
    btnSubmit.disabled = estado;
    btnSubmit.classList.toggle("is-loading", estado);
  }

  /* ---------- Envío ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    mostrarErrorGeneral("");

    let primerError = null;
    Object.keys(campos).forEach((nombre) => {
      const mensaje = validar(nombre);
      mostrarError(nombre, mensaje);
      if (mensaje && !primerError) primerError = campos[nombre].input;
    });
    if (primerError) {
      primerError.focus();
      return;
    }

    const email = campos.email.input.value.trim().toLowerCase();
    const password = campos.password.input.value;

    cargando(true);
    try {
      const sesion = await autenticar({ email, password });
      Store.set("sesion", sesion);
      Store.set("ultimo_email", email);
      window.location.href = APP.rutas.inicio;
    } catch (err) {
      mostrarErrorGeneral(err.message);
      cargando(false);
    }
  });
})();
