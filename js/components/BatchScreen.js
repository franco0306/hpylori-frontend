import { I } from "../icons.js";
import { SAMPLES } from "../samples.js";
import { CONFIG } from "../config.js";

const React = window.React;
const { useState, useRef } = React;
const h = React.createElement;

export function BatchScreen({ model, threshold }) {
  const [items, setItems] = useState([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [rejected, setRejected] = useState(0);
  const inputRef = useRef(null);

  const acceptFiles = (fileList) => {
    setRejected(0);
    const files = Array.from(fileList).slice(0, 50);
    const valid = [];
    let rejectedCount = 0;

    for (const f of files) {
      const validFormat = CONFIG.ACCEPTED_MIME.includes(f.type);
      const validSize = f.size <= CONFIG.MAX_FILE_MB * 1024 * 1024;
      if (!validFormat || !validSize) { rejectedCount++; continue; }
      valid.push(f);
    }

    if (rejectedCount) setRejected(rejectedCount);
    if (!valid.length) return;

    setItems(valid.map((f, i) => ({
      id: "ITM-" + (1000 + i),
      name: f.name,
      size: f.size,
      status: "queued",
      thumb: URL.createObjectURL(f),
      file: f,
      _demo: false,
    })));
  };

  const loadDemo = () => {
    const ks = ["pos1", "neg1", "pos2", "neg2", "pos1", "neg1", "pos2", "neg2", "pos1", "neg1", "pos2", "neg2"];
    setItems(ks.map((k, i) => ({
      id: "ITM-" + (1000 + i),
      name: "case_" + (1000 + i) + ".jpg",
      size: (1 + Math.random() * 4) * 1024 * 1024,
      status: "queued",
      thumb: SAMPLES[k].src,
      file: null,
      _demo: true,
    })));
  };

  const run = async () => {
    setRunning(true);
    for (const it of items) {
      if (it.status !== "queued") continue;
      setItems((prev) => prev.map((p) => p.id === it.id ? { ...p, status: "running" } : p));

      try {
        const fd = new FormData();

        if (it.file) {
          // imagen real subida por el usuario
          fd.append("file", it.file, it.name);
        } else if (it._demo && it.thumb) {
          // imagen de demo (data URL base64)
          const res = await fetch(it.thumb);
          const blob = await res.blob();
          fd.append("file", blob, it.name || "demo.jpg");
        }

        fd.append("model_id", model.id);
        if (threshold !== undefined && threshold !== null) {
          fd.append("threshold", String(threshold));
        }

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), CONFIG.REQUEST_TIMEOUT_MS);

        const start = performance.now();
        let res;
        try {
          res = await fetch(CONFIG.API_BASE_URL + CONFIG.PREDICT_PATH, {
            method: "POST",
            body: fd,
            signal: ctrl.signal,
          });
        } finally {
          clearTimeout(timer);
        }

        if (!res.ok) throw new Error("HTTP_" + res.status);
        const data = await res.json();
        const ms = Math.round(performance.now() - start);

        setItems((prev) => prev.map((p) =>
          p.id === it.id
            ? { ...p, status: "done", clase: data.clase, prob: data.prob, latencia: data.latencia_ms || ms }
            : p
        ));
      } catch (e) {
        const errorMsg = e.name === "AbortError" ? "API_TIMEOUT" : (e.message || "Error desconocido");
        setItems((prev) => prev.map((p) =>
          p.id === it.id ? { ...p, status: "done", clase: "Error", prob: 0, latencia: 0, errorMsg } : p
        ));
      }
    }
    setRunning(false);
  };

  // Encierra en comillas los campos con coma, comilla o salto de línea (CSV RFC 4180).
  const csvField = (v) => {
    const s = String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };

  const exportCSV = () => {
    const rows = [["id", "archivo", "modelo", "clase", "prob", "latencia_ms", "estado"]];
    items.forEach((i) => rows.push([
      i.id, i.name, model.name + "_" + model.version,
      i.clase || "", i.prob || "", i.latencia || "", i.status,
    ]));
    const blob = new Blob([rows.map((r) => r.map(csvField).join(",")).join("\n")], { type: "text/csv" });
    const u = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = u; a.download = "lote.csv"; a.click();
    URL.revokeObjectURL(u);
  };

  const total = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const queued = items.filter((i) => i.status === "queued").length;
  const positives = items.filter((i) => i.clase === "Positivo").length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const filt = items.filter((i) =>
    filter === "all" ||
    (filter === "pos" && i.clase === "Positivo") ||
    (filter === "neg" && i.clase === "Negativo")
  );

  return h("div", { className: "content" },
    h("div", { className: "page-header" },
      h("div", null,
        h("h1", { className: "page-title" }, "Procesamiento por lote"),
        h("div", { className: "page-sub" },
          "HU-003 · Hasta 50 imágenes · Modelo: ", h("strong", null, model.name)),
      ),
      h("div", { className: "row", style: { gap: 8 } },
        h("button", { className: "btn btn-secondary", onClick: exportCSV, disabled: !done },
          h(I.dl, { size: 14 }), "Exportar CSV"),
        h("button", {
          className: "btn btn-primary", onClick: run, disabled: !queued || running,
        },
          running ? h("span", { className: "spinner-sm" }) : h(I.bact, { size: 14 }),
          running ? " Procesando…" : " Procesar " + queued + " imagen" + (queued === 1 ? "" : "es")),
      ),
    ),
    h("div", { className: "kpi-grid", style: { gridTemplateColumns: "repeat(5,1fr)", marginBottom: 20 } },
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Total"),
        h("div", { className: "kpi-value" }, total, h("small", null, "/50"))),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "En cola"),
        h("div", { className: "kpi-value", style: { color: "var(--ink-500)" } }, queued)),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Completadas"),
        h("div", { className: "kpi-value" }, done)),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Positivos"),
        h("div", { className: "kpi-value", style: { color: "var(--red-600)" } }, positives)),
      h("div", { className: "kpi" },
        h("div", { className: "kpi-label" }, "Avance"),
        h("div", { className: "kpi-value" }, pct + "%")),
    ),
    !total && h("div", { className: "card" },
      h("div", { style: { padding: 20 } },
        h("div", {
          "data-dropzone": true, className: "dropzone",
          onClick: () => inputRef.current && inputRef.current.click(),
          onDragOver: (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; },
          onDrop: (e) => {
            e.preventDefault(); e.stopPropagation();
            acceptFiles(e.dataTransfer.files || []);
          },
        },
          h("div", { className: "dropzone-icon" }, h(I.layers, { size: 22 })),
          h("div", { className: "dropzone-title" }, "Arrastra hasta 50 imágenes aquí"),
          h("div", { className: "dropzone-sub" },
            "o ", h("span", { className: "linklike" }, "selecciona archivos")),
          h("input", {
            ref: inputRef, type: "file", multiple: true,
            accept: "image/jpeg,image/png", hidden: true,
            onChange: (e) => acceptFiles(e.target.files || []),
          }),
          rejected > 0 && h("div", { className: "alert alert-error", style: { marginTop: 12, textAlign: "left" } },
            h(I.alert, { size: 16 }),
            h("div", null,
              h("strong", null, "Formato inválido. "),
              rejected + " archivo" + (rejected === 1 ? "" : "s") + " " + (rejected === 1 ? "fue rechazado" : "fueron rechazados") +
                " — solo se admiten imágenes JPG o PNG de hasta " + CONFIG.MAX_FILE_MB + " MB.",
            ),
          ),
          h("button", {
            className: "btn btn-ghost", style: { marginTop: 12 },
            onClick: (e) => { e.stopPropagation(); loadDemo(); },
          }, h(I.plus, { size: 14 }), "Cargar 12 imágenes de demostración"),
        ),
      ),
    ),
    total > 0 && h("div", { className: "card" },
      h("div", { className: "card-head" },
        h("div", { className: "row", style: { gap: 8 } },
          h("h3", { className: "card-title" }, "Resultados"),
          h("span", { className: "badge badge-neutral" }, filt.length),
        ),
        h("div", { className: "row", style: { gap: 6 } },
          ...[["all", "Todos"], ["pos", "Positivos"], ["neg", "Negativos"]].map(([key, lbl]) =>
            h("button", {
              key, className: "btn " + (filter === key ? "btn-secondary" : "btn-ghost"),
              style: { padding: "6px 10px", fontSize: 12 },
              onClick: () => setFilter(key),
            }, lbl)),
        ),
      ),
      h("div", { style: { padding: "0 20px 18px" } },
        h("div", { className: "progress", style: { marginTop: 14 } },
          h("div", { className: "progress-fill", style: { width: pct + "%" } })),
      ),
      h("table", { className: "table" },
        h("thead", null, h("tr", null,
          h("th", null, "#"),
          h("th", null, "Archivo"),
          h("th", null, "Estado"),
          h("th", null, "Resultado"),
          h("th", null, "Prob."),
          h("th", null, "Latencia"),
        )),
        h("tbody", null, ...filt.map((it, idx) =>
          h("tr", { key: it.id },
            h("td", { className: "mono muted" }, String(idx + 1).padStart(2, "0")),
            h("td", null,
              h("div", { className: "row", style: { gap: 10 } },
                it.thumb ? h("img", { className: "thumb", src: it.thumb }) : h("div", { className: "thumb" }),
                h("div", null,
                  h("div", { style: { fontWeight: 500, fontSize: 13 } }, it.name),
                  h("div", { className: "mono muted", style: { fontSize: 11 } }, (it.size / 1024 / 1024).toFixed(2) + " MB"),
                ),
              )),
            h("td", null,
              it.status === "queued"  && h("span", { className: "mono muted", style: { fontSize: 12 } }, "● en cola"),
              it.status === "running" && h("span", { className: "row", style: { gap: 6, fontSize: 12, color: "var(--blue-700)" } },
                h("span", { className: "spinner-sm" }), "procesando"),
              it.status === "done"    && h("span", { className: "row", style: { gap: 6, fontSize: 12 } },
                h(I.check, { size: 12 }), "completado"),
            ),
            h("td", null,
              it.clase === "Positivo" && h("span", { className: "badge badge-pos" }, "POSITIVO"),
              it.clase === "Negativo" && h("span", { className: "badge badge-neg" }, "NEGATIVO"),
              it.clase === "Error"    && h("span", { className: "badge badge-warn", title: it.errorMsg || "" }, "ERROR"),
              !it.clase && h("span", { className: "muted" }, "—"),
            ),
            h("td", { className: "mono" },
              it.prob != null && it.prob > 0 ? (it.prob * 100).toFixed(1) + "%" : h("span", { className: "muted" }, "—")),
            h("td", { className: "mono muted" }, it.latencia ? it.latencia + " ms" : "—"),
          )
        )),
      ),
    ),
  );
}