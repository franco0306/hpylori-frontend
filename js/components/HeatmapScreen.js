import { I } from "../icons.js";
import { SAMPLES } from "../samples.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

const LEGEND_STOPS = [
  { pct: 0,   color: "#2347C5", label: "0.0" },
  { pct: 33,  color: "#16A34A", label: "0.3" },
  { pct: 60,  color: "#FBBF24", label: "0.6" },
  { pct: 100, color: "#DC2626", label: "1.0" },
];

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function buildPNG(sample, opacity, showHeat, caseKey) {
  const W = 600, H = 480, LEG_H = 48;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H + LEG_H;
  const ctx = canvas.getContext("2d");

  const orig = await loadImage(sample.src);
  ctx.drawImage(orig, 0, 0, W, H);

  if (showHeat) {
    const heat = await loadImage(sample.heat);
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(heat, 0, 0, W, H);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  // Legend strip background
  ctx.fillStyle = "#0f172a";
  ctx.fillRect(0, H, W, LEG_H);

  // Gradient bar
  const PAD = 72, BAR_Y = H + 10, BAR_H = 12, BAR_W = W - PAD * 2;
  const grad = ctx.createLinearGradient(PAD, 0, PAD + BAR_W, 0);
  grad.addColorStop(0,    "rgba(35,71,197,0.95)");
  grad.addColorStop(0.33, "rgba(22,163,74,0.95)");
  grad.addColorStop(0.6,  "rgba(251,191,36,0.95)");
  grad.addColorStop(1,    "rgba(220,38,38,0.95)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(PAD, BAR_Y, BAR_W, BAR_H, 6);
  ctx.fill();

  // Tick labels
  ctx.fillStyle = "#94a3b8";
  ctx.font = "10px monospace";
  LEGEND_STOPS.forEach(({ pct, label }) => {
    const x = PAD + (BAR_W * pct) / 100;
    ctx.textAlign = pct === 0 ? "left" : pct === 100 ? "right" : "center";
    ctx.fillText(label, x, BAR_Y + BAR_H + 14);
  });

  // Side labels
  ctx.textAlign = "right";
  ctx.fillText("Baja", PAD - 6, BAR_Y + BAR_H - 1);
  ctx.textAlign = "left";
  ctx.fillText("Alta", PAD + BAR_W + 6, BAR_Y + BAR_H - 1);

  // File name watermark
  ctx.fillStyle = "rgba(148,163,184,0.5)";
  ctx.font = "9px monospace";
  ctx.textAlign = "center";
  ctx.fillText(`gradcam_${caseKey} · Grad-CAM · EndoScan AI`, W / 2, H + LEG_H - 4);

  const a = document.createElement("a");
  a.download = `gradcam_${caseKey}_${new Date().toISOString().slice(0, 10)}.png`;
  a.href = canvas.toDataURL("image/png");
  a.click();
}

export function HeatmapScreen({ model, heatmapResult }) {
  const [k, setK]               = useState("pos1");
  const [op, setOp]             = useState(0.65);
  const [show, setShow]         = useState(true);
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

  async function handleDownload() {
    setDownloading(true);
    try {
      await buildPNG({ src, heat }, op, show, caseLabel);
    } finally {
      setDownloading(false);
    }
  }

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Visualización Grad-CAM"),
        h("div", { className: "page-sub" }, "HU-002 · Mapa de activación de " + model.name),
      ),
      h("div", { className: "row", style: { gap: 8 } },
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
        },
          h(I.dl, { size: 14 }),
          downloading ? "Generando…" : "Descargar PNG",
        ),
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
            h("div", { className: "card-sub" }, "Capa layer4.bn3 · " + model.name),
          ),
          h("span", { className: "badge " + (positive ? "badge-pos" : "badge-neg") },
            positive ? "POSITIVO" : "NEGATIVO"),
        ),
        h("div", { style: { padding: 16 } },
          h("div", { className: "heatmap-stage" },
            h("img", { src }),
            show && h("img", { className: "heat", src: heat, style: { opacity: op } }),
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
            }),
            h("div", { className: "row", style: { marginTop: 10, gap: 10 } },
              h("label", { className: "row", style: { gap: 6, fontSize: 12 } },
                h("input", { type: "checkbox", checked: show, onChange: (e) => setShow(e.target.checked) }),
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
            h("div", { className: "legend-bar" }),
            h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 4 } },
              LEGEND_STOPS.map(({ label, color }) =>
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
          className: "metrics",
          style: { marginBottom: 12 },
        },
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Probabilidad"),
            h("div", { className: "metric-value" },
              (heatmapResult.result.prob * 100).toFixed(2), h("small", null, "%"))),
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Latencia"),
            h("div", { className: "metric-value" },
              heatmapResult.result.latencia_ms, h("small", null, "ms"))),
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Modelo"),
            h("div", { className: "metric-value", style: { fontSize: 12 } },
              heatmapResult.result.modelo || model.name)),
        ),
        positive
          ? h("p", { style: { fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 } },
              "El modelo concentra su atención en el ",
              h("strong", null, "cuadrante superior-derecho"),
              ", donde se observa una zona de mucosa con ",
              h("strong", null, "patrón nodular irregular y enrojecimiento focal"),
              " compatible con cambios inflamatorios crónicos asociados a colonización por H. pylori.")
          : h("p", { style: { fontSize: 13.5, color: "var(--ink-700)", lineHeight: 1.6, margin: 0 } },
              "La activación es ",
              h("strong", null, "difusa y de baja magnitud"),
              ", sin focos claros sobre la mucosa. El modelo no encuentra patrones discriminativos."),
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
