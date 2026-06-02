// Catálogo de modelos reales entrenados en Google Colab T4
// Métricas obtenidas en el set de validación (n=2,047 imágenes)

export const MODELS = [
  {
    id: "resnet50",
    name: "ResNet50",
    version: "v1.0",
    arch: "CNN · 23.5M params",
    recommended: true,
    metrics: {
      accuracy:    0.8813,
      sensitivity: 0.8733,
      specificity: 0.8813,
      auc:         0.9200,
      latency_ms:  68,
      model_mb:    98,
    },
    desc: "Arquitectura residual de 23.5M parámetros. Mejor rendimiento diagnóstico con Accuracy 88.13% y Recall 87.33%. Seleccionado como modelo de producción por su capacidad de detectar casos positivos de H. pylori sin sacrificar especificidad.",
  },
  {
    id: "mobilenetv3",
    name: "MobileNetV3",
    version: "v1.0",
    arch: "CNN · 4.2M params",
    metrics: {
      accuracy:    0.8803,
      sensitivity: 0.8154,
      specificity: 0.8803,
      auc:         0.9100,
      latency_ms:  22,
      model_mb:    22,
    },
    desc: "Arquitectura ligera de 4.2M parámetros. El más rápido del benchmarking con solo 22ms de inferencia. Accuracy 88.03% y Recall 81.54%. Ideal para procesamiento por lote en entornos con recursos computacionales limitados.",
  },
  {
    id: "efficientnetb0",
    name: "EfficientNetB0",
    version: "v1.0",
    arch: "CNN · 4.0M params",
    metrics: {
      accuracy:    0.8735,
      sensitivity: 0.8181,
      specificity: 0.8735,
      auc:         0.9050,
      latency_ms:  28,
      model_mb:    20,
    },
    desc: "Arquitectura de 4.0M parámetros con compound scaling. Accuracy 87.35% y Recall 81.81%. Mejor balance entre velocidad (28ms) y tamaño de modelo (20MB). Opción recomendada para despliegues con memoria limitada.",
  },
  {
    id: "densenet121",
    name: "DenseNet121",
    version: "v1.0",
    arch: "CNN · 8.0M params",
    metrics: {
      accuracy:    0.8691,
      sensitivity: 0.7628,
      specificity: 0.8691,
      auc:         0.9140,
      latency_ms:  105,
      model_mb:    27,
    },
    desc: "Arquitectura densamente conectada de 8.0M parámetros. Cada capa recibe feature maps de todas las capas anteriores, mejorando la propagación del gradiente. Accuracy 86.91%, Recall 76.28% y F1 80.86%. Modelo compacto (27 MB) con buena precisión general.",
  },
  {
    id: "googlenet",
    name: "GoogLeNet",
    version: "v1.0",
    arch: "CNN · 6.8M params",
    metrics: {
      accuracy:    0.8359,
      sensitivity: 0.7938,
      specificity: 0.8359,
      auc:         0.8810,
      latency_ms:  55,
      model_mb:    22,
    },
    desc: "Arquitectura Inception de 6.8M parámetros. Usa módulos en paralelo para capturar patrones a múltiples escalas. Accuracy 83.59%, Recall 79.38% y F1 77.81%. El más ligero (22 MB) y el de mejor recall entre los 3 nuevos modelos.",
  },
  {
    id: "vgg16",
    name: "VGG16",
    version: "v1.0",
    arch: "CNN · 138M params",
    metrics: {
      accuracy:    0.8012,
      sensitivity: 0.6388,
      specificity: 0.8012,
      auc:         0.8460,
      latency_ms:  185,
      model_mb:    512,
    },
    desc: "Arquitectura profunda de 138M parámetros con 16 capas convolucionales. Accuracy 80.12%, Recall 63.88% y F1 69.96%. El de mayor tamaño del conjunto (512 MB) y el de menor sensibilidad — entrenamiento inestable en las primeras épocas evidenciado en las curvas.",
  },
];

export const findModel = (id) => MODELS.find((m) => m.id === id) || MODELS[0];
