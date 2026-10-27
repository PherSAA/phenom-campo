// Firma de intenciones de pago offline: WebCrypto Ed25519 si existe (https), si no tweetnacl local (vendor/, sin CDN).
// SOLO TESTNET/SIMULACIÓN: la llave vive en este navegador (IndexedDB). No es dinero real.
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, "0")).join("");
const DB = "campo-celula", ST = "kv";
function idb() { return new Promise((ok, ko) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(ST); r.onsuccess = () => ok(r.result); r.onerror = () => ko(r.error); }); }
export async function kvGet(k) { try { const d = await idb(); return await new Promise((ok) => { const q = d.transaction(ST).objectStore(ST).get(k); q.onsuccess = () => ok(q.result); q.onerror = () => ok(undefined); }); } catch { const v = localStorage.getItem(DB + k); return v ? JSON.parse(v) : undefined; } }
export async function kvSet(k, v) { try { const d = await idb(); await new Promise((ok, ko) => { const t = d.transaction(ST, "readwrite"); t.objectStore(ST).put(v, k); t.oncomplete = ok; t.onerror = () => ko(t.error); }); } catch { localStorage.setItem(DB + k, JSON.stringify(v)); } }
export const mensaje = (i) => `campo-intent:v1|${i.from}|${i.to}|${i.monto}|${i.nonce}|${i.seq}|${i.expira}`;
let firmante = null;
export async function obtenerFirmante() {
  if (firmante) return firmante;
  const g = await kvGet("llave");
  if (g?.tipo === "webcrypto") return (firmante = { tipo: "webcrypto", pub: g.pub, priv: g.priv });
  if (g?.tipo === "nacl") return (firmante = { tipo: "nacl", pub: g.pub, sk: new Uint8Array(g.sk) });
  try {
    if (!crypto.subtle) throw 0;
    const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, false, ["sign", "verify"]);
    const pub = hex(new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey)));
    await kvSet("llave", { tipo: "webcrypto", pub, priv: kp.privateKey }); // CryptoKey no extraíble
    firmante = { tipo: "webcrypto", pub, priv: kp.privateKey };
  } catch {
    const kp = window.nacl.sign.keyPair(); const pub = hex(kp.publicKey);
    await kvSet("llave", { tipo: "nacl", pub, sk: [...kp.secretKey] }); firmante = { tipo: "nacl", pub, sk: kp.secretKey };
  }
  return firmante;
}
export async function firmar(intent) {
  const f = await obtenerFirmante(); const m = new TextEncoder().encode(mensaje(intent));
  const sig = f.tipo === "webcrypto" ? new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, f.priv, m)) : window.nacl.sign.detached(m, f.sk);
  return { ...intent, sig: hex(sig), alg: f.tipo };
}
