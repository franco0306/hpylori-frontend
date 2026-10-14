import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence, animate, motion, useInView, useMotionTemplate, useMotionValue, useReducedMotion,
} from "framer-motion";
import { cn } from "./cn.js";

// Aceternity UI · Card Spotlight
// Un resplandor suave sigue al puntero dentro de la tarjeta.
export function SpotlightCard({ className, children, color = "var(--accent-glow-soft)", as = "div", ...props }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [activo, setActivo] = useState(false);
  const Etiqueta = motion[as] || motion.div;

  function handleMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    x.set(clientX - left);
    y.set(clientY - top);
  }

  return (
    <Etiqueta
      onMouseMove={handleMove}
      onMouseEnter={() => setActivo(true)}
      onMouseLeave={() => setActivo(false)}
      className={cn("group/spot relative overflow-hidden", className)}
      {...props}
    >
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-[inherit] transition duration-300"
        style={{
          opacity: activo ? 1 : 0,
          background: useMotionTemplate`radial-gradient(260px circle at ${x}px ${y}px, ${color}, transparent 75%)`,
        }}
      />
      <div className="relative">{children}</div>
    </Etiqueta>
  );
}

// Aceternity UI · Card Hover Effect
// Un fondo compartido se desliza hacia el elemento bajo el puntero.
export function HoverEffect({ items, className, onSelect }) {
  const [activo, setActivo] = useState(null);

  return (
    <div className={cn("tw grid gap-1", className)}>
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect && onSelect(item.id)}
          onMouseEnter={() => setActivo(i)}
          onMouseLeave={() => setActivo(null)}
          onFocus={() => setActivo(i)}
          onBlur={() => setActivo(null)}
          className="group relative block h-full w-full cursor-pointer rounded-2xl border-0 bg-transparent p-1.5 text-left outline-none"
        >
          <AnimatePresence>
            {activo === i && (
              <motion.span
                className="absolute inset-0 block rounded-2xl bg-brand-50"
                layoutId="hover-effect-fondo"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.15 } }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-10 flex h-full flex-col gap-3 rounded-xl border border-ink-200 bg-surface p-4 transition duration-200 group-hover:border-brand-100 group-hover:shadow-[0_8px_24px_-12px_rgba(30,64,175,0.35)]">
            <span
              className="grid h-10 w-10 place-items-center rounded-xl"
              style={{ background: item.bg, color: item.color }}
            >
              {item.icon}
            </span>
            <div>
              <div className="text-[13.5px] font-semibold text-ink-900">{item.title}</div>
              <div className="mt-0.5 text-[12px] leading-snug text-ink-500">{item.description}</div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

// Número que cuenta hasta su valor al entrar en pantalla.
export function AnimatedNumber({ value, decimals = 0, suffix = "", className }) {
  const ref = useRef(null);
  const enVista = useInView(ref, { once: true });
  const reducido = useReducedMotion();
  const numero = Number(value);
  const [texto, setTexto] = useState(reducido ? numero.toFixed(decimals) : (0).toFixed(decimals));

  useEffect(() => {
    if (!Number.isFinite(numero)) return undefined;
    if (reducido || !enVista) {
      if (reducido) setTexto(numero.toFixed(decimals));
      return undefined;
    }
    const control = animate(0, numero, {
      duration: 1.1, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setTexto(v.toFixed(decimals)),
    });
    return () => control.stop();
  }, [numero, enVista, reducido, decimals]);

  if (!Number.isFinite(numero)) return <span className={className}>{value}</span>;
  return <span ref={ref} className={className}>{texto}{suffix}</span>;
}

// Aceternity UI · Shimmer button (de «Tailwind CSS buttons»)
export function ShimmerButton({ className, children, ...props }) {
  return (
    <button
      className={cn(
        "tw inline-flex h-10 animate-shimmer items-center justify-center gap-2 rounded-lg border border-[#1E3A8A] px-5",
        "bg-[linear-gradient(110deg,#1E40AF,45%,#3B82F6,55%,#1E40AF)] bg-[length:200%_100%]",
        "text-[13px] font-semibold text-white shadow-[0_8px_24px_-10px_rgba(30,64,175,0.7)]",
        "transition hover:brightness-110 focus:outline-none focus-visible:ring-[3px] focus-visible:ring-brand-100",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
