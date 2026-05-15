import { I } from "../icons.js";
import { MODELS } from "../models.js";

const h = window.React.createElement;

export function Topbar({ crumbs, model, onModelChange, onOpenCompare }) {
  return h("div", { className: "topbar" },
    h("div", { className: "crumbs" },
      ...crumbs.flatMap((c, i) => [
        i > 0 && h(I.chev, { key: "c" + i, size: 12 }),
        i === crumbs.length - 1
          ? h("strong", { key: "l" + i }, c)
          : h("span",   { key: "s" + i }, c),
      ].filter(Boolean)),
    ),
    h("div", { className: "topbar-spacer" }),
    h("div", { className: "model-pill" },
      h(I.cube, { size: 14 }),
      h("span", null, "Modelo:"),
      h("select", {
        className: "select",
        style: {
          padding: "4px 8px", fontSize: 12, border: "none",
          background: "transparent", color: "var(--blue-700)", fontWeight: 600,
        },
        value: model.id,
        onChange: (e) => onModelChange(e.target.value),
      },
        ...MODELS.map((m) => h("option", { key: m.id, value: m.id }, m.name + " · " + m.version)),
      ),
      h("span", { className: "mono" }, "lat≈" + model.metrics.latency_ms + "ms"),
    ),
    h("button", { className: "btn btn-ghost", onClick: onOpenCompare, title: "Comparar modelos" },
      h(I.bars, { size: 14 }), "Comparar",
    ),
    h("div", { className: "system-status" },
      h("span", { className: "dot" }),
      h("span", null, "API conectada"),
    ),
  );
}

export function Disclaimer() {
  return h("div", { className: "disclaimer" },
    h(I.alert, { size: 14 }),
    h("span", null,
      h("strong", null, "Herramienta de apoyo diagnóstico."),
      " No reemplaza el criterio clínico del especialista. Toda decisión terapéutica debe ser validada por un gastroenterólogo certificado.",
    ),
  );
}
