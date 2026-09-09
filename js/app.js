// Punto de entrada de la SPA. Monta React en #root.

import { findModel }           from "./models.js";
import { CLINICAL_MODEL_ID }   from "./api.js";
import { Sidebar }             from "./components/Sidebar.js";
import { Topbar, Disclaimer }  from "./components/Topbar.js";
import { Dashboard }           from "./components/Dashboard.js";
import { SingleScreen }        from "./components/SingleScreen.js";
import { HeatmapScreen }       from "./components/HeatmapScreen.js";
import { BatchScreen }         from "./components/BatchScreen.js";
import { HistoryScreen }       from "./components/HistoryScreen.js";
import { SettingsScreen }      from "./components/SettingsScreen.js";
import { HelpScreen }          from "./components/HelpScreen.js";
import { LoginScreen }         from "./components/LoginScreen.js";
import { RegisterScreen }      from "./components/RegisterScreen.js";
import { CONFIG }              from "./config.js";
import { getInitialTheme, applyTheme, THEMES } from "./theme.js";
import { getStoredPalette, storePalette } from "./xai.js";
import { clearStudyMedia } from "./sessionCache.js";
import { isAuthenticated, getUser, logout, authFetch } from "./auth.js";

const React    = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect } = React;
const h = React.createElement;

// El modelo es una constante del sistema, no una preferencia del usuario:
// la interfaz clínica siempre infiere con ResNet50.
const CLINICAL_MODEL = findModel(CLINICAL_MODEL_ID);

const DEFAULT_PREFS = { threshold: 0.5 };

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [authed, setAuthed]     = useState(() => isAuthenticated());
  const [authView, setAuthView] = useState("login"); // "login" | "register"
  const [user, setUser]         = useState(() => getUser());

  const [theme, setTheme]                 = useState(getInitialTheme);
  const [xaiPalette, setXaiPalette]       = useState(getStoredPalette);
  const [prefs, setPrefs]                 = useState(DEFAULT_PREFS);
  const [heatmapResult, setHeatmapResult] = useState(null);
  const [screen, setScreen]               = useState("single");
  const model = CLINICAL_MODEL;

  // Accesibilidad (WCAG 2.1): aplica y persiste el tema en cada cambio.
  useEffect(() => { applyTheme(theme); }, [theme]);

  const toggleTheme = () =>
    setTheme((t) => (t === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK));

  // Paleta XAI: preferencia de accesibilidad, persistida en el navegador.
  const handleChangePalette = (id) => setXaiPalette(storePalette(id));

  // Carga las preferencias guardadas al autenticarse.
  // `modelId` del backend se ignora deliberadamente: la UI clínica es ResNet50.
  useEffect(() => {
    if (!authed) return;
    let mounted = true;
    authFetch(CONFIG.SETTINGS_PATH).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (!mounted) return;
      setPrefs({ threshold: data.threshold });
    }).catch(() => {});
    return () => { mounted = false; };
  }, [authed]);

  const viewHeatmap = (result, file) => {
    setHeatmapResult({ result, file });
    setScreen("heatmap");
  };

  // Actualiza preferencias en estado y las guarda en el backend
  const handleSavePrefs = async (newPrefs) => {
    setPrefs(newPrefs);
    try {
      await authFetch(CONFIG.SETTINGS_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        // El backend conserva el campo modelId; lo enviamos siempre fijo.
        body: JSON.stringify({ ...newPrefs, modelId: CLINICAL_MODEL_ID }),
      });
    } catch { /* UI ya actualizada de forma optimista */ }
  };

  const handleAuthSuccess = (loggedInUser) => {
    setUser(loggedInUser);
    setAuthed(true);
    setScreen("single");
  };

  const handleLogout = () => {
    logout();
    clearStudyMedia();   // las imágenes retenidas no sobreviven a la sesión
    setAuthed(false);
    setUser(null);
    setPrefs(DEFAULT_PREFS);
    setAuthView("login");
  };

  if (!authed) {
    return authView === "register"
      ? h(RegisterScreen, { onSuccess: handleAuthSuccess, onGoToLogin: () => setAuthView("login") })
      : h(LoginScreen,    { onSuccess: handleAuthSuccess, onGoToRegister: () => setAuthView("register") });
  }

  const crumbs = ({
    dashboard: ["EndoScan AI", "Panel principal"],
    single:    ["EndoScan AI", "Diagnóstico", "Análisis individual"],
    heatmap:   ["EndoScan AI", "Diagnóstico", "Visualización Grad-CAM"],
    batch:     ["EndoScan AI", "Diagnóstico", "Procesamiento por lote"],
    history:   ["EndoScan AI", "Registros", "Historial"],
    settings:  ["EndoScan AI", "Sistema", "Configuración"],
    manual:    ["EndoScan AI", "Sistema", "Manual de usuario"],
  })[screen] || ["EndoScan AI"];

  const render = () => {
    switch (screen) {
      case "dashboard": return h(Dashboard,      { onNavigate: setScreen, onViewHeatmap: viewHeatmap, user });
      case "single":    return h(SingleScreen,   { model, onViewHeatmap: viewHeatmap, threshold: prefs.threshold });
      case "heatmap":   return h(HeatmapScreen,  { heatmapResult, xaiPalette, onNewAnalysis: () => setScreen("single") });
      case "batch":     return h(BatchScreen,    { model, threshold: prefs.threshold });
      case "history":   return h(HistoryScreen,  { onViewHeatmap: viewHeatmap });
      case "settings":  return h(SettingsScreen, {
        prefs, onSave: handleSavePrefs, theme, onToggleTheme: toggleTheme,
        xaiPalette, onChangePalette: handleChangePalette,
      });
      case "manual":    return h(HelpScreen,     {});
      default:
        return h("div", { className: "content" },
          h("div", { className: "page-header" },
            h("div", null, h("h1", { className: "page-title" }, "Sección"))),
          h("div", { className: "card card-pad", style: { textAlign: "center", padding: 60 } },
            h("div", { className: "muted" }, "Sección en desarrollo.")),
        );
    }
  };

  return h("div", { className: "app" },
    h(Sidebar, { current: screen, onNavigate: setScreen, user, onLogout: handleLogout }),
    h("div", { className: "main" },
      h(Topbar, { crumbs, user, theme, onToggleTheme: toggleTheme }),
      h("div", { "data-screen-label": screen, className: "screen" }, render()),
      h(Disclaimer, null),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App, null));
