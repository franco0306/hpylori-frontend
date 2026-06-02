import { I } from "../icons.js";
import { SAMPLES } from "../samples.js";
import { CONFIG } from "../config.js";
import { predict } from "../api.js";
import { saveStudy } from "../history.js";

const React = window.React;
const { useState, useRef } = React;
const h = React.createElement;

export function SingleScreen({ model, onViewHeatmap }) {
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  const accept = (f) => {
    setError(null); setResult(null); setPhase("idle");
    if (!f) return;
    if (!CONFIG.ACCEPTED_MIME.includes(f.type)) {
      setError({ k: "format", m: "Formato no admitido. Use JPG o PNG." }); return;
    }
    if (f.size > CONFIG.MAX_FILE_MB * 1024 * 1024) {
      setError({ k: "size", m: `El archivo supera ${CONFIG.MAX_FILE_MB} MB.` }); return;
    }
    const r = new FileReader();
    r.onload = () => setFile({ name: f.name, size: f.size, src: r.result, type: f.type, _raw: f });
    r.readAsDataURL(f);
  };

  const useSample = (k) => {
    setError(null); setResult(null); setPhase("idle");
    setFile({ name: SAMPLES[k].name, size: SAMPLES[k].size * 1024 * 1024, src: SAMPLES[k].src, type: "image/jpeg", _s: k });
  };

  const analyze = async (opts = {}) => {
    setPhase("loading"); setProgress(0); setError(null); setResult(null);
    const t0 = Date.now();
    const targetMs = model.metrics.latency_ms;
    const iv = setInterval(() => {
      setProgress(Math.min(95, Math.round((Date.now() - t0) / targetMs * 100)));
    }, 80);
    try {
      const positive = file._s ? file._s.startsWith("pos") : undefined;
      const heat = file._s ? SAMPLES[file._s].heat : null;
      // Si hay un File real lo enviamos; si es muestra, mandamos el objeto con `src`.
      const payload = file._raw || file;
      const res = await predict(payload, { modelId: model.id, positive, heat, forceError: opts.forceError });
      clearInterval(iv); setProgress(100); setResult(res); setPhase("done");
      saveStudy(file, res); // fire-and-forget
    } catch (e) {
      clearInterval(iv); setPhase("error");
      setError({ k: "api", m: "Tiempo de espera agotado. Verifica conexión con " + CONFIG.PREDICT_PATH + "." });
    }
  };

  const reset = () => {
    setFile(null); setResult(null); setPhase("idle"); setProgress(0); setError(null);
  };

  const positive = result && result.clase === "Positivo";
  const probShown = result ? (positive ? result.prob : 1 - result.prob) : 0;
  const conf = result ? Math.max(result.prob, 1 - result.prob) : 0;
  const confTier = conf >= 0.85
    ? { l: "alta",  c: "var(--green-600)" }
    : conf >= 0.65
      ? { l: "media", c: "var(--amber-600)" }
      : { l: "baja",  c: "var(--red-600)" };

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Análisis individual"),
        h("div", { className: "page-sub" },
          "HU-001 · Inferencia con ", h("strong", null, model.name), " · objetivo < 2 000 ms",
        ),
      ),
      h("button", { className: "btn btn-ghost", onClick: reset, disabled: phase === "loading" },
        h(I.refresh, { size: 14 }), "Reiniciar"),
    ),
    h("div", { style: { display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20 } },
      // ===== LEFT =====
      h("div", { className: "card" },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "1 · Imagen endoscópica"),
            h("div", { className: "card-sub" }, "JPG/PNG · máx. 10 MB · resolución ≥ 512×512 px"),
          ),
          file && phase !== "loading" && h("button", {
            className: "btn btn-ghost btn-icon",
            onClick: reset, title: "Quitar",
          }, h(I.trash, { size: 14 })),
        ),
        h("div", { className: "card-pad" },
          !file ? h("div", null,
            h("div", {
              "data-dropzone": true,
              className: "dropzone" + (drag ? " active" : ""),
              onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setDrag(true); },
              onDragLeave: (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setDrag(false); },
              onDrop: (e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); accept(e.dataTransfer.files && e.dataTransfer.files[0]); },
              onClick: () => inputRef.current && inputRef.current.click(),
              role: "button",
            },
              h("div", { className: "dropzone-icon" }, h(I.upload, { size: 22 })),
              h("div", { className: "dropzone-title" }, "Arrastra una imagen aquí"),
              h("div", { className: "dropzone-sub" },
                "o ", h("span", { className: "linklike" }, "selecciona un archivo")),
              h("input", {
                ref: inputRef, type: "file",
                accept: "image/jpeg,image/png", hidden: true,
                onChange: (e) => accept(e.target.files && e.target.files[0]),
              }),
            ),
            h("div", { style: { marginTop: 16 } },
              h("div", { className: "row between", style: { marginBottom: 8 } },
                h("div", { className: "section-title", style: { marginBottom: 0 } }, "O usa una muestra de prueba"),
                h("div", { className: "row", style: { gap: 6 } },
                  h("span", { className: "badge badge-pos" }, "5 positivos"),
                  h("span", { className: "badge badge-neg" }, "5 negativos"),
                ),
              ),
              h("div", { style: { display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 } },
                Object.entries(SAMPLES).map(([k, s]) =>
                  h("button", {
                    key: k, className: "btn btn-secondary",
                    onClick: () => useSample(k),
                    style: { justifyContent: "flex-start", padding: "6px 8px", gap: 6, flexDirection: "column", alignItems: "flex-start" },
                  },
                    h("img", { src: s.src, style: { width: "100%", height: 56, borderRadius: 4, objectFit: "cover" }, alt: "" }),
                    h("div", { style: { fontSize: 10, fontWeight: 600, lineHeight: 1.2, width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
                      s.name.replace(".jpg", ""),
                    ),
                    h("div", { style: { fontSize: 10, fontWeight: 700, color: k.startsWith("pos") ? "var(--red-600)" : "var(--green-600)" } },
                      s.label,
                    ),
                  )
                ),
              ),
            ),
          ) : h("div", null,
            h("div", { className: "preview-wrap" },
              h("img", { src: file.src, alt: file.name }),
              h("div", { className: "preview-chip" },
                file.name + " · " + (file.size / 1024 / 1024).toFixed(2) + " MB"),
            ),
            h("div", { className: "row between", style: { marginTop: 16 } },
              h("span", { className: "badge badge-info" }, "Modelo: " + model.name),
              h("div", { className: "row", style: { gap: 8 } },
                h("button", { className: "btn btn-secondary", onClick: reset, disabled: phase === "loading" },
                  h(I.x, { size: 14 }), "Cambiar"),
                h("button", {
                  className: "btn btn-primary",
                  onClick: () => analyze(),
                  disabled: phase === "loading",
                },
                  phase === "loading" ? h("span", { className: "spinner-sm" }) : h(I.bact, { size: 14 }),
                  phase === "loading" ? " Analizando…" : " Analizar imagen",
                ),
              ),
            ),
          ),
          error && h("div", { className: "alert alert-error", style: { marginTop: 16 } },
            h(I.alert, { size: 16 }),
            h("div", null,
              h("strong", null,
                error.k === "format" ? "Formato inválido"
                  : error.k === "size" ? "Tamaño excedido"
                  : "Error de inferencia"),
              h("div", { style: { marginTop: 2 } }, error.m),
              error.k === "api" && h("button", {
                className: "btn btn-secondary",
                style: { marginTop: 8 },
                onClick: () => analyze(),
              }, h(I.refresh, { size: 12 }), "Reintentar"),
            ),
          ),
          file && phase === "idle" && h("div", { style: { marginTop: 12, fontSize: 11.5, color: "var(--ink-500)" } },
            "Demo: ",
            h("span", { className: "linklike", onClick: () => analyze({ forceError: true }) }, "simular timeout API"),
          ),
        ),
      ),

      // ===== RIGHT =====
      h("div", { className: "card" },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "2 · Resultado del modelo"),
            h("div", { className: "card-sub" }, model.name + " " + model.version + " · " + model.arch),
          ),
          result && h("span", { className: "badge " + (positive ? "badge-pos" : "badge-neg") },
            result.clase.toUpperCase()),
        ),
        h("div", { className: "card-pad" },
          phase === "idle" && !result && h("div", { className: "result-empty" },
            h(I.bact, { size: 32 }),
            h("div", null, h("strong", null, "Sin resultados aún")),
            h("div", { style: { maxWidth: 280, fontSize: 12.5 } }, "Carga una imagen y presiona Analizar."),
          ),
          phase === "loading" && h("div", { style: { textAlign: "center", padding: "20px 0" } },
            h("div", { className: "spinner" }),
            h("div", { style: { fontWeight: 600 } }, "Procesando con " + model.name + "…"),
            h("div", { className: "muted", style: { fontSize: 12.5, marginTop: 4 } },
              "Pre-procesamiento → forward pass → Grad-CAM"),
            h("div", { className: "progress", style: { marginTop: 16 } },
              h("div", { className: "progress-fill", style: { width: progress + "%" } })),
            h("div", { className: "row between", style: { marginTop: 8, fontSize: 11.5, color: "var(--ink-500)" } },
              h("span", { className: "mono" }, progress + "%"),
              h("span", { className: "mono" }, "objetivo < 2.0 s"),
            ),
          ),
          phase === "done" && result && h("div", null,
            h("div", { className: "verdict " + (positive ? "verdict-pos" : "verdict-neg") },
              h("div", null,
                h("div", { className: "verdict-label" }, "Clase predicha"),
                h("div", {
                  className: "verdict-value",
                  style: { color: positive ? "var(--red-600)" : "var(--green-600)" },
                }, result.clase + (positive ? " · H. pylori" : " · sin hallazgo")),
              ),
              h("div", { style: { textAlign: "right" } },
                h("div", {
                  className: "verdict-prob",
                  style: { color: positive ? "var(--red-600)" : "var(--green-600)" },
                }, (probShown * 100).toFixed(1) + "%"),
                h("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-500)" } },
                  "P(" + result.clase.toLowerCase() + ")"),
              ),
            ),
            h("div", { style: { marginTop: 16 } },
              h("div", { className: "row between", style: { marginBottom: 6 } },
                h("span", { className: "section-title", style: { marginBottom: 0 } }, "Confianza"),
                h("span", {
                  className: "badge",
                  style: { background: "var(--ink-100)", color: confTier.c },
                }, h(I.shield, { size: 10 }), " Confianza " + confTier.l),
              ),
              h("div", { className: "confbar" },
                h("div", { className: "confbar-fill", style: { width: (conf * 100) + "%", background: confTier.c } })),
            ),
            h("div", { className: "metrics", style: { marginTop: 16 } },
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Probabilidad"),
                h("div", { className: "metric-value" }, (result.prob * 100).toFixed(2), h("small", null, "%"))),
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Latencia"),
                h("div", {
                  className: "metric-value",
                  style: { color: result.latencia_ms < 2000 ? "var(--ink-900)" : "var(--red-600)" },
                }, result.latencia_ms, h("small", null, "ms"))),
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Modelo"),
                h("div", { className: "metric-value", style: { fontSize: 13 } }, model.version)),
            ),
            positive && h("div", { className: "alert alert-warn", style: { marginTop: 14 } },
              h(I.info, { size: 16 }),
              h("div", null,
                h("strong", null, "Hallazgo positivo sugerido. "),
                "Confirmar con prueba de ureasa, histología o test del aliento. Verifica el Grad-CAM antes de comunicar al paciente.",
              ),
            ),
            h("div", { className: "row", style: { marginTop: 16, gap: 8 } },
              h("button", { className: "btn btn-secondary" }, h(I.dl, { size: 14 }), "Descargar informe PDF"),
              h("button", {
                className: "btn btn-ghost",
                onClick: () => onViewHeatmap && onViewHeatmap(result, file),
              }, h(I.heat, { size: 14 }), "Ver Grad-CAM"),
            ),
          ),
        ),
      ),
    ),
  );
}
