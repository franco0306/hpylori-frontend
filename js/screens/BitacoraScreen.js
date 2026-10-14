// Bitácora de auditoría, solicitudes ARCO y exportación anonimizada.
//
// La bitácora es de SOLO LECTURA también en la base: un disparador rechaza
// cualquier UPDATE o DELETE, y no existe ruta de la API que la modifique. Esta
// pantalla no ofrece —ni podría ofrecer— borrar nada.

import { I } from "../icons.js";
import { authFetch } from "../auth.js";
import { ARCO_TIPOS, ARCO_ESTADO_LABEL } from "../privacy.js";
import { EmptyState, SkeletonTable, Skeleton } from "../ui/states.jsx";
import { toast } from "../ui/toast.jsx";

const React = window.React;
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

const POR_PAGINA = 25;

const ACCIONES = {
  "auth.login":                       "Inicio de sesión",
  "auth.registro":                    "Registro de cuenta",
  "auth.login.password":              "Contraseña válida (falta 2FA)",
  "auth.mfa":                         "Verificación 2FA",
  "auth.mfa.alta_iniciada":           "Alta de 2FA iniciada",
  "auth.mfa.activado":                "2FA activado",
  "auth.logout":                      "Cierre de sesión",
  "auth.refresh.reutilizado":         "Token reutilizado (posible robo)",
  "admin.mfa.reiniciar":              "Reinicio de 2FA",
  "acceso.denegado":                  "Acceso denegado",
  "admin.usuarios.consulta":          "Consulta de cuentas",
  "admin.rol.cambio":                 "Cambio de rol",
  "admin.clave.restablecer":          "Restablecer contraseña",
  "admin.cuenta.estado":              "Habilitar / deshabilitar",
  "admin.cuenta.editar":              "Edición de cuenta",
  "admin.cuenta.eliminar":            "Eliminación de cuenta",
  "admin.mantenimiento.purga":        "Purga de huérfanos",
  "admin.auditoria.consulta":         "Consulta de bitácora",
  "admin.arco.atender":               "Atención ARCO",
  "admin.exportacion.investigacion":  "Exportación anonimizada",
  "privacidad.consentimiento":        "Consentimiento",
  "privacidad.arco.solicitud":        "Solicitud ARCO",
  "privacidad.exportar":              "Descarga de datos propios",
  "estudios.eliminar":                "Eliminación de estudio",
  "estudios.vaciar":                  "Vaciado de historial",
};

const FILTROS = [
  { id: "",                 label: "Todas las acciones" },
  { id: "auth.",            label: "Autenticación" },
  { id: "acceso.denegado",  label: "Accesos denegados" },
  { id: "admin.",           label: "Administración" },
  { id: "privacidad.",      label: "Privacidad" },
  { id: "estudios.",        label: "Estudios" },
];

const RESULTADO_BADGE = { ok: "badge-neg", fallido: "badge-pos", denegado: "badge-warn" };

function fmtFecha(iso) {
  if (!iso) return "—";
  const texto = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z";
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function resumenDetalle(texto) {
  if (!texto) return null;
  try {
    const datos = JSON.parse(texto);
    return Object.entries(datos)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([k, v]) => k + ": " + (typeof v === "object" ? JSON.stringify(v) : String(v)))
      .join(" · ");
  } catch {
    return texto;
  }
}

async function pedirJson(ruta, opciones) {
  const res = await authFetch(ruta, opciones);
  const datos = await res.json().catch(() => null);
  if (!res.ok) {
    const d = datos && datos.detail;
    const fallo = new Error(typeof d === "string" ? d : "HTTP_" + res.status);
    fallo.estado = res.status;
    throw fallo;
  }
  return datos;
}

// ── Bitácora ─────────────────────────────────────────────────────────────────
function Bitacora() {
  const [filtro, setFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [pagina, setPagina] = useState(0);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);

  const cargar = useCallback(() => {
    let vivo = true;
    setCargando(true);
    setError(null);
    const params = new URLSearchParams({ limit: POR_PAGINA, offset: pagina * POR_PAGINA });
    if (filtro) params.set("accion", filtro);
    if (consulta) params.set("q", consulta);
    pedirJson("/admin/audit?" + params.toString())
      .then((d) => { if (vivo) setDatos(d); })
      .catch((err) => { if (vivo) setError(err.estado === 403
        ? "Su cuenta no tiene permisos de administrador."
        : "No se pudo cargar la bitácora. Reintente en unos momentos."); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [filtro, consulta, pagina]);

  useEffect(() => cargar(), [cargar]);

  const handleBuscar = (e) => {
    e.preventDefault();
    setPagina(0);
    setConsulta(busqueda.trim());
  };

  const total = datos ? datos.total : 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return h("div", { className: "card" },
    h("div", { className: "card-head" },
      h("div", null,
        h("div", { className: "card-title" }, "Bitácora de auditoría"),
        h("div", { className: "card-sub" },
          "Quién hizo qué, sobre qué recurso, cuándo y desde qué IP. ",
          h("strong", null, "Solo lectura:"), " la base rechaza cualquier modificación o borrado."),
      ),
      h("button", { type: "button", className: "btn btn-secondary btn-sm", onClick: cargar, disabled: cargando },
        h(I.refresh, { size: 13 }), "Actualizar"),
    ),
    h("form", { className: "bitacora-filtros", onSubmit: handleBuscar },
      h("select", {
        className: "select", value: filtro, "aria-label": "Filtrar por tipo de acción",
        onChange: (e) => { setFiltro(e.target.value); setPagina(0); },
      }, FILTROS.map((f) => h("option", { key: f.id, value: f.id }, f.label))),
      h("input", {
        className: "input", type: "search", value: busqueda,
        placeholder: "Correo, IP o recurso", "aria-label": "Buscar en la bitácora",
        onChange: (e) => setBusqueda(e.target.value),
      }),
      h("button", { type: "submit", className: "btn btn-primary btn-sm" }, "Buscar"),
    ),

    error && h("div", { className: "alert alert-error", role: "alert", style: { margin: "0 20px 16px" } },
      h(I.alert, { size: 16 }), h("div", null, error)),

    cargando && !datos
      ? h(SkeletonTable, { rows: 8, cols: 6, label: "Cargando bitácora" })
      : datos && datos.eventos.length === 0
        ? h(EmptyState, { icon: I.history, tone: "neutral",
            title: filtro || consulta ? "Ningún evento coincide" : "La bitácora está vacía",
            description: filtro || consulta
              ? "No hay eventos para este filtro o búsqueda. Pruebe con otro tipo de acción."
              : "Los inicios de sesión y las acciones críticas aparecerán aquí a medida que ocurran.",
            action: (filtro || consulta) && h("button", { className: "btn btn-secondary",
              onClick: () => { setFiltro(""); setBusqueda(""); setConsulta(""); setPagina(0); } },
              h(I.refresh, { size: 14 }), "Quitar filtros") })
        : h("div", { className: "table-wrap" },
      h("table", { className: "table" },
        h("thead", null, h("tr", null,
          h("th", null, "Fecha y hora"), h("th", null, "Usuario"), h("th", null, "Acción"),
          h("th", null, "Recurso y detalle"), h("th", null, "Resultado"), h("th", null, "IP"))),
        h("tbody", null,
          datos && datos.eventos.map((e) =>
                  h("tr", { key: e.id },
                    h("td", { className: "mono", style: { whiteSpace: "nowrap", fontSize: 12 } }, fmtFecha(e.fecha)),
                    h("td", null, e.actor_email || h("span", { className: "muted" }, "—")),
                    h("td", null, ACCIONES[e.accion] || e.accion),
                    h("td", { style: { fontSize: 12 } },
                      h("div", { className: "mono" }, e.recurso || "—"),
                      e.detalle && h("div", { className: "muted bitacora-detalle" }, resumenDetalle(e.detalle))),
                    h("td", null, h("span", { className: "badge " + (RESULTADO_BADGE[e.resultado] || "badge-neutral") },
                      e.resultado)),
                    h("td", { className: "mono", style: { fontSize: 12 }, title: e.user_agent || "" }, e.ip || "—"),
                  )),
        ),
      ),
    ),

    datos && h("div", { className: "row between bitacora-paginacion" },
      h("span", { className: "muted", style: { fontSize: 12.5 } },
        total + " evento" + (total === 1 ? "" : "s") + " · página " + (pagina + 1) + " de " + paginas),
      h("div", { className: "row", style: { gap: 6 } },
        h("button", { type: "button", className: "btn btn-secondary btn-sm",
                      disabled: pagina === 0 || cargando, onClick: () => setPagina((p) => p - 1) }, "Anterior"),
        h("button", { type: "button", className: "btn btn-secondary btn-sm",
                      disabled: pagina + 1 >= paginas || cargando, onClick: () => setPagina((p) => p + 1) }, "Siguiente"),
      ),
    ),
  );
}

// ── Solicitudes ARCO ─────────────────────────────────────────────────────────
function SolicitudesArco() {
  const [solicitudes, setSolicitudes] = useState(null);
  const [error, setError] = useState(null);
  const [respuestas, setRespuestas] = useState({});
  const [guardando, setGuardando] = useState(null);

  const cargar = useCallback(() => {
    pedirJson("/admin/arco")
      .then((d) => { setSolicitudes(d); setError(null); })
      .catch(() => setError("No se pudieron cargar las solicitudes ARCO."));
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const handleResolver = async (s, estado) => {
    setGuardando(s.id);
    try {
      await pedirJson("/admin/arco/" + s.id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estado, respuesta: (respuestas[s.id] || "").trim() || null }),
      });
      toast.success(estado === "atendida" ? "Solicitud atendida" : "Solicitud rechazada",
        "El titular verá el nuevo estado en su panel de privacidad.");
      cargar();
    } catch (err) {
      setError(err.message || "No se pudo actualizar la solicitud.");
    } finally {
      setGuardando(null);
    }
  };

  const pendientes = solicitudes ? solicitudes.filter((s) => s.estado === "pendiente").length : 0;

  return h("div", { className: "card card-pad" },
    h("div", { className: "row between", style: { marginBottom: 12 } },
      h("div", { className: "section-title", style: { marginBottom: 0 } }, "Solicitudes ARCO"),
      solicitudes && h("span", { className: "badge " + (pendientes ? "badge-warn" : "badge-neg") },
        pendientes ? pendientes + " pendiente" + (pendientes === 1 ? "" : "s") : "Al día"),
    ),
    error && h("div", { className: "alert alert-error", role: "alert", style: { marginBottom: 12 } },
      h(I.alert, { size: 16 }), h("div", null, error)),
    !solicitudes
      ? h("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
          [0, 1].map((i) => h(Skeleton, { key: i, style: { height: 64, borderRadius: 10 } })))
      : solicitudes.length === 0
        ? h(EmptyState, { icon: I.mail, tone: "success", compact: true,
            title: "Sin solicitudes ARCO",
            description: "Cuando un usuario ejerza sus derechos de acceso, rectificación, cancelación u oposición, aparecerá aquí." })
        : solicitudes.map((s) =>
            h("div", { key: s.id, className: "privacy-arco-item" },
              h("div", { className: "row between" },
                h("strong", null, ((ARCO_TIPOS.find((t) => t.id === s.tipo) || {}).label || s.tipo) + " · " + s.email),
                h("span", { className: "badge " + (s.estado === "atendida" ? "badge-neg"
                  : s.estado === "rechazada" ? "badge-pos" : "badge-warn") }, ARCO_ESTADO_LABEL[s.estado] || s.estado),
              ),
              h("div", { className: "privacy-row-sub" }, fmtFecha(s.created_at)),
              h("div", { style: { fontSize: 13, margin: "6px 0" } }, s.detalle),
              s.respuesta && h("div", { className: "privacy-row-sub" }, h("strong", null, "Respuesta: "), s.respuesta),
              s.estado === "pendiente" && h("div", { className: "bitacora-arco-acciones" },
                h("input", {
                  className: "input", placeholder: "Respuesta al titular (opcional)", maxLength: 2000,
                  value: respuestas[s.id] || "",
                  onChange: (e) => setRespuestas((r) => ({ ...r, [s.id]: e.target.value })),
                }),
                h("button", { type: "button", className: "btn btn-primary btn-sm", disabled: guardando === s.id,
                              onClick: () => handleResolver(s, "atendida") }, h(I.check, { size: 13 }), "Atendida"),
                h("button", { type: "button", className: "btn btn-secondary btn-sm", disabled: guardando === s.id,
                              onClick: () => handleResolver(s, "rechazada") }, "Rechazar"),
              ),
            )),
  );
}

// ── Exportación anonimizada ──────────────────────────────────────────────────
function ExportacionInvestigacion() {
  const [estado, setEstado] = useState(null);   // null | "cargando" | { error } | { ok }

  const handleExportar = async () => {
    setEstado("cargando");
    try {
      const res = await authFetch("/admin/export/investigacion");
      if (!res.ok) throw new Error("HTTP_" + res.status);
      const blob = await res.blob();
      const disp = res.headers.get("content-disposition") || "";
      const nombre = (disp.match(/filename="([^"]+)"/) || [])[1] || "endoscan_investigacion.csv";
      const enlace = document.createElement("a");
      enlace.href = URL.createObjectURL(blob);
      enlace.download = nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 1000);
      setEstado({ ok: true });
      toast.success("Exportación generada", nombre + " · registrada en la bitácora.");
    } catch {
      setEstado({ error: "No se pudo generar la exportación." });
    }
  };

  return h("div", { className: "card card-pad" },
    h("div", { className: "section-title" }, "Exportación anonimizada"),
    h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, lineHeight: 1.6 } },
      "CSV con fecha (día), clase, probabilidad y latencia. Solo incluye estudios de cuentas que ",
      "autorizaron el uso para investigación, sin correos, sin código de paciente y sin imágenes. ",
      "Cada exportación queda en la bitácora."),
    h("button", { type: "button", className: "btn btn-secondary", onClick: handleExportar,
                  disabled: estado === "cargando" },
      h(I.dl, { size: 14 }), estado === "cargando" ? "Generando…" : "Descargar CSV"),
    estado && estado.error && h("div", { className: "alert alert-error", style: { marginTop: 12 } },
      h(I.alert, { size: 16 }), h("div", null, estado.error)),
  );
}

export function BitacoraScreen() {
  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Bitácora y privacidad"),
        h("div", { className: "page-sub" }, "Trazabilidad de acciones críticas y derechos de los titulares (Ley N.° 29733)"),
      ),
      h("span", { className: "badge badge-info" },
        h(I.shield, { size: 11, "aria-hidden": true }), " Acceso administrador"),
    ),
    h(Bitacora, null),
    h("div", { className: "bitacora-grid" },
      h(SolicitudesArco, null),
      h(ExportacionInvestigacion, null),
    ),
  );
}
