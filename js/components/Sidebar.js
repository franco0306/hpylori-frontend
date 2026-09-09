import { I } from "../icons.js";
import { ROLES, ROLE_LABEL, getRole } from "../roles.js";

const h = window.React.createElement;

function initials(user) {
  if (!user) return "?";
  const src = user.full_name || user.email || "";
  const parts = src.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

// Navegación clínica. Las rutas técnicas (catálogo de modelos y comparativa de
// arquitecturas) quedan fuera del menú: el gastroenterólogo no elige modelo.
export function Sidebar({ current, onNavigate, user, onLogout }) {
  const role = getRole(user);

  // Accesos de administración técnica. Se suman a los clínicos: un
  // administrador sigue necesitando ver lo que ve el médico para dar soporte.
  const adminItems = role === ROLES.ADMIN ? [
    { id: "admin",           label: "Panel Admin",          icon: I.shield, group: "Administración" },
    { id: "admin-auditoria", label: "Auditoría y Cuotas",   icon: I.bars,   group: "Administración" },
    { id: "admin-config",    label: "Configuración Global", icon: I.cog,    group: "Administración" },
  ] : [];

  const items = [
    { id: "dashboard", label: "Panel principal",            icon: I.dash,    group: "Inicio" },
    { id: "single",    label: "Análisis individual",        icon: I.upload,  group: "Diagnóstico" },
    { id: "heatmap",   label: "Visualización Grad-CAM",     icon: I.heat,    group: "Diagnóstico" },
    { id: "batch",     label: "Procesamiento por lote",     icon: I.layers,  group: "Diagnóstico" },
    { id: "history",   label: "Historial de estudios",      icon: I.history, group: "Registros" },
    { id: "settings",  label: "Configuración",              icon: I.cog,     group: "Sistema" },
    { id: "manual",    label: "Manual de usuario",          icon: I.book,    group: "Sistema" },
    ...adminItems,
  ];
  const groups = [...new Set(items.map((i) => i.group))];

  const handleNavigate = (id) => {
    if (id === current) return;   // early return: evita re-render innecesario
    onNavigate(id);
  };

  return h("aside", { className: "sidebar" },
    h("div", { className: "brand" },
      h("div", { className: "brand-mark" }, "Hp"),
      h("div", null,
        h("div", { className: "brand-name" }, "EndoScan AI"),
        h("div", { className: "brand-sub" }, "Apoyo diagnóstico"),
      ),
    ),
    h("nav", { className: "nav", "aria-label": "Navegación principal" },
      ...groups.flatMap((g) => [
        h("div", { key: "s-" + g, className: "nav-section" }, g),
        ...items.filter((i) => i.group === g).map((i) =>
          h("button", {
            key: i.id,
            type: "button",
            className: "nav-item" + (current === i.id ? " active" : ""),
            "aria-current": current === i.id ? "page" : undefined,
            onClick: () => handleNavigate(i.id),
          },
            h(i.icon, { className: "nav-icon", size: 16, "aria-hidden": true }),
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
          ROLE_LABEL[role] + ((user && user.email) ? " · " + user.email : "")),
      ),
      h("button", { className: "btn btn-ghost btn-icon", title: "Cerrar sesión", onClick: onLogout, style: { flexShrink: 0, color: "var(--ink-400)" } },
        h(I.logout, { size: 16 })),
    ),
  );
}
