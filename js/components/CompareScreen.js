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
function MiniBar({ value, max, color }) {
  return h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
    h("div", { style: { flex: 1, height: 5, background: "var(--ink-100)", borderRadius: 999, overflow: "hidden" } },
      h("div", { style: { width: (value / max * 100) + "%", height: "100%", background: color, borderRadius: 999 } }),
    ),
    h("span", { className: "mono", style: { fontSize: 11, minWidth: 42, textAlign: "right", color: "var(--ink-700)" } },
      (value * 100).toFixed(1) + "%"),
  );
}

function ModelCard({ r, consensus, groundTruth }) {
  if (r.error) return h("div", { style: {
    border: "1px solid var(--ink-200)", borderRadius: 10, padding: 14,
    display: "flex", alignItems: "center", justifyContent: "center",
    color: "var(--ink-400)", fontSize: 12, minHeight: 120,
  }}, r.name + " — error de inferencia");

  const modelMeta  = MODELS.find((m) => m.id === r.modelId);
  const isPos      = r.clase === "Positivo";
  const conf       = Math.max(r.prob, 1 - r.prob);
  const confLbl    = conf >= 0.85 ? "Alta" : conf >= 0.65 ? "Media" : "Baja";
  const confColor  = conf >= 0.85 ? "var(--green-600)" : conf >= 0.65 ? "var(--amber-600)" : "var(--red-600)";
  const agrees     = r.clase === consensus;
  const correct    = groundTruth !== null && ((isPos && groundTruth) || (!isPos && !groundTruth));
  const accentColor = isPos ? "var(--red-500)" : "var(--green-600)";
  const mt         = modelMeta?.metrics;

  return h("div", { style: {
    border: "1px solid " + (isPos ? "var(--red-200)" : "var(--green-200)"),
    borderRadius: 10, overflow: "hidden",
    background: isPos ? "var(--red-50)" : "var(--green-50)",
  }},
    // Header tarjeta
    h("div", { style: {
      background: accentColor, padding: "8px 12px",
      display: "flex", justifyContent: "space-between", alignItems: "center",
    }},
      h("div", null,
        h("div", { style: { color: "#fff", fontWeight: 800, fontSize: 13 } }, r.name),
        h("div", { style: { color: "rgba(255,255,255,.75)", fontSize: 10 } }, modelMeta?.arch || ""),
      ),
      h("div", { style: { textAlign: "right" } },
        h("div", { style: { color: "#fff", fontWeight: 800, fontSize: 16 } }, (conf * 100).toFixed(0) + "%"),
        h("div", { style: { color: "rgba(255,255,255,.75)", fontSize: 9 } }, "confianza"),
      ),
    ),

    h("div", { style: { padding: 12 } },
      // Resultado en vivo
      h("div", { style: { fontSize: 10, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 } },
        "Resultado en vivo"),
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
        h("div", { style: { fontWeight: 800, fontSize: 14, color: accentColor } }, r.clase),
        h("div", { style: { textAlign: "right" } },
          h("div", { className: "mono", style: { fontWeight: 700, fontSize: 13 } }, (r.prob * 100).toFixed(2) + "%"),
          h("div", { style: { fontSize: 9, color: "var(--ink-400)" } }, "P(positivo)"),
        ),
      ),
      // Barra de probabilidad
      h("div", { style: { height: 6, background: "var(--ink-100)", borderRadius: 999, marginBottom: 10, overflow: "hidden" } },
        h("div", { style: { width: (r.prob * 100) + "%", height: "100%", background: accentColor, borderRadius: 999 } }),
      ),
      h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 10 } },
        h("span", { style: { color: "var(--ink-500)" } },
          "Latencia: ", h("span", { className: "mono", style: { fontWeight: 600 } }, r.latencia_ms + " ms")),
        h("span", { style: { color: confColor, fontWeight: 600 } }, "Conf. " + confLbl),
      ),

      // Etiquetas de acuerdo / correcto
      h("div", { style: { display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" } },
        h("span", { style: {
          padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: agrees ? "#dcfce7" : "#fef2f2",
          color: agrees ? "var(--green-600)" : "var(--red-600)",
          border: "1px solid " + (agrees ? "var(--green-200)" : "var(--red-200)"),
        }}, agrees ? "Acuerda con consenso" : "Discrepa del consenso"),
        groundTruth !== null && h("span", { style: {
          padding: "2px 7px", borderRadius: 999, fontSize: 10, fontWeight: 700,
          background: correct ? "#dcfce7" : "#fef2f2",
          color: correct ? "var(--green-600)" : "var(--red-600)",
          border: "1px solid " + (correct ? "var(--green-200)" : "var(--red-200)"),
        }}, correct ? "Correcto" : "Incorrecto"),
      ),

      // Separador
      h("div", { style: { borderTop: "1px solid var(--ink-200)", margin: "8px 0" } }),

      // Métricas de validación del modelo
      h("div", { style: { fontSize: 10, fontWeight: 700, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 } },
        "Metricas de validacion"),
      mt && h("div", { style: { display: "flex", flexDirection: "column", gap: 5 } },
        h("div", null,
          h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-600)", marginBottom: 2 } },
            h("span", null, "Accuracy"), h("span", { className: "mono" }, (mt.accuracy * 100).toFixed(2) + "%")),
          h(MiniBar, { value: mt.accuracy, max: 1, color: "var(--blue-700)" }),
        ),
        h("div", null,
          h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-600)", marginBottom: 2 } },
            h("span", null, "Sensibilidad"), h("span", { className: "mono" }, (mt.sensitivity * 100).toFixed(2) + "%")),
          h(MiniBar, { value: mt.sensitivity, max: 1, color: "var(--red-500)" }),
        ),
        h("div", null,
          h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--ink-600)", marginBottom: 2 } },
            h("span", null, "Especificidad"), h("span", { className: "mono" }, (mt.specificity * 100).toFixed(2) + "%")),
          h(MiniBar, { value: mt.specificity, max: 1, color: "var(--green-600)" }),
        ),
        h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10, marginTop: 2 } },
          h("span", { style: { color: "var(--ink-600)" } }, "AUC-ROC"),
          h("span", { className: "mono", style: { fontWeight: 700, color: "var(--blue-700)" } }, mt.auc.toFixed(4)),
        ),
        h("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 10 } },
          h("span", { style: { color: "var(--ink-600)" } }, "Tamano modelo"),
          h("span", { className: "mono", style: { color: "var(--ink-500)" } }, mt.model_mb + " MB"),
        ),
      ),
    ),
  );
}

function CrossAnalysis() {
  const [imgKey,   setImgKey]   = useState("pos1");
  const [running,  setRunning]  = useState(false);
  const [results,  setResults]  = useState(null);
  const [progress, setProgress] = useState(0);

  const sample     = SAMPLES[imgKey];
  const groundTruth = imgKey.startsWith("pos");

  const runAll = async () => {
    setRunning(true); setResults(null); setProgress(0);
    const tasks = MODELS.map(async (m) => {
      try {
        const res = await predict(sample, { modelId: m.id, positive: groundTruth, heat: sample.heat });
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

  const valid         = results ? results.filter((r) => !r.error) : [];
  const positiveCount = valid.filter((r) => r.clase === "Positivo").length;
  const consensus     = results ? (positiveCount >= Math.ceil(valid.length / 2) ? "Positivo" : "Negativo") : null;
  const agreement     = valid.length ? Math.round(valid.filter((r) => r.clase === consensus).length / valid.length * 100) : 0;
  const correctCount  = valid.filter((r) => (r.clase === "Positivo") === groundTruth).length;

  return h("div", { className: "card", style: { marginTop: 20 } },
    h("div", { className: "card-head" },
      h("div", null,
        h("h3", { className: "card-title" }, "Analisis comparativo por imagen"),
        h("div", { className: "card-sub" }, "Misma imagen procesada por los 6 modelos en paralelo · metricas en vivo + validacion"),
      ),
    ),
    h("div", { className: "card-pad" },

      // Selector de imagen
      h("div", { className: "section-title" }, "Seleccionar imagen de prueba"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8, marginBottom: 16 } },
        Object.entries(SAMPLES).map(([k, s]) =>
          h("button", { key: k, onClick: () => { setImgKey(k); setResults(null); }, style: {
            border: k === imgKey ? "2px solid var(--blue-700)" : "1px solid var(--ink-200)",
            borderRadius: 8, padding: 6,
            background: k === imgKey ? "var(--blue-50)" : "var(--white)",
            cursor: "pointer", display: "flex", flexDirection: "column", gap: 4, alignItems: "center",
          }},
            h("img", { src: s.src, style: { width: "100%", height: 52, objectFit: "cover", borderRadius: 4 } }),
            h("div", { style: { fontSize: 10, fontWeight: 700, color: k.startsWith("pos") ? "var(--red-600)" : "var(--green-600)" } }, s.label),
            h("div", { style: { fontSize: 9, color: "var(--ink-400)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" } },
              s.name.replace(".jpg","")),
          )
        ),
      ),

      // Imagen + botón
      h("div", { className: "row between", style: { marginBottom: 16 } },
        h("div", { style: { display: "flex", gap: 12, alignItems: "center" } },
          h("img", { src: sample.src, style: { width: 80, height: 60, objectFit: "cover", borderRadius: 6, border: "1px solid var(--ink-200)" } }),
          h("div", null,
            h("div", { style: { fontWeight: 600, fontSize: 13 } }, sample.name),
            h("div", { style: { fontSize: 12, color: "var(--ink-500)", marginTop: 2 } },
              "Etiqueta real: ",
              h("span", { style: { fontWeight: 700, color: groundTruth ? "var(--red-600)" : "var(--green-600)" } }, sample.label),
            ),
          ),
        ),
        h("button", { className: "btn btn-primary", onClick: runAll, disabled: running, style: { minWidth: 210 } },
          running ? h("span", { className: "spinner-sm" }) : h(I.bact, { size: 14 }),
          running ? ` Analizando... (${progress}/${MODELS.length})` : "Analizar con los 6 modelos",
        ),
      ),

      running && h("div", { className: "progress", style: { marginBottom: 16 } },
        h("div", { className: "progress-fill", style: { width: (progress / MODELS.length * 100) + "%" } }),
      ),

      // Resultados
      results && h("div", null,
        // Banner de consenso
        h("div", { style: {
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12,
          marginBottom: 20, padding: "14px 16px", borderRadius: 10,
          background: consensus === "Positivo" ? "var(--red-50)" : "var(--green-50)",
          border: "1px solid " + (consensus === "Positivo" ? "var(--red-200)" : "var(--green-200)"),
        }},
          h("div", null,
            h("div", { style: { fontSize: 10, color: "var(--ink-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 } }, "Consenso"),
            h("div", { style: { fontSize: 16, fontWeight: 800, color: consensus === "Positivo" ? "var(--red-600)" : "var(--green-600)" } },
              consensus + (consensus === "Positivo" ? " · H. pylori" : " · sin hallazgo")),
          ),
          h("div", { style: { textAlign: "center" } },
            h("div", { style: { fontSize: 10, color: "var(--ink-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 } }, "Acuerdo entre modelos"),
            h("div", { style: { fontSize: 22, fontWeight: 800 } }, agreement + "%"),
            h("div", { style: { fontSize: 11, color: "var(--ink-400)" } },
              positiveCount + " de " + valid.length + " predicen positivo"),
          ),
          h("div", { style: { textAlign: "right" } },
            h("div", { style: { fontSize: 10, color: "var(--ink-500)", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 } }, "Aciertos vs etiqueta real"),
            h("div", { style: { fontSize: 22, fontWeight: 800, color: correctCount === valid.length ? "var(--green-600)" : correctCount > valid.length / 2 ? "var(--amber-600)" : "var(--red-600)" } },
              correctCount + " / " + valid.length),
            h("div", { style: { fontSize: 11, color: "var(--ink-400)" } }, "modelos correctos"),
          ),
        ),

        // Grid de tarjetas por modelo
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 } },
          ...results.map((r) => h(ModelCard, { key: r.modelId, r, consensus, groundTruth })),
        ),

        h("div", { className: "alert alert-info", style: { marginTop: 16 } },
          h(I.info, { size: 16 }),
          h("div", null,
            h("strong", null, "Interpretacion. "),
            "Las metricas de validacion reflejan el rendimiento historico del modelo en el set de prueba (n=2,051). El resultado en vivo muestra la inferencia real sobre la imagen seleccionada. Un alto acuerdo entre arquitecturas aumenta la confianza clinica en la prediccion.",
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
