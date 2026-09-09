// Acuerdo de Términos del Servicio y Privacidad de Datos Médicos.
//
// Se muestra en el primer inicio de sesión y queda accesible desde el pie de
// pantalla. La aceptación se guarda por usuario en el navegador: no es un
// registro de consentimiento con valor probatorio —para eso haría falta
// almacenarlo en el backend con fecha, versión y usuario—, sino un recordatorio
// de que el médico leyó el alcance de la herramienta antes de usarla.

import { I } from "../icons.js";

const React = window.React;
const { useEffect, useRef, useState } = React;
const h = React.createElement;

// Al cambiar el texto legal se sube la versión: quien aceptó la anterior
// vuelve a ver el acuerdo en lugar de quedar vinculado en silencio.
export const LEGAL_VERSION = "2026-09-v1";

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

export function LegalModal({ open, user, onAccept, onClose, dismissible = false }) {
  const [accepted, setAccepted] = useState(false);
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
    if (open) setAccepted(false);
  }, [open]);

  if (!open) return null;   // early return

  const handleToggle = (e) => setAccepted(e.target.checked);

  const handleAccept = () => {
    if (!accepted) return;   // early return
    storeLegalAcceptance(user);
    onAccept && onAccept();
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
              h("strong", null, "Almacenamiento mínimo. "),
              "El sistema conserva únicamente metadatos del análisis —clase, probabilidad, ",
              "latencia, código de paciente y fecha—. Las imágenes no se almacenan en la ",
              "base de datos y solo permanecen en memoria mientras dure su sesión.",
            ),
            h("li", null,
              h("strong", null, "Derechos ARCO. "),
              "El titular de los datos puede ejercer sus derechos de acceso, rectificación, ",
              "cancelación y oposición ante el establecimiento de salud responsable del ",
              "banco de datos, no ante esta herramienta.",
            ),
          ),
        ),

        h("section", { className: "legal-section" },
          h("h3", { className: "legal-heading" }, "3. Uso académico"),
          h("p", null,
            "Esta plataforma se desarrolla en el marco del Taller Integrador de la ",
            "Universidad Privada Antenor Orrego con fines de investigación y formación. ",
            "No debe emplearse como único sustento de una conducta clínica.",
          ),
        ),
      ),

      h("div", { className: "modal-foot" },
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
        h("div", { className: "modal-actions" },
          dismissible && h("button", {
            type: "button",
            className: "btn btn-secondary",
            onClick: onClose,
          }, "Cerrar"),
          h("button", {
            type: "button",
            className: "btn btn-primary",
            onClick: handleAccept,
            disabled: !accepted,
            "aria-label": "Aceptar los términos y continuar",
          }, h(I.check, { size: 14 }), "Aceptar y continuar"),
        ),
      ),
    ),
  );
}
