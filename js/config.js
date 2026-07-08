// Configuración global de la app.
// Ajusta estos valores cuando conectes tu modelo real (TMB).

export const CONFIG = {
  // URL base del backend que sirve el modelo (FastAPI / Flask / Node, etc.).
  // Ej.: "http://localhost:8000"  o  "/api"  si usas el mismo origen.
  API_BASE_URL: "https://franco0306-hpylori-detection.hf.space",

  // Endpoint que recibe la imagen y devuelve la predicción.
  PREDICT_PATH: "/predict",

  // Endpoints de autenticación y datos de usuario.
  REGISTER_PATH: "/auth/register",
  LOGIN_PATH:    "/auth/login",
  ME_PATH:       "/auth/me",
  STUDIES_PATH:  "/studies",
  SETTINGS_PATH: "/settings",

  // Si está en true, no llama al backend: usa datos simulados (modo demo).
  // Pónlo en false cuando tu API esté lista.
  USE_MOCK: false,

  // Límite de tamaño en MB que acepta el frontend.
  MAX_FILE_MB: 10,

  // Formatos aceptados.
  ACCEPTED_MIME: ["image/jpeg", "image/png", "image/jpg"],

  // Timeout de la inferencia en milisegundos.
  // 90s para dar margen al "cold start" del backend (Hugging Face Space en
  // reposo) cuando la comparativa de 6 modelos hace la primera petición.
  REQUEST_TIMEOUT_MS: 90000,  // 90 segundos
};
