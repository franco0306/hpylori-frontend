import { I } from "../icons.js";
import { THEMES } from "../theme.js";

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

export function SettingsScreen({ prefs, onSave, theme, onToggleTheme }) {
  // Estado local: el usuario edita aquí antes de guardar
  const [threshold, setThreshold] = useState(prefs.threshold);
  const [saved,     setSaved]     = useState(false);

  const tier    = thresholdTier(threshold);
  const changed = threshold !== prefs.threshold;
  const dark    = theme === THEMES.DARK;

  function handleSave() {
    onSave({ threshold });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setThreshold(0.5);
  }

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Configuración"),
        h("div", { className: "page-sub" }, "Preferencias de análisis y de interfaz · se guardan en tu cuenta"),
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

        // Nota clínica al mover el umbral
        threshold !== prefs.threshold && h("div", { className: "alert alert-info", style: { marginTop: 12 } },
          h(I.info, { size: 14 }),
          h("div", { style: { fontSize: 12 } },
            "El sistema fue validado con un umbral de 0.255. Modificarlo altera la sensibilidad y la especificidad respecto a las cifras validadas.",
          ),
        ),
      ),

      // ── Accesibilidad e interfaz ────────────────────────────────────────
      h("div", { style: { display: "flex", flexDirection: "column", gap: 20 } },
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title" }, "Accesibilidad de la interfaz"),
          h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, marginBottom: 16, lineHeight: 1.6 } },
            "El modo oscuro reduce el deslumbramiento del monitor en salas de endoscopia de baja iluminación, ",
            "manteniendo el contraste de texto exigido por WCAG 2.1 (nivel AA).",
          ),
          h("div", { className: "row between" },
            h("div", { className: "row", style: { gap: 10 } },
              h("div", {
                style: {
                  width: 34, height: 34, borderRadius: 8, display: "grid", placeItems: "center",
                  background: "var(--ink-100)", color: "var(--ink-700)", flexShrink: 0,
                },
              }, h(dark ? I.moon : I.sun, { size: 16 })),
              h("div", null,
                h("div", { style: { fontWeight: 600, fontSize: 13.5 } }, "Modo oscuro"),
                h("div", { style: { fontSize: 12, color: "var(--ink-500)" } },
                  dark ? "Activado · sala de baja iluminación" : "Desactivado · iluminación normal"),
              ),
            ),
            h("button", {
              className: "switch" + (dark ? " on" : ""),
              onClick: onToggleTheme,
              role: "switch",
              "aria-checked": dark,
              "aria-label": "Modo oscuro",
            }, h("span", { className: "switch-knob" })),
          ),
          h("div", { style: { fontSize: 11.5, color: "var(--ink-400)", marginTop: 12, lineHeight: 1.5 } },
            "La preferencia se aplica de inmediato y se recuerda en este equipo. También está disponible en la barra superior.",
          ),
        ),

        // ── Resumen configuración activa ──────────────────────────────────
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title" }, "Configuración activa"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13 } },
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Umbral guardado"),
              h("span", { className: "mono", style: { fontWeight: 700 } }, prefs.threshold.toFixed(2)),
            ),
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Apariencia"),
              h("span", { className: "badge badge-info" }, dark ? "Modo oscuro" : "Modo claro"),
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
