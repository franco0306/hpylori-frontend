// Seguridad de la cuenta: lo que cada usuario resuelve solo, sin pedírselo a
// un administrador. Cambiar la contraseña y, si usa verificación en dos pasos,
// renovar sus códigos de recuperación.

import { I } from "../icons.js";
import { changePassword, regenerateRecoveryCodes, resetOwnMfa } from "../auth.js";
import { Input, Label, FieldError } from "../ui/input.jsx";
import { validarClaveNueva } from "../validacion.js";
import { toast } from "../ui/toast.jsx";
import { CodigosRecuperacion } from "./CodigosRecuperacion.js";

const React = window.React;
const { useState } = React;
const h = React.createElement;

function CambiarClave() {
  const [actual, setActual]     = useState("");
  const [nueva, setNueva]       = useState("");
  const [confirma, setConfirma] = useState("");
  const [errores, setErrores]   = useState({});
  const [error, setError]       = useState(null);
  const [guardando, setGuardando] = useState(false);

  const limpiar = (campo) => { setErrores((p) => ({ ...p, [campo]: null })); setError(null); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nuevos = {
      actual: actual ? null : "Ingrese su contraseña actual.",
      nueva: validarClaveNueva(nueva),
      confirma: confirma !== nueva ? "Las contraseñas no coinciden." : null,
    };
    setErrores(nuevos);
    if (nuevos.actual || nuevos.nueva || nuevos.confirma) return;
    setGuardando(true);
    try {
      const r = await changePassword(actual, nueva);
      const otras = r.otras_sesiones_cerradas || 0;
      toast.success("Contraseña actualizada",
        otras ? "Se cerró la sesión en " + otras + (otras === 1 ? " dispositivo más." : " dispositivos más.") : undefined);
      setActual(""); setNueva(""); setConfirma("");
    } catch (err) {
      setError(err.message || "No se pudo cambiar la contraseña.");
    } finally {
      setGuardando(false);
    }
  };

  const campo = (id, etiqueta, valor, setValor, clave, autoComplete) => h("div", null,
    h(Label, { htmlFor: id }, etiqueta),
    h(Input, { id, type: "password", icon: I.lock, autoComplete, error: errores[clave], value: valor,
      onChange: (e) => { setValor(e.target.value); limpiar(clave); } }),
    h(FieldError, { id }, errores[clave]),
  );

  return h("form", { className: "seguridad-form", onSubmit: handleSubmit, noValidate: true },
    campo("seg-actual", "Contraseña actual", actual, setActual, "actual", "current-password"),
    campo("seg-nueva", "Contraseña nueva", nueva, setNueva, "nueva", "new-password"),
    campo("seg-confirma", "Repita la contraseña nueva", confirma, setConfirma, "confirma", "new-password"),
    error && h("div", { className: "alert alert-error", role: "alert" },
      h(I.alert, { size: 14 }), h("div", { style: { fontSize: 12.5 } }, error)),
    h("div", null,
      h("button", { type: "submit", className: "btn btn-primary", disabled: guardando },
        guardando ? h("span", { className: "spinner-sm" }) : h(I.lock, { size: 14 }),
        guardando ? "Guardando…" : "Cambiar contraseña")),
  );
}

function CodigosDeRespaldo({ user, onUserChange }) {
  const [pidiendo, setPidiendo] = useState(false);
  const [clave, setClave]       = useState("");
  const [error, setError]       = useState(null);
  const [cargando, setCargando] = useState(false);
  const [codigos, setCodigos]   = useState(null);
  const restantes = (user && user.codigos_recuperacion_restantes) || 0;

  const generar = async (e) => {
    e.preventDefault();
    if (!clave) { setError("Ingrese su contraseña para continuar."); return; }
    setCargando(true); setError(null);
    try {
      const nuevos = await regenerateRecoveryCodes(clave);
      setCodigos(nuevos);
      setPidiendo(false); setClave("");
      if (onUserChange) onUserChange({ ...user, codigos_recuperacion_restantes: nuevos.length });
    } catch (err) {
      setError(err.message || "No se pudieron generar los códigos.");
    } finally {
      setCargando(false);
    }
  };

  return h("div", { className: "seguridad-sep" },
    h("div", { className: "ajuste-titulo" }, "Códigos de recuperación"),
    h("div", { className: "ajuste-desc" },
      restantes > 0
        ? "Le quedan " + restantes + " de 10. Cada uno le deja entrar una vez si pierde su teléfono."
        : "No tiene códigos disponibles. Genérelos para no depender de nadie si pierde su teléfono."),
    restantes > 0 && restantes <= 3 && !codigos && h("div", { className: "alert alert-warn", style: { marginTop: 10 } },
      h(I.alert, { size: 14 }), h("div", { style: { fontSize: 12.5 } }, "Le quedan pocos: genere unos nuevos.")),
    codigos && h("div", { style: { marginTop: 12 } }, h(CodigosRecuperacion, { codigos, email: user && user.email })),
    !pidiendo && h("button", { type: "button", className: "btn btn-secondary", style: { marginTop: 12 },
      onClick: () => { setPidiendo(true); setCodigos(null); } },
      h(I.refresh, { size: 14 }), "Generar códigos nuevos"),
    pidiendo && h("form", { className: "seguridad-form", onSubmit: generar, noValidate: true },
      h("div", { className: "ajuste-nota", style: { marginTop: 0 } },
        "Los códigos anteriores dejarán de servir. Confirme con su contraseña."),
      h("div", null,
        h(Label, { htmlFor: "seg-codigos-clave" }, "Contraseña"),
        h(Input, { id: "seg-codigos-clave", type: "password", icon: I.lock, autoComplete: "current-password",
          value: clave, error, onChange: (e) => { setClave(e.target.value); setError(null); } }),
        h(FieldError, { id: "seg-codigos-clave" }, error),
      ),
      h("div", { className: "row", style: { gap: 8 } },
        h("button", { type: "submit", className: "btn btn-primary", disabled: cargando },
          cargando ? h("span", { className: "spinner-sm" }) : h(I.shield, { size: 14 }),
          cargando ? "Generando…" : "Generar"),
        h("button", { type: "button", className: "btn btn-secondary", onClick: () => { setPidiendo(false); setError(null); } },
          "Cancelar")),
    ),
  );
}

// Teléfono nuevo: retira el segundo factor y obliga a volver a entrar, donde
// el sistema muestra un QR nuevo. Antes había que pedírselo a otro administrador.
function OtroTelefono({ onLogout }) {
  const [abierto, setAbierto]   = useState(false);
  const [clave, setClave]       = useState("");
  const [error, setError]       = useState(null);
  const [cargando, setCargando] = useState(false);

  const confirmar = async (e) => {
    e.preventDefault();
    if (!clave) { setError("Ingrese su contraseña para continuar."); return; }
    setCargando(true); setError(null);
    try {
      await resetOwnMfa(clave);
      toast.success("Verificación en dos pasos retirada", "Ingrese de nuevo y escanee el código QR con su nuevo teléfono.");
      if (onLogout) onLogout();
    } catch (err) {
      setError(err.message || "No se pudo retirar la verificación.");
      setCargando(false);
    }
  };

  return h("div", { className: "seguridad-sep" },
    h("div", { className: "ajuste-titulo" }, "¿Cambió de teléfono?"),
    h("div", { className: "ajuste-desc" },
      "Retire la verificación actual y, al volver a ingresar, escanee un código QR nuevo con su otro teléfono."),
    !abierto && h("button", { type: "button", className: "btn btn-secondary", style: { marginTop: 12 },
      onClick: () => setAbierto(true) }, h(I.shield, { size: 14 }), "Configurar en otro teléfono"),
    abierto && h("form", { className: "seguridad-form", onSubmit: confirmar, noValidate: true },
      h("div", { className: "ajuste-nota", style: { marginTop: 0 } },
        "Se cerrará la sesión en todos sus dispositivos. Confirme con su contraseña."),
      h("div", null,
        h(Label, { htmlFor: "seg-mfa-clave" }, "Contraseña"),
        h(Input, { id: "seg-mfa-clave", type: "password", icon: I.lock, autoComplete: "current-password",
          value: clave, error, onChange: (e) => { setClave(e.target.value); setError(null); } }),
        h(FieldError, { id: "seg-mfa-clave" }, error),
      ),
      h("div", { className: "row", style: { gap: 8 } },
        h("button", { type: "submit", className: "btn btn-primary", disabled: cargando },
          cargando ? h("span", { className: "spinner-sm" }) : h(I.shield, { size: 14 }),
          cargando ? "Retirando…" : "Retirar y volver a ingresar"),
        h("button", { type: "button", className: "btn btn-secondary", onClick: () => { setAbierto(false); setError(null); } },
          "Cancelar")),
    ),
  );
}

export function SeguridadCuenta({ user, onUserChange, onLogout }) {
  return h("div", { className: "card card-pad" },
    h("div", { className: "section-title" }, "Seguridad de la cuenta"),
    h("div", { className: "row", style: { gap: 12 } },
      h("span", { className: "ajuste-icono" }, h(I.lock, { size: 17 })),
      h("div", null,
        h("div", { className: "ajuste-titulo" }, "Cambiar contraseña"),
        h("div", { className: "ajuste-desc" },
          "Por seguridad, se cerrará la sesión en sus otros dispositivos."),
      ),
    ),
    h(CambiarClave, null),
    user && user.mfa_enabled && h(CodigosDeRespaldo, { user, onUserChange }),
    user && user.mfa_enabled && h(OtroTelefono, { onLogout }),
    h("div", { className: "ajuste-nota" },
      "¿Olvidó su contraseña? Cierre sesión y use «¿Olvidó su contraseña?» en la pantalla de ingreso: ",
      "le llegará un enlace a su correo."),
  );
}
