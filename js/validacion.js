// Validación de formularios en el cliente, con mensajes en lenguaje claro.
// Es una ayuda de usabilidad: la validación que cuenta es la del servidor.

const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NOMBRE_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

export function validarCorreo(valor) {
  const v = (valor || "").trim();
  if (!v) return "Ingrese su correo electrónico.";
  if (!CORREO_RE.test(v)) return "El correo no tiene un formato válido (ej.: nombre@hospital.com).";
  return null;
}

/** Misma política que el backend: 8+ caracteres combinando letras y números. */
export function validarClaveNueva(valor) {
  if (!valor) return "Cree una contraseña.";
  if (valor.length < 8) return "Use al menos 8 caracteres.";
  if (!/[A-Za-zÀ-ÿ]/.test(valor) || !/\d/.test(valor)) return "Combine letras y números.";
  return null;
}

export function validarNombre(valor) {
  const v = (valor || "").trim();
  if (v && !NOMBRE_RE.test(v)) return "Solo letras y espacios, sin números ni puntos.";
  return null;
}

/** Fuerza de la contraseña de 0 a 4, para el medidor del registro. */
export function fuerzaClave(valor) {
  if (!valor) return 0;
  let p = 0;
  if (valor.length >= 8) p++;
  if (valor.length >= 12) p++;
  if (/[A-Za-zÀ-ÿ]/.test(valor) && /\d/.test(valor)) p++;
  if (/[^A-Za-z0-9À-ÿ]/.test(valor) || (/[a-z]/.test(valor) && /[A-Z]/.test(valor))) p++;
  return Math.min(p, 4);
}
