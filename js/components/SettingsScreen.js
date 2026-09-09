import { I } from "../icons.js";
import { THEMES } from "../theme.js";
import { PALETTES } from "../xai.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

// Traducción del umbral a consecuencias clínicas concretas. El médico decide
// qué error prefiere cometer, no qué número quiere en un control deslizante.
//
// `perdidos` y `falsasAlarmas` son estimaciones ilustrativas sobre 100 pacientes
// estudiados, derivadas de la sensibilidad (84.95 %) y la especificidad (89.82 %)
// validadas del motor, desplazadas según lo exigente que sea el ajuste.
function thresholdTier(t) {
  if (t < 0.25) return {
    label: "Máxima detección",
    color: "var(--red-600)",
    resumen: "Marca como sospechoso casi cualquier indicio.",
    detalle: "Casi ninguna infección pasa desapercibida, pero muchas imágenes sanas " +
             "se marcarán como sospechosas y habrá que descartarlas con pruebas.",
    perdidos: 1, falsasAlarmas: 25,
  };
  if (t < 0.40) return {
    label: "Prioriza detectar",
    color: "var(--amber-600)",
    resumen: "Ante la duda, marca como sospechoso.",
    detalle: "Recomendado para tamizaje: prefiere una falsa alarma antes que " +
             "dejar pasar una infección.",
    perdidos: 8, falsasAlarmas: 15,
  };
  if (t < 0.60) return {
    label: "Equilibrado",
    color: "var(--green-600)",
    resumen: "Equilibrio entre detectar y no alarmar de más.",
    detalle: "Opción por defecto. Reparte el error entre casos no detectados " +
             "y falsas alarmas.",
    perdidos: 15, falsasAlarmas: 10,
  };
  if (t < 0.75) return {
    label: "Prioriza confirmar",
    color: "var(--blue-700)",
    resumen: "Solo marca sospechoso con indicios claros.",
    detalle: "Menos falsas alarmas, útil cuando confirmar cada caso es costoso. " +
             "A cambio, algunas infecciones leves pueden pasar desapercibidas.",
    perdidos: 25, falsasAlarmas: 5,
  };
  return {
    label: "Máxima certeza",
    color: "var(--ink-500)",
    resumen: "Exige evidencia muy marcada para marcar sospechoso.",
    detalle: "Casi todos los casos marcados serán reales, pero una parte " +
             "importante de las infecciones no se detectará.",
    perdidos: 35, falsasAlarmas: 2,
  };
}

// Presets: la mayoría de médicos elegirá aquí y no tocará el control fino.
const PRESETS = [
  { id: "detectar",   value: 0.30, label: "Priorizar detección",    hint: "Tamizaje" },
  { id: "equilibrio", value: 0.50, label: "Equilibrado",            hint: "Uso habitual" },
  { id: "confirmar",  value: 0.70, label: "Priorizar confirmación", hint: "Casos dudosos" },
];

export function SettingsScreen({ prefs, onSave, theme, onToggleTheme, xaiPalette, onChangePalette }) {
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

  function handleThresholdChange(e) {
    setThreshold(Number(e.target.value));
    setSaved(false);
  }

  function handleSelectPreset(value) {
    if (Math.abs(threshold - value) < 0.001) return;   // early return
    setThreshold(value);
    setSaved(false);
  }

  function handleSelectPalette(id) {
    if (id === xaiPalette) return;   // early return
    onChangePalette(id);
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

      // ── Sensibilidad del análisis ───────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Sensibilidad del análisis"),
        h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, marginBottom: 18, lineHeight: 1.6 } },
          "Ajusta cuán exigente es el sistema antes de marcar una imagen como sospechosa. ",
          "No existe un ajuste perfecto: cuantos más casos detecta, más falsas alarmas genera. ",
          "Elija según lo que prefiera evitar en su consulta.",
        ),

        // Presets: la vía rápida para el uso diario
        h("div", {
          className: "preset-row",
          role: "radiogroup",
          "aria-label": "Nivel de sensibilidad del análisis",
        },
          PRESETS.map((p) => {
            const active = Math.abs(threshold - p.value) < 0.001;
            return h("button", {
              key: p.id,
              type: "button",
              role: "radio",
              "aria-checked": active,
              className: "preset-btn" + (active ? " selected" : ""),
              onClick: () => handleSelectPreset(p.value),
            },
              h("span", { className: "preset-label" }, p.label),
              h("span", { className: "preset-hint" }, p.hint),
            );
          }),
        ),

        // Lectura clínica del ajuste activo
        h("div", { className: "tier-box", style: { borderColor: tier.color } },
          h("div", { className: "row", style: { gap: 8, marginBottom: 6 } },
            h("span", { className: "tier-dot", style: { background: tier.color }, "aria-hidden": true }),
            h("strong", { style: { color: tier.color, fontSize: 14 } }, tier.label),
          ),
          h("div", { style: { fontSize: 13, fontWeight: 500, marginBottom: 4 } }, tier.resumen),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-600)", lineHeight: 1.6 } }, tier.detalle),

          // Consecuencias en cifras que un médico puede sopesar
          h("div", { className: "tier-outcomes" },
            h("div", { className: "tier-outcome" },
              h("div", { className: "tier-outcome-value", style: { color: "var(--red-600)" } },
                "\u2248 " + tier.perdidos),
              h("div", { className: "tier-outcome-label" },
                "de cada 100 infecciones podrían no detectarse"),
            ),
            h("div", { className: "tier-outcome" },
              h("div", { className: "tier-outcome-value", style: { color: "var(--amber-600)" } },
                "\u2248 " + tier.falsasAlarmas),
              h("div", { className: "tier-outcome-label" },
                "de cada 100 pacientes sanos se marcarían por error"),
            ),
          ),
          h("div", { className: "tier-note" },
            "Cifras orientativas sobre el conjunto de validación, no una garantía por paciente."),
        ),

        // Control fino, plegado tras un resumen legible
        h("details", { className: "fine-tune" },
          h("summary", { className: "fine-tune-summary" }, "Ajuste avanzado"),
          h("div", { style: { paddingTop: 14 } },
            h("div", { className: "row between", style: { marginBottom: 8 } },
              h("label", { htmlFor: "threshold-range", style: { fontSize: 12.5, color: "var(--ink-600)" } },
                "Valor técnico del umbral"),
              h("span", { className: "mono", style: { fontSize: 18, fontWeight: 700, color: tier.color } },
                threshold.toFixed(2)),
            ),
            h("input", {
              id: "threshold-range",
              className: "slider", type: "range",
              min: "0.10", max: "0.90", step: "0.05",
              value: threshold,
              onChange: handleThresholdChange,
              "aria-label": "Valor técnico del umbral de clasificación",
              "aria-valuetext": threshold.toFixed(2) + " \u2014 " + tier.label,
              style: { marginBottom: 10 },
            }),
            h("div", { className: "row between", style: { fontSize: 11, color: "var(--ink-400)" } },
              h("span", null, "0.10 \u00b7 detecta más"),
              h("span", null, "0.90 \u00b7 exige más certeza"),
            ),
          ),
        ),

        // Nota clínica al mover el umbral
        threshold !== prefs.threshold && h("div", { className: "alert alert-info", style: { marginTop: 12 } },
          h(I.info, { size: 14 }),
          h("div", { style: { fontSize: 12 } },
            "El sistema se validó cerca del ajuste \u00abPriorizar detección\u00bb. Si se aleja mucho de él, el rendimiento real puede diferir de las cifras publicadas.",
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

        // ── Paleta de color para Grad-CAM ─────────────────────────────────
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title" }, "Paleta de color XAI"),
          h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, marginBottom: 16, lineHeight: 1.6 } },
            "Define cómo se colorea el mapa de activación Grad-CAM. La paleta accesible ",
            "es monótona en luminancia, por lo que conserva la lectura de intensidad ",
            "en daltonismo rojo-verde.",
          ),
          h("div", { role: "radiogroup", "aria-label": "Paleta de color XAI", style: { display: "grid", gap: 10 } },
            Object.values(PALETTES).map((p) => {
              const active = xaiPalette === p.id;
              return h("button", {
                key: p.id,
                type: "button",
                role: "radio",
                "aria-checked": active,
                className: "palette-option" + (active ? " selected" : ""),
                onClick: () => handleSelectPalette(p.id),
              },
                h("span", { className: "palette-swatch", "aria-hidden": true },
                  p.stops.map((c, i) =>
                    h("span", { key: i, style: { background: c } })),
                ),
                h("span", { className: "palette-text" },
                  h("span", { className: "palette-label" }, p.label),
                  h("span", { className: "palette-hint" }, p.hint),
                ),
                active && h(I.check, { size: 16, className: "palette-check", "aria-hidden": true }),
              );
            }),
          ),
        ),

        // ── Resumen configuración activa ──────────────────────────────────
        h("div", { className: "card card-pad" },
          h("div", { className: "section-title" }, "Configuración activa"),
          h("div", { style: { display: "flex", flexDirection: "column", gap: 8, fontSize: 13 } },
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Sensibilidad guardada"),
              h("span", { className: "badge badge-info" }, thresholdTier(prefs.threshold).label),
            ),
            h("div", { className: "row between" },
              h("span", { style: { color: "var(--ink-500)" } }, "Paleta Grad-CAM"),
              h("span", { className: "badge badge-info" },
                xaiPalette === "accessible" ? "Accesible" : "Estándar"),
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
