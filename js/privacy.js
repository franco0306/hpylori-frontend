// Privacidad y derechos ARCO (Ley N.° 29733).
//
// El backend es la fuente de verdad del consentimiento: guarda cada decisión
// con versión del acuerdo, fecha e IP. El navegador solo recuerda una copia
// para no bloquear la interfaz si el servidor tarda en responder.

import { CONFIG } from "./config.js";
import { authFetch } from "./auth.js";

/** Mensaje legible del `detail` de FastAPI (texto o lista de validación). */
function detalle(cuerpo) {
  const d = cuerpo && cuerpo.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d.length) {
    return String((d[0] && d[0].msg) || "").replace(/^Value error,\s*/i, "") || null;
  }
  return null;
}

async function pedir(ruta, opciones) {
  const res = await authFetch(ruta, opciones);
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    const fallo = new Error(detalle(datos) || "HTTP_" + res.status);
    fallo.estado = res.status;
    throw fallo;
  }
  return datos;
}

function enviar(ruta, metodo, cuerpo) {
  return pedir(ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

/** Versión vigente del acuerdo y estado de cada cláusula. */
export function getConsents() {
  return pedir(CONFIG.PRIVACY_PATH + "/consents");
}

/**
 * Registra decisiones. `terminosVersion` solo al aceptar el acuerdo.
 * @param {{terminosVersion?: string, clausulas?: Object<string, boolean>}} d
 */
export function saveConsents({ terminosVersion, clausulas = {} }) {
  const cuerpo = { clausulas };
  if (terminosVersion) cuerpo.terminos_version = terminosVersion;
  return enviar(CONFIG.PRIVACY_PATH + "/consents", "POST", cuerpo);
}

export function getConsentHistory() {
  return pedir(CONFIG.PRIVACY_PATH + "/consents/history");
}

export function createArcoRequest(tipo, detalleTexto) {
  return enviar(CONFIG.PRIVACY_PATH + "/arco", "POST", { tipo, detalle: detalleTexto });
}

export function getArcoRequests() {
  return pedir(CONFIG.PRIVACY_PATH + "/arco");
}

/** Derecho de acceso: descarga en JSON todo lo que el sistema guarda de la cuenta. */
export async function downloadMyData() {
  const datos = await pedir(CONFIG.PRIVACY_PATH + "/export");
  const blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(blob);
  enlace.download = "endoscan_mis_datos_" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
}

// `label` es el término legal (lo ve el administrador); `sencillo`, lo que ve el médico.
export const ARCO_TIPOS = [
  { id: "acceso",        label: "Acceso",        sencillo: "Saber qué datos míos guarda el sistema",
    hint: "Recibirá el detalle de lo que el sistema tiene de su cuenta." },
  { id: "rectificacion", label: "Rectificación", sencillo: "Corregir un dato mío",
    hint: "Por ejemplo, su nombre o su correo están mal." },
  { id: "cancelacion",   label: "Cancelación",   sencillo: "Eliminar mi cuenta y mis datos",
    hint: "Se borran su cuenta y su historial. No se puede deshacer." },
  { id: "oposicion",     label: "Oposición",     sencillo: "Que no usen mis datos para algo concreto",
    hint: "Indique qué uso de sus datos no quiere que se haga." },
];

export const ARCO_ESTADO_LABEL = {
  pendiente: "Pendiente",
  atendida:  "Atendida",
  rechazada: "Rechazada",
};
