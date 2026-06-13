import { I } from "../icons.js";
import { login } from "../auth.js";
import { AuthHero } from "./AuthHero.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

export function LoginScreen({ onSuccess, onGoToRegister }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const user = await login(email, password);
      onSuccess(user);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  return h("div", { className: "auth-page" },
    h(AuthHero, {
      title: "Bienvenido de nuevo",
      lead: "Inicia sesión para continuar con tus análisis, historial de estudios y configuración guardada.",
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
        h("h1", { className: "page-title", style: { fontSize: 20, marginBottom: 4 } }, "Iniciar sesión"),
        h("p", { className: "muted", style: { marginTop: 0, marginBottom: 20, fontSize: 13 } },
          "Ingresa tus credenciales para acceder al sistema."),

        h("form", { onSubmit: handleSubmit, style: { display: "flex", flexDirection: "column", gap: 14 } },
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
                value: password, onChange: (e) => setPassword(e.target.value), placeholder: "••••••••" }),
            ),
          ),
          error && h("div", { className: "alert alert-error" }, h(I.alert, { size: 16 }), h("div", null, error)),
          h("button", { className: "btn btn-primary", type: "submit", disabled: loading, style: { width: "100%" } },
            loading ? "Ingresando…" : "Ingresar"),
        ),

        h("div", { style: { textAlign: "center", marginTop: 18, fontSize: 13 } },
          "¿No tienes cuenta? ",
          h("span", { className: "linklike", onClick: onGoToRegister }, "Regístrate"),
        ),
      ),
    ),
  );
}
