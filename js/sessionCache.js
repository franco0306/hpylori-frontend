// Caché en memoria de las imágenes analizadas durante la sesión.
//
// El backend ya no persiste miniaturas ni mapas Grad-CAM: la tabla `studies`
// guarda solo metadatos escalares para que la base crezca con el número de
// estudios y no con el peso de las imágenes.
//
// Eso deja al historial sin nada que mostrar. Como compromiso, mientras la
// pestaña siga abierta conservamos aquí la imagen y el mapa de los estudios
// que el propio médico acaba de analizar, de modo que pueda volver sobre ellos
// sin repetir la inferencia. Al recargar la página se pierde, y eso es
// exactamente lo que comunica la interfaz.

const media = new Map();

// Tope defensivo: cada entrada ronda unos cientos de KB entre imagen y mapa.
const MAX_ENTRIES = 40;

/**
 * Guarda la imagen y el Grad-CAM de un estudio recién analizado.
 * @param {string} studyId
 * @param {{src?: string, heatmap_b64?: string|null, name?: string}} payload
 */
export function cacheStudyMedia(studyId, payload) {
  if (!studyId || !payload || !payload.src) return;

  if (media.size >= MAX_ENTRIES) {
    const oldest = media.keys().next().value;   // Map conserva orden de inserción
    media.delete(oldest);
  }

  media.set(String(studyId), {
    src: payload.src,
    heatmap_b64: payload.heatmap_b64 || null,
    name: payload.name || "",
  });
}

/** Devuelve la media cacheada del estudio, o `null` si no está en esta sesión. */
export function getStudyMedia(studyId) {
  if (!studyId) return null;
  return media.get(String(studyId)) || null;
}

/** `true` si el estudio se analizó en esta sesión y conserva su imagen. */
export function hasStudyMedia(studyId) {
  return Boolean(studyId) && media.has(String(studyId));
}

/** Vacía la caché (cierre de sesión). */
export function clearStudyMedia() {
  media.clear();
}
