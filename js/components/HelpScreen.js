import { I } from "../icons.js";

const h = window.React.createElement;

const MODELS = [
  { name: "ResNet50 (recomendado)", recall: "84.95 %", spec: "89.82 %", f1: "83.76 %", auc: "0.9524", threshold: "0.255" },
  { name: "MobileNetV3",            recall: "83.82 %", spec: "87.25 %", f1: "81.83 %", auc: "0.9363", threshold: "0.350" },
  { name: "EfficientNet-B0",        recall: "81.67 %", spec: "89.12 %", f1: "81.53 %", auc: "0.9287", threshold: "0.400" },
  { name: "VGG16",                  recall: "63.88 %", spec: "—",       f1: "69.96 %", auc: "0.8460", threshold: "0.500" },
];

const FAQS = [
  {
    q: "¿Puedo usar EndoScan AI para diagnosticar pacientes?",
    a: "No. Es una herramienta de apoyo educativo e investigativo. Todo resultado debe ser interpretado por un médico habilitado.",
  },
  {
    q: "¿Qué imágenes acepta el sistema?",
    a: "Imágenes endoscópicas del tracto gastrointestinal superior en JPEG o PNG, máximo 10 MB. No está validado para radiografías ni otras modalidades.",
  },
  {
    q: "¿El sistema guarda mis imágenes?",
    a: "Solo guarda una miniatura (96×72 px) en el historial de tu cuenta. La imagen original en alta resolución no se almacena.",
  },
  {
    q: "¿Qué hago si el resultado no coincide con mi impresión clínica?",
    a: "Priorice su criterio profesional. Confirme con métodos diagnósticos estándar: prueba de aliento, antígeno fecal o biopsia.",
  },
  {
    q: "¿Cuándo usar un umbral bajo vs. alto?",
    a: "Umbral bajo (ej. 0.25): más sensibilidad, útil para screening. Umbral alto (ej. 0.70): más especificidad, útil cuando se busca alta certeza diagnóstica.",
  },
];

function Section({ title, children }) {
  return h("div", { style: { marginBottom: 28 } },
    h("h2", { style: { fontSize: 15, fontWeight: 700, color: "var(--ink-800)", marginBottom: 12, paddingBottom: 6, borderBottom: "1px solid var(--ink-100)" } }, title),
    children,
  );
}

function openPrintManual() {
  const win = window.open("", "_blank");
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8">
<title>Manual de Usuario — EndoScan AI</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 32px; line-height: 1.6; }
  h1 { font-size: 22px; color: #1a1a1a; } h2 { font-size: 15px; color: #333; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin-top: 28px; }
  h3 { font-size: 13px; color: #444; margin-top: 16px; }
  .disclaimer { background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; padding: 14px 16px; margin: 16px 0; font-size: 11px; }
  .disclaimer strong { display: block; font-size: 13px; margin-bottom: 6px; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 11px; }
  th { background: #f5f5f5; padding: 6px 10px; text-align: left; border: 1px solid #ddd; font-weight: 600; }
  td { padding: 6px 10px; border: 1px solid #ddd; }
  tr:nth-child(even) td { background: #fafafa; }
  ol, ul { padding-left: 20px; } li { margin-bottom: 4px; }
  .footer { margin-top: 40px; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 12px; }
  @media print { body { padding: 16px; } }
</style></head><body>
<h1>Manual de Usuario — EndoScan AI</h1>
<p><em>Sistema de Apoyo Diagnóstico para Detección de Helicobacter pylori · Versión 1.0 · Junio 2026</em></p>

<div class="disclaimer">
  <strong>⚠ ADVERTENCIA CLÍNICA — LEER ANTES DE USAR</strong>
  EndoScan AI es una herramienta de <strong>apoyo diagnóstico</strong>. No reemplaza el juicio clínico profesional ni constituye un diagnóstico médico definitivo.<br><br>
  Un resultado "H. pylori Negativo" no descarta la infección. Un resultado "H. pylori Positivo" debe confirmarse mediante métodos diagnósticos estándar (prueba de aliento con urea, antígeno fecal, histología).<br><br>
  El sistema no ha sido aprobado por ningún organismo regulatorio (ANMAT, FDA, CE) para uso diagnóstico autónomo. Su uso es exclusivamente educativo e investigativo.
</div>

<h2>1. Introducción</h2>
<p>EndoScan AI analiza imágenes endoscópicas del tracto gastrointestinal superior para estimar la probabilidad de infección por <em>H. pylori</em> mediante redes neuronales convolucionales (CNN). Genera además mapas de calor <strong>Grad-CAM</strong> que señalan las regiones de la imagen relevantes para la predicción.</p>
<p><strong>URL:</strong> https://franco0306.github.io/hpylori-frontend/ &nbsp;|&nbsp; <strong>Requisitos:</strong> Chrome/Firefox/Edge 90+, conexión a internet, resolución mínima 1280×720 px.</p>

<h2>2. Modelos disponibles</h2>
<table>
  <tr><th>Modelo</th><th>Sensibilidad</th><th>Especificidad</th><th>F1</th><th>AUC-ROC</th><th>Umbral</th></tr>
  <tr><td><strong>ResNet50 (recomendado)</strong></td><td>84.95 %</td><td>89.82 %</td><td>83.76 %</td><td>0.9524</td><td>0.255</td></tr>
  <tr><td>MobileNetV3</td><td>83.82 %</td><td>87.25 %</td><td>81.83 %</td><td>0.9363</td><td>0.350</td></tr>
  <tr><td>EfficientNet-B0</td><td>81.67 %</td><td>89.12 %</td><td>81.53 %</td><td>0.9287</td><td>0.400</td></tr>
  <tr><td>VGG16</td><td>63.88 %</td><td>—</td><td>69.96 %</td><td>0.8460</td><td>0.500</td></tr>
</table>
<p><em>Nota: sensibilidad del 84.95 % implica que ~1 de cada 7 pacientes con H. pylori podría no ser detectado.</em></p>

<h2>3. Registro e inicio de sesión</h2>
<p>Al ingresar se muestra la pantalla de login. Para crear una cuenta: clic en "Regístrate", completar email, contraseña (mín. 6 caracteres) y confirmar. La sesión se mantiene activa 7 días. Las contraseñas se almacenan con hash bcrypt; nunca en texto plano.</p>

<h2>4. Panel principal (Dashboard)</h2>
<p>Muestra: total de estudios realizados, porcentaje de positivos/negativos, modelo activo y accesos directos a las funciones principales.</p>

<h2>5. Análisis individual</h2>
<ol>
  <li>Ir a <strong>Diagnóstico → Análisis individual</strong></li>
  <li>Cargar la imagen (arrastrar o clic · JPEG/PNG · máx. 10 MB)</li>
  <li>Ingresar nombre/ID del paciente (opcional)</li>
  <li>Seleccionar modelo de IA (por defecto: ResNet50)</li>
  <li>Clic en <strong>"Analizar imagen"</strong></li>
</ol>
<p>El sistema devuelve: diagnóstico, probabilidad (0–100 %), umbral, modelo utilizado y latencia en ms. Una probabilidad cercana al 50 % indica alta incertidumbre.</p>

<h2>6. Visualización Grad-CAM</h2>
<p>Luego del análisis, clic en <strong>"Ver Grad-CAM"</strong>. El mapa de calor muestra las regiones que influyeron en la predicción:</p>
<ul>
  <li>🔴 Rojo/naranja: alta relevancia para el modelo</li>
  <li>🟡 Amarillo: relevancia moderada</li>
  <li>🔵 Azul/frío: baja relevancia</li>
</ul>
<p><em>Advertencia: el mapa indica relevancia para el modelo, no necesariamente relevancia clínica real. No usar como evidencia diagnóstica independiente.</em></p>

<h2>7. Descarga de informe PDF del estudio</h2>
<p>Luego del análisis individual, clic en <strong>"Descargar informe PDF"</strong>. El navegador abre el diálogo de impresión; seleccionar "Guardar como PDF". El informe incluye: imagen original, Grad-CAM con leyenda, resultado, probabilidad, métricas del modelo y datos del paciente.</p>

<h2>8. Procesamiento por lote</h2>
<p>Ir a <strong>Diagnóstico → Procesamiento por lote</strong>, cargar múltiples imágenes y clic en "Analizar todas". Los resultados se muestran en tabla. Límite recomendado: 20 imágenes por lote.</p>

<h2>9. Historial de estudios</h2>
<p>Almacena todos los análisis en la nube, accesibles desde cualquier dispositivo. Permite: filtrar por resultado o paciente, ver detalle/Grad-CAM de estudios anteriores, eliminar estudios individuales o limpiar el historial completo. La vista "Por paciente" muestra resumen por paciente con tasa de positividad.</p>

<h2>10. Comparativa de modelos</h2>
<p>Ir a <strong>IA → Comparativa de modelos</strong>, cargar una imagen y clic en "Comparar todos". Útil para casos ambiguos: la concordancia entre múltiples modelos puede indicar mayor confiabilidad.</p>

<h2>11. Configuración</h2>
<table>
  <tr><th>Parámetro</th><th>Descripción</th><th>Por defecto</th></tr>
  <tr><td>Modelo por defecto</td><td>Arquitectura CNN a usar en cada análisis</td><td>ResNet50</td></tr>
  <tr><td>Umbral de decisión</td><td>Probabilidad mínima para clasificar como Positivo</td><td>0.5 (50 %)</td></tr>
</table>
<p>Los cambios se guardan en la cuenta del usuario y persisten entre sesiones.</p>

<h2>12. Preguntas frecuentes</h2>
<p><strong>¿Puedo usar EndoScan AI para diagnosticar pacientes?</strong><br>No. Es una herramienta educativa e investigativa. Todo resultado debe ser interpretado por un médico habilitado.</p>
<p><strong>¿Qué hago si el resultado no coincide con mi impresión clínica?</strong><br>Priorice su criterio profesional y confirme con métodos estándar (prueba de aliento, antígeno fecal, biopsia).</p>
<p><strong>¿Cuándo usar umbral bajo vs. alto?</strong><br>Umbral bajo (ej. 0.25): más sensibilidad, útil para screening. Umbral alto (ej. 0.70): más especificidad, útil cuando se busca alta certeza diagnóstica.</p>
<p><strong>¿Mis datos están seguros?</strong><br>Contraseñas almacenadas con hash bcrypt. Comunicaciones por HTTPS. Historial solo accesible con las credenciales de la cuenta.</p>

<div class="disclaimer" style="margin-top:32px;">
  <strong>Disclaimer legal</strong>
  EndoScan AI es un prototipo académico desarrollado en el marco del Taller Integrador de Ingeniería. No cuenta con aprobación regulatoria para uso clínico. El uso de esta herramienta es de exclusiva responsabilidad del usuario. Los desarrolladores no asumen responsabilidad por decisiones clínicas basadas en los resultados del sistema.
</div>

<div class="footer">EndoScan AI v1.0 · Junio 2026 · francoalessandro0306@gmail.com</div>
</body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

export function HelpScreen() {
  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Manual de usuario"),
        h("p", { className: "page-sub" }, "DO-002 · Guía para gastroenterólogos · EndoScan AI v1.0"),
      ),
      h("button", {
        className: "btn btn-primary",
        onClick: openPrintManual,
        style: { display: "flex", alignItems: "center", gap: 6 },
      },
        h(I.dl, { size: 15 }),
        "Descargar PDF",
      ),
    ),

    h("div", { className: "alert", style: { background: "var(--yellow-50,#fffbeb)", border: "1px solid var(--yellow-300,#fcd34d)", borderRadius: 8, padding: "14px 16px", marginBottom: 24, display: "flex", gap: 12, alignItems: "flex-start" } },
      h(I.alert, { size: 18, style: { color: "#d97706", flexShrink: 0, marginTop: 2 } }),
      h("div", null,
        h("div", { style: { fontWeight: 700, marginBottom: 4, color: "#92400e" } }, "ADVERTENCIA CLÍNICA — LEER ANTES DE USAR"),
        h("div", { style: { fontSize: 13, color: "#78350f", lineHeight: 1.6 } },
          "EndoScan AI es una herramienta de ",
          h("strong", null, "apoyo diagnóstico"),
          ". No reemplaza el juicio clínico profesional ni constituye un diagnóstico médico definitivo. Un resultado negativo no descarta la infección; un resultado positivo debe confirmarse con métodos estándar (prueba de aliento, antígeno fecal, histología). El sistema no tiene aprobación regulatoria (ANMAT, FDA, CE) para uso diagnóstico autónomo.",
        ),
      ),
    ),

    h("div", { style: { display: "grid", gap: 20 } },

      h("div", { className: "card card-pad" },
        h(Section, { title: "Modelos disponibles" },
          h("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
            h("thead", null,
              h("tr", null,
                ["Modelo", "Sensibilidad", "Especificidad", "F1", "AUC-ROC", "Umbral"].map((t) =>
                  h("th", { key: t, style: { textAlign: "left", padding: "6px 10px", background: "var(--ink-50)", borderBottom: "2px solid var(--ink-100)", fontSize: 12, fontWeight: 600, color: "var(--ink-600)" } }, t),
                ),
              ),
            ),
            h("tbody", null,
              MODELS.map((m, i) =>
                h("tr", { key: m.name, style: { background: i % 2 === 0 ? "transparent" : "var(--ink-50)" } },
                  h("td", { style: { padding: "6px 10px", fontWeight: i === 0 ? 600 : 400, color: i === 0 ? "var(--primary)" : undefined } }, m.name),
                  h("td", { style: { padding: "6px 10px" } }, m.recall),
                  h("td", { style: { padding: "6px 10px" } }, m.spec),
                  h("td", { style: { padding: "6px 10px" } }, m.f1),
                  h("td", { style: { padding: "6px 10px" } }, m.auc),
                  h("td", { style: { padding: "6px 10px" } }, m.threshold),
                ),
              ),
            ),
          ),
          h("p", { className: "muted", style: { marginTop: 8, fontSize: 12 } },
            "Sensibilidad del 84.95 % implica que ~1 de cada 7 pacientes con H. pylori podría no ser detectado."),
        ),
      ),

      h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 } },

        h("div", { className: "card card-pad" },
          h(Section, { title: "Análisis individual" },
            h("ol", { style: { paddingLeft: 18, margin: 0, fontSize: 13, lineHeight: 2 } },
              ["Ir a Diagnóstico → Análisis individual",
               "Cargar imagen (JPEG/PNG, máx. 10 MB)",
               "Ingresar nombre/ID del paciente (opcional)",
               "Seleccionar modelo de IA",
               'Clic en "Analizar imagen"',
               "Ver resultado, probabilidad y Grad-CAM",
              ].map((s, i) => h("li", { key: i }, s)),
            ),
          ),
        ),

        h("div", { className: "card card-pad" },
          h(Section, { title: "Interpretación del resultado" },
            h("div", { style: { fontSize: 13, lineHeight: 1.8 } },
              h("p", { style: { margin: "0 0 8px" } },
                h("strong", null, "Diagnóstico:"), " "H. pylori Positivo" o "H. pylori Negativo""),
              h("p", { style: { margin: "0 0 8px" } },
                h("strong", null, "Probabilidad:"), " 0–100 % de que la imagen sea positiva"),
              h("p", { style: { margin: "0 0 8px" } },
                h("strong", null, "Umbral:"), " valor de corte configurable en Configuración"),
              h("p", { style: { margin: 0, color: "var(--ink-500)", fontSize: 12 } },
                "Probabilidad cercana al 50 % = alta incertidumbre del modelo. Confirmar clínicamente."),
            ),
          ),
        ),

        h("div", { className: "card card-pad" },
          h(Section, { title: "Grad-CAM — mapa de calor" },
            h("div", { style: { fontSize: 13, lineHeight: 1.8 } },
              [
                { color: "#ef4444", label: "Rojo/naranja", desc: "Alta relevancia para el modelo" },
                { color: "#eab308", label: "Amarillo",     desc: "Relevancia moderada" },
                { color: "#3b82f6", label: "Azul/frío",   desc: "Baja relevancia" },
              ].map((c) =>
                h("div", { key: c.label, style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 6 } },
                  h("span", { style: { width: 12, height: 12, borderRadius: "50%", background: c.color, flexShrink: 0 } }),
                  h("span", null, h("strong", null, c.label), " — ", c.desc),
                ),
              ),
              h("p", { style: { margin: "10px 0 0", color: "var(--ink-500)", fontSize: 12 } },
                "El mapa indica relevancia para el modelo, no necesariamente zona de interés clínico real."),
            ),
          ),
        ),

        h("div", { className: "card card-pad" },
          h(Section, { title: "Umbral de decisión" },
            h("div", { style: { fontSize: 13, lineHeight: 1.8 } },
              h("p", { style: { margin: "0 0 8px" } },
                h("strong", null, "Umbral bajo (ej. 0.25):"), " mayor sensibilidad. Detecta más positivos pero aumenta falsos positivos. Ideal para ", h("em", null, "screening.")),
              h("p", { style: { margin: "0 0 8px" } },
                h("strong", null, "Umbral alto (ej. 0.70):"), " mayor especificidad. Menos falsos positivos. Ideal cuando se busca ", h("em", null, "alta certeza.")),
              h("p", { style: { margin: 0, color: "var(--ink-500)", fontSize: 12 } },
                "Umbral óptimo validado para ResNet50: 0.255. Configurable en Configuración del sistema."),
            ),
          ),
        ),
      ),

      h("div", { className: "card card-pad" },
        h(Section, { title: "Preguntas frecuentes" },
          h("div", { style: { display: "grid", gap: 16 } },
            FAQS.map((f) =>
              h("div", { key: f.q },
                h("div", { style: { fontWeight: 600, fontSize: 13, marginBottom: 4 } }, f.q),
                h("div", { style: { fontSize: 13, color: "var(--ink-600)", lineHeight: 1.6 } }, f.a),
              ),
            ),
          ),
        ),
      ),

      h("div", { className: "card card-pad", style: { background: "var(--ink-50)", border: "1px solid var(--ink-100)" } },
        h("div", { style: { fontSize: 12, color: "var(--ink-500)", lineHeight: 1.7 } },
          h("strong", { style: { display: "block", marginBottom: 4, color: "var(--ink-700)" } }, "Disclaimer legal"),
          "EndoScan AI es un prototipo académico desarrollado en el marco del Taller Integrador de Ingeniería. ",
          "No cuenta con aprobación regulatoria para uso clínico. El uso de esta herramienta es de exclusiva responsabilidad del usuario. ",
          "Los desarrolladores no asumen responsabilidad por decisiones clínicas basadas en los resultados del sistema. ",
          h("br", null),
          "Contacto técnico: francoalessandro0306@gmail.com",
        ),
      ),
    ),
  );
}
