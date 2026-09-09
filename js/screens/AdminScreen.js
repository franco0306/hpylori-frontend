// Panel de administración técnica.
//
// Solo visible para cuentas con rol `admin`. Reúne lo que el gastroenterólogo
// no debe tocar: calibración del motor, salud del almacenamiento y cuentas.
//
// NOTA DE INTEGRACIÓN — el backend todavía no expone endpoints de
// administración (`/admin/users`, `/admin/storage`, `/admin/maintenance/purge`).
// Cada módulo los consulta y, si no existen, muestra el estado real de esa
// carencia en lugar de inventar cifras: un panel de administración que enseña
// datos ficticios es peor que uno vacío.

import { I } from "../icons.js";
import { CONFIG } from "../config.js";
import { authFetch } from "../auth.js";
import { getStudies } from "../history.js";
import { ROLES, ROLE_LABEL, normalizeRole } from "../roles.js";

const React = window.React;
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

// Tamaño medio por fila del esquema finito de `studies`:
// uuid(36) + user_id(4) + created_at(8) + clase(16) + probabilidad(8) +
// latencia_ms(8) + paciente_id(64), más índices y sobrecarga de página.
const BYTES_POR_ESTUDIO = 200;

// Cuota del plan gratuito de Supabase, usada como referencia del consumo.
const CUOTA_BYTES = 500 * 1024 * 1024;

const UMBRAL_POR_DEFECTO = 0.5;

function fmtBytes(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

// ── Módulo: calibración del umbral global ────────────────────────────────────
function CalibracionUmbral({ umbral, onChange, onSave, guardando, guardado, error }) {
  return h("div", { className: "card card-pad" },
    h("div", { className: "section-title" }, "Calibración del umbral operativo"),
    h("p", { style: { fontSize: 13, color: "var(--ink-600)", marginTop: 0, marginBottom: 18, lineHeight: 1.6 } },
      "Punto de corte con el que el motor ResNet-50 decide marcar una imagen como ",
      "sospechosa. Es el valor con el que opera el sistema de forma autónoma cuando ",
      "el profesional no fija uno propio.",
    ),

    h("div", { className: "row between", style: { marginBottom: 10 } },
      h("label", { htmlFor: "admin-umbral", style: { fontSize: 12.5, color: "var(--ink-600)" } },
        "Umbral operativo"),
      h("span", { className: "mono", style: { fontSize: 24, fontWeight: 700, color: "var(--blue-700)" } },
        umbral.toFixed(2)),
    ),

    h("input", {
      id: "admin-umbral",
      className: "slider",
      type: "range",
      min: "0.10", max: "0.90", step: "0.05",
      value: umbral,
      onChange: (e) => onChange(Number(e.target.value)),
      "aria-label": "Umbral operativo global del motor ResNet-50",
      "aria-valuetext": umbral.toFixed(2),
      style: { marginBottom: 10 },
    }),

    h("div", { className: "row between", style: { fontSize: 11, color: "var(--ink-400)", marginBottom: 16 } },
      h("span", null, "0.10 · detecta más"),
      h("span", null, "0.50 · por defecto"),
      h("span", null, "0.90 · exige más certeza"),
    ),

    h("div", { className: "alert alert-info", style: { marginBottom: 16 } },
      h(I.info, { size: 14 }),
      h("div", { style: { fontSize: 12, lineHeight: 1.5 } },
        "El motor se validó con un punto de corte de 0.255. Alejarse de él desplaza ",
        "la sensibilidad y la especificidad respecto de las cifras publicadas.",
      ),
    ),

    error && h("div", { className: "alert alert-error", style: { marginBottom: 12 } },
      h(I.alert, { size: 14 }),
      h("div", { style: { fontSize: 12.5 } }, error),
    ),

    h("button", {
      className: "btn btn-primary",
      onClick: onSave,
      disabled: guardando,
      "aria-label": "Guardar el umbral operativo",
    },
      guardando ? h("span", { className: "spinner-sm" }) : h(I.check, { size: 14 }),
      guardando ? "Guardando…" : guardado ? "Guardado" : "Guardar calibración",
    ),
  );
}

// ── Módulo: auditoría de base de datos y almacenamiento ──────────────────────
function AuditoriaAlmacenamiento({ total, cargando, purgando, purgaResultado, onPurgar }) {
  const bytes = total * BYTES_POR_ESTUDIO;
  const consumo = Math.min(100, (bytes / CUOTA_BYTES) * 100);
  const consumoTexto = consumo < 0.01 && bytes > 0 ? "< 0.01" : consumo.toFixed(2);

  return h("div", { className: "card card-pad" },
    h("div", { className: "section-title" }, "Auditoría de base de datos y almacenamiento"),

    h("div", { className: "admin-metrics" },
      h("div", { className: "admin-metric" },
        h("div", { className: "admin-metric-label" }, "Estudios registrados"),
        h("div", { className: "admin-metric-value" }, cargando ? "…" : total),
        h("div", { className: "admin-metric-hint" }, "Filas en la tabla de estudios"),
      ),
      h("div", { className: "admin-metric" },
        h("div", { className: "admin-metric-label" }, "Almacenamiento estimado"),
        h("div", { className: "admin-metric-value" }, cargando ? "…" : fmtBytes(bytes)),
        h("div", { className: "admin-metric-hint" }, "≈ 200 B por estudio (solo metadatos)"),
      ),
      h("div", { className: "admin-metric" },
        h("div", { className: "admin-metric-label" }, "Cuota consumida"),
        h("div", { className: "admin-metric-value" }, cargando ? "…" : consumoTexto + " %"),
        h("div", { className: "admin-metric-hint" }, "Sobre 500 MB del plan"),
      ),
    ),

    h("div", { className: "admin-quota", role: "img", "aria-label": "Cuota consumida: " + consumoTexto + " por ciento" },
      h("div", { className: "admin-quota-fill", style: { width: Math.max(0.6, consumo) + "%" } }),
    ),

    h("div", { className: "alert alert-info", style: { marginTop: 16 } },
      h(I.info, { size: 14 }),
      h("div", { style: { fontSize: 12, lineHeight: 1.5 } },
        h("strong", null, "Cifras estimadas. "),
        "Se calculan desde el número de estudios visibles y el tamaño conocido del ",
        "esquema. Para lecturas exactas hace falta que el backend exponga ",
        h("code", null, "/admin/storage"), ".",
      ),
    ),

    purgaResultado && h("div", {
      className: "alert " + (purgaResultado.ok ? "alert-info" : "alert-warn"),
      style: { marginTop: 12 },
      role: "status",
    },
      h(purgaResultado.ok ? I.check : I.alert, { size: 14 }),
      h("div", { style: { fontSize: 12.5 } }, purgaResultado.mensaje),
    ),

    h("button", {
      className: "btn btn-secondary",
      style: { marginTop: 16 },
      onClick: onPurgar,
      disabled: purgando,
      "aria-label": "Purgar registros huérfanos y temporales de la base de datos",
    },
      purgando ? h("span", { className: "spinner-sm" }) : h(I.trash, { size: 14 }),
      purgando ? "Purgando…" : "Purgar registros huérfanos/temporales",
    ),
  );
}

// ── Módulo: gestión de cuentas ───────────────────────────────────────────────
function GestionCuentas({ usuarios, cargando, disponible }) {
  return h("div", { className: "card" },
    h("div", { className: "card-head" },
      h("div", null,
        h("h3", { className: "card-title" }, "Gestión de cuentas"),
        h("div", { className: "card-sub" }, "Usuarios registrados y su nivel de acceso"),
      ),
      h("span", { className: "badge badge-neutral" }, usuarios.length),
    ),

    !disponible && h("div", { className: "alert alert-warn", style: { margin: "16px 20px 0" } },
      h(I.alert, { size: 14 }),
      h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } },
        h("strong", null, "Listado incompleto. "),
        "El backend aún no expone ", h("code", null, "/admin/users"),
        ", así que solo puede mostrarse la cuenta en sesión.",
      ),
    ),

    cargando
      ? h("div", { style: { padding: 24, textAlign: "center", color: "var(--ink-400)", fontSize: 13 } },
          "Cargando cuentas…")
      : h("table", { className: "table", style: { marginTop: 12 } },
          h("thead", null, h("tr", null,
            h("th", null, "Usuario"),
            h("th", null, "Correo"),
            h("th", null, "Rol"),
            h("th", null, "Estado"),
          )),
          h("tbody", null,
            usuarios.map((u) => {
              const rol = normalizeRole(u.role);
              return h("tr", { key: u.id || u.email },
                h("td", null,
                  h("div", { className: "row", style: { gap: 10 } },
                    h("div", { className: "avatar avatar-sm", "aria-hidden": true },
                      (u.full_name || u.email || "?").slice(0, 2).toUpperCase()),
                    h("span", { style: { fontWeight: 500 } }, u.full_name || "—"),
                  )),
                h("td", { className: "mono", style: { fontSize: 12 } }, u.email || "—"),
                h("td", null,
                  h("span", {
                    className: "badge " + (rol === ROLES.ADMIN ? "badge-info" : "badge-neutral"),
                  }, ROLE_LABEL[rol])),
                h("td", null,
                  h("span", { className: "row", style: { gap: 6, fontSize: 12.5 } },
                    h("span", {
                      className: "dot" + (u.activo === false ? " dot-offline" : ""),
                      "aria-hidden": true,
                    }),
                    u.activo === false ? "Inactivo" : "Activo")),
              );
            }),
          ),
        ),
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────
export function AdminScreen({ section = "panel", user, prefs, onSavePrefs }) {
  const [umbral, setUmbral] = useState(
    prefs && typeof prefs.threshold === "number" ? prefs.threshold : UMBRAL_POR_DEFECTO);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [errorUmbral, setErrorUmbral] = useState(null);

  const [total, setTotal] = useState(0);
  const [cargandoDatos, setCargandoDatos] = useState(true);
  const [purgando, setPurgando] = useState(false);
  const [purgaResultado, setPurgaResultado] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [usuariosDisponibles, setUsuariosDisponibles] = useState(false);

  useEffect(() => {
    let vivo = true;

    getStudies()
      .then((data) => { if (vivo) setTotal(Array.isArray(data) ? data.length : 0); })
      .catch(() => { if (vivo) setTotal(0); })
      .finally(() => { if (vivo) setCargandoDatos(false); });

    // Listado de cuentas: si el endpoint no existe, se degrada a la cuenta propia.
    authFetch("/admin/users")
      .then(async (res) => {
        if (!res.ok) throw new Error("HTTP_" + res.status);
        const data = await res.json();
        if (!vivo) return;
        setUsuarios(Array.isArray(data) ? data : []);
        setUsuariosDisponibles(true);
      })
      .catch(() => {
        if (!vivo) return;
        setUsuarios(user ? [{ ...user, activo: true }] : []);
        setUsuariosDisponibles(false);
      });

    return () => { vivo = false; };
  }, [user]);

  const handleGuardarUmbral = useCallback(async () => {
    setGuardando(true);
    setErrorUmbral(null);
    try {
      await onSavePrefs({ threshold: umbral });
      setGuardado(true);
      setTimeout(() => setGuardado(false), 2500);
    } catch {
      setErrorUmbral("No se pudo guardar la calibración. Verifique la conexión con el servidor.");
    } finally {
      setGuardando(false);
    }
  }, [umbral, onSavePrefs]);

  const handlePurgar = useCallback(async () => {
    setPurgando(true);
    setPurgaResultado(null);
    try {
      const res = await authFetch("/admin/maintenance/purge", { method: "POST" });
      if (!res.ok) throw new Error("HTTP_" + res.status);
      const data = await res.json().catch(() => ({}));
      setPurgaResultado({
        ok: true,
        mensaje: "Mantenimiento completado. Registros liberados: " + (data.eliminados ?? 0) + ".",
      });
    } catch {
      setPurgaResultado({
        ok: false,
        mensaje: "La tarea de mantenimiento no está disponible: el backend aún no implementa " +
                 "POST /admin/maintenance/purge. No se modificó ningún dato.",
      });
    } finally {
      setPurgando(false);
    }
  }, []);

  const titulos = {
    panel:     ["Panel de administración", "Estado operativo del sistema y de las cuentas"],
    auditoria: ["Auditoría y cuotas", "Consumo de almacenamiento y mantenimiento de la base"],
    config:    ["Configuración global", "Parámetros con los que opera el motor de análisis"],
  };
  const [titulo, subtitulo] = titulos[section] || titulos.panel;

  const verCalibracion = section === "panel" || section === "config";
  const verAuditoria   = section === "panel" || section === "auditoria";
  const verCuentas     = section === "panel" || section === "auditoria";

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, titulo),
        h("div", { className: "page-sub" }, subtitulo),
      ),
      h("span", { className: "badge badge-info" },
        h(I.shield, { size: 11, "aria-hidden": true }), " Acceso administrador"),
    ),

    h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: verCalibracion && verAuditoria ? "1fr 1fr" : "1fr",
        gap: 20,
        marginBottom: verCuentas ? 20 : 0,
      },
    },
      verCalibracion && h(CalibracionUmbral, {
        umbral, onChange: setUmbral, onSave: handleGuardarUmbral,
        guardando, guardado, error: errorUmbral,
      }),
      verAuditoria && h(AuditoriaAlmacenamiento, {
        total, cargando: cargandoDatos, purgando, purgaResultado, onPurgar: handlePurgar,
      }),
    ),

    verCuentas && h(GestionCuentas, {
      usuarios, cargando: false, disponible: usuariosDisponibles,
    }),
  );
}
