import { I } from "../icons.js";
import { resetPassword } from "../auth.js";
import { AuthHero } from "./AuthHero.jsx";
import { AuthCard, AuthError } from "./AuthCard.jsx";
import { Input, Label, GradientButton, FieldError } from "../ui/input.jsx";
import { validarClaveNueva } from "../validacion.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

// Destino del enlace del correo (#restablecer=…). El token llega en el
// fragmento de la URL: el navegador no lo envía a ningún servidor. Sirve una
// vez y vence en 30 minutos; al usarlo se cierran todas las sesiones abiertas.

export function RestablecerScreen({ token, onListo, onCancelar }) {
  const [clave, setClave]       = useState("");
  const [confirma, setConfirma] = useState("");
  const [errores, setErrores]   = useState({});
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nuevos = {
      clave: validarClaveNueva(clave),
      confirma: confirma !== clave ? "Las contraseñas no coinciden." : null,
    };
    setErrores(nuevos);
    if (nuevos.clave || nuevos.confirma) return;
    setError(null); setLoading(true);
    try {
      await resetPassword(token, clave);
      onListo();
    } catch (err) {
      setError(err.message || "No se pudo restablecer la contraseña.");
    } finally {
      setLoading(false);
    }
  };

  return h("div", { className: "auth-page" },
    h(AuthHero, {
      title: "Recupere su acceso",
      lead: "Elija una contraseña nueva. Por seguridad, se cerrará la sesión en todos sus dispositivos.",
    }),
    h(AuthCard, {
      titulo: "Nueva contraseña",
      subtitulo: "Use al menos 8 caracteres combinando letras y números.",
      pie: h("span", { className: "linklike", onClick: onCancelar }, "Volver al inicio de sesión"),
    },
      h("form", { onSubmit: handleSubmit, noValidate: true, className: "flex flex-col gap-4" },
        h("div", null,
          h(Label, { htmlFor: "rest-clave" }, "Contraseña nueva"),
          h(Input, { id: "rest-clave", type: "password", icon: I.lock, autoComplete: "new-password",
            error: errores.clave, value: clave, placeholder: "Mínimo 8",
            onChange: (e) => { setClave(e.target.value); setErrores((p) => ({ ...p, clave: null })); } }),
          h(FieldError, { id: "rest-clave" }, errores.clave),
        ),
        h("div", null,
          h(Label, { htmlFor: "rest-confirmar" }, "Repita la contraseña"),
          h(Input, { id: "rest-confirmar", type: "password", icon: I.lock, autoComplete: "new-password",
            error: errores.confirma, value: confirma, placeholder: "••••••••",
            onChange: (e) => { setConfirma(e.target.value); setErrores((p) => ({ ...p, confirma: null })); } }),
          h(FieldError, { id: "rest-confirmar" }, errores.confirma),
        ),
        error && h(AuthError, null, error),
        h(GradientButton, { type: "submit", loading },
          loading ? "Guardando…" : "Guardar contraseña",
          !loading && h(I.chev, { size: 14 })),
      ),
    ),
  );
}
