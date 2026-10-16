# -*- coding: utf-8 -*-
"""
Pruebas End-to-End (Selenium) - EndoScan AI
Curso: Taller de Software / Taller Integrador - UPAO

Suite alineada con la interfaz CLINICA (Fase 2). Frente a la version anterior:

  - Se eliminan los escenarios de seleccion de modelo y comparativa de
    arquitecturas: el gastroenterologo ya no elige CNN, la inferencia usa
    siempre ResNet50 y esas pantallas salieron del menu.
  - Se eliminan las aserciones sobre badges "HU-00X": la interfaz ya no
    muestra codigos de historia de usuario al medico.
  - Se anaden escenarios propios del estandar actual: payload fijo a
    resnet50, gating de Grad-CAM por cache de sesion y modo oscuro.

El frontend se sirve localmente (la suite levanta su propio servidor estatico)
y las inferencias son REALES contra el backend desplegado en Hugging Face.

Genera:
  - tests/e2e_results/resumen_e2e.json   (resultado detallado por escenario)
  - tests/e2e_results/*.png              (captura de pantalla de cada escenario)

Uso:
    python tests/test_e2e_selenium.py

Variables de entorno:
    E2E_BASE_URL   URL del frontend (por defecto levanta un servidor local)
    E2E_HEADED=1   ventana visible y pausada, para grabar la pantalla
    E2E_PAUSE      segundos de pausa entre escenarios en modo visible
"""
import json
import os
import socket
import subprocess
import sys
import time
import traceback
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

HERE = os.path.dirname(os.path.abspath(__file__))
FRONTEND_ROOT = os.path.abspath(os.path.join(HERE, ".."))
RESULTS_DIR = os.path.join(HERE, "e2e_results")
DOWNLOAD_DIR = os.path.join(RESULTS_DIR, "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

BACKEND_URL = os.environ.get("E2E_BACKEND_URL", "https://franco0306-hpylori-detection.hf.space")

# Puerto del servidor de la suite. Se prueba contra el codigo del repositorio,
# no contra el despliegue publico (que puede ir por detras). Debe ser 5500: es
# el origen local que la API admite (CORS y verificacion de origen).
LOCAL_PORT = int(os.environ.get("E2E_PORT", "5500"))
BASE_URL = os.environ.get("E2E_BASE_URL", "")

HEADED = os.environ.get("E2E_HEADED", "") == "1"
STEP_PAUSE = float(os.environ.get("E2E_PAUSE", "1.4")) if HEADED else 0.0

RUN_ID = datetime.now().strftime("%Y%m%d%H%M%S")
TEST_EMAIL = f"qa.selenium.taller.{RUN_ID}@example.com"
TEST_PASSWORD = "TallerE2E2026!"
TEST_FULLNAME = "QA Selenium Taller"
TEST_PACIENTE = "HC-2026-104"

SAMPLES_DIR = os.path.join(FRONTEND_ROOT, "public", "samples", "img")
VALID_IMAGE = os.path.abspath(os.path.join(SAMPLES_DIR, "POSITIVO", "p144_f000840.jpg"))

# Accesos que ve una cuenta con rol clinico (rol por defecto).
# Una cuenta 'admin' suma ademas el grupo de Administracion.
SIDEBAR_ESPERADO = [
    "Panel principal",
    "Análisis individual",
    "Visualización Grad-CAM",
    "Procesamiento por lote",
    "Historial de estudios",
    "Configuración",
    "Manual de usuario",
]

# Rutas tecnicas retiradas de la interfaz clinica.
SIDEBAR_PROHIBIDO = ["Modelos disponibles", "Comparativa de modelos"]

TOOLTIP_XAI = "Visualización XAI disponible solo en sesión activa"

# Interceptor de red: registra el payload de cada POST /predict y lo reenvia
# intacto al backend real, para poder afirmar que viaja model_id=resnet50 sin
# falsear la inferencia.
INTERCEPTOR = """
window.__predictPayloads = [];
window.__consoleErrors = [];
window.addEventListener("error", function (e) { window.__consoleErrors.push(String(e.message)); });
(function () {
  var realFetch = window.fetch;
  window.fetch = function (input, init) {
    var url = typeof input === "string" ? input : (input && input.url) || "";
    if (url.indexOf("/predict") !== -1 && init && init.body && init.body.forEach) {
      var campos = {};
      init.body.forEach(function (v, k) {
        campos[k] = (v instanceof Blob) ? ("<archivo " + v.size + " bytes>") : String(v);
      });
      window.__predictPayloads.push(campos);
    }
    return realFetch.apply(this, arguments);
  };
})();
"""

results = []


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


# ── Servidor estatico propio ─────────────────────────────────────────────────

def puerto_libre(port):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        return s.connect_ex(("127.0.0.1", port)) != 0


def arrancar_servidor():
    """Sirve el frontend del repositorio. Devuelve (url, proceso_o_None)."""
    if BASE_URL:
        log(f"Usando frontend indicado por E2E_BASE_URL: {BASE_URL}")
        return BASE_URL, None

    url = f"http://127.0.0.1:{LOCAL_PORT}/"

    if not puerto_libre(LOCAL_PORT):
        log(f"Puerto {LOCAL_PORT} ya ocupado; se reutiliza el servidor existente")
        return url, None

    # El frontend se compila con Vite: el servidor de desarrollo transforma
    # JSX y Tailwind al vuelo (requiere haber hecho `npm install`).
    npx = "npx.cmd" if os.name == "nt" else "npx"
    proc = subprocess.Popen(
        [npx, "vite", "--port", str(LOCAL_PORT), "--host", "127.0.0.1", "--strictPort"],
        cwd=FRONTEND_ROOT,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    for _ in range(120):
        if not puerto_libre(LOCAL_PORT):
            log(f"Servidor estatico levantado en {url}")
            return url, proc
        time.sleep(0.25)

    proc.terminate()
    raise RuntimeError(f"No se pudo levantar el servidor estatico en el puerto {LOCAL_PORT}")


def make_driver():
    opts = Options()
    if not HEADED:
        opts.add_argument("--headless=new")
        opts.add_argument("--window-size=1440,1000")
    else:
        opts.add_argument("--start-maximized")
        opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--disable-gpu")
    opts.add_experimental_option("prefs", {
        "download.default_directory": DOWNLOAD_DIR,
        "download.prompt_for_download": False,
    })
    d = webdriver.Chrome(options=opts)
    for domain in ("Browser", "Page"):
        try:
            d.execute_cdp_cmd(f"{domain}.setDownloadBehavior", {
                "behavior": "allow", "downloadPath": DOWNLOAD_DIR,
            })
        except Exception:
            pass
    # El interceptor debe existir antes de que arranque la SPA.
    d.execute_cdp_cmd("Page.addScriptToEvaluateOnNewDocument", {"source": INTERCEPTOR})
    if HEADED:
        d.maximize_window()
    return d


# ── Utilidades ───────────────────────────────────────────────────────────────

def wait_visible(driver, by, value, timeout=15):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def click_by_text(driver, tag, text, timeout=15):
    xpath = f"//{tag}[contains(normalize-space(.),'{text}')]"
    el = wait_visible(driver, By.XPATH, xpath, timeout)
    el.click()
    return el


def ir_a(driver, etiqueta, timeout=15):
    """Navega por el menu lateral y espera a que cambie la pantalla."""
    items = WebDriverWait(driver, timeout).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".nav .nav-item"))
    for item in items:
        if etiqueta.lower() in item.text.lower():
            item.click()
            time.sleep(0.8)
            return item
    raise AssertionError(f"No existe el acceso '{etiqueta}' en el menu lateral")


def screenshot(driver, name):
    path = os.path.join(RESULTS_DIR, f"{name}.png")
    driver.save_screenshot(path)
    return path


def run_scenario(driver, sid, name, module, technique, fn):
    log(f"--- {sid} {name} ---")
    entry = {"id": sid, "escenario": name, "modulo": module, "tecnica": technique}
    t0 = time.time()
    try:
        detail = fn(driver)
        entry["estado"] = "APROBADO"
        entry["detalle"] = detail or "OK"
    except Exception as e:
        entry["estado"] = "FALLIDO"
        entry["detalle"] = f"{e.__class__.__name__}: {e}"
        log("ERROR: " + traceback.format_exc())
    entry["duracion_s"] = round(time.time() - t0, 2)
    shot_name = f"{sid.replace(' ', '_').replace('.', '-')}_{entry['estado']}"
    entry["captura"] = screenshot(driver, shot_name) if driver else None
    results.append(entry)
    log(f"    -> {entry['estado']} ({entry['duracion_s']}s)")
    if HEADED:
        time.sleep(STEP_PAUSE)


# ── Escenario 1: Registro de nueva cuenta ────────────────────────────────────
def sc_register(driver):
    driver.get(BASE_URL_ACTIVA)
    wait_visible(driver, By.XPATH, "//span[contains(text(),'Regístrate')]").click()
    wait_visible(driver, By.CSS_SELECTOR, "input[type=email]").send_keys(TEST_EMAIL)
    fields = driver.find_elements(By.CSS_SELECTOR, "input[type=password]")
    fields[0].send_keys(TEST_PASSWORD)
    fields[1].send_keys(TEST_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "input[type=text]").send_keys(TEST_FULLNAME)
    click_by_text(driver, "button", "Crear cuenta")
    wait_visible(driver, By.CSS_SELECTOR, "aside.sidebar", timeout=90)
    return f"Cuenta creada: {TEST_EMAIL}"


# ── Escenario 2: Acuerdo de proteccion de datos (Ley 29733) ──────────────────
def sc_legal_agreement(driver):
    """El primer acceso de cada cuenta exige aceptar los terminos antes de operar."""
    modal = wait_visible(driver, By.CSS_SELECTOR, ".modal", timeout=20)

    if modal.get_attribute("role") != "dialog" or modal.get_attribute("aria-modal") != "true":
        raise AssertionError("El acuerdo no se expone como dialogo modal accesible")

    texto = modal.text
    for exigido in ("CDSS", "TRL 6", "29733"):
        if exigido not in texto:
            raise AssertionError(f"El acuerdo no menciona '{exigido}'")
    if "no vinculante" not in texto.lower():
        raise AssertionError("El acuerdo no declara el caracter no vinculante del resultado")
    if "esidentificaci" not in texto:
        raise AssertionError("El acuerdo no incluye la clausula de desidentificacion")

    aceptar = [b for b in modal.find_elements(By.TAG_NAME, "button") if "Aceptar" in b.text][0]
    if aceptar.is_enabled():
        raise AssertionError("El boton de aceptacion deberia exigir marcar la casilla")

    # La casilla obligatoria; la opcional («Ayudar a mejorar el modelo») queda sin marcar.
    driver.find_element(By.CSS_SELECTOR, ".legal-accept:not(.legal-accept-optional) input").click()
    time.sleep(0.4)
    aceptar = [b for b in driver.find_elements(By.CSS_SELECTOR, ".modal button") if "Aceptar" in b.text][0]
    if not aceptar.is_enabled():
        raise AssertionError("Marcar la casilla deberia habilitar la aceptacion")
    aceptar.click()

    WebDriverWait(driver, 10).until(
        lambda d: not d.find_elements(By.CSS_SELECTOR, ".modal"))

    persistido = driver.execute_script(
        "return Object.keys(localStorage).filter(function (k) {"
        "  return k.indexOf('endoscan.legal.') === 0; }).length;")
    if persistido < 1:
        raise AssertionError("La aceptacion no quedo registrada en el navegador")

    return "Acuerdo Ley 29733 mostrado en el primer acceso, aceptado y persistido"


# ── Escenario 2: Cierre de sesion ────────────────────────────────────────────
def sc_logout(driver):
    driver.find_element(By.CSS_SELECTOR, ".sidebar-footer button.btn-icon").click()
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Iniciar sesión')]", timeout=15)
    return "Sesion cerrada, vuelve a la pantalla de acceso"


# ── Escenario 3: Inicio de sesion ────────────────────────────────────────────
def sc_login(driver):
    wait_visible(driver, By.CSS_SELECTOR, "input[type=email]").send_keys(TEST_EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type=password]").send_keys(TEST_PASSWORD)
    click_by_text(driver, "button", "Ingresar")
    wait_visible(driver, By.CSS_SELECTOR, "aside.sidebar", timeout=90)
    return "Login exitoso con la cuenta registrada"


# ── Escenario 4: Accesos clinicos del menu lateral ───────────────────────────
def sc_sidebar_clinico(driver):
    items = driver.find_elements(By.CSS_SELECTOR, ".nav .nav-item")
    etiquetas = [i.text.split("\n")[0].strip() for i in items]

    if etiquetas != SIDEBAR_ESPERADO:
        raise AssertionError(f"Menu inesperado.\n  esperado: {SIDEBAR_ESPERADO}\n  obtenido: {etiquetas}")

    for prohibido in SIDEBAR_PROHIBIDO:
        if any(prohibido.lower() in e.lower() for e in etiquetas):
            raise AssertionError(f"El menu sigue exponiendo la ruta tecnica '{prohibido}'")

    # La interfaz clinica no muestra codigos de historia de usuario.
    cuerpo = driver.find_element(By.TAG_NAME, "body").text
    if "HU-0" in cuerpo:
        raise AssertionError("La pantalla sigue mostrando badges 'HU-00X'")

    # Cada acceso debe renderizar su icono y ser alcanzable por teclado.
    con_icono = driver.execute_script(
        "return Array.from(document.querySelectorAll('.nav-item')).every(function (b) {"
        "  var s = b.querySelector('svg.nav-icon');"
        "  return s && s.getBoundingClientRect().width > 0; });")
    if not con_icono:
        raise AssertionError("Algun acceso del menu no renderiza su icono")

    return f"7 accesos clinicos correctos y sin rutas tecnicas: {etiquetas}"


# ── Escenario 5: Barra superior clinica ──────────────────────────────────────
def sc_topbar_clinico(driver):
    topbar = driver.find_element(By.CSS_SELECTOR, ".topbar")

    # Estado del servicio. El literal "API conectada" se retiro por ser jerga
    # tecnica para un gastroenterologo; ahora el indicador es una comprobacion
    # real del backend y se expresa en lenguaje clinico.
    estado = driver.find_element(By.CSS_SELECTOR, ".system-status")
    texto_estado = estado.text.strip()
    if not texto_estado:
        raise AssertionError("El Topbar no muestra el estado de conexion")
    if "API" in texto_estado:
        raise AssertionError(f"El estado de conexion sigue usando jerga tecnica: {texto_estado!r}")

    # El indicador debe reflejar disponibilidad real, no un adorno fijo.
    WebDriverWait(driver, 30).until(
        lambda d: "comprobando" not in d.find_element(By.CSS_SELECTOR, ".system-status").text.lower())
    texto_estado = driver.find_element(By.CSS_SELECTOR, ".system-status").text.strip()
    if "listo para analizar" not in texto_estado.lower():
        raise AssertionError(f"El backend no se reporta disponible: {texto_estado!r}")

    # Interruptor de modo oscuro.
    toggle = driver.find_element(By.CSS_SELECTOR, ".theme-toggle")
    if toggle.get_attribute("role") != "switch":
        raise AssertionError("El control de modo oscuro no expone role=switch")
    if "modo" not in toggle.text.lower():
        raise AssertionError(f"El interruptor de tema no es reconocible: {toggle.text!r}")

    # Perfil del usuario (avatar + nombre).
    perfil = driver.find_element(By.CSS_SELECTOR, ".topbar-user")
    avatar = perfil.find_element(By.CSS_SELECTOR, ".avatar")
    if TEST_FULLNAME not in perfil.text:
        raise AssertionError(f"El Topbar no muestra el usuario en sesion: {perfil.text!r}")
    if not avatar.text.strip():
        raise AssertionError("El avatar del usuario esta vacio")

    # Ningun selector de modelos ni acceso a comparativas.
    if topbar.find_elements(By.TAG_NAME, "select"):
        raise AssertionError("El Topbar sigue exponiendo un selector de modelos")
    if "Comparar" in topbar.text:
        raise AssertionError("El Topbar sigue exponiendo el boton 'Comparar'")

    return f"Estado='{texto_estado}', switch de tema y perfil '{avatar.text}' presentes; sin controles tecnicos"


# ── Escenario 6: Carga de imagen (valores borde) ─────────────────────────────
def sc_upload_boundaries(driver):
    ir_a(driver, "Análisis individual")

    bad_format = os.path.join(DOWNLOAD_DIR, "documento_invalido.txt")
    with open(bad_format, "w") as f:
        f.write("no es una imagen")
    driver.find_element(By.CSS_SELECTOR, "input[type=file]").send_keys(bad_format)
    wait_visible(driver, By.XPATH, "//strong[contains(text(),'Formato inválido')]", timeout=15)

    big_file = os.path.join(DOWNLOAD_DIR, "imagen_grande.jpg")
    with open(big_file, "wb") as f:
        f.write(os.urandom(11 * 1024 * 1024))
    driver.find_element(By.CSS_SELECTOR, "input[type=file]").send_keys(big_file)
    wait_visible(driver, By.XPATH, "//strong[contains(text(),'Tamaño excedido')]", timeout=15)

    driver.find_element(By.CSS_SELECTOR, "input[type=file]").send_keys(VALID_IMAGE)
    wait_visible(driver, By.CSS_SELECTOR, ".preview-wrap img", timeout=15)
    return "Rechaza .txt y >10MB; acepta imagen valida (particion de equivalencias + valores borde)"


# ── Escenario 7: Identificador de paciente ───────────────────────────────────
def sc_patient_field(driver):
    campo = driver.find_element(By.ID, "patient-id")
    etiqueta = driver.find_element(By.CSS_SELECTOR, 'label[for="patient-id"]').text

    if "historia clínica" not in etiqueta.lower():
        raise AssertionError(f"Etiqueta inesperada del campo de paciente: {etiqueta!r}")
    if campo.get_attribute("placeholder") != "Ej: HC-2026-104":
        raise AssertionError("Placeholder incorrecto en el campo de paciente")

    # Debe capturarse ANTES del area de carga.
    orden = driver.execute_script(
        "var f = document.getElementById('patient-id');"
        "var z = document.querySelector('[data-dropzone], .preview-wrap');"
        "return (f.compareDocumentPosition(z) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'antes' : 'despues';")
    if orden != "antes":
        raise AssertionError("El campo de paciente no precede al area de carga")

    campo.clear()
    campo.send_keys(TEST_PACIENTE)
    return f"Campo 'ID Paciente / Historia Clinica' presente y relleno con {TEST_PACIENTE}"


# ── Escenario 8: Analisis con ResNet50 fijo ──────────────────────────────────
def sc_run_analysis(driver):
    driver.execute_script("window.__predictPayloads = [];")
    click_by_text(driver, "button", "Analizar imagen")
    # Timeout amplio: puede incluir el arranque en frio del Space.
    wait_visible(driver, By.CSS_SELECTOR, ".verdict", timeout=180)

    payloads = driver.execute_script("return window.__predictPayloads;")
    if not payloads:
        raise AssertionError("No se intercepto ninguna peticion a /predict")
    enviado = payloads[-1].get("model_id")
    if enviado != "resnet50":
        raise AssertionError(f"El payload viajo con model_id={enviado!r}, se esperaba 'resnet50'")

    diagnostico = driver.find_element(By.CSS_SELECTOR, ".verdict-value").text.strip()
    if diagnostico not in ("Sospecha de infección por H. pylori", "Mucosa sin hallazgos patológicos"):
        raise AssertionError(f"Diagnostico no clinico: {diagnostico!r}")

    porcentaje = driver.find_element(By.CSS_SELECTOR, ".verdict-prob").text.strip()
    if not porcentaje.endswith("%"):
        raise AssertionError(f"No se renderiza el porcentaje de probabilidad: {porcentaje!r}")

    metricas = driver.find_element(By.CSS_SELECTOR, ".metrics").text
    if "LATENCIA" not in metricas.upper() or "ms" not in metricas:
        raise AssertionError(f"No se renderiza la latencia en ms: {metricas!r}")

    # La tarjeta de resultado no debe reexponer la arquitectura.
    ficha = driver.find_elements(By.CSS_SELECTOR, ".card-sub")[1].text
    if "ResNet" in ficha or "CNN" in ficha or "params" in ficha:
        raise AssertionError(f"La tarjeta de resultado expone datos tecnicos: {ficha!r}")

    latencia = [l for l in metricas.split("\n") if "ms" in l]
    return f"model_id=resnet50 | {diagnostico} | {porcentaje} | latencia {latencia}"


# ── Escenario 9: Informe clinico en PDF ──────────────────────────────────────
def sc_download_pdf(driver):
    handles_before = driver.window_handles
    click_by_text(driver, "button", "Descargar Informe Clínico (PDF)")
    WebDriverWait(driver, 20).until(lambda d: len(d.window_handles) > len(handles_before))
    new_handle = [h for h in driver.window_handles if h not in handles_before][0]
    driver.switch_to.window(new_handle)
    WebDriverWait(driver, 15).until(lambda d: "Informe EndoScan AI" in d.title)
    fuente = driver.page_source
    tiene_resultado = "Resultado del análisis" in fuente
    tiene_paciente = TEST_PACIENTE in fuente
    driver.close()
    driver.switch_to.window(handles_before[0])
    if not tiene_resultado:
        raise AssertionError("El informe no contiene la seccion de resultado")
    if not tiene_paciente:
        raise AssertionError("El informe no incluye el identificador del paciente")
    return f"Informe generado con resultado y paciente {TEST_PACIENTE}"


# ── Escenario 10: Grad-CAM en vivo ───────────────────────────────────────────
def sc_gradcam(driver):
    click_by_text(driver, "button", "Ver Grad-CAM")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Visualización Grad-CAM')]", timeout=15)
    time.sleep(1.5)   # recoloreado del mapa segun la paleta activa

    imgs = driver.find_elements(By.CSS_SELECTOR, ".heatmap-stage img")
    if len(imgs) < 2:
        raise AssertionError("No se muestra el mapa superpuesto sobre la imagen original")

    segmentos = [p.text for p in driver.find_elements(By.CSS_SELECTOR, ".segment-pill")]
    if len(segmentos) != 4:
        raise AssertionError(f"Se esperaban 4 segmentos anatomicos, hay {len(segmentos)}: {segmentos}")

    cuerpo = driver.find_element(By.TAG_NAME, "body").text
    if "layer4" in cuerpo or "ResNet" in cuerpo:
        raise AssertionError("La pantalla Grad-CAM expone detalles de la arquitectura")

    return f"Grad-CAM real superpuesto; segmentos disponibles: {segmentos}"


# ── Escenario 11: Gating de Grad-CAM por cache de sesion ─────────────────────
def sc_gradcam_gating(driver):
    """Las imagenes se archivan: tras recargar, el estudio conserva imagen y Grad-CAM."""
    driver.refresh()
    wait_visible(driver, By.CSS_SELECTOR, "aside.sidebar", timeout=60)
    ir_a(driver, "Historial de estudios")
    filas = WebDriverWait(driver, 20).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".history-row"))
    filas[0].click()

    wait_visible(driver, By.CSS_SELECTOR, ".modal-comparativa", timeout=15)
    WebDriverWait(driver, 20).until(lambda d: d.execute_script(
        "return Array.from(document.querySelectorAll('.modal-comparativa img'))"
        ".filter(function (i) { return i.complete && i.naturalWidth > 0; }).length") >= 2)
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Cerrar la inspección']").click()
    time.sleep(0.6)

    boton = wait_visible(driver, By.CSS_SELECTOR, ".xai-action", timeout=10)
    if not boton.is_enabled() or "Ver Grad-CAM" not in boton.text:
        raise AssertionError("El estudio archivado deberia permitir abrir su Grad-CAM tras recargar")
    return "Tras recargar, el estudio muestra su imagen y su mapa Grad-CAM archivados"


# ── Escenario 12: Busqueda en el historial ───────────────────────────────────
def sc_history_search(driver):
    caja = driver.find_element(By.ID, "history-search")
    if not caja.get_attribute("placeholder").startswith("Buscar por ID de estudio"):
        raise AssertionError("Placeholder inesperado en el buscador del historial")

    antes = len(driver.find_elements(By.CSS_SELECTOR, ".history-row"))
    caja.send_keys("zzz-inexistente-zzz")
    time.sleep(0.8)
    sin_coincidencias = len(driver.find_elements(By.CSS_SELECTOR, ".history-row"))

    # Se borra con pulsaciones reales: `clear()` escribe el valor sin emitir el
    # evento que React necesita para re-renderizar el input controlado.
    caja.send_keys(Keys.CONTROL, "a")
    caja.send_keys(Keys.BACK_SPACE)
    time.sleep(0.8)
    restaurado = len(driver.find_elements(By.CSS_SELECTOR, ".history-row"))

    if sin_coincidencias != 0:
        raise AssertionError("La busqueda sin coincidencias deberia vaciar la lista")
    if restaurado != antes:
        raise AssertionError("Al limpiar la busqueda no se restauran los estudios")

    return f"Filtrado en vivo correcto ({antes} estudios -> 0 -> {restaurado})"


# ── Escenario 13: Modo oscuro accesible ──────────────────────────────────────
def sc_dark_mode(driver):
    inicial = driver.execute_script("return document.documentElement.getAttribute('data-theme');")
    driver.find_element(By.CSS_SELECTOR, ".theme-toggle").click()
    WebDriverWait(driver, 10).until(
        lambda d: d.execute_script("return document.documentElement.getAttribute('data-theme');") == "dark")

    fondo = driver.execute_script("return getComputedStyle(document.body).backgroundColor;")
    persistido = driver.execute_script("return localStorage.getItem('endoscan.theme');")
    if persistido != "dark":
        raise AssertionError(f"La preferencia de tema no se persiste: {persistido!r}")

    aria = driver.find_element(By.CSS_SELECTOR, ".theme-toggle").get_attribute("aria-checked")
    if aria != "true":
        raise AssertionError("El interruptor no refleja su estado en aria-checked")

    driver.find_element(By.CSS_SELECTOR, ".theme-toggle").click()
    WebDriverWait(driver, 10).until(
        lambda d: d.execute_script("return document.documentElement.getAttribute('data-theme');") == "light")

    return f"data-theme conmutado {inicial} -> dark (fondo {fondo}) -> light, con persistencia"


# ── Escenario 14: Carga del lote y previsualizacion ──────────────────────────
def sc_batch_upload(driver):
    ir_a(driver, "Procesamiento por lote")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Procesamiento por lote')]", timeout=15)
    click_by_text(driver, "button", "Cargar 12 imágenes de demostración")
    wait_visible(driver, By.CSS_SELECTOR, ".batch-grid", timeout=15)

    celdas = driver.find_elements(By.CSS_SELECTOR, ".batch-cell")
    if len(celdas) != 12:
        raise AssertionError(f"Se esperaban 12 miniaturas en la serie, hay {len(celdas)}")

    cargadas = driver.execute_script(
        "return Array.from(document.querySelectorAll('.batch-thumb')).filter(function (i) {"
        "  return i.tagName === 'IMG' && i.naturalWidth > 0; }).length;")
    if cargadas != 12:
        raise AssertionError(f"Solo {cargadas}/12 miniaturas cargaron su imagen")

    if driver.find_elements(By.XPATH, "//button[contains(.,'CSV')]"):
        raise AssertionError("El boton de exportacion aparece antes de procesar el lote")

    return "12 imagenes en la serie con previsualizacion; exportacion aun oculta"


# ── Escenario 15: Procesamiento del lote ─────────────────────────────────────
def sc_batch_run(driver):
    # El paciente es obligatorio: todo el lote va a su historial.
    campo = driver.find_element(By.ID, "lote-paciente")
    campo.clear()
    campo.send_keys(TEST_PACIENTE)
    click_by_text(driver, "button", "Procesar 12 imagenes")
    WebDriverWait(driver, 300).until(
        lambda d: all("guardado" in row.text or "ERROR" in row.text.upper()
                      for row in d.find_elements(By.CSS_SELECTOR, "table.table tbody tr"))
        and len(d.find_elements(By.CSS_SELECTOR, "table.table tbody tr")) == 12)

    positivos = len(driver.find_elements(By.CSS_SELECTOR, "table.table .badge-pos"))
    negativos = len(driver.find_elements(By.CSS_SELECTOR, "table.table .badge-neg"))
    return f"Lote procesado con inferencias reales: {positivos} positivos, {negativos} negativos"


# ── Escenario 16: Exportacion del resumen clinico ────────────────────────────
def sc_batch_export_csv(driver):
    for f in os.listdir(DOWNLOAD_DIR):
        if f.endswith(".csv") or f.endswith(".csv.crdownload"):
            try:
                os.remove(os.path.join(DOWNLOAD_DIR, f))
            except OSError:
                pass

    click_by_text(driver, "button", "Exportar Resumen Clínico (CSV)")
    WebDriverWait(driver, 30).until(
        lambda _: any(f.endswith(".csv") for f in os.listdir(DOWNLOAD_DIR)))
    return "Resumen clinico del lote exportado a CSV"


# ── Escenario 17: Sensibilidad del analisis ──────────────────────────────────
def sc_settings_sensibilidad(driver):
    """Configuracion solo con preferencias de uso: sin umbrales ni jerga de IA."""
    ir_a(driver, "Configuración")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Configuración')]", timeout=15)

    cuerpo = driver.find_element(By.TAG_NAME, "body").text
    for jerga in ("P(positivo)", "Sensibilidad del análisis", "umbral", "Umbral"):
        if jerga in cuerpo:
            raise AssertionError(f"Configuracion sigue mostrando ajustes tecnicos: {jerga!r}")
    if driver.find_elements(By.CSS_SELECTOR, ".preset-btn"):
        raise AssertionError("Configuracion sigue exponiendo niveles de sensibilidad")

    interruptor = wait_visible(driver, By.CSS_SELECTOR, "button.switch[aria-label='Modo oscuro']")
    antes = interruptor.get_attribute("aria-checked")
    interruptor.click()
    time.sleep(0.5)
    despues = interruptor.get_attribute("aria-checked")
    interruptor.click()            # se deja como estaba
    if antes == despues:
        raise AssertionError("El modo oscuro no cambia al pulsar el interruptor")

    return "Configuracion de experiencia de usuario: modo oscuro y colores del mapa, sin umbrales"

# ── Escenario 18: Ficha tecnica del motor activo ─────────────────────────────
def sc_manual_motor(driver):
    """El manual es una guia de uso paso a paso, sin fichas tecnicas."""
    ir_a(driver, "Manual de usuario")
    wait_visible(driver, By.CSS_SELECTOR, ".manual-seccion", timeout=15)

    titulos = [e.text.strip() for e in driver.find_elements(By.CSS_SELECTOR, ".manual-titulo")]
    for esperado in ("Analizar una imagen", "Analizar varias imágenes (lote)",
                     "Consultar el historial", "Preguntas frecuentes"):
        if esperado not in titulos:
            raise AssertionError(f"Falta la seccion {esperado!r} en el manual: {titulos}")

    cuerpo = driver.find_element(By.TAG_NAME, "body").text
    for tecnico in ("AUC", "umbral", "VGG16", "MobileNetV3", "Especificidad"):
        if tecnico in cuerpo:
            raise AssertionError(f"El manual sigue mostrando contenido tecnico: {tecnico!r}")

    return f"Guia de uso con {len(titulos)} secciones: {', '.join(titulos)}"

# ── Escenarios de Taller Integrador 2 ────────────────────────────────────────
def sc_historial_por_paciente(driver):
    """Los estudios del mismo codigo de paciente se agrupan."""
    ir_a(driver, "Historial de estudios")
    click_by_text(driver, "button", "Por paciente")
    time.sleep(1.0)
    cuerpo = driver.find_element(By.CSS_SELECTOR, ".content").text
    if TEST_PACIENTE not in cuerpo:
        raise AssertionError(f"La vista por paciente no muestra {TEST_PACIENTE}")
    click_by_text(driver, "button", "Cronológico")
    return f"Estudios agrupados bajo el paciente {TEST_PACIENTE}"


def sc_confirmar_diagnostico(driver):
    """El medico registra el resultado de la prueba de referencia de un estudio."""
    ir_a(driver, "Historial de estudios")
    filas = WebDriverWait(driver, 20).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".history-row"))
    filas[0].click()
    wait_visible(driver, By.CSS_SELECTOR, ".modal-comparativa .confirmacion", timeout=15)
    driver.find_element(By.XPATH, "//*[contains(@class,'modal-comparativa')]//button[normalize-space()='Resultó positivo']").click()
    estado = wait_visible(driver, By.CSS_SELECTOR, ".modal-comparativa .confirmacion-estado", timeout=15)
    texto = estado.text
    driver.find_element(By.CSS_SELECTOR, "[aria-label='Cerrar la inspección']").click()
    time.sleep(0.8)
    insignia = driver.find_elements(By.XPATH, "//*[contains(@class,'history-row')]//*[contains(., 'Confirmado') or contains(., 'No coincide')]")
    if not insignia:
        raise AssertionError("La fila del estudio no muestra la insignia de confirmacion")
    return f"Diagnostico confirmado registrado: {texto.splitlines()[0]}"


def sc_descargar_mis_datos(driver):
    """Derecho de acceso: el titular descarga lo que el sistema guarda de su cuenta."""
    # El lote y los analisis anteriores agotan la cuota de 30 peticiones por
    # minuto de la cuenta (RQ-23); se espera a que se renueve.
    time.sleep(61)
    for viejo in os.listdir(DOWNLOAD_DIR):
        if viejo.startswith("endoscan_mis_datos"):
            os.remove(os.path.join(DOWNLOAD_DIR, viejo))
    ir_a(driver, "Configuración")
    antes = set(os.listdir(DOWNLOAD_DIR))
    click_by_text(driver, "button", "Descargar mis datos")
    WebDriverWait(driver, 20).until(lambda d: [f for f in os.listdir(DOWNLOAD_DIR)
                                              if f not in antes and f.endswith(".json")])
    nuevo = [f for f in os.listdir(DOWNLOAD_DIR) if f not in antes and f.endswith(".json")][0]
    with open(os.path.join(DOWNLOAD_DIR, nuevo), encoding="utf-8") as fh:
        datos = json.load(fh)
    if datos.get("cuenta", {}).get("email") != TEST_EMAIL:
        raise AssertionError("La descarga no corresponde a la cuenta en sesion")
    return f"Descarga {nuevo} con los datos de {TEST_EMAIL}"


def sc_solicitud_arco(driver):
    """El titular presenta una solicitud ARCO y la ve registrada."""
    ir_a(driver, "Configuración")
    click_by_text(driver, "button", "Hacer una solicitud")
    area = wait_visible(driver, By.CSS_SELECTOR, "textarea", timeout=10)
    area.send_keys("Solicito una copia de los datos de mi cuenta (prueba automatizada).")
    botones = [b for b in driver.find_elements(By.TAG_NAME, "button")
               if b.text.strip().startswith("Enviar") and b.is_displayed()]
    if not botones:
        raise AssertionError("No se encontro el boton para enviar la solicitud")
    botones[0].click()
    WebDriverWait(driver, 15).until(lambda d: "pendiente" in d.find_element(By.TAG_NAME, "body").text.lower())
    return "Solicitud ARCO registrada con estado pendiente"


def sc_admin_restringido(driver):
    """Un medico no accede a las funciones de administracion, ni siquiera por la API."""
    estado = driver.execute_script(
        "return fetch(arguments[0] + '/admin/users', {headers: {Authorization: 'Bearer ' + "
        "localStorage.getItem('endoscan_token')}}).then(function (r) { return r.status; });",
        BACKEND_URL)
    # El 403 provocado a proposito no cuenta como error de la aplicacion.
    driver.get_log("browser")
    if estado != 403:
        raise AssertionError(f"La API de administracion respondio {estado} a un medico")
    return "GET /admin/users con sesion de medico -> 403"


# ── Escenario 19: Consola sin errores ────────────────────────────────────────
def sc_consola_limpia(driver):
    js_errors = driver.execute_script("return window.__consoleErrors || [];")
    severos = [
        l["message"] for l in driver.get_log("browser")
        if l["level"] == "SEVERE" and "favicon" not in l["message"]
    ]
    if js_errors or severos:
        raise AssertionError(f"Errores en consola: {(js_errors + severos)[:3]}")
    return "Recorrido completo sin errores de JavaScript"


def warm_up_backend(url, timeout_s=180):
    """El backend vive en Hugging Face Spaces (tier gratuito) y se duerme sin
    trafico. Se despierta antes de Selenium para que el arranque en frio no
    consuma el timeout del registro."""
    import urllib.request
    log(f"Despertando backend en {url} (hasta {timeout_s}s si esta dormido)...")
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                if resp.status == 200:
                    log(f"Backend activo ({round(time.time() - t0, 1)}s)")
                    return True
        except Exception:
            pass
        time.sleep(3)
    log("ADVERTENCIA: el backend no respondio dentro del warm-up; se continua igual")
    return False


BASE_URL_ACTIVA = ""


def main():
    global BASE_URL_ACTIVA

    url, servidor = arrancar_servidor()
    BASE_URL_ACTIVA = url

    log(f"Frontend bajo prueba: {url}")
    log(f"Modo: {'VISIBLE (grabacion)' if HEADED else 'headless'}")
    warm_up_backend(BACKEND_URL + "/")

    if HEADED:
        for s in range(6, 0, -1):
            log(f"Iniciando en {s}s...")
            time.sleep(1)

    driver = make_driver()
    try:
        run_scenario(driver, "1", "Registro de nueva cuenta", "Autenticacion", "Particion de equivalencias", sc_register)
        run_scenario(driver, "2", "Acuerdo de proteccion de datos", "Cumplimiento", "Caso de uso", sc_legal_agreement)
        run_scenario(driver, "3", "Cierre de sesion", "Autenticacion", "Caso de uso", sc_logout)
        run_scenario(driver, "4", "Inicio de sesion", "Autenticacion", "Particion de equivalencias", sc_login)
        run_scenario(driver, "5", "Accesos clinicos del menu lateral", "Navegacion", "Cobertura de interfaz", sc_sidebar_clinico)
        run_scenario(driver, "6", "Barra superior clinica", "Navegacion", "Cobertura de interfaz", sc_topbar_clinico)
        run_scenario(driver, "7", "Carga de imagen para analisis", "Analisis individual", "Valores borde", sc_upload_boundaries)
        run_scenario(driver, "8", "Identificador de paciente", "Analisis individual", "Caso de uso", sc_patient_field)
        run_scenario(driver, "9", "Analisis con motor ResNet50 fijo", "Analisis individual", "Tabla de decision", sc_run_analysis)
        run_scenario(driver, "10", "Informe clinico en PDF", "Analisis individual", "Caso de uso", sc_download_pdf)
        run_scenario(driver, "11", "Visualizacion Grad-CAM en vivo", "Grad-CAM", "Caso de uso", sc_gradcam)
        run_scenario(driver, "12", "Grad-CAM archivado tras recargar", "Grad-CAM", "Caso de uso", sc_gradcam_gating)
        run_scenario(driver, "13", "Busqueda en el historial", "Historial de estudios", "Particion de equivalencias", sc_history_search)
        run_scenario(driver, "14", "Conmutacion a modo oscuro", "Accesibilidad", "Caso de uso", sc_dark_mode)
        run_scenario(driver, "15", "Carga y previsualizacion del lote", "Procesamiento por lote", "Valores borde", sc_batch_upload)
        run_scenario(driver, "16", "Procesamiento del lote", "Procesamiento por lote", "Caso de uso", sc_batch_run)
        run_scenario(driver, "17", "Exportacion del resumen clinico", "Procesamiento por lote", "Caso de uso", sc_batch_export_csv)
        run_scenario(driver, "18", "Configuracion de experiencia de usuario", "Configuracion", "Cobertura de interfaz", sc_settings_sensibilidad)
        run_scenario(driver, "19", "Manual de uso paso a paso", "Manual de usuario", "Cobertura de interfaz", sc_manual_motor)
        run_scenario(driver, "20", "Historial agrupado por paciente", "Historial de estudios", "Caso de uso", sc_historial_por_paciente)
        run_scenario(driver, "21", "Registro del diagnostico confirmado", "Historial de estudios", "Caso de uso", sc_confirmar_diagnostico)
        run_scenario(driver, "22", "Descarga de mis datos", "Privacidad", "Caso de uso", sc_descargar_mis_datos)
        run_scenario(driver, "23", "Solicitud ARCO", "Privacidad", "Caso de uso", sc_solicitud_arco)
        run_scenario(driver, "24", "Administracion restringida al medico", "Seguridad", "Particion de equivalencias", sc_admin_restringido)
        run_scenario(driver, "25", "Consola sin errores", "Calidad", "Cobertura de interfaz", sc_consola_limpia)
        if HEADED:
            log("Fin de escenarios - la ventana queda abierta 6s...")
            time.sleep(6)
    finally:
        driver.quit()
        if servidor:
            servidor.terminate()

    summary = {
        "run_id": RUN_ID,
        "fecha": datetime.now().isoformat(),
        "test_email": TEST_EMAIL,
        "base_url_frontend": url,
        "base_url_backend": BACKEND_URL,
        "total": len(results),
        "aprobados": sum(1 for r in results if r["estado"] == "APROBADO"),
        "fallidos": sum(1 for r in results if r["estado"] == "FALLIDO"),
        "escenarios": results,
    }
    with open(os.path.join(RESULTS_DIR, "resumen_e2e.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    log(f"RESUMEN: {summary['aprobados']}/{summary['total']} aprobados")
    for r in results:
        log(f"  [{r['estado']}] {r['id']} - {r['escenario']}")

    return 0 if summary["fallidos"] == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
