// Panel lateral de marca para las pantallas de login/registro.

import { I } from "../icons.js";
import { MODELS } from "../models.js";

const h = window.React.createElement;

const FEATURES = [
  { icon: "cube",    title: "Modelos de IA validados",  sub: MODELS.length + " arquitecturas (" + MODELS.map((m) => m.name).join(", ") + ") entrenadas y validadas para detectar H. pylori en imágenes endoscópicas." },
  { icon: "heat",    title: "Visualización Grad-CAM",   sub: "Mapas de calor que muestran en qué regiones de la imagen se enfoca el modelo." },
  { icon: "history", title: "Historial por estudio",    sub: "Consulta resultados anteriores organizados por paciente y fecha." },
  { icon: "shield",  title: "Datos privados por cuenta", sub: "Tu historial y configuración se guardan de forma segura, solo accesibles para ti." },
];

export function AuthHero({ title, lead }) {
  return h("div", { className: "auth-hero" },
    h("div", { className: "auth-hero-mark" }, h(I.bact, { size: 26 })),
    h("h1", null, title),
    h("p", { className: "lead" }, lead),
    h("div", { className: "auth-feature-list" },
      FEATURES.map((f) =>
        h("div", { key: f.title, className: "auth-feature" },
          h("div", { className: "auth-feature-icon" }, h(I[f.icon], { size: 17 })),
          h("div", null,
            h("div", { className: "auth-feature-title" }, f.title),
            h("div", { className: "auth-feature-sub" }, f.sub),
          ),
        ),
      ),
    ),
    h("div", { className: "auth-hero-footer" },
      "Herramienta de apoyo diagnóstico basada en IA. No reemplaza el criterio clínico profesional."),
  );
}
