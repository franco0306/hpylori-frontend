import { I } from "../icons.js";
import { toast } from "../ui/toast.jsx";

const h = window.React.createElement;

// Códigos de recuperación del segundo factor. El servidor los entrega UNA vez
// (al activar el MFA o al generar unos nuevos) y solo guarda su huella: si el
// usuario no los guarda ahora, no hay forma de volver a verlos.

function comoTexto(codigos, email) {
  return [
    "EndoScan AI · Códigos de recuperación",
    email ? "Cuenta: " + email : null,
    "Generados: " + new Date().toLocaleString("es-PE"),
    "",
    "Cada código sirve UNA sola vez, en lugar del código de su app,",
    "si pierde o cambia de teléfono. Guárdelos fuera de este equipo.",
    "",
    ...codigos,
  ].filter((linea) => linea !== null).join("\n");
}

export function CodigosRecuperacion({ codigos, email }) {
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(comoTexto(codigos, email));
      toast.success("Códigos copiados");
    } catch {
      toast.error("No se pudo copiar", "Selecciónelos y cópielos a mano.");
    }
  };

  const descargar = () => {
    const url = URL.createObjectURL(new Blob([comoTexto(codigos, email)], { type: "text/plain" }));
    const enlace = document.createElement("a");
    enlace.href = url;
    enlace.download = "endoscan-codigos-recuperacion.txt";
    enlace.click();
    URL.revokeObjectURL(url);
  };

  return h("div", { className: "codigos-recuperacion" },
    h("div", { className: "alert alert-warn", role: "status" },
      h(I.alert, { size: 14 }),
      h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } },
        h("strong", null, "Guárdelos ahora: no se volverán a mostrar. "),
        "Si pierde su teléfono, cada código le deja entrar una vez sin depender de un administrador."),
    ),
    h("ol", { className: "codigos-lista", "aria-label": "Códigos de recuperación" },
      codigos.map((c) => h("li", { key: c }, h("code", null, c)))),
    h("div", { className: "row", style: { gap: 8, flexWrap: "wrap" } },
      h("button", { type: "button", className: "btn btn-secondary", onClick: copiar },
        h(I.copy, { size: 14 }), "Copiar"),
      h("button", { type: "button", className: "btn btn-secondary", onClick: descargar },
        h(I.dl, { size: 14 }), "Descargar .txt"),
    ),
  );
}
