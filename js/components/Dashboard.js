import { I } from "../icons.js";
import { getStudies } from "../history.js";

const React = window.React;
const { useMemo } = React;
const h = React.createElement;

// ── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 12) return "Buenos días";
  if (hr < 19) return "Buenas tardes";
  return "Buenas noches";
}

function getFecha() {
  return new Date().toLocaleDateString("es-PE", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function fmtTime(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short" })
    + " · " + d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function computeStats(studies) {
  const total = studies.length;
  if (total === 0) return { total: 0, pos: 0, neg: 0, posRate: 0, negRate: 0, avgLat: 0, today: 0 };

  const today = new Date(); today.setHours(0, 0, 0, 0);
  let pos = 0, latSum = 0, todayCount = 0;
  for (const s of studies) {
    if (s.clase === "Positivo") pos++;
    latSum += s.latencia_ms || 0;
    if (new Date(s.timestamp) >= today) todayCount++;
  }
  const posRate = (pos / total) * 100;
  return {
    total, pos, today: todayCount,
    neg:     total - pos,
    posRate: posRate.toFixed(1),
    negRate: (100 - posRate).toFixed(1),
    avgLat:  (latSum / total).toFixed(0),
  };
}

// ── Gráfico de dona SVG ───────────────────────────────────────────────────────
function DonutChart({ posRate, pos, neg, total }) {
  const R = 52, CX = 70, CY = 70, SW = 16;
  const CIRC   = 2 * Math.PI * R;
  const posArc = (parseFloat(posRate) / 100) * CIRC;
  const empty  = total === 0;

  return h("svg", { width: 140, height: 140, viewBox: "0 0 140 140" },
    // Fondo
    h("circle", { cx: CX, cy: CY, r: R, fill: "none", stroke: "#F1F5F9", strokeWidth: SW }),
    empty
      ? null
      : h("g", null,
          // Negativos (verde)
          h("circle", {
            cx: CX, cy: CY, r: R, fill: "none",
            stroke: "#16A34A", strokeWidth: SW,
            strokeDasharray: `${CIRC - posArc} ${posArc}`,
            strokeDashoffset: 0,
            transform: `rotate(-90 ${CX} ${CY})`,
            style: { transition: "stroke-dasharray 0.6s ease" },
          }),
          // Positivos (rojo) — encima
          h("circle", {
            cx: CX, cy: CY, r: R, fill: "none",
            stroke: "#DC2626", strokeWidth: SW,
            strokeDasharray: `${posArc} ${CIRC - posArc}`,
            strokeDashoffset: 0,
            transform: `rotate(-90 ${CX} ${CY})`,
            style: { transition: "stroke-dasharray 0.6s ease" },
          }),
        ),
    // Centro: porcentaje positivos
    h("text", {
      x: CX, y: CY - 6,
      textAnchor: "middle", dominantBaseline: "middle",
      fontSize: 20, fontWeight: 700,
      fill: empty ? "#94A3B8" : "#DC2626",
      fontFamily: "IBM Plex Mono, monospace",
    }, empty ? "—" : posRate + "%"),
    h("text", {
      x: CX, y: CY + 14,
      textAnchor: "middle",
      fontSize: 9, fill: "#64748B",
      fontFamily: "IBM Plex Mono, monospace",
    }, "positivos"),
  );
}

// ── KPI con barra de progreso ─────────────────────────────────────────────────
function KpiCard({ label, value, sub, subColor, barPct, barColor, icon }) {
  return h("div", { className: "kpi", style: { position: "relative", overflow: "hidden" } },
    // Barra de acento superior
    h("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 3, background: barColor, borderRadius: "12px 12px 0 0" } }),
    h("div", { className: "kpi-label" }, label),
    h("div", { className: "kpi-value", style: { color: barColor !== "#E2E8F0" ? barColor : undefined } }, value),
    h("div", { className: "kpi-delta", style: { color: subColor } }, sub),
    barPct !== undefined && h("div", { style: { marginTop: 10, height: 3, background: "#F1F5F9", borderRadius: 999 } },
      h("div", { style: { width: Math.min(100, barPct) + "%", height: "100%", background: barColor, borderRadius: 999, transition: "width 0.6s ease" } }),
    ),
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function Dashboard({ onNavigate, model }) {
  const studies = useMemo(() => getStudies(), []);
  const stats   = useMemo(() => computeStats(studies), [studies]);
  const recent  = useMemo(() => studies.slice(0, 6), [studies]);

  const ACTIONS = [
    { k: "single",  icon: "upload",  color: "#1D4ED8", bg: "#EFF6FF", title: "Análisis individual" },
    { k: "batch",   icon: "layers",  color: "#15803D", bg: "#F0FDF4", title: "Por lote" },
    { k: "history", icon: "history", color: "#B45309", bg: "#FFFBEB", title: "Historial" },
    { k: "heatmap", icon: "heat",    color: "#DC2626", bg: "#FEF2F2", title: "Grad-CAM" },
    { k: "models",  icon: "cube",    color: "#7C3AED", bg: "#F5F3FF", title: "Modelos" },
    { k: "settings",icon: "cog",     color: "#475569", bg: "#F8FAFC", title: "Config" },
  ];

  return h("div", { className: "content" },

    // ── Cabecera ──────────────────────────────────────────────────────────────
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" },
          getGreeting() + ", Dr. R. Mendoza"),
        h("div", { className: "page-sub" },
          getFecha() + " · Modelo activo: ",
          h("strong", null, model.name + " " + model.version),
        ),
      ),
      h("button", { className: "btn btn-primary", onClick: () => onNavigate("single") },
        h(I.plus, { size: 14 }), "Nuevo análisis"),
    ),

    // ── KPIs ─────────────────────────────────────────────────────────────────
    h("div", { className: "kpi-grid", style: { marginBottom: 20 } },
      h(KpiCard, {
        label: "Total de estudios", value: stats.total,
        sub: stats.today + " realizados hoy",
        subColor: stats.today > 0 ? "#15803D" : "#64748B",
        barColor: "#3B82F6", barPct: Math.min(100, stats.total / 2),
      }),
      h(KpiCard, {
        label: "H. pylori positivo",
        value: stats.total > 0 ? stats.posRate + "%" : "—",
        sub: stats.pos + " casos positivos",
        subColor: "#DC2626",
        barColor: "#DC2626",
        barPct: parseFloat(stats.posRate),
      }),
      h(KpiCard, {
        label: "H. pylori negativo",
        value: stats.total > 0 ? stats.negRate + "%" : "—",
        sub: stats.neg + " casos negativos",
        subColor: "#15803D",
        barColor: "#16A34A",
        barPct: parseFloat(stats.negRate),
      }),
      h(KpiCard, {
        label: "Latencia media",
        value: h("span", null, stats.total > 0 ? stats.avgLat : model.metrics.latency_ms, h("small", null, " ms")),
        sub: "objetivo < 2 000 ms",
        subColor: parseInt(stats.avgLat || model.metrics.latency_ms) < 2000 ? "#15803D" : "#DC2626",
        barColor: parseInt(stats.avgLat || model.metrics.latency_ms) < 2000 ? "#16A34A" : "#DC2626",
        barPct: Math.max(0, 100 - (parseInt(stats.avgLat || model.metrics.latency_ms) / 20)),
      }),
    ),

    // ── Sección central: dona + estudios recientes ────────────────────────────
    h("div", { style: { display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, marginBottom: 16 } },

      // Dona
      h("div", { className: "card card-pad", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 16 } },
        h("div", { className: "section-title", style: { alignSelf: "flex-start", marginBottom: 0 } }, "Distribución"),
        h(DonutChart, { posRate: stats.posRate, pos: stats.pos, neg: stats.neg, total: stats.total }),
        h("div", { style: { width: "100%", display: "flex", flexDirection: "column", gap: 8 } },
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
              h("div", { style: { width: 10, height: 10, borderRadius: 2, background: "#DC2626" } }),
              h("span", { style: { color: "#475569" } }, "H. pylori positivo"),
            ),
            h("span", { style: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, color: "#DC2626" } },
              stats.pos + " (" + stats.posRate + "%)"),
          ),
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
              h("div", { style: { width: 10, height: 10, borderRadius: 2, background: "#16A34A" } }),
              h("span", { style: { color: "#475569" } }, "H. pylori negativo"),
            ),
            h("span", { style: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, color: "#16A34A" } },
              stats.neg + " (" + stats.negRate + "%)"),
          ),
          h("div", { style: { borderTop: "1px solid #F1F5F9", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 } },
            h("span", { style: { color: "#94A3B8" } }, "Total"),
            h("span", { style: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 600 } }, stats.total),
          ),
        ),
      ),

      // Estudios recientes
      h("div", { className: "card" },
        h("div", { className: "card-head" },
          h("h3", { className: "card-title" }, "Estudios recientes"),
          h("button", {
            className: "btn btn-ghost",
            style: { fontSize: 12 },
            onClick: () => onNavigate("history"),
          }, "Ver todos →"),
        ),
        recent.length === 0
          ? h("div", { style: { padding: "32px 20px", textAlign: "center", color: "#94A3B8", fontSize: 13 } },
              "Aún no hay estudios. Realiza tu primer análisis.")
          : h("div", null,
              recent.map((s, idx) => {
                const isPos = s.clase === "Positivo";
                return h("div", {
                  key: s.id,
                  style: {
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
                    borderTop: idx > 0 ? "1px solid #F8FAFC" : "none",
                    cursor: "pointer",
                  },
                  onClick: () => onNavigate("history"),
                },
                  s.thumbnail
                    ? h("img", { src: s.thumbnail, style: { width: 44, height: 33, borderRadius: 4, objectFit: "cover", flexShrink: 0, border: "1px solid #E2E8F0" }, alt: "" })
                    : h("div", { style: { width: 44, height: 33, borderRadius: 4, background: "#F1F5F9", flexShrink: 0 } }),
                  h("div", { style: { flex: 1, minWidth: 0 } },
                    h("div", { style: { fontSize: 12.5, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.fileName),
                    h("div", { style: { fontSize: 11, color: "#94A3B8", marginTop: 1 } },
                      s.modelo + " · " + fmtTime(s.timestamp)),
                  ),
                  h("div", { style: { textAlign: "right", flexShrink: 0 } },
                    h("span", { className: "badge " + (isPos ? "badge-pos" : "badge-neg") },
                      isPos ? "POS" : "NEG"),
                    h("div", { style: { fontSize: 11, fontFamily: "IBM Plex Mono, monospace", fontWeight: 600, marginTop: 3, color: isPos ? "#DC2626" : "#16A34A" } },
                      ((isPos ? s.prob : 1 - s.prob) * 100).toFixed(1) + "%"),
                  ),
                );
              }),
            ),
      ),
    ),

    // ── Accesos rápidos ───────────────────────────────────────────────────────
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 } },
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Accesos rápidos"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 } },
          ACTIONS.map(({ k, icon, color, bg, title }) =>
            h("button", {
              key: k, className: "btn btn-secondary",
              onClick: () => onNavigate(k),
              style: { flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 6px", height: "auto" },
            },
              h("div", { style: { width: 32, height: 32, borderRadius: 8, background: bg, color, display: "grid", placeItems: "center" } },
                h(I[icon], { size: 16 })),
              h("span", { style: { fontSize: 10.5, fontWeight: 600, textAlign: "center", lineHeight: 1.2 } }, title),
            )
          ),
        ),
      ),

      // Modelo activo compacto
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Modelo activo"),
        h("div", { style: { display: "flex", alignItems: "center", gap: 10, marginBottom: 12 } },
          h("div", { style: { width: 36, height: 36, borderRadius: 8, background: "#EFF6FF", color: "#1D4ED8", display: "grid", placeItems: "center", flexShrink: 0 } },
            h(I.cube, { size: 18 })),
          h("div", null,
            h("div", { style: { fontWeight: 700, fontSize: 14 } }, model.name + " " + model.version),
            h("div", { style: { fontSize: 11, color: "#94A3B8" } }, model.arch),
          ),
        ),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 12 } },
          [
            ["AUC", model.metrics.auc.toFixed(3)],
            ["Recall", (model.metrics.sensitivity * 100).toFixed(1) + "%"],
            ["Acc", (model.metrics.accuracy * 100).toFixed(1) + "%"],
            ["Lat", model.metrics.latency_ms + " ms"],
          ].map(([lbl, val]) =>
            h("div", { key: lbl, style: { background: "#F8FAFC", borderRadius: 6, padding: "6px 8px" } },
              h("div", { style: { fontSize: 10, color: "#94A3B8", fontWeight: 600, textTransform: "uppercase" } }, lbl),
              h("div", { style: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, fontSize: 13 } }, val),
            )
          ),
        ),
        h("button", { className: "btn btn-secondary", style: { width: "100%" }, onClick: () => onNavigate("models") },
          "Cambiar modelo"),
      ),
    ),
  );
}
