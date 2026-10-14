import { forwardRef, useState } from "react";
import { motion, useMotionTemplate, useMotionValue } from "framer-motion";
import { cn } from "./cn.js";

// Aceternity UI · Input (del bloque «Signup Form»)
// Un halo de color sigue al puntero alrededor del campo. Se añade `icon` para
// conservar los iconos de los formularios existentes.
export const Input = forwardRef(function Input({ className, icon: Icono, ...props }, ref) {
  const radio = 110;
  const [visible, setVisible] = useState(false);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  function handleMove({ currentTarget, clientX, clientY }) {
    const { left, top } = currentTarget.getBoundingClientRect();
    x.set(clientX - left);
    y.set(clientY - top);
  }

  return (
    <motion.div
      style={{
        background: useMotionTemplate`radial-gradient(${visible ? radio + "px" : "0px"} circle at ${x}px ${y}px, var(--accent-glow), transparent 80%)`,
      }}
      onMouseMove={handleMove}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
      className="tw group/input relative rounded-[10px] p-[2px] transition duration-300"
    >
      {Icono && (
        <span className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-ink-400 transition group-focus-within/input:text-brand-700">
          <Icono size={15} />
        </span>
      )}
      <input
        ref={ref}
        className={cn(
          "box-border flex h-11 w-full rounded-lg border border-ink-200 bg-ink-50 px-3 py-2 text-[13.5px] text-ink-900",
          "font-sans outline-none transition duration-300 placeholder:text-ink-400",
          "shadow-[0_1px_0_0_rgba(15,23,42,0.03)] focus:border-brand-600 focus:bg-surface focus:ring-[3px] focus:ring-brand-100",
          Icono && "pl-9",
          className,
        )}
        {...props}
      />
    </motion.div>
  );
});

export function Label({ className, children, ...props }) {
  return (
    <label className={cn("mb-1.5 block text-[12px] font-semibold text-ink-700", className)} {...props}>
      {children}
    </label>
  );
}

// Aceternity UI · Bottom Gradient
// Línea de luz que aparece bajo el botón al pasar el puntero.
export function BottomGradient() {
  return (
    <>
      <span className="absolute inset-x-0 -bottom-px block h-px w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-0 transition duration-500 group-hover/btn:opacity-100" />
      <span className="absolute inset-x-10 -bottom-px mx-auto block h-px w-1/2 bg-gradient-to-r from-transparent via-sky-300 to-transparent opacity-0 blur-sm transition duration-500 group-hover/btn:opacity-100" />
    </>
  );
}

// Botón primario con degradado y Bottom Gradient.
export function GradientButton({ className, children, ...props }) {
  return (
    <button
      className={cn(
        "tw group/btn relative flex h-11 w-full items-center justify-center gap-2 rounded-lg border-0",
        "bg-gradient-to-br from-[#1E3A8A] via-[#1E40AF] to-[#2563EB] text-[13.5px] font-semibold text-white",
        "shadow-[0_1px_0_0_rgba(255,255,255,0.18)_inset,0_8px_24px_-8px_rgba(30,64,175,0.6)]",
        "transition duration-200 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    >
      {children}
      <BottomGradient />
    </button>
  );
}
