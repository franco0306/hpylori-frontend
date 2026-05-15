import { I } from "../icons.js";
import { MODELS } from "../models.js";

const h = window.React.createElement;

export function ModelsScreen({ modelId, onSelect, onCompare }) {
  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Modelos disponibles"),
        h("div", { className: "page-sub" },
          "Selecciona el modelo activo para los análisis. La elección se aplica a HU-001, HU-002 y HU-003."),
      ),
      h("button", { className: "btn btn-primary", onClick: onCompare },
        h(I.bars, { size: 14 }), "Comparar lado a lado"),
    ),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 16 } },
      ...MODELS.map((m) =>
        h("button", {
          key: m.id,
          className: "model-card " + (modelId === m.id ? "selected" : ""),
          onClick: () => onSelect(m.id),
        },
          h("div", { className: "row between" },
            h("div", null,
              h("div", { className: "name" }, m.name, " ",
                h("span", { style: { color: "var(--ink-500)", fontWeight: 500, marginLeft: 4 } }, m.version)),
              h("div", { className: "arch" }, m.arch),
            ),
            modelId === m.id
              ? h("span", { className: "badge badge-info" }, h(I.check, { size: 10 }), " ACTIVO")
              : m.recommended
                ? h("span", { className: "badge badge-warn" }, "RECOMENDADO")
                : null,
          ),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-700)", marginTop: 10, lineHeight: 1.5 } }, m.desc),
          h("div", { className: "meta" },
            h("span", { className: "chip" }, "Acc " + (m.metrics.accuracy * 100).toFixed(1) + "%"),
            h("span", { className: "chip" }, "AUC " + m.metrics.auc.toFixed(3)),
            h("span", { className: "chip " + (m.metrics.latency_ms < 2000 ? "best" : "") }, m.metrics.latency_ms + " ms"),
            h("span", { className: "chip" }, m.metrics.model_mb + " MB"),
          ),
        )
      ),
    ),
    h("div", { className: "alert alert-info", style: { marginTop: 20 } },
      h(I.info, { size: 16 }),
      h("div", null,
        h("strong", null, "¿Cómo escoger? "),
        "ResNet50 ofrece el mejor recall (87.33%) y es el modelo recomendado para diagnóstico clínico. MobileNetV3 es el más rápido (22ms) ideal para procesamiento por lote. EfficientNetB0 ofrece el mejor balance entre velocidad y tamaño de modelo.",
      ),
    ),
  );
}