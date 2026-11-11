/* =========================================================
   onboarding.js — lógica de esta pantalla
   El paso 1 replica el Figma. Los pasos 2 y 3 son texto
   provisorio: reemplazalos cuando tengas esas pantallas.
   ========================================================= */

(() => {
  const PASOS = [
    {
      eyebrow: "Tu equipo empieza acá",
      titulo: "¿Te faltan jugadores?",
      texto: "Armá tu equipo, publicá los puestos libres y encontrá el refuerzo ideal en tu zona para salir a la cancha.",
      lista: [
        "Partidos cerca de tu barrio",
        "Perfiles por nivel de juego",
        "Convocatorias simples y rápidas"
      ],
      imagen: "img/onboarding-1.png",
      capTitulo: "Fútbol amateur, mejor conectado.",
      capSub: "CABA · +120 convocatorias esta semana"
    },
    {
      eyebrow: "Armá el partido",
      titulo: "Publicá tu convocatoria",
      texto: "Elegí cancha, día y horario, indicá cuántos jugadores faltan y el nivel que buscás. Lo tenés listo en un minuto.",
      lista: [
        "Elegí cancha, fecha y hora",
        "Definí el nivel que buscás",
        "Compartí el link con tu grupo"
      ],
      imagen: "img/onboarding-2.png",
      capTitulo: "Convocatorias en un minuto.",
      capSub: "Publicá y recibí postulaciones"
    },
    {
      eyebrow: "Sumate a uno",
      titulo: "Encontrá tu próximo partido",
      texto: "Filtrá por zona, horario y nivel, postulate con un toque y confirmá tu lugar en la cancha.",
      lista: [
        "Filtros por zona y horario",
        "Confirmación de cupo al instante",
        "Historial de tus partidos"
      ],
      imagen: "img/onboarding-3.png",
      capTitulo: "Siempre hay un lugar para vos.",
      capSub: "Partidos abiertos cerca tuyo"
    }
  ];

  const $ = (id) => document.getElementById(id);
  const el = {
    contenido: $("contenido"),
    eyebrow: $("onb-eyebrow"),
    titulo: $("onb-titulo"),
    texto: $("onb-texto"),
    lista: $("onb-lista"),
    dots: $("dots"),
    slides: $("slides-img"),
    capTitulo: $("cap-titulo"),
    capSub: $("cap-sub"),
    siguiente: $("btn-siguiente"),
    omitir: $("btn-omitir")
  };

  let actual = 0;
  const ultimo = PASOS.length - 1;

  /* ---------- Construcción inicial ---------- */
  PASOS.forEach((paso, i) => {
    // Imágenes (una por paso, se hace crossfade entre ellas)
    const slide = document.createElement("div");
    slide.className = "onb__slide";
    const img = document.createElement("img");
    img.src = paso.imagen;
    img.alt = "";
    img.addEventListener("error", () => img.remove()); // queda el fondo de respaldo
    slide.appendChild(img);
    el.slides.appendChild(slide);

    // Dots
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot";
    dot.setAttribute("role", "tab");
    dot.setAttribute("aria-label", `Ir al paso ${i + 1} de ${PASOS.length}`);
    dot.addEventListener("click", () => irA(i));
    el.dots.appendChild(dot);
  });

  /* ---------- Render ---------- */
  function pintarTexto(paso) {
    el.eyebrow.textContent = paso.eyebrow;
    el.titulo.textContent = paso.titulo;
    el.texto.textContent = paso.texto;
    el.lista.replaceChildren(
      ...paso.lista.map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      })
    );
    el.capTitulo.textContent = paso.capTitulo;
    el.capSub.textContent = paso.capSub;
  }

  function marcarActivos() {
    [...el.slides.children].forEach((s, i) => s.classList.toggle("is-active", i === actual));
    [...el.dots.children].forEach((d, i) => {
      d.classList.toggle("is-active", i === actual);
      d.setAttribute("aria-selected", String(i === actual));
    });
    el.siguiente.textContent = actual === ultimo ? "Comenzar" : "Siguiente";
  }

  function irA(indice) {
    if (indice === actual || indice < 0 || indice > ultimo) return;
    actual = indice;

    el.contenido.classList.add("is-changing");
    marcarActivos();
    setTimeout(() => {
      pintarTexto(PASOS[actual]);
      el.contenido.classList.remove("is-changing");
    }, 220);
  }

  /* ---------- Salida ---------- */
  function terminar() {
    Store.set("onboarding_visto", true);
    window.location.href = APP.rutas.login;
  }

  /* ---------- Eventos ---------- */
  el.siguiente.addEventListener("click", () => {
    if (actual < ultimo) irA(actual + 1);
    else terminar();
  });

  el.omitir.addEventListener("click", terminar);

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") irA(actual + 1);
    if (e.key === "ArrowLeft") irA(actual - 1);
  });

  /* ---------- Inicio ---------- */
  pintarTexto(PASOS[0]);
  marcarActivos();
})();
