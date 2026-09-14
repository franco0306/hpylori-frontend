// Panel de administración técnica.
//
// Solo visible para cuentas con rol `admin`. Reúne lo que el gastroenterólogo
// no debe tocar: la salud del almacenamiento y la gestión de las cuentas.
//
// El umbral de decisión NO vive aquí. Está en Configuración, explicado en
// términos clínicos y con sus consecuencias. Dos controles del mismo valor
// acaban contradiciéndose, y el que gana suele ser el que menos se entiende.

import { I } from "../icons.js";
import { CONFIG } from "../config.js";
import { authFetch } from "../auth.js";
import { fmtLatencia } from "../format.js";
import { KpiCard } from "../components/Dashboard.js";
import { ESTADOS, useServiceStatus } from "../health.js";
import { ROLES, ROLE_LABEL, normalizeRole } from "../roles.js";

const React = window.React;
const { useState, useEffect, useCallback, useRef } = React;
const h = React.createElement;

// Solo respaldo si el servidor no informa su límite; el valor real llega en
// `limite_mb` y sale de SUPABASE_STORAGE_LIMIT_MB en el backend.
const CUOTA_MB = 500;

// Latencia por encima de la cual el análisis deja de sentirse inmediato en
// consulta. Es un objetivo de servicio, no el umbral de decisión clínica.
const OBJETIVO_LATENCIA_MS = 2000;

// Desde aquí se avisa de que el servidor puede estar reactivándose: un Space en
// reposo tarda cerca de un minuto en volver, y una pantalla quieta todo ese
// rato parece rota.
const TIEMPO_AVISO_MS = 6000;

// Longitud mínima de contraseña. Debe coincidir con MIN_PASSWORD_LEN del
// backend: si divergen, el formulario aceptaría algo que el servidor rechaza.
const MIN_CLAVE = 8;

/**
 * Traduce un fallo en una causa concreta.
 *
 * Un `catch` mudo obliga al administrador a adivinar, y lo primero que adivina
 * es que le han retirado los permisos —que casi nunca es lo que ha pasado—.
 * El 401 no llega hasta aquí: `authFetch` cierra la sesión y recarga.
 */
function describirFallo(error) {
  const estado = error && error.estado;

  if (estado === 403) {
    return "Su cuenta ya no tiene permisos de administrador. Cierre sesión y vuelva a entrar.";
  }
  if (estado === 429) {
    return "Se superó el límite de 30 solicitudes por minuto. Espere unos segundos y reintente.";
  }
  if (estado >= 500) {
    return "El servidor respondió con un error (HTTP " + estado + "). Reintente en unos momentos.";
  }
  if (error && error.name === "AbortError") {
    return "El servidor no respondió a tiempo. Si el servicio estuvo inactivo puede " +
           "tardar en reactivarse: reintente en un momento.";
  }
  return "No se pudo contactar con el servidor. Compruebe su conexión a internet y reintente.";
}

/**
 * Mensaje legible del `detail` de FastAPI, que llega como texto o como lista de
 * errores de validación. Sin esto, un "ese correo ya existe" se degradaría al
 * mensaje genérico de conexión y el administrador no sabría qué corregir.
 */
function detalleDeApi(cuerpo) {
  const detail = cuerpo && cuerpo.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const msg = (detail[0] && detail[0].msg) || "";
    return msg.replace(/^Value error,\s*/i, "") || null;
  }
  return null;
}

/** Envía JSON y devuelve la respuesta, con el motivo del servidor si falla. */
async function enviarJson(ruta, metodo, cuerpo) {
  const res = await authFetch(ruta, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
  });
  const datos = await res.json().catch(() => ({}));

  if (!res.ok) {
    const fallo = new Error("HTTP_" + res.status);
    fallo.estado = res.status;
    fallo.detalle = detalleDeApi(datos);
    throw fallo;
  }
  return datos;
}

/** `authFetch` que devuelve JSON o lanza un error con el código de estado adjunto. */
async function pedirJson(ruta, signal) {
  const res = await authFetch(ruta, { signal });
  if (!res.ok) {
    const fallo = new Error("HTTP_" + res.status);
    fallo.estado = res.status;
    throw fallo;
  }
  return res.json();
}

// Semáforo de capacidad. El texto viene del estado que calcula el servidor: si
// la interfaz recalculara los umbrales por su cuenta, ambos podrían discrepar.
const SEMAFORO = {
  // En estado óptimo no se usa `clase`: se pinta como píldora, no como alerta.
  optimo: {
    icono: "check",
    texto: "Infraestructura en rango óptimo de operación.",
  },
  alerta: {
    clase: "alert-warn",
    icono: "alert",
    texto: "Capacidad al 70 %. Se recomienda planificar el escalamiento de la " +
           "cuota en Supabase antes de que afecte al registro de estudios.",
  },
  critico: {
    clase: "alert-error",
    icono: "alert",
    texto: "Capacidad superior al 85 %. Riesgo inminente de saturación: ejecute " +
           "la purga de registros o amplíe la infraestructura.",
  },
};

/**
 * Impacto de una cuenta sobre la cuota contratada.
 *
 * Un consumo real pero diminuto no puede mostrarse como `0.00%`: eso se lee
 * como "no ocupa nada", que es una afirmación distinta. Cero de verdad sí es
 * cero.
 */
function fmtPctCuota(pct) {
  if (!pct) return "0%";
  return pct < 0.01 ? "<0.01%" : pct.toFixed(2) + "%";
}

/** Porcentaje de cuota con precisión suficiente para que un 0.03 % no sea 0 %. */
function fmtPct(pct) {
  if (!Number.isFinite(pct)) return "—";
  if (pct > 0 && pct < 0.01) return "< 0.01";
  return pct.toFixed(2);
}

function fmtBytes(bytes) {
  if (!Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

// ── Fechas ───────────────────────────────────────────────────────────────────
// `Intl` abrevia septiembre como "sept." en es-PE; la convención del proyecto
// es "set". Con tres letras fijas la columna nunca descuadra.
const MESES = ["ene", "feb", "mar", "abr", "may", "jun",
               "jul", "ago", "set", "oct", "nov", "dic"];

// El backend serializa UTC sin sufijo de zona. Sin la "Z" el navegador lo
// interpretaría como hora local y la última conexión aparecería desplazada
// cinco horas en Perú.
function aFecha(iso) {
  const texto = /[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z";
  return new Date(texto);
}

function fmtFechaHora(iso) {
  if (!iso) return null;
  const d = aFecha(iso);
  if (Number.isNaN(d.getTime())) return null;

  const dia = String(d.getDate()).padStart(2, "0");
  const crudas = d.getHours();
  const meridiano = crudas < 12 ? "a. m." : "p. m.";
  const horas = String(crudas % 12 || 12).padStart(2, "0");
  const minutos = String(d.getMinutes()).padStart(2, "0");

  return dia + "-" + MESES[d.getMonth()] + "-" + d.getFullYear() +
         " " + horas + ":" + minutos + " " + meridiano;
}

function iniciales(fila) {
  const fuente = (fila && (fila.name || fila.full_name || fila.email)) || "";
  const partes = fuente.trim().split(/\s+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return (fuente.slice(0, 2) || "?").toUpperCase();
}

// ── Ayuda contextual del KPI de disponibilidad ───────────────────────────────
// El disparador es un `button` con `aria-describedby`, no un `div` con
// `role="tooltip"`: ese rol describe la BURBUJA, no al elemento que la abre, y
// un `aria-label` sobre el contenedor sustituiría el texto en vez de anunciarlo.
// Se muestra con :hover y :focus-within, así que funciona con teclado sin JS.
function AyudaDisponibilidad() {
  return h("span", { className: "kpi-help-tooltip" },
    h("button", {
      type: "button",
      className: "kpi-help-icon",
      "aria-label": "Cómo se calcula la disponibilidad del motor",
      "aria-describedby": "ayuda-disponibilidad",
    }, "?"),

    h("span", {
      className: "kpi-tooltip-bubble",
      role: "tooltip",
      id: "ayuda-disponibilidad",
    },
      h("strong", null, "Disponibilidad operativa (uptime)"),
      h("p", null,
        "Audita en tiempo real la conectividad con el motor de inferencia en ",
        "Hugging Face mediante sondeos de salud periódicos, cada dos minutos."),

      h("span", { className: "tooltip-formula" },
        h("code", null, "Disponibilidad = [(T_total − T_caída) / T_total] × 100")),

      h("p", { className: "tooltip-meta" },
        h("strong", null, "Objetivo 99.9 %: "),
        "tolera un máximo de 43.2 minutos de inactividad acumulada sobre una ",
        "ventana mensual continua de 30 días (720 horas)."),

      // Sin esta línea, la fórmula da a entender que el panel calcula un
      // histórico. No lo hace: no se persiste el registro de caídas.
      h("p", { className: "tooltip-meta" },
        "La píldora refleja el resultado de la última comprobación, no una ",
        "medición acumulada: el sistema aún no guarda histórico de caídas."),
    ),
  );
}


// ── Módulo: KPIs de gobernanza ───────────────────────────────────────────────
// Cifras de cabecera del servicio, no del diagnóstico. Reutilizan la tarjeta
// `KpiCard` del panel clínico para que ambas pantallas se lean igual.
function KpisGobernanza({ usuarios, almacenamiento, cargando, estadoServicio }) {
  const medicos = usuarios.filter((u) => normalizeRole(u.role) === ROLES.MEDICO).length;
  const admins = usuarios.length - medicos;
  const plural = (n, singular, plurales) => n + " " + (n === 1 ? singular : plurales);

  const media = almacenamiento && almacenamiento.latencia_media_ms;
  const hayMedia = typeof media === "number";
  const dentroDeObjetivo = hayMedia && media < OBJETIVO_LATENCIA_MS;
  const colorLatencia = !hayMedia
    ? "var(--ink-400)"
    : dentroDeObjetivo ? "var(--green-600)" : "var(--amber-600)";

  // Un servidor sin desplegar aún no devuelve el campo. No es lo mismo que
  // devolverlo vacío, y decir "no hay estudios" en ese caso sería falso.
  const campoAusente = Boolean(almacenamiento) && !("latencia_media_ms" in almacenamiento);
  const subLatencia = hayMedia
    ? "Objetivo clínico < 2.0 s"
    : campoAusente ? "El servidor aún no informa esta métrica"
                   : "Aún no hay estudios registrados";

  const online = estadoServicio === ESTADOS.ONLINE;
  const comprobando = estadoServicio === ESTADOS.COMPROBANDO;
  const claseEstado = comprobando ? " pill-estado-wait" : online ? "" : " pill-estado-off";
  const textoEstado = comprobando ? "Comprobando…" : online ? "Operativo" : "Sin conexión";

  return h("div", { className: "kpi-grid", style: { marginBottom: 20 } },
    h(KpiCard, {
      label: "Cuentas registradas",
      value: cargando ? "…" : usuarios.length,
      sub: cargando
        ? "Consultando…"
        : plural(medicos, "médico", "médicos") + " · " + plural(admins, "admin", "admins"),
      barColor: "var(--blue-700)",
    }),

    h(KpiCard, {
      label: "Estudios clínicos",
      value: cargando ? "…" : almacenamiento ? almacenamiento.estudios_totales : "—",
      sub: "Registros procesados",
      barColor: "var(--ink-700)",
      valueColor: "var(--ink-900)",
    }),

    h(KpiCard, {
      label: "Inferencia promedio",
      value: cargando ? "…" : hayMedia ? fmtLatencia(media) + " ms" : "—",
      // Sin datos no se inventa una cifra: se dice por qué no la hay.
      sub: subLatencia,
      barColor: colorLatencia,
      valueColor: colorLatencia,
    }),

    h(KpiCard, {
      // La tarjeta deja de recortar: la burbuja del tooltip se sale de ella.
      permitirDesborde: true,
      label: h("span", { className: "kpi-header-with-help" },
        h("span", { className: "kpi-title" }, "Disponibilidad del motor"),
        h(AyudaDisponibilidad, null),
      ),
      // Estado medido por la sonda, no una cifra de tiempo de servicio: nadie
      // registra el histórico de caídas, así que el 99.9 % va como objetivo.
      value: h("span", {
        className: "pill-estado" + claseEstado,
        style: { fontSize: 13, fontFamily: "inherit", letterSpacing: 0 },
      },
        h("span", {
          className: "dot" + (comprobando ? " dot-checking" : online ? "" : " dot-offline"),
          "aria-hidden": true,
        }),
        textoEstado,
      ),
      sub: "Motor en Hugging Face · Objetivo 99.9 %",
      barColor: comprobando ? "var(--ink-400)" : online ? "var(--green-600)" : "var(--red-600)",
    }),
  );
}

// ── Módulo: auditoría de base de datos y almacenamiento ──────────────────────

/** Entero con separador de millares. 128000 filas se leen mucho mejor así. */
function fmtNumero(n) {
  return Number.isFinite(n) ? Number(n).toLocaleString("es-PE") : "—";
}

// Desglose por tabla. Vive dentro de la tarjeta de almacenamiento, no en una
// propia: total y desglose son el mismo dato a dos escalas, y separarlos en
// dos tarjetas obligaba a saltar entre ellas para relacionarlos.
function DesgloseTablas({ tablas, bytesTotales }) {
  if (!tablas || !tablas.length) return null;   // early return

  return h("div", { className: "subseccion" },
    h("div", { className: "subseccion-titulo" }, "Desglose por tabla"),
    h("div", { className: "table-wrap" },
      h("table", { className: "table tabla-desglose" },
        h("thead", null, h("tr", null,
          h("th", null, "Tabla"),
          h("th", null, "Filas"),
          h("th", null, "Tamaño"),
          h("th", null, "Proporción"),
        )),
        h("tbody", null,
          tablas.map((t) => {
            const pct = bytesTotales > 0 ? (t.bytes / bytesTotales) * 100 : 0;
            return h("tr", { key: t.nombre },
              h("td", null,
                h("div", { style: { fontWeight: 500 } }, t.etiqueta),
                h("div", { className: "mono", style: { fontSize: 11, color: "var(--ink-500)" } },
                  t.nombre),
              ),
              h("td", { className: "mono" }, fmtNumero(t.filas)),
              h("td", { className: "mono" },
                fmtBytes(t.bytes),
                t.estimado && h("span", { title: "El motor no informa el tamaño real: se estima desde el número de filas" },
                  " ≈"),
              ),
              h("td", null,
                h("div", { className: "storage-cell" },
                  h("div", { className: "storage-bar-row" },
                    h("div", {
                      className: "storage-track",
                      role: "img",
                      "aria-label": t.etiqueta + " ocupa el " + pct.toFixed(1) +
                                    " por ciento de la base",
                    },
                      h("div", {
                        className: "storage-fill",
                        style: { width: Math.min(100, Math.max(pct, 2)) + "%" },
                      }),
                    ),
                    h("span", { className: "storage-pct" }, pct.toFixed(1) + "%"),
                  ),
                ),
              ),
            );
          }),
        ),
      ),
    ),
  );
}


function AuditoriaAlmacenamiento({ datos, cargando, error, onReintentar,
                                   purgando, purgaResultado, onPurgar }) {
  const bytes = datos ? datos.bytes_ocupados : 0;
  const limiteMb = (datos && datos.limite_mb) || CUOTA_MB;
  const pct = datos ? datos.cuota_consumida_pct : 0;
  const consumoTexto = fmtPct(pct);
  // La barra se recorta al 100 %; el número puede pasarse, y debe verse que lo hace.
  const anchoBarra = Math.min(100, Math.max(0.6, pct || 0));
  const estimado = Boolean(datos && datos.estimado);
  const estado = (datos && datos.estado_infraestructura) || "optimo";
  const semaforo = SEMAFORO[estado] || null;
  const libresMb = datos ? Math.max(0, limiteMb - bytes / (1024 * 1024)) : null;

  // Sin datos no se pinta un cero: un cero se lee como "no hay nada guardado",
  // que es una afirmación distinta de "no se pudo consultar".
  const valor = (contenido) => (cargando ? "…" : datos ? contenido : "—");

  if (error && !cargando) {
    return h("div", { className: "card card-pad" },
      h("div", { className: "section-title" }, "Almacenamiento"),
      h("div", { className: "alert alert-error", role: "status" },
        h(I.alert, { size: 14 }),
        h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } }, error),
      ),
      h("button", {
        className: "btn btn-secondary",
        style: { marginTop: 14 },
        onClick: onReintentar,
        "aria-label": "Reintentar la consulta de almacenamiento",
      }, h(I.refresh, { size: 14 }), "Reintentar"),
    );
  }

  // El estado va en la cabecera, alineado a la derecha del título: es la
  // primera pregunta que responde la pantalla, y ahí se ve sin buscarlo.
  const pildoraEstado = semaforo && !cargando && h("span", {
    className: "pill-estado" + (estado === "critico" ? " pill-estado-off"
                              : estado === "alerta" ? " pill-estado-wait" : ""),
    role: "status",
  },
    h("span", {
      className: "dot" + (estado === "critico" ? " dot-offline"
                        : estado === "alerta" ? " dot-checking" : ""),
      "aria-hidden": true,
    }),
    estado === "optimo" ? "Rango óptimo" : estado === "alerta" ? "En aviso" : "Crítico",
  );

  return h("div", null,
    h("div", { className: "card card-pad" },
      h("div", { className: "section-head" },
        h("div", { className: "section-title", style: { marginBottom: 0 } }, "Almacenamiento"),
        pildoraEstado,
      ),

      h("div", { className: "admin-metrics" },
        h("div", { className: "admin-metric" },
          h("div", { className: "admin-metric-label" }, "Estudios registrados"),
          h("div", { className: "admin-metric-value" },
            valor(datos && fmtNumero(datos.estudios_totales))),
          h("div", { className: "admin-metric-hint" }, "Filas en la tabla de estudios"),
        ),
        h("div", { className: "admin-metric" },
          h("div", { className: "admin-metric-label" }, "Almacenamiento ocupado"),
          h("div", { className: "admin-metric-value" }, valor(fmtBytes(bytes))),
          h("div", { className: "admin-metric-hint" },
            estimado ? "≈ 200 B por estudio (estimado)" : "Tamaño real de la tabla"),
        ),
        h("div", { className: "admin-metric" },
          h("div", { className: "admin-metric-label" }, "Cuota consumida"),
          h("div", { className: "admin-metric-value" }, valor(consumoTexto + " %")),
          h("div", { className: "admin-metric-hint" }, "Sobre " + limiteMb + " MB contratados"),
        ),
      ),

      // La barra lleva su lectura al lado: con la base al 0.03 % el relleno es
      // invisible y, sola, parecía una barra rota en vez de una casi vacía.
      h("div", { className: "quota-row" },
        h("div", {
          className: "admin-quota",
          role: "img",
          "aria-label": "Cuota consumida: " + consumoTexto + " por ciento",
        },
          h("div", {
            className: "admin-quota-fill quota-" + estado,
            style: { width: anchoBarra + "%" },
          }),
        ),
        h("span", { className: "quota-leyenda" },
          libresMb === null ? "—"
            : fmtNumero(Math.round(libresMb * 100) / 100) + " MB libres"),
      ),

      // Solo en aviso o crítico: en óptimo la píldora de la cabecera ya lo dice
      // y repetirlo en un banner sería justo el ruido que se quiere evitar.
      semaforo && !cargando && estado !== "optimo" && h("div", {
        className: "alert " + semaforo.clase,
        style: { marginTop: 14 },
        role: "status",
      },
        h(I[semaforo.icono], { size: 14 }),
        h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } },
          h("strong", null, estado === "critico" ? "Saturación inminente. " : "Capacidad en aviso. "),
          semaforo.texto,
        ),
      ),

      estimado && !cargando && h("div", { className: "alert alert-info", style: { marginTop: 12 } },
        h(I.info, { size: 14 }),
        h("div", { style: { fontSize: 12, lineHeight: 1.5 } },
          h("strong", null, "Cifras estimadas. "),
          "El motor de base de datos no informa el tamaño real de las tablas, así ",
          "que se calcula desde el número de filas y el tamaño conocido del esquema.",
        ),
      ),

      !cargando && datos && h(DesgloseTablas, {
        tablas: datos.tablas,
        bytesTotales: datos.bytes_totales_bd,
      }),
    ),

    // Mantenimiento en una sola fila: texto a la izquierda, acción a la
    // derecha. Un botón no necesita una tarjeta con párrafo propio.
    h("div", { className: "card card-pad mantenimiento" },
      h("div", { className: "mantenimiento-fila" },
        h("div", null,
          h("div", { className: "section-title", style: { marginBottom: 4 } }, "Mantenimiento"),
          h("div", { className: "seccion-nota", style: { margin: 0 } },
            "Elimina estudios cuyo usuario ya no existe. No toca el historial de ",
            "ninguna cuenta activa."),
        ),
        h("button", {
          className: "btn btn-secondary",
          onClick: onPurgar,
          disabled: purgando,
          "aria-label": "Purgar registros huérfanos de la base de datos",
        },
          purgando ? h("span", { className: "spinner-sm" }) : h(I.trash, { size: 14 }),
          purgando ? "Purgando…" : "Purgar huérfanos",
        ),
      ),
      purgaResultado && h("div", {
        className: "alert " + (purgaResultado.ok ? "alert-info" : "alert-warn"),
        style: { marginTop: 12 },
        role: "status",
      },
        h(purgaResultado.ok ? I.check : I.alert, { size: 14 }),
        h("div", { style: { fontSize: 12.5 } }, purgaResultado.mensaje),
      ),
    ),
  );
}


// ── Modal: restablecer contraseña ────────────────────────────────────────────
const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), ' +
  'select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Confina el tabulador dentro del diálogo: el fondo está bloqueado. */
function atraparFoco(e, contenedor) {
  if (e.key !== "Tab" || !contenedor) return;   // early return

  const items = Array.from(contenedor.querySelectorAll(FOCUSABLE));
  if (!items.length) return;

  const inicio = items[0];
  const fin = items[items.length - 1];
  if (e.shiftKey && document.activeElement === inicio) {
    e.preventDefault();
    fin.focus();
  } else if (!e.shiftKey && document.activeElement === fin) {
    e.preventDefault();
    inicio.focus();
  }
}

function ModalRestablecer({ fila, estado, error, onConfirmar, onCerrar }) {
  const dialogRef = useRef(null);
  const [clave, setClave] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [verClave, setVerClave] = useState(false);

  // Foco inicial, confinamiento del tabulador y devolución del foco al cerrar.
  useEffect(() => {
    const previo = document.activeElement;
    const primero = dialogRef.current && dialogRef.current.querySelector(FOCUSABLE);
    if (primero) primero.focus();

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCerrar();
        return;
      }
      atraparFoco(e, dialogRef.current);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (previo && previo.focus) previo.focus();
    };
  }, [onCerrar]);

  const nombre = fila.name || fila.full_name || fila.email;
  const listo = estado === "listo";
  const enviando = estado === "enviando";

  const corta = clave.length > 0 && clave.length < MIN_CLAVE;
  const noCoincide = confirmacion.length > 0 && clave !== confirmacion;
  const valida = clave.length >= MIN_CLAVE && clave === confirmacion;

  // El aviso aparece solo cuando el campo implicado ya tiene contenido: avisar
  // de que "es corta" sobre un campo vacío es ruido, no ayuda.
  const problema = corta
    ? "La contraseña debe tener al menos " + MIN_CLAVE + " caracteres."
    : noCoincide ? "Las dos contraseñas no coinciden." : null;

  const handleEnviar = (e) => {
    e.preventDefault();
    if (!valida || enviando) return;   // early return
    onConfirmar(clave);
  };

  const campo = (id, etiqueta, valor, alCambiar, describedBy) => [
    h("label", { key: id + "-l", className: "auth-label", htmlFor: id }, etiqueta),
    h("input", {
      key: id,
      id,
      className: "input",
      style: { width: "100%", marginBottom: 14 },
      // Un gestor de contraseñas no debe autorrellenar la clave del admin aquí.
      type: verClave ? "text" : "password",
      value: valor,
      onChange: (e) => alCambiar(e.target.value),
      autoComplete: "new-password",
      required: true,
      "aria-describedby": describedBy,
    }),
  ];

  return h("div", { className: "modal-backdrop" },
    h("form", {
      className: "modal",
      style: { maxWidth: 480 },
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "reset-titulo",
      ref: dialogRef,
      onSubmit: handleEnviar,
    },
      h("div", { className: "modal-head" },
        h("div", { className: "modal-mark" }, h(I.lock, { size: 18 })),
        h("div", null,
          h("h2", { className: "modal-title", id: "reset-titulo" },
            listo ? "Contraseña actualizada" : "Cambiar contraseña"),
          h("div", { className: "modal-sub" }, nombre + " · " + fila.email),
        ),
        h("button", {
          type: "button",
          className: "btn btn-ghost btn-icon",
          onClick: onCerrar,
          "aria-label": "Cerrar el diálogo",
        }, h(I.x, { size: 16 })),
      ),

      h("div", { className: "modal-body" },
        !listo && h("div", null,
          h("p", null,
            "Defina la nueva contraseña de ", h("strong", null, nombre),
            ". La anterior dejará de servir de inmediato, y tendrá que ",
            "comunicarle la nueva por un canal seguro: el sistema no envía correos.",
          ),

          ...campo("reset-clave", "Nueva contraseña", clave, setClave, "reset-requisito"),
          ...campo("reset-confirmar", "Confirmar contraseña", confirmacion, setConfirmacion),

          h("label", {
            className: "row",
            style: { gap: 8, fontSize: 12.5, color: "var(--ink-600)", cursor: "pointer" },
          },
            h("input", {
              type: "checkbox",
              checked: verClave,
              onChange: (e) => setVerClave(e.target.checked),
            }),
            "Mostrar contraseñas",
          ),

          h("div", {
            id: "reset-requisito",
            style: { fontSize: 11.5, color: "var(--ink-500)", marginTop: 10 },
          }, "Mínimo " + MIN_CLAVE + " caracteres."),

          problema && h("div", {
            className: "alert alert-error",
            style: { marginTop: 12 },
            role: "status",
          },
            h(I.alert, { size: 14 }),
            h("div", { style: { fontSize: 12.5 } }, problema),
          ),
        ),

        error && h("div", { className: "alert alert-error", style: { marginTop: 12 } },
          h(I.alert, { size: 14 }),
          h("div", { style: { fontSize: 12.5 } }, error),
        ),

        listo && h("div", { "aria-live": "polite" },
          h("div", { className: "alert alert-info" },
            h(I.check, { size: 14 }),
            h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } },
              "La contraseña de ", h("strong", null, fila.email),
              " quedó actualizada. Solo servirá la nueva para iniciar sesión.",
            ),
          ),
          h("div", { className: "alert alert-warn", style: { marginTop: 12 } },
            h(I.alert, { size: 14 }),
            h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } },
              "Cambiar la contraseña no cierra las sesiones que ya estén abiertas. ",
              "Si sospecha de un acceso indebido, deshabilite y vuelva a habilitar ",
              "la cuenta: eso sí invalida sus tokens.",
            ),
          ),
        ),
      ),

      h("div", { className: "modal-foot" },
        h("div", { className: "modal-actions", style: { marginTop: 0 } },
          listo
            ? h("button", {
                type: "button", className: "btn btn-primary", onClick: onCerrar,
              }, "Entendido")
            : [
                h("button", {
                  key: "cancelar",
                  type: "button",
                  className: "btn btn-secondary",
                  onClick: onCerrar,
                  disabled: enviando,
                }, "Cancelar"),
                h("button", {
                  key: "confirmar",
                  type: "submit",
                  className: "btn btn-primary",
                  disabled: enviando || !valida,
                },
                  enviando ? h("span", { className: "spinner-sm" }) : h(I.lock, { size: 14 }),
                  enviando ? "Guardando…" : "Cambiar contraseña",
                ),
              ],
        ),
      ),
    ),
  );
}


// ── Menú de acciones por cuenta (kebab) ──────────────────────────────────────
function MenuAcciones({ fila, abierto, esPropio, onAlternar, onCerrar,
                        onEditar, onClave, onEstado, onEliminar }) {
  const contenedor = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;

    const handleFuera = (e) => {
      if (contenedor.current && !contenedor.current.contains(e.target)) onCerrar();
    };
    const handleTecla = (e) => {
      if (e.key !== "Escape") return;   // early return
      e.preventDefault();
      onCerrar();
    };

    document.addEventListener("mousedown", handleFuera);
    document.addEventListener("keydown", handleTecla);
    return () => {
      document.removeEventListener("mousedown", handleFuera);
      document.removeEventListener("keydown", handleTecla);
    };
  }, [abierto, onCerrar]);

  const activo = fila.activo !== false;
  const nombre = fila.name || fila.full_name || fila.email;

  const opcion = (props, icono, texto) =>
    h("button", {
      type: "button",
      role: "menuitem",
      className: "dropdown-item" + (props.peligro ? " dropdown-item-peligro" : ""),
      onClick: props.onClick,
      disabled: props.disabled,
      title: props.title,
    }, h(icono, { size: 14, "aria-hidden": true }), texto);

  return h("div", { className: "dropdown", ref: contenedor },
    h("button", {
      type: "button",
      className: "dropdown-toggle" + (abierto ? " abierto" : ""),
      onClick: onAlternar,
      "aria-haspopup": "true",
      "aria-expanded": abierto ? "true" : "false",
      "aria-label": "Acciones para " + nombre + " (" + fila.email + ")",
    }, h(I.dots, { size: 16, "aria-hidden": true })),

    abierto && h("div", {
      className: "dropdown-menu",
      role: "menu",
      "aria-label": "Acciones de cuenta",
    },
      opcion({ onClick: () => onEditar(fila) }, I.edit, "Editar datos"),
      opcion({ onClick: () => onClave(fila) }, I.lock, "Cambiar contraseña"),
      h("div", { className: "dropdown-sep", role: "separator" }),
      opcion({
        onClick: () => onEstado(fila),
        disabled: esPropio,
        title: esPropio ? "No puede deshabilitar su propia cuenta" : undefined,
      }, activo ? I.ban : I.check, activo ? "Deshabilitar acceso" : "Habilitar acceso"),
      opcion({
        onClick: () => onEliminar(fila),
        disabled: esPropio,
        peligro: true,
        title: esPropio ? "No puede eliminar su propia cuenta" : undefined,
      }, I.trash, "Eliminar permanentemente"),
    ),
  );
}


// ── Modal: editar datos de la cuenta ─────────────────────────────────────────
function ModalEditar({ fila, guardando, error, onGuardar, onCerrar }) {
  const [nombre, setNombre] = useState(fila.name || fila.full_name || "");
  const [correo, setCorreo] = useState(fila.email || "");
  const dialogo = useRef(null);

  useEffect(() => {
    const previo = document.activeElement;
    const primero = dialogo.current && dialogo.current.querySelector(FOCUSABLE);
    if (primero) primero.focus();

    const handleTecla = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onCerrar(); return; }
      atraparFoco(e, dialogo.current);
    };
    document.addEventListener("keydown", handleTecla);
    return () => {
      document.removeEventListener("keydown", handleTecla);
      if (previo && previo.focus) previo.focus();
    };
  }, [onCerrar]);

  const sinCambios = nombre.trim() === (fila.name || fila.full_name || "") &&
                     correo.trim() === (fila.email || "");

  const handleEnviar = (e) => {
    e.preventDefault();
    if (sinCambios || guardando) return;   // early return
    onGuardar({ full_name: nombre.trim() || null, email: correo.trim() });
  };

  return h("div", { className: "modal-backdrop" },
    h("form", {
      className: "modal",
      style: { maxWidth: 460 },
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "editar-titulo",
      ref: dialogo,
      onSubmit: handleEnviar,
    },
      h("div", { className: "modal-head" },
        h("div", { className: "modal-mark" }, h(I.edit, { size: 18 })),
        h("div", null,
          h("h2", { className: "modal-title", id: "editar-titulo" }, "Editar datos"),
          h("div", { className: "modal-sub" }, fila.email),
        ),
        h("button", {
          type: "button",
          className: "btn btn-ghost btn-icon",
          onClick: onCerrar,
          "aria-label": "Cerrar el diálogo",
        }, h(I.x, { size: 16 })),
      ),

      h("div", { className: "modal-body" },
        h("label", { className: "auth-label", htmlFor: "editar-nombre" }, "Nombre completo"),
        h("input", {
          id: "editar-nombre",
          className: "input",
          style: { width: "100%", marginBottom: 14 },
          value: nombre,
          onChange: (e) => setNombre(e.target.value),
          placeholder: "Walter Cueva",
          autoComplete: "off",
        }),

        h("label", { className: "auth-label", htmlFor: "editar-correo" }, "Correo electrónico"),
        h("input", {
          id: "editar-correo",
          className: "input",
          style: { width: "100%" },
          type: "email",
          value: correo,
          onChange: (e) => setCorreo(e.target.value),
          required: true,
          autoComplete: "off",
        }),

        h("div", { style: { fontSize: 11.5, color: "var(--ink-500)", marginTop: 8 } },
          "El correo es la credencial de acceso: al cambiarlo, la persona entrará con el nuevo."),

        error && h("div", { className: "alert alert-error", style: { marginTop: 14 } },
          h(I.alert, { size: 14 }),
          h("div", { style: { fontSize: 12.5 } }, error),
        ),
      ),

      h("div", { className: "modal-foot" },
        h("div", { className: "modal-actions", style: { marginTop: 0 } },
          h("button", {
            type: "button", className: "btn btn-secondary", onClick: onCerrar,
          }, "Cancelar"),
          h("button", {
            type: "submit", className: "btn btn-primary", disabled: guardando || sinCambios,
          },
            guardando ? h("span", { className: "spinner-sm" }) : h(I.check, { size: 14 }),
            guardando ? "Guardando…" : "Guardar cambios",
          ),
        ),
      ),
    ),
  );
}


// ── Modal: borrado permanente ────────────────────────────────────────────────
function ModalEliminar({ fila, borrando, error, onConfirmar, onCerrar }) {
  const dialogo = useRef(null);

  useEffect(() => {
    const previo = document.activeElement;
    // El foco arranca en Cancelar, no en el botón destructivo: un Enter de más
    // no debe borrar una cuenta.
    const items = dialogo.current ? dialogo.current.querySelectorAll(FOCUSABLE) : [];
    if (items.length) items[items.length - 2] ? items[items.length - 2].focus()
                                              : items[0].focus();

    const handleTecla = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onCerrar(); return; }
      atraparFoco(e, dialogo.current);
    };
    document.addEventListener("keydown", handleTecla);
    return () => {
      document.removeEventListener("keydown", handleTecla);
      if (previo && previo.focus) previo.focus();
    };
  }, [onCerrar]);

  const nombre = fila.name || fila.full_name || fila.email;

  return h("div", { className: "modal-backdrop" },
    h("div", {
      className: "modal",
      style: { maxWidth: 470 },
      role: "alertdialog",
      "aria-modal": "true",
      "aria-labelledby": "eliminar-titulo",
      ref: dialogo,
    },
      h("div", { className: "modal-head" },
        h("div", { className: "modal-mark modal-mark-peligro" }, h(I.trash, { size: 18 })),
        h("div", null,
          h("h2", { className: "modal-title", id: "eliminar-titulo" },
            "Eliminar cuenta permanentemente"),
          h("div", { className: "modal-sub" }, nombre + " · " + fila.email),
        ),
      ),

      h("div", { className: "modal-body" },
        h("p", null,
          "Se borrarán la cuenta y ",
          h("strong", null, "todos sus estudios clínicos"),
          ". Esta acción no se puede deshacer y los registros no se podrán recuperar.",
        ),
        h("div", { className: "alert alert-warn" },
          h(I.info, { size: 14 }),
          h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } },
            "Si solo quiere retirar el acceso, use ", h("strong", null, "Deshabilitar acceso"),
            ": bloquea la entrada y conserva el historial.",
          ),
        ),
        error && h("div", { className: "alert alert-error", style: { marginTop: 12 } },
          h(I.alert, { size: 14 }),
          h("div", { style: { fontSize: 12.5 } }, error),
        ),
      ),

      h("div", { className: "modal-foot" },
        h("div", { className: "modal-actions", style: { marginTop: 0 } },
          h("button", {
            type: "button", className: "btn btn-secondary",
            onClick: onCerrar, disabled: borrando,
          }, "Cancelar"),
          h("button", {
            type: "button", className: "btn btn-peligro",
            onClick: onConfirmar, disabled: borrando,
          },
            borrando ? h("span", { className: "spinner-sm" }) : h(I.trash, { size: 14 }),
            borrando ? "Eliminando…" : "Eliminar definitivamente",
          ),
        ),
      ),
    ),
  );
}


// ── Módulo: gestión de cuentas ───────────────────────────────────────────────
function GestionCuentas({ usuarios, cargando, lento, error, idPropio, cambiando, aviso,
                          limiteMb, menuAbierto, onAlternarMenu, onCerrarMenu,
                          onCambiarRol, onRestablecer, onEditar, onCambiarEstado,
                          onEliminar, onReintentar }) {
  // Solo para el rótulo del título emergente; el porcentaje ya viene calculado
  // contra este mismo límite desde el servidor.
  const limiteCuotaMb = limiteMb || CUOTA_MB;

  const cuerpo = () => {
    if (cargando) {
      return h("div", { className: "admin-vacio", role: "status" },
        h("div", { className: "row", style: { gap: 10, justifyContent: "center" } },
          h("span", { className: "spinner-sm" }),
          h("span", null, "Cargando cuentas…"),
        ),
        // El Space del backend duerme tras un periodo sin uso y tarda cerca de
        // un minuto en volver. Decirlo evita que parezca que se ha colgado.
        lento && h("div", { style: { marginTop: 10, fontSize: 12, color: "var(--ink-500)" } },
          "El servidor está tardando más de lo normal. Si el servicio estuvo ",
          "inactivo, puede estar reactivándose."),
      );
    }
    if (error) {
      return h("div", { style: { padding: "16px 20px" } },
        h("div", { className: "alert alert-error", role: "status", style: { marginBottom: 12 } },
          h(I.alert, { size: 14 }),
          h("div", { style: { fontSize: 12.5, lineHeight: 1.5 } }, error),
        ),
        h("button", {
          className: "btn btn-secondary",
          onClick: onReintentar,
          "aria-label": "Reintentar la carga del listado de cuentas",
        }, h(I.refresh, { size: 14 }), "Reintentar"),
      );
    }
    if (!usuarios.length) {
      return h("div", { className: "admin-vacio" }, "No hay cuentas registradas.");
    }

    return h("table", { className: "table admin-users" },
      h("thead", null, h("tr", null,
        h("th", null, "Usuario"),
        h("th", null, "Correo electrónico"),
        h("th", null, "Rol"),
        h("th", null, "Última conexión"),
        h("th", null, "Estado"),
        h("th", null, "Almacenamiento"),
        h("th", { className: "col-acciones" }, "Acciones"),
      )),
      h("tbody", null,
        usuarios.map((u) => {
          const rol = normalizeRole(u.role);
          const esPropio = u.id === idPropio;
          const ocupado = cambiando === u.id;
          const nombre = u.name || u.full_name || "—";
          const fecha = fmtFechaHora(u.last_login);
          const destino = rol === ROLES.ADMIN ? ROLES.MEDICO : ROLES.ADMIN;
          // Impacto sobre la cuota contratada, que es la pregunta de capacidad.
          // `pct_almacenamiento` mide otra cosa —qué parte del historial es
          // suya— y por eso no manda aquí: con la base al 0.05 %, tener el 67 %
          // de los estudios no supone riesgo alguno de infraestructura.
          // Se normaliza a número: un backend anterior no envía el campo, y
          // `undefined.toFixed()` tumbaría la tabla entera.
          const pctCuota = Number(u.pct_cuota_sistema) || 0;

          return h("tr", { key: u.id || u.email },
            h("td", null,
              h("div", { className: "row", style: { gap: 10 } },
                h("div", { className: "avatar avatar-sm", "aria-hidden": true }, iniciales(u)),
                h("span", { style: { fontWeight: 500 } }, nombre),
              )),

            h("td", { className: "mono", style: { fontSize: 12 } }, u.email || "—"),

            h("td", null,
              h("button", {
                type: "button",
                className: "role-toggle badge " +
                  (rol === ROLES.ADMIN ? "badge-info" : "badge-neutral"),
                onClick: () => onCambiarRol(u),
                disabled: esPropio || ocupado,
                title: esPropio
                  ? "No puede cambiar su propio rol"
                  : "Cambiar a " + ROLE_LABEL[destino],
                "aria-label": esPropio
                  ? "Su cuenta es " + ROLE_LABEL[rol] + ". No puede cambiar su propio rol."
                  : "Cambiar el rol de " + u.email + " a " + ROLE_LABEL[destino],
              },
                ocupado ? h("span", { className: "spinner-sm" }) : null,
                ROLE_LABEL[rol],
                !esPropio && !ocupado && h(I.refresh, { size: 11, "aria-hidden": true }),
              )),

            // Cuando la cuenta es anterior a la columna `last_login`, el servidor
            // devuelve el alta: se rotula como tal en lugar de hacerla pasar por
            // un ingreso que nunca ocurrió.
            h("td", { style: { fontSize: 12.5, color: "var(--ink-600)" } },
              !fecha
                ? h("span", { className: "muted" }, "Sin ingresos recientes")
                : u.last_login_real === false
                  ? h("span", { title: "Esta cuenta no ha iniciado sesión desde que se registra la actividad" },
                      "Alta: " + fecha)
                  : fecha),

            h("td", null,
              h("span", {
                className: "pill-estado" + (u.activo === false ? " pill-estado-wait" : ""),
                title: u.activo === false
                  ? "La cuenta no puede iniciar sesión. Su historial se conserva."
                  : undefined,
              },
                h("span", {
                  className: "dot" + (u.activo === false ? " dot-checking" : ""),
                  "aria-hidden": true,
                }),
                u.activo === false ? "Inactivo" : "Activo")),

            // Cuota de la cuenta sobre el historial completo. Es un reparto
            // proporcional al número de estudios, no una medida por fila.
            h("td", null,
              u.estudios
                ? h("div", { className: "storage-cell" },
                    h("div", { className: "storage-bar-row" },
                      h("div", {
                        className: "storage-track",
                        title: pctCuota + "% de la cuota total de " + limiteCuotaMb + " MB",
                        role: "img",
                        "aria-label": "Ocupa el " + fmtPctCuota(pctCuota) +
                                      " de la cuota contratada",
                      },
                        // La barra amplifica x10 para que un consumo minúsculo
                        // siga siendo visible; el número de al lado y el título
                        // llevan siempre la cifra real, sin amplificar.
                        h("div", {
                          className: "storage-fill",
                          style: { width: Math.min(100, Math.max(pctCuota * 10, 2)) + "%" },
                        }),
                      ),
                      h("span", { className: "storage-pct" }, fmtPctCuota(pctCuota)),
                    ),
                    h("span", { className: "storage-meta" },
                      u.estudios + (u.estudios === 1 ? " estudio" : " estudios") +
                      (u.kb_estimados ? " · " + u.kb_estimados + " KB" : "")),
                  )
                // Sin estudios no se pinta una barra vacía: un guion dice
                // "no aplica", que es más honesto que un 0 % con su pista.
                : h("div", { className: "storage-cell storage-empty" },
                    h("span", { className: "storage-none", "aria-hidden": true }, "—"),
                    h("span", { className: "storage-meta" }, "Sin estudios"),
                  )),

            h("td", { className: "col-acciones" },
              h(MenuAcciones, {
                fila: u,
                abierto: menuAbierto === u.id,
                esPropio,
                onAlternar: () => onAlternarMenu(u.id),
                onCerrar: onCerrarMenu,
                onEditar: onEditar,
                onClave: onRestablecer,
                onEstado: onCambiarEstado,
                onEliminar: onEliminar,
              })),
          );
        }),
      ),
    );
  };

  return h("div", { className: "card" },
    h("div", { className: "card-head" },
      h("div", null,
        h("h3", { className: "card-title" }, "Gestión de cuentas"),
        h("div", { className: "card-sub" }, "Usuarios registrados, nivel de acceso y actividad"),
      ),
      h("span", { className: "badge badge-neutral" }, usuarios.length),
    ),

    aviso && h("div", {
      className: "alert " + (aviso.ok ? "alert-info" : "alert-error"),
      style: { margin: "16px 20px 0" },
      role: "status",
    },
      h(aviso.ok ? I.check : I.alert, { size: 14 }),
      h("div", { style: { fontSize: 12.5 } }, aviso.texto),
    ),

    // `overflow-x` recortaría el menú flotante: mientras hay uno abierto se
    // libera el desbordamiento, a costa del desplazamiento horizontal.
    h("div", {
      className: "table-wrap" + (menuAbierto ? " sin-recorte" : ""),
    }, cuerpo()),
  );
}

// ── Pantalla ─────────────────────────────────────────────────────────────────
export function AdminScreen({ section = "panel", user }) {
  // El panel necesita el listado de cuentas; auditoría no lo pinta, así que
  // tampoco lo pide: una petición menos es una ocasión menos de topar la cuota.
  const necesitaCuentas = section === "panel";

  const [almacenamiento, setAlmacenamiento] = useState(null);
  const [errorAlmacen, setErrorAlmacen] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [lento, setLento] = useState(false);
  const [purgando, setPurgando] = useState(false);
  const [purgaResultado, setPurgaResultado] = useState(null);

  const [usuarios, setUsuarios] = useState([]);
  const [errorCuentas, setErrorCuentas] = useState(null);
  const [cambiando, setCambiando] = useState(null);
  const [aviso, setAviso] = useState(null);

  const [modal, setModal] = useState(null);          // { fila }
  const [estadoModal, setEstadoModal] = useState("confirmar");
  const [errorModal, setErrorModal] = useState(null);

  const [estadoServicio] = useServiceStatus();

  // Ciclo de vida de cuentas. Solo un menú abierto a la vez: dos menús
  // flotantes simultáneos se solapan y no se sabe cuál manda.
  const [menuAbierto, setMenuAbierto] = useState(null);
  const [modalEditar, setModalEditar] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState(null);
  const [modalEliminar, setModalEliminar] = useState(null);
  const [borrando, setBorrando] = useState(false);
  const [errorBorrado, setErrorBorrado] = useState(null);

  // ── Carga de datos ─────────────────────────────────────────────────────────
  // Devuelve su propia función de cancelación: la usa tanto el desmontaje como
  // el botón de reintentar, para no dejar peticiones viejas escribiendo estado.
  const cargarDatos = useCallback(() => {
    let vivo = true;
    const ctrl = new AbortController();
    // Sin tiempo límite, una petición contra un servicio dormido se queda
    // colgada y la pantalla no llega a decir nunca qué ha pasado.
    const limite = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);
    const avisoLento = setTimeout(() => { if (vivo) setLento(true); }, TIEMPO_AVISO_MS);

    setCargando(true);
    setLento(false);
    setErrorCuentas(null);
    setErrorAlmacen(null);

    const tareas = [
      pedirJson("/admin/storage", ctrl.signal),
      necesitaCuentas ? pedirJson("/admin/users", ctrl.signal) : Promise.resolve(null),
    ];

    // `allSettled` y no `all`: si falla el listado de cuentas, las métricas de
    // almacenamiento que sí llegaron deben pintarse igualmente.
    Promise.allSettled(tareas).then(([resAlmacen, resCuentas]) => {
      if (!vivo) return;

      if (resAlmacen.status === "fulfilled") {
        setAlmacenamiento(resAlmacen.value);
      } else {
        setAlmacenamiento(null);
        setErrorAlmacen(describirFallo(resAlmacen.reason));
      }

      if (!necesitaCuentas) return;

      if (resCuentas.status === "fulfilled") {
        setUsuarios(Array.isArray(resCuentas.value) ? resCuentas.value : []);
      } else {
        setUsuarios([]);
        setErrorCuentas(describirFallo(resCuentas.reason));
      }
    }).finally(() => {
      clearTimeout(limite);
      clearTimeout(avisoLento);
      if (vivo) { setCargando(false); setLento(false); }
    });

    return () => {
      vivo = false;
      clearTimeout(limite);
      clearTimeout(avisoLento);
      ctrl.abort();
    };
  }, [necesitaCuentas]);

  const cancelarRef = useRef(null);

  const handleRecargar = useCallback(() => {
    if (cancelarRef.current) cancelarRef.current();
    cancelarRef.current = cargarDatos();
  }, [cargarDatos]);

  useEffect(() => {
    handleRecargar();
    return () => { if (cancelarRef.current) cancelarRef.current(); };
  }, [handleRecargar]);

  const aplicarRol = useCallback((id, rol) => {
    setUsuarios((previos) => previos.map((u) => (u.id === id ? { ...u, role: rol } : u)));
  }, []);

  // ── Cambio de rol ──────────────────────────────────────────────────────────
  const handleCambiarRol = useCallback(async (fila) => {
    if (!fila || fila.id === (user && user.id)) return;   // early return

    const previo = normalizeRole(fila.role);
    const destino = previo === ROLES.ADMIN ? ROLES.MEDICO : ROLES.ADMIN;

    setCambiando(fila.id);
    setAviso(null);
    aplicarRol(fila.id, destino);        // optimista: la tabla responde al instante

    try {
      const res = await authFetch("/admin/users/" + fila.id + "/role", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: destino }),
      });
      if (!res.ok) throw new Error("HTTP_" + res.status);

      const datos = await res.json();
      aplicarRol(fila.id, normalizeRole(datos.role));
      setAviso({
        ok: true,
        texto: (fila.email || "La cuenta") + " ahora es " + ROLE_LABEL[normalizeRole(datos.role)] + ".",
      });
    } catch {
      aplicarRol(fila.id, previo);       // el servidor manda: se revierte
      setAviso({
        ok: false,
        texto: "No se pudo cambiar el rol de " + (fila.email || "la cuenta") +
               ". No se modificó nada.",
      });
    } finally {
      setCambiando(null);
    }
  }, [aplicarRol, user]);

  // ── Restablecimiento de contraseña ─────────────────────────────────────────
  const handleAbrirReset = useCallback((fila) => {
    setMenuAbierto(null);
    setModal({ fila });
    setEstadoModal("confirmar");
    setErrorModal(null);
  }, []);

  const handleCerrarModal = useCallback(() => {
    setModal(null);
    setEstadoModal("confirmar");
    setErrorModal(null);
  }, []);

  const handleConfirmarReset = useCallback(async (nuevaClave) => {
    if (!modal) return;                                   // early return

    setEstadoModal("enviando");
    setErrorModal(null);
    try {
      // El servidor sigue sabiendo generar una clave aleatoria si no se le
      // manda ninguna; aquí siempre se le manda la que eligió el administrador.
      await enviarJson("/admin/users/" + modal.fila.id + "/reset-password",
                       "POST", { new_password: nuevaClave });
      setEstadoModal("listo");
    } catch (err) {
      setEstadoModal("confirmar");
      setErrorModal(err.detalle ||
        "No se pudo cambiar la contraseña. La cuenta conserva la que tenía.");
    }
  }, [modal]);

  // ── Ciclo de vida de cuentas ───────────────────────────────────────────────
  const handleAlternarMenu = useCallback((id) => {
    setMenuAbierto((previo) => (previo === id ? null : id));
  }, []);

  const handleCerrarMenu = useCallback(() => setMenuAbierto(null), []);

  const handleAbrirEdicion = useCallback((fila) => {
    setMenuAbierto(null);
    setErrorEdicion(null);
    setModalEditar(fila);
  }, []);

  const handleGuardarEdicion = useCallback(async (datos) => {
    if (!modalEditar) return;                              // early return

    setGuardandoEdicion(true);
    setErrorEdicion(null);
    try {
      const actualizado = await enviarJson("/admin/users/" + modalEditar.id, "PUT", datos);
      setUsuarios((previos) => previos.map((u) => (u.id === actualizado.id
        ? { ...u, name: actualizado.name, full_name: actualizado.full_name,
            email: actualizado.email }
        : u)));
      setModalEditar(null);
      setAviso({ ok: true, texto: "Datos de la cuenta actualizados." });
    } catch (err) {
      setErrorEdicion(err.detalle || describirFallo(err));
    } finally {
      setGuardandoEdicion(false);
    }
  }, [modalEditar]);

  const handleCambiarEstado = useCallback(async (fila) => {
    setMenuAbierto(null);
    setAviso(null);

    // Si figura inactiva se habilita, y al revés.
    const destino = fila.activo === false;
    try {
      const datos = await enviarJson(
        "/admin/users/" + fila.id + "/status", "PATCH", { is_active: destino });
      setUsuarios((previos) => previos.map((u) => (
        u.id === fila.id ? { ...u, activo: datos.activo } : u)));
      setAviso({
        ok: true,
        texto: (fila.email || "La cuenta") + (datos.activo
          ? " puede volver a iniciar sesión."
          : " queda deshabilitada. Su historial clínico se conserva."),
      });
    } catch (err) {
      setAviso({
        ok: false,
        texto: err.detalle || "No se pudo cambiar el estado de la cuenta.",
      });
    }
  }, []);

  const handleAbrirEliminar = useCallback((fila) => {
    setMenuAbierto(null);
    setErrorBorrado(null);
    setModalEliminar(fila);
  }, []);

  const handleConfirmarEliminar = useCallback(async () => {
    if (!modalEliminar) return;                            // early return

    setBorrando(true);
    setErrorBorrado(null);
    try {
      await enviarJson("/admin/users/" + modalEliminar.id, "DELETE");
      setUsuarios((previos) => previos.filter((u) => u.id !== modalEliminar.id));
      setAviso({
        ok: true,
        texto: modalEliminar.email + " y sus estudios se eliminaron permanentemente.",
      });
      setModalEliminar(null);
      handleRecargar();      // los KPIs de estudios y almacenamiento cambian
    } catch (err) {
      setErrorBorrado(err.detalle || "No se pudo eliminar la cuenta.");
    } finally {
      setBorrando(false);
    }
  }, [modalEliminar, handleRecargar]);

  const handlePurgar = useCallback(async () => {
    setPurgando(true);
    setPurgaResultado(null);
    try {
      const res = await authFetch("/admin/maintenance/purge", { method: "POST" });
      if (!res.ok) throw new Error("HTTP_" + res.status);
      const datos = await res.json().catch(() => ({}));
      setPurgaResultado({
        ok: true,
        mensaje: "Mantenimiento completado. Registros liberados: " + (datos.eliminados ?? 0) + ".",
      });
    } catch {
      setPurgaResultado({
        ok: false,
        mensaje: "La tarea de mantenimiento no pudo ejecutarse. No se modificó ningún dato.",
      });
    } finally {
      setPurgando(false);
    }
  }, []);

  const titulos = {
    panel:     ["Panel de administración", "Estado operativo del sistema y de las cuentas"],
    auditoria: ["Auditoría y cuotas", "Consumo de almacenamiento y mantenimiento de la base"],
  };
  const [titulo, subtitulo] = titulos[section] || titulos.panel;

  // Cada pantalla con un propósito: el panel gobierna cuentas, auditoría vigila
  // el almacenamiento. Nada se repite entre las dos.
  const esPanel = section === "panel";

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, titulo),
        h("div", { className: "page-sub" }, subtitulo),
      ),
      h("span", { className: "badge badge-info" },
        h(I.shield, { size: 11, "aria-hidden": true }), " Acceso administrador"),
    ),

    esPanel
      ? h(KpisGobernanza, {
          usuarios, almacenamiento, cargando, estadoServicio,
        })
      : h(AuditoriaAlmacenamiento, {
          datos: almacenamiento,
          cargando,
          error: errorAlmacen,
          onReintentar: handleRecargar,
          purgando,
          purgaResultado,
          onPurgar: handlePurgar,
        }),

    esPanel && h(GestionCuentas, {
      usuarios,
      cargando,
      lento,
      error: errorCuentas,
      idPropio: user && user.id,
      cambiando,
      aviso,
      limiteMb: almacenamiento && almacenamiento.limite_mb,
      menuAbierto,
      onAlternarMenu: handleAlternarMenu,
      onCerrarMenu: handleCerrarMenu,
      onCambiarRol: handleCambiarRol,
      onRestablecer: handleAbrirReset,
      onEditar: handleAbrirEdicion,
      onCambiarEstado: handleCambiarEstado,
      onEliminar: handleAbrirEliminar,
      onReintentar: handleRecargar,
    }),

    modalEditar && h(ModalEditar, {
      fila: modalEditar,
      guardando: guardandoEdicion,
      error: errorEdicion,
      onGuardar: handleGuardarEdicion,
      onCerrar: () => setModalEditar(null),
    }),

    modalEliminar && h(ModalEliminar, {
      fila: modalEliminar,
      borrando,
      error: errorBorrado,
      onConfirmar: handleConfirmarEliminar,
      onCerrar: () => setModalEliminar(null),
    }),

    modal && h(ModalRestablecer, {
      fila: modal.fila,
      estado: estadoModal,
      error: errorModal,
      onConfirmar: handleConfirmarReset,
      onCerrar: handleCerrarModal,
    }),
  );
}
