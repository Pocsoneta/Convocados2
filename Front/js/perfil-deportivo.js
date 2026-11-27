/* =========================================================
   perfil-deportivo.js — lógica de esta pantalla
   Sirve para dos cosas: el paso 2 del registro (cuando la ficha
   todavía no está completa) y para editar el perfil desde el menú
   lateral. Guarda nombre y apellido (PUT /api/cuenta) y localidad
   y foto (PUT /api/perfil).
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
  // true cuando la ficha ya estaba completa: la pantalla pasa a ser
  // "editar perfil" y al guardar se queda acá con un aviso de éxito.
  let esEdicion = false;

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

  /* ---------- Campos del formulario ---------- */
  const campos = [
    { clave: "nombre",    input: $("nombre"),    min: 2, vacio: "Ingresá tu nombre.",
      corto: "Es muy corto." },
    { clave: "apellido",  input: $("apellido"),  min: 2, vacio: "Ingresá tu apellido.",
      corto: "Es muy corto." },
    { clave: "localidad", input: $("localidad"), min: 3, vacio: "Ingresá tu barrio o localidad.",
      corto: "Es muy corto." }
  ];

  const grupoDe = (campo) => $(`field-${campo.clave}`);
  const mensajeDe = (campo) => $(`error-${campo.clave}`);
  const localidad = campos.find((c) => c.clave === "localidad");

  function setErrorCampo(campo, mensaje) {
    grupoDe(campo).classList.toggle("has-error", Boolean(mensaje));
    mensajeDe(campo).textContent = mensaje;
    campo.input.setAttribute("aria-invalid", mensaje ? "true" : "false");
  }

  function validar() {
    const errores = [];
    for (const campo of campos) {
      const valor = campo.input.value.trim();
      const msg = !valor ? campo.vacio
                : valor.length < campo.min ? campo.corto
                : "";
      setErrorCampo(campo, msg);
      if (msg) errores.push(campo.input);
    }
    return errores;
  }

  // Limpia el error apenas el usuario corrige
  campos.forEach((campo) => {
    campo.input.addEventListener("input", () => {
      setErrorCampo(campo, "");
      errorGeneral.classList.remove("is-visible");
    });
  });

  /* ---------- Guardado (backend Go) ---------- */
  function guardarCuenta(datos) {
    // PUT /api/cuenta — nombre y apellido de la cuenta.
    return API.put("/api/cuenta", datos);
  }

  function guardarPerfil(perfil) {
    // PUT /api/perfil — localidad y foto (la foto va como data URL
    // en base64).
    return API.put("/api/perfil", {
      localidad: perfil.localidad,
      foto: perfil.foto
    });
  }

  function cargando(estado) {
    btnSubmit.disabled = estado;
    btnSubmit.classList.toggle("is-loading", estado);
  }

  /* ---------- Aviso de éxito ---------- */
  let avisoTimer = null;
  function avisoExito(mensaje) {
    const el = $("aviso-exito");
    el.textContent = mensaje;
    el.classList.add("is-visible");
    clearTimeout(avisoTimer);
    avisoTimer = setTimeout(() => {
      el.classList.remove("is-visible");
      el.textContent = "";
    }, 8000);
  }

  /* ---------- Ficha completada: la pantalla pasa a modo edición ---------- */
  function modoEdicion() {
    esEdicion = true;
    $("steps-eyebrow").textContent = "Mi perfil";
    $("steps-title").textContent = "Editá tu perfil";
    $("steps-text").textContent =
      "Tu nombre, tu barrio y tu foto se ven en los equipos y en los partidos.";
    $("steps-progress").hidden = true;
    $("perfil-title").textContent = "Mi perfil";
    $("perfil-lead").textContent = "Actualizá tus datos cuando quieras.";
    $("perfil-note").textContent =
      "Los cambios se aplican en todas las pantallas de Convocados.";
    $("edit-note").textContent = "Se guarda al tocar el botón.";
    $("btn-label").textContent = "Guardar cambios";
  }

  /* ---------- Ficha guardada (GET /api/perfil) ---------- */
  async function cargarPerfil() {
    try {
      const p = await API.get("/api/perfil");
      if (p.nombre) $("nombre").value = p.nombre;
      if (p.apellido) $("apellido").value = p.apellido;
      if (p.localidad) localidad.input.value = p.localidad;
      if (p.foto) {
        fotoDataURL = p.foto;
        fotoPreview.src = p.foto;
        fotoPreview.hidden = false;
        fotoPlaceholder.hidden = true;
      }
      // Si ya había localidad, la ficha estaba completa: es una edición.
      if (p.localidad) modoEdicion();
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

    const cuenta = {
      nombre: $("nombre").value.trim(),
      apellido: $("apellido").value.trim()
    };
    const perfil = {
      foto: fotoDataURL,
      localidad: localidad.input.value.trim()
    };

    cargando(true);
    try {
      await Promise.all([guardarCuenta(cuenta), guardarPerfil(perfil)]);
      Store.set("sesion", {
        ...sesion,
        perfilCompleto: true,
        nombre: cuenta.nombre,
        apellido: cuenta.apellido,
        localidad: perfil.localidad
      });
      // Ya tenía perfil: nos quedamos y avisamos que se guardó.
      if (esEdicion) {
        cargando(false);
        avisoExito("Perfil actualizado.");
        return;
      }
      window.location.href = APP.rutas.inicio;
    } catch {
      errorGeneral.textContent = "No pudimos guardar tu perfil. Probá de nuevo.";
      errorGeneral.classList.add("is-visible");
      cargando(false);
    }
  });
})();
