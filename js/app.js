// Punto de entrada de la SPA. Monta React en #root.

import { AnimatePresence, motion } from "framer-motion";
import { Toaster, toast } from "./ui/toast.jsx";

import { findModel }           from "./models.js";
import { CLINICAL_MODEL_ID }   from "./api.js";
import { Sidebar }             from "./components/Sidebar.js";
import { Topbar }              from "./components/Topbar.js";
import { Dashboard }           from "./components/Dashboard.js";
import { SingleScreen }        from "./components/SingleScreen.js";
import { HeatmapScreen }       from "./components/HeatmapScreen.js";
import { BatchScreen }         from "./components/BatchScreen.js";
import { HistoryScreen }       from "./components/HistoryScreen.js";
import { SettingsScreen }      from "./components/SettingsScreen.js";
import { HelpScreen }          from "./components/HelpScreen.js";
import { AdminScreen }         from "./screens/AdminScreen.js";
import { LegalModal, hasAcceptedLegal } from "./components/LegalModal.js";
import { getConsents }         from "./privacy.js";
import { BitacoraScreen }      from "./screens/BitacoraScreen.js";
import { LoginScreen }         from "./components/LoginScreen.js";
import { RegisterScreen }      from "./components/RegisterScreen.js";
import { CONFIG }              from "./config.js";
import { getInitialTheme, applyTheme, THEMES } from "./theme.js";
import { getStoredPalette, storePalette } from "./xai.js";
import { clearStudyMedia } from "./sessionCache.js";
import { ROLES, getRole } from "./roles.js";
import { isAuthenticated, getUser, logout, authFetch } from "./auth.js";

const React    = window.React;
const ReactDOM = window.ReactDOM;
const { useState, useEffect, useCallback } = React;
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
  const [legalOpen, setLegalOpen]         = useState(false);
  const [legalForced, setLegalForced]     = useState(false);
  const [consents, setConsents]           = useState(null);
  const [prefs, setPrefs]                 = useState(DEFAULT_PREFS);
  const [heatmapResult, setHeatmapResult] = useState(null);
  const [screen, setScreen]               = useState("single");
  // Menú lateral en pantalla estrecha. En escritorio está siempre visible; por
  // debajo de 900 px se convierte en un cajón que entra desde la izquierda.
  // Va aquí y no más abajo: los hooks no pueden declararse después del `return`
  // temprano de la pantalla de acceso, o cambiarían de orden al iniciar sesión.
  const [menuAbierto, setMenuAbierto] = useState(false);
  const model = CLINICAL_MODEL;

  const alternarMenu = useCallback(() => setMenuAbierto((v) => !v), []);
  const cerrarMenu = useCallback(() => setMenuAbierto(false), []);

  // Navegar cierra el cajón: dejarlo abierto taparía la pantalla recién elegida.
  const handleNavegar = useCallback((destino) => {
    setScreen(destino);
    setMenuAbierto(false);
  }, []);

  useEffect(() => {
    if (!menuAbierto) return undefined;
    const handleTecla = (e) => {
      if (e.key === "Escape") cerrarMenu();
    };
    document.addEventListener("keydown", handleTecla);
    return () => document.removeEventListener("keydown", handleTecla);
  }, [menuAbierto, cerrarMenu]);

  // Accesibilidad (WCAG 2.1): aplica y persiste el tema en cada cambio.
  useEffect(() => { applyTheme(theme); }, [theme]);

  // Acuerdo de datos: obligatorio en el primer inicio de sesión de cada cuenta.
  // Manda el backend, que es donde queda la aceptación con versión y fecha. La
  // copia local solo se consulta si el servidor no responde, para no bloquear
  // a quien ya aceptó mientras el servicio despierta.
  useEffect(() => {
    if (!authed) return;                       // early return
    let vivo = true;
    getConsents()
      .then((estado) => {
        if (!vivo) return;
        setConsents(estado);
        if (!estado.terminos_aceptados) {
          setLegalForced(true);
          setLegalOpen(true);
        }
      })
      .catch(() => {
        if (!vivo || hasAcceptedLegal(user)) return;
        setLegalForced(true);
        setLegalOpen(true);
      });
    return () => { vivo = false; };
  }, [authed, user && user.id]);

  const toggleTheme = () =>
    setTheme((t) => (t === THEMES.DARK ? THEMES.LIGHT : THEMES.DARK));

  // Paleta XAI: preferencia de accesibilidad, persistida en el navegador.
  const handleChangePalette = (id) => setXaiPalette(storePalette(id));

  // Refresca el usuario desde el servidor al abrir sesión: así un cambio de rol
  // hecho por un administrador surte efecto sin obligar a cerrar y volver a
  // entrar, y el rol guardado en el navegador nunca manda sobre el del backend.
  useEffect(() => {
    if (!authed) return;
    let mounted = true;
    authFetch(CONFIG.ME_PATH).then(async (res) => {
      if (!res.ok) return;
      const fresh = await res.json();
      if (!mounted || !fresh) return;
      setUser(fresh);
      try { window.localStorage.setItem("endoscan_user", JSON.stringify(fresh)); }
      catch { /* almacenamiento bloqueado: el rol vive solo en memoria */ }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [authed]);

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

  const handleOpenLegal = () => { setLegalForced(false); setLegalOpen(true); };
  const handleCloseLegal = () => setLegalOpen(false);
  const handleAcceptLegal = (estado) => {
    if (estado) setConsents(estado);
    setLegalOpen(false);
    setLegalForced(false);
  };

  const handleAuthSuccess = (loggedInUser) => {
    const nombre = loggedInUser && (loggedInUser.full_name || loggedInUser.email);
    toast.success("Sesión iniciada", nombre ? "Bienvenido, " + nombre + "." : undefined);
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
    setConsents(null);
    setAuthView("login");
  };

  if (!authed) {
    return h(React.Fragment, null,
      authView === "register"
        ? h(RegisterScreen, { onSuccess: handleAuthSuccess, onGoToLogin: () => setAuthView("login") })
        : h(LoginScreen,    { onSuccess: handleAuthSuccess, onGoToRegister: () => setAuthView("register") }),
      h(Toaster, null),
    );
  }

  const crumbs = ({
    dashboard: ["EndoScan AI", "Panel principal"],
    single:    ["EndoScan AI", "Diagnóstico", "Análisis individual"],
    heatmap:   ["EndoScan AI", "Diagnóstico", "Visualización Grad-CAM"],
    batch:     ["EndoScan AI", "Diagnóstico", "Procesamiento por lote"],
    history:   ["EndoScan AI", "Registros", "Historial"],
    settings:  ["EndoScan AI", "Sistema", "Configuración"],
    manual:    ["EndoScan AI", "Sistema", "Manual de usuario"],
    "admin":           ["EndoScan AI", "Administración", "Panel Admin"],
    "admin-auditoria": ["EndoScan AI", "Administración", "Auditoría y Cuotas"],
    "admin-bitacora":  ["EndoScan AI", "Administración", "Bitácora y privacidad"],
  })[screen] || ["EndoScan AI"];

  const render = () => {
    switch (screen) {
      case "dashboard": return h(Dashboard,      { onNavigate: setScreen, onViewHeatmap: viewHeatmap, user });
      case "single":    return h(SingleScreen,   { model, onViewHeatmap: viewHeatmap, threshold: prefs.threshold });
      case "heatmap":   return h(HeatmapScreen,  { heatmapResult, xaiPalette, onNewAnalysis: () => setScreen("single") });
      case "batch":     return h(BatchScreen,    { model, threshold: prefs.threshold });
      case "history":   return h(HistoryScreen,  { onViewHeatmap: viewHeatmap, onNavigate: setScreen });
      case "settings":  return h(SettingsScreen, {
        prefs, onSave: handleSavePrefs, theme, onToggleTheme: toggleTheme,
        xaiPalette, onChangePalette: handleChangePalette,
        consents, onConsentsChange: setConsents,
      });
      case "manual":    return h(HelpScreen,     {});

      // El acceso real debe validarlo el backend en cada endpoint /admin/*;
      // esta comprobación solo evita mostrar la pantalla por error.
      case "admin":
      case "admin-auditoria":
      case "admin-bitacora": {
        if (getRole(user) !== ROLES.ADMIN) {
          return h("div", { className: "content" },
            h("div", { className: "page-header" },
              h("div", null,
                h("h1", { className: "page-title" }, "Acceso restringido"),
                h("div", { className: "page-sub" }, "Esta sección requiere una cuenta de administrador."))),
            h("div", { className: "card card-pad", style: { textAlign: "center", padding: 48 } },
              h("div", { className: "muted" }, "Su cuenta no tiene permisos de administración.")),
          );
        }
        // El umbral vive solo en Configuración: el panel administra el sistema,
        // no calibra el diagnóstico.
        if (screen === "admin-bitacora") return h(BitacoraScreen, {});
        const section = screen === "admin-auditoria" ? "auditoria" : "panel";
        return h(AdminScreen, { section, user });
      }
      default:
        return h("div", { className: "content" },
          h("div", { className: "page-header" },
            h("div", null, h("h1", { className: "page-title" }, "Sección"))),
          h("div", { className: "card card-pad", style: { textAlign: "center", padding: 60 } },
            h("div", { className: "muted" }, "Sección en desarrollo.")),
        );
    }
  };

  return h("div", { className: "app" + (menuAbierto ? " menu-abierto" : "") },
    h(Sidebar, {
      current: screen,
      onNavigate: handleNavegar,
      user,
      onLogout: handleLogout,
      onOpenLegal: handleOpenLegal,
      abierto: menuAbierto,
    }),
    // Fondo oscuro del cajón. Solo existe mientras está abierto, y en escritorio
    // el CSS lo mantiene oculto porque el menú nunca se superpone.
    menuAbierto && h("div", {
      className: "menu-backdrop",
      onClick: cerrarMenu,
      "aria-hidden": true,
    }),
    h("div", { className: "main" },
      h(Topbar, {
        crumbs, user, theme, onToggleTheme: toggleTheme,
        menuAbierto, onToggleMenu: alternarMenu,
      }),
      h("div", { "data-screen-label": screen, className: "screen" },
        // Cambio de pantalla con un desvanecido corto: orienta sin hacer esperar.
        h(AnimatePresence, { mode: "wait", initial: false },
          h(motion.div, {
            key: screen,
            className: "screen-anim",
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            exit: { opacity: 0, y: -4 },
            transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] },
          }, render()),
        ),
      ),
    ),
    h(Toaster, null),
    h(LegalModal, {
      open: legalOpen,
      user,
      consents,
      dismissible: !legalForced,
      onAccept: handleAcceptLegal,
      onClose: handleCloseLegal,
    }),
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(h(App, null));
