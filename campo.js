import { firmar, obtenerFirmante, kvGet, kvSet } from "./firma.js";
const $ = (id) => document.getElementById(id);
const TOPE_OFFLINE = 200; // tope local de pagos sin liquidar por este pagador (unidades de prueba)
const q = new URLSearchParams(location.search);
let worker = null, inicio = 0, timer = null, muestras = [], ultimo = { tareas: 0, ocupadoMs: 0, t: 0 }, stats = {}, wake = null, desastre = false, bat = null;
const R = { version: 1, app: "campo-celula", eventos: [] };
const ev = (tipo, extra = {}) => R.eventos.push({ t: Date.now(), tipo, ...extra });
const online = () => !desastre && navigator.onLine;
const fmt = (s) => { s = Math.floor(s); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };

async function initBateria() {
  if (!navigator.getBattery) { $("bateria").textContent = "no disponible"; $("carga").textContent = "no disponible"; return; }
  try { bat = await navigator.getBattery(); const u = () => { $("bateria").textContent = Math.round(bat.level * 100) + "%"; $("carga").textContent = bat.charging ? "sí" : "no"; };
    u(); bat.addEventListener("levelchange", u); bat.addEventListener("chargingchange", () => { u(); ev("carga", { cargando: bat.charging }); }); } catch { $("bateria").textContent = "no disponible"; }
}
async function pedirWake() {
  if (!("wakeLock" in navigator)) { $("wake").textContent = "sin wake lock"; return; }
  try { wake = await navigator.wakeLock.request("screen"); $("wake").textContent = "encendida 🔒"; wake.addEventListener("release", () => { $("wake").textContent = "liberada"; ev("wake_liberado"); }); }
  catch (e) { $("wake").textContent = "rechazado"; ev("wake_error", { msg: String(e.message || e) }); }
}
document.addEventListener("visibilitychange", () => { ev("visibilidad", { estado: document.visibilityState }); if (document.visibilityState === "visible" && worker && (!wake || wake.released)) pedirWake(); });
const pintarRed = () => { $("red").textContent = online() ? "en línea" : (desastre ? "DESASTRE" : "sin red"); };
addEventListener("online", () => { ev("red", { online: true }); pintarRed(); }); addEventListener("offline", () => { ev("red", { online: false }); pintarRed(); });

function cfg() { return { modo: $("modo").value, activoSeg: +$("activoSeg").value || 20, reposoSeg: +$("reposoSeg").value || 40, ingestaPorSeg: +$("ingesta").value || 5, desastre }; }
async function iniciar() {
  if (worker) return;
  R.dispositivo = { nombre: $("nombre").value || "sin-nombre", ua: navigator.userAgent, nucleos: navigator.hardwareConcurrency || null, pantalla: `${screen.width}x${screen.height}` };
  R.config = cfg(); R.inicio = Date.now(); R.bateriaApi = !!bat; R.bateriaManualInicio = $("batIni").value === "" ? null : +$("batIni").value; muestras = R.muestras = []; R.eventos = [];
  ev("inicio", { modo: R.config.modo }); localStorage.setItem("campo-nombre", R.dispositivo.nombre);
  worker = new Worker("celula-worker.js"); worker.onmessage = (e) => { if (e.data.tipo === "stats") stats = e.data; };
  worker.postMessage({ tipo: "iniciar", cfg: R.config }); inicio = performance.now(); ultimo = { tareas: 0, ocupadoMs: 0, t: inicio };
  await pedirWake(); $("estado").textContent = "corriendo"; timer = setInterval(actualizar, 1000);
}
let n = 0;
function actualizar() {
  const now = performance.now(), dt = (now - ultimo.t) / 1000 || 1, s = stats;
  if (s.tareas === undefined) return;
  const tps = (s.tareas - ultimo.tareas) / dt, cpu = Math.min(100, ((s.ocupadoMs - ultimo.ocupadoMs) / (dt * 1000)) * 100);
  $("tiempo").textContent = fmt((now - inicio) / 1000); $("tareas").textContent = s.tareas.toLocaleString("es"); $("tps").textContent = tps.toFixed(1); $("cpu").textContent = cpu.toFixed(0) + "%";
  $("estado").textContent = s.activo ? "activa 🚆" : "reposo 💤"; $("cola").textContent = Math.max(0, Number(s.cola) || 0); pintarRed();
  if (++n % 5 === 0 || muestras.length === 0) { // muestra cada 5 s
    muestras.push({ t: Date.now(), seg: Math.round((now - inicio) / 1000), tareas: s.tareas, tps: +tps.toFixed(2), cpu: +cpu.toFixed(1), activo: s.activo, cola: s.cola,
      bateria: bat ? Math.round(bat.level * 1000) / 10 : null, cargando: bat ? bat.charging : null, online: online(), desastre, wake: !!(wake && !wake.released), visible: document.visibilityState });
    kvSet("ultimo-resultado", resultado()).catch(() => {});
  }
  ultimo = { tareas: s.tareas, ocupadoMs: s.ocupadoMs, t: now };
}
function parar() { if (!worker) return; worker.postMessage({ tipo: "parar" }); worker.terminate(); worker = null; clearInterval(timer); actualizar(); ev("fin"); R.fin = Date.now(); $("estado").textContent = "parado"; if (wake) wake.release().catch(() => {}); }
function resultado() { R.bateriaManualFin = $("batFin").value === "" ? null : +$("batFin").value; R.fin = R.fin || Date.now(); R.tareasTotal = stats.tareas || 0; R.duracionSeg = Math.round(((R.fin) - (R.inicio || R.fin)) / 1000); R.intenciones = intents; return R; }
const json = () => JSON.stringify(resultado(), null, 1), nombreArchivo = () => `campo-${(R.dispositivo?.nombre || "celula").replace(/\W+/g, "_")}-${R.config?.modo || ""}-${new Date().toISOString().slice(0, 16).replace(/:/g, "")}.json`;
$("iniciar").onclick = iniciar; $("parar").onclick = parar;
$("modo").onchange = () => worker?.postMessage({ tipo: "config", cfg: cfg() });
$("desastre").onclick = () => { desastre = !desastre; $("desastre").classList.toggle("on", desastre); $("desastre").textContent = desastre ? "✔ Terminar desastre (volver red)" : "⚠ Simular desastre";
  ev("desastre", { activo: desastre }); worker?.postMessage({ tipo: "config", cfg: { desastre } }); pintarRed(); };
$("copiar").onclick = async () => { try { await navigator.clipboard.writeText(json()); $("log").textContent = "JSON copiado ✔"; } catch { $("log").textContent = "No se pudo copiar; usa Descargar o Compartir."; } };
$("descargar").onclick = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([json()], { type: "application/json" })); a.download = nombreArchivo(); a.click(); $("log").textContent = "Descargado: " + a.download; };
$("compartir").onclick = async () => { const f = new File([json()], nombreArchivo(), { type: "application/json" });
  try { if (navigator.canShare?.({ files: [f] })) await navigator.share({ files: [f], title: "Resultado célula" }); else await navigator.share({ text: json() }); } catch (e) { $("log").textContent = "Compartir no disponible: " + (e.message || e); } };

// ---- pagos sin conexión ----
let intents = [];
async function guardar() { await kvSet("intenciones", intents); }
const pendiente = () => intents.filter((i) => i.estado === "en_cola").reduce((a, i) => a + i.monto, 0);
async function nuevoPago(dup = false) {
  const f = await obtenerFirmante(); const monto = +$("monto").value || 0;
  if (!dup && pendiente() + monto > TOPE_OFFLINE) { $("pagosNota").textContent = `Rechazado local: supera el tope offline (${TOPE_OFFLINE}).`; return; }
  const ultimoSeq = intents.reduce((m, i) => Math.max(m, i.seq), 0);
  const it = await firmar({ v: 1, from: f.pub, to: $("destino").value || "comercio-A", monto, nonce: crypto.getRandomValues(new Uint32Array(2)).join(""), seq: dup ? Math.max(1, ultimoSeq) : ultimoSeq + 1, expira: Date.now() + 24 * 3600e3, creada: Date.now() });
  it.estado = "en_cola"; it.offline = !online(); intents.push(it); await guardar(); ev("intencion", { seq: it.seq, monto, offline: it.offline, dup });
  $("pagosNota").textContent = `Firmado (${it.alg}) seq ${it.seq} · ${intents.filter((i) => i.estado === "en_cola").length} en cola · pendiente ${pendiente()}/${TOPE_OFFLINE}`;
}
$("pagar").onclick = () => nuevoPago(false); $("doble").onclick = () => nuevoPago(true);
$("liquidar").onclick = async () => {
  if (!online()) { $("pagosNota").textContent = "Sin red (desastre): se quedan guardados. XRPL no liquida sin conexión."; return; }
  const cola = intents.filter((i) => i.estado === "en_cola"); if (!cola.length) { $("pagosNota").textContent = "Nada en cola."; return; }
  const base = ($("servidor").value || "").replace(/\/$/, "");
  try { const r = await fetch(base + "/api/campo/liquidar", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intenciones: cola.map(({ estado, offline, ...x }) => x) }) });
    if (!r.ok) throw new Error("HTTP " + r.status); const j = await r.json();
    for (const x of j.resultados) { const i = intents.find((k) => k.nonce === x.nonce); if (i) { i.estado = x.ok ? "aceptada" : "rechazada"; i.motivo = x.motivo; } }
    await guardar(); ev("liquidacion", { n: j.resultados.length }); $("pagosNota").textContent = j.resultados.map((x) => `seq ${x.seq}: ${x.ok ? "✔" : "✘ " + x.motivo}`).join(" · ");
  } catch (e) { $("pagosNota").textContent = "No hay servidor de liquidación aquí (" + (e.message || e) + "). En GitHub Pages es normal: exporta el JSON."; }
};
(async () => { intents = (await kvGet("intenciones")) || []; $("nombre").value = localStorage.getItem("campo-nombre") || ""; await initBateria(); pintarRed();
  if (q.get("modo")) $("modo").value = q.get("modo"); if (q.get("activo")) $("activoSeg").value = q.get("activo"); if (q.get("reposo")) $("reposoSeg").value = q.get("reposo");
  window.__campo = { resultado, iniciar, parar };
})();
