// Imágenes endoscópicas reales de prueba.
// Servidas estáticamente desde samples/img/ por el mismo servidor HTTP.
// IMPORTANTE: No usar en producción con datos de pacientes reales sin anonimizar.

export const SAMPLES = {
  pos1: { src: "samples/img/POSITIVO/p144_f000840.jpg", name: "p144_f000840.jpg", size: 0.5, label: "Positivo" },
  pos2: { src: "samples/img/POSITIVO/p144_f014490.jpg", name: "p144_f014490.jpg", size: 0.5, label: "Positivo" },
  pos3: { src: "samples/img/POSITIVO/p194_f015810.jpg", name: "p194_f015810.jpg", size: 0.5, label: "Positivo" },
  pos4: { src: "samples/img/POSITIVO/p194_f020160.jpg", name: "p194_f020160.jpg", size: 0.5, label: "Positivo" },
  pos5: { src: "samples/img/POSITIVO/p194_f020850.jpg", name: "p194_f020850.jpg", size: 0.5, label: "Positivo" },
  neg1: { src: "samples/img/NEGATIVO/p120_f002670.jpg", name: "p120_f002670.jpg", size: 0.5, label: "Negativo" },
  neg2: { src: "samples/img/NEGATIVO/p122_f000990.jpg", name: "p122_f000990.jpg", size: 0.5, label: "Negativo" },
  neg3: { src: "samples/img/NEGATIVO/p7_f000480.jpg",   name: "p7_f000480.jpg",   size: 0.5, label: "Negativo" },
  neg4: { src: "samples/img/NEGATIVO/p7_f000510.jpg",   name: "p7_f000510.jpg",   size: 0.5, label: "Negativo" },
  neg5: { src: "samples/img/NEGATIVO/p8_f000960.jpg",   name: "p8_f000960.jpg",   size: 0.5, label: "Negativo" },
};
