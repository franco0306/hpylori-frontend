import { I } from "../icons.js";
import { MODELS } from "../models.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

// Interpretación clínica del umbral para orientar al médico
function thresholdTier(t) {
  if (t < 0.25) return { label: "Muy sensible",    color: "var(--red-600)",   desc: "Detecta casi todos los positivos. Mayor riesgo de falsos positivos." };
  if (t < 0.40) return { label: "Sensible",         color: "var(--amber-600)", desc: "Prioriza recall. Recomendado para screening masivo." };
  if (t < 0.60) return { label: "Balanceado",       color: "var(--green-600)", desc: "Equilibrio entre sensibilidad y especificidad." };
  if (t < 0.75) return { label: "Específico",       color: "var(--blue-700)",  desc: "Prioriza precisión. Menos falsos positivos." };
  return             { label: "Muy específico",    color: "var(--ink-500)",   desc: "Alta certeza en positivos. Mayor riesgo de falsos negativos." };
}

export function SettingsScreen({ prefs, onSave }) {
  // Estado local: el usuario edita aquí antes de guardar
  const [modelId,   setModelId]   = useState(prefs.modelId);
  const [threshold, setThreshold] = useState(prefs.threshold);
  const [saved,     setSaved]     = useState(false);

  const tier    = thresholdTier(threshold);
  const changed = modelId !== prefs.modelId || threshold !== prefs.threshold;

  function handleSave() {
    onSave({ modelId, threshold });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setModelId("resnet50");
    setThreshold(0.5);
  }

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Configuración"),
        h("div", { className: "page-sub" }, "HU-008 · Preferencias de inferencia · guardado en tu cuenta"),
      ),
      h("div", { className: "row", style: { gap: 8 } },
        h("button", { className: "btn btn-ghost", onClick: handleReset }, "Restablecer valores"),
        h("button", {
          className: "btn btn-primary",
          onClick: handleSave,
          disabled: !changed && !saved,
        },
          saved ? h(I.check, { size: 14 }) : h(I.dl, { size: 14 }),
          saved ? "Guardado" : "Guardar cambios",
        ),
      ),
    ),

    h("div", { style: { display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: 20 } },

      // ── Umbral de clasificación ─────────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Umbral de clasificación"),
        h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, marginBottom: 20, lineHeight: 1.6 } },
          "Define el valor mínimo de P(positivo) para clasificar una imagen como H. pylori positivo. ",
          "Valores bajos aumentan la sensibilidad (menos falsos negativos); valores altos aumentan la especificidad.",
        ),

        // Valor actual
        h("div", { className: "row between", style: { marginBottom: 8 } },
          h("span", { className: "section-title", style: { marginBottom: 0 } }, "Valor actual"),
          h("span", { className: "mono", style: { fontSize: 22, fontWeight: 700, color: tier.color } },
            threshold.toFixed(2),
          ),
        ),

        // Slider
        h("input", {
          className: "slider", type: "range",
          min: "0.10", max: "0.90", step: "0.05",
          value: threshold,
          onChange: (e) => { setThreshold(Number(e.target.value)); setSaved(false); },
          style: { marginBottom: 12 },
        }),

        // Escala visual
        h("div", { className: "row between", style: { fontSize: 10.5, color: "var(--ink-400)", marginBottom: 20 } },
          h("span", null, "0.10 · Más sensible"),
          h("span", null, "0.50"),
          h("span", null, "0.90 · Más específico"),
        ),

        // Badge interpretación
        h("div", { className: "alert", style: { background: "var(--ink-50)", border: "1px solid var(--ink-200)" } },
          h("div", {
            style: {
              width: 10, height: 10, borderRadius: "50%",
              background: tier.color, flexShrink: 0, marginTop: 2,
            },
          }),
          h("div", null,
            h("strong", { style: { color: tier.color } }, tier.label + " "),
            h("span", { style: { fontSize: 12.5 } }, tier.desc),
          ),
        ),

        // Nota sobre ResNet50
        threshold !== prefs.threshold && h("div", { className: "alert alert-info", style: { marginTop: 12 } },
          h(I.info, { size: 14 }),
          h("div", { style: { fontSize: 12 } },
            "El modelo ResNet50 fue evaluado con umbral 0.255. Cambiarlo afectará sensibilidad y especificidad respecto a las métricas publicadas.",
          ),
        ),
      ),

      // ── Modelo por defecto ──────────────────────────────────────────────
      h("div", { style: { display: "flex", flexDirection: "column", gap: 20 } },
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title" }, "Modelo por defecto"),
          h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, marginBottom: 16, lineHeight: 1.6 } },
            "Modelo activo al iniciar la sesión. Puede cambiarse en el Topbar en cualquier momento.",
          ),
          h("select", {
            className: "select", style: { width: "100%" },
            value: modelId,
            onChange: (e) => { setModelId(e.target.value); setSaved(false); },
          },
            MODELS.map((m) =>
              h("option", { key: m.id, value: m.id },
                m.name + " " + m.version + (m.recommended ? " · Recomendado" : ""),
              )
            ),
          ),

          // Info del modelo seleccionado
          (() => {
            const m = MODELS.find((x) => x.id === modelId);
            if (!m) return null;
            return h("div", { style: { marginTop: 14 } },
              h("div", { className: "metrics" },
                h("div", { className: "metric" },
                  h("div", { className: "metric-label" }, "Accuracy"),
                  h("div", { className: "metric-value" }, (m.metrics.accuracy * 100).toFixed(1), h("small", null, "%")),
                ),
                h("div", { className: "metric" },
                  h("div", { className: "metric-label" }, "Recall"),
                  h("div", { className: "metric-value" }, (m.metrics.sensitivity * 100).toFixed(1), h("small", null, "%")),
                ),
                h("div", { className: "metric" },
                  h("div", { className: "metric-label" }, "AUC"),
                  h("div", { className: "metric-value" }, m.metrics.auc.toFixed(3)),
                ),
              ),
              h("div", { style: { fontSize: 12, color: "var(--ink-500)", marginTop: 10, lineHeight: 1.5 } }, m.desc),
            );
          })(),
        ),

        // ── Resumen configuración activa ──────────────────────────────────
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title" }, "Configuración activa"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13 } },
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Modelo guardado"),
              h("span", { className: "badge badge-info" }, MODELS.find((m) => m.id === prefs.modelId)?.name || prefs.modelId),
            ),
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Umbral guardado"),
              h("span", { className: "mono", style: { fontWeight: 700 } }, prefs.threshold.toFixed(2)),
            ),
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Pendiente guardar"),
              h("span", { style: { fontWeight: 600, color: changed ? "var(--amber-600)" : "var(--green-600)" } },
                changed ? "Sí — cambios sin guardar" : "No",
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
