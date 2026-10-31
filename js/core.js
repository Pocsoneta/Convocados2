/* =========================================================
   core.js — compartido por todas las pantallas
   Helpers de almacenamiento y constantes. Cuando exista un
   backend, solo hay que reemplazar el contenido de `Store`.
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

  cerrar() {
    Store.remove("sesion");
    window.location.href = APP.rutas.login;
  },

  // Datos del usuario listos para mostrar (nombre, barrio, foto)
  usuario() {
    const sesion = this.sesion();
    if (!sesion) return null;

    const registrado = Store.get("usuarios", []).find((u) => u.email === sesion.email) || {};
    const ficha = registrado.perfilDeportivo || Store.get("perfil_deportivo") || {};
    const cap = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : "");

    return {
      email: sesion.email,
      nombre: cap((registrado.nombre || sesion.nombre || "").trim()),
      apellido: cap((registrado.apellido || "").trim()),
      localidad: ficha.localidad || "",
      foto: ficha.foto || null
    };
  }
};
