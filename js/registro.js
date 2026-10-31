/* =========================================================
   registro.js — lógica de esta pantalla
   El alta es simulada y se guarda en localStorage.
   Para conectar un backend, reemplazá solo `crearCuenta`.
   ========================================================= */

(() => {
  const MIN_EDAD = 16;          // edad mínima para registrarse
  const MIN_PASSWORD = 8;       // largo mínimo de contraseña

  const $ = (id) => document.getElementById(id);

  const nombres = ["nombre", "apellido", "email", "password", "nacimiento", "terminos"];
  const campos = {};
  nombres.forEach((n) => {
    campos[n] = { input: $(n), grupo: $("field-" + n), error: $("error-" + n) };
  });

  const form = $("form-registro");
  const errorGeneral = $("error-general");
  const btnSubmit = $("btn-submit");
  const btnPassword = $("toggle-password");
  const btnCalendario = $("abrir-calendario");

  /* ---------- Fecha de nacimiento ---------- */
  const hoy = new Date();
  const iso = (d) => d.toISOString().slice(0, 10);
  campos.nacimiento.input.max = iso(hoy);

  btnCalendario.addEventListener("click", () => {
    const input = campos.nacimiento.input;
    if (typeof input.showPicker === "function") {
      try { input.showPicker(); return; } catch { /* cae al foco */ }
    }
    input.focus();
  });

  function calcularEdad(valorISO) {
    const nac = new Date(valorISO + "T00:00:00");
    if (Number.isNaN(nac.getTime())) return null;
    let edad = hoy.getFullYear() - nac.getFullYear();
    const cumpleEsteAnio = new Date(hoy.getFullYear(), nac.getMonth(), nac.getDate());
    if (hoy < cumpleEsteAnio) edad -= 1;
    return edad;
  }

  /* ---------- Mostrar / ocultar contraseña ---------- */
  btnPassword.addEventListener("click", () => {
    const input = campos.password.input;
    const mostrar = input.type === "password";
    input.type = mostrar ? "text" : "password";
    btnPassword.setAttribute("aria-pressed", String(mostrar));
    btnPassword.setAttribute("aria-label", mostrar ? "Ocultar contraseña" : "Mostrar contraseña");
    input.focus();
  });

  /* ---------- Validación ---------- */
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function validar(nombre) {
    const { input } = campos[nombre];
    const valor = input.value.trim();

    switch (nombre) {
      case "nombre":
        if (!valor) return "Ingresá tu nombre.";
        if (valor.length < 2) return "Es muy corto.";
        return "";
      case "apellido":
        if (!valor) return "Ingresá tu apellido.";
        if (valor.length < 2) return "Es muy corto.";
        return "";
      case "email":
        if (!valor) return "Ingresá tu email.";
        if (!EMAIL_RE.test(valor)) return "Revisá el formato del email.";
        return "";
      case "password":
        if (!input.value) return "Creá una contraseña.";
        if (input.value.length < MIN_PASSWORD) return `Usá al menos ${MIN_PASSWORD} caracteres.`;
        return "";
      case "nacimiento": {
        if (!input.value) return "Ingresá tu fecha de nacimiento.";
        const edad = calcularEdad(input.value);
        if (edad === null || edad < 0 || edad > 100) return "Revisá la fecha ingresada.";
        if (edad < MIN_EDAD) return `Tenés que tener al menos ${MIN_EDAD} años.`;
        return "";
      }
      case "terminos":
        return input.checked ? "" : "Tenés que aceptar los términos para continuar.";
      default:
        return "";
    }
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

  nombres.forEach((nombre) => {
    const { input } = campos[nombre];
    const evento = nombre === "terminos" || nombre === "nacimiento" ? "change" : "input";

    // Valida al salir del campo (solo si ya escribieron algo)
    if (input.type !== "checkbox") {
      input.addEventListener("blur", () => {
        if (input.value) mostrarError(nombre, validar(nombre));
      });
    }
    // Limpia el error al corregir
    input.addEventListener(evento, () => {
      mostrarError(nombre, "");
      mostrarErrorGeneral("");
    });
  });

  /* ---------- Alta (simulada) ---------- */
  function crearCuenta(datos) {
    return new Promise((resolver, rechazar) => {
      setTimeout(() => {
        const usuarios = Store.get("usuarios", []);

        if (usuarios.some((u) => u.email === datos.email)) {
          rechazar(new Error("Ya existe una cuenta con ese email. Probá iniciando sesión."));
          return;
        }

        // OJO: guardar contraseñas en texto plano es solo para esta demo.
        usuarios.push(datos);
        Store.set("usuarios", usuarios);
        resolver({ email: datos.email, nombre: datos.nombre });
      }, 800);
    });
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
    nombres.forEach((nombre) => {
      const mensaje = validar(nombre);
      mostrarError(nombre, mensaje);
      if (mensaje && !primerError) primerError = campos[nombre].input;
    });
    if (primerError) {
      primerError.focus();
      return;
    }

    const datos = {
      nombre: campos.nombre.input.value.trim(),
      apellido: campos.apellido.input.value.trim(),
      email: campos.email.input.value.trim().toLowerCase(),
      password: campos.password.input.value,
      nacimiento: campos.nacimiento.input.value
    };

    cargando(true);
    try {
      const sesion = await crearCuenta(datos);
      Store.set("sesion", sesion);
      Store.set("ultimo_email", datos.email);
      window.location.href = APP.rutas.perfilDeportivo;
    } catch (err) {
      mostrarErrorGeneral(err.message);
      cargando(false);
    }
  });
})();
