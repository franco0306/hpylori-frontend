import { I } from "../icons.js";
import { login, mfaSetup, mfaVerify } from "../auth.js";
import { AuthHero } from "./AuthHero.js";

const React = window.React;
const { useState, useEffect, useRef } = React;
const h = React.createElement;

// Ingreso en uno o dos pasos. Las cuentas de administración exigen un segundo
// factor (TOTP): tras la contraseña, el servidor no entrega sesión sino un pase
// de 5 minutos que solo sirve para presentar el código de 6 dígitos. La primera
// vez, ese paso muestra el QR para darlo de alta en la app autenticadora.

function PasoCodigo({ alta, datosAlta, cargandoAlta, codigo, onCodigo, error, loading, onSubmit, onVolver }) {
  const inputRef = useRef(null);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, [datosAlta]);

  return h("form", { onSubmit, style: { display: "flex", flexDirection: "column", gap: 14 } },
    alta && h("div", { className: "mfa-alta" },
      h("ol", { className: "mfa-pasos" },
        h("li", null, "Instale ", h("strong", null, "Google Authenticator"), " o Microsoft Authenticator en su teléfono."),
        h("li", null, "Escanee este código QR con la app."),
        h("li", null, "Escriba abajo el código de 6 dígitos que muestra la app."),
      ),
      cargandoAlta
        ? h("div", { className: "muted", style: { fontSize: 13 } }, "Generando código QR…")
        : datosAlta && h("div", { className: "mfa-qr" },
            datosAlta.qr
              ? h("img", { src: datosAlta.qr, alt: "Código QR para la app autenticadora", width: 180, height: 180 })
              : null,
            h("div", { className: "mfa-secreto" },
              h("div", { className: "muted", style: { fontSize: 11.5 } }, "¿No puede escanear? Ingrese esta clave:"),
              h("code", null, datosAlta.secret),
            ),
          ),
    ),
    h("div", null,
      h("label", { className: "auth-label", htmlFor: "mfa-codigo" }, "Código de verificación"),
      h("div", { className: "input-icon-wrap" },
        h("span", { className: "input-icon" }, h(I.shield, { size: 15 })),
        h("input", {
          id: "mfa-codigo", ref: inputRef, className: "input mfa-input",
          inputMode: "numeric", autoComplete: "one-time-code", pattern: "[0-9 ]{6,7}",
          maxLength: 7, required: true, placeholder: "123 456",
          value: codigo, onChange: (e) => onCodigo(e.target.value),
        }),
      ),
    ),
    error && h("div", { className: "alert alert-error" }, h(I.alert, { size: 16 }), h("div", null, error)),
    h("button", { className: "btn btn-primary", type: "submit", disabled: loading || (alta && !datosAlta),
                  style: { width: "100%" } },
      loading ? "Verificando…" : alta ? "Activar y entrar" : "Verificar"),
    h("div", { style: { textAlign: "center", fontSize: 13 } },
      h("span", { className: "linklike", onClick: onVolver }, "Volver al inicio de sesión")),
  );
}

export function LoginScreen({ onSuccess, onGoToRegister }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);

  // Segundo factor: { token, setup } mientras se espera el código.
  const [mfa, setMfa]               = useState(null);
  const [datosAlta, setDatosAlta]   = useState(null);
  const [cargandoAlta, setCargandoAlta] = useState(false);
  const [codigo, setCodigo]         = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const resultado = await login(email, password);
      if (resultado.mfa) {
        setMfa(resultado.mfa);
        setCodigo("");
        setPassword("");
        if (resultado.mfa.setup) {
          setCargandoAlta(true);
          try { setDatosAlta(await mfaSetup(resultado.mfa.token)); }
          finally { setCargandoAlta(false); }
        }
        return;
      }
      onSuccess(resultado.user);
    } catch (err) {
      setError(err.message || "No se pudo iniciar sesión.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodigo = async (e) => {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const user = await mfaVerify(mfa.token, codigo.replace(/\s/g, ""));
      onSuccess(user);
    } catch (err) {
      setError(err.message || "No se pudo verificar el código.");
      setCodigo("");
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    setMfa(null); setDatosAlta(null); setCodigo(""); setError(null);
  };

  const titulo = !mfa ? "Iniciar sesión"
    : mfa.setup ? "Active la verificación en dos pasos" : "Verificación en dos pasos";
  const subtitulo = !mfa ? "Ingresa tus credenciales para acceder al sistema."
    : mfa.setup
      ? "Las cuentas de administración exigen un segundo factor. Configúrelo una sola vez."
      : "Ingrese el código de 6 dígitos de su app autenticadora.";

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
        h("h1", { className: "page-title", style: { fontSize: 20, marginBottom: 4 } }, titulo),
        h("p", { className: "muted", style: { marginTop: 0, marginBottom: 20, fontSize: 13 } }, subtitulo),

        mfa
          ? h(PasoCodigo, {
              alta: mfa.setup, datosAlta, cargandoAlta, codigo, onCodigo: setCodigo,
              error, loading, onSubmit: handleCodigo, onVolver: handleVolver,
            })
          : h("form", { onSubmit: handleSubmit, style: { display: "flex", flexDirection: "column", gap: 14 } },
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

        !mfa && h("div", { style: { textAlign: "center", marginTop: 18, fontSize: 13 } },
          "¿No tienes cuenta? ",
          h("span", { className: "linklike", onClick: onGoToRegister }, "Regístrate"),
        ),
      ),
    ),
  );
}
