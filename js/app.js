// Punto de entrada de la SPA. Monta React en #root.

import { findModel }           from "./models.js";
import { Sidebar }             from "./components/Sidebar.js";
import { Topbar, Disclaimer }  from "./components/Topbar.js";
import { Dashboard }           from "./components/Dashboard.js";
import { SingleScreen }        from "./components/SingleScreen.js";
import { HeatmapScreen }       from "./components/HeatmapScreen.js";
import { BatchScreen }         from "./components/BatchScreen.js";
import { ModelsScreen }        from "./components/ModelsScreen.js";
import { CompareScreen }       from "./components/CompareScreen.js";
import { HistoryScreen }       from "./components/HistoryScreen.js";
import { SettingsScreen }      from "./components/SettingsScreen.js";
import { HelpScreen }         from "./components/HelpScreen.js";
import { LoginScreen }         from "./components/LoginScreen.js";
import { RegisterScreen }      from "./components/RegisterScreen.js";
import { CONFIG }              from "./config.js";
import { isAuthenticated, getUser, logout, authFetch } from "./auth.js";

const React    = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect } = React;
const h = React.createElement;

const DEFAULT_PREFS = { modelId: "resnet50", threshold: 0.5 };

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  const [authed, setAuthed]     = useState(() => isAuthenticated());
  const [authView, setAuthView] = useState("login"); // "login" | "register"
  const [user, setUser]         = useState(() => getUser());

  const [prefs, setPrefs]                 = useState(DEFAULT_PREFS);
  const [modelId, setModelId]             = useState(DEFAULT_PREFS.modelId);
  const [heatmapResult, setHeatmapResult] = useState(null);
  const [screen, setScreen]               = useState("single");
  const model = findModel(modelId);

  // Carga las preferencias guardadas al autenticarse
  useEffect(() => {
    if (!authed) return;
    let mounted = true;
    authFetch(CONFIG.SETTINGS_PATH).then(async (res) => {
      if (!res.ok) return;
      const data = await res.json();
      if (!mounted) return;
      setPrefs({ modelId: data.modelId, threshold: data.threshold });
      setModelId(data.modelId);
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
    setModelId(newPrefs.modelId);
    try {
      await authFetch(CONFIG.SETTINGS_PATH, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
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
    setAuthed(false);
    setUser(null);
    setPrefs(DEFAULT_PREFS);
    setModelId(DEFAULT_PREFS.modelId);
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
    models:    ["EndoScan AI", "IA", "Modelos disponibles"],
    compare:   ["EndoScan AI", "IA", "Comparativa de modelos"],
    history:   ["EndoScan AI", "Registros", "Historial"],
    settings:  ["EndoScan AI", "Sistema", "Configuración"],
    help:      ["EndoScan AI", "Sistema", "Manual de usuario"],
  })[screen] || ["EndoScan AI"];

  const render = () => {
    switch (screen) {
      case "dashboard": return h(Dashboard,      { onNavigate: setScreen, model, user });
      case "single":    return h(SingleScreen,   { model, onViewHeatmap: viewHeatmap, threshold: prefs.threshold });
      case "heatmap":   return h(HeatmapScreen,  { model, heatmapResult, onNewAnalysis: () => setScreen("single") });
      case "batch":     return h(BatchScreen,    { model, threshold: prefs.threshold });
      case "models":    return h(ModelsScreen,   { modelId, onSelect: setModelId, onCompare: () => setScreen("compare") });
      case "compare":   return h(CompareScreen,  { modelId, onSelect: setModelId });
      case "history":   return h(HistoryScreen,  { onViewHeatmap: viewHeatmap });
      case "settings":  return h(SettingsScreen, { prefs, onSave: handleSavePrefs });
      case "help":      return h(HelpScreen,     {});
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
    h(Sidebar, { current: screen, onNavigate: setScreen, model, user, onLogout: handleLogout }),
    h("div", { className: "main" },
      h(Topbar, {
        crumbs, model,
        onModelChange: setModelId,
        onOpenCompare: () => setScreen("compare"),
      }),
      h("div", { "data-screen-label": screen }, render()),
      h(Disclaimer, null),
    ),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App, null));
