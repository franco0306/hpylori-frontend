import { I } from "../icons.js";
import { fmtLatencia } from "../format.js";
import { getStudyMedia, hasStudyMedia } from "../sessionCache.js";
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

function fmtProb(p) {
  return (p * 100).toFixed(1) + "%";
}

function ConfBar({ prob }) {
  const val   = prob;
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
    className: "history-row",
    onClick: () => onSelect(isSel ? null : s),
    style: {
      display: "flex", alignItems: "center", gap: 14,
      padding: "11px 16px",
      borderTop: idx > 0 ? "1px solid var(--ink-100)" : "none",
      background: isSel ? "var(--blue-50)" : "transparent",
      cursor: "pointer", transition: "background 0.12s",
    },
  },
    (function () {
      // Orden de preferencia: el archivo permanente en Storage, y si no lo hay
      // —estudios anteriores a esa función— lo que quede en la caché de sesión.
      const media = getStudyMedia(s.id);
      const src = s.image_url || (media && media.src) || null;

      if (src) {
        return h("div", { className: "study-thumb-wrapper" },
          h("img", {
            className: "study-thumb-img",
            src,
            loading: "lazy",
            alt: "",
            // La subida al almacén ocurre después de responder: si aquel objeto
            // nunca llegó a existir, la miniatura se apaga en vez de dejar el
            // icono roto del navegador.
            onError: (e) => { e.target.style.display = "none"; },
          }),
          // Distintivo de que el estudio conserva su mapa de calor.
          (s.gradcam_url || (media && media.heatmap_b64)) &&
            h("span", { className: "cam-pill", title: "Conserva su mapa Grad-CAM" }, "CAM"),
        );
      }

      return h("div", {
        className: "study-thumb-wrapper study-thumb-empty",
        role: "img",
        "aria-label": "Estudio sin imagen archivada",
        title: "Este estudio se registró antes de que se archivaran las imágenes",
      }, h(I.scan, { size: 20, "aria-hidden": true }));
    })(),
    h("div", { style: { flex: 1, minWidth: 0 } },
      h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 } },
        h("span", { style: { fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, s.fileName),
        h("span", { className: "badge " + (isPos ? "badge-pos" : "badge-neg"), style: { flexShrink: 0 } },
          isPos ? "POSITIVO" : "NEGATIVO"),
      ),
      h("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 3 } },
        h("span", { className: "mono", style: { fontSize: 11, color: "var(--ink-500)" } }, fmtLatencia(s.latencia_ms) + " ms"),
        h("span", { className: "mono", style: { fontSize: 12, fontWeight: 600, color: isPos ? "var(--red-600)" : "var(--green-600)" } }, fmtProb(s.prob)),
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
// ── Modal de inspección comparativa ──────────────────────────────────────────
// Original y mapa de calor lado a lado. Compararlos en la misma pantalla es lo
// que permite juzgar si el modelo miró donde debía; alternando entre pestañas
// se pierde justamente eso.
const FOCUSABLE_HIST =
  'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function ModalComparativo({ estudio, onCerrar }) {
  const dialogo = React.useRef(null);
  const isPos = estudio.clase === "Positivo";

  React.useEffect(() => {
    const previo = document.activeElement;
    const primero = dialogo.current && dialogo.current.querySelector(FOCUSABLE_HIST);
    if (primero) primero.focus();

    const handleTecla = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onCerrar(); return; }
      if (e.key !== "Tab" || !dialogo.current) return;

      const items = Array.from(dialogo.current.querySelectorAll(FOCUSABLE_HIST));
      if (!items.length) return;
      const inicio = items[0], fin = items[items.length - 1];
      if (e.shiftKey && document.activeElement === inicio) {
        e.preventDefault(); fin.focus();
      } else if (!e.shiftKey && document.activeElement === fin) {
        e.preventDefault(); inicio.focus();
      }
    };

    document.addEventListener("keydown", handleTecla);
    return () => {
      document.removeEventListener("keydown", handleTecla);
      if (previo && previo.focus) previo.focus();
    };
  }, [onCerrar]);

  // El archivo permanente manda; la caché de sesión es el respaldo para los
  // estudios anteriores a que existiera Storage.
  const media = getStudyMedia(estudio.id);
  const original = estudio.image_url || (media && media.src) || null;
  const gradcam = estudio.gradcam_url || (media && media.heatmap_b64) || null;

  const [rotas, setRotas] = React.useState({});

  const panel = (clave, titulo, src, alt, vacio) => h("div", { className: "comparativa-panel" },
    h("div", { className: "comparativa-titulo" }, titulo),
    src && !rotas[clave]
      ? h("img", {
          className: "comparativa-img", src, alt, loading: "lazy",
          // Una URL archivada puede no resolver si su subida diferida falló.
          // Se cae al estado vacío, que dice la verdad.
          onError: () => setRotas((previas) => ({ ...previas, [clave]: true })),
        })
      : h("div", { className: "comparativa-vacio" },
          h(I.scan, { size: 26, "aria-hidden": true }),
          h("span", null, rotas[clave] ? "Imagen no disponible" : vacio)),
  );

  return h("div", { className: "modal-backdrop", onClick: onCerrar },
    h("div", {
      className: "modal modal-comparativa",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "comparativa-titulo",
      ref: dialogo,
      // El clic en el fondo cierra; dentro del diálogo no debe propagarse.
      onClick: (e) => e.stopPropagation(),
    },
      h("div", { className: "modal-head" },
        h("div", { className: "modal-mark" }, h(I.heat, { size: 18 })),
        h("div", null,
          h("h2", { className: "modal-title", id: "comparativa-titulo" },
            estudio.fileName || "Estudio"),
          h("div", { className: "modal-sub" },
            (estudio.paciente ? "Paciente " + estudio.paciente + " · " : "") +
            fmtDate(estudio.timestamp)),
        ),
        h("button", {
          className: "btn btn-ghost btn-icon",
          onClick: onCerrar,
          "aria-label": "Cerrar la inspección",
        }, h(I.x, { size: 16 })),
      ),

      h("div", { className: "modal-body" },
        h("div", { className: "comparativa-grid" },
          panel("original", "Imagen endoscópica", original,
                "Imagen endoscópica del estudio",
                "Imagen no archivada"),
          panel("gradcam", "Mapa Grad-CAM", gradcam,
                "Mapa de activación Grad-CAM del estudio",
                "Mapa no archivado"),
        ),

        h("div", { className: "metrics", style: { marginTop: 16 } },
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Diagnóstico"),
            h("div", { className: "metric-value", style: {
              color: isPos ? "var(--red-600)" : "var(--green-600)", fontSize: 17,
            } }, isPos ? "Positivo" : "Negativo"),
          ),
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Confianza"),
            h("div", { className: "metric-value" }, fmtProb(estudio.prob)),
          ),
          h("div", { className: "metric" },
            h("div", { className: "metric-label" }, "Latencia"),
            h("div", { className: "metric-value" },
              fmtLatencia(estudio.latencia_ms), h("small", null, " ms")),
          ),
        ),

        h("div", { className: "alert alert-info", style: { marginTop: 14 } },
          h(I.info, { size: 14 }),
          h("div", { style: { fontSize: 12, lineHeight: 1.5 } },
            "El Grad-CAM muestra qué regiones activaron el modelo, no por qué. ",
            "Resultado sugerido por IA: requiere validación clínica.",
          ),
        ),
      ),
    ),
  );
}


export function HistoryScreen({ onViewHeatmap }) {
  const [studies,      setStudies]      = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [selected,     setSelected]     = useState(null);
  const [comparativa,  setComparativa]  = useState(null);   // estudio inspeccionado

  // Un clic hace las dos cosas: resalta la fila y abre la inspección. Al cerrar
  // el modal queda el panel lateral, que es de donde se salta al Grad-CAM.
  const handleInspeccionar = useCallback((estudio) => {
    setSelected(estudio);
    if (estudio) setComparativa(estudio);
  }, []);
  const [resultF,      setResultF]      = useState("Todos");
  const [dateF,        setDateF]        = useState(DATE_FILTERS[0]);
  const [viewMode,     setViewMode]     = useState("cronologico"); // "cronologico" | "paciente"
  const [confirmClear, setConfirmClear] = useState(false);
  const [query,        setQuery]        = useState("");

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

  // Abre el Grad-CAM reutilizando la media retenida en esta sesión.
  const handleOpenHeatmap = (study) => {
    const media = getStudyMedia(study.id);
    if (!media || !onViewHeatmap) return;   // early return: sin imagen no hay XAI
    onViewHeatmap(
      {
        clase:       study.clase,
        prob:        study.prob,
        latencia_ms: study.latencia_ms,
        heatmap_b64: media.heatmap_b64,
        modelo:      study.modelo,
        timestamp:   study.timestamp,
      },
      { src: media.src, name: media.name || study.fileName },
    );
  };
  const handleClear  = async () => { await clearHistory(); setStudies([]); setSelected(null); setConfirmClear(false); };

  const handleSearch = (e) => setQuery(e.target.value);

  // Filtros comunes a ambas vistas
  const now = new Date();
  const needle = query.trim().toLowerCase();
  const visible = studies.filter((s) => {
    if (needle) {
      const haystack = [s.id, s.fileName, s.paciente].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
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
          "" + studies.length + " estudio" + (studies.length !== 1 ? "s" : "") + " almacenado" + (studies.length !== 1 ? "s" : ""),
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
      h("div", { className: "search-field", style: { marginBottom: 18 } },
        h("span", { className: "search-icon", "aria-hidden": true }, h(I.history, { size: 15 })),
        h("input", {
          id: "history-search",
          className: "input search-input",
          type: "search",
          value: query,
          onChange: handleSearch,
          placeholder: "Buscar por ID de estudio…",
          "aria-label": "Buscar estudios por identificador, archivo o paciente",
          autoComplete: "off",
        }),
        needle && h("span", { className: "search-count", role: "status" },
          visible.length + " resultado" + (visible.length === 1 ? "" : "s")),
      ),
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
                    h(StudyRow, { key: s.id, s, idx, selected, onSelect: handleInspeccionar, onDelete: handleDelete }),
                  ),
                )
              // Vista por paciente
              : h("div", null,
                  h("div", { className: "row between", style: { marginBottom: 10 } },
                    h("span", { className: "section-title", style: { marginBottom: 0 } },
                      patientGroups.length + " paciente" + (patientGroups.length !== 1 ? "s" : "")),
                  ),
                  patientGroups.map(([name, group]) =>
                    h(PatientCard, { key: name, name, studies: group, selected, onSelect: handleInspeccionar, onDelete: handleDelete }),
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
            (function () {
              const media = getStudyMedia(selected.id);
              const src = (media && media.src) || selected.thumbnail;

              if (src) {
                return h("div", { style: { marginBottom: 16 } },
                  h("img", {
                    src,
                    style: { width: "100%", borderRadius: 8, objectFit: "cover", border: "1px solid var(--ink-200)" },
                    alt: "Imagen endoscópica de " + (selected.fileName || "el estudio"),
                  }),
                );
              }

              return h("div", {
                className: "detail-preview-empty",
                role: "img",
                "aria-label": "Este estudio no conserva la imagen endoscópica",
                style: { marginBottom: 16 },
              },
                h(I.scan, { size: 30, "aria-hidden": true }),
                h("div", { className: "detail-preview-text" },
                  "La imagen no se conserva en el historial"),
                h("div", { className: "detail-preview-hint" },
                  "Solo se almacenan los datos del análisis"),
              );
            })(),

            // Inspección Grad-CAM: solo tiene sentido si la imagen sigue en memoria.
            (function () {
              const disponible = hasStudyMedia(selected.id);
              return h("button", {
                className: "btn xai-action " + (disponible ? "btn-secondary" : "btn-ghost"),
                style: { width: "100%", marginBottom: 14 },
                onClick: () => handleOpenHeatmap(selected),
                disabled: !disponible,
                title: disponible
                  ? "Ver el mapa de activación de este estudio"
                  : "Visualización XAI disponible solo en sesión activa",
                "aria-label": disponible
                  ? "Ver visualización Grad-CAM del estudio"
                  : "Visualización XAI disponible solo en sesión activa",
              },
                h(I.heat, { size: 14, "aria-hidden": true }),
                disponible ? "Ver Grad-CAM" : "Grad-CAM no disponible",
              );
            })(),

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
            h("div", { className: "metrics metrics-2", style: { marginBottom: 12 } },
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Probabilidad"),
                h("div", { className: "metric-value" }, fmtProb(selected.prob)),
              ),
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Latencia"),
                h("div", { className: "metric-value" }, fmtLatencia(selected.latencia_ms), h("small", null, " ms")),
              ),
            ),
            h(ConfBar, { prob: selected.prob }),

            // Metadatos
            h("div", { style: { fontSize: 12.5, color: "var(--ink-700)", display: "flex", flexDirection: "column", gap: 6, marginTop: 12 } },
              h("div", { className: "row between" },
                h("span", { style: { color: "var(--ink-500)" } }, "Archivo"),
                h("span", { className: "mono", style: { fontSize: 11 } }, selected.fileName),
              ),
              h("div", { className: "row between" },
                h("span", { style: { color: "var(--ink-500)" } }, "Latencia"),
                h("span", { className: "mono", style: { fontSize: 11 } }, fmtLatencia(selected.latencia_ms) + " ms"),
              ),
              h("div", { className: "row between" },
                h("span", { style: { color: "var(--ink-500)" } }, "Fecha"),
                h("span", { className: "mono", style: { fontSize: 11 } }, fmtDate(selected.timestamp)),
              ),
            ),

            h("div", { className: "alert alert-info", style: { marginTop: 16 } },
              h(I.info, { size: 14 }),
              h("div", { style: { fontSize: 12 } },
                hasStudyMedia(selected.id)
                  ? "El mapa Grad-CAM de este estudio sigue disponible mientras no cierres la sesión."
                  : "El mapa Grad-CAM no se almacena en el historial. Vuelve a analizar la imagen para generarlo."),
            ),
          ),
        ),

    comparativa && h(ModalComparativo, {
      estudio: comparativa,
      onCerrar: () => setComparativa(null),
    }),
  );
}
