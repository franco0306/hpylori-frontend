// Buscador de pacientes por código de historia clínica.
//
// Sustituye al campo de texto libre: mientras el médico escribe, ofrece sus
// pacientes (exacto, parcial o parecido) para que elija en vez de teclear de
// nuevo. Así "HC-2026-104" no acaba registrado tres veces con tres grafías, y
// un error de tipeo ("HC-2026-140") se detecta antes de crear otro paciente.
//
// Si el médico escribe un código y no elige nada, se usa tal cual: el servidor
// lo vincula al paciente existente o lo crea al guardar el estudio.

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { I } from "../icons.js";
import { searchPatients, createPatient, generatePatient } from "../patients.js";
import { normalizarCodigo, validarCodigoPaciente } from "../validacion.js";

function fmtFecha(iso) {
  if (!iso) return null;
  const d = new Date(/[Zz]$|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + "Z");
  return Number.isNaN(d.getTime()) ? null
    : d.toLocaleDateString("es-PE", { day: "2-digit", month: "short", year: "numeric" });
}

function resumen(p) {
  if (!p.estudios) return "Sin estudios todavía";
  return p.estudios + " estudio" + (p.estudios === 1 ? "" : "s") +
    (p.positivos ? " · " + p.positivos + " positivo" + (p.positivos === 1 ? "" : "s") : "") +
    (p.ultimo_estudio ? " · último " + fmtFecha(p.ultimo_estudio) : "");
}

export function PatientPicker({
  inputId = "patient-id", value, onTextChange, selected, onSelect, disabled = false,
  placeholder = "Ej: HC-2026-104", describedBy, error: errorExterno = null, inputRef: refExterna,
}) {
  const [abierto, setAbierto] = useState(false);
  const [datos, setDatos] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [activo, setActivo] = useState(-1);
  const [trabajando, setTrabajando] = useState(false);
  const [errorAccion, setErrorAccion] = useState(null);
  const [tocado, setTocado] = useState(false);
  const raiz = useRef(null);

  const texto = value || "";
  const clave = normalizarCodigo(texto);
  const motivo = texto.trim() ? validarCodigoPaciente(texto) : null;

  // Búsqueda con espera corta: no se consulta en cada pulsación.
  useEffect(() => {
    let vivo = true;
    const t = setTimeout(() => {
      setBuscando(true);
      searchPatients(motivo ? "" : texto.trim(), 8)
        .then((r) => { if (vivo) setDatos(r); })
        .catch(() => { if (vivo) setDatos({ items: [], exacto: null, total: 0 }); })
        .finally(() => { if (vivo) setBuscando(false); });
    }, texto.trim() ? 220 : 0);
    return () => { vivo = false; clearTimeout(t); };
  }, [texto, motivo]);

  // Escribir el código exacto de un paciente existente lo vincula solo.
  useEffect(() => {
    const exacto = datos && datos.exacto;
    if (exacto && (!selected || selected.id !== exacto.id) && normalizarCodigo(exacto.codigo) === clave) {
      onSelect(exacto);
    }
  }, [datos, clave]);

  // Si el texto deja de corresponder al paciente elegido, se desvincula.
  useEffect(() => {
    if (selected && normalizarCodigo(selected.codigo) !== clave) onSelect(null);
  }, [clave]);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (raiz.current && !raiz.current.contains(e.target)) setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  const items = (datos && datos.items) || [];
  const exacto = datos && datos.exacto;
  const coinciden = texto.trim() ? items.filter((p) => p.coincidencia !== "similar") : items;
  const parecidos = texto.trim() && !exacto ? items.filter((p) => p.coincidencia === "similar") : [];
  const puedeCrear = texto.trim() && !motivo && !exacto;

  // Opciones navegables con el teclado, en el orden en que se pintan.
  const opciones = useMemo(() => {
    const lista = [];
    coinciden.forEach((p) => lista.push({ tipo: "paciente", p }));
    parecidos.forEach((p) => lista.push({ tipo: "paciente", p }));
    if (puedeCrear) lista.push({ tipo: "crear" });
    lista.push({ tipo: "generar" });
    return lista;
  }, [datos, texto, motivo]);

  const elegir = (p) => {
    onTextChange(p.codigo);
    onSelect(p);
    setAbierto(false);
    setErrorAccion(null);
  };

  const crear = async () => {
    setTrabajando(true); setErrorAccion(null);
    try {
      const r = await createPatient(texto.trim());
      elegir(r.paciente);
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setTrabajando(false);
    }
  };

  const generar = async () => {
    setTrabajando(true); setErrorAccion(null);
    try {
      const r = await generatePatient();
      elegir(r.paciente);
    } catch (e) {
      setErrorAccion(e.message);
    } finally {
      setTrabajando(false);
    }
  };

  const ejecutar = (op) => {
    if (!op) return;
    if (op.tipo === "paciente") elegir(op.p);
    else if (op.tipo === "crear") crear();
    else if (op.tipo === "generar") generar();
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault(); setAbierto(true);
      setActivo((i) => Math.min(opciones.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault(); setActivo((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && abierto && activo >= 0) {
      e.preventDefault(); ejecutar(opciones[activo]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const idLista = inputId + "-opciones";
  let indice = -1;
  const opcionPaciente = (p) => {
    indice += 1;
    const i = indice;
    return (
      <li key={"p" + p.id} id={idLista + "-" + i} role="option" aria-selected={activo === i}
          className={"pp-opcion" + (activo === i ? " is-activa" : "")}
          onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActivo(i)}
          onClick={() => elegir(p)}>
        <span className={"pp-avatar" + (p.positivos ? " is-pos" : "")}><I.user size={14} /></span>
        <span className="pp-opcion-txt">
          <span className="pp-codigo">{p.codigo}</span>
          <span className="pp-meta">{resumen(p)}</span>
        </span>
        {p.coincidencia === "exacta" && <span className="badge badge-neg">Este paciente</span>}
      </li>
    );
  };

  return (
    <div className="pp" ref={raiz}>
      <div className="input-icon-wrap">
        <span className="input-icon"><I.user size={15} /></span>
        <input
          id={inputId}
          ref={refExterna}
          aria-required="true"
          className={"input field-input pp-input" + ((motivo && tocado) || errorExterno ? " is-error" : "")}
          type="text"
          value={texto}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          role="combobox"
          aria-expanded={abierto}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-activedescendant={abierto && activo >= 0 ? idLista + "-" + activo : undefined}
          aria-describedby={describedBy}
          aria-invalid={motivo && tocado ? "true" : undefined}
          onChange={(e) => { onTextChange(e.target.value); setAbierto(true); setActivo(-1); setErrorAccion(null); }}
          onFocus={() => setAbierto(true)}
          onBlur={() => setTocado(true)}
          onKeyDown={onKeyDown}
        />
        {buscando && <span className="pp-cargando spinner-sm" aria-hidden="true" />}
      </div>

      <AnimatePresence>
        {abierto && !disabled && (
          <motion.ul
            id={idLista}
            role="listbox"
            className="pp-lista"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
          >
            {coinciden.length > 0 && (
              <li className="pp-grupo" role="presentation">
                {texto.trim() ? "Sus pacientes" : "Pacientes recientes"}
              </li>
            )}
            {coinciden.map(opcionPaciente)}

            {parecidos.length > 0 && (
              <li className="pp-grupo pp-grupo-aviso" role="presentation">
                <I.alert size={12} /> ¿Quiso decir…? Códigos parecidos
              </li>
            )}
            {parecidos.map(opcionPaciente)}

            {!buscando && texto.trim() && !coinciden.length && !parecidos.length && !motivo && (
              <li className="pp-vacio" role="presentation">No tiene ningún paciente con ese código.</li>
            )}
            {datos && !datos.total && !texto.trim() && (
              <li className="pp-vacio" role="presentation">Aún no tiene pacientes registrados.</li>
            )}

            <li className="pp-separador" role="presentation" />
            {puedeCrear && (() => {
              indice += 1;
              const i = indice;
              return (
                <li id={idLista + "-" + i} role="option" aria-selected={activo === i}
                    className={"pp-opcion pp-accion" + (activo === i ? " is-activa" : "")}
                    onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActivo(i)} onClick={crear}>
                  <span className="pp-avatar is-nuevo"><I.plus size={14} /></span>
                  <span className="pp-opcion-txt">
                    <span className="pp-codigo">Crear paciente «{texto.trim().toUpperCase()}»</span>
                    <span className="pp-meta">
                      {parecidos.length ? "Compruebe antes que no sea uno de los anteriores" : "Nuevo código de historia clínica"}
                    </span>
                  </span>
                </li>
              );
            })()}
            {(() => {
              indice += 1;
              const i = indice;
              return (
                <li id={idLista + "-" + i} role="option" aria-selected={activo === i}
                    className={"pp-opcion pp-accion" + (activo === i ? " is-activa" : "")}
                    onMouseDown={(e) => e.preventDefault()} onMouseEnter={() => setActivo(i)} onClick={generar}>
                  <span className="pp-avatar is-anonimo"><I.shield size={14} /></span>
                  <span className="pp-opcion-txt">
                    <span className="pp-codigo">Generar código anónimo</span>
                    <span className="pp-meta">Para pacientes sin historia clínica (ej. EP-7K3F2)</span>
                  </span>
                </li>
              );
            })()}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Estado bajo el campo: con quién quedará asociado el estudio. */}
      {errorExterno && !texto.trim() ? (
        <div className="pp-estado is-error" role="alert"><I.alert size={12} />{errorExterno}</div>
      ) : motivo && (tocado || texto.trim().length > 6) ? (
        <div className="pp-estado is-error" role="alert"><I.alert size={12} />{motivo}</div>
      ) : errorAccion ? (
        <div className="pp-estado is-error" role="alert"><I.alert size={12} />{errorAccion}</div>
      ) : selected ? (
        <div className="pp-estado is-ok">
          <I.check size={12} />
          <span><strong>{selected.codigo}</strong> · {resumen(selected)}</span>
        </div>
      ) : texto.trim() && !motivo ? (
        <div className="pp-estado is-nuevo">
          <I.info size={12} />
          <span>Paciente nuevo: se registrará <strong>{texto.trim().toUpperCase()}</strong> al guardar el estudio.</span>
        </div>
      ) : null}
      {trabajando && <span className="sr-only" role="status">Procesando…</span>}
    </div>
  );
}

/** Código a enviar al guardar: el del paciente elegido o el texto escrito. */
export function codigoPaciente(texto, seleccionado) {
  if (seleccionado) return seleccionado.codigo;
  return (texto || "").trim();
}
