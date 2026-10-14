// Sesión de usuario: access token corto + refresh token, en localStorage.
//
// El access token dura minutos (Zero Trust). Cuando caduca, `authFetch` pide
// uno nuevo con el refresh token y repite la petición sin que el médico lo
// note. El servidor rota el refresh en cada uso y puede revocarlo: cerrar
// sesión, deshabilitar la cuenta o cambiar su rol corta el acceso al instante.

import { CONFIG } from "./config.js";

const TOKEN_KEY   = "endoscan_token";
const REFRESH_KEY = "endoscan_refresh";
const USER_KEY    = "endoscan_user";

export function getToken() { return localStorage.getItem(TOKEN_KEY); }
function getRefresh() { return localStorage.getItem(REFRESH_KEY); }

export function getUser() {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || "null"); }
  catch { return null; }
}

export function isAuthenticated() { return !!getToken(); }

function setSession(data) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  if (data.refresh_token) localStorage.setItem(REFRESH_KEY, data.refresh_token);
  if (data.user) localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

/** Cierra la sesión también en el servidor, para que el token robado no sirva. */
export async function logout() {
  const token = getToken();
  clearSession();
  if (!token) return;
  try {
    await fetch(CONFIG.API_BASE_URL + "/auth/logout", {
      method: "POST",
      headers: { Authorization: "Bearer " + token },
    });
  } catch { /* sin red: el access caduca solo en minutos */ }
}

// Convierte el `detail` de FastAPI (string o lista de errores de validación) en un mensaje legible.
function errorMessage(data) {
  const detail = data && data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0];
    if (first && first.loc && first.loc.includes("email")) return "El correo electrónico no es válido.";
    if (first && first.loc && first.loc.includes("password")) {
      return String(first.msg || "La contraseña no es válida.").replace(/^Value error,\s*/i, "");
    }
    const msg = (first && first.msg) || "Datos inválidos.";
    return msg.replace(/^Value error,\s*/i, "");
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
  setSession(data);
  return data.user;
}

/**
 * Primer paso del ingreso. Devuelve `{ user }` si la cuenta entra solo con
 * contraseña, o `{ mfa: { token, setup } }` si debe presentar el segundo
 * factor (administradores): `setup` indica que aún no lo ha configurado.
 */
export async function login(email, password) {
  const data = await authRequest(CONFIG.LOGIN_PATH, { email, password });
  if (data.mfa_token) {
    return { mfa: { token: data.mfa_token, setup: Boolean(data.mfa_setup_required) } };
  }
  setSession(data);
  return { user: data.user };
}

/** Alta del segundo factor: devuelve `{ secret, otpauth_uri, qr }`. */
export function mfaSetup(mfaToken) {
  return authRequest("/auth/mfa/setup", { mfa_token: mfaToken });
}

/** Confirma el código de 6 dígitos y abre la sesión. */
export async function mfaVerify(mfaToken, code) {
  const data = await authRequest("/auth/mfa/verify", { mfa_token: mfaToken, code });
  setSession(data);
  return data.user;
}

// Un único refresco en vuelo: si varias peticiones caducan a la vez, todas
// esperan al mismo en lugar de rotar el refresh token varias veces.
let refrescoEnCurso = null;

async function refrescar() {
  const enviado = getRefresh();
  if (!enviado) return false;
  try {
    const res = await fetch(CONFIG.API_BASE_URL + "/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: enviado }),
    });
    if (res.ok) {
      setSession(await res.json());
      return true;
    }
    // Otra pestaña pudo rotarlo un instante antes: si el guardado cambió,
    // ya tenemos un token nuevo y no hay nada que hacer.
    return getRefresh() !== enviado;
  } catch {
    return false;
  }
}

function refrescarUnaVez() {
  if (!refrescoEnCurso) {
    refrescoEnCurso = refrescar().finally(() => { refrescoEnCurso = null; });
  }
  return refrescoEnCurso;
}

function conToken(opts) {
  const headers = { ...(opts.headers || {}) };
  const token = getToken();
  if (token) headers["Authorization"] = "Bearer " + token;
  return { ...opts, headers };
}

// Wrapper de fetch: agrega base URL + Authorization. Ante un 401 intenta
// renovar la sesión una vez y repite; si no se puede, cierra la sesión.
export async function authFetch(path, opts = {}) {
  let res = await fetch(CONFIG.API_BASE_URL + path, conToken(opts));

  if (res.status === 401 && await refrescarUnaVez()) {
    res = await fetch(CONFIG.API_BASE_URL + path, conToken(opts));
  }

  if (res.status === 401) {
    clearSession();
    window.location.reload();
    throw new Error("UNAUTHORIZED");
  }
  return res;
}
