/* =========================================================
   sidebar.js — barra lateral compartida por las pantallas
   internas. Protege la pantalla (pide sesión), muestra los
   datos del usuario y cierra la sesión.
   ========================================================= */

(() => {
  if (!Auth.requerir()) return;

  const usuario = Auth.usuario();
  const $ = (id) => document.getElementById(id);

  /* ---------- Datos del usuario ---------- */
  const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ");
  $("user-nombre").textContent = nombreCompleto || "Mi cuenta";
  $("user-localidad").textContent = usuario.localidad;

  const iniciales = ((usuario.nombre[0] || "") + (usuario.apellido[0] || "")).toUpperCase();
  $("user-iniciales").textContent = iniciales || "?";

  if (usuario.foto) {
    const foto = $("user-foto");
    foto.src = usuario.foto;
    foto.hidden = false;
    $("user-iniciales").hidden = true;
  }

  /* ---------- Cerrar sesión ---------- */
  $("btn-logout").addEventListener("click", () => Auth.cerrar());
})();
