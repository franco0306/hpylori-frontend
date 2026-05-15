import { I } from "../icons.js";

const h = window.React.createElement;

export function Dashboard({ onNavigate, model }) {
  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Buen día, Dr. Mendoza"),
        h("div", { className: "page-sub" },
          "Panel de detección de Helicobacter pylori · Modelo activo: ",
          h("strong", null, model.name + " " + model.version),
        ),
      ),
      h("div", { className: "row", style: { gap: 8 } },
        h("button", { className: "btn btn-secondary" }, h(I.refresh, { size: 14 }), "Sincronizar"),
        h("button", { className: "btn btn-primary", onClick: () => onNavigate("single") },
          h(I.plus, { size: 14 }), "Nuevo análisis"),
      ),
    ),
    h("div", { className: "kpi-grid", style: { marginBottom: 24 } },
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Estudios hoy"),
        h("div", { className: "kpi-value" }, "24"),
        h("div", { className: "kpi-delta up" }, "↑ 12% vs. ayer"),
      ),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Tasa positivos (7 d)"),
        h("div", { className: "kpi-value" }, "31.2%"),
        h("div", { className: "kpi-delta down" }, "↓ 2.1 pp"),
      ),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Latencia media"),
        h("div", { className: "kpi-value" }, (model.metrics.latency_ms / 1000).toFixed(2), h("small", null, "s")),
        h("div", { className: "kpi-delta" }, "objetivo < 2.0 s"),
      ),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Confianza media"),
        h("div", { className: "kpi-value" }, (model.metrics.accuracy * 100).toFixed(1), h("small", null, "%")),
        h("div", { className: "kpi-delta up" }, "+0.6 pp esta semana"),
      ),
    ),
    h("div", { className: "section-title" }, "Acciones rápidas"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 28 } },
      [
        ["single",  "upload", "Cargar imagen individual", "Sube una imagen endoscópica (≤10 MB) y obtén diagnóstico en menos de 2 s."],
        ["heatmap", "heat",   "Visualizar Grad-CAM",      "Inspecciona qué regiones activaron la decisión del modelo."],
        ["batch",   "layers", "Procesar lote",            "Hasta 50 imágenes en paralelo. Exporta resultados en CSV."],
      ].map(([k, ic, t, d]) =>
        h("button", { key: k, className: "model-card", onClick: () => onNavigate(k) },
          h("div", {
            style: {
              width: 36, height: 36, borderRadius: 8,
              background: "var(--blue-50)", color: "var(--blue-700)",
              display: "grid", placeItems: "center", marginBottom: 12,
            },
          }, h(I[ic], { size: 18 })),
          h("div", { className: "name" }, t),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-500)", marginTop: 4 } }, d),
        )
      ),
    ),
  );
}
