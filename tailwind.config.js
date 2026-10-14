// Tailwind convive con css/styles.css: el preflight va desactivado para no
// alterar las pantallas que aún usan las clases propias. Los colores apuntan a
// las variables CSS del tema, así que los componentes nuevos cambian solos
// entre modo claro y oscuro sin duplicar clases `dark:`.

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./js/**/*.{js,jsx}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors: {
        ink: {
          50: "var(--ink-50)", 100: "var(--ink-100)", 200: "var(--ink-200)", 300: "var(--ink-300)",
          400: "var(--ink-400)", 500: "var(--ink-500)", 700: "var(--ink-700)", 900: "var(--ink-900)",
        },
        brand: {
          50: "var(--blue-50)", 100: "var(--blue-100)", 600: "var(--blue-600)",
          700: "var(--blue-700)", 900: "var(--blue-900)",
        },
        surface: "var(--white)",
        pos: "var(--red-600)",
        neg: "var(--green-600)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
      },
      keyframes: {
        // Aceternity · Spotlight
        spotlight: {
          "0%": { opacity: 0, transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: 1, transform: "translate(-50%, -40%) scale(1)" },
        },
        // Aceternity · Aurora background
        aurora: {
          from: { backgroundPosition: "50% 50%, 50% 50%" },
          to: { backgroundPosition: "350% 50%, 350% 50%" },
        },
        shimmer: {
          from: { backgroundPosition: "0 0" },
          to: { backgroundPosition: "-200% 0" },
        },
      },
      animation: {
        spotlight: "spotlight 2s ease .75s 1 forwards",
        aurora: "aurora 60s linear infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [],
};
