import { I } from "../icons.js";
import { register } from "../auth.js";
import { AuthHero } from "./AuthHero.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

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

    if (password !== confirm) { setError("Las contraseñas no coinciden."); return; }
    if (password.length < 6)  { setError("La contraseña debe tener al menos 6 caracteres."); return; }

    setLoading(true);
    try {
      const user = await register(email, password, fullName);
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
    h("div", { className: "auth-form-side" },
      h("div", { className: "card card-pad auth-card" },
        h("div", { className: "auth-brand" },
          h("div", { className: "brand-mark" }, "Hp"),
          h("div", null,
            h("div", { className: "brand-name" }, "EndoScan AI"),
            h("div", { className: "brand-sub" }, "Detección de H. pylori"),
          ),
        ),
        h("h1", { className: "page-title", style: { fontSize: 20, marginBottom: 4 } }, "Crear cuenta"),
        h("p", { className: "muted", style: { marginTop: 0, marginBottom: 20, fontSize: 13 } },
          "Registra tus credenciales para empezar a usar EndoScan AI."),

        h("form", { onSubmit: handleSubmit, style: { display: "flex", flexDirection: "column", gap: 14 } },
          h("div", null,
            h("label", { className: "auth-label" }, "Nombre completo (opcional)"),
            h("div", { className: "input-icon-wrap" },
              h("span", { className: "input-icon" }, h(I.user, { size: 15 })),
              h("input", { className: "input", type: "text",
                value: fullName, onChange: (e) => setFullName(e.target.value), placeholder: "Dr. R. Mendoza" }),
            ),
          ),
          h("div", null,
            h("label", { className: "auth-label" }, "Correo electrónico"),
            h("div", { className: "input-icon-wrap" },
              h("span", { className: "input-icon" }, h(I.mail, { size: 15 })),
              h("input", { className: "input", type: "email", required: true,
                value: email, onChange: (e) => setEmail(e.target.value), placeholder: "doctor@hospital.com" }),
            ),
          ),
          h("div", null,
            h("label", { className: "auth-label" }, "Contraseña"),
            h("div", { className: "input-icon-wrap" },
              h("span", { className: "input-icon" }, h(I.lock, { size: 15 })),
              h("input", { className: "input", type: "password", required: true,
                value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Mínimo 6 caracteres" }),
            ),
          ),
          h("div", null,
            h("label", { className: "auth-label" }, "Confirmar contraseña"),
            h("div", { className: "input-icon-wrap" },
              h("span", { className: "input-icon" }, h(I.lock, { size: 15 })),
              h("input", { className: "input", type: "password", required: true,
                value: confirm, onChange: (e) => setConfirm(e.target.value), placeholder: "Repite la contraseña" }),
            ),
          ),
          error && h("div", { className: "alert alert-error" }, h(I.alert, { size: 16 }), h("div", null, error)),
          h("button", { className: "btn btn-primary", type: "submit", disabled: loading, style: { width: "100%" } },
            loading ? "Creando cuenta…" : "Crear cuenta"),
        ),

        h("div", { style: { textAlign: "center", marginTop: 18, fontSize: 13 } },
          "¿Ya tienes cuenta? ",
          h("span", { className: "linklike", onClick: onGoToLogin }, "Inicia sesión"),
        ),
      ),
    ),
  );
}
