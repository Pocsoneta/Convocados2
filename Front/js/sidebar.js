/* =========================================================
   sidebar.js — barra lateral compartida por las pantallas
   internas. Protege la pantalla (pide sesión), muestra los
   datos del usuario y cierra la sesión.
   ========================================================= */

(() => {
  if (!Auth.requerir()) return;

  const $ = (id) => document.getElementById(id);

  /* ---------- Cerrar sesión ---------- */
  $("btn-logout").addEventListener("click", () => Auth.cerrar());

  /* ---------- Datos del usuario (los trae el backend) ---------- */
  (async () => {
    const usuario = (await Auth.usuario()) || {
      nombre: "",
      apellido: "",
      localidad: "",
      foto: null
    };

    const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ");
    $("user-nombre").textContent = nombreCompleto || "Mi cuenta";
    $("user-localidad").textContent = usuario.localidad || "";

    const iniciales = (
      (usuario.nombre || "").charAt(0) + (usuario.apellido || "").charAt(0)
    ).toUpperCase();
    $("user-iniciales").textContent = iniciales || "?";

    if (usuario.foto) {
      const foto = $("user-foto");
      foto.src = usuario.foto;
      foto.hidden = false;
      $("user-iniciales").hidden = true;
    }
  })();
})();
