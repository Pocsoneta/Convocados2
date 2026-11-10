/* =========================================================
   mapa-zona.js — mapa de la zona

   Por ahora dibuja una VISTA PREVIA: ubica los partidos como
   pines numerados dentro de un fondo decorativo, proporcional
   a su latitud y longitud.

   Para pasar a Google Maps hay que reemplazar solo este
   archivo, manteniendo esta interfaz (buscar.js no cambia):

     MapaZona.iniciar(contenedor, { alSeleccionar(id), alResaltar(id|null) })
     MapaZona.mostrar(partidos)   // numera 1..N en el orden recibido
     MapaZona.resaltar(id|null)   // marca el pin del partido activo
   ========================================================= */

const MapaZona = (() => {
  let contenedor = null;
  let eventos = {};
  const pines = new Map(); // id -> botón del pin

  function iniciar(el, opciones = {}) {
    contenedor = el;
    eventos = opciones;
  }

  // Convierte un valor entre [min, min+span] a un porcentaje dentro de [desde, hasta]
  const escalar = (valor, min, span, desde, hasta) =>
    desde + ((valor - min) / span) * (hasta - desde);

  function mostrar(partidos) {
    contenedor.replaceChildren();
    pines.clear();

    const ubicables = partidos
      .map((p, i) => ({ p, numero: i + 1 }))
      .filter(({ p }) => Number.isFinite(p.lat) && Number.isFinite(p.lng));
    if (!ubicables.length) return;

    const lats = ubicables.map(({ p }) => p.lat);
    const lngs = ubicables.map(({ p }) => p.lng);
    const latMin = Math.min(...lats);
    const lngMin = Math.min(...lngs);
    const latSpan = Math.max(...lats) - latMin || 1;
    const lngSpan = Math.max(...lngs) - lngMin || 1;
    const unico = ubicables.length === 1;

    ubicables.forEach(({ p, numero }) => {
      // Oeste→izquierda, norte→arriba, con márgenes para que no queden pegados al borde
      const x = unico ? 48 : escalar(p.lng, lngMin, lngSpan, 10, 84);
      const y = unico ? 42 : escalar(p.lat, latMin, latSpan, 70, 18);

      const pin = document.createElement("button");
      pin.type = "button";
      pin.className = "pin";
      pin.style.left = `${x}%`;
      pin.style.top = `${y}%`;
      pin.setAttribute("aria-label", `Partido ${numero}: ${p.nombre}`);

      const punto = document.createElement("span");
      punto.className = "pin__dot";
      const num = document.createElement("span");
      num.className = "pin__num";
      num.textContent = numero;
      pin.append(punto, num);

      pin.addEventListener("mouseenter", () => eventos.alResaltar?.(p.id));
      pin.addEventListener("focus", () => eventos.alResaltar?.(p.id));
      pin.addEventListener("mouseleave", () => eventos.alResaltar?.(null));
      pin.addEventListener("blur", () => eventos.alResaltar?.(null));
      pin.addEventListener("click", () => eventos.alSeleccionar?.(p.id));

      contenedor.appendChild(pin);
      pines.set(p.id, pin);
    });
  }

  function resaltar(id) {
    pines.forEach((pin, clave) => pin.classList.toggle("is-active", clave === id));
  }

  return { iniciar, mostrar, resaltar };
})();