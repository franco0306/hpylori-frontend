// Persistencia de estudios vía backend (Postgres/Supabase).
// Cada entrada guarda metadatos + thumbnail pequeño (96×72 JPEG).
// No almacena heatmap_b64 (demasiado grande).

import { CONFIG } from "./config.js";
import { authFetch } from "./auth.js";

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function makeThumbnail(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = 96; c.height = 72;
      c.getContext("2d").drawImage(img, 0, 0, 96, 72);
      resolve(c.toDataURL("image/jpeg", 0.7));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function getStudies() {
  try {
    const res = await authFetch(CONFIG.STUDIES_PATH);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function saveStudy(file, result, paciente = "") {
  const thumb = await makeThumbnail(file.src);
  const body = {
    fileName:    file.name || "imagen.jpg",
    thumbnail:   thumb,
    paciente:    (paciente || "").trim(),   // nombre o ID del paciente (puede ser vacío)
    clase:       result.clase,
    prob:        result.prob,
    latencia_ms: result.latencia_ms,
    modelo:      result.modelo  || "—",
    modelId:     result.modelId || "resnet50",
  };

  try {
    const res = await authFetch(CONFIG.STUDIES_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("HTTP_" + res.status);
    return await res.json();
  } catch {
    return { id: uid(), timestamp: new Date().toISOString(), ...body };
  }
}

export async function deleteStudy(id) {
  try { await authFetch(CONFIG.STUDIES_PATH + "/" + id, { method: "DELETE" }); }
  catch { /* ignore */ }
}

export async function clearHistory() {
  try { await authFetch(CONFIG.STUDIES_PATH, { method: "DELETE" }); }
  catch { /* ignore */ }
}
