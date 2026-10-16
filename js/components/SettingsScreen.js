import { I } from "../icons.js";
import { THEMES } from "../theme.js";
import { PALETTES } from "../xai.js";
import { PrivacyPanel } from "./PrivacyPanel.js";
import { toast } from "../ui/toast.jsx";

const h = window.React.createElement;

// Configuración = preferencias de uso. Nada que exija saber de IA: el umbral
// de decisión dejó de ser ajustable y el servidor aplica siempre el validado
// para ResNet50 (0.255), el que prioriza no dejar pasar infecciones.
// Cada cambio se aplica al instante: no hay botón "Guardar".

export function SettingsScreen({ theme, onToggleTheme, xaiPalette, onChangePalette,
                                 consents = null, onConsentsChange }) {
  const dark = theme === THEMES.DARK;

  const handleTema = () => {
    onToggleTheme();
    toast.success(dark ? "Modo claro activado" : "Modo oscuro activado");
  };

  const handlePaleta = (p) => {
    if (p.id === xaiPalette) return;   // early return
    onChangePalette(p.id);
    toast.success("Colores del mapa: " + p.label);
  };

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Configuración"),
        h("div", { className: "page-sub" }, "Preferencias de la interfaz · se aplican al instante"),
      ),
    ),

    h("div", { className: "ajustes-grid" },
      // ── Apariencia ────────────────────────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Apariencia"),
        h("div", { className: "row between", style: { gap: 16 } },
          h("div", { className: "row", style: { gap: 12 } },
            h("span", { className: "ajuste-icono" }, h(dark ? I.moon : I.sun, { size: 17 })),
            h("div", null,
              h("div", { className: "ajuste-titulo" }, "Modo oscuro"),
              h("div", { className: "ajuste-desc" },
                "Más cómodo en salas de endoscopia con poca luz."),
            ),
          ),
          h("button", {
            className: "switch" + (dark ? " on" : ""),
            onClick: handleTema,
            role: "switch",
            "aria-checked": dark,
            "aria-label": "Modo oscuro",
          }, h("span", { className: "switch-knob" })),
        ),
        h("div", { className: "ajuste-nota" },
          "También puede cambiarlo desde la barra superior. Se recuerda en este equipo."),
      ),

      // ── Colores del mapa Grad-CAM ─────────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Colores del mapa de calor"),
        h("div", { className: "ajuste-desc", style: { marginBottom: 14 } },
          "Cómo se pintan las zonas que el sistema miró en la imagen."),
        h("div", { role: "radiogroup", "aria-label": "Colores del mapa de calor", style: { display: "grid", gap: 10 } },
          Object.values(PALETTES).map((p) => {
            const activa = xaiPalette === p.id;
            return h("button", {
              key: p.id,
              type: "button",
              role: "radio",
              "aria-checked": activa,
              className: "palette-option" + (activa ? " selected" : ""),
              onClick: () => handlePaleta(p),
            },
              h("span", { className: "palette-swatch", "aria-hidden": true },
                p.stops.map((c, i) => h("span", { key: i, style: { background: c } }))),
              h("span", { className: "palette-text" },
                h("span", { className: "palette-label" }, p.label),
                h("span", { className: "palette-hint" }, p.hint),
              ),
              activa && h(I.check, { size: 16, className: "palette-check", "aria-hidden": true }),
            );
          }),
        ),
      ),
    ),

    // ── Mis datos y privacidad ───────────────────────────────────────────────
    h("div", { style: { marginTop: 20 } },
      h(PrivacyPanel, { consents, onConsentsChange }),
    ),
  );
}
