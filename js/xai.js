// Paletas de color para la visualización explicable (Grad-CAM).
//
// La paleta térmica clásica (Jet) es la que devuelve el backend, pero recorre
// rojo y verde en su rango medio: para un médico con deuteranopía o protanopía
// —cerca del 8 % de los varones— las zonas de alta y baja activación pueden
// volverse indistinguibles. Viridis y Cividis son perceptualmente uniformes y
// monótonas en luminancia, así que siguen leyéndose sin visión cromática plena.
//
// El recoloreado ocurre en el cliente: se invierte el color Jet de cada píxel a
// su valor escalar de activación y ese escalar se remapea a la paleta destino.

const STORAGE_KEY = "endoscan.xaiPalette";

// Anclas de cada mapa de color (posición 0..1 → RGB).
const JET = [
  [0.000, [  0,   0, 131]], [0.125, [  0,  60, 170]], [0.375, [  5, 255, 255]],
  [0.625, [255, 255,   0]], [0.875, [250,   0,   0]], [1.000, [128,   0,   0]],
];

const VIRIDIS = [
  [0.000, [ 68,   1,  84]], [0.200, [ 62,  74, 137]], [0.400, [ 38, 130, 142]],
  [0.600, [ 53, 183, 121]], [0.800, [180, 222,  44]], [1.000, [253, 231,  37]],
];

const CIVIDIS = [
  [0.000, [  0,  32,  76]], [0.250, [  0,  67,  88]], [0.500, [ 87, 111, 114]],
  [0.750, [154, 156, 124]], [1.000, [255, 221,  64]],
];

export const PALETTES = {
  standard: {
    id: "standard",
    label: "Estándar (Jet / Térmica)",
    hint: "Paleta térmica clásica de la literatura radiológica.",
    stops: ["#2347C5", "#16A34A", "#FBBF24", "#DC2626"],
    anchors: JET,
  },
  accessible: {
    id: "accessible",
    label: "Accesible daltonismo (Viridis / Cividis)",
    hint: "Perceptualmente uniforme: legible con deuteranopía y protanopía.",
    stops: ["#440154", "#3E4A89", "#26828E", "#35B779", "#FDE725"],
    anchors: VIRIDIS,
  },
};

export const DEFAULT_PALETTE = "standard";

export function getStoredPalette() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && PALETTES[saved]) return saved;
  } catch { /* almacenamiento bloqueado: usamos el valor por defecto */ }
  return DEFAULT_PALETTE;
}

export function storePalette(id) {
  const value = PALETTES[id] ? id : DEFAULT_PALETTE;
  try { window.localStorage.setItem(STORAGE_KEY, value); } catch { /* noop */ }
  return value;
}

// Expande las anclas a una tabla de 256 colores interpolando linealmente.
function buildLut(anchors) {
  const lut = new Array(256);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = anchors[0], b = anchors[anchors.length - 1];
    for (let k = 0; k < anchors.length - 1; k++) {
      if (t >= anchors[k][0] && t <= anchors[k + 1][0]) {
        a = anchors[k]; b = anchors[k + 1];
        break;
      }
    }
    const span = b[0] - a[0];
    const f = span === 0 ? 0 : (t - a[0]) / span;
    lut[i] = [
      Math.round(a[1][0] + (b[1][0] - a[1][0]) * f),
      Math.round(a[1][1] + (b[1][1] - a[1][1]) * f),
      Math.round(a[1][2] + (b[1][2] - a[1][2]) * f),
    ];
  }
  return lut;
}

const JET_LUT = buildLut(JET);

// Color Jet → escalar de activación 0..255 (vecino más cercano en RGB).
function jetToScalar(r, g, b) {
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < 256; i++) {
    const c = JET_LUT[i];
    const dr = r - c[0], dg = g - c[1], db = b - c[2];
    const dist = dr * dr + dg * dg + db * db;
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Devuelve el mapa de calor recoloreado a la paleta indicada.
 * Con la paleta estándar no toca la imagen (early return).
 * Ante cualquier fallo devuelve el original: la accesibilidad nunca debe
 * costar la visualización del hallazgo.
 *
 * @param {string} src        data URL o URL del heatmap original (Jet)
 * @param {string} paletteId  clave de PALETTES
 * @returns {Promise<string>} data URL lista para usar como `src`
 */
export async function recolorHeatmap(src, paletteId) {
  if (!src) return src;
  if (!paletteId || paletteId === DEFAULT_PALETTE) return src;

  const palette = PALETTES[paletteId];
  if (!palette) return src;

  try {
    const img = await loadImage(src);
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(img, 0, 0);

    const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = data.data;
    const target = buildLut(palette.anchors);
    const cache = new Map();   // los heatmaps repiten mucho color

    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] === 0) continue;
      const key = (px[i] << 16) | (px[i + 1] << 8) | px[i + 2];
      let mapped = cache.get(key);
      if (mapped === undefined) {
        mapped = target[jetToScalar(px[i], px[i + 1], px[i + 2])];
        cache.set(key, mapped);
      }
      px[i] = mapped[0]; px[i + 1] = mapped[1]; px[i + 2] = mapped[2];
    }

    ctx.putImageData(data, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return src;
  }
}
