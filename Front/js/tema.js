/* =========================================================
   tema.js — selector de paletas de fondo  (TEMPORAL)

   Sirve para PROBAR los diseños de fondo en la app real.
   Aplica <html data-tema="..."> y lo recuerda en localStorage
   (clave "convocados:tema"), así se mantiene al navegar.

   Es temporal: para quitarlo, borrá este archivo, el <script>
   de las páginas, css/tema.css y el @import de css/base.css.
   ========================================================= */
(() => {
  const CLAVE = "convocados:tema";
  const OPCIONES = [
    ["", "Medianoche (actual)"],
    ["grafito", "Grafito"],
    ["cesped", "Césped"],
    ["azul", "Azul estadio"],
    ["bordo", "Bordó noche"],
    ["indigo", "Índigo eléctrico"],
    ["claro", "Papel claro"],
  ];

  const leer = () => {
    try { return localStorage.getItem(CLAVE) || ""; } catch { return ""; }
  };
  const guardar = (k) => {
    try { k ? localStorage.setItem(CLAVE, k) : localStorage.removeItem(CLAVE); } catch { /* sin storage */ }
  };
  const aplicar = (k) => {
    const h = document.documentElement;
    if (k) h.setAttribute("data-tema", k);
    else h.removeAttribute("data-tema");
  };

  // 1) Aplicar cuanto antes: evita ver el fondo por defecto al navegar.
  aplicar(leer());

  // 2) La interfaz se arma cuando el DOM está listo.
  const CSS = `
  #tema-widget { position: fixed; right: 16px; bottom: 16px; z-index: 900; font-family: "Inter", system-ui, sans-serif; }
  .tema-btn {
    display: inline-flex; align-items: center; gap: 8px;
    padding: 10px 14px; border-radius: 999px; cursor: pointer;
    border: 1px solid var(--card-border);
    background: var(--panel); color: var(--text);
    font: inherit; font-size: 13px; font-weight: 700;
    box-shadow: 0 10px 28px rgba(0, 0, 0, .45);
  }
  .tema-btn:hover { border-color: var(--focus); }
  .tema-panel {
    position: absolute; right: 0; bottom: calc(100% + 10px);
    width: 232px; padding: 12px; border-radius: 14px;
    border: 1px solid var(--card-border);
    background: var(--card); color: var(--text);
    box-shadow: 0 20px 50px rgba(0, 0, 0, .55);
  }
  .tema-panel[hidden] { display: none; }
  .tema-panel__t { margin: 0; font-size: 13px; font-weight: 800; }
  .tema-panel__s { margin: 2px 0 10px; font-size: 11.5px; color: var(--text-muted); line-height: 1.4; }
  .tema-op {
    display: flex; align-items: center; gap: 8px; width: 100%;
    margin-bottom: 4px; padding: 8px 10px; border-radius: 9px; cursor: pointer;
    border: 1px solid transparent; background: var(--surface-2); color: var(--text);
    font: inherit; font-size: 12.5px; font-weight: 600; text-align: left;
  }
  .tema-op:hover { border-color: var(--focus); }
  .tema-op.is-on { border-color: var(--nav-active); background: var(--nav-active); }
  .tema-op__sw { width: 16px; height: 16px; border-radius: 5px; flex: none; border: 1px solid rgba(0,0,0,.35); }
  `;

  function montar() {
    if (document.getElementById("tema-widget")) return;

    const estilo = document.createElement("style");
    estilo.textContent = CSS;
    document.head.appendChild(estilo);

    const caja = document.createElement("div");
    caja.id = "tema-widget";

    const panel = document.createElement("div");
    panel.className = "tema-panel";
    panel.hidden = true;
    panel.innerHTML =
      '<p class="tema-panel__t">Diseño</p>' +
      '<p class="tema-panel__s">Probá los fondos y quedate con uno.</p>';

    const swatch = { "": "#060b14", grafito: "#0f1114", cesped: "#07120d",
                     azul: "#050d1c", bordo: "#140709", indigo: "#0a0716", claro: "#f5f7fc" };
    const botones = [];
    OPCIONES.forEach(([k, nombre]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "tema-op";
      b.innerHTML = `<span class="tema-op__sw" style="background:${swatch[k]}"></span>${nombre}`;
      b.addEventListener("click", () => {
        aplicar(k);
        guardar(k);
        botones.forEach(([bk, bb]) => bb.classList.toggle("is-on", bk === k));
      });
      botones.push([k, b]);
      panel.appendChild(b);
    });

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "tema-btn";
    boton.innerHTML = "🎨 Diseño";
    boton.setAttribute("aria-expanded", "false");
    boton.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
      boton.setAttribute("aria-expanded", String(!panel.hidden));
    });

    const actual = leer();
    botones.forEach(([k, b]) => b.classList.toggle("is-on", k === actual));

    caja.append(panel, boton);
    document.body.appendChild(caja);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", montar);
  } else {
    montar();
  }
})();
