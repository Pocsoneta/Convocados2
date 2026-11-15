/* =========================================================
   terminos.js — lógica de esta pantalla (solo front)

   - El índice resalta la sección que se está leyendo.
   - Tocar un ítem del índice lleva a esa sección.
   - "Volver al registro" vuelve a la pantalla anterior si se
     llegó desde el registro, así no se pierden los datos ya
     completados en el formulario.
   Esta pantalla es pública: no pide sesión.
   ========================================================= */

(() => {
  const secciones = [...document.querySelectorAll(".doc__section")];
  const enlaces = new Map(
    secciones.map((s) => [s.id, document.querySelector(`.toc__link[href="#${s.id}"]`)])
  );

  const reducirMovimiento = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Índice ---------- */
  function activar(id) {
    enlaces.forEach((enlace, clave) => {
      const activo = clave === id;
      enlace.classList.toggle("is-active", activo);
      if (activo) enlace.setAttribute("aria-current", "location");
      else enlace.removeAttribute("aria-current");
    });

    // En pantallas chicas el índice es una fila deslizable: se mantiene a la vista el ítem activo
    const activo = enlaces.get(id);
    const lista = activo?.closest(".toc__list");
    if (lista && lista.scrollWidth > lista.clientWidth) {
      const izquierda = activo.offsetLeft - lista.clientWidth / 2 + activo.clientWidth / 2;
      lista.scrollTo({ left: izquierda, behavior: reducirMovimiento ? "auto" : "smooth" });
    }
  }

  // La sección activa es la última cuyo comienzo ya pasó la parte alta de la pantalla
  function sincronizar() {
    let actual = secciones[0].id;
    for (const seccion of secciones) {
      if (seccion.getBoundingClientRect().top <= 160) actual = seccion.id;
    }

    const alFinal = window.scrollY > 0 &&
      window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    if (alFinal) actual = secciones[secciones.length - 1].id;

    activar(actual);
  }

  let pendiente = false;
  window.addEventListener("scroll", () => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      sincronizar();
    });
  }, { passive: true });

  document.querySelector(".toc").addEventListener("click", (e) => {
    const enlace = e.target.closest(".toc__link");
    if (!enlace) return;

    const destino = document.getElementById(enlace.getAttribute("href").slice(1));
    if (!destino) return;

    e.preventDefault();
    destino.scrollIntoView({ behavior: reducirMovimiento ? "auto" : "smooth", block: "start" });
    window.history.replaceState(null, "", `#${destino.id}`);
    activar(destino.id);
  });

  /* ---------- Volver al registro ---------- */
  const vieneDelRegistro = /registro\.html/.test(document.referrer) && window.history.length > 1;

  document.querySelectorAll("[data-volver]").forEach((boton) => {
    boton.addEventListener("click", (e) => {
      if (!vieneDelRegistro) return; // si no, sigue el enlace normal a registro.html
      e.preventDefault();
      window.history.back();
    });
  });

  /* ---------- Inicio ---------- */
  // Si se llegó con #privacidad (u otra sección), el navegador ya se desplazó hasta ahí
  sincronizar();
})();