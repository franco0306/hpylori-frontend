import { cn } from "./cn.js";

// Aceternity UI · Spotlight
// Haz de luz difuso que entra en diagonal al montar la vista. Puramente
// decorativo: no recibe eventos ni lo anuncian los lectores de pantalla.
export function Spotlight({ className, fill = "white" }) {
  return (
    <svg
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-[1] h-[169%] w-[138%] animate-spotlight opacity-0 lg:w-[84%]",
        className,
      )}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 3787 2842"
      fill="none"
    >
      <g filter="url(#spotlight-blur)">
        <ellipse
          cx="1924.71" cy="273.501" rx="1924.71" ry="273.501"
          transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)"
          fill={fill} fillOpacity="0.21"
        />
      </g>
      <defs>
        <filter id="spotlight-blur" x="0.860352" y="0.838989" width="3785.16" height="2840.26"
                filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="blur" />
        </filter>
      </defs>
    </svg>
  );
}

// Aceternity UI · Grid background
// Rejilla fina que se desvanece hacia los bordes con una máscara radial.
export function GridBackground({ className, color = "rgba(255,255,255,0.05)", size = 40 }) {
  const lineas = encodeURIComponent(color);
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0", className)}
      style={{
        backgroundImage:
          `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'%3E` +
          `%3Cpath d='M ${size} 0 L 0 0 0 ${size}' fill='none' stroke='${lineas}' stroke-width='1'/%3E%3C/svg%3E")`,
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
  );
}
