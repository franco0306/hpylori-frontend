import { motion } from "framer-motion";
import { I } from "../icons.js";
import { getStudies } from "../history.js";
import { getStudyMedia } from "../sessionCache.js";
import { SpotlightCard, HoverEffect, AnimatedNumber, ShimmerButton } from "../ui/cards.jsx";
import { EmptyState, SkeletonRows } from "../ui/states.jsx";

const React = window.React;
const { useState, useEffect, useMemo } = React;
const h = React.createElement;

const EASE = [0.16, 1, 0.3, 1];

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

// ── Gráfico de dona SVG (se dibuja al montar) ────────────────────────────────
function DonutChart({ posRate, total }) {
  const R = 54, CX = 72, CY = 72, SW = 14;
  const CIRC   = 2 * Math.PI * R;
  const posArc = (parseFloat(posRate) / 100) * CIRC;
  const empty  = total === 0;

  const arco = (color, largo, retraso) => h(motion.circle, {
    cx: CX, cy: CY, r: R, fill: "none", stroke: color, strokeWidth: SW, strokeLinecap: "butt",
    transform: `rotate(-90 ${CX} ${CY})`,
    initial: { strokeDasharray: `0 ${CIRC}` },
    animate: { strokeDasharray: `${largo} ${CIRC - largo}` },
    transition: { duration: 1.1, ease: EASE, delay: retraso },
  });

  return h("svg", { width: 144, height: 144, viewBox: "0 0 144 144", role: "img",
                    "aria-label": empty ? "Sin estudios" : posRate + "% positivos" },
    h("circle", { cx: CX, cy: CY, r: R, fill: "none", strokeWidth: SW, style: { stroke: "var(--ink-100)" } }),
    !empty && h("g", null,
      arco("var(--green-600)", CIRC, 0),
      arco("var(--red-600)", posArc, 0.25),
    ),
    h("text", {
      x: CX, y: CY - 3, textAnchor: "middle", dominantBaseline: "middle",
      fontSize: 22, fontWeight: 700, fontFamily: "IBM Plex Mono, monospace",
      style: { fill: empty ? "var(--ink-400)" : "var(--ink-900)" },
    }, empty ? "—" : posRate + "%"),
    h("text", {
      x: CX, y: CY + 17, textAnchor: "middle", fontSize: 9.5, fontFamily: "Inter, sans-serif",
      style: { fill: "var(--ink-500)", letterSpacing: ".06em" },
    }, "POSITIVOS"),
  );
}

// ── KPI ──────────────────────────────────────────────────────────────────────
// Exportado: el Panel de Administración usa la misma tarjeta para sus métricas
// de gobernanza, de modo que ambas pantallas comparten aspecto y tokens.
// `permitirDesborde` deja salir contenido flotante (un tooltip, por ejemplo)
// fuera de los límites de la tarjeta.
export function KpiCard({ label, value, sub, subColor, barPct, barColor, valueColor, icon,
                          permitirDesborde = false }) {
  const Icono = icon ? I[icon] : null;
  return h(SpotlightCard, {
    className: "kpi kpi-v2" + (permitirDesborde ? " overflow-visible" : ""),
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.45, ease: EASE },
  },
    h("div", { className: "kpi-v2-head" },
      h("div", { className: "kpi-label" }, label),
      Icono && h("span", { className: "kpi-v2-icon", style: { color: barColor } }, h(Icono, { size: 15 })),
    ),
    h("div", { className: "kpi-value", style: { color: valueColor || "var(--ink-900)" } }, value),
    h("div", { className: "kpi-delta", style: { color: subColor } }, sub),
    barPct !== undefined && h("div", { className: "kpi-v2-track" },
      h(motion.div, {
        className: "kpi-v2-bar",
        style: { background: barColor },
        initial: { width: 0 },
        animate: { width: Math.max(0, Math.min(100, barPct || 0)) + "%" },
        transition: { duration: 1, ease: EASE, delay: 0.2 },
      }),
    ),
  );
}

const ACCIONES = [
  { id: "single",   icon: "upload",  color: "var(--blue-700)",  bg: "var(--blue-50)",
    title: "Análisis individual", description: "Sube una imagen endoscópica y obtén el resultado en segundos." },
  { id: "batch",    icon: "layers",  color: "#7C3AED",          bg: "rgba(124,58,237,.10)",
    title: "Procesamiento por lote", description: "Analiza varias imágenes de un mismo estudio de una vez." },
  { id: "history",  icon: "history", color: "var(--amber-600)", bg: "var(--amber-50)",
    title: "Historial", description: "Consulta casos anteriores por paciente y fecha." },
  { id: "settings", icon: "cog",     color: "var(--ink-700)",   bg: "var(--ink-100)",
    title: "Configuración", description: "Sensibilidad del análisis, apariencia y privacidad." },
];

// ── Dashboard ─────────────────────────────────────────────────────────────────
export function Dashboard({ onNavigate, onViewHeatmap, user }) {
  const [studies, setStudies] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let mounted = true;
    getStudies().then((data) => { if (mounted) { setStudies(data); setCargando(false); } });
    return () => { mounted = false; };
  }, []);

  const stats   = useMemo(() => computeStats(studies), [studies]);
  const recent  = useMemo(() => studies.slice(0, 6), [studies]);
  const nombre  = (user && (user.full_name || user.email)) || "";
  const hayDatos = stats.total > 0;

  // Abre la vista Grad-CAM del estudio. Si se analizó en esta sesión se
  // conserva su mapa; si no, la pantalla Grad-CAM lo advierte.
  const handleOpenCase = (study) => {
    if (!onViewHeatmap) return onNavigate("heatmap");   // early return
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
        src:  (cached && cached.src) || study.image_url || study.thumbnail || null,
        name: buildCaseCode(study),
      },
    );
  };

  return h("div", { className: "content dash" },

    // ── Cabecera ──────────────────────────────────────────────────────────────
    h("div", { className: "page-header" },
      h("div", null,
        h("div", { className: "dash-fecha" }, getFecha()),
        h("h1", { className: "page-title dash-saludo" },
          getGreeting() + ", ",
          h("span", { className: "dash-nombre" }, nombre)),
        h("div", { className: "page-sub" }, "Análisis asistido de mucosa gástrica en tiempo real"),
      ),
      h(ShimmerButton, { onClick: () => onNavigate("single") },
        h(I.plus, { size: 14 }), "Nuevo análisis"),
    ),

    // ── KPIs ─────────────────────────────────────────────────────────────────
    h("div", { className: "kpi-grid", style: { marginBottom: 20 } },
      h(KpiCard, {
        label: "Total de estudios", icon: "scan",
        value: h(AnimatedNumber, { value: stats.total }),
        sub: stats.today + " realizados hoy",
        subColor: "var(--ink-500)",
        barColor: "var(--blue-600)", barPct: Math.min(100, stats.total / 2),
      }),
      h(KpiCard, {
        label: "H. pylori positivo", icon: "alert",
        value: hayDatos ? h(AnimatedNumber, { value: stats.posRate, decimals: 1, suffix: "%" }) : "—",
        sub: stats.pos + " casos positivos",
        subColor: "var(--red-600)", valueColor: "var(--red-600)",
        barColor: "var(--red-600)", barPct: parseFloat(stats.posRate),
      }),
      h(KpiCard, {
        label: "H. pylori negativo", icon: "check",
        value: hayDatos ? h(AnimatedNumber, { value: stats.negRate, decimals: 1, suffix: "%" }) : "—",
        sub: stats.neg + " casos negativos",
        subColor: "var(--green-600)", valueColor: "var(--green-600)",
        barColor: "var(--green-600)", barPct: parseFloat(stats.negRate),
      }),
      h(KpiCard, {
        label: "Latencia media", icon: "bars",
        value: hayDatos
          ? h("span", null, h(AnimatedNumber, { value: stats.avgLat }), h("small", null, " ms"))
          : "—",
        sub: "tiempo medio de respuesta",
        subColor: "var(--ink-500)", valueColor: "var(--blue-700)",
        barColor: "var(--blue-700)",
        barPct: Math.max(0, 100 - (parseInt(stats.avgLat || 0) / 20)),
      }),
    ),

    // ── Distribución + estudios recientes (bento) ─────────────────────────────
    h("div", { className: "dash-bento" },

      h(SpotlightCard, {
        className: "card dash-dist",
        initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: EASE, delay: 0.1 },
      },
        h("div", { className: "section-title" }, "Distribución de resultados"),
        h("div", { className: "dash-dist-body" },
          h(DonutChart, { posRate: stats.posRate, total: stats.total }),
          h("div", { className: "dash-leyenda" },
            [["Positivo", stats.pos, stats.posRate, "var(--red-600)"],
             ["Negativo", stats.neg, stats.negRate, "var(--green-600)"]].map(([txt, n, pct, color]) =>
              h("div", { key: txt, className: "dash-leyenda-fila" },
                h("span", { className: "dash-leyenda-punto", style: { background: color } }),
                h("span", { className: "dash-leyenda-txt" }, "H. pylori " + txt.toLowerCase()),
                h("span", { className: "mono dash-leyenda-num", style: { color } }, n + " · " + pct + "%"),
              )),
            h("div", { className: "dash-leyenda-total" },
              h("span", null, "Total analizado"),
              h("span", { className: "mono" }, stats.total)),
          ),
        ),
      ),

      h(motion.div, {
        className: "card dash-recientes",
        initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 },
        transition: { duration: 0.45, ease: EASE, delay: 0.15 },
      },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "Estudios recientes"),
            h("div", { className: "card-sub" }, "Pulse un caso para abrir su visualización"),
          ),
          h("button", {
            className: "btn btn-ghost", style: { fontSize: 12 },
            onClick: () => onNavigate("history"),
            "aria-label": "Ver todo el historial de estudios",
          }, "Ver todos", h(I.chev, { size: 12 })),
        ),
        cargando
          ? h(SkeletonRows, { rows: 5, label: "Cargando estudios recientes" })
          : recent.length === 0
            ? h(EmptyState, {
                icon: I.scan,
                title: "Aún no hay estudios",
                description: "Cuando analice su primera imagen endoscópica, el caso aparecerá aquí con su resultado.",
                action: h("button", { className: "btn btn-primary", onClick: () => onNavigate("single") },
                  h(I.upload, { size: 14 }), "Analizar una imagen"),
              })
            : h("div", null,
                recent.map((study, i) => {
                  const isPos    = study.clase === "Positivo";
                  const caseCode = buildCaseCode(study);
                  const paciente = (study.paciente || "").trim();
                  const media    = getStudyMedia(study.id);
                  const src      = (media && media.src) || study.image_url || null;

                  return h(motion.button, {
                    key: study.id,
                    type: "button",
                    className: "study-row",
                    onClick: () => handleOpenCase(study),
                    initial: { opacity: 0, x: -8 },
                    animate: { opacity: 1, x: 0 },
                    transition: { duration: 0.35, ease: EASE, delay: 0.2 + i * 0.05 },
                    "aria-label": "Abrir Grad-CAM de " + caseCode + " · " + (isPos ? "positivo" : "negativo"),
                  },
                    src
                      ? h("img", { className: "study-thumb", src, alt: "", loading: "lazy" })
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

    // ── Accesos rápidos (Aceternity · Card Hover Effect) ─────────────────────
    h("div", { className: "dash-accesos" },
      h("div", { className: "section-title" }, "Accesos rápidos"),
      h(HoverEffect, {
        className: "dash-accesos-grid",
        onSelect: onNavigate,
        items: ACCIONES.map((a) => ({ ...a, icon: h(I[a.icon], { size: 18 }) })),
      }),
    ),
  );
}
