// Cliente HTTP de inferencia. Punto único de integración con tu modelo (TMB).
//
// Contrato JSON esperado del endpoint POST {API_BASE_URL}{PREDICT_PATH}:
// Request: multipart/form-data
//   - file:      la imagen endoscópica (JPG/PNG)
//   - model_id:  string, p.ej. "resnet50"
// Response (200 OK): JSON
//   {
//     "clase":         "Positivo" | "Negativo",
//     "prob":          0.0 .. 1.0,        // probabilidad de la clase predicha
//     "latencia_ms":   1420,              // tiempo de inferencia en el backend
//     "heatmap_b64":   "data:image/png;base64,..." | null,  // Grad-CAM opcional
//     "modelo":        "ResNet50-Hp_v0.4.2",
//     "modelId":       "resnet50",
//     "timestamp":     "2026-05-04T18:23:00.000Z"
//   }

import { CONFIG } from "./config.js";
import { findModel } from "./models.js";

/**
 * Predicción real contra el backend.
 * @param {File|{src:string,name:string,type:string}} file
 * @param {{modelId?:string}} opts
 * @returns {Promise<object>}
 */
async function realPredict(file, opts = {}) {
  const modelId = opts.modelId || "resnet50";
  const fd = new FormData();

  // File real → envío directo. URL (http o data:) → fetch + Blob.
  if (file instanceof File) {
    fd.append("file", file, file.name);
  } else if (file && file.src) {
    const blob = await (await fetch(file.src)).blob();
    fd.append("file", blob, file.name || "image.jpg");
  } else {
    throw new Error("INVALID_FILE");
  }
  fd.append("model_id", modelId);

  // Umbral personalizado: si viene en opts lo enviamos; el backend lo aplicará
  // en lugar de su valor por defecto (THRESHOLDS dict).
  if (opts.threshold !== undefined && opts.threshold !== null) {
    fd.append("threshold", String(opts.threshold));
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(CONFIG.API_BASE_URL + CONFIG.PREDICT_PATH, {
      method: "POST",
      body: fd,
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error("HTTP_" + res.status);
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw new Error("API_TIMEOUT");
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Predicción simulada (modo demo). Útil para desarrollo de UI.
 */
async function mockPredict(file, opts = {}) {
  const model = findModel(opts.modelId);
  const baseLat = model.metrics.latency_ms;
  const ms = Math.round(baseLat * (0.85 + Math.random() * 0.3));
  await new Promise((r) => setTimeout(r, ms));

  if (opts.forceError) throw new Error("API_TIMEOUT");

  const positive = opts.positive != null ? opts.positive : Math.random() > 0.55;
  const baseProb = positive ? 0.74 + Math.random() * 0.22 : 0.06 + Math.random() * 0.22;

  return {
    clase: positive ? "Positivo" : "Negativo",
    prob: Number(baseProb.toFixed(4)),
    latencia_ms: ms,
    heatmap_b64: opts.heat || null,
    modelo: model.name + "_" + model.version,
    modelId: model.id,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Punto de entrada único. Decide entre mock y backend real según CONFIG.USE_MOCK.
 */
export function predict(file, opts) {
  return CONFIG.USE_MOCK ? mockPredict(file, opts) : realPredict(file, opts);
}

// Exports auxiliares para casos puntuales (e.g. demos forzados de error).
export { mockPredict, realPredict };
