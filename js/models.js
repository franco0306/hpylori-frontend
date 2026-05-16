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
      model_mb:    98
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
      model_mb:    22
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
      model_mb:    20
    },
    desc: "Arquitectura de 4.0M parámetros con compound scaling. Accuracy 87.35% y Recall 81.81%. Mejor balance entre velocidad (28ms) y tamaño de modelo (20MB). Opción recomendada para despliegues con memoria limitada.",
  },
];

export const findModel = (id) => MODELS.find((m) => m.id === id) || MODELS[0];