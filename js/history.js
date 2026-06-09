// Persistencia de estudios en localStorage.
// Cada entrada guarda metadatos + thumbnail pequeño (96×72 JPEG).
// No almacena heatmap_b64 (demasiado grande).

const KEY = "endoscan_history";
const MAX  = 200;

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

export function getStudies() {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); }
  catch { return []; }
}

export async function saveStudy(file, result, paciente = "") {
  const studies  = getStudies();
  const thumb    = await makeThumbnail(file.src);
  const entry = {
    id:          uid(),
    timestamp:   new Date().toISOString(),
    fileName:    file.name || "imagen.jpg",
    thumbnail:   thumb,
    paciente:    paciente.trim(),   // nombre o ID del paciente (puede ser vacío)
    clase:       result.clase,
    prob:        result.prob,
    latencia_ms: result.latencia_ms,
    modelo:      result.modelo  || "—",
    modelId:     result.modelId || "resnet50",
  };
  studies.unshift(entry);
  if (studies.length > MAX) studies.length = MAX;
  try {
    localStorage.setItem(KEY, JSON.stringify(studies));
  } catch {
    // cuota llena — recorta a la mitad y reintenta
    studies.splice(Math.floor(MAX / 2));
    try { localStorage.setItem(KEY, JSON.stringify(studies)); } catch { /* ignore */ }
  }
  return entry;
}

export function deleteStudy(id) {
  localStorage.setItem(KEY, JSON.stringify(getStudies().filter((s) => s.id !== id)));
}

export function clearHistory() {
  localStorage.removeItem(KEY);
}
