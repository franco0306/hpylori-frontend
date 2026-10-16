// Persistencia de estudios vía backend (Postgres/Supabase).
//
// Solo metadatos escalares: el servidor no guarda imágenes ni mapas Grad-CAM,
// de modo que la base crece con el número de estudios y no con su peso. La
// imagen de la sesión en curso vive en `sessionCache.js`, en memoria.

import { CONFIG } from "./config.js";
import { authFetch } from "./auth.js";

// El servidor guarda la hora en UTC sin zona ("2026-10-16T18:29:23"). Sin la
// "Z", el navegador la leería como hora local y en Perú cada estudio
// aparecería cinco horas adelantado.
function conZona(iso) {
  return !iso || /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z";
}

export async function getStudies() {
  try {
    const res = await authFetch(CONFIG.STUDIES_PATH);
    if (!res.ok) return [];
    const estudios = await res.json();
    return estudios.map((s) => ({ ...s, timestamp: conZona(s.timestamp), created_at: conZona(s.created_at) }));
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
    // Referencias al almacén de objetos que devolvió `/predict`. Nunca la
    // imagen: el servidor rechaza cualquier `data:` en estos campos.
    image_url:    result.image_url || null,
    gradcam_url:  result.gradcam_url || null,
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

/**
 * Guarda los resultados de un lote en UNA petición, todos del mismo paciente.
 * Devuelve los estudios creados en el mismo orden que `resultados`.
 */
export async function saveStudiesBatch(resultados, paciente = "") {
  const res = await authFetch(CONFIG.STUDIES_PATH + "/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      paciente_id: (paciente || "").trim() || null,
      estudios: resultados.map((r) => ({
        clase: r.clase,
        probabilidad: r.prob,
        latencia_ms: r.latencia_ms,
        image_url: r.image_url || null,
        gradcam_url: r.gradcam_url || null,
      })),
    }),
  });
  if (!res.ok) {
    const cuerpo = await res.json().catch(() => ({}));
    const fallo = new Error("HTTP_" + res.status);
    fallo.estado = res.status;
    fallo.detalle = typeof cuerpo.detail === "string" ? cuerpo.detail : null;
    throw fallo;
  }
  return res.json();
}

async function enviarConfirmacion(id, metodo, cuerpo) {
  const res = await authFetch(CONFIG.STUDIES_PATH + "/" + id + "/confirmacion", {
    method: metodo,
    headers: cuerpo ? { "Content-Type": "application/json" } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof datos.detail === "string" ? datos.detail : "HTTP_" + res.status);
  }
  return { ...datos, timestamp: conZona(datos.timestamp), created_at: conZona(datos.created_at) };
}

/** Registra el diagnóstico confirmado por una prueba de referencia. */
export function confirmStudy(id, clase, metodo) {
  return enviarConfirmacion(id, "PUT", { clase, metodo });
}

export function unconfirmStudy(id) {
  return enviarConfirmacion(id, "DELETE");
}
