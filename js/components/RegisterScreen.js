import { I } from "../icons.js";
import { register } from "../auth.js";
import { AuthHero } from "./AuthHero.jsx";
import { AuthCard, AuthError } from "./AuthCard.jsx";
import { Input, Label, GradientButton, FieldError } from "../ui/input.jsx";
import { validarCorreo, validarClaveNueva, validarNombre, fuerzaClave } from "../validacion.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

const NIVELES = [
  { txt: "",           color: "var(--ink-200)" },
  { txt: "Débil",      color: "var(--red-600)" },
  { txt: "Aceptable",  color: "var(--amber-600)" },
  { txt: "Buena",      color: "var(--blue-600)" },
  { txt: "Excelente",  color: "var(--green-600)" },
];

// Medidor de fuerza: cuatro segmentos que se llenan mientras se escribe.
function MedidorClave({ clave }) {
  if (!clave) return null;
  const nivel = Math.max(1, fuerzaClave(clave));
  const n = NIVELES[nivel];
  return h("div", { className: "medidor-clave", "aria-live": "polite" },
    h("div", { className: "medidor-segmentos" },
      [1, 2, 3, 4].map((k) => h("span", {
        key: k, className: "medidor-seg",
        style: { background: k <= nivel ? n.color : "var(--ink-200)" },
      }))),
    h("span", { className: "medidor-txt", style: { color: n.color } }, n.txt),
  );
}

export function RegisterScreen({ onSuccess, onGoToLogin }) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [errores, setErrores]   = useState({});

  const limpiar = (campo) => setErrores((p) => ({ ...p, [campo]: null }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const nuevos = {
      nombre: validarNombre(fullName),
      email: validarCorreo(email),
      password: validarClaveNueva(password),
      confirm: !confirm ? "Repita la contraseña."
             : confirm !== password ? "Las contraseñas no coinciden." : null,
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;   // early return

    setLoading(true);
    try {
      const user = await register(email.trim(), password, fullName.trim());
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
      h("form", { onSubmit: handleSubmit, noValidate: true, className: "flex flex-col gap-4" },
        h("div", null,
          h(Label, { htmlFor: "reg-nombre" }, "Nombre completo (opcional)"),
          h(Input, { id: "reg-nombre", type: "text", icon: I.user, autoComplete: "name", error: errores.nombre,
            value: fullName, placeholder: "Ricardo Mendoza",
            onChange: (e) => { setFullName(e.target.value); limpiar("nombre"); } }),
          errores.nombre
            ? h(FieldError, { id: "reg-nombre" }, errores.nombre)
            : h("div", { className: "mt-1 text-[11px] text-ink-500" }, "Solo letras y espacios (sin números ni puntos)."),
        ),
        h("div", null,
          h(Label, { htmlFor: "reg-email" }, "Correo electrónico"),
          h(Input, { id: "reg-email", type: "email", icon: I.mail, autoComplete: "email", error: errores.email,
            value: email, placeholder: "doctor@hospital.com",
            onChange: (e) => { setEmail(e.target.value); limpiar("email"); } }),
          h(FieldError, { id: "reg-email" }, errores.email),
        ),
        h("div", { className: "grid grid-cols-2 gap-3" },
          h("div", null,
            h(Label, { htmlFor: "reg-clave" }, "Contraseña"),
            h(Input, { id: "reg-clave", type: "password", icon: I.lock, autoComplete: "new-password",
              error: errores.password, value: password, placeholder: "Mínimo 8",
              onChange: (e) => { setPassword(e.target.value); limpiar("password"); } }),
            h(FieldError, { id: "reg-clave" }, errores.password),
          ),
          h("div", null,
            h(Label, { htmlFor: "reg-confirmar" }, "Confirmar"),
            h(Input, { id: "reg-confirmar", type: "password", icon: I.lock, autoComplete: "new-password",
              error: errores.confirm, value: confirm, placeholder: "Repítala",
              onChange: (e) => { setConfirm(e.target.value); limpiar("confirm"); } }),
            h(FieldError, { id: "reg-confirmar" }, errores.confirm),
          ),
        ),
        h(MedidorClave, { clave: password }),
        error && h(AuthError, null, error),
        h(GradientButton, { type: "submit", loading, className: "mt-1" },
          loading ? "Creando cuenta…" : "Crear cuenta",
          !loading && h(I.chev, { size: 14 })),
      ),
    ),
  );
}
