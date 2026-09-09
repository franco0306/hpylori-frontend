// Módulo de accesibilidad visual (WCAG 2.1).
//
// Modo oscuro pensado para salas de endoscopia de baja iluminación: reduce el
// deslumbramiento del monitor sin comprometer el contraste de texto (AA ≥ 4.5:1)
// ni los colores semánticos de diagnóstico (positivo/negativo).
//
// El tema se aplica como atributo `data-theme` en <html> y se persiste en el
// navegador del usuario; si nunca eligió, se respeta la preferencia del sistema.

const STORAGE_KEY = "endoscan.theme";

export const THEMES = { LIGHT: "light", DARK: "dark" };

function systemPrefersDark() {
  return typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Tema inicial: preferencia guardada → preferencia del sistema → claro. */
export function getInitialTheme() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === THEMES.LIGHT || saved === THEMES.DARK) return saved;
  } catch { /* almacenamiento bloqueado (modo privado): usamos el sistema */ }
  return systemPrefersDark() ? THEMES.DARK : THEMES.LIGHT;
}

/** Aplica el tema al documento y lo persiste. */
export function applyTheme(theme) {
  const value = theme === THEMES.DARK ? THEMES.DARK : THEMES.LIGHT;
  document.documentElement.setAttribute("data-theme", value);
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* noop */ }
  return value;
}
