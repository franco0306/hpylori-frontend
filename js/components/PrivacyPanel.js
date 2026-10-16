// Mis datos y privacidad (Ley N.° 29733), en lenguaje llano.
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
import { EmptyState, Skeleton } from "../ui/states.jsx";
import { toast } from "../ui/toast.jsx";

const React = window.React;
const { useState, useEffect, useCallback } = React;
const h = React.createElement;

const CLAUSULA_LABEL = {
  terminos: "Términos de uso",
  archivo_imagenes: "Guardar imágenes",
  uso_investigacion: "Estadísticas (versión anterior)",
  mejora_modelo: "Mejorar el modelo",
};

// Textos en lenguaje llano para las opciones: el servidor guarda la redacción
// legal; aquí se explica qué significa para el médico.
const TEXTOS_OPCIONALES = {
  mejora_modelo: {
    titulo: "Ayudar a mejorar el modelo",
    desc: "Cuando registre el resultado confirmado de un estudio (ureasa, biopsia…), esa imagen " +
          "y ese resultado se usarán para reentrenar el modelo y que acierte más. Nunca se usa " +
          "el código del paciente ni su nombre. Puede cambiarlo cuando quiera.",
  },
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
  const [arcoAbierto, setArcoAbierto] = useState(false);

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
      toast.success(aceptado ? "Opción activada" : "Opción desactivada", clausula.titulo + ".");
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
      toast.success("Solicitud enviada", "El administrador la atenderá; verá aquí la respuesta.");
      setArcoAbierto(false);
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
  const pendientes = solicitudes.filter((x) => x.estado === "pendiente").length;

  return h("div", { className: "card card-pad privacy-panel" },
    h("div", { className: "section-title" }, "Mis datos y privacidad"),
    h("p", { className: "privacy-lead" },
      "Qué guarda el sistema de usted y qué puede pedir sobre ello. Lo exige la ",
      "Ley N.° 29733 de Protección de Datos Personales."),

    aviso && h("div", {
      className: "alert alert-error", role: "alert", style: { marginBottom: 14 },
    }, h(I.alert, { size: 16 }), h("div", null, aviso.texto)),

    h("div", { className: "privacy-grid" },
      h("div", null,
        // Lo obligatorio, en una línea.
        terminos && h("div", { className: "privacy-row" },
          h("div", null,
            h("div", { className: "privacy-row-title" }, "Términos de uso"),
            h("div", { className: "privacy-row-sub" },
              "Necesarios para usar el sistema: su cuenta y el historial de sus análisis (con sus imágenes). ",
              terminos.aceptado ? "Aceptados el " + fmtFecha(terminos.fecha) + "." : "Pendientes de aceptar."),
          ),
          h("span", { className: "badge " + (terminos.aceptado ? "badge-neg" : "badge-warn") },
            terminos.aceptado ? "Aceptados" : "Pendiente"),
        ),

        // Lo opcional: hoy, solo ayudar a mejorar el modelo.
        opcionales.map((c) => {
          const texto = TEXTOS_OPCIONALES[c.id] || { titulo: c.titulo, desc: c.descripcion };
          return h("div", { key: c.id, className: "privacy-row" },
            h("div", null,
              h("div", { className: "privacy-row-title" }, texto.titulo, " ",
                h("span", { className: "privacy-optional-tag" }, "opcional")),
              h("div", { className: "privacy-row-sub" }, texto.desc),
            ),
            h("button", {
              type: "button",
              className: "switch" + (c.aceptado ? " on" : ""),
              role: "switch",
              "aria-checked": c.aceptado,
              "aria-label": texto.titulo,
              disabled: guardando !== null || !(terminos && terminos.aceptado),
              onClick: () => handleCambiar({ ...c, titulo: texto.titulo }, !c.aceptado),
            }, h("span", { className: "switch-knob" })),
          );
        }),
        !estado && h("div", { role: "status", "aria-label": "Cargando" },
          [0, 1].map((i) => h("div", { key: i, className: "privacy-row" },
            h("div", { style: { flex: 1, display: "flex", flexDirection: "column", gap: 8 } },
              h(Skeleton, { style: { height: 12, width: "45%", borderRadius: 4 } }),
              h(Skeleton, { style: { height: 10, width: "85%", borderRadius: 4 } })),
            h(Skeleton, { style: { height: 24, width: 44, borderRadius: 999 } })))),

        h("div", { className: "row", style: { gap: 8, marginTop: 14, flexWrap: "wrap" } },
          h("button", { type: "button", className: "btn btn-secondary", onClick: handleDescargar, disabled: descargando,
                        title: "Un archivo con todo lo que el sistema guarda de su cuenta" },
            h(I.dl, { size: 14 }), descargando ? "Preparando…" : "Descargar mis datos"),
          h("button", { type: "button", className: "btn btn-ghost", onClick: handleVerHistorial,
                        "aria-expanded": verHistorial },
            h(I.history, { size: 14 }), verHistorial ? "Ocultar mis decisiones" : "Ver mis decisiones"),
        ),

        verHistorial && h("div", { className: "table-wrap", style: { marginTop: 12 } },
          !historial
            ? h("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
                [0, 1, 2].map((i) => h(Skeleton, { key: i, style: { height: 14, borderRadius: 4 } })))
            : historial.length === 0
              ? h(EmptyState, { icon: I.history, tone: "neutral", compact: true,
                  title: "Sin decisiones registradas",
                  description: "Cuando acepte o cambie una opción, quedará anotada aquí con su fecha." })
              : h("table", { className: "table" },
                  h("thead", null, h("tr", null,
                    h("th", null, "Fecha"), h("th", null, "Sobre"), h("th", null, "Decisión"))),
                  h("tbody", null, historial.map((fila, i) =>
                    h("tr", { key: i },
                      h("td", null, fmtFecha(fila.fecha)),
                      h("td", null, CLAUSULA_LABEL[fila.clausula] || fila.clausula),
                      h("td", null, h("span", { className: "badge " + (fila.aceptado ? "badge-neg" : "badge-neutral") },
                        fila.aceptado ? "Aceptó" : "No aceptó")),
                    ))),
                ),
        ),
      ),

      // ── Pedidos sobre sus datos (derechos ARCO) ───────────────────────────
      h("div", null,
        h("div", { className: "privacy-subtitle" }, "¿Necesita algo sobre sus datos?"),
        h("div", { className: "privacy-row-sub", style: { marginBottom: 12 } },
          "Puede pedir ver, corregir o borrar lo que el sistema guarda de su cuenta. ",
          "El administrador lo atiende y usted ve aquí la respuesta."),

        !arcoAbierto
          ? h("button", { type: "button", className: "btn btn-secondary", onClick: () => setArcoAbierto(true) },
              h(I.mail, { size: 14 }), "Hacer una solicitud")
          : h("form", { onSubmit: handleEnviarArco, className: "privacy-arco-form" },
              h("label", { className: "auth-label", htmlFor: "arco-tipo" }, "¿Qué necesita?"),
              h("select", {
                id: "arco-tipo", className: "select", value: tipoArco,
                onChange: (e) => setTipoArco(e.target.value),
              }, ARCO_TIPOS.map((t) => h("option", { key: t.id, value: t.id }, t.sencillo))),
              tipoActual && h("div", { className: "privacy-row-sub" }, tipoActual.hint),
              h("label", { className: "auth-label", htmlFor: "arco-detalle", style: { marginTop: 8 } }, "Cuéntenos"),
              h("textarea", {
                id: "arco-detalle", className: "input", rows: 3, maxLength: 2000, required: true, minLength: 10,
                value: detalleArco, onChange: (e) => setDetalleArco(e.target.value),
                placeholder: "Por ejemplo: mi nombre está mal escrito, debería ser…",
              }),
              h("div", { className: "row", style: { gap: 8, marginTop: 8 } },
                h("button", { type: "submit", className: "btn btn-primary", disabled: enviandoArco || detalleArco.trim().length < 10 },
                  h(I.mail, { size: 14 }), enviandoArco ? "Enviando…" : "Enviar solicitud"),
                h("button", { type: "button", className: "btn btn-ghost", onClick: () => setArcoAbierto(false) }, "Cancelar"),
              ),
              h("div", { className: "privacy-nota-legal" }, "Derechos ARCO: acceso, rectificación, cancelación y oposición."),
            ),

        solicitudes.length > 0 && h("div", { style: { marginTop: 14 } },
          h("div", { className: "privacy-row-sub", style: { marginBottom: 6 } },
            "Mis solicitudes" + (pendientes ? " · " + pendientes + " pendiente" + (pendientes === 1 ? "" : "s") : "")),
          solicitudes.map((x) =>
            h("div", { key: x.id, className: "privacy-arco-item" },
              h("div", { className: "row between" },
                h("strong", null, (ARCO_TIPOS.find((t) => t.id === x.tipo) || {}).sencillo || x.tipo),
                h(EstadoArco, { estado: x.estado }),
              ),
              h("div", { className: "privacy-row-sub" }, fmtFecha(x.created_at) + " · " + x.detalle),
              x.respuesta && h("div", { className: "privacy-row-sub" }, h("strong", null, "Respuesta: "), x.respuesta),
            )),
        ),
      ),
    ),
  );
}
