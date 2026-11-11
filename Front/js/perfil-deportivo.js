/* =========================================================
   perfil-deportivo.js — lógica de esta pantalla
   Paso 2 de 2 del registro. Guarda la ficha en localStorage.
   Para conectar un backend, reemplazá solo `guardarPerfil`.
   ========================================================= */

(() => {
  const MAX_FOTO_MB = 5;
  const LADO_FOTO = 256; // px, se recorta cuadrada y se reduce para ahorrar espacio

  // Esta pantalla solo existe dentro del registro: sin sesión, vuelve al login
  const sesion = Store.get("sesion");
  if (!sesion) {
    window.location.replace(APP.rutas.login);
    return;
  }

  const $ = (id) => document.getElementById(id);
  const form = $("form-perfil");
  const btnSubmit = $("btn-submit");
  const errorGeneral = $("error-general");

  /* ---------- Foto de perfil ---------- */
  const btnFoto = $("btn-foto");
  const inputFoto = $("input-foto");
  const fotoPreview = $("foto-preview");
  const fotoPlaceholder = $("foto-placeholder");
  const errorFoto = $("error-foto");
  let fotoDataURL = null;

  btnFoto.addEventListener("click", () => inputFoto.click());

  inputFoto.addEventListener("change", async () => {
    const archivo = inputFoto.files[0];
    errorFoto.classList.remove("is-visible");
    if (!archivo) return;

    if (!archivo.type.startsWith("image/")) {
      return errorEnFoto("El archivo tiene que ser una imagen.");
    }
    if (archivo.size > MAX_FOTO_MB * 1024 * 1024) {
      return errorEnFoto(`La foto no puede pesar más de ${MAX_FOTO_MB} MB.`);
    }

    try {
      fotoDataURL = await reducirImagen(archivo, LADO_FOTO);
      fotoPreview.src = fotoDataURL;
      fotoPreview.hidden = false;
      fotoPlaceholder.hidden = true;
    } catch (err) {
      errorEnFoto(err.message);
    }
  });

  function errorEnFoto(mensaje) {
    errorFoto.textContent = mensaje;
    errorFoto.classList.add("is-visible");
    inputFoto.value = "";
  }

  // Recorta al centro en cuadrado y reduce el tamaño
  function reducirImagen(archivo, lado) {
    return new Promise((resolver, rechazar) => {
      const url = URL.createObjectURL(archivo);
      const img = new Image();

      img.onload = () => {
        const min = Math.min(img.width, img.height);
        const sx = (img.width - min) / 2;
        const sy = (img.height - min) / 2;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = lado;
        canvas.getContext("2d").drawImage(img, sx, sy, min, min, 0, 0, lado, lado);
        URL.revokeObjectURL(url);
        resolver(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        rechazar(new Error("No pudimos leer la imagen. Probá con otra."));
      };
      img.src = url;
    });
  }

  /* ---------- Validación ---------- */
  const localidad = {
    input: $("localidad"),
    grupo: $("field-localidad"),
    error: $("error-localidad")
  };

  function setError({ grupo, error }, mensaje) {
    grupo.classList.toggle("has-error", Boolean(mensaje));
    error.textContent = mensaje;
  }

  function validar() {
    const errores = [];

    const barrio = localidad.input.value.trim();
    let msg = "";
    if (!barrio) msg = "Ingresá tu barrio o localidad.";
    else if (barrio.length < 3) msg = "Es muy corto.";
    setError(localidad, msg);
    localidad.input.setAttribute("aria-invalid", msg ? "true" : "false");
    if (msg) errores.push(localidad.input);

    return errores;
  }

  // Limpia el error apenas el usuario corrige
  localidad.input.addEventListener("input", () => {
    setError(localidad, "");
    errorGeneral.classList.remove("is-visible");
  });

  /* ---------- Guardado (backend Go) ---------- */
  function guardarPerfil(perfil) {
    // PUT /api/perfil — guarda localidad, nivel y foto
    // (la foto va como data URL en base64).
    return API.put("/api/perfil", {
      localidad: perfil.localidad,
      nivel: perfil.nivel,
      foto: perfil.foto
    });
  }

  function cargando(estado) {
    btnSubmit.disabled = estado;
    btnSubmit.classList.toggle("is-loading", estado);
  }

  /* ---------- Ficha guardada (GET /api/perfil) ---------- */
  async function cargarPerfil() {
    try {
      const p = await API.get("/api/perfil");
      if (p.localidad) localidad.input.value = p.localidad;
      const radio = form.querySelector(`input[name="nivel"][value="${(p.nivel || "").toLowerCase()}"]`);
      if (radio) radio.checked = true;
      if (p.foto) {
        fotoDataURL = p.foto;
        fotoPreview.src = p.foto;
        fotoPreview.hidden = false;
        fotoPlaceholder.hidden = true;
      }
    } catch { /* sin ficha todavía: el formulario queda vacío */ }
  }
  cargarPerfil();

  /* ---------- Envío ---------- */
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorGeneral.classList.remove("is-visible");

    const errores = validar();
    if (errores.length) {
      errores[0].focus();
      return;
    }

    const perfil = {
      foto: fotoDataURL,
      localidad: localidad.input.value.trim(),
      nivel: form.elements["nivel"].value
    };

    cargando(true);
    try {
      await guardarPerfil(perfil);
      Store.set("sesion", { ...sesion, perfilCompleto: true });
      window.location.href = APP.rutas.inicio;
    } catch {
      errorGeneral.textContent = "No pudimos guardar tu perfil. Probá de nuevo.";
      errorGeneral.classList.add("is-visible");
      cargando(false);
    }
  });
})();
