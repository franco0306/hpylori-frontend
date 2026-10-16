import { I } from "../icons.js";

const h = window.React.createElement;

// Manual de usuario: SOLO cómo usar el sistema, paso a paso y en lenguaje
// llano. La pantalla y el PDF descargable salen del mismo contenido (GUIA y
// PREGUNTAS), así nunca dicen cosas distintas.

const GUIA = [
  {
    id: "entrar", icono: "lock", titulo: "Entrar al sistema",
    pasos: [
      "Escriba su correo y su contraseña. El ojo del campo le deja ver lo que escribió.",
      "Si su cuenta es de administrador, escriba además el código de 6 dígitos de su app Google Authenticator.",
      "La primera vez, lea y acepte los términos de uso.",
    ],
  },
  {
    id: "analizar", icono: "upload", titulo: "Analizar una imagen",
    pasos: [
      "Vaya a «Análisis individual».",
      "En «ID Paciente» escriba el código de historia clínica. Si el paciente ya existe, el sistema se lo sugiere: elíjalo de la lista.",
      "Si el paciente no tiene historia clínica, elija «Generar código anónimo» y anote ese código en su ficha.",
      "Arrastre la imagen endoscópica (JPG o PNG) o pulse «selecciona un archivo». También puede usar una muestra de prueba.",
      "Pulse «Analizar imagen». En unos segundos verá el resultado.",
    ],
  },
  {
    id: "resultado", icono: "bact", titulo: "Revisar el resultado",
    pasos: [
      "Arriba verá el diagnóstico sugerido (positivo o negativo) y su probabilidad.",
      "Sobre la imagen, el botón «Original / Grad-CAM» muestra en qué zonas se fijó el sistema: rojo y amarillo, las que más pesaron; azul, las que menos.",
      "Con «Descargar Informe Clínico (PDF)» obtiene el informe para la historia del paciente.",
      "El estudio se guarda solo en su historial, con la imagen y el mapa.",
      "Para el siguiente paciente, pulse «Analizar otra imagen».",
    ],
  },
  {
    id: "lote", icono: "layers", titulo: "Analizar varias imágenes (lote)",
    pasos: [
      "Vaya a «Procesamiento por lote».",
      "Elija el paciente: todas las imágenes del lote se guardarán en su historial.",
      "Arrastre hasta 50 imágenes de la misma endoscopía.",
      "Pulse «Procesar». Si aparece «Pausa breve», espere: el lote continúa solo.",
      "Al terminar puede descargar el resumen con «Exportar Resumen Clínico (CSV)».",
    ],
  },
  {
    id: "historial", icono: "history", titulo: "Consultar el historial",
    pasos: [
      "Vaya a «Historial de estudios».",
      "Busque por código de paciente o filtre por resultado y fecha.",
      "Con «Por paciente» verá todos los estudios de cada paciente agrupados.",
      "Pulse un estudio para ver su imagen y su mapa Grad-CAM lado a lado.",
      "El icono de la papelera elimina un estudio y sus imágenes.",
    ],
  },
  {
    id: "confirmar", icono: "check", titulo: "Registrar el diagnóstico confirmado",
    pasos: [
      "Cuando tenga el resultado de la ureasa, la biopsia u otra prueba, abra el estudio en «Historial de estudios».",
      "En «Diagnóstico confirmado», elija el método y pulse «Resultó positivo» o «Resultó negativo».",
      "El estudio mostrará «Confirmado» si el sistema acertó o «No coincide» si no.",
      "Si se equivocó al registrarlo, use «Cambiar» o «Quitar».",
      "Si activó «Ayudar a mejorar el modelo» en Configuración, ese caso se usará para reentrenar el sistema.",
    ],
  },
  {
    id: "configuracion", icono: "cog", titulo: "Ajustar el sistema",
    pasos: [
      "En «Configuración» puede activar el modo oscuro, cómodo en salas con poca luz.",
      "También puede elegir los colores del mapa de calor, incluida una opción apta para daltonismo.",
      "En «Mis datos y privacidad» puede descargar sus datos o pedir que se corrijan o borren.",
    ],
  },
];

const PREGUNTAS = [
  {
    q: "Mi paciente no tiene historia clínica, ¿qué pongo?",
    a: "Pulse «Generar código anónimo» en el campo de paciente. El sistema crea un código (por ejemplo EP-7K3F2): anótelo en la ficha del paciente para encontrarlo después.",
  },
  {
    q: "¿Por qué no puedo escribir el nombre o el DNI del paciente?",
    a: "Por la Ley de Protección de Datos Personales, el sistema solo guarda el código de historia clínica. El nombre queda en el hospital, nunca en EndoScan.",
  },
  {
    q: "Escribí el código de otra forma, ¿se creó otro paciente?",
    a: "No. «hc 2026-104», «HC2026104» y «HC-2026-104» son el mismo paciente. Si escribe un código parecido a uno que ya tiene, el sistema le pregunta «¿Quiso decir…?».",
  },
  {
    q: "¿Para qué sirve registrar el diagnóstico confirmado?",
    a: "Para saber si el sistema acierta con sus pacientes reales y, si usted lo autoriza, para reentrenarlo con esos casos. El administrador revisa cada versión nueva antes de ponerla en uso.",
  },
  {
    q: "El primer análisis del día tarda mucho.",
    a: "Es normal: el servidor se activa tras un rato sin uso y puede tardar cerca de un minuto. Los siguientes análisis tardan pocos segundos.",
  },
  {
    q: "Olvidé mi contraseña.",
    a: "Pida al administrador del sistema que la restablezca desde el Panel Admin.",
  },
  {
    q: "Mi cuenta dice «bloqueada durante 15 minutos».",
    a: "Ocurre tras 5 intentos fallidos, para proteger su cuenta. Espere 15 minutos y vuelva a intentarlo con calma; use el ojo del campo para comprobar la contraseña.",
  },
  {
    q: "¿Dónde veo las imágenes de un análisis anterior?",
    a: "En «Historial de estudios»: pulse el estudio y verá la imagen y su mapa Grad-CAM.",
  },
];

function openPrintManual() {
  const secciones = GUIA.map((g, i) => `
    <h2>${i + 1}. ${g.titulo}</h2>
    <ol>${g.pasos.map((p) => `<li>${p}</li>`).join("")}</ol>`).join("");
  const preguntas = PREGUNTAS.map((f) => `<p><strong>${f.q}</strong><br>${f.a}</p>`).join("");

  const win = window.open("", "_blank");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Manual de usuario — EndoScan AI</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12.5px; color: #1a1a1a; max-width: 760px; margin: 0 auto; padding: 32px; line-height: 1.6; }
  h1 { font-size: 22px; margin-bottom: 4px; }
  .sub { color: #555; margin-top: 0; }
  h2 { font-size: 15px; color: #1e3a8a; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 26px; }
  ol { padding-left: 20px; } li { margin-bottom: 6px; }
  .footer { margin-top: 40px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>Manual de usuario — EndoScan AI</h1>
<p class="sub">Guía paso a paso para el médico</p>
${secciones}
<h2>${GUIA.length + 1}. Preguntas frecuentes</h2>
${preguntas}
<div class="footer">EndoScan AI · Manual de usuario</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export function HelpScreen() {
  return h("div", { className: "content manual" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Manual de usuario"),
        h("p", { className: "page-sub" }, "Cómo usar EndoScan AI, paso a paso"),
      ),
      h("button", { className: "btn btn-secondary", onClick: openPrintManual },
        h(I.dl, { size: 15 }), "Descargar PDF"),
    ),

    // Índice: salta a cada tarea.
    h("nav", { className: "manual-indice", "aria-label": "Contenido del manual" },
      GUIA.map((g) => h("a", { key: g.id, href: "#manual-" + g.id, className: "manual-chip",
                               onClick: (e) => { e.preventDefault();
                                 const el = document.getElementById("manual-" + g.id);
                                 if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } },
        h(I[g.icono], { size: 13 }), g.titulo)),
      h("a", { href: "#manual-preguntas", className: "manual-chip",
               onClick: (e) => { e.preventDefault();
                 const el = document.getElementById("manual-preguntas");
                 if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); } },
        h(I.info, { size: 13 }), "Preguntas frecuentes"),
    ),

    h("div", { className: "manual-grid" },
      GUIA.map((g, i) =>
        h("section", { key: g.id, id: "manual-" + g.id, className: "card card-pad manual-seccion" },
          h("div", { className: "manual-cabecera" },
            h("span", { className: "manual-icono" }, h(I[g.icono], { size: 18 })),
            h("div", null,
              h("div", { className: "manual-num" }, "Paso " + (i + 1)),
              h("h2", { className: "manual-titulo" }, g.titulo)),
          ),
          h("ol", { className: "manual-pasos" },
            g.pasos.map((p, k) => h("li", { key: k }, p))),
        )),
    ),

    h("section", { id: "manual-preguntas", className: "card card-pad", style: { marginTop: 20 } },
      h("div", { className: "manual-cabecera" },
        h("span", { className: "manual-icono" }, h(I.info, { size: 18 })),
        h("h2", { className: "manual-titulo" }, "Preguntas frecuentes")),
      h("div", { className: "manual-preguntas" },
        PREGUNTAS.map((f) =>
          h("details", { key: f.q, className: "manual-pregunta" },
            h("summary", null, f.q),
            h("p", null, f.a)))),
    ),
  );
}
