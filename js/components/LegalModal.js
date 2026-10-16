// Acuerdo de Términos del Servicio y Privacidad de Datos Médicos.
//
// Se muestra en el primer inicio de sesión y queda accesible desde el pie de
// pantalla. La aceptación se registra en el BACKEND con versión, fecha e IP:
// eso es lo que tiene valor probatorio. El navegador solo guarda una copia
// para no volver a pedirla mientras el servidor despierta.
//
// Las cláusulas opcionales nacen DESMARCADAS (Ley N.° 29733): el consentimiento
// para datos accesorios tiene que ser un acto expreso, no una casilla que el
// usuario olvida quitar. Se pueden cambiar después en Configuración.

import { I } from "../icons.js";
import { saveConsents } from "../privacy.js";

const React = window.React;
const { useEffect, useRef, useState } = React;
const h = React.createElement;

// Al cambiar el texto legal se sube la versión: quien aceptó la anterior
// vuelve a ver el acuerdo en lugar de quedar vinculado en silencio.
// Debe coincidir con `VERSION_TERMINOS` del backend.
export const LEGAL_VERSION = "2026-10-v3";

// Respaldo si el servidor no devolvió el catálogo de cláusulas.
const OPCIONALES_POR_DEFECTO = [
  { id: "mejora_modelo", titulo: "Ayudar a mejorar el modelo",
    descripcion: "Usar las imágenes de mis estudios con diagnóstico confirmado para reentrenar " +
                 "el modelo, sin código de paciente ni datos de mi cuenta." },
];

const STORAGE_PREFIX = "endoscan.legal.";

function storageKey(user) {
  const id = (user && (user.email || user.id)) || "anonimo";
  return STORAGE_PREFIX + String(id).toLowerCase();
}

/** `true` si este usuario ya aceptó la versión vigente del acuerdo. */
export function hasAcceptedLegal(user) {
  try {
    return window.localStorage.getItem(storageKey(user)) === LEGAL_VERSION;
  } catch {
    // Almacenamiento bloqueado: se vuelve a pedir la aceptación cada sesión.
    return false;
  }
}

export function storeLegalAcceptance(user) {
  try {
    window.localStorage.setItem(storageKey(user), LEGAL_VERSION);
  } catch { /* noop */ }
}

// Selector de todo lo que puede recibir foco dentro del diálogo.
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function LegalModal({ open, user, onAccept, onClose, dismissible = false, consents = null }) {
  const [accepted, setAccepted] = useState(false);
  const [opcionales, setOpcionales] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const dialogRef = useRef(null);
  const checkboxRef = useRef(null);

  // Foco inicial y confinamiento del tabulador dentro del diálogo.
  useEffect(() => {
    if (!open) return undefined;

    const previous = document.activeElement;
    if (checkboxRef.current) checkboxRef.current.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape" && dismissible) {
        e.preventDefault();
        onClose && onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const items = Array.from(dialogRef.current.querySelectorAll(FOCUSABLE));
      if (!items.length) return;

      const first = items[0];
      const last = items[items.length - 1];

      // Ciclo cerrado: el foco no debe escaparse al fondo bloqueado.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = overflow;
      if (previous && previous.focus) previous.focus();
    };
  }, [open, dismissible, onClose]);

  useEffect(() => {
    if (!open) return;
    setAccepted(false);
    setOpcionales({});       // siempre desmarcadas al abrir
    setError(null);
  }, [open]);

  if (!open) return null;   // early return

  const clausulasOpcionales = (consents && consents.clausulas
    ? consents.clausulas.filter((c) => !c.obligatoria)
    : OPCIONALES_POR_DEFECTO);

  const handleToggle = (e) => setAccepted(e.target.checked);
  const handleOpcional = (id) => (e) =>
    setOpcionales((prev) => ({ ...prev, [id]: e.target.checked }));

  const handleAccept = async () => {
    if (!accepted || enviando) return;   // early return
    setEnviando(true);
    setError(null);
    try {
      const clausulas = {};
      clausulasOpcionales.forEach((c) => { clausulas[c.id] = Boolean(opcionales[c.id]); });
      const estado = await saveConsents({ terminosVersion: LEGAL_VERSION, clausulas });
      storeLegalAcceptance(user);
      onAccept && onAccept(estado);
    } catch (err) {
      setError(err.estado === 409
        ? "El acuerdo se actualizó. Recargue la página para leer la versión vigente."
        : "No se pudo registrar su aceptación. Compruebe su conexión y reintente.");
    } finally {
      setEnviando(false);
    }
  };

  return h("div", {
    className: "modal-backdrop",
    onMouseDown: (e) => {
      if (dismissible && e.target === e.currentTarget) onClose && onClose();
    },
  },
    h("div", {
      ref: dialogRef,
      className: "modal",
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "legal-title",
      "aria-describedby": "legal-body",
    },
      h("div", { className: "modal-head" },
        h("div", { className: "modal-mark", "aria-hidden": true }, h(I.shield, { size: 20 })),
        h("div", null,
          h("h2", { className: "modal-title", id: "legal-title" },
            "Términos del servicio y privacidad de datos médicos"),
          h("div", { className: "modal-sub" },
            "Versión ", LEGAL_VERSION, " · Léalo antes de utilizar la herramienta"),
        ),
        dismissible && h("button", {
          type: "button",
          className: "btn btn-ghost btn-icon",
          onClick: onClose,
          "aria-label": "Cerrar el acuerdo",
        }, h(I.x, { size: 16 })),
      ),

      h("div", { className: "modal-body", id: "legal-body", tabIndex: 0 },

        h("section", { className: "legal-section" },
          h("h3", { className: "legal-heading" }, "1. Naturaleza del software"),
          h("p", null,
            "EndoScan AI es un ",
            h("strong", null, "sistema de soporte a la decisión clínica (CDSS)"),
            " en nivel de madurez tecnológica ",
            h("strong", null, "TRL 6"),
            ": validado en entorno representativo, ",
            h("strong", null, "no en uso asistencial rutinario"),
            ".",
          ),
          h("p", null,
            "Sus resultados son ",
            h("strong", null, "orientativos y no vinculantes"),
            ". No constituyen un diagnóstico médico ni sustituyen el juicio del ",
            "profesional. La responsabilidad de toda decisión diagnóstica o terapéutica ",
            "recae íntegramente en el gastroenterólogo tratante, quien debe confirmar ",
            "los hallazgos mediante prueba de ureasa, histología o test del aliento.",
          ),
          h("p", null,
            "El sistema no está certificado como producto sanitario ni autorizado por ",
            "DIGEMID para uso diagnóstico.",
          ),
        ),

        h("section", { className: "legal-section" },
          h("h3", { className: "legal-heading" },
            "2. Tratamiento de datos personales (Ley N.° 29733)"),
          h("p", null,
            "En cumplimiento de la ",
            h("strong", null, "Ley N.° 29733, Ley de Protección de Datos Personales"),
            ", y su reglamento (D.S. N.° 003-2013-JUS), el titular de la cuenta se ",
            "obliga a lo siguiente:",
          ),
          h("ul", { className: "legal-list" },
            h("li", null,
              h("strong", null, "Desidentificación previa. "),
              "Las imágenes endoscópicas deben cargarse sin datos personales directos: ",
              "sin nombres, DNI, número de historia clínica identificable ni marcas de ",
              "agua del equipo que revelen la identidad del paciente.",
            ),
            h("li", null,
              h("strong", null, "Identificadores disociados. "),
              "El campo de paciente admite únicamente un código interno reversible solo ",
              "por el establecimiento de salud. No introduzca nombres ni documentos.",
            ),
            h("li", null,
              h("strong", null, "Datos sensibles. "),
              "La información de salud es un dato sensible conforme al artículo 2.5 de la ",
              "Ley. Su tratamiento sin desidentificar exige consentimiento expreso, previo ",
              "e informado del paciente, que el profesional debe recabar y custodiar.",
            ),
            h("li", null,
              h("strong", null, "Historial de estudios. "),
              "De cada análisis se guarda la imagen endoscópica, su mapa Grad-CAM, el resultado ",
              "y el código de paciente, para que pueda revisarlo después. Las imágenes van a un ",
              "almacenamiento ",
              h("strong", null, "privado y cifrado"),
              ": solo se ven con enlaces temporales emitidos para su cuenta, y se borran al ",
              "eliminar el estudio.",
            ),
            h("li", null,
              h("strong", null, "Derechos ARCO. "),
              "Sobre los datos de su cuenta puede ejercer los derechos de acceso, rectificación, ",
              "cancelación y oposición desde ",
              h("strong", null, "Configuración → Privacidad y datos personales"),
              ", donde también puede descargar sus datos y revocar las autorizaciones opcionales. ",
              "Los pacientes ejercen esos derechos ante el establecimiento de salud responsable ",
              "del banco de datos clínico.",
            ),
          ),
        ),

        h("section", { className: "legal-section" },
          h("h3", { className: "legal-heading" }, "3. Seguridad y trazabilidad"),
          h("p", null,
            "Toda comunicación viaja cifrada por HTTPS y las contraseñas se guardan con ",
            "hash bcrypt. Cada acceso, cambio de permisos, exportación y decisión sobre este ",
            "acuerdo queda en una bitácora de auditoría con fecha, hora e IP, que ningún ",
            "usuario puede modificar ni borrar.",
          ),
        ),

        h("section", { className: "legal-section" },
          h("h3", { className: "legal-heading" }, "4. Uso académico"),
          h("p", null,
            "Esta plataforma se desarrolla en el marco del Taller Integrador de la ",
            "Universidad Privada Antenor Orrego con fines de investigación y formación. ",
            "No debe emplearse como único sustento de una conducta clínica.",
          ),
        ),
      ),

      // Releer el acuerdo no vuelve a pedir la aceptación: las autorizaciones
      // se cambian en Configuración, donde queda cada decisión registrada.
      dismissible && h("div", { className: "modal-foot" },
        h("div", { className: "muted", style: { fontSize: 12.5, lineHeight: 1.55 } },
          "Puede revisar o revocar sus autorizaciones opcionales y ejercer sus derechos ARCO en ",
          h("strong", null, "Configuración → Privacidad y datos personales"), "."),
        h("div", { className: "modal-actions" },
          h("button", { type: "button", className: "btn btn-secondary", onClick: onClose }, "Cerrar"),
        ),
      ),

      !dismissible && h("div", { className: "modal-foot" },
        h("div", { className: "legal-optional" },
          h("div", { className: "legal-optional-title" }, "Autorizaciones opcionales"),
          h("div", { className: "legal-optional-sub" },
            "No son necesarias para usar el sistema. Puede cambiarlas cuando quiera."),
          clausulasOpcionales.map((c) =>
            h("label", { key: c.id, className: "legal-accept legal-accept-optional" },
              h("input", {
                type: "checkbox",
                checked: Boolean(opcionales[c.id]),
                onChange: handleOpcional(c.id),
              }),
              h("span", null, h("strong", null, c.titulo), " — ", c.descripcion),
            ),
          ),
        ),
        h("label", { className: "legal-accept" },
          h("input", {
            ref: checkboxRef,
            type: "checkbox",
            checked: accepted,
            onChange: handleToggle,
            "aria-describedby": "legal-accept-text",
          }),
          h("span", { id: "legal-accept-text" },
            "He leído y acepto los términos. Confirmo que las imágenes que cargue ",
            "estarán desidentificadas conforme a la Ley N.° 29733.",
          ),
        ),
        error && h("div", { className: "alert alert-error", role: "alert", style: { marginTop: 12 } },
          h(I.alert, { size: 16 }), h("div", null, error)),
        h("div", { className: "modal-actions" },
          h("button", {
            type: "button",
            className: "btn btn-primary",
            onClick: handleAccept,
            disabled: !accepted || enviando,
            "aria-label": "Aceptar los términos y continuar",
          }, h(I.check, { size: 14 }), enviando ? "Registrando…" : "Aceptar y continuar"),
        ),
      ),
    ),
  );
}
