import { I } from "../icons.js";
import { login, mfaSetup, mfaVerify } from "../auth.js";
import { AuthHero } from "./AuthHero.jsx";
import { AuthCard, AuthError } from "./AuthCard.jsx";
import { Input, Label, GradientButton } from "../ui/input.jsx";

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

  return h("form", { onSubmit, className: "flex flex-col gap-4" },
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
      h(Label, { htmlFor: "mfa-codigo" }, "Código de verificación"),
      h(Input, {
        id: "mfa-codigo", ref: inputRef, icon: I.shield, className: "mfa-input",
        inputMode: "numeric", autoComplete: "one-time-code", pattern: "[0-9 ]{6,7}",
        maxLength: 7, required: true, placeholder: "123 456",
        value: codigo, onChange: (e) => onCodigo(e.target.value),
      }),
    ),
    error && h(AuthError, null, error),
    h(GradientButton, { type: "submit", disabled: loading || (alta && !datosAlta) },
      loading ? "Verificando…" : alta ? "Activar y entrar" : "Verificar",
      !loading && h(I.chev, { size: 14 })),
    h("div", { className: "text-center text-[13px]" },
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
      lead: "Inicia sesión para continuar con tus análisis, tu historial de estudios y tu configuración guardada.",
    }),
    h(AuthCard, {
      key: mfa ? "mfa" : "login",
      titulo, subtitulo,
      pie: !mfa && h("span", null, "¿No tienes cuenta? ",
        h("span", { className: "linklike", onClick: onGoToRegister }, "Regístrate")),
    },
      mfa
        ? h(PasoCodigo, {
            alta: mfa.setup, datosAlta, cargandoAlta, codigo, onCodigo: setCodigo,
            error, loading, onSubmit: handleCodigo, onVolver: handleVolver,
          })
        : h("form", { onSubmit: handleSubmit, className: "flex flex-col gap-4" },
            h("div", null,
              h(Label, { htmlFor: "login-email" }, "Correo electrónico"),
              h(Input, { id: "login-email", type: "email", required: true, icon: I.mail,
                autoComplete: "username",
                value: email, onChange: (e) => setEmail(e.target.value), placeholder: "doctor@hospital.com" }),
            ),
            h("div", null,
              h(Label, { htmlFor: "login-clave" }, "Contraseña"),
              h(Input, { id: "login-clave", type: "password", required: true, icon: I.lock,
                autoComplete: "current-password",
                value: password, onChange: (e) => setPassword(e.target.value), placeholder: "••••••••" }),
            ),
            error && h(AuthError, null, error),
            h(GradientButton, { type: "submit", disabled: loading, className: "mt-1" },
              loading ? "Ingresando…" : "Ingresar",
              !loading && h(I.chev, { size: 14 })),
          ),
    ),
  );
}
