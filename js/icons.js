// Iconos SVG inline. Se usan vía React.createElement (alias `h`).

const React = window.React;
const h = React.createElement;

const Ico = ({ d, size = 16, sw = 1.75, kids }) =>
  h(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: sw,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    d ? h("path", { d }) : kids
  );

export const I = {
  dash: (p) => h(Ico, { ...p, kids: [
    h("rect", { key: 1, x: 3,  y: 3,  width: 7, height: 9, rx: 1.5 }),
    h("rect", { key: 2, x: 14, y: 3,  width: 7, height: 5, rx: 1.5 }),
    h("rect", { key: 3, x: 14, y: 12, width: 7, height: 9, rx: 1.5 }),
    h("rect", { key: 4, x: 3,  y: 16, width: 7, height: 5, rx: 1.5 }),
  ]}),
  upload:  (p) => h(Ico, { ...p, d: "M12 16V4M7 9l5-5 5 5M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" }),
  layers:  (p) => h(Ico, { ...p, d: "M12 3 3 8l9 5 9-5-9-5zM3 13l9 5 9-5M3 18l9 5 9-5" }),
  heat:    (p) => h(Ico, { ...p, kids: [
    h("circle", { key: 1, cx: 12, cy: 12, r: 9 }),
    h("circle", { key: 2, cx: 12, cy: 12, r: 5 }),
    h("circle", { key: 3, cx: 12, cy: 12, r: 1.5, fill: "currentColor" }),
  ]}),
  history: (p) => h(Ico, { ...p, d: "M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l3 2" }),
  cog:     (p) => h(Ico, { ...p, kids: [
    h("circle", { key: 1, cx: 12, cy: 12, r: 3 }),
    h("path", { key: 2, d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" }),
  ]}),
  cube:    (p) => h(Ico, { ...p, d: "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16zM3.27 6.96 12 12.01l8.73-5.05M12 22.08V12" }),
  bars:    (p) => h(Ico, { ...p, d: "M3 3v18h18M7 14v4M12 9v9M17 4v14" }),
  check:   (p) => h(Ico, { ...p, d: "M20 6 9 17l-5-5" }),
  x:       (p) => h(Ico, { ...p, d: "M18 6 6 18M6 6l12 12" }),
  alert:   (p) => h(Ico, { ...p, d: "M10.3 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.7 3.86a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01" }),
  info:    (p) => h(Ico, { ...p, kids: [
    h("circle", { key: 1, cx: 12, cy: 12, r: 9 }),
    h("path",   { key: 2, d: "M12 16v-4M12 8h.01" }),
  ]}),
  dl:      (p) => h(Ico, { ...p, d: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" }),
  chev:    (p) => h(Ico, { ...p, d: "m9 18 6-6-6-6" }),
  plus:    (p) => h(Ico, { ...p, d: "M12 5v14M5 12h14" }),
  trash:   (p) => h(Ico, { ...p, d: "M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" }),
  eye:     (p) => h(Ico, { ...p, kids: [
    h("path",   { key: 1, d: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" }),
    h("circle", { key: 2, cx: 12, cy: 12, r: 3 }),
  ]}),
  shield:  (p) => h(Ico, { ...p, d: "M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" }),
  refresh: (p) => h(Ico, { ...p, d: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5" }),
  bact:    (p) => h(Ico, { ...p, kids: [
    h("path",    { key: 1, d: "M5 7c2-3 7-3 9 0M19 17c-2 3-7 3-9 0M8 4v2M16 18v2M4 9h2M18 15h2" }),
    h("ellipse", { key: 2, cx: 12, cy: 12, rx: 5, ry: 7, transform: "rotate(-30 12 12)" }),
  ]}),
  logout: (p) => h(Ico, { ...p, kids: [
    h("path", { key: 1, d: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" }),
    h("path", { key: 2, d: "M16 17l5-5-5-5" }),
    h("path", { key: 3, d: "M21 12H9" }),
  ]}),
  user: (p) => h(Ico, { ...p, kids: [
    h("path",   { key: 1, d: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" }),
    h("circle", { key: 2, cx: 12, cy: 7, r: 4 }),
  ]}),
  mail: (p) => h(Ico, { ...p, kids: [
    h("rect", { key: 1, x: 2, y: 4, width: 20, height: 16, rx: 2 }),
    h("path", { key: 2, d: "m22 6-10 7L2 6" }),
  ]}),
  lock: (p) => h(Ico, { ...p, kids: [
    h("rect", { key: 1, x: 3, y: 11, width: 18, height: 11, rx: 2 }),
    h("path", { key: 2, d: "M7 11V7a5 5 0 0 1 10 0v4" }),
  ]}),
};
