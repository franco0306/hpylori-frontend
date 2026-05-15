# EndoScan AI · H. pylori — Frontend modular

Estructura de carpetas:

```
hpylori-diagnostic-support/
├── index.html                  ← shell HTML (carga CSS y módulos JS)
├── css/
│   └── styles.css              ← todos los estilos
└── js/
    ├── config.js               ← URL del backend, flags, límites
    ├── api.js                  ← cliente HTTP + mock (PUNTO DE INTEGRACIÓN)
    ├── models.js               ← catálogo de modelos disponibles
    ├── samples.js              ← imágenes de muestra (sintéticas)
    ├── icons.js                ← iconos SVG inline
    ├── app.js                  ← entrada React (monta la SPA)
    └── components/
        ├── Sidebar.js
        ├── Topbar.js           ← exporta también Disclaimer
        ├── Dashboard.js
        ├── SingleScreen.js     ← HU-001: análisis individual
        ├── HeatmapScreen.js    ← HU-002: Grad-CAM
        ├── BatchScreen.js      ← HU-003: lote
        ├── ModelsScreen.js
        └── CompareScreen.js
```

## Cómo correrlo en local

Los módulos ES requieren servir vía HTTP (no `file://`). Cualquiera de estos sirve:

```powershell
# Python
python -m http.server 5500

# Node
npx serve .

# VS Code: extensión "Live Server" (clic derecho sobre index.html → Open with Live Server)
```

Luego abre <http://localhost:5500/>.

## Cómo conectar tu modelo (TMB)

Toda la integración está en **`js/api.js`** y **`js/config.js`**. No tocas nada más.

### 1) Apunta al backend

Edita `js/config.js`:

```js
export const CONFIG = {
  API_BASE_URL: "http://localhost:8000",   // ← URL de tu modelo
  PREDICT_PATH: "/predict",
  USE_MOCK:     false,                     // ← false para usar el modelo real
  MAX_FILE_MB:  10,
  ACCEPTED_MIME: ["image/jpeg", "image/png", "image/jpg"],
  REQUEST_TIMEOUT_MS: 15000,
};
```

### 2) Contrato del endpoint

`POST {API_BASE_URL}{PREDICT_PATH}` con `multipart/form-data`:

| Campo      | Tipo   | Descripción                                  |
| ---------- | ------ | -------------------------------------------- |
| `file`     | File   | Imagen endoscópica (JPG/PNG, ≤ 10 MB)        |
| `model_id` | string | id del modelo (`resnet50`, `efficientnetb3`, …) |

Respuesta JSON (200):

```json
{
  "clase":       "Positivo",
  "prob":        0.8731,
  "latencia_ms": 1420,
  "heatmap_b64": "data:image/png;base64,iVBORw0KGgo...",
  "modelo":      "ResNet50-Hp_v0.4.2",
  "modelId":     "resnet50",
  "timestamp":   "2026-05-04T18:23:00.000Z"
}
```

- `clase`: `"Positivo"` o `"Negativo"`.
- `prob`: probabilidad de la clase predicha (0–1).
- `heatmap_b64`: opcional. Si no devuelves Grad-CAM, manda `null`.

### 3) Esqueleto de backend (FastAPI)

```python
# server.py
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime
import time

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5500"],
    allow_methods=["*"], allow_headers=["*"],
)

@app.post("/predict")
async def predict(file: UploadFile = File(...), model_id: str = Form("resnet50")):
    t0 = time.time()
    img_bytes = await file.read()

    # 1) Pre-procesa la imagen
    # 2) Carga el modelo según `model_id`
    # 3) Inferencia → clase, prob
    # 4) (Opcional) Grad-CAM → PNG en base64

    clase, prob, heatmap_b64 = run_inference(img_bytes, model_id)
    return {
        "clase": clase,
        "prob": float(prob),
        "latencia_ms": int((time.time() - t0) * 1000),
        "heatmap_b64": heatmap_b64,
        "modelo": f"{model_id}_v0.4.2",
        "modelId": model_id,
        "timestamp": datetime.utcnow().isoformat() + "Z",
    }
```

Levantar:

```bash
pip install fastapi uvicorn python-multipart
uvicorn server:app --reload --port 8000
```

### 4) CORS

Si frontend y backend están en orígenes distintos (5500 vs 8000), habilita CORS como en el ejemplo. Alternativa: sirve el frontend desde el mismo backend (FastAPI `StaticFiles`) y deja `API_BASE_URL: ""`.

### 5) Catálogo de modelos

Edita `js/models.js` para que coincidan los `id` con los que recibe tu backend en `model_id`. Las métricas mostradas (accuracy, AUC, latencia, etc.) viven aquí — actualízalas con los valores reales de tu validación.

## Notas

- El archivo original `EndoScan AI - H. pylori (1).html` queda intacto; puedes borrarlo cuando confirmes que `index.html` funciona.
- Se eliminó la dependencia de Babel (no se usaba JSX, todo es `React.createElement`). Carga más rápida y compatible con producción.
- React se carga en versión `production.min` desde unpkg. Para uso offline copia los `.js` a `vendor/` y cambia los `<script src="...">` en `index.html`.
