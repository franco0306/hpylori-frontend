import { useEffect } from "react";
import { motion, stagger, useAnimate, useReducedMotion } from "framer-motion";
import { cn } from "./cn.js";

// Aceternity UI · Text Generate Effect
// Las palabras aparecen una a una, de borroso a nítido. Respeta la preferencia
// de movimiento reducido del sistema: en ese caso el texto se muestra sin más.
export function TextGenerateEffect({ words, className, wordClassName, duration = 0.5 }) {
  const [scope, animate] = useAnimate();
  const reducido = useReducedMotion();
  const lista = String(words).split(" ");

  useEffect(() => {
    if (reducido) return;
    animate("span > span", { opacity: 1, filter: "blur(0px)" },
            { duration, delay: stagger(0.08) });
  }, [scope.current, reducido]);

  return (
    <span ref={scope} className={cn("inline", className)}>
      {lista.map((palabra, i) => (
        <span key={palabra + i}>
          <motion.span
            style={{ opacity: reducido ? 1 : 0, filter: reducido ? "none" : "blur(10px)" }}
            className={cn("inline-block", wordClassName)}
          >
            {palabra}
          </motion.span>
          {i < lista.length - 1 ? " " : null}
        </span>
      ))}
    </span>
  );
}
