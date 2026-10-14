import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { I } from "../icons.js";

// Notificaciones flotantes para confirmaciones pasajeras ("Guardado",
// "Estudio eliminado"). Los errores que exigen una acción siguen siendo
// alertas dentro de la pantalla: un toast se va solo y no debe llevarse un
// problema sin resolver.
//
// API imperativa para el código existente: toast.success("Título", "detalle").

let siguienteId = 1;
let lista = [];
const oyentes = new Set();

function emitir() { oyentes.forEach((fn) => fn(lista)); }

function quitar(id) {
  lista = lista.filter((t) => t.id !== id);
  emitir();
}

function mostrar(tipo, titulo, detalle, duracion = 4200) {
  const id = siguienteId++;
  lista = [...lista.slice(-3), { id, tipo, titulo, detalle, duracion }];
  emitir();
  if (duracion > 0) setTimeout(() => quitar(id), duracion);
  return id;
}

export const toast = {
  success: (t, d, ms) => mostrar("success", t, d, ms),
  error:   (t, d, ms) => mostrar("error", t, d, ms ?? 6500),
  info:    (t, d, ms) => mostrar("info", t, d, ms),
  dismiss: quitar,
};

const ESTILO = {
  success: { icono: I.check, color: "var(--green-600)", fondo: "var(--green-50)" },
  error:   { icono: I.alert, color: "var(--red-600)",   fondo: "var(--red-50)" },
  info:    { icono: I.info,  color: "var(--blue-700)",  fondo: "var(--blue-50)" },
};

export function Toaster() {
  const [items, setItems] = useState(lista);

  useEffect(() => {
    oyentes.add(setItems);
    return () => oyentes.delete(setItems);
  }, []);

  return (
    <div className="tw toaster" aria-live="polite" aria-atomic="false">
      <AnimatePresence initial={false}>
        {items.map((t) => {
          const e = ESTILO[t.tipo] || ESTILO.info;
          const Icono = e.icono;
          return (
            <motion.div
              key={t.id}
              layout
              role={t.tipo === "error" ? "alert" : "status"}
              initial={{ opacity: 0, y: -12, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="toast"
            >
              <span className="toast-icono" style={{ color: e.color, background: e.fondo }}>
                <Icono size={15} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="toast-titulo">{t.titulo}</div>
                {t.detalle && <div className="toast-detalle">{t.detalle}</div>}
              </div>
              <button type="button" className="toast-cerrar" onClick={() => quitar(t.id)}
                      aria-label="Cerrar notificación">
                <I.x size={13} />
              </button>
              {t.duracion > 0 && (
                <motion.span
                  aria-hidden="true"
                  className="toast-barra"
                  style={{ background: e.color }}
                  initial={{ scaleX: 1 }}
                  animate={{ scaleX: 0 }}
                  transition={{ duration: t.duracion / 1000, ease: "linear" }}
                />
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
