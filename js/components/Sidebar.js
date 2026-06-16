import { I } from "../icons.js";

const h = window.React.createElement;

function initials(user) {
  if (!user) return "?";
  const src = user.full_name || user.email || "";
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function Sidebar({ current, onNavigate, model, user, onLogout }) {
  const items = [
    { id: "dashboard", label: "Panel principal",            icon: I.dash,    group: "Inicio" },
    { id: "single",    label: "Análisis individual",        icon: I.upload,  group: "Diagnóstico", badge: "HU-001" },
    { id: "heatmap",   label: "Visualización Grad-CAM",     icon: I.heat,    group: "Diagnóstico", badge: "HU-002" },
    { id: "batch",     label: "Procesamiento por lote",     icon: I.layers,  group: "Diagnóstico", badge: "HU-003" },
    { id: "models",    label: "Modelos disponibles",        icon: I.cube,    group: "IA" },
    { id: "compare",   label: "Comparativa de modelos",     icon: I.bars,    group: "IA" },
    { id: "history",   label: "Historial de estudios",      icon: I.history, group: "Registros" },
    { id: "settings",  label: "Configuración",              icon: I.cog,     group: "Sistema" },
    { id: "help",      label: "Manual de usuario",          icon: I.book,    group: "Sistema" },
  ];
  const groups = [...new Set(items.map((i) => i.group))];

  return h("aside", { className: "sidebar" },
    h("div", { className: "brand" },
      h("div", { className: "brand-mark" }, "Hp"),
      h("div", null,
        h("div", { className: "brand-name" }, "EndoScan AI"),
        h("div", { className: "brand-sub" }, model.name + " · " + model.version),
      ),
    ),
    h("nav", { className: "nav" },
      ...groups.flatMap((g) => [
        h("div", { key: "s-" + g, className: "nav-section" }, g),
        ...items.filter((i) => i.group === g).map((i) =>
          h("button", {
            key: i.id,
            className: "nav-item" + (current === i.id ? " active" : ""),
            onClick: () => onNavigate(i.id),
          },
            h(i.icon, { className: "nav-icon", size: 16 }),
            h("span", null, i.label),
            i.badge && h("span", { className: "nav-badge" }, i.badge),
          ),
        ),
      ]),
    ),
    h("div", { className: "sidebar-footer" },
      h("div", { className: "avatar" }, initials(user)),
      h("div", { style: { flex: 1, minWidth: 0, overflow: "hidden" } },
        h("div", { className: "user-name", style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          (user && (user.full_name || user.email)) || "Usuario"),
        h("div", { className: "user-role", style: { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } },
          (user && user.email) || ""),
      ),
      h("button", { className: "btn btn-ghost btn-icon", title: "Cerrar sesión", onClick: onLogout, style: { flexShrink: 0, color: "var(--ink-400)" } },
        h(I.logout, { size: 16 })),
    ),
  );
}
