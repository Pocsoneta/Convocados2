/* =========================================================
   partidos-demo.js — DATOS DE EJEMPLO

   Sirve solo para ver y probar la pantalla de búsqueda sin
   backend. Las fechas se calculan a partir de "ahora", así
   que siempre aparecen como próximas.

   Cuando exista la API: borrá este archivo y su <script> en
   buscar.html, y reemplazá `obtenerPartidos` en buscar.js.

   Forma de cada partido (es la que debería devolver la API):
   { id, nombre, modalidad, zona, zonasCercanas, distanciaKm,
     fecha (ISO local), cupos, lat, lng }
   ========================================================= */

window.PARTIDOS_DEMO = (() => {
  const dos = (n) => String(n).padStart(2, "0");

  // Redondea a la próxima media hora para que los horarios queden prolijos
  function redondear(ms) {
    const d = new Date(ms);
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    return d;
  }

  const iso = (d) =>
    `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}T${dos(d.getHours())}:${dos(d.getMinutes())}:00`;

  const enHoras = (h) => iso(redondear(Date.now() + h * 3600 * 1000));

  return [
    {
      id: "demo-1",
      nombre: "Palermo Arena Canchas",
      modalidad: "Fútbol 5",
      zona: "Palermo, CABA",
      zonasCercanas: [],
      distanciaKm: 0.8,
      fecha: enHoras(2),
      cupos: 3,
      lat: -34.5806,
      lng: -58.4372
    },
    {
      id: "demo-2",
      nombre: "El Templario Fútbol",
      modalidad: "Fútbol 7",
      zona: "Palermo, CABA",
      zonasCercanas: [],
      distanciaKm: 2.1,
      fecha: enHoras(3.5),
      cupos: 1,
      lat: -34.5857,
      lng: -58.4311
    },
    {
      id: "demo-3",
      nombre: "Predio Palermo",
      modalidad: "Fútbol 11",
      zona: "Palermo, CABA",
      zonasCercanas: [],
      distanciaKm: 3.5,
      fecha: enHoras(26),
      cupos: 2,
      lat: -34.5790,
      lng: -58.4235
    },
    {
      id: "demo-4",
      nombre: "Club Social Colegiales",
      modalidad: "Fútbol 5",
      zona: "Colegiales, CABA",
      zonasCercanas: ["Palermo"],   // la API haría esto con un radio de búsqueda
      distanciaKm: 4.2,
      fecha: enHoras(71),
      cupos: 4,
      lat: -34.5745,
      lng: -58.4488
    }
  ];
})();
