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
    desc: "Modelo seleccionado. Mejor recall (87.33%) — crítico para no perder casos positivos de H. pylori.",
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
    desc: "Modelo más rápido y liviano. Ideal para procesamiento por lote en entornos con recursos limitados.",
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
    desc: "Mejor balance entre velocidad y precisión. Compound scaling optimizado para imágenes médicas.",
  },
];

export const findModel = (id) => MODELS.find((m) => m.id === id) || MODELS[0];