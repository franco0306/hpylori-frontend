import { I } from "../icons.js";
import { THEMES } from "../theme.js";
import { CONFIG } from "../config.js";

const React = window.React;
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

// Comprobación real del servicio de análisis. Se usa `no-cors`: no necesitamos
// leer la respuesta, solo saber si el servidor contesta. Cualquier respuesta
// (incluso opaca) significa alcanzable; solo un fallo de red cuenta como caída.
const PROBE_TIMEOUT_MS = 12000;
const RECHECK_MS = 120000;

async function probeService() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PROBE_TIMEOUT_MS);
  try {
    await fetch(CONFIG.API_BASE_URL + "/", {
      method: "GET", mode: "no-cors", cache: "no-store", signal: ctrl.signal,
    });
    return "online";
  } catch {
    return "offline";
  } finally {
    clearTimeout(timer);
  }
}

// Estado del servicio en lenguaje clínico: el médico necesita saber si puede
// analizar, no si un endpoint HTTP responde.
const STATUS_TEXT = {
  checking: {
    label: "Comprobando conexión…",
    title: "Verificando que el servidor de análisis esté disponible.",
  },
  online: {
    label: "Sistema listo para analizar",
    title: "El servidor de análisis responde con normalidad. Puede procesar imágenes.",
  },
  offline: {
    label: "Sin conexión con el servidor",
    title: "No se puede contactar el servidor de análisis. Revise su conexión a internet " +
           "e inténtelo de nuevo; las imágenes no podrán analizarse mientras tanto.",
  },
};

function initials(user) {
  if (!user) return "?";
  const src = user.full_name || user.email || "";
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// Topbar clínico: sin selector de arquitectura ni acceso a comparativas.
// Solo contexto de navegación, estado del servicio, accesibilidad y usuario.
export function Topbar({ crumbs, user, theme, onToggleTheme }) {
  const dark = theme === THEMES.DARK;
  const [status, setStatus] = useState("checking");

  const handleCheckService = useCallback(() => {
    let alive = true;
    setStatus("checking");
    probeService().then((next) => { if (alive) setStatus(next); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const cancel = handleCheckService();
    const iv = setInterval(handleCheckService, RECHECK_MS);
    return () => { cancel(); clearInterval(iv); };
  }, [handleCheckService]);

  const info = STATUS_TEXT[status];

  return h("div", { className: "topbar" },
    h("div", { className: "crumbs" },
      ...crumbs.flatMap((c, i) => [
        i > 0 && h(I.chev, { key: "c" + i, size: 12 }),
        i === crumbs.length - 1
          ? h("strong", { key: "l" + i }, c)
          : h("span",   { key: "s" + i }, c),
      ].filter(Boolean)),
    ),
    h("div", { className: "topbar-spacer" }),

    h("button", {
      type: "button",
      className: "system-status is-" + status,
      onClick: handleCheckService,
      title: info.title + " Pulse para comprobar de nuevo.",
      "aria-label": info.label + ". Pulse para comprobar la conexión de nuevo.",
    },
      h("span", {
        className: "dot" + (status === "online" ? "" : " dot-" + status),
        "aria-hidden": true,
      }),
      h("span", { role: "status", "aria-live": "polite" }, info.label),
    ),

    // ── Accesibilidad: modo oscuro para salas de baja iluminación ───────────
    h("button", {
      className: "theme-toggle",
      onClick: onToggleTheme,
      role: "switch",
      "aria-checked": dark,
      "aria-label": "Modo oscuro para salas de endoscopia",
      title: dark ? "Cambiar a modo claro" : "Modo oscuro (salas de baja iluminación)",
    },
      h(dark ? I.sun : I.moon, { size: 14 }),
      h("span", null, dark ? "Modo claro" : "Modo oscuro"),
    ),

    h("div", { className: "topbar-user" },
      h("div", { className: "avatar avatar-sm" }, initials(user)),
      h("span", { className: "topbar-user-name" },
        (user && (user.full_name || user.email)) || "Usuario"),
    ),
  );
}

export function Disclaimer() {
  return h("div", { className: "disclaimer", role: "note" },
    h(I.alert, { size: 14 }),
    h("span", null,
      h("strong", null, "Aviso legal · Herramienta de apoyo diagnóstico."),
      " No reemplaza el criterio clínico del especialista. Toda decisión terapéutica debe ser validada por un gastroenterólogo certificado.",
    ),
  );
}
