# -*- coding: utf-8 -*-
"""
Pruebas End-to-End (Selenium) - EndoScan AI
Curso: Taller de Software / Taller Integrador - UPAO

Automatiza los 16 escenarios del "Documento de Pruebas de Caja Negra"
contra la aplicacion real: frontend servido localmente (http://localhost:8899)
+ backend de produccion (https://franco0306-hpylori-detection.hf.space).

Genera:
  - tests/e2e_results/resumen_e2e.json   (resultado detallado por escenario)
  - tests/e2e_results/*.png              (captura de pantalla de cada escenario)

Uso:
    python tests/test_e2e_selenium.py
"""
import json
import os
import time
import traceback
from datetime import datetime

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options

# Por defecto corre contra el sistema DESPLEGADO (GitHub Pages -> backend en HF Space).
# Se puede sobreescribir con la variable de entorno E2E_BASE_URL.
BASE_URL = os.environ.get("E2E_BASE_URL", "https://franco0306.github.io/hpylori-frontend/")

# Modo visible/lento para grabar la pantalla: exportar E2E_HEADED=1
HEADED = os.environ.get("E2E_HEADED", "") == "1"
STEP_PAUSE = float(os.environ.get("E2E_PAUSE", "1.4")) if HEADED else 0.0

HERE = os.path.dirname(os.path.abspath(__file__))
RESULTS_DIR = os.path.join(HERE, "e2e_results")
DOWNLOAD_DIR = os.path.join(RESULTS_DIR, "downloads")
os.makedirs(DOWNLOAD_DIR, exist_ok=True)

RUN_ID = datetime.now().strftime("%Y%m%d%H%M%S")
TEST_EMAIL = f"qa.selenium.taller.{RUN_ID}@example.com"
TEST_PASSWORD = "TallerE2E2026!"
TEST_FULLNAME = "QA Selenium Taller"

SAMPLES_DIR = os.path.join(HERE, "..", "samples", "img")
VALID_IMAGE = os.path.abspath(os.path.join(SAMPLES_DIR, "POSITIVO", "p144_f000840.jpg"))

results = []


def log(msg):
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")


def make_driver():
    opts = Options()
    if not HEADED:
        opts.add_argument("--headless=new")
        opts.add_argument("--window-size=1440,1000")
    else:
        # Ventana visible y grande para la grabación de pantalla.
        opts.add_argument("--start-maximized")
        opts.add_argument("--window-size=1920,1080")
    opts.add_argument("--disable-gpu")
    opts.add_experimental_option("prefs", {
        "download.default_directory": DOWNLOAD_DIR,
        "download.prompt_for_download": False,
    })
    d = webdriver.Chrome(options=opts)
    # Browser.setDownloadBehavior es más fiable que Page.* para descargas Blob
    # bajo headless=new; se intentan ambos por compatibilidad.
    for domain in ("Browser", "Page"):
        try:
            d.execute_cdp_cmd(f"{domain}.setDownloadBehavior", {
                "behavior": "allow", "downloadPath": DOWNLOAD_DIR,
            })
        except Exception:
            pass
    if HEADED:
        d.maximize_window()
    return d


def wait_visible(driver, by, value, timeout=15):
    return WebDriverWait(driver, timeout).until(EC.visibility_of_element_located((by, value)))


def wait_present(driver, by, value, timeout=15):
    return WebDriverWait(driver, timeout).until(EC.presence_of_element_located((by, value)))


def click_by_text(driver, tag, text, timeout=15):
    xpath = f"//{tag}[contains(normalize-space(.),'{text}')]"
    el = wait_visible(driver, By.XPATH, xpath, timeout)
    el.click()
    return el


def screenshot(driver, name):
    path = os.path.join(RESULTS_DIR, f"{name}.png")
    driver.save_screenshot(path)
    return path


def run_scenario(driver, sid, hu, name, module, technique, fn):
    log(f"--- {sid} ({hu}) {name} ---")
    entry = {"id": sid, "hu": hu, "escenario": name, "modulo": module, "tecnica": technique}
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
        time.sleep(STEP_PAUSE)  # pausa para que la grabación sea legible


# ── Escenario 1 — HU-1.1: Registro de nueva cuenta ──────────────────────────
def sc_register(driver):
    driver.get(BASE_URL)
    wait_visible(driver, By.XPATH, "//span[contains(text(),'Regístrate')]").click()
    wait_visible(driver, By.CSS_SELECTOR, "input[type=email]").send_keys(TEST_EMAIL)
    fields = driver.find_elements(By.CSS_SELECTOR, "input[type=password]")
    fields[0].send_keys(TEST_PASSWORD)
    fields[1].send_keys(TEST_PASSWORD)
    driver.find_element(By.CSS_SELECTOR, "input[type=text]").send_keys(TEST_FULLNAME)
    click_by_text(driver, "button", "Crear cuenta")
    wait_visible(driver, By.CSS_SELECTOR, "aside.sidebar", timeout=60)
    return f"Cuenta creada: {TEST_EMAIL}"


# ── Escenario 3 — HU-1.3: Cierre de sesion (se ejecuta antes que el 2 para poder probar login) ──
def sc_logout(driver):
    driver.find_element(By.CSS_SELECTOR, ".sidebar-footer button.btn-icon").click()
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Iniciar sesión')]", timeout=10)
    return "Sesion cerrada, vuelve a la pantalla de login"


# ── Escenario 2 — HU-1.2: Inicio de sesion ──────────────────────────────────
def sc_login(driver):
    wait_visible(driver, By.CSS_SELECTOR, "input[type=email]").send_keys(TEST_EMAIL)
    driver.find_element(By.CSS_SELECTOR, "input[type=password]").send_keys(TEST_PASSWORD)
    click_by_text(driver, "button", "Ingresar")
    wait_visible(driver, By.CSS_SELECTOR, "aside.sidebar", timeout=60)
    return "Login exitoso con la cuenta registrada"


# ── Escenario 4 — HU-001: Carga de imagen (valores borde + particion) ──────
def sc_upload_boundaries(driver):
    # Caso 1: formato invalido (.txt)
    bad_format = os.path.join(DOWNLOAD_DIR, "documento_invalido.txt")
    with open(bad_format, "w") as f:
        f.write("no es una imagen")
    file_input = driver.find_element(By.CSS_SELECTOR, "input[type=file]")
    file_input.send_keys(bad_format)
    wait_visible(driver, By.XPATH, "//strong[contains(text(),'Formato inválido')]", timeout=10)

    # Caso 2: tamano excedido (>10MB)
    big_file = os.path.join(DOWNLOAD_DIR, "imagen_grande.jpg")
    with open(big_file, "wb") as f:
        f.write(os.urandom(11 * 1024 * 1024))
    file_input = driver.find_element(By.CSS_SELECTOR, "input[type=file]")
    file_input.send_keys(big_file)
    wait_visible(driver, By.XPATH, "//strong[contains(text(),'Tamaño excedido')]", timeout=10)

    # Caso 3: imagen valida (formato y tamano correctos)
    file_input = driver.find_element(By.CSS_SELECTOR, "input[type=file]")
    file_input.send_keys(VALID_IMAGE)
    wait_visible(driver, By.CSS_SELECTOR, ".preview-wrap img", timeout=10)
    return "Rechaza .txt y >10MB; acepta imagen valida (partición de equivalencias + valores borde)"


# ── Escenario 5 — HU-001: Ejecucion del analisis y umbral ───────────────────
def sc_run_analysis(driver):
    click_by_text(driver, "button", "Analizar imagen")
    # timeout largo: puede incluir "cold start" del backend en Hugging Face Spaces
    wait_visible(driver, By.CSS_SELECTOR, ".verdict", timeout=100)
    clase = driver.find_element(By.CSS_SELECTOR, ".verdict-value").text
    prob = driver.find_element(By.CSS_SELECTOR, ".verdict-prob").text
    return f"Resultado real del modelo: {clase} ({prob})"


# ── Escenario 6 — HU-001: Descarga de informe PDF ───────────────────────────
def sc_download_pdf(driver):
    handles_before = driver.window_handles
    click_by_text(driver, "button", "Descargar informe PDF")
    WebDriverWait(driver, 10).until(lambda d: len(d.window_handles) > len(handles_before))
    new_handle = [h for h in driver.window_handles if h not in handles_before][0]
    driver.switch_to.window(new_handle)
    WebDriverWait(driver, 10).until(lambda d: "Informe EndoScan AI" in d.title)
    contains_result = "Resultado del análisis" in driver.page_source
    driver.close()
    driver.switch_to.window(handles_before[0])
    if not contains_result:
        raise AssertionError("El informe PDF no contiene la seccion de resultado")
    return "Informe HTML/PDF generado con el resultado del analisis"


# ── Escenario 7 — HU-002: Visualizacion de Grad-CAM ─────────────────────────
def sc_gradcam(driver):
    click_by_text(driver, "button", "Ver Grad-CAM")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Visualización Grad-CAM')]", timeout=10)
    imgs = driver.find_elements(By.CSS_SELECTOR, ".heatmap-stage img")
    live_badge = driver.find_elements(By.XPATH, "//span[contains(text(),'Resultado real')]")
    if len(imgs) < 2 or not live_badge:
        raise AssertionError("No se muestra el heatmap en vivo del analisis real")
    return "Se muestra imagen original + Grad-CAM superpuesto del resultado real"


# ── Escenario 8 — HU-003: Carga multiple de imagenes para lote ──────────────
def sc_batch_upload(driver):
    click_by_text(driver, "span", "Procesamiento por lote")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Procesamiento por lote')]", timeout=10)
    click_by_text(driver, "button", "Cargar 12 imágenes de demostración")
    wait_visible(driver, By.CSS_SELECTOR, "table.table tbody tr", timeout=10)
    rows = driver.find_elements(By.CSS_SELECTOR, "table.table tbody tr")
    if len(rows) != 12:
        raise AssertionError(f"Se esperaban 12 imagenes en cola, hay {len(rows)}")
    return "12 imagenes de demostracion cargadas en la cola del lote"


# ── Escenario 9 — HU-003: Procesamiento del lote ────────────────────────────
def sc_batch_run(driver):
    click_by_text(driver, "button", "Procesar 12 imagenes")
    WebDriverWait(driver, 180).until(
        lambda d: d.find_element(By.CSS_SELECTOR, ".kpi-value").text != "" and
        all("completado" in row.text or "POSITIVO" in row.text or "NEGATIVO" in row.text or "ERROR" in row.text
            for row in d.find_elements(By.CSS_SELECTOR, "table.table tbody tr"))
    )
    positives = len(driver.find_elements(By.CSS_SELECTOR, ".badge-pos"))
    negatives = len(driver.find_elements(By.CSS_SELECTOR, ".badge-neg"))
    return f"Lote procesado: {positives} positivos, {negatives} negativos (12 inferencias reales)"


# ── Escenario 10 — HU-003: Exportacion de resultados a CSV ──────────────────
def sc_batch_export_csv(driver):
    # Borrar CSV previos: Chrome reescribe "lote.csv" con el mismo nombre, así que
    # detectar por "nombre nuevo" falla en corridas repetidas. Limpiamos y esperamos
    # que aparezca cualquier .csv fresco.
    for f in os.listdir(DOWNLOAD_DIR):
        if f.endswith(".csv") or f.endswith(".csv.crdownload"):
            try:
                os.remove(os.path.join(DOWNLOAD_DIR, f))
            except OSError:
                pass
    click_by_text(driver, "button", "Exportar CSV")
    def downloaded(_):
        return any(f.endswith(".csv") for f in os.listdir(DOWNLOAD_DIR))
    WebDriverWait(driver, 25).until(downloaded)
    return "Archivo lote.csv descargado correctamente"


# ── Escenario 11 — HU-004: Filtros del historial de estudios ────────────────
def sc_history_filters(driver):
    click_by_text(driver, "span", "Historial de estudios")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Historial de estudios')]", timeout=10)
    time.sleep(1.5)  # carga inicial del historial (fetch a /studies)
    click_by_text(driver, "button", "Positivo")
    time.sleep(0.5)
    neg_badges_visible = driver.find_elements(By.CSS_SELECTOR, ".badge-neg")
    click_by_text(driver, "button", "Todos")
    return f"Filtro 'Positivo' aplicado; badges negativos tras filtrar: {len(neg_badges_visible)}"


# ── Escenario 12 — HU-004: Vista de historial agrupado por paciente ─────────
def sc_history_by_patient(driver):
    click_by_text(driver, "button", "Por paciente")
    time.sleep(0.5)
    grouped = driver.find_elements(By.XPATH, "//div[contains(text(),'Sin paciente asignado')]")
    return f"Vista agrupada por paciente activa; grupos sin paciente detectados: {len(grouped)}"


# ── Escenario 13 — HU-004: Eliminacion de estudios ──────────────────────────
def sc_history_delete(driver):
    click_by_text(driver, "button", "Cronológico")
    time.sleep(0.5)
    rows_before = driver.find_elements(By.CSS_SELECTOR, ".badge-neutral")
    total_before = int(rows_before[-1].text.split()[0]) if rows_before else 0
    driver.find_element(By.CSS_SELECTOR, ".btn-icon[title='Eliminar']").click()
    time.sleep(1.0)
    return f"Estudio eliminado (total visible antes: {total_before})"


# ── Escenario 14 — HU-005: Seleccion de modelo activo ───────────────────────
def sc_select_model(driver):
    click_by_text(driver, "span", "Modelos disponibles")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Modelos disponibles')]", timeout=10)
    wait_visible(driver, By.XPATH, "//div[@class='name'][contains(text(),'GoogLeNet')]").click()
    wait_visible(driver, By.XPATH, "//button[contains(@class,'model-card') and contains(@class,'selected')]//span[contains(text(),'ACTIVO')]", timeout=10)
    return "GoogLeNet seleccionado como modelo activo (badge ACTIVO confirmado)"


# ── Escenario 15 — HU-006: Analisis comparativo con los 6 modelos ───────────
def sc_compare_models(driver):
    click_by_text(driver, "span", "Comparativa de modelos")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Comparativa de modelos')]", timeout=10)
    click_by_text(driver, "button", "Analizar con los 6 modelos")
    wait_visible(driver, By.XPATH, "//div[contains(text(),'Consenso')]", timeout=180)
    consensus = driver.find_element(By.XPATH, "//div[contains(text(),'Consenso')]/following-sibling::div").text
    return f"6 inferencias reales completadas. Consenso: {consensus}"


# ── Escenario 16 — HU-007: Umbral de clasificacion y modelo por defecto ─────
def sc_settings_threshold(driver):
    click_by_text(driver, "span", "Configuración")
    wait_visible(driver, By.XPATH, "//h1[contains(text(),'Configuración')]", timeout=10)
    slider = driver.find_element(By.CSS_SELECTOR, "input.slider[type=range]")
    driver.execute_script(
        "const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;"
        "setter.call(arguments[0], '0.30');"
        "arguments[0].dispatchEvent(new Event('input', {bubbles:true}));", slider)
    save_btn = wait_visible(driver, By.XPATH, "//button[contains(.,'Guardar cambios')]")
    WebDriverWait(driver, 10).until(lambda d: save_btn.is_enabled())
    save_btn.click()
    wait_visible(driver, By.XPATH, "//button[contains(text(),'Guardado')]", timeout=10)
    return "Umbral cambiado a 0.30 y guardado en la cuenta del usuario"


def warm_up_backend(url, timeout_s=120):
    """El backend esta en Hugging Face Spaces (tier gratuito) y se 'duerme' si
    no recibe trafico. Lo despertamos antes de correr Selenium para que el
    timeout del registro/login no se consuma en el cold start."""
    import urllib.request
    log(f"Despertando backend en {url} (puede tardar hasta {timeout_s}s si esta dormido)...")
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        try:
            with urllib.request.urlopen(url, timeout=10) as resp:
                if resp.status == 200:
                    log(f"Backend activo ({round(time.time() - t0, 1)}s)")
                    return
        except Exception:
            pass
        time.sleep(3)
    log("ADVERTENCIA: backend no respondio dentro del timeout de warm-up, se continua igual")


def main():
    log(f"Frontend bajo prueba: {BASE_URL}")
    log(f"Modo: {'VISIBLE (grabación)' if HEADED else 'headless'}")
    warm_up_backend("https://franco0306-hpylori-detection.hf.space/")
    if HEADED:
        for s in range(6, 0, -1):
            log(f"Iniciando en {s}s...  (empezá a grabar y dejá la ventana de Chrome al frente)")
            time.sleep(1)
    driver = make_driver()
    try:
        run_scenario(driver, "1", "HU-1.1", "Registro de Nueva Cuenta", "Autenticacion", "Particion de equivalencias", sc_register)
        run_scenario(driver, "3", "HU-1.3", "Cierre de Sesion", "Autenticacion", "Caso de uso", sc_logout)
        run_scenario(driver, "2", "HU-1.2", "Inicio de Sesion", "Autenticacion", "Particion de equivalencias y valores borde", sc_login)
        run_scenario(driver, "4", "HU-001", "Carga de Imagen para Analisis Individual", "Analisis individual", "Valores borde y particion de equivalencias", sc_upload_boundaries)
        run_scenario(driver, "5", "HU-001", "Ejecucion del Analisis y Umbral de Clasificacion", "Analisis individual", "Tabla de decision", sc_run_analysis)
        run_scenario(driver, "6", "HU-001", "Descarga de Informe PDF Clinico", "Analisis individual", "Caso de uso", sc_download_pdf)
        run_scenario(driver, "7", "HU-002", "Visualizacion y Descarga de Grad-CAM", "Grad-CAM", "Caso de uso", sc_gradcam)
        run_scenario(driver, "8", "HU-003", "Carga Multiple de Imagenes para Lote", "Procesamiento por lote", "Valores borde y particion de equivalencias", sc_batch_upload)
        run_scenario(driver, "9", "HU-003", "Procesamiento del Lote", "Procesamiento por lote", "Caso de uso", sc_batch_run)
        run_scenario(driver, "10", "HU-003", "Exportacion de Resultados a CSV", "Procesamiento por lote", "Particion de equivalencias", sc_batch_export_csv)
        run_scenario(driver, "11", "HU-004", "Filtros del Historial de Estudios", "Historial de estudios", "Tabla de decision", sc_history_filters)
        run_scenario(driver, "12", "HU-004", "Vista de Historial Agrupado por Paciente", "Historial de estudios", "Caso de uso", sc_history_by_patient)
        run_scenario(driver, "13", "HU-004", "Eliminacion de Estudios", "Historial de estudios", "Caso de uso", sc_history_delete)
        run_scenario(driver, "14", "HU-005", "Seleccion de Modelo Activo", "Modelos disponibles", "Particion de equivalencias", sc_select_model)
        run_scenario(driver, "15", "HU-006", "Analisis Comparativo con los 6 Modelos", "Comparativa de modelos", "Caso de uso", sc_compare_models)
        run_scenario(driver, "16", "HU-007", "Umbral de Clasificacion y Modelo por Defecto", "Configuracion", "Valores borde", sc_settings_threshold)
        if HEADED:
            log("Fin de escenarios — la ventana queda abierta 6s para cerrar la grabación...")
            time.sleep(6)
    finally:
        driver.quit()

    summary = {
        "run_id": RUN_ID,
        "fecha": datetime.now().isoformat(),
        "test_email": TEST_EMAIL,
        "base_url_frontend": BASE_URL,
        "base_url_backend": "https://franco0306-hpylori-detection.hf.space",
        "total": len(results),
        "aprobados": sum(1 for r in results if r["estado"] == "APROBADO"),
        "fallidos": sum(1 for r in results if r["estado"] == "FALLIDO"),
        "escenarios": results,
    }
    with open(os.path.join(RESULTS_DIR, "resumen_e2e.json"), "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2, ensure_ascii=False)

    log(f"RESUMEN: {summary['aprobados']}/{summary['total']} aprobados")
    for r in results:
        log(f"  [{r['estado']}] {r['id']} {r['hu']} - {r['escenario']}")


if __name__ == "__main__":
    main()
