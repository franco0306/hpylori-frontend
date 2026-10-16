import { AnimatePresence, motion } from "framer-motion";
import { I } from "../icons.js";
import { fmtLatencia } from "../format.js";
import { SAMPLES } from "../samples.js";
import { CONFIG } from "../config.js";
import { predict } from "../api.js";
import { saveStudy } from "../history.js";
import { EmptyState, ScanLoader } from "../ui/states.jsx";
import { AnimatedNumber } from "../ui/cards.jsx";
import { toast } from "../ui/toast.jsx";
import { cacheStudyMedia } from "../sessionCache.js";
import { PatientPicker, codigoPaciente } from "./PatientPicker.jsx";
import { validarCodigoPaciente } from "../validacion.js";

const React = window.React;
const { useState, useRef } = React;
const h = React.createElement;

// Desde aqui se explica la espera. Cuatro segundos es mas de lo que tarda una
// inferencia normal (~1 s) y menos de lo que la gente aguanta sin explicacion.
const TIEMPO_AVISO_ESPERA_MS = 4000;

/**
 * Traduce el fallo de una inferencia en su causa real.
 *
 * El mensaje anterior era siempre "tiempo de espera agotado", tambien cuando el
 * servidor habia rechazado el formato o devuelto un 500. Un aviso que miente
 * sobre la causa hace perder mas tiempo del que ahorra.
 */
function describirFalloPredict(err) {
  const estado = err && err.estado;

  if (err && err.message === "API_TIMEOUT") {
    return "El servidor no respondió a tiempo. Si es el primer análisis tras un " +
           "rato de inactividad, el motor tarda en arrancar: inténtelo otra vez.";
  }
  if (err && err.message === "INVALID_FILE") {
    return "No se pudo leer la imagen seleccionada. Pruebe con otro archivo.";
  }
  if (estado === 413) return "La imagen supera el máximo de 10 MB.";
  if (estado === 415) return "Formato no soportado. Use una imagen JPG o PNG.";
  if (estado === 429) {
    return "Demasiadas solicitudes seguidas. Espere unos segundos y reintente.";
  }
  if (estado >= 500) {
    return "El servidor de análisis respondió con un error (HTTP " + estado + "). " +
           "Inténtelo de nuevo en unos momentos.";
  }
  return "No se pudo contactar con el servidor de análisis. Compruebe su conexión.";
}


export function SingleScreen({ model, onViewHeatmap }) {
  const [file,        setFile]        = useState(null);
  const [drag,        setDrag]        = useState(false);
  const [phase,       setPhase]       = useState("idle");
  const [progress,    setProgress]    = useState(0);
  const [result,      setResult]      = useState(null);
  const [error,       setError]       = useState(null);
  const [patientName, setPatientName] = useState("");   // código de historia clínica escrito
  const [pacienteSel, setPacienteSel] = useState(null);   // paciente elegido en el buscador
  // El guardado en el historial no puede fallar en silencio: el médico tiene
  // que saber que ese análisis no quedó registrado.
  const [historialFallo, setHistorialFallo] = useState(null);   // { estado, detalle }
  // El motor vive en un contenedor que se duerme; la primera peticion tras un
  // rato de inactividad tarda. Pasados unos segundos se explica, en vez de
  // dejar una barra avanzando sin decir por que.
  const [esperaLarga, setEsperaLarga] = useState(false);
  const [reintentando, setReintentando] = useState(false);
  // Vista de la imagen tras el análisis: original o con el mapa Grad-CAM.
  const [vista, setVista] = useState("original");
  const inputRef = useRef(null);
  const pacienteRef = useRef(null);

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
    // El código se valida ANTES de gastar una inferencia: si se rechazara al
    // guardar, el médico vería un resultado que no queda en el historial.
    // Obligatorio: sin paciente el estudio no se puede agrupar ni rastrear.
    const motivoPaciente = patientName.trim()
      ? validarCodigoPaciente(patientName)
      : "Indique el código de historia clínica del paciente. Si no tiene, use «Generar código anónimo».";
    if (motivoPaciente) {
      setError({ k: "paciente", m: motivoPaciente });
      if (pacienteRef.current) pacienteRef.current.focus();
      return;
    }
    setPhase("loading"); setProgress(0); setError(null); setResult(null); setVista("original");
    setEsperaLarga(false); setReintentando(false);
    const avisoLento = setTimeout(() => setEsperaLarga(true), TIEMPO_AVISO_ESPERA_MS);
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
      // Sin `modelId`: la capa de API fija ResNet50 para toda la interfaz clínica.
      const res = await predict(payload, {
        positive, heat, forceError: opts.forceError,
        onReintento: () => setReintentando(true),
      });
      clearInterval(iv); clearTimeout(avisoLento);
      setEsperaLarga(false); setReintentando(false);
      setProgress(100); setResult(res); setPhase("done");
      // Guardamos el estudio y retenemos su imagen en memoria: el backend solo
      // persiste metadatos, así que esta es la única copia mientras dure la sesión.
      setHistorialFallo(null);
      const codigo = codigoPaciente(patientName, pacienteSel);
      saveStudy(res, codigo)
        .then((saved) => {
          if (!saved || !saved.id) return;   // early return
          toast.success("Estudio guardado en el historial",
            (res.clase === "Positivo" ? "Resultado positivo" : "Resultado negativo") +
            (codigo ? " · Paciente " + codigo.toUpperCase() : ""));
          // La caché de sesión es accesoria: si falla no debe hacerse pasar por
          // un fallo de guardado, que es un aviso mucho más grave.
          try {
            cacheStudyMedia(saved.id, {
              src: file.src,
              heatmap_b64: res.heatmap_b64 || null,
              name: file.name,
            });
          } catch { /* noop */ }
        })
        // El historial nunca bloquea el diagnóstico, pero su fallo se avisa.
        .catch((err) => setHistorialFallo({
          estado: err && err.estado,
          detalle: (err && err.detalle) || null,
        }));
    } catch (e) {
      clearInterval(iv); clearTimeout(avisoLento);
      setEsperaLarga(false); setReintentando(false);
      setPhase("error");
      // Antes cualquier fallo se anunciaba como "tiempo de espera agotado",
      // incluido un 415 o un 500: el mensaje ocultaba la causa real.
      setError({ k: "api", m: describirFalloPredict(e) });
    }
  };


  const reset = () => {
    setFile(null); setResult(null); setPhase("idle"); setVista("original");
    setProgress(0); setError(null); setPatientName(""); setPacienteSel(null); setHistorialFallo(null);
  };

  const downloadReport = async () => {
    if (!result) return;

    const fecha     = new Date().toLocaleString("es-PE", { dateStyle: "full", timeStyle: "short" });
    const isPos     = result.clase === "Positivo";
    const probPct   = (result.prob * 100).toFixed(1);
    const conf      = result.prob;
    const confLabel = conf >= 0.85 ? "Alta" : conf >= 0.65 ? "Media" : "Baja";
    const colorResult = isPos ? "#dc2626" : "#16a34a";
    const pacienteId  = codigoPaciente(patientName, pacienteSel).toUpperCase();
    const pacienteRow = pacienteId
      ? `<tr><td>ID Paciente / HC</td><td><strong>${pacienteId}</strong></td></tr>` : "";

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
      ${pacienteId ? `<div style="margin-top:4px"><strong>Paciente:</strong> ${pacienteId}</div>` : ""}
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
        <div style="font-size:11px;color:#64748b;margin-bottom:4px">DIAGNÓSTICO SUGERIDO</div>
        <div class="result-class">${isPos ? "Sospecha de infección por H. pylori" : "Mucosa sin hallazgos patológicos"}</div>
      </div>
      <div style="text-align:right">
        <div class="result-prob">${probPct}%</div>
        <div class="result-prob-label">Probabilidad</div>
      </div>
    </div>
  </div>

  <div style="display:flex;gap:24px">
    <div class="section" style="width:190px;flex-shrink:0">
      <div class="section-title">Imagen analizada</div>
      <img src="${file.src}" style="width:100%;border-radius:8px;border:1px solid #e2e8f0;display:block" />
    </div>
    <div class="section" style="flex:1">
      <div class="section-title">Datos del estudio</div>
      <table>
        ${pacienteRow}
        <tr><td>Archivo</td><td>${file.name}</td></tr>
        <tr><td>Modelo</td><td>${result.modelo || model.name} ${model.version}</td></tr>
        <tr><td>Probabilidad cruda</td><td>${(result.prob * 100).toFixed(2)}%</td></tr>
        <tr><td>Confianza</td><td>${confLabel} (${(conf * 100).toFixed(1)}%)</td></tr>
        <tr><td>Tiempo de análisis</td><td>${fmtLatencia(result.latencia_ms)} ms</td></tr>
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
  // Redacción clínica del veredicto: el médico lee un hallazgo, no una clase.
  const diagnosis = positive
    ? "Sospecha de infección por H. pylori"
    : "Mucosa sin hallazgos patológicos";
  const probShown = result ? result.prob : 0;
  const conf = result ? result.prob : 0;
  const confTier = conf >= 0.85
    ? { l: "alta",  c: "var(--green-600)" }
    : conf >= 0.65
      ? { l: "media", c: "var(--amber-600)" }
      : { l: "baja",  c: "var(--red-600)" };

  const cargando = phase === "loading";
  const hayGradcam = Boolean(result && result.heatmap_b64);
  const mostrarGradcam = hayGradcam && vista === "gradcam";

  // Paso actual del flujo: 0 imagen · 1 análisis · 2 resultado.
  const pasoActual = !file ? 0 : result ? 2 : 1;
  const PASOS = [
    { t: "Imagen", d: file ? file.name : "Cargue o elija una muestra" },
    { t: "Análisis", d: cargando ? "En curso…" : result ? "Completado" : file ? "Listo para iniciar" : "Pendiente" },
    { t: "Resultado", d: result ? (positive ? "Positivo" : "Negativo") : "Pendiente" },
  ];

  // Subpasos que se muestran mientras el modelo trabaja.
  const SUBPASOS = [
    { t: "Imagen validada", d: "Formato y tamaño correctos", hecho: true },
    { t: "Clasificando con ResNet50", d: "Análisis de la mucosa gástrica", hecho: progress >= 60 },
    { t: "Generando mapa Grad-CAM", d: "Regiones que influyen en la decisión", hecho: false },
  ];
  const subpasoActivo = progress < 60 ? 1 : 2;

  return h("div", { className: "content analisis" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Análisis individual"),
        h("div", { className: "page-sub" },
          "Análisis asistido de mucosa gástrica en tiempo real",
        ),
      ),
      h("button", { className: "btn btn-secondary", onClick: reset, disabled: cargando || (!file && !result) },
        h(I.refresh, { size: 14 }), "Nuevo análisis"),
    ),

    // ── Progreso del flujo ────────────────────────────────────────────────────
    h("ol", { className: "flujo", "aria-label": "Progreso del análisis" },
      PASOS.map((p, i) => {
        const estado = i < pasoActual || (i === 2 && result) ? "hecho"
          : i === pasoActual ? (cargando && i === 1 ? "en-curso" : "actual") : "pendiente";
        return h("li", { key: p.t, className: "flujo-paso is-" + estado,
                         "aria-current": i === pasoActual ? "step" : undefined },
          h("span", { className: "flujo-num" },
            estado === "hecho" ? h(I.check, { size: 13 }) : i + 1),
          h("span", { className: "flujo-txt" },
            h("span", { className: "flujo-titulo" }, p.t),
            h("span", { className: "flujo-desc" }, p.d)),
          i < PASOS.length - 1 && h("span", { className: "flujo-linea", "aria-hidden": true },
            h(motion.span, {
              className: "flujo-linea-fill",
              initial: false,
              animate: { scaleX: i < pasoActual ? 1 : (cargando && i === 1 ? 0.5 : 0) },
              transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
            })),
        );
      }),
    ),

    h("div", { className: "analisis-grid" },
      // ===== IZQUIERDA: imagen =====
      h("div", { className: "card" },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "Imagen endoscópica"),
            h("div", { className: "card-sub" }, "JPG o PNG · hasta 10 MB · resolución ≥ 512×512 px"),
          ),
          file && !cargando && h("button", {
            className: "btn btn-ghost btn-icon",
            onClick: reset, title: "Quitar imagen", "aria-label": "Quitar imagen",
          }, h(I.trash, { size: 14 })),
        ),
        h("div", { className: "card-pad" },
          // Identificador del paciente: se captura antes de cargar la imagen
          // para que quede asociado al estudio desde el primer momento.
          h("div", { className: "paciente-campo" },
            h("label", { className: "field-label", htmlFor: "patient-id" },
              "ID Paciente / Historia Clínica ",
              h("span", { className: "field-required", "aria-hidden": true }, "*"),
            ),
            h(PatientPicker, {
              inputId: "patient-id",
              value: patientName,
              onTextChange: (v) => { setPatientName(v); if (error && error.k === "paciente") setError(null); },
              selected: pacienteSel,
              onSelect: setPacienteSel,
              disabled: cargando,
              describedBy: "patient-id-ayuda",
              inputRef: pacienteRef,
              error: error && error.k === "paciente" && !patientName.trim() ? error.m : null,
            }),
            h("div", { id: "patient-id-ayuda", className: "paciente-ayuda" },
              h(I.shield, { size: 11 }), "Obligatorio. Busque o escriba el código; no use nombres ni DNI (Ley N.° 29733)."),
          ),

          !file ? h("div", null,
            h("div", {
              "data-dropzone": true,
              className: "dropzone dropzone-compacta" + (drag ? " active" : ""),
              onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setDrag(true); },
              onDragLeave: (e) => { if (e.currentTarget.contains(e.relatedTarget)) return; setDrag(false); },
              onDrop: (e) => { e.preventDefault(); e.stopPropagation(); setDrag(false); accept(e.dataTransfer.files && e.dataTransfer.files[0]); },
              onClick: () => inputRef.current && inputRef.current.click(),
              onKeyDown: (e) => { if ((e.key === "Enter" || e.key === " ") && inputRef.current) { e.preventDefault(); inputRef.current.click(); } },
              role: "button",
              tabIndex: 0,
              "aria-label": "Cargar imagen endoscópica: arrastre un archivo o pulse para seleccionarlo",
            },
              h("div", { className: "dropzone-icon" }, h(I.upload, { size: 22 })),
              h("div", { className: "dropzone-title" }, drag ? "Suelte la imagen aquí" : "Arrastra una imagen aquí"),
              h("div", { className: "dropzone-sub", style: { marginBottom: 0 } },
                "o ", h("span", { className: "linklike" }, "selecciona un archivo")),
              h("input", {
                ref: inputRef, type: "file",
                accept: "image/jpeg,image/png", hidden: true,
                "aria-label": "Seleccionar imagen endoscópica",
                onChange: (e) => accept(e.target.files && e.target.files[0]),
              }),
            ),
            h("div", { className: "muestras" },
              h("div", { className: "row between", style: { marginBottom: 10 } },
                h("div", { className: "section-title", style: { marginBottom: 0 } }, "¿Sin imagen a mano? Use una muestra"),
                h("div", { className: "row", style: { gap: 6 } },
                  h("span", { className: "badge badge-pos" }, "5 positivos"),
                  h("span", { className: "badge badge-neg" }, "5 negativos"),
                ),
              ),
              h("div", { className: "muestras-grid" },
                Object.entries(SAMPLES).map(([k, s]) => {
                  const esPos = k.startsWith("pos");
                  return h("button", {
                    key: k, type: "button", className: "muestra",
                    onClick: () => useSample(k),
                    title: s.name + " · " + s.label,
                    "aria-label": "Usar muestra " + s.name + " (" + s.label.toLowerCase() + ")",
                  },
                    h("img", { src: s.src, alt: "", loading: "lazy" }),
                    h("span", { className: "muestra-etiqueta " + (esPos ? "is-pos" : "is-neg") },
                      esPos ? "Positivo" : "Negativo"),
                    h("span", { className: "muestra-nombre" }, s.name.replace(".jpg", "")),
                  );
                }),
              ),
            ),
          ) : h("div", null,
            // Mientras el modelo trabaja, el escáner recorre la MISMA imagen: no
            // se duplica en el otro panel.
            cargando
              ? h(ScanLoader, { src: file.src, alt: "Imagen en análisis" })
              : h("div", { className: "preview-wrap" },
                  h(AnimatePresence, { initial: false, mode: "wait" },
                    h(motion.img, {
                      key: mostrarGradcam ? "gradcam" : "original",
                      src: mostrarGradcam ? result.heatmap_b64 : file.src,
                      alt: mostrarGradcam ? "Mapa Grad-CAM sobre la imagen" : file.name,
                      initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 },
                      transition: { duration: 0.25 },
                    })),
                  h("div", { className: "preview-chip" },
                    file.name + " · " + (file.size / 1024 / 1024).toFixed(2) + " MB"),
                  hayGradcam && h("div", { className: "preview-toggle", role: "group", "aria-label": "Vista de la imagen" },
                    ["original", "gradcam"].map((v) => h("button", {
                      key: v, type: "button",
                      className: "preview-toggle-btn" + (vista === v ? " is-activo" : ""),
                      "aria-pressed": vista === v,
                      onClick: () => setVista(v),
                    }, v === "original" ? "Original" : "Grad-CAM"))),
                ),

            // Acciones: la principal destaca; "Cambiar" queda como secundaria.
            !result && h("div", { className: "analisis-acciones" },
              h("button", { className: "btn btn-secondary", onClick: reset, disabled: cargando },
                h(I.x, { size: 14 }), "Cambiar"),
              h("button", {
                className: "btn btn-primary btn-analizar",
                onClick: () => analyze(),
                disabled: cargando,
              },
                cargando ? h("span", { className: "spinner-sm spinner-claro" }) : h(I.bact, { size: 15 }),
                cargando ? " Analizando…" : " Analizar imagen",
              ),
            ),
          ),

          // Los avisos del paciente ya salen bajo su campo: no se duplican aquí.
          error && error.k !== "paciente" && h("div", { className: "alert alert-error", style: { marginTop: 16 } },
            h(I.alert, { size: 16 }),
            h("div", null,
              h("strong", null,
                error.k === "format" ? "Formato inválido"
                  : error.k === "size" ? "Tamaño excedido"
                  : error.k === "paciente" ? "Revise el código de paciente"
                  : "Error de inferencia"),
              h("div", { style: { marginTop: 2 } }, error.m),
              error.k === "api" && h("button", {
                className: "btn btn-secondary",
                style: { marginTop: 8 },
                onClick: () => analyze(),
              }, h(I.refresh, { size: 12 }), "Reintentar"),
            ),
          ),
          // Solo en desarrollo: simular un fallo del servidor.
          import.meta.env.DEV && file && phase === "idle" && h("div", { style: { marginTop: 12, fontSize: 11.5, color: "var(--ink-500)" } },
            "Demo: ",
            h("span", { className: "linklike", onClick: () => analyze({ forceError: true }) }, "simular timeout API"),
          ),
        ),
      ),

      // ===== DERECHA: resultado =====
      h("div", { className: "card analisis-resultado" },
        h("div", { className: "card-head" },
          h("div", null,
            h("h3", { className: "card-title" }, "Resultado del análisis"),
            h("div", { className: "card-sub" }, "Diagnóstico sugerido por IA · requiere validación clínica"),
          ),
          result && h("span", { className: "badge " + (positive ? "badge-pos" : "badge-neg") },
            positive ? "POSITIVO" : "NEGATIVO"),
        ),
        h("div", { className: "card-pad" },

          // Sin imagen: guía de uso en vez de un hueco vacío.
          !file && !result && !cargando && h("div", { className: "guia" },
            h("div", { className: "guia-titulo" }, "Cómo funciona"),
            [
              { i: I.upload, t: "Cargue la imagen", d: "Arrastre una endoscopía o use una muestra de prueba." },
              { i: I.bact,   t: "Analice con IA",   d: "ResNet50 clasifica la mucosa en unos segundos." },
              { i: I.heat,   t: "Revise el Grad-CAM", d: "Compruebe qué regiones sustentan el resultado." },
            ].map((g, k) => h(motion.div, {
              key: g.t, className: "guia-paso",
              initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 },
              transition: { delay: 0.08 * k, duration: 0.35 },
            },
              h("span", { className: "guia-icono" }, h(g.i, { size: 17 })),
              h("div", null,
                h("div", { className: "guia-paso-titulo" }, (k + 1) + ". " + g.t),
                h("div", { className: "guia-paso-desc" }, g.d)),
            )),
            h("div", { className: "guia-nota" },
              h(I.info, { size: 13 }),
              "El resultado es orientativo y no reemplaza la confirmación por ureasa, histología o test del aliento."),
          ),

          // Imagen cargada, aún sin analizar.
          file && phase === "idle" && !result && h(EmptyState, {
            icon: I.bact,
            title: "Imagen lista para analizar",
            description: "Pulse «Analizar imagen» para obtener el diagnóstico sugerido y su mapa Grad-CAM.",
            compact: true,
          }),

          // Fallo: el detalle está junto a la imagen; aquí, cómo seguir.
          phase === "error" && !result && h(EmptyState, {
            icon: I.alert, tone: "warn", compact: true,
            title: "No se pudo completar el análisis",
            description: "Revise el aviso junto a la imagen y vuelva a intentarlo.",
            action: h("button", { className: "btn btn-secondary", onClick: () => analyze() },
              h(I.refresh, { size: 14 }), "Reintentar"),
          }),

          // En curso: subpasos con su estado.
          cargando && h("div", { className: "progreso-analisis", role: "status", "aria-live": "polite" },
            h("div", { className: "progreso-titulo" },
              reintentando ? "Reintentando el análisis…" : "Analizando imagen endoscópica…"),
            h("ul", { className: "subpasos" },
              SUBPASOS.map((s, k) => {
                const estado = s.hecho ? "hecho" : k === subpasoActivo ? "activo" : "pendiente";
                return h("li", { key: s.t, className: "subpaso is-" + estado },
                  h("span", { className: "subpaso-marca" },
                    estado === "hecho" ? h(I.check, { size: 12 })
                      : estado === "activo" ? h("span", { className: "spinner-sm" }) : null),
                  h("div", null,
                    h("div", { className: "subpaso-titulo" }, s.t),
                    h("div", { className: "subpaso-desc" }, s.d)),
                );
              })),
            h("div", { className: "progress", style: { marginTop: 18 } },
              h("div", { className: "progress-fill", style: { width: progress + "%" } })),
            h("div", { className: "row between", style: { marginTop: 8, fontSize: 11.5, color: "var(--ink-500)" } },
              h("span", { className: "mono" }, progress + "%"),
              h("span", null, esperaLarga ? "El motor se está activando…" : "Suele tardar unos segundos"),
            ),
            (esperaLarga || reintentando) && h("div", { className: "alert alert-info", style: { marginTop: 14, textAlign: "left" } },
              h(I.info, { size: 14 }),
              h("div", null,
                "El servidor de análisis estaba en reposo y se está iniciando. ",
                "La primera petición tras un rato de inactividad puede tardar cerca de un minuto.")),
          ),

          phase === "done" && result && h(motion.div, {
            initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 },
            transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] },
          },
            h("div", { className: "verdict " + (positive ? "verdict-pos" : "verdict-neg") },
              h("div", null,
                h("div", { className: "verdict-label" }, "Diagnóstico sugerido"),
                h("div", {
                  className: "verdict-value",
                  style: { color: positive ? "var(--red-600)" : "var(--green-600)" },
                }, diagnosis),
              ),
              h("div", { style: { textAlign: "right" } },
                h("div", {
                  className: "verdict-prob",
                  style: { color: positive ? "var(--red-600)" : "var(--green-600)" },
                }, h(AnimatedNumber, { value: probShown * 100, decimals: 1, suffix: "%" })),
                h("div", { style: { fontSize: 11, color: "var(--ink-500)" } },
                  "Probabilidad"),
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
                h(motion.div, {
                  className: "confbar-fill", style: { background: confTier.c },
                  initial: { width: 0 }, animate: { width: (conf * 100) + "%" },
                  transition: { duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.15 },
                })),
            ),
            h("div", { className: "metrics metrics-2", style: { marginTop: 16 } },
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Probabilidad"),
                h("div", { className: "metric-value" }, (result.prob * 100).toFixed(2), h("small", null, "%"))),
              h("div", { className: "metric" },
                h("div", { className: "metric-label" }, "Latencia"),
                h("div", {
                  className: "metric-value",
                  style: { color: result.latencia_ms < 2000 ? "var(--ink-900)" : "var(--red-600)" },
                }, fmtLatencia(result.latencia_ms), h("small", null, "ms"))),
            ),
            historialFallo && h("div", {
              className: "alert alert-warn",
              style: { marginTop: 14 },
              role: "status",
            },
              h(I.alert, { size: 16 }),
              h("div", null,
                h("strong", null, "Este análisis no se guardó en el historial. "),
                "El resultado que ve en pantalla es válido, pero no quedará registrado ",
                "en el expediente. Descargue el informe si necesita conservarlo.",
                (historialFallo.detalle || historialFallo.estado) && h("div", {
                  style: { marginTop: 6, fontSize: 12 },
                },
                  h("strong", null, "Motivo: "),
                  historialFallo.detalle ||
                    ("el servidor respondió HTTP " + historialFallo.estado),
                ),
              ),
            ),
            positive && h("div", { className: "alert alert-warn", style: { marginTop: 14 } },
              h(I.info, { size: 16 }),
              h("div", null,
                h("strong", null, "Hallazgo positivo sugerido. "),
                "Confirmar con prueba de ureasa, histología o test del aliento. Verifique el Grad-CAM antes de comunicar al paciente.",
              ),
            ),
            h("div", { className: "resultado-acciones" },
              h("button", {
                className: "btn btn-primary",
                onClick: downloadReport,
                "aria-label": "Descargar informe clínico en PDF",
              }, h(I.dl, { size: 14 }), "Descargar Informe Clínico (PDF)"),
              h("button", {
                className: "btn btn-secondary",
                onClick: () => onViewHeatmap && onViewHeatmap(result, file),
              }, h(I.heat, { size: 14 }), "Ver Grad-CAM"),
              h("button", { className: "btn btn-ghost", onClick: reset },
                h(I.plus, { size: 14 }), "Analizar otra imagen"),
            ),
          ),
        ),
      ),
    ),
  );
}
