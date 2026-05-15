// Generadores de imágenes de muestra (SVG sintético).
// IMPORTANTE: No son datos médicos reales. Sólo sirven para demostrar la UI.

function makeEndo(id, tint, lesion) {
  const speckles = Array.from({ length: 36 })
    .map((_, i) => {
      const x = (i * 73) % 600;
      const y = (i * 131) % 480;
      const r = 4 + ((i * 7) % 18);
      const o = 0.04 + ((i % 5) / 30);
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="rgba(120,30,30,${o})"/>`;
    })
    .join("");

  const lm = lesion
    ? '<ellipse cx="380" cy="220" rx="70" ry="46" fill="#7A1F2E" opacity="0.55"/>' +
      '<ellipse cx="385" cy="225" rx="38" ry="22" fill="#5C1622" opacity="0.7"/>' +
      '<circle cx="395" cy="215" r="6" fill="#3D0E18" opacity="0.85"/>'
    : "";

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 480">` +
    `<defs>` +
      `<radialGradient id="g${id}" cx="50%" cy="50%" r="60%">` +
        `<stop offset="0%" stop-color="${tint}"/>` +
        `<stop offset="60%" stop-color="#5A1820"/>` +
        `<stop offset="100%" stop-color="#1a0608"/>` +
      `</radialGradient>` +
      `<radialGradient id="v${id}" cx="50%" cy="50%" r="70%">` +
        `<stop offset="60%" stop-color="rgba(0,0,0,0)"/>` +
        `<stop offset="100%" stop-color="rgba(0,0,0,0.85)"/>` +
      `</radialGradient>` +
    `</defs>` +
    `<rect width="600" height="480" fill="#000"/>` +
    `<circle cx="300" cy="240" r="240" fill="url(#g${id})"/>` +
    speckles + lm +
    `<circle cx="300" cy="240" r="240" fill="url(#v${id})"/>` +
    `<text x="14" y="466" fill="rgba(255,255,255,0.7)" font-family="monospace" font-size="11">CASE-${id}</text>` +
    `</svg>`;

  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function makeHeat(id) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 480">` +
    `<defs>` +
      `<radialGradient id="h${id}" cx="63%" cy="46%" r="22%">` +
        `<stop offset="0%" stop-color="rgba(220,38,38,0.95)"/>` +
        `<stop offset="35%" stop-color="rgba(251,191,36,0.7)"/>` +
        `<stop offset="65%" stop-color="rgba(22,163,74,0.45)"/>` +
        `<stop offset="100%" stop-color="rgba(35,71,197,0)"/>` +
      `</radialGradient>` +
    `</defs>` +
    `<rect width="600" height="480" fill="rgba(35,71,197,0.12)"/>` +
    `<rect width="600" height="480" fill="url(#h${id})"/>` +
    `</svg>`;

  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

export const SAMPLES = {
  pos1: { src: makeEndo("0917", "#9A2D40", true),  heat: makeHeat("0917"), name: "case_0917.jpg", size: 2.4 },
  pos2: { src: makeEndo("1042", "#A33446", true),  heat: makeHeat("1042"), name: "case_1042.jpg", size: 3.1 },
  neg1: { src: makeEndo("0863", "#B5495C", false), heat: makeHeat("0863"), name: "case_0863.jpg", size: 2.0 },
  neg2: { src: makeEndo("0728", "#BB546A", false), heat: makeHeat("0728"), name: "case_0728.jpg", size: 1.8 },
};
