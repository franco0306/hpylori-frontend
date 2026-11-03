import { I } from "../icons.js";
import { login, mfaSetup, mfaVerify, forgotPassword } from "../auth.js";
import { AuthHero } from "./AuthHero.jsx";
import { AuthCard, AuthError } from "./AuthCard.jsx";
import { CodigosRecuperacion } from "./CodigosRecuperacion.js";
import { Input, Label, GradientButton, FieldError } from "../ui/input.jsx";
import { validarCorreo } from "../validacion.js";

const React = window.React;
const { useState, useEffect, useRef } = React;
const h = React.createElement;

// Ingreso en uno o dos pasos. Las cuentas de administración exigen un segundo
// factor (TOTP): tras la contraseña, el servidor no entrega sesión sino un pase
// de 5 minutos que solo sirve para presentar el código de 6 dígitos. La primera
// vez, ese paso muestra el QR para darlo de alta en la app autenticadora, y al
// confirmarlo entrega los códigos de recuperación, que se muestran una vez.
//
// Nadie depende de un administrador para volver a entrar: la contraseña se
// recupera por correo y el teléfono perdido se suple con un código de
// recuperación.

const RECUPERACION_RE = /^[A-Za-z0-9]{8}$/;

function PasoCodigo({ alta, datosAlta, cargandoAlta, codigo, onCodigo, error, loading, onSubmit, onVolver }) {
  const inputRef = useRef(null);
  const [errorCampo, setErrorCampo] = useState(null);
  const [recuperacion, setRecuperacion] = useState(false);
  useEffect(() => { if (inputRef.current) inputRef.current.focus(); }, [datosAlta, recuperacion]);

  const handleSubmit = (e) => {
    e.preventDefault();
    const limpio = codigo.replace(/[\s-]/g, "");
    if (recuperacion) {
      if (!RECUPERACION_RE.test(limpio)) { setErrorCampo("El código de recuperación tiene 8 letras y números (ej.: ABCD-2345)."); return; }
    } else {
      if (!limpio) { setErrorCampo("Ingrese el código de 6 dígitos de su app."); return; }
      if (!/^\d{6}$/.test(limpio)) { setErrorCampo("El código debe tener exactamente 6 dígitos."); return; }
    }
    setErrorCampo(null);
    onSubmit(e);
  };

  const alternar = () => { setRecuperacion((v) => !v); onCodigo(""); setErrorCampo(null); };

  return h("form", { onSubmit: handleSubmit, noValidate: true, className: "flex flex-col gap-4" },
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
      h(Label, { htmlFor: "mfa-codigo" }, recuperacion ? "Código de recuperación" : "Código de verificación"),
      h(Input, {
        id: "mfa-codigo", ref: inputRef, icon: recuperacion ? I.lock : I.shield, className: "mfa-input",
        inputMode: recuperacion ? "text" : "numeric", autoComplete: "one-time-code",
        maxLength: recuperacion ? 9 : 7, placeholder: recuperacion ? "ABCD-2345" : "123 456", error: errorCampo,
        value: codigo,
        onChange: (e) => {
          const v = recuperacion ? e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "") : e.target.value.replace(/[^\d ]/g, "");
          onCodigo(v); setErrorCampo(null);
        },
      }),
      h(FieldError, { id: "mfa-codigo" }, errorCampo),
    ),
    error && h(AuthError, null, error),
    h(GradientButton, { type: "submit", loading, disabled: alta && !datosAlta },
      loading ? "Verificando…" : alta ? "Activar y entrar" : "Verificar",
      !loading && h(I.chev, { size: 14 })),
    h("div", { className: "text-center text-[13px]", style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 8 } },
      !alta && h("span", { className: "linklike", onClick: alternar },
        recuperacion ? "Usar el código de la app" : "¿Perdió su teléfono? Use un código de recuperación"),
      h("span", { className: "linklike", onClick: onVolver }, "Volver al inicio de sesión")),
  );
}

function PasoOlvido({ emailInicial, onVolver }) {
  const [email, setEmail] = useState(emailInicial || "");
  const [errorCampo, setErrorCampo] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [enviado, setEnviado] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const problema = validarCorreo(email);
    setErrorCampo(problema);
    if (problema) return;
    setError(null); setLoading(true);
    try {
      setEnviado(await forgotPassword(email.trim()));
    } catch (err) {
      setError(err.message || "No se pudo enviar el enlace.");
    } finally {
      setLoading(false);
    }
  };

  if (enviado) {
    return h("div", { className: "flex flex-col gap-4" },
      h("div", { className: "alert alert-info", role: "status" },
        h(I.mail, { size: 16 }),
        h("div", { style: { fontSize: 13, lineHeight: 1.5 } }, enviado)),
      h("div", { className: "text-center text-[13px]" },
        h("span", { className: "linklike", onClick: onVolver }, "Volver al inicio de sesión")),
    );
  }

  return h("form", { onSubmit: handleSubmit, noValidate: true, className: "flex flex-col gap-4" },
    h("div", null,
      h(Label, { htmlFor: "olvido-email" }, "Correo electrónico de su cuenta"),
      h(Input, { id: "olvido-email", type: "email", icon: I.mail, error: errorCampo,
        autoComplete: "username", value: email, placeholder: "doctor@hospital.com",
        onChange: (e) => { setEmail(e.target.value); setErrorCampo(null); } }),
      h(FieldError, { id: "olvido-email" }, errorCampo),
    ),
    error && h(AuthError, null, error),
    h(GradientButton, { type: "submit", loading },
      loading ? "Enviando…" : "Enviarme el enlace",
      !loading && h(I.chev, { size: 14 })),
    h("div", { className: "text-center text-[13px]" },
      h("span", { className: "linklike", onClick: onVolver }, "Volver al inicio de sesión")),
  );
}

export function LoginScreen({ onSuccess, onGoToRegister, aviso = null }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [errores, setErrores]   = useState({});
  const [olvido, setOlvido]     = useState(false);

  // Segundo factor: { token, setup } mientras se espera el código.
  const [mfa, setMfa]               = useState(null);
  const [datosAlta, setDatosAlta]   = useState(null);
  const [cargandoAlta, setCargandoAlta] = useState(false);
  const [codigo, setCodigo]         = useState("");
  // Recién activado el MFA: { user, codigos } hasta que confirme que los guardó.
  const [nuevosCodigos, setNuevosCodigos] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nuevos = {
      email: validarCorreo(email),
      password: password ? null : "Ingrese su contraseña.",
    };
    setErrores(nuevos);
    if (nuevos.email || nuevos.password) return;   // early return: sin viaje al servidor

    setError(null); setLoading(true);
    try {
      const resultado = await login(email.trim(), password);
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
      const { user, recoveryCodes } = await mfaVerify(mfa.token, codigo.replace(/\s/g, ""));
      if (recoveryCodes && recoveryCodes.length) {
        setNuevosCodigos({ user, codigos: recoveryCodes });
        return;
      }
      onSuccess(user);
    } catch (err) {
      setError(err.message || "No se pudo verificar el código.");
      setCodigo("");
    } finally {
      setLoading(false);
    }
  };

  const handleVolver = () => {
    setMfa(null); setDatosAlta(null); setCodigo(""); setError(null); setOlvido(false);
  };

  const paso = nuevosCodigos ? "codigos" : mfa ? "mfa" : olvido ? "olvido" : "login";
  const titulo = {
    login: "Iniciar sesión",
    olvido: "Restablecer contraseña",
    codigos: "Guarde sus códigos de recuperación",
    mfa: mfa && mfa.setup ? "Active la verificación en dos pasos" : "Verificación en dos pasos",
  }[paso];
  const subtitulo = {
    login: "Ingresa tus credenciales para acceder al sistema.",
    olvido: "Le enviaremos a su correo un enlace para elegir una nueva contraseña.",
    codigos: "Si pierde su teléfono, cada uno le deja entrar una vez en lugar del código de la app.",
    mfa: mfa && mfa.setup
      ? "Las cuentas de administración exigen un segundo factor. Configúrelo una sola vez."
      : "Ingrese el código de 6 dígitos de su app autenticadora o, si perdió su teléfono, un código de recuperación.",
  }[paso];

  const cuerpo = () => {
    if (paso === "codigos") {
      return h("div", { className: "flex flex-col gap-4" },
        h(CodigosRecuperacion, { codigos: nuevosCodigos.codigos, email: nuevosCodigos.user && nuevosCodigos.user.email }),
        h(GradientButton, { type: "button", onClick: () => onSuccess(nuevosCodigos.user) },
          "Ya los guardé, entrar", h(I.chev, { size: 14 })),
      );
    }
    if (paso === "mfa") {
      return h(PasoCodigo, {
        alta: mfa.setup, datosAlta, cargandoAlta, codigo, onCodigo: setCodigo,
        error, loading, onSubmit: handleCodigo, onVolver: handleVolver,
      });
    }
    if (paso === "olvido") {
      return h(PasoOlvido, { emailInicial: email, onVolver: handleVolver });
    }
    return h("form", { onSubmit: handleSubmit, noValidate: true, className: "flex flex-col gap-4" },
      aviso && h("div", { className: "alert alert-info", role: "status" },
        h(I.check, { size: 16 }), h("div", { style: { fontSize: 13 } }, aviso)),
      h("div", null,
        h(Label, { htmlFor: "login-email" }, "Correo electrónico"),
        h(Input, { id: "login-email", type: "email", icon: I.mail, error: errores.email,
          autoComplete: "username",
          value: email, placeholder: "doctor@hospital.com",
          onChange: (e) => { setEmail(e.target.value); setErrores((p) => ({ ...p, email: null })); } }),
        h(FieldError, { id: "login-email" }, errores.email),
      ),
      h("div", null,
        h(Label, { htmlFor: "login-clave" }, "Contraseña"),
        h(Input, { id: "login-clave", type: "password", icon: I.lock, error: errores.password,
          autoComplete: "current-password",
          value: password, placeholder: "••••••••",
          onChange: (e) => { setPassword(e.target.value); setErrores((p) => ({ ...p, password: null })); } }),
        h(FieldError, { id: "login-clave" }, errores.password),
        h("div", { className: "olvido-enlace" },
          h("span", { className: "linklike", onClick: () => { setError(null); setOlvido(true); } },
            "¿Olvidó su contraseña?")),
      ),
      error && h(AuthError, null, error),
      h(GradientButton, { type: "submit", loading, className: "mt-1" },
        loading ? "Ingresando…" : "Ingresar",
        !loading && h(I.chev, { size: 14 })),
    );
  };

  return h("div", { className: "auth-page" },
    h(AuthHero, {
      title: "Bienvenido de nuevo",
      lead: "Inicia sesión para continuar con tus análisis, tu historial de estudios y tu configuración guardada.",
    }),
    h(AuthCard, {
      key: paso,
      titulo, subtitulo,
      pie: paso === "login" && h("span", null, "¿No tienes cuenta? ",
        h("span", { className: "linklike", onClick: onGoToRegister }, "Regístrate")),
    }, cuerpo()),
  );
}
