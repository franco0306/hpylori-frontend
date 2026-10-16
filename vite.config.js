import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GitHub Pages sirve la app en /hpylori-frontend/; en desarrollo, en la raíz.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/hpylori-frontend/" : "/",
  plugins: [react()],
  // Las pruebas E2E descargan archivos dentro de tests/: vigilarlos hacía
  // caer el servidor de desarrollo (EBUSY en Windows).
  server: { port: 5500, host: "127.0.0.1", watch: { ignored: ["**/tests/**"] } },
}));
