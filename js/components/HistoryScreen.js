import { I } from "../icons.js";
import { getStudies, deleteStudy, clearHistory } from "../history.js";

const React = window.React;
const { useState, useCallback } = React;
const h = React.createElement;

const RESULT_FILTERS = ["Todos", "Positivo", "Negativo"];
const DATE_FILTERS   = [
  { label: "Todo", days: Infinity },
  { label: "Hoy",    days: 0 },
  { label: "7 días", days: 7 },
  { label: "30 días", days: 30 },
];

function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" })
    + " " + d.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

function fmtProb(p, clase) {
  const pct = clase === "Positivo" ? p : 1 - p;
  return (pct * 100).toFixed(1) + "%";
}

function ConfBar({ prob, clase }) {
  const val  = clase === "Positivo" ? prob : 1 - prob;
  const color = val >= 0.85 ? "var(--green-600)" : val >= 0.65 ? "var(--amber-600)" : "var(--red-600)";
  return h("div", { style: { height: 4, background: "var(--ink-100)", borderRadius: 999, width: "100%", marginTop: 4 } },
    h("div", { style: { width: (val * 100) + "%", height: "100%", background: color, borderRadius: 999 } }),
  );
}

export function HistoryScreen({ onViewHeatmap }) {
  const [studies, setStudies]     = useState(() => getStudies());
  const [selected, setSelected]   = useState(null);
  const [resultF, setResultF]     = useState("Todos");
  const [dateF, setDateF]         = useState(DATE_FILTERS[0]);
  const [confirmClear, setConfirmClear] = useState(false);

  const refresh = useCallback(() => {
    const fresh = getStudies();
    setStudies(fresh);
    setSelected((sel) => sel ? fresh.find((s) => s.id === sel.id) || null : null);
  }, []);

  const handleDelete = (id) => {
    deleteStudy(id);
    refresh();
  };

  const handleClear = () => {
    clearHistory();
    setStudies([]);
    setSelected(null);
    setConfirmClear(false);
  };

  // ── Filtrado ──────────────────────────────────────────────────────────────
  const now = new Date();
  const visible = studies.filter((s) => {
    if (resultF !== "Todos" && s.clase !== resultF) return false;
    if (dateF.days !== Infinity) {
      const diffDays = (now - new Date(s.timestamp)) / 86400000;
      if (dateF.days === 0 && diffDays >= 1) return false;
      if (dateF.days > 0  && diffDays > dateF.days) return false;
    }
    return true;
  });

  const posCount = visible.filter((s) => s.clase === "Positivo").length;
  const negCount = visible.length - posCount;

  // ── Render ────────────────────────────────────────────────────────────────
  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Historial de estudios"),
        h("div", { className: "page-sub" }, "HU-004 · Registro cronológico de análisis · " + studies.length + " estudio" + (studies.length !== 1 ? "s" : "") + " almacenado" + (studies.length !== 1 ? "s" : "")),
      ),
      studies.length > 0 && h("div", { className: "row", style: { gap: 8 } },
        confirmClear
          ? h("div", { className: "row", style: { gap: 8 } },
              h("span", { style: { fontSize: 12.5, color: "var(--red-600)" } }, "¿Borrar todo?"),
              h("button", { className: "btn btn-secondary", onClick: () => setConfirmClear(false) }, "Cancelar"),
              h("button", { className: "btn btn-ghost", style: { color: "var(--red-600)" }, onClick: handleClear },
                h(I.trash, { size: 13 }), "Confirmar"),
            )
          : h("button", { className: "btn btn-ghost", onClick: () => setConfirmClear(true) },
              h(I.trash, { size: 13 }), "Borrar todo"),
      ),
    ),

    // ── Filtros ──────────────────────────────────────────────────────────────
    h("div", { className: "card card-pad", style: { marginBottom: 16 } },
      h("div", { className: "row", style: { gap: 24, flexWrap: "wrap" } },
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 6 } }, "Resultado"),
          h("div", { className: "row", style: { gap: 6 } },
            RESULT_FILTERS.map((f) =>
              h("button", {
                key: f,
                className: "btn " + (resultF === f ? "btn-primary" : "btn-secondary"),
                style: { padding: "4px 12px", fontSize: 12 },
                onClick: () => setResultF(f),
              }, f),
            ),
          ),
        ),
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 6 } }, "Período"),
          h("div", { className: "row", style: { gap: 6 } },
            DATE_FILTERS.map((f) =>
              h("button", {
                key: f.label,
                className: "btn " + (dateF.label === f.label ? "btn-primary" : "btn-secondary"),
                style: { padding: "4px 12px", fontSize: 12 },
                onClick: () => setDateF(f),
              }, f.label),
            ),
          ),
        ),
        h("div", { style: { marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" } },
          h("span", { className: "badge badge-pos" }, posCount + " positivos"),
          h("span", { className: "badge badge-neg" }, negCount + " negativos"),
          h("span", { className: "badge badge-neutral" }, visible.length + " total"),
        ),
      ),
    ),

    // ── Cuerpo: lista + detalle ───────────────────────────────────────────────
    visible.length === 0
      ? h("div", { className: "card card-pad", style: { textAlign: "center", padding: 60 } },
          h(I.history, { size: 32, style: { color: "var(--ink-300)", marginBottom: 12 } }),
          h("div", { style: { fontWeight: 600, color: "var(--ink-500)" } },
            studies.length === 0 ? "Sin estudios aún" : "Sin resultados para los filtros seleccionados"),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-400)", marginTop: 4 } },
            studies.length === 0
              ? "Los análisis realizados desde Análisis individual aparecerán aquí automáticamente."
              : "Prueba cambiando el período o el tipo de resultado."),
        )
      : h("div", { style: { display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16, alignItems: "start" } },

          // ── Lista ────────────────────────────────────────────────────────────
          h("div", { className: "card" },
            h("div", { className: "card-head" },
              h("h3", { className: "card-title" }, "Estudios"),
              h("span", { className: "muted", style: { fontSize: 12 } }, visible.length + " resultados"),
            ),
            h("div", null,
              visible.map((s, idx) => {
                const isPos  = s.clase === "Positivo";
                const isSel  = selected && selected.id === s.id;
                return h("div", {
                  key: s.id,
                  onClick: () => setSelected(isSel ? null : s),
                  style: {
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "12px 16px",
                    borderTop: idx > 0 ? "1px solid var(--ink-100)" : "none",
                    background: isSel ? "var(--blue-50)" : "transparent",
                    cursor: "pointer",
                    transition: "background 0.15s",
                  },
                },
                  // Thumbnail
                  s.thumbnail
                    ? h("img", {
                        src: s.thumbnail,
                        style: { width: 72, height: 54, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid var(--ink-200)" },
                        alt: "",
                      })
                    : h("div", {
                        style: { width: 72, height: 54, borderRadius: 6, background: "var(--ink-100)", flexShrink: 0, display: "grid", placeItems: "center" },
                      }, h(I.eye, { size: 18, style: { color: "var(--ink-400)" } })),

                  // Metadata
                  h("div", { style: { flex: 1, minWidth: 0 } },
                    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
                      h("span", { style: { fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.fileName),
                      h("span", { className: "badge " + (isPos ? "badge-pos" : "badge-neg"), style: { flexShrink: 0 } },
                        isPos ? "POSITIVO" : "NEGATIVO"),
                    ),
                    h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 4 } },
                      h("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-500)" } },
                        s.modelo + " · " + s.latencia_ms + " ms"),
                      h("span", { className: "mono", style: { fontSize: 12, fontWeight: 600, color: isPos ? "var(--red-600)" : "var(--green-600)" } },
                        fmtProb(s.prob, s.clase)),
                    ),
                    h("div", { style: { fontSize: 11, color: "var(--ink-400)", marginTop: 2 } }, fmtDate(s.timestamp)),
                  ),

                  // Delete btn
                  h("button", {
                    className: "btn btn-ghost btn-icon",
                    title: "Eliminar",
                    onClick: (e) => { e.stopPropagation(); handleDelete(s.id); },
                    style: { flexShrink: 0, color: "var(--ink-400)" },
                  }, h(I.trash, { size: 14 })),
                );
              }),
            ),
          ),

          // ── Panel de detalle ─────────────────────────────────────────────────
          selected && h("div", { className: "card card-pad", style: { position: "sticky", top: 16 } },
            h("div", { className: "row between", style: { marginBottom: 16 } },
              h("h3", { className: "card-title" }, "Detalle del estudio"),
              h("button", {
                className: "btn btn-ghost btn-icon",
                onClick: () => setSelected(null),
              }, h(I.x, { size: 14 })),
            ),

            // Thumbnail grande
            selected.thumbnail && h("div", { style: { marginBottom: 16 } },
              h("img", {
                src: selected.thumbnail,
                style: { width: "100%", borderRadius: 8, objectFit: "cover", border: "1px solid var(--ink-200)" },
                alt: selected.fileName,
              }),
            ),

            // Badge resultado
            h("div", { style: { textAlign: "center", marginBottom: 16 } },
              h("span", {
                className: "badge " + (selected.clase === "Positivo" ? "badge-pos" : "badge-neg"),
                style: { fontSize: 14, padding: "6px 16px" },
              }, selected.clase === "Positivo" ? "H. pylori POSITIVO" : "H. pylori NEGATIVO"),
            ),

            // Métricas
            h("div", { className: "metrics", style: { marginBottom: 16 } },
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Probabilidad"),
                h("div", { className: "metric-value" }, fmtProb(selected.prob, selected.clase)),
              ),
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Latencia"),
                h("div", { className: "metric-value" }, selected.latencia_ms, h("small", null, " ms")),
              ),
            ),
            h("div", { style: { marginBottom: 12 } },
              h(ConfBar, { prob: selected.prob, clase: selected.clase }),
            ),

            // Metadatos
            h("div", { style: { fontSize: 12.5, color: "var(--ink-700)", display: "flex", flexDirection: "column", gap: 6 } },
              h("div", { className: "row between" },
                h("span", { style: { color: "var(--ink-500)" } }, "Archivo"),
                h("span", { className: "mono", style: { fontSize: 11 } }, selected.fileName),
              ),
              h("div", { className: "row between" },
                h("span", { style: { color: "var(--ink-500)" } }, "Modelo"),
                h("span", { className: "mono", style: { fontSize: 11 } }, selected.modelo),
              ),
              h("div", { className: "row between" },
                h("span", { style: { color: "var(--ink-500)" } }, "Fecha"),
                h("span", { className: "mono", style: { fontSize: 11 } }, fmtDate(selected.timestamp)),
              ),
            ),

            h("div", { className: "alert alert-info", style: { marginTop: 16 } },
              h(I.info, { size: 14 }),
              h("div", { style: { fontSize: 12 } },
                "El mapa Grad-CAM no se almacena en el historial. Vuelve a analizar la imagen para generarlo.",
              ),
            ),
          ),
        ),
  );
}
