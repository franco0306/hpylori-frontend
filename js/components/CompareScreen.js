import { CONFIG } from "../config.js";
import { MODELS } from "../models.js";
import { SAMPLES } from "../samples.js";
import { predict } from "../api.js";
import { I } from "../icons.js";

const React = window.React;
const { useState, useEffect } = React;
const h = React.createElement;

// ── Sección 1: tabla de métricas de validación ───────────────────────────────
function MetricsTable({ models, picked, toggle }) {
  const visible = models.filter((m) => picked.includes(m.id));

  const metrics = [
    { key: "accuracy",    label: "Accuracy",      fmt: (v) => (v * 100).toFixed(2) + "%", higher: true },
    { key: "sensitivity", label: "Sensibilidad",  fmt: (v) => (v * 100).toFixed(2) + "%", higher: true },
    { key: "specificity", label: "Especificidad", fmt: (v) => (v * 100).toFixed(2) + "%", higher: true },
    { key: "auc",         label: "AUC-ROC",       fmt: (v) => v.toFixed(3),                higher: true },
    { key: "latency_ms",  label: "Latencia",      fmt: (v) => v + " ms",                   higher: false },
    { key: "model_mb",    label: "Tamaño modelo", fmt: (v) => v + " MB",                   higher: false },
  ];

  const bestId = (key, higher) => {
    if (!visible.length) return null;
    return visible.reduce((a, b) =>
      higher ? (b.metrics[key] > a.metrics[key] ? b : a)
             : (b.metrics[key] < a.metrics[key] ? b : a)
    ).id;
  };

  return h("div", { className: "card", style: { marginBottom: 20 } },
    h("div", { className: "card-head" },
      h("div", null,
        h("h3", { className: "card-title" }, "Metricas de validacion por modelo"),
        h("div", { className: "card-sub" }, "Set de validacion n=2,047 imagenes · mejor valor resaltado en verde"),
      ),
      h("span", { className: "muted", style: { fontSize: 12 } },
        visible.length + " de " + models.length + " modelos"),
    ),
    h("table", { className: "table" },
      h("thead", null, h("tr", null,
        h("th", null, "Metrica"),
        ...visible.map((m) => h("th", { key: m.id }, m.name)),
      )),
      h("tbody", null, ...metrics.map((metric) => {
        const best = bestId(metric.key, metric.higher);
        const vals = visible.map((m) => m.metrics[metric.key]);
        const max  = Math.max(...vals);
        return h("tr", { key: metric.key },
          h("td", null, h("strong", null, metric.label)),
          ...visible.map((m) => {
            const v     = m.metrics[metric.key];
            const ratio = metric.higher ? v / max : (max - v) / max + 0.2;
            const isBest = m.id === best;
            return h("td", { key: m.id, style: { minWidth: 130 } },
              h("div", { className: "row", style: { gap: 8 } },
                h("div", { style: { flex: 1, height: 6, background: "var(--ink-100)", borderRadius: 999, overflow: "hidden" } },
                  h("div", { style: {
                    width: Math.min(100, ratio * 100) + "%", height: "100%",
                    background: isBest ? "var(--green-600)" : "var(--blue-700)",
                    borderRadius: 999,
                  }}),
                ),
                h("span", { className: "mono", style: {
                  fontSize: 12, minWidth: 64, textAlign: "right",
                  fontWeight: isBest ? 700 : 500,
                  color: isBest ? "var(--green-600)" : "var(--ink-900)",
                }}, metric.fmt(v)),
              ),
            );
          }),
        );
      })),
    ),
  );
}

// ── Sección 2: análisis cruzado — misma imagen, todos los modelos ─────────────
const BADGE_POS = { background: "var(--red-50)",   color: "var(--red-600)",   border: "1px solid var(--red-200)" };
const BADGE_NEG = { background: "var(--green-50)", color: "var(--green-600)", border: "1px solid var(--green-200)" };

function CrossAnalysis() {
  const [imgKey,   setImgKey]   = useState("pos1");
  const [running,  setRunning]  = useState(false);
  const [results,  setResults]  = useState(null);   // [{ modelId, name, clase, prob, latencia_ms, error }]
  const [progress, setProgress] = useState(0);

  const sample = SAMPLES[imgKey];

  const runAll = async () => {
    setRunning(true); setResults(null); setProgress(0);
    const isPos = imgKey.startsWith("pos");

    const tasks = MODELS.map(async (m, i) => {
      try {
        const res = await predict(sample, {
          modelId:  m.id,
          positive: isPos,
          heat:     sample.heat,
        });
        setProgress((p) => p + 1);
        return { modelId: m.id, name: m.name, ...res, error: false };
      } catch {
        setProgress((p) => p + 1);
        return { modelId: m.id, name: m.name, clase: null, prob: null, latencia_ms: null, error: true };
      }
    });

    const all = await Promise.all(tasks);
    setResults(all);
    setRunning(false);
  };

  const positiveCount = results ? results.filter((r) => !r.error && r.clase === "Positivo").length : 0;
  const consensus     = results ? (positiveCount > MODELS.length / 2 ? "Positivo" : "Negativo") : null;
  const agreement     = results ? Math.round((results.filter((r) => !r.error && (r.clase === consensus)).length / results.filter(r => !r.error).length) * 100) : 0;

  return h("div", { className: "card", style: { marginTop: 20 } },
    h("div", { className: "card-head" },
      h("div", null,
        h("h3", { className: "card-title" }, "Analisis comparativo por imagen"),
        h("div", { className: "card-sub" },
          "Misma imagen procesada por los 6 modelos simultaneamente · HU-003"),
      ),
    ),
    h("div", { className: "card-pad" },

      // Selector de imagen
      h("div", { className: "section-title" }, "Seleccionar imagen de prueba"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 } },
        Object.entries(SAMPLES).map(([k, s]) =>
          h("button", {
            key: k,
            onClick: () => { setImgKey(k); setResults(null); },
            style: {
              border: k === imgKey ? "2px solid var(--blue-700)" : "1px solid var(--ink-200)",
              borderRadius: 8, padding: 6, background: k === imgKey ? "var(--blue-50)" : "var(--white)",
              cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
            },
          },
            h("img", { src: s.src, style: { width: "100%", height: 52, objectFit: "cover", borderRadius: 4 } }),
            h("div", { style: { fontSize: 10, fontWeight: 700, color: k.startsWith("pos") ? "var(--red-600)" : "var(--green-600)" } },
              s.label),
            h("div", { style: { fontSize: 9, color: "var(--ink-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" } },
              s.name.replace(".jpg","")),
          )
        ),
      ),

      // Imagen seleccionada + botón
      h("div", { className: "row between", style: { marginBottom: 16, gap: 16 } },
        h("div", { style: { display: "flex", gap: 12, alignItems: "center" } },
          h("img", { src: sample.src, style: { width: 80, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--ink-200)" } }),
          h("div", null,
            h("div", { style: { fontWeight: 600, fontSize: 13 } }, sample.name),
            h("div", { style: { fontSize: 12, color: "var(--ink-500)", marginTop: 2 } },
              "Etiqueta real: ",
              h("span", { style: { fontWeight: 700, color: imgKey.startsWith("pos") ? "var(--red-600)" : "var(--green-600)" } },
                sample.label),
            ),
          ),
        ),
        h("button", {
          className: "btn btn-primary",
          onClick: runAll,
          disabled: running,
          style: { minWidth: 200 },
        },
          running
            ? h("span", { className: "spinner-sm" })
            : h(I.bact, { size: 14 }),
          running
            ? ` Analizando... (${progress}/${MODELS.length})`
            : "Analizar con los 6 modelos",
        ),
      ),

      // Barra de progreso mientras corre
      running && h("div", null,
        h("div", { className: "progress", style: { marginBottom: 12 } },
          h("div", { className: "progress-fill", style: { width: (progress / MODELS.length * 100) + "%" } })),
      ),

      // Tabla de resultados
      results && h("div", null,
        // Resumen de consenso
        h("div", { style: {
          display: "flex", gap: 12, marginBottom: 16,
          padding: "12px 16px", borderRadius: 10,
          background: consensus === "Positivo" ? "var(--red-50)" : "var(--green-50)",
          border: "1px solid " + (consensus === "Positivo" ? "var(--red-200)" : "var(--green-200)"),
        }},
          h("div", { style: { flex: 1 } },
            h("div", { style: { fontSize: 11, color: "var(--ink-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 } },
              "Consenso de los modelos"),
            h("div", { style: { fontSize: 18, fontWeight: 800, color: consensus === "Positivo" ? "var(--red-600)" : "var(--green-600)" } },
              consensus + (consensus === "Positivo" ? " · H. pylori" : " · sin hallazgo")),
          ),
          h("div", { style: { textAlign: "right" } },
            h("div", { style: { fontSize: 11, color: "var(--ink-500)", marginBottom: 4 } }, "Acuerdo"),
            h("div", { style: { fontSize: 22, fontWeight: 800 } }, agreement + "%"),
            h("div", { style: { fontSize: 11, color: "var(--ink-400)" } },
              positiveCount + " de " + results.filter(r => !r.error).length + " predicen positivo"),
          ),
        ),

        // Tabla por modelo
        h("table", { className: "table" },
          h("thead", null,
            h("tr", null,
              h("th", null, "Modelo"),
              h("th", null, "Prediccion"),
              h("th", null, "P(positivo)"),
              h("th", null, "Confianza"),
              h("th", null, "Latencia"),
              h("th", null, "Acuerdo"),
            ),
          ),
          h("tbody", null, ...results.map((r) => {
            if (r.error) return h("tr", { key: r.modelId },
              h("td", null, h("strong", null, r.name)),
              h("td", { colSpan: 5, style: { color: "var(--ink-400)", fontSize: 12 } }, "Error de inferencia"),
            );
            const isPos   = r.clase === "Positivo";
            const conf    = Math.max(r.prob, 1 - r.prob);
            const confLbl = conf >= 0.85 ? "Alta" : conf >= 0.65 ? "Media" : "Baja";
            const confColor = conf >= 0.85 ? "var(--green-600)" : conf >= 0.65 ? "var(--amber-600)" : "var(--red-600)";
            const agrees  = r.clase === consensus;
            return h("tr", { key: r.modelId },
              h("td", null,
                h("div", { style: { fontWeight: 600 } }, r.name),
                h("div", { style: { fontSize: 11, color: "var(--ink-400)" } },
                  MODELS.find(m => m.id === r.modelId)?.arch || ""),
              ),
              h("td", null,
                h("span", { style: { ...( isPos ? BADGE_POS : BADGE_NEG ), padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700 } },
                  r.clase),
              ),
              h("td", { className: "mono", style: { fontWeight: 600 } },
                (r.prob * 100).toFixed(2) + "%"),
              h("td", null,
                h("span", { style: { color: confColor, fontWeight: 600, fontSize: 12 } }, confLbl),
                h("span", { style: { color: "var(--ink-400)", fontSize: 11 } }, " (" + (conf * 100).toFixed(0) + "%)"),
              ),
              h("td", { className: "mono", style: { color: r.latencia_ms < 100 ? "var(--green-600)" : r.latencia_ms < 200 ? "var(--ink-700)" : "var(--amber-600)" } },
                r.latencia_ms + " ms"),
              h("td", null,
                agrees
                  ? h("span", { style: { color: "var(--green-600)", fontWeight: 700, fontSize: 13 } }, "Acuerda")
                  : h("span", { style: { color: "var(--red-400)", fontWeight: 700, fontSize: 13 } }, "Discrepa"),
              ),
            );
          })),
        ),

        // Nota de interpretación
        h("div", { className: "alert alert-info", style: { marginTop: 16 } },
          h(I.info, { size: 16 }),
          h("div", null,
            h("strong", null, "Interpretacion del analisis comparativo. "),
            "Un alto porcentaje de acuerdo entre modelos sugiere mayor certeza en la prediccion. Discrepancias entre arquitecturas pueden indicar un caso ambiguo que requiere revision clinica adicional.",
          ),
        ),
      ),
    ),
  );
}

// ── Pantalla principal ────────────────────────────────────────────────────────
export function CompareScreen({ modelId, onSelect }) {
  const [picked, setPicked] = useState(MODELS.map((m) => m.id));

  const toggle  = (id) => setPicked((p) => p.includes(id) ? p.filter((x) => x !== id) : [...p, id]);
  const visible = MODELS.filter((m) => picked.includes(m.id));

  const bestAccuracy = MODELS.reduce((a, b) => b.metrics.accuracy > a.metrics.accuracy ? b : a);
  const bestLatency  = MODELS.reduce((a, b) => b.metrics.latency_ms < a.metrics.latency_ms ? b : a);

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Comparativa de modelos"),
        h("div", { className: "page-sub" },
          "Metricas de validacion + analisis cruzado — misma imagen por los 6 modelos"),
      ),
    ),

    // Filtro de modelos
    h("div", { className: "card card-pad", style: { marginBottom: 20 } },
      h("div", { className: "section-title" }, "Modelos a comparar"),
      h("div", { className: "row", style: { gap: 8, flexWrap: "wrap" } },
        ...MODELS.map((m) =>
          h("label", { key: m.id, className: "row", style: {
            gap: 6, padding: "6px 10px",
            border: "1px solid var(--ink-200)", borderRadius: 6, cursor: "pointer",
            background: picked.includes(m.id) ? "var(--blue-50)" : "var(--white)",
          }},
            h("input", { type: "checkbox", checked: picked.includes(m.id), onChange: () => toggle(m.id) }),
            h("span", { style: { fontWeight: 600, fontSize: 13 } }, m.name),
            h("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-500)" } }, m.version),
          )
        ),
      ),
    ),

    h(MetricsTable, { models: MODELS, picked, toggle }),

    // Recomendación operativa
    h("div", { className: "card", style: { marginBottom: 20 } },
      h("div", { className: "card-head" }, h("h3", { className: "card-title" }, "Recomendacion operativa")),
      h("div", { className: "card-pad" },
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12 } },
          h("div", { style: { padding: 14, border: "1px solid var(--green-100)", background: "var(--green-50)", borderRadius: 8 } },
            h("div", { style: { fontWeight: 700, color: "var(--green-600)" } }, "Mayor precision"),
            h("div", { style: { fontSize: 13, marginTop: 4 } }, bestAccuracy.name),
            h("div", { className: "muted", style: { fontSize: 12, marginTop: 4 } },
              "Acc " + (bestAccuracy.metrics.accuracy * 100).toFixed(2) + "% · AUC " + bestAccuracy.metrics.auc.toFixed(3)),
          ),
          h("div", { style: { padding: 14, border: "1px solid var(--blue-100)", background: "var(--blue-50)", borderRadius: 8 } },
            h("div", { style: { fontWeight: 700, color: "var(--blue-700)" } }, "Mejor balance clinico"),
            h("div", { style: { fontSize: 13, marginTop: 4 } }, "ResNet50 v2.0"),
            h("div", { className: "muted", style: { fontSize: 12, marginTop: 4 } },
              "Recall 84.95% · Umbral optimizado 0.255 · AUC 0.9524"),
          ),
          h("div", { style: { padding: 14, border: "1px solid var(--ink-200)", background: "var(--ink-50)", borderRadius: 8 } },
            h("div", { style: { fontWeight: 700 } }, "Mas rapido / liviano"),
            h("div", { style: { fontSize: 13, marginTop: 4 } }, bestLatency.name),
            h("div", { className: "muted", style: { fontSize: 12, marginTop: 4 } },
              bestLatency.metrics.latency_ms + " ms · " + bestLatency.metrics.model_mb + " MB"),
          ),
        ),
        h("div", { className: "row", style: { marginTop: 16, gap: 8, justifyContent: "flex-end" } },
          h("button", { className: "btn btn-primary", onClick: () => onSelect("resnet50") },
            "Aplicar recomendacion (ResNet50)"),
        ),
      ),
    ),

    h(CrossAnalysis, null),
  );
}
