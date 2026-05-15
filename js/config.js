// Configuración global de la app.
// Ajusta estos valores cuando conectes tu modelo real (TMB).

export const CONFIG = {
  // URL base del backend que sirve el modelo (FastAPI / Flask / Node, etc.).
  // Ej.: "http://localhost:8000"  o  "/api"  si usas el mismo origen.
  API_BASE_URL: "http://localhost:8000",

  // Endpoint que recibe la imagen y devuelve la predicción.
  PREDICT_PATH: "/predict",

  // Si está en true, no llama al backend: usa datos simulados (modo demo).
  // Pónlo en false cuando tu API esté lista.
  USE_MOCK: false,

  // Límite de tamaño en MB que acepta el frontend.
  MAX_FILE_MB: 10,

  // Formatos aceptados.
  ACCEPTED_MIME: ["image/jpeg", "image/png", "image/jpg"],

  // Timeout de la inferencia en milisegundos.
  REQUEST_TIMEOUT_MS: 15000,
};
