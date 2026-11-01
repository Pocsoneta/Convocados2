/* =========================================================
   core.js — compartido por todas las pantallas
   Helpers de almacenamiento, cliente de la API y constantes.
   ========================================================= */

const APP = {
  nombre: "Convocados",
  prefijo: "convocados:",
  rutas: {
    onboarding: "onboarding.html",
    login: "login.html",
    registro: "registro.html",
    recuperar: "recuperar.html",
    perfilDeportivo: "perfil-deportivo.html",
    buscar: "buscar.html",
    crearPartido: "crear-partido.html",
    misPartidos: "mis-partidos.html",
    perfil: "perfil.html",
    detallePartido: "detalle-partido.html",
    inicio: "inicio.html"
  }
};

/* =========================================================
   Cliente de la API (backend Go).
   Usa cookies de sesión (credentials: "same-origin"), así que
   el backend y el front tienen que servirse del mismo origen:
   levantá el back y abrí http://localhost:8080
   ========================================================= */

const API = {
  base: "",

  async pedir(ruta, opciones = {}) {
    const { metodo = "GET", cuerpo } = opciones;

    let respuesta;
    try {
      respuesta = await fetch(this.base + ruta, {
        method: metodo,
        credentials: "same-origin",
        headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo)
      });
    } catch {
      throw new Error(
        "No pudimos conectar con el servidor. ¿Está corriendo el backend en el puerto 8080?"
      );
    }

    const texto = await respuesta.text();
    let datos = null;
    if (texto) {
      try { datos = JSON.parse(texto); } catch { datos = null; }
    }

    // Sesión vencida o inexistente: volvemos al login
    if (respuesta.status === 401 && !ruta.startsWith("/api/auth/")) {
      Store.remove("sesion");
      const enLogin = location.pathname.endsWith(APP.rutas.login) ||
                      location.pathname.endsWith(APP.rutas.registro);
      if (!enLogin) window.location.replace(APP.rutas.login);
      throw new Error("Tu sesión expiró. Iniciá sesión de nuevo.");
    }

    if (!respuesta.ok) {
      throw new Error((datos && datos.error) || "No pudimos completar la operación.");
    }
    return datos;
  },

  get(ruta) { return this.pedir(ruta); },
  post(ruta, cuerpo) { return this.pedir(ruta, { metodo: "POST", cuerpo }); },
  put(ruta, cuerpo) { return this.pedir(ruta, { metodo: "PUT", cuerpo }); },
  del(ruta) { return this.pedir(ruta, { metodo: "DELETE" }); }
};

const Store = {
  get(clave, porDefecto = null) {
    try {
      const raw = localStorage.getItem(APP.prefijo + clave);
      return raw === null ? porDefecto : JSON.parse(raw);
    } catch {
      return porDefecto;
    }
  },

  set(clave, valor) {
    try {
      localStorage.setItem(APP.prefijo + clave, JSON.stringify(valor));
      return true;
    } catch {
      return false;
    }
  },

  remove(clave) {
    try {
      localStorage.removeItem(APP.prefijo + clave);
    } catch { /* sin acceso a storage */ }
  }
};

/* ---------- Sesión de usuario ---------- */
const Auth = {
  // Sesión cacheada en el navegador (la cookie httpOnly la maneja el backend)
  sesion() {
    return Store.get("sesion");
  },

  // Para pantallas privadas: si no hay sesión, vuelve al login
  requerir() {
    const sesion = this.sesion();
    if (!sesion) {
      window.location.replace(APP.rutas.login);
      return null;
    }
    return sesion;
  },

  async cerrar() {
    Store.remove("sesion");
    try {
      await API.post("/api/auth/logout");
    } catch { /* igual salimos */ }
    window.location.href = APP.rutas.login;
  },

  // Ficha real del usuario, pedida al backend.
  // Devuelve null si no hay sesión (o si el backend respondió 401,
  // en cuyo caso API.pedir ya redirigió al login).
  async usuario() {
    if (!this.sesion()) return null;
    try {
      const u = await API.get("/api/auth/me");
      Store.set("sesion", { ...this.sesion(), ...u });
      return {
        id: u.id,
        email: u.email,
        nombre: u.nombre || "",
        apellido: u.apellido || "",
        localidad: u.localidad || "",
        foto: u.foto || null,
        posiciones: u.posiciones || [],
        nivel: u.nivel || "",
        telefono: u.telefono || "",
        promedio: u.promedio || 0
      };
    } catch {
      return null;
    }
  }
};
