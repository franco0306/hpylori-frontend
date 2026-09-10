import { I } from "../icons.js";
import { getStudies } from "../history.js";
import { getStudyMedia } from "../sessionCache.js";

const React = window.React;
const { useState, useEffect, useMemo } = React;
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

// Código de caso clínico legible. El nombre de archivo crudo (p194_f020850.jpg)
// no dice nada al gastroenterólogo; un identificador de caso sí es trazable.
function buildCaseCode(study) {
  const raw = String(study.id || "");
  const clean = raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (!clean) return "Caso #HP-000000";
  return "Caso #HP-" + clean.slice(-6).padStart(6, "0");
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
    h("circle", { cx: CX, cy: CY, r: R, fill: "none", strokeWidth: SW, style: { stroke: "var(--ink-100)" } }),
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
      fontFamily: "IBM Plex Mono, monospace",
      style: { fill: empty ? "var(--ink-400)" : "#DC2626" },
    }, empty ? "—" : posRate + "%"),
    h("text", {
      x: CX, y: CY + 14,
      textAnchor: "middle",
      fontSize: 9, fontFamily: "IBM Plex Mono, monospace",
      style: { fill: "var(--ink-500)" },
    }, "positivos"),
  );
}

// ── KPI con barra de progreso ─────────────────────────────────────────────────
// Exportado: el Panel de Administración usa la misma tarjeta para sus métricas
// de gobernanza, de modo que ambas pantallas comparten aspecto y tokens.
// `permitirDesborde` deja salir contenido flotante (un tooltip, por ejemplo)
// fuera de los límites de la tarjeta. La barra de acento superior lleva su
// propio border-radius, así que recortar no le hace falta.
export function KpiCard({ label, value, sub, subColor, barPct, barColor, valueColor,
                          permitirDesborde = false }) {
  return h("div", {
    className: "kpi",
    style: { position: "relative", overflow: permitirDesborde ? "visible" : "hidden" },
  },
    // Barra de acento superior
    h("div", { style: { position: "absolute", top: 0, left: 0, right: 0, height: 3, background: barColor, borderRadius: "12px 12px 0 0" } }),
    h("div", { className: "kpi-label" }, label),
    h("div", { className: "kpi-value", style: { color: valueColor || barColor } }, value),
    h("div", { className: "kpi-delta", style: { color: subColor } }, sub),
    barPct !== undefined && h("div", { style: { marginTop: 10, height: 3, background: "var(--ink-100)", borderRadius: 999 } },
      h("div", { style: { width: Math.min(100, barPct) + "%", height: "100%", background: barColor, borderRadius: 999, transition: "width 0.6s ease" } }),
    ),
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function Dashboard({ onNavigate, onViewHeatmap, user }) {
  const [studies, setStudies] = useState([]);

  useEffect(() => {
    let mounted = true;
    getStudies().then((data) => { if (mounted) setStudies(data); });
    return () => { mounted = false; };
  }, []);

  const stats   = useMemo(() => computeStats(studies), [studies]);
  const recent  = useMemo(() => studies.slice(0, 6), [studies]);

  const handleOpenHistory = () => onNavigate("history");

  // Abre la vista Grad-CAM del estudio. El historial solo conserva la
  // miniatura, así que la pantalla avisa si el mapa ya no está disponible.
  const handleOpenCase = (study) => {
    if (!onViewHeatmap) return onNavigate("heatmap");   // early return

    // Si el estudio se analizó en esta sesión conservamos su imagen y su mapa;
    // si no, la pantalla Grad-CAM lo advierte en lugar de mostrar un panel roto.
    const cached = getStudyMedia(study.id);

    onViewHeatmap(
      {
        clase:       study.clase,
        prob:        study.prob,
        latencia_ms: study.latencia_ms,
        heatmap_b64: (cached && cached.heatmap_b64) || study.heatmap_b64 || null,
        modelo:      study.modelo,
        timestamp:   study.timestamp,
      },
      {
        src:  (cached && cached.src) || study.thumbnail || null,
        name: buildCaseCode(study),
      },
    );
  };

  const ACTIONS = [
    { k: "single",  icon: "upload",  color: "var(--blue-700)",  bg: "var(--blue-50)",  title: "Análisis individual" },
    { k: "heatmap", icon: "heat",    color: "var(--red-600)",   bg: "var(--red-50)",   title: "Grad-CAM" },
    { k: "history", icon: "history", color: "var(--amber-600)", bg: "var(--amber-50)", title: "Historial" },
    { k: "settings",icon: "cog",     color: "var(--ink-700)",   bg: "var(--ink-50)",   title: "Configuración" },
  ];

  return h("div", { className: "content" },

    // ── Cabecera ──────────────────────────────────────────────────────────────
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" },
          getGreeting() + ", " + ((user && (user.full_name || user.email)) || "")),
        h("div", { className: "page-sub" },
          "Análisis asistido de mucosa gástrica en tiempo real · " + getFecha(),
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
        subColor: "var(--ink-500)",
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
        value: stats.total > 0
          ? h("span", null, stats.avgLat, h("small", null, " ms"))
          : "—",
        sub: "tiempo medio de respuesta",
        subColor: "var(--ink-500)",
        valueColor: "var(--blue-700)",
        barColor: "var(--blue-700)",
        barPct: Math.max(0, 100 - (parseInt(stats.avgLat || 0) / 20)),
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
              h("span", { style: { color: "var(--ink-700)" } }, "H. pylori positivo"),
            ),
            h("span", { style: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, color: "#DC2626" } },
              stats.pos + " (" + stats.posRate + "%)"),
          ),
          h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12.5 } },
            h("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
              h("div", { style: { width: 10, height: 10, borderRadius: 2, background: "#16A34A" } }),
              h("span", { style: { color: "var(--ink-700)" } }, "H. pylori negativo"),
            ),
            h("span", { style: { fontFamily: "IBM Plex Mono, monospace", fontWeight: 700, color: "#16A34A" } },
              stats.neg + " (" + stats.negRate + "%)"),
          ),
          h("div", { style: { borderTop: "1px solid var(--ink-100)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 } },
            h("span", { style: { color: "var(--ink-400)" } }, "Total"),
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
            "aria-label": "Ver todo el historial de estudios",
          }, "Ver todos →"),
        ),
        recent.length === 0
          ? h("div", { style: { padding: "32px 20px", textAlign: "center", color: "var(--ink-400)", fontSize: 13 } },
              "Aún no hay estudios. Realiza tu primer análisis.")
          : h("div", null,
              recent.map((study) => {
                const isPos    = study.clase === "Positivo";
                const caseCode = buildCaseCode(study);
                const paciente = (study.paciente || "").trim();

                return h("button", {
                  key: study.id,
                  type: "button",
                  className: "study-row",
                  onClick: () => handleOpenCase(study),
                  "aria-label": "Abrir Grad-CAM de " + caseCode + " · " + (isPos ? "positivo" : "negativo"),
                },
                  study.thumbnail
                    ? h("img", { className: "study-thumb", src: study.thumbnail, alt: "" })
                    : h("div", {
                        className: "study-thumb study-thumb-empty",
                        role: "img",
                        "aria-label": "Estudio sin imagen conservada",
                        title: "La imagen no se conserva tras cerrar la sesión",
                      }, h(I.scan, { size: 16, "aria-hidden": true })),

                  h("div", { className: "study-meta" },
                    h("div", { className: "study-code" }, caseCode),
                    h("div", { className: "study-sub" },
                      paciente ? paciente + " · " + fmtTime(study.timestamp) : fmtTime(study.timestamp)),
                  ),

                  h("div", { className: "study-result" },
                    h("span", { className: "badge " + (isPos ? "badge-pos" : "badge-neg") },
                      isPos ? "POSITIVO" : "NEGATIVO"),
                    h("div", {
                      className: "study-prob",
                      style: { color: isPos ? "var(--red-600)" : "var(--green-600)" },
                    }, (study.prob * 100).toFixed(1) + "%"),
                  ),
                );
              }),
            ),
      ),
    ),

    // ── Accesos rápidos ───────────────────────────────────────────────────────
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 16 } },
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "Accesos rápidos"),
        h("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 } },
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

    ),
  );
}
