// Formateo de valores para presentación clínica.

/**
 * Milisegundos legibles: el backend devuelve flotantes como 1166.96 y en
 * pantalla eso lee como ruido de máquina. Un médico solo necesita el entero,
 * y con separador de millares cuando la cifra es grande.
 * @param {number|string} ms
 * @returns {string}
 */
export function fmtLatencia(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n)) return "—";
  return Math.round(n).toLocaleString("es-PE");
}
