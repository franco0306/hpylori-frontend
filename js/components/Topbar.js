import { I } from "../icons.js";
import { THEMES } from "../theme.js";

const h = window.React.createElement;

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

    h("div", { className: "system-status" },
      h("span", { className: "dot" }),
      h("span", null, "API conectada"),
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
