import { kvGet } from "./firma.js";
const cls = (e) => (e === "aceptada" || e === true ? "ok" : e === "en_cola" ? "pend" : "no");
const tabla = (rows, cols) => rows.length ? `<table><tr>${cols.map((c) => `<th>${c[0]}</th>`).join("")}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td class="${c[2] ? cls(c[2](r)) : ""}">${String(c[1](r) ?? "")}</td>`).join("")}</tr>`).join("")}</table>` : "<p class='nota'>vacío</p>";
const esc = (s) => String(s).replace(/[<>&]/g, "");
(async () => {
  const l = (await kvGet("intenciones")) || [];
  document.getElementById("local").innerHTML = tabla(l, [["seq", (r) => r.seq], ["monto", (r) => r.monto], ["destino", (r) => esc(r.to)], ["estado", (r) => r.estado + (r.motivo ? " · " + esc(r.motivo) : ""), (r) => r.estado], ["firmado sin red", (r) => (r.offline ? "sí" : "no")]]);
  try { const j = await (await fetch("/api/campo/estado")).json();
    document.getElementById("srv").innerHTML = tabla(j.resultados, [["pagador", (r) => esc(r.from).slice(0, 10) + "…"], ["seq", (r) => r.seq], ["monto", (r) => r.monto], ["resultado", (r) => (r.ok ? "aceptada" : "rechazada · " + esc(r.motivo)), (r) => r.ok]]);
  } catch { document.getElementById("srv").innerHTML = "<p class='nota'>Sin servidor (p. ej. GitHub Pages).</p>"; }
  try { const j = await (await fetch("pagos-e2e.json")).json();
    document.getElementById("e2e").innerHTML = `<p class="nota">${esc(j.fecha)} · pagador ${esc(j.pagador)}</p><h2>Verificación offline (comercio)</h2>` +
      tabla(j.offline, [["caso", (r) => esc(r.caso)], ["comercio", (r) => r.comercio], ["offline", (r) => (r.aceptadaOffline ? "aceptada" : "rechazada · " + esc(r.motivo)), (r) => r.aceptadaOffline]]) +
      "<h2>Liquidación al volver la red</h2>" + tabla(j.liquidacion, [["caso", (r) => esc(r.caso)], ["estado", (r) => r.estado + " · " + esc(r.motivo), (r) => r.estado], ["XRPL", (r) => esc(r.final || r.envio)]]);
  } catch { document.getElementById("e2e").innerHTML = "<p class='nota'>Aún no hay resultado E2E.</p>"; }
})();
