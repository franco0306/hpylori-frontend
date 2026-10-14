import { motion, useReducedMotion } from "framer-motion";
import { cn } from "./cn.js";

const EASE = [0.16, 1, 0.3, 1];

// ── Empty state ──────────────────────────────────────────────────────────────
// Un vacío tiene que decir tres cosas: qué falta, por qué, y qué hacer. El
// icono flota sobre un halo con rejilla de puntos (estética Aceternity).
const TONOS = {
  brand: { fg: "var(--blue-700)",  bg: "var(--blue-50)",  ring: "var(--blue-100)" },
  neutral: { fg: "var(--ink-500)", bg: "var(--ink-100)",  ring: "var(--ink-200)" },
  success: { fg: "var(--green-600)", bg: "var(--green-50)", ring: "var(--green-100)" },
  warn:  { fg: "var(--amber-600)", bg: "var(--amber-50)", ring: "#FDE68A" },
};

export function EmptyState({ icon: Icono, title, description, action, tone = "brand", compact = false, className }) {
  const t = TONOS[tone] || TONOS.brand;
  const reducido = useReducedMotion();

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: EASE }}
      role="status"
      className={cn("tw flex flex-col items-center text-center", compact ? "gap-1.5 px-4 py-7" : "gap-2 px-6 py-12", className)}
    >
      <div className={cn("relative mb-2 grid place-items-center", compact ? "h-16 w-16" : "h-24 w-24")}>
        <div aria-hidden="true"
             className="absolute inset-0 rounded-full [background-image:radial-gradient(var(--ink-300)_1px,transparent_1px)] [background-size:8px_8px] [mask-image:radial-gradient(circle,black_35%,transparent_70%)]" />
        <motion.div
          animate={reducido ? undefined : { y: [0, -4, 0] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          className={cn("relative grid place-items-center rounded-2xl border", compact ? "h-11 w-11" : "h-14 w-14")}
          style={{ background: t.bg, color: t.fg, borderColor: t.ring,
                   boxShadow: "0 10px 24px -14px " + t.fg }}
        >
          {Icono && <Icono size={compact ? 18 : 24} />}
        </motion.div>
      </div>
      <div className={cn("font-semibold text-ink-900", compact ? "text-[13.5px]" : "text-[15px]")}>{title}</div>
      {description && (
        <div className={cn("max-w-[360px] leading-relaxed text-ink-500", compact ? "text-[12px]" : "text-[13px]")}>
          {description}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </motion.div>
  );
}

// ── Loading: skeletons ───────────────────────────────────────────────────────
// Un esqueleto con la forma del contenido final se percibe más rápido que un
// spinner, y evita que la página "salte" al llegar los datos.
export function Skeleton({ className, style }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} style={style} />;
}

export function SkeletonRows({ rows = 4, thumb = true, className, label = "Cargando…" }) {
  return (
    <div role="status" aria-label={label} className={cn("tw flex flex-col", className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 border-0 border-t border-ink-100 px-5 py-3 first:border-t-0">
          {thumb && <Skeleton className="h-10 w-[52px] shrink-0 rounded-lg" />}
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 rounded" style={{ width: (55 - (i % 3) * 10) + "%" }} />
            <Skeleton className="h-2.5 rounded" style={{ width: (35 + (i % 2) * 10) + "%" }} />
          </div>
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SkeletonTable({ rows = 6, cols = 5, label = "Cargando…" }) {
  return (
    <div role="status" aria-label={label} className="tw flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4 border-0 border-t border-ink-100 px-5 py-3.5 first:border-t-0"
             style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-3 rounded" style={{ width: (90 - ((r + c) % 4) * 15) + "%" }} />
          ))}
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

// ── Loading: imagen en análisis ──────────────────────────────────────────────
// Haz de escaneo que recorre la imagen mientras el modelo trabaja: muestra que
// se está analizando ESA imagen, no solo que "algo carga".
export function ScanLoader({ src, alt = "" }) {
  const reducido = useReducedMotion();
  return (
    <div className="tw relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-ink-200 bg-[#030712]">
      {src && <img src={src} alt={alt} className="absolute inset-0 h-full w-full object-cover opacity-70" />}
      <div aria-hidden="true"
           className="absolute inset-0 [background-image:linear-gradient(rgba(96,165,250,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(96,165,250,0.14)_1px,transparent_1px)] [background-size:22px_22px]" />
      {!reducido && (
        <motion.div
          aria-hidden="true"
          className="absolute inset-x-0 h-24 bg-gradient-to-b from-transparent via-sky-400/35 to-transparent"
          initial={{ top: "-25%" }}
          animate={{ top: ["-25%", "100%"] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="absolute inset-x-0 bottom-1/2 h-px bg-sky-300 shadow-[0_0_12px_2px_rgba(56,189,248,0.8)]" />
        </motion.div>
      )}
      {["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2",
        "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map((pos) => (
        <span key={pos} aria-hidden="true" className={cn("absolute h-5 w-5 rounded-[3px] border-sky-300/80", pos)} />
      ))}
    </div>
  );
}

export function Spinner({ className }) {
  return (
    <span aria-hidden="true"
          className={cn("inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-white/35 border-t-white", className)} />
  );
}
