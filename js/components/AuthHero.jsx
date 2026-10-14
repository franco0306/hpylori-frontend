// Panel de marca de las pantallas de acceso (login y registro).
//
// Siempre oscuro, sea cual sea el tema: es la "portada" del sistema. Usa tres
// piezas de Aceternity UI —Spotlight, rejilla con máscara y Text Generate
// Effect— y entra con un escalonado suave. En móvil se oculta (styles.css).

import { motion } from "framer-motion";
import { I } from "../icons.js";
import { LOGO_FULL } from "../brand.js";
import { Spotlight, GridBackground } from "../ui/spotlight.jsx";
import { TextGenerateEffect } from "../ui/text-generate.jsx";

const FEATURES = [
  { icon: "cube",    title: "Modelo validado",         sub: "ResNet50 con AUC 0.95 sobre imágenes endoscópicas reales." },
  { icon: "heat",    title: "Explicabilidad Grad-CAM", sub: "Mapas de calor que muestran en qué se fija el modelo." },
  { icon: "history", title: "Historial por paciente",  sub: "Resultados anteriores organizados por paciente y fecha." },
  { icon: "shield",  title: "Privacidad por diseño",   sub: "Ley N.° 29733, cifrado AES-256 y bitácora inmutable." },
];

const contenedor = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
};
const elemento = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

export function AuthHero({ title, lead }) {
  return (
    <div className="tw auth-hero relative hidden min-[901px]:flex flex-col justify-center overflow-hidden bg-[#030712] px-14 py-14 text-white">
      <GridBackground color="rgba(148,163,184,0.09)" size={44} />
      <Spotlight className="-left-10 -top-40 md:-left-32 md:-top-20" fill="#60A5FA" />
      <div aria-hidden="true"
           className="pointer-events-none absolute -bottom-40 -right-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.28),transparent_65%)] blur-2xl" />

      <div className="relative z-10 max-w-[520px]">
        <motion.img
          src={LOGO_FULL}
          alt="EndoScan AI · Apoyo diagnóstico"
          initial={{ opacity: 0, y: -8, filter: "blur(6px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="mb-9 block h-auto w-[300px] max-w-full drop-shadow-[0_8px_30px_rgba(56,189,248,0.18)]"
        />

        <h1 className="m-0 text-[40px] font-extrabold leading-[1.1] tracking-tight">
          <TextGenerateEffect words={title}
            wordClassName="bg-gradient-to-b from-white to-slate-400 bg-clip-text text-transparent" />
        </h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mb-9 mt-4 max-w-[440px] text-[15px] leading-relaxed text-slate-400"
        >
          {lead}
        </motion.p>

        <motion.div variants={contenedor} initial="hidden" animate="show" className="grid grid-cols-2 gap-3">
          {FEATURES.map((f) => {
            const Icono = I[f.icon];
            return (
              <motion.div
                key={f.title}
                variants={elemento}
                className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition duration-300 hover:border-sky-400/30 hover:bg-white/[0.06]"
              >
                <span className="mb-3 grid h-9 w-9 place-items-center rounded-lg border border-white/10 bg-gradient-to-br from-white/10 to-white/[0.02] text-sky-300 transition group-hover:text-sky-200">
                  <Icono size={16} />
                </span>
                <div className="text-[13.5px] font-semibold text-slate-100">{f.title}</div>
                <div className="mt-1 text-[12px] leading-snug text-slate-400">{f.sub}</div>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="mt-10 border-t border-white/10 pt-5 text-[11.5px] text-slate-500">
          Herramienta de apoyo diagnóstico basada en IA. No reemplaza el criterio clínico profesional.
        </div>
      </div>
    </div>
  );
}
