import { I } from "../icons.js";
import { fmtLatencia } from "../format.js";
import { SAMPLES } from "../samples.js";
import { PALETTES, DEFAULT_PALETTE, recolorHeatmap } from "../xai.js";

const React = window.React;
const { useState, useEffect } = React;
const h = React.createElement;

const LEGEND_STOPS = [
  { pct: 0,   color: "#2347C5", label: "0.0" },
  { pct: 33,  color: "#16A34A", label: "0.3" },
  { pct: 60,  color: "#FBBF24", label: "0.6" },
  { pct: 100, color: "#DC2626", label: "1.0" },
];

// Segmentos del estómago que el endoscopista documenta en un estudio de WLI.
const SEGMENTS = [
  { id: "antro",    label: "Antro gástrico" },
  { id: "cuerpo",   label: "Cuerpo gástrico" },
  { id: "incisura", label: "Incisura angularis" },
  { id: "fondo",    label: "Fondo gástrico" },
];

// Paradas de la barra de leyenda según la paleta activa.
function legendStops(paletteId) {
  const palette = PALETTES[paletteId] || PALETTES[DEFAULT_PALETTE];
  const n = palette.stops.length;
  return palette.stops.map((color, i) => ({
    color,
    pct: Math.round((i / (n - 1)) * 100),
    label: (i / (n - 1)).toFixed(1),
  }));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Exportación comparativa: imagen original y Grad-CAM lado a lado, con el
// diagnóstico sugerido, el segmento anatómico y la leyenda de activación.
// Es la figura que el gastroenterólogo adjunta a la historia clínica.
async function buildComparativePNG(opts) {
  const {
    src, heat, opacity, showHeat, caseLabel,
    diagnosis, probability, segmentLabel, paletteId,
  } = opts;

  const PANEL_W = 460, PANEL_H = 345, GAP = 20, PAD = 24;
  const HEAD_H = 74, CAP_H = 22, LEG_H = 56;
  const W = PAD * 2 + PANEL_W * 2 + GAP;
  const H = HEAD_H + CAP_H + PANEL_H + LEG_H + PAD;

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#0B1120";
  ctx.fillRect(0, 0, W, H);

  const positive = /positiv/i.test(diagnosis || "");
  const accent = positive ? "#F87171" : "#4ADE80";

  // ── Cabecera ──────────────────────────────────────────────────────────────
  ctx.fillStyle = "#F1F5FB";
  ctx.font = "600 19px Inter, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText("EndoScan AI · Visualización Grad-CAM", PAD, 32);

  ctx.fillStyle = accent;
  ctx.font = "700 16px Inter, sans-serif";
  ctx.fillText(diagnosis || "Diagnóstico no disponible", PAD, 56);

  ctx.fillStyle = "#8595AE";
  ctx.font = "12px Inter, sans-serif";
  ctx.textAlign = "right";
  const meta = [
    probability != null ? "Probabilidad " + probability : null,
    segmentLabel ? "Segmento: " + segmentLabel : null,
    new Date().toLocaleDateString("es-PE"),
  ].filter(Boolean).join("  ·  ");
  ctx.fillText(meta, W - PAD, 56);

  // ── Rótulos de panel ──────────────────────────────────────────────────────
  const panelY = HEAD_H + CAP_H;
  ctx.font = "600 11px Inter, sans-serif";
  ctx.fillStyle = "#8595AE";
  ctx.textAlign = "left";
  ctx.fillText("IMAGEN ORIGINAL", PAD, HEAD_H + 14);
  ctx.fillText("GRAD-CAM SUPERPUESTO", PAD + PANEL_W + GAP, HEAD_H + 14);

  // ── Panel izquierdo: original ─────────────────────────────────────────────
  const orig = await loadImage(src);
  ctx.drawImage(orig, PAD, panelY, PANEL_W, PANEL_H);

  // ── Panel derecho: original + mapa de activación ──────────────────────────
  const rightX = PAD + PANEL_W + GAP;
  ctx.drawImage(orig, rightX, panelY, PANEL_W, PANEL_H);
  if (showHeat && heat) {
    const heatImg = await loadImage(heat);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(heatImg, rightX, panelY, PANEL_W, PANEL_H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.strokeStyle = "#27324A";
  ctx.lineWidth = 1;
  ctx.strokeRect(PAD + 0.5, panelY + 0.5, PANEL_W - 1, PANEL_H - 1);
  ctx.strokeRect(rightX + 0.5, panelY + 0.5, PANEL_W - 1, PANEL_H - 1);

  // ── Leyenda de activación con la paleta activa ────────────────────────────
  const stops = legendStops(paletteId);
  const BAR_Y = panelY + PANEL_H + 18, BAR_H = 12;
  const BAR_X = PAD + 46, BAR_W = W - PAD * 2 - 92;
  const grad = ctx.createLinearGradient(BAR_X, 0, BAR_X + BAR_W, 0);
  stops.forEach((st) => grad.addColorStop(st.pct / 100, st.color));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(BAR_X, BAR_Y, BAR_W, BAR_H, 6);
  ctx.fill();

  ctx.fillStyle = "#8595AE";
  ctx.font = "10px Inter, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Baja", BAR_X - 8, BAR_Y + BAR_H - 1);
  ctx.textAlign = "left";
  ctx.fillText("Alta", BAR_X + BAR_W + 8, BAR_Y + BAR_H - 1);

  ctx.textAlign = "center";
  ctx.fillStyle = "#5C6B85";
  ctx.font = "9px Inter, sans-serif";
  ctx.fillText(
    caseLabel + "  ·  Apoyo diagnóstico — no sustituye el criterio del especialista",
    W / 2, H - 10,
  );

  const a = document.createElement("a");
  a.download = "gradcam_" + String(caseLabel).replace(/[^A-Za-z0-9_-]/g, "_") +
    "_" + new Date().toISOString().slice(0, 10) + ".png";
  a.href = canvas.toDataURL("image/png");
  a.click();
}

export function HeatmapScreen({ heatmapResult, onNewAnalysis, xaiPalette }) {
  const [k, setK]               = useState("pos1");
  const [op, setOp]             = useState(0.65);
  const [show, setShow]         = useState(true);
  const [segment, setSegment]   = useState(SEGMENTS[0].id);
  const [heatSrc, setHeatSrc]   = useState(null);
  const [downloading, setDownloading] = useState(false);

  // Live mode: result from SingleScreen. Demo mode: SAMPLES.
  const isLive = Boolean(heatmapResult && heatmapResult.result);
  const hasHeat = isLive && Boolean(heatmapResult.result.heatmap_b64);
  const livePositive = isLive && (heatmapResult.result.clase === "Positivo" || heatmapResult.result.clase === "H. pylori positivo");

  const src  = isLive ? heatmapResult.file.src            : SAMPLES[k].src;
  const heat = hasHeat ? heatmapResult.result.heatmap_b64 : null;
  const positive = isLive ? livePositive : k.startsWith("pos");
  const caseLabel = isLive
    ? (heatmapResult.file.name || "imagen analizada")
    : k;

  const palette      = xaiPalette || DEFAULT_PALETTE;
  const stops        = legendStops(palette);
  const segmentLabel = (SEGMENTS.find((sg) => sg.id === segment) || SEGMENTS[0]).label;
  const diagnosis    = positive
    ? "Sospecha de infección por H. pylori"
    : "Mucosa sin hallazgos patológicos";
  const probability  = isLive
    ? (heatmapResult.result.prob * 100).toFixed(1) + " %"
    : null;

  // Recolorea el mapa de activación cuando cambia la imagen o la paleta.
  useEffect(() => {
    let alive = true;
    if (!heat) { setHeatSrc(null); return undefined; }
    recolorHeatmap(heat, palette).then((out) => { if (alive) setHeatSrc(out); });
    return () => { alive = false; };
  }, [heat, palette]);

  const handleSelectSegment = (id) => {
    if (id === segment) return;   // early return
    setSegment(id);
  };

  async function handleDownload() {
    setDownloading(true);
    try {
      await buildComparativePNG({
        src, heat: heatSrc || heat, opacity: op, showHeat: show,
        caseLabel, diagnosis, probability, segmentLabel, paletteId: palette,
      });
    } finally {
      setDownloading(false);
    }
  }

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Visualización Grad-CAM"),
        h("div", { className: "page-sub" }, "Zonas de la mucosa que sustentan el diagnóstico sugerido"),
      ),
      h("div", { className: "row", style: { gap: 8 } },
        onNewAnalysis && h("button", {
          className: "btn btn-secondary",
          onClick: onNewAnalysis,
        }, h(I.refresh, { size: 14 }), "Nuevo análisis"),
        !isLive && h("select", { className: "select", value: k, onChange: (e) => setK(e.target.value) },
          Object.entries(SAMPLES).map(([key, s]) =>
            h("option", { key, value: key },
              s.name.replace(".jpg","").replace("case_","CASE-") + " · " + s.label)
          ),
        ),
        isLive && h("span", { className: "badge badge-info" }, "Resultado real · " + (heatmapResult.file.name || "imagen")),
        h("button", {
          className: "btn btn-primary",
          onClick: handleDownload,
          disabled: downloading,
          "aria-label": "Exportar comparativa de imagen original y Grad-CAM en PNG",
          title: "Exporta original + Grad-CAM con el diagnóstico sugerido",
        },
          downloading ? h("span", { className: "spinner-sm" }) : h(I.dl, { size: 14 }),
          downloading ? "Generando…" : "Exportar comparativa (PNG)",
        ),
      ),
    ),
    h("div", { className: "card card-pad", style: { marginBottom: 20 } },
      h("div", { className: "row between", style: { flexWrap: "wrap", gap: 12 } },
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 4 } }, "Segmento anatómico analizado"),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-500)" } },
            "Se registra junto al hallazgo para la trazabilidad del estudio."),
        ),
        h("div", {
          className: "segment-pills",
          role: "radiogroup",
          "aria-label": "Segmento anatómico analizado",
        },
          SEGMENTS.map((sg) =>
            h("button", {
              key: sg.id,
              type: "button",
              role: "radio",
              "aria-checked": segment === sg.id,
              className: "segment-pill" + (segment === sg.id ? " selected" : ""),
              onClick: () => handleSelectSegment(sg.id),
            }, sg.label),
          ),
        ),
      ),
    ),
    isLive && !hasHeat && h("div", { className: "alert alert-info", style: { marginBottom: 20 } },
      h(I.info, { size: 16 }),
      h("div", null,
        h("strong", null, "Este estudio no conserva el mapa de activación. "),
        "El historial solo almacena la miniatura; vuelva a analizar la imagen original para regenerar el Grad-CAM.",
      ),
    ),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 } },
      h("div", { className: "card" },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "Imagen original"),
            h("div", { className: "card-sub" }, "Captura endoscópica · luz blanca"),
          ),
          h("span", { className: "badge badge-neutral" }, "ORIGINAL"),
        ),
        h("div", { style: { padding: 16 } },
          h("div", { className: "heatmap-stage" }, h("img", { src })),
        ),
      ),
      h("div", { className: "card" },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "Grad-CAM"),
            h("div", { className: "card-sub" }, "Mapa de calor superpuesto sobre la imagen endoscópica"),
          ),
          h("span", { className: "badge " + (positive ? "badge-pos" : "badge-neg") },
            positive ? "POSITIVO" : "NEGATIVO"),
        ),
        h("div", { style: { padding: 16 } },
          h("div", { className: "heatmap-stage" },
            h("img", { src }),
            show && (heatSrc || heat) && h("img", {
              className: "heat", src: heatSrc || heat, alt: "", style: { opacity: op },
            }),
          ),
          h("div", { style: { marginTop: 14 } },
            h("div", { className: "row between", style: { marginBottom: 6 } },
              h("span", { className: "section-title", style: { marginBottom: 0 } }, "Opacidad del overlay"),
              h("span", { className: "mono", style: { fontSize: 12 } }, Math.round(op * 100) + "%"),
            ),
            h("input", {
              className: "slider", type: "range",
              min: "0", max: "1", step: "0.01",
              value: op, onChange: (e) => setOp(Number(e.target.value)),
              "aria-label": "Opacidad del mapa de activación",
              "aria-valuetext": Math.round(op * 100) + " por ciento",
            }),
            h("div", { className: "row", style: { marginTop: 10, gap: 10 } },
              h("label", { className: "row", style: { gap: 6, fontSize: 12 } },
                h("input", {
                  type: "checkbox", checked: show,
                  onChange: (e) => setShow(e.target.checked),
                  "aria-label": "Mostrar superposición del mapa de activación",
                }),
                "Mostrar superposición",
              ),
            ),
          ),
        ),
      ),
    ),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 20, marginTop: 20 } },
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Leyenda de activación"),
        h("div", { className: "legend" },
          h("span", { className: "legend-label" }, "Baja"),
          h("div", { style: { flex: 1 } },
            h("div", {
              className: "legend-bar",
              style: { background: "linear-gradient(90deg, " +
                stops.map((st) => st.color + " " + st.pct + "%").join(", ") + ")" },
            }),
            h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 4 } },
              stops.map(({ label, color }) =>
                h("span", {
                  key: label,
                  className: "legend-label",
                  style: { color, fontWeight: 600 },
                }, label),
              ),
            ),
          ),
          h("span", { className: "legend-label" }, "Alta"),
        ),
        h("p", {
          style: { fontSize: 11.5, color: "var(--ink-400)", margin: "10px 0 0", lineHeight: 1.5 },
        }, "Los valores indican la magnitud de activación relativa (0 = sin activación, 1 = máxima activación)."),
      ),
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Explicación clínica"),
        isLive && heatmapResult.result && h("div", {
          className: "metrics metrics-2",
          style: { marginBottom: 12 },
        },
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Probabilidad"),
            h("div", { className: "metric-value" },
              (heatmapResult.result.prob * 100).toFixed(2), h("small", null, "%"))),
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Latencia"),
            h("div", { className: "metric-value" },
              fmtLatencia(heatmapResult.result.latencia_ms), h("small", null, "ms"))),
        ),
        positive
          ? h("p", { style: { fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 } },
              "El análisis concentra la activación en el ",
              h("strong", null, "cuadrante superior-derecho"),
              ", donde se observa una zona de mucosa con ",
              h("strong", null, "patrón nodular irregular y enrojecimiento focal"),
              " compatible con cambios inflamatorios crónicos asociados a colonización por H. pylori.")
          : h("p", { style: { fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 } },
              "La activación es ",
              h("strong", null, "difusa y de baja magnitud"),
              ", sin focos claros sobre la mucosa. No se identifican patrones sugestivos de infección."),
        h("div", { className: "alert alert-info", style: { marginTop: 14 } },
          h(I.info, { size: 16 }),
          h("div", null,
            h("strong", null, "Interpretación asistida. "),
            "El Grad-CAM muestra qué mira el modelo, no por qué. Validar con criterio clínico.",
          ),
        ),
      ),
    ),
  );
}
