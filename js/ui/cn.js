import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Une clases condicionales y resuelve conflictos de Tailwind (patrón de Aceternity UI). */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
