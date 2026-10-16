// Modelo y reentrenamiento (solo administradores).
//
// Tres preguntas, en este orden: ¿cómo le va al modelo con pacientes reales?,
// ¿hay casos suficientes para reentrenarlo?, ¿la versión nueva es mejor que la
// actual? Ninguna versión se activa sola: el administrador decide viendo la
// comparación, y siempre puede volver al modelo original validado.

import { I } from "../icons.js";
import { authFetch } from "../auth.js";
import { toast } from "../ui/toast.jsx";
import { EmptyState, Skeleton } from "../ui/states.jsx";

const React = window.React;
const { useState, useEffect, useCallback, useRef } = React;
const h = React.createElement;

function pct(v) { return v == null ? "—" : (v * 100).toFixed(1) + " %"; }

function fmtFecha(iso) {
  if (!iso) return "—";
  const d = new Date(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z");
  return d.toLocaleString("es-PE", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

async function pedir(ruta, opciones) {
  const res = await authFetch(ruta, opciones);
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof datos.detail === "string" ? datos.detail : "HTTP_" + res.status);
  return datos;
}

function Metrica({ titulo, valor, ayuda, tono }) {
  return h("div", { className: "modelo-metrica" },
    h("div", { className: "modelo-metrica-titulo" }, titulo),
    h("div", { className: "modelo-metrica-valor", style: tono ? { color: tono } : undefined }, valor),
    ayuda && h("div", { className: "modelo-metrica-ayuda" }, ayuda));
}

function Barra({ actual, minimo, color }) {
  const p = Math.min(100, Math.round((actual / Math.max(minimo, 1)) * 100));
  return h("div", { className: "modelo-barra" },
    h("div", { className: "modelo-barra-fill", style: { width: p + "%", background: color } }));
}

function Comparacion({ m }) {
  if (!m) return null;
  const fila = (nombre, clave, mejorSiMayor = true) => {
    const a = m.actual[clave], n = m.nueva[clave];
    const delta = a == null || n == null ? null : n - a;
    const mejora = delta == null || Math.abs(delta) < 1e-9 ? null : (delta > 0) === mejorSiMayor;
    return h("tr", { key: clave },
      h("td", null, nombre),
      h("td", { className: "mono" }, clave === "auc" ? (a == null ? "—" : a.toFixed(3)) : pct(a)),
      h("td", { className: "mono", style: { fontWeight: 600 } }, clave === "auc" ? (n == null ? "—" : n.toFixed(3)) : pct(n)),
      h("td", null, mejora == null ? h("span", { className: "muted" }, "igual")
        : h("span", { className: "badge " + (mejora ? "badge-neg" : "badge-pos") }, mejora ? "mejor" : "peor")));
  };
  return h("table", { className: "table modelo-comparacion" },
    h("thead", null, h("tr", null, h("th", null, "En casos que ninguna vio"), h("th", null, "Actual"),
                                    h("th", null, "Nueva"), h("th", null, ""))),
    h("tbody", null,
      fila("Detecta infecciones (sensibilidad)", "sensibilidad"),
      fila("Descarta sanos (especificidad)", "especificidad"),
      fila("Aciertos totales (exactitud)", "exactitud"),
      fila("Capacidad de separar (AUC)", "auc")));
}

export function ModeloScreen() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [lanzando, setLanzando] = useState(false);
  const sondeo = useRef(null);

  const cargar = useCallback(() => pedir("/admin/model")
    .then((d) => { setDatos(d); setError(null); return d; })
    .catch((e) => { setError(e.message); return null; }), []);

  useEffect(() => { cargar(); return () => clearInterval(sondeo.current); }, [cargar]);

  // Mientras entrena, se consulta el progreso cada segundo y medio.
  useEffect(() => {
    clearInterval(sondeo.current);
    if (datos && datos.trabajo && datos.trabajo.en_curso) {
      sondeo.current = setInterval(async () => {
        const d = await cargar();
        if (d && !d.trabajo.en_curso) {
          clearInterval(sondeo.current);
          if (d.trabajo.fase === "listo") toast.success("Reentrenamiento terminado", "Revise la versión nueva antes de activarla.");
          if (d.trabajo.fase === "error") toast.error("El reentrenamiento falló", d.trabajo.error);
        }
      }, 1500);
    }
    return () => clearInterval(sondeo.current);
  }, [datos && datos.trabajo && datos.trabajo.en_curso]);

  const reentrenar = async () => {
    setLanzando(true);
    try {
      await pedir("/admin/model/retrain", { method: "POST" });
      await cargar();
    } catch (e) {
      toast.error("No se pudo reentrenar", e.message);
    } finally {
      setLanzando(false);
    }
  };

  const accion = async (ruta, exito) => {
    try {
      await pedir(ruta, { method: "POST" });
      toast.success(exito);
      await cargar();
    } catch (e) {
      toast.error("No se pudo completar la acción", e.message);
    }
  };

  if (!datos) {
    return h("div", { className: "content" },
      h("div", { className: "page-header" }, h("div", null, h("h1", { className: "page-title" }, "Modelo y reentrenamiento"))),
      error ? h("div", { className: "alert alert-error" }, h(I.alert, { size: 16 }), h("div", null, error))
            : h("div", { className: "modelo-grid" }, [0, 1, 2].map((i) =>
                h("div", { key: i, className: "card card-pad" }, h(Skeleton, { style: { height: 120, borderRadius: 10 } })))));
  }

  const real = datos.rendimiento_real;
  const d = datos.datos;
  const trabajo = datos.trabajo || {};
  const activa = datos.activa;

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Modelo y reentrenamiento"),
        h("div", { className: "page-sub" }, "Cómo le va al modelo con pacientes reales y cómo mejorarlo con los casos confirmados"),
      ),
      h("span", { className: "badge badge-info" }, h(I.shield, { size: 11 }), " Acceso administrador"),
    ),

    h("div", { className: "modelo-grid" },
      // ── 1. Rendimiento real ─────────────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "1 · Rendimiento en pacientes reales"),
        real.confirmados === 0
          ? h(EmptyState, { icon: I.check, compact: true, title: "Aún no hay diagnósticos confirmados",
              description: "Cuando los médicos registren el resultado de la ureasa o la biopsia en el historial, aquí verá si el sistema acertó." })
          : h("div", null,
              h("div", { className: "modelo-metricas" },
                h(Metrica, { titulo: "Detecta infecciones", valor: pct(real.sensibilidad), ayuda: "sensibilidad", tono: "var(--blue-700)" }),
                h(Metrica, { titulo: "Descarta sanos", valor: pct(real.especificidad), ayuda: "especificidad" }),
                h(Metrica, { titulo: "Aciertos", valor: real.aciertos + " / " + real.confirmados, ayuda: pct(real.exactitud) })),
              h("div", { className: "modelo-nota" },
                (real.matriz.fn === 1 ? "1 infección no detectada" : real.matriz.fn + " infecciones no detectadas") + " · " +
                (real.matriz.fp === 1 ? "1 falsa alarma" : real.matriz.fp + " falsas alarmas"))),
      ),

      // ── 2. Versión en uso ───────────────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "2 · Versión en uso"),
        h("div", { className: "modelo-version-actual" },
          h("span", { className: "modelo-version-icono" }, h(I.cube, { size: 18 })),
          h("div", null,
            h("div", { className: "modelo-version-nombre" }, activa ? "Versión reentrenada #" + activa.id : "Modelo original validado"),
            h("div", { className: "modelo-nota", style: { marginTop: 2 } },
              activa ? "Activada el " + fmtFecha(activa.activado_at) + " · umbral " + activa.umbral.toFixed(3)
                     : "ResNet50 de las pruebas experimentales · umbral 0.255"))),
        activa && h("button", { type: "button", className: "btn btn-secondary", style: { marginTop: 12 },
                                onClick: () => accion("/admin/model/restore", "Modelo original restaurado") },
          h(I.refresh, { size: 14 }), "Volver al modelo original"),
      ),

      // ── 3. Datos y reentrenamiento ──────────────────────────────────────
      h("div", { className: "card card-pad" },
        h("div", { className: "section-title" }, "3 · Casos para reentrenar"),
        h("div", { className: "modelo-nota", style: { marginBottom: 12 } },
          "Diagnósticos confirmados, con imagen, de médicos que activaron «Ayudar a mejorar el modelo»."),
        [["Positivos", d.positivos, "var(--red-600)"], ["Negativos", d.negativos, "var(--green-600)"]].map(([t, n, c]) =>
          h("div", { key: t, style: { marginBottom: 10 } },
            h("div", { className: "row between", style: { fontSize: 12.5, marginBottom: 4 } },
              h("span", null, t), h("span", { className: "mono" }, n + " / " + d.minimo_por_clase)),
            h(Barra, { actual: n, minimo: d.minimo_por_clase, color: c }))),

        trabajo.en_curso
          ? h("div", { className: "modelo-progreso", role: "status" },
              h("div", { className: "row", style: { gap: 8 } }, h("span", { className: "spinner-sm" }),
                h("strong", null, trabajo.mensaje || "Reentrenando…")),
              h("div", { className: "progress", style: { marginTop: 8 } },
                h("div", { className: "progress-fill", style: { width: (trabajo.progreso || 0) + "%" } })))
          : h("button", { type: "button", className: "btn btn-primary", style: { marginTop: 6, width: "100%" },
                          disabled: !d.suficiente || lanzando, onClick: reentrenar,
                          title: d.suficiente ? undefined : "Se necesitan al menos " + d.minimo_por_clase + " casos de cada tipo" },
              h(I.refresh, { size: 14 }), lanzando ? "Iniciando…" : "Reentrenar modelo"),
        !d.suficiente && !trabajo.en_curso && h("div", { className: "modelo-nota", style: { marginTop: 8 } },
          "Faltan casos: se necesitan al menos " + d.minimo_por_clase + " positivos y " + d.minimo_por_clase + " negativos confirmados."),
        trabajo.fase === "error" && !trabajo.en_curso && h("div", { className: "alert alert-error", style: { marginTop: 10 } },
          h(I.alert, { size: 14 }), h("div", null, trabajo.error)),
      ),
    ),

    // ── Versiones ─────────────────────────────────────────────────────────
    h("div", { className: "card", style: { marginTop: 20 } },
      h("div", { className: "card-head" },
        h("div", null,
          h("h3", { className: "card-title" }, "Versiones reentrenadas"),
          h("div", { className: "card-sub" }, "Cada versión se compara con la actual en casos que ninguna de las dos usó para aprender."))),
      datos.versiones.length === 0
        ? h(EmptyState, { icon: I.cube, tone: "neutral", compact: true, title: "Aún no hay versiones",
            description: "Cuando haya casos suficientes, pulse «Reentrenar modelo»." })
        : h("div", { className: "modelo-versiones" },
            datos.versiones.map((v) => h("div", { key: v.id, className: "modelo-version" + (v.estado === "activo" ? " is-activa" : "") },
              h("div", { className: "row between", style: { flexWrap: "wrap", gap: 8 } },
                h("div", null,
                  h("div", { className: "modelo-version-nombre" }, "Versión #" + v.id, " ",
                    v.estado === "activo" && h("span", { className: "badge badge-info" }, "En uso"),
                    v.estado === "descartado" && h("span", { className: "badge badge-neutral" }, "Descartada"),
                    v.metricas && v.metricas.recomendada && v.estado !== "descartado" &&
                      h("span", { className: "badge badge-neg", style: { marginLeft: 4 } }, "Recomendada")),
                  h("div", { className: "modelo-nota" },
                    fmtFecha(v.created_at) + " · aprendió de " + v.n_entrenamiento + " casos · evaluada en " + v.n_validacion)),
                v.estado === "candidato" && h("div", { className: "row", style: { gap: 6 } },
                  h("button", { type: "button", className: "btn btn-primary btn-sm",
                                onClick: () => accion("/admin/model/versions/" + v.id + "/activate", "Versión #" + v.id + " activada") },
                    h(I.check, { size: 12 }), "Usar esta versión"),
                  h("button", { type: "button", className: "btn btn-ghost btn-sm",
                                onClick: () => accion("/admin/model/versions/" + v.id + "/discard", "Versión #" + v.id + " descartada") },
                    "Descartar"))),
              v.metricas && v.estado !== "descartado" && h(Comparacion, { m: v.metricas }),
              v.metricas && !v.metricas.recomendada && v.estado === "candidato" && h("div", { className: "alert alert-warn", style: { marginTop: 8 } },
                h(I.alert, { size: 14 }),
                h("div", null, "No se recomienda: en los casos de prueba no mejora o detecta menos infecciones que la versión actual."))))),
    ),
  );
}
