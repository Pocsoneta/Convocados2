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

  /* ---------- Menú lateral (tablet / móvil) ---------- */
  const sidebar = document.querySelector(".sidebar");
  const toggle = document.querySelector(".sidebar__toggle");

  if (sidebar && toggle) {
    const setAbierto = (abierto) => {
      sidebar.classList.toggle("is-open", abierto);
      document.body.classList.toggle("nav-open", abierto);
      toggle.setAttribute("aria-expanded", String(abierto));
      toggle.setAttribute("aria-label", abierto ? "Cerrar menú" : "Abrir menú");
      // Si el foco quedó dentro del panel oculto, devolverlo al botón
      if (!abierto && sidebar.contains(document.activeElement)) toggle.focus();
    };

    toggle.addEventListener("click", () => {
      setAbierto(!sidebar.classList.contains("is-open"));
    });

    // Click en el fondo oscurecido (el pseudo-elemento atribuye el target al aside)
    document.addEventListener("click", (e) => {
      if (!sidebar.classList.contains("is-open")) return;
      if (e.target !== sidebar && sidebar.contains(e.target)) return;
      setAbierto(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setAbierto(false);
    });

    // Al volver a escritorio, cerrar el menú y desbloquear el scroll
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900 && sidebar.classList.contains("is-open")) {
        setAbierto(false);
      }
    });
  }

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
