// Diagnóstico confirmado de un estudio.
//
// Cuando llega el resultado de la prueba de referencia (ureasa, histología…),
// el médico lo registra aquí. Sirve para dos cosas: saber si el sistema acertó
// en ese caso y, si el médico lo autorizó, reentrenar el modelo con él.

import { I } from "../icons.js";
import { confirmStudy, unconfirmStudy } from "../history.js";
import { toast } from "../ui/toast.jsx";

const React = window.React;
const { useState } = React;
const h = React.createElement;

export const METODOS = [
  { id: "histologia", label: "Histología (biopsia)" },
  { id: "ureasa",     label: "Prueba de ureasa" },
  { id: "aliento",    label: "Test del aliento" },
  { id: "antigeno",   label: "Antígeno en heces" },
  { id: "cultivo",    label: "Cultivo" },
  { id: "otro",       label: "Otro método" },
];

export function nombreMetodo(id) {
  return (METODOS.find((m) => m.id === id) || {}).label || id;
}

/** Insignia corta para listas: confirmado y si el sistema acertó. */
export function InsigniaConfirmacion({ estudio }) {
  if (!estudio || !estudio.confirmado_clase) return null;
  const acierta = estudio.confirmado_clase === estudio.clase;
  return h("span", {
    className: "badge " + (acierta ? "badge-neg" : "badge-warn"),
    title: "Confirmado por " + nombreMetodo(estudio.confirmado_metodo) + ": " + estudio.confirmado_clase,
    style: { flexShrink: 0 },
  }, h(acierta ? I.check : I.alert, { size: 10 }), acierta ? " Confirmado" : " No coincide");
}

export function ConfirmacionPanel({ estudio, onCambio }) {
  const [editando, setEditando] = useState(false);
  const [metodo, setMetodo] = useState(estudio.confirmado_metodo || "histologia");
  const [guardando, setGuardando] = useState(false);
  // El panel aparece a la vez en el lateral y en la inspección: id único.
  const idMetodo = React.useId();

  const confirmado = Boolean(estudio.confirmado_clase);
  const acierta = confirmado && estudio.confirmado_clase === estudio.clase;

  const guardar = async (clase) => {
    setGuardando(true);
    try {
      const actualizado = await confirmStudy(estudio.id, clase, metodo);
      onCambio(actualizado);
      setEditando(false);
      toast.success("Diagnóstico confirmado",
        clase === estudio.clase ? "El sistema acertó en este caso." : "El sistema no acertó: este caso ayudará a mejorarlo.");
    } catch (err) {
      toast.error("No se pudo guardar la confirmación", err.message);
    } finally {
      setGuardando(false);
    }
  };

  const quitar = async () => {
    setGuardando(true);
    try {
      onCambio(await unconfirmStudy(estudio.id));
      toast.info("Confirmación eliminada");
    } catch (err) {
      toast.error("No se pudo quitar la confirmación", err.message);
    } finally {
      setGuardando(false);
    }
  };

  return h("div", { className: "confirmacion" },
    h("div", { className: "section-title", style: { marginBottom: 6 } }, "Diagnóstico confirmado"),

    confirmado && !editando
      ? h("div", null,
          h("div", { className: "confirmacion-estado " + (acierta ? "is-acierto" : "is-fallo") },
            h(acierta ? I.check : I.alert, { size: 16 }),
            h("div", null,
              h("div", { className: "confirmacion-titulo" },
                estudio.confirmado_clase + " por " + nombreMetodo(estudio.confirmado_metodo).toLowerCase()),
              h("div", { className: "confirmacion-sub" },
                acierta ? "El sistema acertó en este caso."
                        : "El sistema dijo " + estudio.clase.toLowerCase() + ": no acertó en este caso."),
            ),
          ),
          h("div", { className: "row", style: { gap: 6, marginTop: 8 } },
            h("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: () => setEditando(true), disabled: guardando },
              h(I.edit, { size: 12 }), "Cambiar"),
            h("button", { type: "button", className: "btn btn-ghost btn-sm", onClick: quitar, disabled: guardando },
              h(I.x, { size: 12 }), "Quitar"),
          ),
        )
      : h("div", null,
          h("div", { className: "confirmacion-sub", style: { marginBottom: 10 } },
            "¿Ya tiene el resultado de la prueba? Regístrelo para saber si el sistema acertó."),
          h("label", { className: "field-label", htmlFor: idMetodo }, "Método"),
          h("select", {
            id: idMetodo, className: "select", value: metodo, disabled: guardando,
            onChange: (e) => setMetodo(e.target.value), style: { width: "100%", marginBottom: 10 },
          }, METODOS.map((m) => h("option", { key: m.id, value: m.id }, m.label))),
          h("div", { className: "confirmacion-botones" },
            h("button", { type: "button", className: "btn confirmacion-pos", onClick: () => guardar("Positivo"), disabled: guardando },
              "Resultó positivo"),
            h("button", { type: "button", className: "btn confirmacion-neg", onClick: () => guardar("Negativo"), disabled: guardando },
              "Resultó negativo"),
          ),
          editando && h("button", { type: "button", className: "btn btn-ghost btn-sm", style: { marginTop: 6 },
                                    onClick: () => setEditando(false) }, "Cancelar"),
        ),
  );
}
