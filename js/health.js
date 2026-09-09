// Estado del servicio de análisis.
//
// Extraído de Topbar.js para que la barra superior y el Panel de Administración
// compartan una única sonda: dos comprobaciones independientes acabarían
// contradiciéndose en pantalla —una diciendo "operativo" y la otra "sin
// conexión"— y el administrador no sabría a cuál creer.

import { CONFIG } from "./config.js";

const React = window.React;
const { useState, useEffect, useCallback } = React;

export const PROBE_TIMEOUT_MS = 12000;
export const RECHECK_MS = 120000;

export const ESTADOS = { COMPROBANDO: "checking", ONLINE: "online", OFFLINE: "offline" };

/**
 * Comprueba si el servidor responde.
 *
 * Se usa `no-cors`: no necesitamos leer la respuesta, solo saber si contesta.
 * Cualquier respuesta (incluso opaca) significa alcanzable; solo un fallo de red
 * o el agotamiento del tiempo cuentan como caída.
 */
export async function probeService() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(CONFIG.API_BASE_URL + "/", {
      method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl.signal,
    });
    return ESTADOS.ONLINE;
  } catch {
    return ESTADOS.OFFLINE;
  } finally {
    clearTimeout(timer);
  }
}

/** Estado del servicio con recomprobación periódica. Devuelve `[estado, recomprobar]`. */
export function useServiceStatus() {
  const [status, setStatus] = useState(ESTADOS.COMPROBANDO);

  const recomprobar = useCallback(() => {
    let vivo = true;
    setStatus(ESTADOS.COMPROBANDO);
    probeService().then((siguiente) => { if (vivo) setStatus(siguiente); });
    return () => { vivo = false; };
  }, []);

  useEffect(() => {
    const cancelar = recomprobar();
    const iv = setInterval(recomprobar, RECHECK_MS);
    return () => { cancelar(); clearInterval(iv); };
  }, [recomprobar]);

  return [status, recomprobar];
}
