// Lado del formulario en login y registro: tarjeta con marca, título y pie.
// Entra con un desvanecido corto; al cambiar de paso (login → MFA) se vuelve a
// animar porque el padre cambia su `key`.

import { motion } from "framer-motion";
import { I } from "../icons.js";
import { LOGO_ICON } from "../brand.js";

export function AuthCard({ titulo, subtitulo, pie, children }) {
  return (
    <div className="auth-form-side relative overflow-hidden">
      <div aria-hidden="true"
           className="pointer-events-none absolute inset-0 [background-image:radial-gradient(var(--ink-300)_1px,transparent_1px)] [background-size:18px_18px] opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="tw relative w-[400px] max-w-full rounded-2xl border border-ink-200 bg-surface p-8 shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)]"
      >
        <div className="mb-7 flex items-center gap-2.5">
          <img className="brand-mark" src={LOGO_ICON} alt="" width={38} height={38} />
          <div>
            <div className="text-[14px] font-semibold text-ink-900">EndoScan AI</div>
            <div className="font-mono text-[11px] text-ink-500">Detección de H. pylori</div>
          </div>
        </div>
        <h1 className="m-0 text-[22px] font-bold tracking-tight text-ink-900">{titulo}</h1>
        <p className="mb-6 mt-1.5 text-[13px] leading-relaxed text-ink-500">{subtitulo}</p>
        {children}
        {pie && <div className="mt-6 text-center text-[13px] text-ink-500">{pie}</div>}
      </motion.div>
    </div>
  );
}

export function AuthError({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      role="alert"
      className="alert alert-error"
    >
      <I.alert size={16} />
      <div>{children}</div>
    </motion.div>
  );
}
