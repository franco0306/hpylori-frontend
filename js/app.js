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

const React    = window.React;
const ReactDOM = window.ReactDOM;
const { useState } = React;
const h = React.createElement;

// ── Preferencias persistentes ────────────────────────────────────────────────
const PREFS_KEY      = "endoscan_settings";
const DEFAULT_PREFS  = { modelId: "resnet50", threshold: 0.5 };

function loadPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch { return DEFAULT_PREFS; }
}

function persistPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

// ── App ──────────────────────────────────────────────────────────────────────
function App() {
  // Preferencias cargadas desde localStorage al montar
  const [prefs, setPrefs] = useState(() => loadPrefs());

  // modelId puede cambiarse en runtime (Topbar) sin sobrescribir el guardado
  const [modelId, setModelId] = useState(prefs.modelId);
  const [heatmapResult, setHeatmapResult] = useState(null);
  const [screen, setScreen]   = useState("single");
  const model = findModel(modelId);

  const viewHeatmap = (result, file) => {
    setHeatmapResult({ result, file });
    setScreen("heatmap");
  };

  // Guarda preferencias, actualiza estado y sincroniza el modelo activo
  const handleSavePrefs = (newPrefs) => {
    persistPrefs(newPrefs);
    setPrefs(newPrefs);
    setModelId(newPrefs.modelId);
  };

  const crumbs = ({
    dashboard: ["EndoScan AI", "Panel principal"],
    single:    ["EndoScan AI", "Diagnóstico", "Análisis individual"],
    heatmap:   ["EndoScan AI", "Diagnóstico", "Visualización Grad-CAM"],
    batch:     ["EndoScan AI", "Diagnóstico", "Procesamiento por lote"],
    models:    ["EndoScan AI", "IA", "Modelos disponibles"],
    compare:   ["EndoScan AI", "IA", "Comparativa de modelos"],
    history:   ["EndoScan AI", "Registros", "Historial"],
    settings:  ["EndoScan AI", "Sistema", "Configuración"],
  })[screen] || ["EndoScan AI"];

  const render = () => {
    switch (screen) {
      case "dashboard": return h(Dashboard,      { onNavigate: setScreen, model });
      case "single":    return h(SingleScreen,   { model, onViewHeatmap: viewHeatmap, threshold: prefs.threshold });
      case "heatmap":   return h(HeatmapScreen,  { model, heatmapResult, onNewAnalysis: () => setScreen("single") });
      case "batch":     return h(BatchScreen,    { model, threshold: prefs.threshold });
      case "models":    return h(ModelsScreen,   { modelId, onSelect: setModelId, onCompare: () => setScreen("compare") });
      case "compare":   return h(CompareScreen,  { modelId, onSelect: setModelId });
      case "history":   return h(HistoryScreen,  { onViewHeatmap: viewHeatmap });
      case "settings":  return h(SettingsScreen, { prefs, onSave: handleSavePrefs });
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
    h(Sidebar, { current: screen, onNavigate: setScreen, model }),
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
