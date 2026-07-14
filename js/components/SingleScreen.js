import { I } from "../icons.js";
import { SAMPLES } from "../samples.js";
import { CONFIG } from "../config.js";
import { predict } from "../api.js";
import { saveStudy } from "../history.js";

const React = window.React;
const { useState, useRef } = React;
const h = React.createElement;

export function SingleScreen({ model, onViewHeatmap, threshold }) {
  const [file,        setFile]        = useState(null);
  const [drag,        setDrag]        = useState(false);
  const [phase,       setPhase]       = useState("idle");
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [patientName, setPatientName] = useState("");   // nombre/ID del paciente (opcional)
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
      const res = await predict(payload, { modelId: model.id, positive, heat, threshold, forceError: opts.forceError });
      clearInterval(iv); setProgress(100); setResult(res); setPhase("done");
      saveStudy(file, res, patientName); // fire-and-forget
    } catch (e) {
      clearInterval(iv); setPhase("error");
      setError({ k: "api", m: "Tiempo de espera agotado. Verifica conexión con " + CONFIG.PREDICT_PATH + "." });
    }
  };

  const reset = () => {
    setFile(null); setResult(null); setPhase("idle");
    setProgress(0); setError(null); setPatientName("");
  };

  const downloadReport = async () => {
    if (!result) return;

    const fecha     = new Date().toLocaleString("es-PE", { dateStyle: "full", timeStyle: "short" });
    const isPos     = result.clase === "Positivo";
    const probPct   = (result.prob * 100).toFixed(1);
    const conf      = result.prob;
    const confLabel = conf >= 0.85 ? "Alta" : conf >= 0.65 ? "Media" : "Baja";
    const colorResult = isPos ? "#dc2626" : "#16a34a";
    const pacienteRow = patientName.trim()
      ? `<tr><td>Paciente</td><td><strong>${patientName.trim()}</strong></td></tr>` : "";

    // ── Construir imagen compuesta (original + heatmap) con Canvas ─────────
    const loadImg = (src) => new Promise((res, rej) => {
      const img = new Image(); img.crossOrigin = "anonymous";
      img.onload = () => res(img); img.onerror = rej; img.src = src;
    });

    let compositeDataUrl = null;
    if (result.heatmap_b64) {
      try {
        const [orig, heat] = await Promise.all([
          loadImg(file.src),
          loadImg(result.heatmap_b64),
        ]);
        const W = 480, H = 360;
        const c = document.createElement("canvas");
        c.width = W; c.height = H;
        const ctx = c.getContext("2d");
        ctx.drawImage(orig, 0, 0, W, H);
        ctx.globalAlpha = 0.65;
        ctx.globalCompositeOperation = "screen";
        ctx.drawImage(heat, 0, 0, W, H);
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
        compositeDataUrl = c.toDataURL("image/jpeg", 0.92);
      } catch { /* si falla el canvas igual generamos el PDF sin composite */ }
    }

    const gradcamSection = compositeDataUrl ? `
  <div class="section" style="margin-top:24px">
    <div class="section-title">Visualización Grad-CAM · Mapa de activación</div>
    <div style="display:flex;gap:16px;align-items:flex-start">
      <div style="flex:1;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-weight:600">IMAGEN ORIGINAL</div>
        <img src="${file.src}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;display:block" />
      </div>
      <div style="flex:1;text-align:center">
        <div style="font-size:10px;color:#64748b;margin-bottom:6px;font-weight:600">GRAD-CAM SUPERPUESTO</div>
        <img src="${compositeDataUrl}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;display:block" />
      </div>
    </div>
    <div style="margin-top:12px;background:#0f172a;border-radius:8px;padding:12px 16px">
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:10px;color:#94a3b8;font-weight:600;white-space:nowrap">Baja activación</span>
        <div style="flex:1;height:10px;border-radius:5px;background:linear-gradient(to right,#2347C5,#16A34A,#FBBF24,#DC2626)"></div>
        <span style="font-size:10px;color:#94a3b8;font-weight:600;white-space:nowrap">Alta activación</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:9px;color:#475569;padding:0 2px">
        <span>0.0</span><span>0.3</span><span>0.6</span><span>1.0</span>
      </div>
    </div>
    <p style="font-size:11px;color:#64748b;margin-top:8px;line-height:1.5">
      El mapa Grad-CAM muestra las regiones que el modelo consideró más relevantes para la clasificación.
      Zonas rojas/amarillas indican alta activación. No implica causalidad diagnóstica — validar con criterio clínico.
    </p>
  </div>` : "";

    const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Informe EndoScan AI</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #fff; padding: 40px; }
    .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #3b82f6; padding-bottom: 16px; margin-bottom: 24px; }
    .logo { font-size: 22px; font-weight: 800; color: #1d4ed8; letter-spacing: -0.5px; }
    .logo span { color: #3b82f6; }
    .subtitle { font-size: 11px; color: #64748b; margin-top: 2px; }
    .meta { font-size: 11px; color: #64748b; text-align: right; }
    .disclaimer { background: #fef9c3; border-left: 4px solid #eab308; padding: 10px 14px; font-size: 11.5px; color: #713f12; margin-bottom: 24px; border-radius: 4px; }
    .section { margin-bottom: 20px; }
    .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
    td:first-child { color: #64748b; width: 40%; }
    td:last-child { font-weight: 500; }
    .result-box { border: 2px solid ${colorResult}; border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; }
    .result-class { font-size: 20px; font-weight: 800; color: ${colorResult}; }
    .result-prob { font-size: 32px; font-weight: 800; color: ${colorResult}; }
    .result-prob-label { font-size: 10px; color: #94a3b8; text-align: right; }
    .warn { background: #fef2f2; border-left: 4px solid #dc2626; padding: 10px 14px; font-size: 11.5px; color: #7f1d1d; margin-top: 16px; border-radius: 4px; }
    .footer { border-top: 1px solid #e2e8f0; padding-top: 12px; font-size: 10px; color: #94a3b8; text-align: center; margin-top: 30px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="logo">Endo<span>Scan</span> AI</div>
      <div class="subtitle">Sistema de detección de H. pylori · Uso académico</div>
    </div>
    <div class="meta">
      <div>Informe de análisis endoscópico</div>
      <div style="margin-top:4px">${fecha}</div>
    </div>
  </div>

  <div class="disclaimer">
    ⚠ <strong>Aviso clínico:</strong> Este resultado es generado por un modelo de IA y tiene carácter orientativo. No sustituye el diagnóstico médico profesional. Confirmar con prueba de ureasa, histología o test del aliento.
  </div>

  <div class="section">
    <div class="section-title">Resultado del análisis</div>
    <div class="result-box">
      <div>
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">CLASE PREDICHA</div>
        <div class="result-class">${result.clase}${isPos ? " · H. pylori" : " · sin hallazgo"}</div>
      </div>
      <div style="text-align:right">
        <div class="result-prob">${probPct}%</div>
        <div class="result-prob-label">P(${result.clase.toLowerCase()})</div>
      </div>
    </div>
  </div>

  <div style="display:flex;gap:24px">
    <div class="section" style="flex:1">
      <div class="section-title">Datos del estudio</div>
      <table>
        ${pacienteRow}
        <tr><td>Archivo</td><td>${file.name}</td></tr>
        <tr><td>Modelo</td><td>${result.modelo || model.name} ${model.version}</td></tr>
        <tr><td>Probabilidad cruda</td><td>${(result.prob * 100).toFixed(2)}%</td></tr>
        <tr><td>Confianza</td><td>${confLabel} (${(conf * 100).toFixed(1)}%)</td></tr>
        <tr><td>Latencia inferencia</td><td>${result.latencia_ms} ms</td></tr>
      </table>
    </div>
    <div class="section" style="flex:1">
      <div class="section-title">Métricas del modelo</div>
      <table>
        <tr><td>Accuracy</td><td>${model.metrics ? (model.metrics.accuracy * 100).toFixed(2) + "%" : "—"}</td></tr>
        <tr><td>Sensibilidad</td><td>${model.metrics ? (model.metrics.sensitivity * 100).toFixed(2) + "%" : "—"}</td></tr>
        <tr><td>Especificidad</td><td>${model.metrics ? (model.metrics.specificity * 100).toFixed(2) + "%" : "—"}</td></tr>
        <tr><td>AUC-ROC</td><td>${model.metrics ? model.metrics.auc.toFixed(4) : "—"}</td></tr>
      </table>
    </div>
  </div>

  ${gradcamSection}

  ${isPos ? `<div class="warn" style="margin-top:16px"><strong>Hallazgo positivo sugerido.</strong> Se recomienda correlacionar con clínica y realizar pruebas confirmatorias antes de iniciar tratamiento erradicador.</div>` : ""}

  <div class="footer">
    EndoScan AI · Taller Integrador · ${new Date().getFullYear()} · Generado automáticamente — no válido como documento médico oficial
  </div>
</body>
</html>`;

    const w = window.open("", "_blank", "width=860,height=1000");
    if (!w) { alert("Permite las ventanas emergentes para generar el PDF."); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 700);
  };

  const positive = result && result.clase === "Positivo";
  const probShown = result ? result.prob : 0;
  const conf = result ? result.prob : 0;
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
            // ── Campo de paciente ────────────────────────────────────────────
            h("div", { style: { marginTop: 14 } },
              h("label", { style: { fontSize: 11.5, fontWeight: 600, color: "var(--ink-500)", textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 5 } },
                "Paciente ", h("span", { style: { fontWeight: 400, textTransform: "none" } }, "(opcional)"),
              ),
              h("input", {
                type: "text",
                value: patientName,
                onChange: (e) => setPatientName(e.target.value),
                placeholder: "Nombre o ID del paciente — ej. Juan Quispe / PAC-042",
                disabled: phase === "loading",
                style: {
                  width: "100%", boxSizing: "border-box",
                  padding: "8px 12px", fontSize: 13,
                  border: "1px solid var(--ink-200)", borderRadius: 8,
                  outline: "none", fontFamily: "inherit",
                  background: phase === "loading" ? "var(--ink-50)" : "var(--white)",
                },
              }),
            ),
            h("div", { className: "row between", style: { marginTop: 12 } },
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
              h("button", { className: "btn btn-secondary", onClick: downloadReport }, h(I.dl, { size: 14 }), "Descargar informe PDF"),
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
