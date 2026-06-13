// Sesión de usuario: token JWT + datos básicos en localStorage.

import { CONFIG } from "./config.js";

const TOKEN_KEY = "endoscan_token";
const USER_KEY  = "endoscan_user";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
  catch { return null; }
}

export function isAuthenticated() { return !!getToken(); }

function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

// Convierte el `detail` de FastAPI (string o lista de errores de validación) en un mensaje legible.
function errorMessage(data) {
  const detail = data && data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (first && first.loc && first.loc.includes("email")) return "El correo electrónico no es válido.";
    if (first && first.loc && first.loc.includes("password")) return "La contraseña no es válida.";
    return (first && first.msg) || "Datos inválidos.";
  }
  return "Error de autenticación";
}

async function authRequest(path, body) {
  const res = await fetch(CONFIG.API_BASE_URL + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(errorMessage(data));
  return data;
}

export async function register(email, password, fullName) {
  const data = await authRequest(CONFIG.REGISTER_PATH, { email, password, full_name: fullName || null });
  setSession(data.access_token, data.user);
  return data.user;
}

export async function login(email, password) {
  const data = await authRequest(CONFIG.LOGIN_PATH, { email, password });
  setSession(data.access_token, data.user);
  return data.user;
}

// Wrapper de fetch: agrega base URL + Authorization, y desloguea en 401.
export async function authFetch(path, opts = {}) {
  const token = getToken();
  const headers = { ...(opts.headers || {}) };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(CONFIG.API_BASE_URL + path, { ...opts, headers });

  if (res.status === 401) {
    logout();
    window.location.reload();
    throw new Error("UNAUTHORIZED");
  }
  return res;
}
