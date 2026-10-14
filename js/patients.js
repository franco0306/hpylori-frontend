// Pacientes del médico, identificados por código de historia clínica.
// El servidor resuelve las variantes ("hc 2026-104" = "HC-2026-104") y evita
// duplicados; aquí solo se consulta y se crea.

import { authFetch } from "./auth.js";

async function pedir(ruta, opciones) {
  const res = await authFetch(ruta, opciones);
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    const d = datos && datos.detail;
    const fallo = new Error(typeof d === "string" ? d : "No se pudo completar la operación.");
    fallo.estado = res.status;
    throw fallo;
  }
  return datos;
}

/** `{ items, exacto, total }`; cada item trae `coincidencia`: exacta | parcial | similar. */
export function searchPatients(q = "", limit = 8) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (q) params.set("q", q);
  return pedir("/patients?" + params.toString());
}

export function createPatient(codigo) {
  return pedir("/patients", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ codigo }),
  });
}

export function generatePatient() {
  return pedir("/patients/generar", { method: "POST" });
}
