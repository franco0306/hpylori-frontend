// Persistencia de estudios vía backend (Postgres/Supabase).
//
// Solo metadatos escalares: el servidor no guarda imágenes ni mapas Grad-CAM,
// de modo que la base crece con el número de estudios y no con su peso. La
// imagen de la sesión en curso vive en `sessionCache.js`, en memoria.

import { CONFIG } from "./config.js";
import { authFetch } from "./auth.js";

export async function getStudies() {
  try {
    const res = await authFetch(CONFIG.STUDIES_PATH);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Registra un estudio en el historial.
 *
 * Envía los nombres canónicos del esquema. El servidor sigue aceptando los
 * antiguos (`prob`, `paciente`) por alias, pero depender de esa capa de
 * compatibilidad es lo que hace que un cambio de esquema pase inadvertido.
 *
 * Lanza si el servidor rechaza el guardado. Antes devolvía un objeto fabricado
 * en local, así que un fallo de persistencia era invisible: la pantalla daba el
 * estudio por guardado y no aparecía nunca en el historial.
 */
export async function saveStudy(result, paciente = "") {
  const body = {
    paciente_id:  (paciente || "").trim() || null,
    clase:        result.clase,
    probabilidad: result.prob,
    latencia_ms:  result.latencia_ms,
  };

  const res = await authFetch(CONFIG.STUDIES_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    // Se arrastra el motivo del servidor: "no se guardó" sin decir por qué
    // obliga a abrir las herramientas del navegador para averiguarlo.
    const cuerpo = await res.json().catch(() => ({}));
    const detail = cuerpo && cuerpo.detail;

    const fallo = new Error("HTTP_" + res.status);
    fallo.estado = res.status;
    fallo.detalle = typeof detail === "string"
      ? detail
      : Array.isArray(detail) && detail.length
        ? String((detail[0] && detail[0].msg) || "").replace(/^Value error,\s*/i, "")
        : null;
    throw fallo;
  }
  return res.json();
}

export async function deleteStudy(id) {
  try { await authFetch(CONFIG.STUDIES_PATH + "/" + id, { method: "DELETE" }); }
  catch { /* ignore */ }
}

export async function clearHistory() {
  try { await authFetch(CONFIG.STUDIES_PATH, { method: "DELETE" }); }
  catch { /* ignore */ }
}
