// Ajustes de privacidad y derechos ARCO (Ley N.° 29733).
//
// Aquí el titular de la cuenta revisa lo que autorizó, revoca las cláusulas
// opcionales cuando quiera, descarga sus datos y presenta solicitudes ARCO.
// Cada cambio se registra en el backend con fecha, versión e IP; la interfaz
// solo refleja lo que el servidor confirmó.

import { I } from "../icons.js";
import {
  getConsents, saveConsents, getConsentHistory, downloadMyData,
  createArcoRequest, getArcoRequests, ARCO_TIPOS, ARCO_ESTADO_LABEL,
} from "../privacy.js";

const React = window.React;
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

const CLAUSULA_LABEL = {
  terminos: "Términos del servicio",
  archivo_imagenes: "Archivar imágenes",
  uso_investigacion: "Uso para investigación",
};

// El backend serializa UTC sin zona: sin la "Z", el navegador lo leería como
// hora local y la fecha aparecería desplazada cinco horas en Perú.
function fmtFecha(iso) {
  if (!iso) return "—";
  const texto = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z";
  const d = new Date(texto);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("es-PE", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function EstadoArco({ estado }) {
  const clase = estado === "atendida" ? "badge-neg" : estado === "rechazada" ? "badge-pos" : "badge-warn";
  return h("span", { className: "badge " + clase }, ARCO_ESTADO_LABEL[estado] || estado);
}

export function PrivacyPanel({ consents, onConsentsChange }) {
  const [estado, setEstado] = useState(consents);
  const [guardando, setGuardando] = useState(null);       // id de cláusula
  const [aviso, setAviso] = useState(null);                 // { tipo, texto }
  const [historial, setHistorial] = useState(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const [descargando, setDescargando] = useState(false);

  const [tipoArco, setTipoArco] = useState("acceso");
  const [detalleArco, setDetalleArco] = useState("");
  const [enviandoArco, setEnviandoArco] = useState(false);
  const [solicitudes, setSolicitudes] = useState([]);

  const cargarSolicitudes = useCallback(() => {
    getArcoRequests().then(setSolicitudes).catch(() => {});
  }, []);

  useEffect(() => {
    let vivo = true;
    getConsents().then((e) => { if (vivo) setEstado(e); }).catch(() => {});
    cargarSolicitudes();
    return () => { vivo = false; };
  }, [cargarSolicitudes]);

  const handleCambiar = async (clausula, aceptado) => {
    if (guardando) return;   // early return: una decisión a la vez
    setGuardando(clausula.id);
    setAviso(null);
    try {
      const nuevo = await saveConsents({ clausulas: { [clausula.id]: aceptado } });
      setEstado(nuevo);
      onConsentsChange && onConsentsChange(nuevo);
      setHistorial(null);     // la traza cambió: se recarga al abrirla
      setAviso({ tipo: "info", texto: (aceptado ? "Autorizó: " : "Revocó: ") + clausula.titulo +
        ". La decisión quedó registrada con fecha e IP." });
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No se pudo guardar la decisión." });
    } finally {
      setGuardando(null);
    }
  };

  const handleVerHistorial = async () => {
    const abrir = !verHistorial;
    setVerHistorial(abrir);
    if (abrir && !historial) {
      try { setHistorial(await getConsentHistory()); }
      catch { setHistorial([]); }
    }
  };

  const handleDescargar = async () => {
    setDescargando(true);
    setAviso(null);
    try {
      await downloadMyData();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No se pudo generar la descarga." });
    } finally {
      setDescargando(false);
    }
  };

  const handleEnviarArco = async (e) => {
    e.preventDefault();
    if (enviandoArco) return;   // early return
    setEnviandoArco(true);
    setAviso(null);
    try {
      await createArcoRequest(tipoArco, detalleArco.trim());
      setDetalleArco("");
      setAviso({ tipo: "info", texto: "Solicitud registrada. El administrador la atenderá y verá aquí su estado." });
      cargarSolicitudes();
    } catch (err) {
      setAviso({ tipo: "error", texto: err.message || "No se pudo registrar la solicitud." });
    } finally {
      setEnviandoArco(false);
    }
  };

  const clausulas = (estado && estado.clausulas) || [];
  const terminos = clausulas.find((c) => c.obligatoria);
  const opcionales = clausulas.filter((c) => !c.obligatoria);
  const tipoActual = ARCO_TIPOS.find((t) => t.id === tipoArco);

  return h("div", { className: "card card-pad privacy-panel" },
    h("div", { className: "section-title" }, "Privacidad y datos personales"),
    h("p", { className: "privacy-lead" },
      "Ley N.° 29733 de Protección de Datos Personales. Cada autorización y revocación ",
      "se registra con fecha, versión del acuerdo e IP."),

    aviso && h("div", {
      className: "alert " + (aviso.tipo === "error" ? "alert-error" : "alert-info"),
      role: aviso.tipo === "error" ? "alert" : "status",
      style: { marginBottom: 14 },
    }, h(aviso.tipo === "error" ? I.alert : I.check, { size: 16 }), h("div", null, aviso.texto)),

    h("div", { className: "privacy-grid" },
      // ── Autorizaciones ────────────────────────────────────────────────
      h("div", null,
        h("div", { className: "privacy-subtitle" }, "Autorizaciones"),
        terminos && h("div", { className: "privacy-row" },
          h("div", null,
            h("div", { className: "privacy-row-title" }, terminos.titulo),
            h("div", { className: "privacy-row-sub" },
              terminos.aceptado
                ? "Obligatoria · aceptada el " + fmtFecha(terminos.fecha) + " · versión " + terminos.version
                : "Obligatoria · pendiente de aceptar"),
          ),
          h("span", { className: "badge " + (terminos.aceptado ? "badge-neg" : "badge-warn") },
            terminos.aceptado ? "Aceptada" : "Pendiente"),
        ),
        opcionales.map((c) =>
          h("div", { key: c.id, className: "privacy-row" },
            h("div", null,
              h("div", { className: "privacy-row-title" }, c.titulo, " ",
                h("span", { className: "privacy-optional-tag" }, "opcional")),
              h("div", { className: "privacy-row-sub" }, c.descripcion),
              c.fecha && h("div", { className: "privacy-row-sub" },
                (c.aceptado ? "Autorizada" : "No autorizada") + " · decidido el " + fmtFecha(c.fecha)),
            ),
            h("button", {
              type: "button",
              className: "switch" + (c.aceptado ? " on" : ""),
              role: "switch",
              "aria-checked": c.aceptado,
              "aria-label": c.titulo,
              disabled: guardando !== null || !(terminos && terminos.aceptado),
              onClick: () => handleCambiar(c, !c.aceptado),
            }, h("span", { className: "switch-knob" })),
          ),
        ),
        !estado && h("div", { className: "muted", style: { fontSize: 13 } }, "Cargando autorizaciones…"),

        h("div", { className: "row", style: { gap: 8, marginTop: 14, flexWrap: "wrap" } },
          h("button", { type: "button", className: "btn btn-secondary", onClick: handleDescargar, disabled: descargando },
            h(I.dl, { size: 14 }), descargando ? "Preparando…" : "Descargar mis datos (JSON)"),
          h("button", { type: "button", className: "btn btn-ghost", onClick: handleVerHistorial,
                        "aria-expanded": verHistorial },
            h(I.history, { size: 14 }), verHistorial ? "Ocultar historial" : "Historial de decisiones"),
        ),

        verHistorial && h("div", { className: "table-wrap", style: { marginTop: 12 } },
          !historial
            ? h("div", { className: "muted", style: { fontSize: 13 } }, "Cargando…")
            : historial.length === 0
              ? h("div", { className: "muted", style: { fontSize: 13 } }, "Sin decisiones registradas.")
              : h("table", { className: "table" },
                  h("thead", null, h("tr", null,
                    h("th", null, "Fecha"), h("th", null, "Cláusula"),
                    h("th", null, "Decisión"), h("th", null, "IP"))),
                  h("tbody", null, historial.map((fila, i) =>
                    h("tr", { key: i },
                      h("td", null, fmtFecha(fila.fecha)),
                      h("td", null, CLAUSULA_LABEL[fila.clausula] || fila.clausula),
                      h("td", null, h("span", { className: "badge " + (fila.aceptado ? "badge-neg" : "badge-neutral") },
                        fila.aceptado ? "Autorizó" : "No autorizó")),
                      h("td", { className: "mono" }, fila.ip || "—"),
                    ))),
                ),
        ),
      ),

      // ── Derechos ARCO ─────────────────────────────────────────────────
      h("div", null,
        h("div", { className: "privacy-subtitle" }, "Ejercer mis derechos ARCO"),
        h("form", { onSubmit: handleEnviarArco, className: "privacy-arco-form" },
          h("label", { className: "auth-label", htmlFor: "arco-tipo" }, "Tipo de solicitud"),
          h("select", {
            id: "arco-tipo", className: "select", value: tipoArco,
            onChange: (e) => setTipoArco(e.target.value),
          }, ARCO_TIPOS.map((t) => h("option", { key: t.id, value: t.id }, t.label))),
          tipoActual && h("div", { className: "privacy-row-sub" }, tipoActual.hint),
          h("label", { className: "auth-label", htmlFor: "arco-detalle", style: { marginTop: 8 } }, "Detalle"),
          h("textarea", {
            id: "arco-detalle", className: "input", rows: 3, maxLength: 2000, required: true, minLength: 10,
            value: detalleArco, onChange: (e) => setDetalleArco(e.target.value),
            placeholder: "Describa qué dato y qué necesita (mínimo 10 caracteres).",
          }),
          h("button", { type: "submit", className: "btn btn-primary", disabled: enviandoArco || detalleArco.trim().length < 10 },
            h(I.mail, { size: 14 }), enviandoArco ? "Enviando…" : "Enviar solicitud"),
        ),

        solicitudes.length > 0 && h("div", { style: { marginTop: 14 } },
          h("div", { className: "privacy-row-sub", style: { marginBottom: 6 } }, "Mis solicitudes"),
          solicitudes.map((s) =>
            h("div", { key: s.id, className: "privacy-arco-item" },
              h("div", { className: "row between" },
                h("strong", null, (ARCO_TIPOS.find((t) => t.id === s.tipo) || {}).label || s.tipo),
                h(EstadoArco, { estado: s.estado }),
              ),
              h("div", { className: "privacy-row-sub" }, fmtFecha(s.created_at) + " · " + s.detalle),
              s.respuesta && h("div", { className: "privacy-row-sub" }, h("strong", null, "Respuesta: "), s.respuesta),
            )),
        ),
      ),
    ),
  );
}
