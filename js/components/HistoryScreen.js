import { I } from "../icons.js";
import { getStudies, deleteStudy, clearHistory } from "../history.js";

const React = window.React;
const { useState, useCallback, useEffect } = React;
const h = React.createElement;

const SIN_PACIENTE   = "__sin_paciente__";
const RESULT_FILTERS = ["Todos", "Positivo", "Negativo"];
const DATE_FILTERS   = [
  { label: "Todo",    days: Infinity },
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
  return ((clase === "Positivo" ? p : 1 - p) * 100).toFixed(1) + "%";
}

function ConfBar({ prob, clase }) {
  const val   = clase === "Positivo" ? prob : 1 - prob;
  const color = val >= 0.85 ? "var(--green-600)" : val >= 0.65 ? "var(--amber-600)" : "var(--red-600)";
  return h("div", { style: { height: 4, background: "var(--ink-100)", borderRadius: 999, width: "100%", marginTop: 4 } },
    h("div", { style: { width: (val * 100) + "%", height: "100%", background: color, borderRadius: 999 } }),
  );
}

// Agrupa estudios por campo `paciente`, ordena: con nombre primero (A-Z), sin nombre al final
function groupByPatient(studies) {
  const map = new Map();
  for (const s of studies) {
    const key = s.paciente && s.paciente.trim() ? s.paciente.trim() : SIN_PACIENTE;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(s);
  }
  return [...map.entries()].sort(([a], [b]) => {
    if (a === SIN_PACIENTE) return 1;
    if (b === SIN_PACIENTE) return -1;
    return a.localeCompare(b, "es");
  });
}

// ── Fila de estudio (reutilizada en ambas vistas) ─────────────────────────────
function StudyRow({ s, idx, selected, onSelect, onDelete }) {
  const isPos = s.clase === "Positivo";
  const isSel = selected && selected.id === s.id;
  return h("div", {
    key: s.id,
    onClick: () => onSelect(isSel ? null : s),
    style: {
      display: "flex", alignItems: "center", gap: 14,
      padding: "11px 16px",
      borderTop: idx > 0 ? "1px solid var(--ink-100)" : "none",
      background: isSel ? "var(--blue-50)" : "transparent",
      cursor: "pointer", transition: "background 0.12s",
    },
  },
    s.thumbnail
      ? h("img", { src: s.thumbnail, style: { width: 68, height: 51, borderRadius: 6, objectFit: "cover", flexShrink: 0, border: "1px solid var(--ink-200)" }, alt: "" })
      : h("div", { style: { width: 68, height: 51, borderRadius: 6, background: "var(--ink-100)", flexShrink: 0, display: "grid", placeItems: "center" } },
          h(I.eye, { size: 16, style: { color: "var(--ink-400)" } })),
    h("div", { style: { flex: 1, minWidth: 0 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
        h("span", { style: { fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.fileName),
        h("span", { className: "badge " + (isPos ? "badge-pos" : "badge-neg"), style: { flexShrink: 0 } },
          isPos ? "POSITIVO" : "NEGATIVO"),
      ),
      h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 3 } },
        h("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-500)" } }, s.modelo + " · " + s.latencia_ms + " ms"),
        h("span", { className: "mono", style: { fontSize: 12, fontWeight: 600, color: isPos ? "var(--red-600)" : "var(--green-600)" } }, fmtProb(s.prob, s.clase)),
      ),
      h("div", { style: { fontSize: 11, color: "var(--ink-400)", marginTop: 2 } }, fmtDate(s.timestamp)),
    ),
    h("button", {
      className: "btn btn-ghost btn-icon", title: "Eliminar",
      onClick: (e) => { e.stopPropagation(); onDelete(s.id); },
      style: { flexShrink: 0, color: "var(--ink-400)" },
    }, h(I.trash, { size: 14 })),
  );
}

// ── Tarjeta de paciente (vista por paciente) ──────────────────────────────────
function PatientCard({ name, studies, selected, onSelect, onDelete }) {
  const [open, setOpen] = useState(true);
  const pos     = studies.filter((s) => s.clase === "Positivo").length;
  const posRate = studies.length ? ((pos / studies.length) * 100).toFixed(0) : 0;
  const last    = studies[0]; // más reciente primero
  const isAnon  = name === SIN_PACIENTE;

  return h("div", { className: "card", style: { marginBottom: 12 } },
    // Cabecera del paciente
    h("div", {
      onClick: () => setOpen((o) => !o),
      style: {
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px", cursor: "pointer",
        borderBottom: open ? "1px solid var(--ink-100)" : "none",
      },
    },
      // Avatar
      h("div", {
        style: {
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
          background: isAnon ? "var(--ink-100)" : "var(--blue-50)",
          color: isAnon ? "var(--ink-400)" : "var(--blue-700)",
          display: "grid", placeItems: "center", fontWeight: 700, fontSize: 15,
        },
      }, isAnon ? h(I.eye, { size: 16 }) : name.charAt(0).toUpperCase()),

      // Info paciente
      h("div", { style: { flex: 1 } },
        h("div", { style: { fontWeight: 700, fontSize: 14 } },
          isAnon ? "Sin paciente asignado" : name),
        h("div", { style: { fontSize: 11.5, color: "var(--ink-500)", marginTop: 1 } },
          studies.length + " estudio" + (studies.length !== 1 ? "s" : ""),
          last ? " · último " + fmtDate(last.timestamp) : "",
        ),
      ),

      // Badges resumen
      h("div", { className: "row", style: { gap: 8 } },
        pos > 0 && h("span", { className: "badge badge-pos" }, pos + " pos"),
        (studies.length - pos) > 0 && h("span", { className: "badge badge-neg" }, (studies.length - pos) + " neg"),
        studies.length > 1 && h("span", { className: "badge badge-neutral" }, posRate + "% tasa pos"),
      ),

      // Flecha
      h("span", { style: { color: "var(--ink-400)", fontSize: 10, transform: open ? "rotate(90deg)" : "none", transition: ".15s" } }, "▶"),
    ),

    // Lista de estudios (colapsable)
    open && h("div", null,
      studies.map((s, idx) =>
        h(StudyRow, { key: s.id, s, idx, selected, onSelect, onDelete }),
      ),
    ),
  );
}

// ── HistoryScreen ─────────────────────────────────────────────────────────────
export function HistoryScreen({ onViewHeatmap }) {
  const [studies,      setStudies]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [resultF,      setResultF]      = useState("Todos");
  const [dateF,        setDateF]        = useState(DATE_FILTERS[0]);
  const [viewMode,     setViewMode]     = useState("cronologico"); // "cronologico" | "paciente"
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    let mounted = true;
    getStudies().then((data) => { if (mounted) { setStudies(data); setLoading(false); } });
    return () => { mounted = false; };
  }, []);

  const refresh = useCallback(async () => {
    const fresh = await getStudies();
    setStudies(fresh);
    setSelected((sel) => sel ? fresh.find((s) => s.id === sel.id) || null : null);
  }, []);

  const handleDelete = async (id) => { await deleteStudy(id); refresh(); };
  const handleClear  = async () => { await clearHistory(); setStudies([]); setSelected(null); setConfirmClear(false); };

  // Filtros comunes a ambas vistas
  const now = new Date();
  const visible = studies.filter((s) => {
    if (resultF !== "Todos" && s.clase !== resultF) return false;
    if (dateF.days !== Infinity) {
      const diff = (now - new Date(s.timestamp)) / 86400000;
      if (dateF.days === 0 && diff >= 1) return false;
      if (dateF.days > 0  && diff > dateF.days) return false;
    }
    return true;
  });

  const posCount = visible.filter((s) => s.clase === "Positivo").length;
  const negCount = visible.length - posCount;
  const patientGroups = viewMode === "paciente" ? groupByPatient(visible) : [];

  return h("div", { className: "content" },
    // ── Cabecera ──────────────────────────────────────────────────────────────
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Historial de estudios"),
        h("div", { className: "page-sub" },
          "HU-004 · " + studies.length + " estudio" + (studies.length !== 1 ? "s" : "") + " almacenado" + (studies.length !== 1 ? "s" : ""),
        ),
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

    // ── Filtros + vista ───────────────────────────────────────────────────────
    h("div", { className: "card card-pad", style: { marginBottom: 16 } },
      h("div", { className: "row", style: { gap: 24, flexWrap: "wrap" } },
        // Resultado
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 6 } }, "Resultado"),
          h("div", { className: "row", style: { gap: 6 } },
            RESULT_FILTERS.map((f) =>
              h("button", { key: f, className: "btn " + (resultF === f ? "btn-primary" : "btn-secondary"), style: { padding: "4px 12px", fontSize: 12 }, onClick: () => setResultF(f) }, f),
            ),
          ),
        ),
        // Período
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 6 } }, "Período"),
          h("div", { className: "row", style: { gap: 6 } },
            DATE_FILTERS.map((f) =>
              h("button", { key: f.label, className: "btn " + (dateF.label === f.label ? "btn-primary" : "btn-secondary"), style: { padding: "4px 12px", fontSize: 12 }, onClick: () => setDateF(f) }, f.label),
            ),
          ),
        ),
        // Vista
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 6 } }, "Vista"),
          h("div", { className: "row", style: { gap: 6 } },
            [["cronologico", "Cronológico"], ["paciente", "Por paciente"]].map(([key, lbl]) =>
              h("button", { key, className: "btn " + (viewMode === key ? "btn-primary" : "btn-secondary"), style: { padding: "4px 12px", fontSize: 12 }, onClick: () => setViewMode(key) }, lbl),
            ),
          ),
        ),
        // Contadores
        h("div", { style: { marginLeft: "auto", display: "flex", gap: 16, alignItems: "center" } },
          h("span", { className: "badge badge-pos" }, posCount + " positivos"),
          h("span", { className: "badge badge-neg" }, negCount + " negativos"),
          h("span", { className: "badge badge-neutral" }, visible.length + " total"),
        ),
      ),
    ),

    // ── Cuerpo ────────────────────────────────────────────────────────────────
    loading
      ? h("div", { className: "card card-pad", style: { textAlign: "center", padding: 60 } },
          h("div", { className: "spinner" }),
          h("div", { className: "muted", style: { marginTop: 12 } }, "Cargando historial…"),
        )
    : visible.length === 0
      ? h("div", { className: "card card-pad", style: { textAlign: "center", padding: 60 } },
          h(I.history, { size: 32, style: { color: "var(--ink-300)", marginBottom: 12 } }),
          h("div", { style: { fontWeight: 600, color: "var(--ink-500)" } },
            studies.length === 0 ? "Sin estudios aún" : "Sin resultados para estos filtros"),
          h("div", { style: { fontSize: 12.5, color: "var(--ink-400)", marginTop: 4 } },
            studies.length === 0
              ? "Los análisis realizados desde Análisis individual aparecerán aquí automáticamente."
              : "Prueba cambiando el período o el resultado."),
        )

      : h("div", { style: { display: "grid", gridTemplateColumns: selected ? "1fr 380px" : "1fr", gap: 16, alignItems: "start" } },

          // ── Lista (cronológica o por paciente) ────────────────────────────
          h("div", null,
            viewMode === "cronologico"
              // Vista cronológica — igual que antes
              ? h("div", { className: "card" },
                  h("div", { className: "card-head" },
                    h("h3", { className: "card-title" }, "Estudios"),
                    h("span", { className: "muted", style: { fontSize: 12 } }, visible.length + " resultados"),
                  ),
                  visible.map((s, idx) =>
                    h(StudyRow, { key: s.id, s, idx, selected, onSelect: setSelected, onDelete: handleDelete }),
                  ),
                )
              // Vista por paciente
              : h("div", null,
                  h("div", { className: "row between", style: { marginBottom: 10 } },
                    h("span", { className: "section-title", style: { marginBottom: 0 } },
                      patientGroups.length + " paciente" + (patientGroups.length !== 1 ? "s" : "")),
                  ),
                  patientGroups.map(([name, group]) =>
                    h(PatientCard, { key: name, name, studies: group, selected, onSelect: setSelected, onDelete: handleDelete }),
                  ),
                ),
          ),

          // ── Panel de detalle (igual en ambas vistas) ──────────────────────
          selected && h("div", { className: "card card-pad", style: { position: "sticky", top: 16 } },
            h("div", { className: "row between", style: { marginBottom: 16 } },
              h("h3", { className: "card-title" }, "Detalle del estudio"),
              h("button", { className: "btn btn-ghost btn-icon", onClick: () => setSelected(null) },
                h(I.x, { size: 14 })),
            ),

            // Thumbnail
            selected.thumbnail && h("div", { style: { marginBottom: 16 } },
              h("img", { src: selected.thumbnail, style: { width: "100%", borderRadius: 8, objectFit: "cover", border: "1px solid var(--ink-200)" }, alt: selected.fileName }),
            ),

            // Paciente
            selected.paciente && h("div", { style: { marginBottom: 12 } },
              h("div", { className: "section-title", style: { marginBottom: 4 } }, "Paciente"),
              h("div", { style: { fontWeight: 600, fontSize: 14 } }, selected.paciente),
            ),

            // Badge resultado
            h("div", { style: { textAlign: "center", marginBottom: 16 } },
              h("span", { className: "badge " + (selected.clase === "Positivo" ? "badge-pos" : "badge-neg"), style: { fontSize: 14, padding: "6px 16px" } },
                selected.clase === "Positivo" ? "H. pylori POSITIVO" : "H. pylori NEGATIVO"),
            ),

            // Métricas
            h("div", { className: "metrics", style: { marginBottom: 12 } },
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Probabilidad"),
                h("div", { className: "metric-value" }, fmtProb(selected.prob, selected.clase)),
              ),
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Latencia"),
                h("div", { className: "metric-value" }, selected.latencia_ms, h("small", null, " ms")),
              ),
            ),
            h(ConfBar, { prob: selected.prob, clase: selected.clase }),

            // Metadatos
            h("div", { style: { fontSize: 12.5, color: "var(--ink-700)", display: "flex", flexDirection: "column", gap: 6, marginTop: 12 } },
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
              h("div", { style: { fontSize: 12 } }, "El mapa Grad-CAM no se almacena en el historial. Vuelve a analizar la imagen para generarlo."),
            ),
          ),
        ),
  );
}
