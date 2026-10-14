import { motion } from "framer-motion";
import { I } from "../icons.js";
import { LOGO_ICON } from "../brand.js";
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
export function Sidebar({ current, onNavigate, user, onLogout, onOpenLegal,
                         abierto = false }) {
  const role = getRole(user);

  // Accesos de administración técnica. Se suman a los clínicos: un
  // administrador sigue necesitando ver lo que ve el médico para dar soporte.
  const adminItems = role === ROLES.ADMIN ? [
    { id: "admin",           label: "Panel Admin",          icon: I.shield, group: "Administración" },
    { id: "admin-auditoria", label: "Auditoría y Cuotas",   icon: I.bars,   group: "Administración" },
    { id: "admin-bitacora",  label: "Bitácora y privacidad", icon: I.history, group: "Administración" },
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

  return h("aside", {
    id: "menu-lateral",
    className: "sidebar" + (abierto ? " abierto" : ""),
    // En escritorio el menú es parte del armazón y siempre está presente; el
    // atributo solo describe el cajón cuando de verdad se comporta como tal.
    "aria-hidden": undefined,
  },
    h("div", { className: "brand" },
      h("img", { className: "brand-mark", src: LOGO_ICON, alt: "", width: 34, height: 34 }),
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
            // El fondo del elemento activo se desliza de una opción a otra
            // (layoutId de Framer Motion, como en los Tabs de Aceternity).
            current === i.id && h(motion.span, {
              layoutId: "nav-activo",
              className: "nav-active-pill",
              transition: { type: "spring", stiffness: 520, damping: 42 },
              "aria-hidden": true,
            }),
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

    // El acuerdo se acepta una sola vez, en el primer acceso de cada cuenta
    // (LegalModal). Este enlace es la vía para releerlo cuando haga falta, en
    // lugar de una banda fija ocupando pantalla en todo momento.
    onOpenLegal && h("button", {
      type: "button",
      className: "legal-link",
      onClick: onOpenLegal,
      "aria-label": "Abrir el aviso legal, los términos del servicio y la privacidad de datos médicos",
    },
      h(I.info, { size: 12, "aria-hidden": true }),
      "Aviso legal y privacidad",
    ),
  );
}
