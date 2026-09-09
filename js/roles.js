// Control de acceso por rol (RBAC) en la interfaz.
//
// ATENCIÓN — esto NO es un límite de seguridad. El rol viaja en el objeto de
// usuario que guarda el navegador, así que cualquiera puede editarlo desde las
// herramientas de desarrollo y ver el panel de administración. Su función aquí
// es organizar la interfaz, no proteger datos.
//
// La autorización real debe vivir en el backend: cada endpoint de /admin/*
// tiene que verificar el rol contra la base de datos antes de responder. Hasta
// que exista esa comprobación, el panel solo oculta accesos, no los cierra.

import { getUser } from "./auth.js";

export const ROLES = {
  MEDICO: "medico",
  ADMIN: "admin",
};

export const ROLE_LABEL = {
  [ROLES.MEDICO]: "Médico",
  [ROLES.ADMIN]: "Administrador",
};

/** Normaliza el rol recibido del backend. Ante cualquier duda, el mínimo privilegio. */
export function normalizeRole(value) {
  const role = String(value || "").trim().toLowerCase();
  return role === ROLES.ADMIN ? ROLES.ADMIN : ROLES.MEDICO;
}

/** Rol del usuario en sesión. */
export function getRole(user) {
  const target = user !== undefined ? user : getUser();
  return normalizeRole(target && target.role);
}

export function isAdmin(user) {
  return getRole(user) === ROLES.ADMIN;
}
