import { I } from "../icons.js";
import { register } from "../auth.js";
import { AuthHero } from "./AuthHero.jsx";
import { AuthCard, AuthError } from "./AuthCard.jsx";
import { Input, Label, GradientButton } from "../ui/input.jsx";

const React = window.React;
const { useState } = React;
const h = React.createElement;

// Solo letras (con acentos/ñ), espacios, guiones y apóstrofes. Sin números ni puntos.
const FULL_NAME_RE = /^[A-Za-zÀ-ÖØ-öø-ÿ]+(?:[ '-][A-Za-zÀ-ÖØ-öø-ÿ]+)*$/;

export function RegisterScreen({ onSuccess, onGoToLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const trimmedName = fullName.trim();
    if (trimmedName && !FULL_NAME_RE.test(trimmedName)) {
      setError("El nombre completo solo puede contener letras y espacios (sin números ni símbolos como puntos).");
      return;
    }
    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    // Misma política que el backend, que es quien la hace cumplir de verdad.
    if (password.length < 8)  { setError("La contraseña debe tener al menos 8 caracteres."); return; }
    if (!/[A-Za-zÀ-ÿ]/.test(password) || !/\d/.test(password)) {
      setError("La contraseña debe combinar letras y números.");
      return;
    }

    setLoading(true);
    try {
      const user = await register(email, password, trimmedName);
      onSuccess(user);
    } catch (err) {
      setError(err.message || "No se pudo crear la cuenta.");
    } finally {
      setLoading(false);
    }
  };

  return h("div", { className: "auth-page" },
    h(AuthHero, {
      title: "Crea tu cuenta",
      lead: "Regístrate para guardar tus análisis, acceder a tu historial de estudios y personalizar tu configuración.",
    }),
    h(AuthCard, {
      titulo: "Crear cuenta",
      subtitulo: "Registra tus credenciales para empezar a usar EndoScan AI.",
      pie: h("span", null, "¿Ya tienes cuenta? ",
        h("span", { className: "linklike", onClick: onGoToLogin }, "Inicia sesión")),
    },
      h("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4" },
        h("div", null,
          h(Label, { htmlFor: "reg-nombre" }, "Nombre completo (opcional)"),
          h(Input, { id: "reg-nombre", type: "text", icon: I.user, autoComplete: "name",
            value: fullName, onChange: (e) => setFullName(e.target.value), placeholder: "Ricardo Mendoza" }),
          h("div", { className: "mt-1 text-[11px] text-ink-500" }, "Solo letras y espacios (sin números ni puntos)."),
        ),
        h("div", null,
          h(Label, { htmlFor: "reg-email" }, "Correo electrónico"),
          h(Input, { id: "reg-email", type: "email", required: true, icon: I.mail, autoComplete: "email",
            value: email, onChange: (e) => setEmail(e.target.value), placeholder: "doctor@hospital.com" }),
        ),
        h("div", { className: "grid grid-cols-2 gap-3" },
          h("div", null,
            h(Label, { htmlFor: "reg-clave" }, "Contraseña"),
            h(Input, { id: "reg-clave", type: "password", required: true, icon: I.lock, autoComplete: "new-password",
              value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Mínimo 8" }),
          ),
          h("div", null,
            h(Label, { htmlFor: "reg-confirmar" }, "Confirmar"),
            h(Input, { id: "reg-confirmar", type: "password", required: true, icon: I.lock, autoComplete: "new-password",
              value: confirm, onChange: (e) => setConfirm(e.target.value), placeholder: "Repítala" }),
          ),
        ),
        error && h(AuthError, null, error),
        h(GradientButton, { type: "submit", disabled: loading, className: "mt-1" },
          loading ? "Creando cuenta…" : "Crear cuenta",
          !loading && h(I.chev, { size: 14 })),
      ),
    ),
  );
}
