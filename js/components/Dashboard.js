import { I } from "../icons.js";
import { getStudies } from "../history.js";

const React = window.React;
const { useMemo } = React;
const h = React.createElement;

function computeStats(studies) {
  const total = studies.length;
  if (total === 0) return { total: 0, pos: 0, neg: 0, posRate: 0, avgLat: 0, today: 0 };

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let pos = 0, latSum = 0, todayCount = 0;
  for (const s of studies) {
    if (s.clase === "Positivo") pos++;
    latSum += s.latencia_ms || 0;
    if (new Date(s.timestamp) >= today) todayCount++;
  }

  return {
    total,
    pos,
    neg:     total - pos,
    posRate: ((pos / total) * 100).toFixed(1),
    avgLat:  (latSum / total).toFixed(0),
    today:   todayCount,
  };
}

export function Dashboard({ onNavigate, model }) {
  const stats = useMemo(() => computeStats(getStudies()), []);

  const ACTIONS = [
    {
      k: "single",  icon: "upload", color: "var(--blue-700)",   bg: "var(--blue-50)",
      title: "Análisis individual",
      desc: "Sube una imagen endoscópica y obtén diagnóstico en < 2 s.",
    },
    {
      k: "batch",   icon: "layers", color: "var(--green-600)",  bg: "var(--green-50)",
      title: "Procesamiento por lote",
      desc: "Hasta 50 imágenes en paralelo. Exporta resultados en CSV.",
    },
    {
      k: "history", icon: "history", color: "var(--amber-600)", bg: "var(--amber-50)",
      title: "Historial de estudios",
      desc: "Consulta los " + (stats.total || "—") + " estudios previos con filtros por fecha y resultado.",
    },
    {
      k: "heatmap", icon: "heat",   color: "var(--red-600)",    bg: "var(--red-50)",
      title: "Visualizar Grad-CAM",
      desc: "Inspecciona qué regiones activaron la decisión del modelo.",
    },
  ];

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Panel principal"),
        h("div", { className: "page-sub" },
          "HU-006 · Modelo activo: ",
          h("strong", null, model.name + " " + model.version),
        ),
      ),
      h("button", { className: "btn btn-primary", onClick: () => onNavigate("single") },
        h(I.plus, { size: 14 }), "Nuevo análisis"),
    ),

    // ── KPIs ─────────────────────────────────────────────────────────────────
    h("div", { className: "kpi-grid", style: { marginBottom: 24 } },
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Total de estudios"),
        h("div", { className: "kpi-value" }, stats.total),
        h("div", { className: "kpi-delta" }, stats.today + " hoy"),
      ),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "H. pylori positivo"),
        h("div", { className: "kpi-value", style: { color: stats.pos > 0 ? "var(--red-600)" : undefined } },
          stats.total > 0 ? stats.posRate + "%" : "—"),
        h("div", { className: "kpi-delta" + (stats.pos > 0 ? " down" : "") },
          stats.total > 0 ? stats.pos + " casos positivos" : "Sin datos aún"),
      ),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "H. pylori negativo"),
        h("div", { className: "kpi-value", style: { color: stats.neg > 0 ? "var(--green-600)" : undefined } },
          stats.total > 0 ? (100 - parseFloat(stats.posRate)).toFixed(1) + "%" : "—"),
        h("div", { className: "kpi-delta up" },
          stats.total > 0 ? stats.neg + " casos negativos" : "Sin datos aún"),
      ),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Latencia media"),
        h("div", { className: "kpi-value" },
          stats.total > 0 ? stats.avgLat : model.metrics.latency_ms,
          h("small", null, " ms")),
        h("div", { className: "kpi-delta" + (parseInt(stats.avgLat || model.metrics.latency_ms) < 2000 ? " up" : " down") },
          "objetivo < 2 000 ms"),
      ),
    ),

    // ── Acciones rápidas ─────────────────────────────────────────────────────
    h("div", { className: "section-title" }, "Accesos rápidos"),
    h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 } },
      ACTIONS.map(({ k, icon, color, bg, title, desc }) =>
        h("button", { key: k, className: "model-card", onClick: () => onNavigate(k) },
          h("div", {
            style: { width: 36, height: 36, borderRadius: 8, background: bg, color, display: "grid", placeItems: "center", marginBottom: 12 },
          }, h(I[icon], { size: 18 })),
          h("div", { className: "name" }, title),
          h("div", { style: { fontSize: 12, color: "var(--ink-500)", marginTop: 4, lineHeight: 1.4 } }, desc),
        )
      ),
    ),

    // ── Modelo activo ─────────────────────────────────────────────────────────
    h("div", { className: "section-title" }, "Modelo activo"),
    h("div", { className: "card card-pad" },
      h("div", { className: "row between" },
        h("div", { className: "row", style: { gap: 14 } },
          h("div", {
            style: { width: 44, height: 44, borderRadius: 10, background: "var(--blue-50)", color: "var(--blue-700)", display: "grid", placeItems: "center" },
          }, h(I.cube, { size: 20 })),
          h("div", null,
            h("div", { style: { fontWeight: 700 } }, model.name + " " + model.version),
            h("div", { style: { fontSize: 12.5, color: "var(--ink-500)", marginTop: 2 } }, model.arch),
          ),
        ),
        h("div", { className: "row", style: { gap: 10 } },
          h("span", { className: "chip best" }, "Acc " + (model.metrics.accuracy * 100).toFixed(1) + "%"),
          h("span", { className: "chip" }, "AUC " + model.metrics.auc.toFixed(3)),
          h("span", { className: "chip best" }, model.metrics.latency_ms + " ms"),
          h("button", { className: "btn btn-secondary", onClick: () => onNavigate("models") },
            "Cambiar modelo"),
        ),
      ),
      h("div", { style: { fontSize: 12.5, color: "var(--ink-600)", marginTop: 12, lineHeight: 1.6 } }, model.desc),
    ),
  );
}
