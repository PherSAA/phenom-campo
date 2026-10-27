// Célula de campo: trabajo sha256 en bucle con ciclo tipo metro. Sin dependencias (sha256 en JS puro: funciona en http de red local).
const K = new Uint32Array([0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]);
const W = new Uint32Array(64);
// sha256 de un bloque de 32 bytes (8 palabras) → 8 palabras. Suficiente para trabajo encadenado.
function sha256_32(inp, out) {
  for (let i = 0; i < 8; i++) W[i] = inp[i]; W[8] = 0x80000000; for (let i = 9; i < 15; i++) W[i] = 0; W[15] = 256;
  for (let i = 16; i < 64; i++) { const a = W[i-15], b = W[i-2];
    W[i] = (((a>>>7|a<<25)^(a>>>18|a<<14)^(a>>>3)) + W[i-7] + ((b>>>17|b<<15)^(b>>>19|b<<13)^(b>>>10)) + W[i-16]) | 0; }
  let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
  let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
  for (let i = 0; i < 64; i++) { const t1 = (h + ((e>>>6|e<<26)^(e>>>11|e<<21)^(e>>>25|e<<7)) + ((e&f)^(~e&g)) + K[i] + W[i]) | 0;
    const t2 = (((a>>>2|a<<30)^(a>>>13|a<<19)^(a>>>22|a<<10)) + ((a&b)^(a&c)^(b&c))) | 0; h=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0; }
  out[0]=(h0+a)|0; out[1]=(h1+b)|0; out[2]=(h2+c)|0; out[3]=(h3+d)|0; out[4]=(h4+e)|0; out[5]=(h5+f)|0; out[6]=(h6+g)|0; out[7]=(h7+h)|0;
}
self.sha256_32 = sha256_32;
let cfg = { modo: "siempre", hashesPorTarea: 2000, activoSeg: 20, reposoSeg: 40, minServicio: 0.1, ingestaPorSeg: 5, desastre: false, corriendo: false };
let tareas = 0, ocupadoMs = 0, cola = 0, t0 = 0, estado = new Uint32Array(8).fill(1), tmp = new Uint32Array(8), ultimaIngesta = 0;
function tarea() { for (let i = 0; i < cfg.hashesPorTarea; i++) { sha256_32(estado, tmp); estado.set(tmp); } tareas++; }
function activo(now) { // decide si esta célula "pasa tren" ahora
  if (cfg.modo === "siempre") return true;
  if (cfg.modo === "metro-cola") return cola > 0;
  const ciclo = cfg.activoSeg + cfg.reposoSeg; return ((now - t0) / 1000) % ciclo < cfg.activoSeg;
}
function tick() {
  if (!cfg.corriendo) return;
  const now = performance.now();
  if (!cfg.desastre) { cola += (now - ultimaIngesta) / 1000 * cfg.ingestaPorSeg; } // ingesta de trabajo "de la red"; en desastre se pausa
  ultimaIngesta = now;
  const on = activo(now);
  const ventana = 100, inicio = performance.now();
  // activo: 100 ms de trabajo; inactivo: servicio mínimo (minServicio de la ventana), nunca cero
  const presupuesto = on ? ventana : ventana * cfg.minServicio;
  while (performance.now() - inicio < presupuesto) { tarea(); cola = Math.max(0, cola - 1); if (cfg.modo === "metro-cola" && on && cola <= 0) break; }
  const trabajo = performance.now() - inicio; ocupadoMs += trabajo;
  setTimeout(tick, Math.max(0, ventana - trabajo));
}
setInterval(() => { if (cfg.corriendo) self.postMessage({ tipo: "stats", tareas, ocupadoMs, cola: Math.max(0, Math.floor(cola) || 0), activo: activo(performance.now()), muestra: estado[0].toString(16) }); }, 1000);
self.onmessage = (e) => { const m = e.data;
  if (m.tipo === "config") cfg = { ...cfg, ...m.cfg };
  if (m.tipo === "iniciar") { cfg = { ...cfg, ...m.cfg, corriendo: true }; t0 = ultimaIngesta = performance.now(); tick(); }
  if (m.tipo === "parar") cfg.corriendo = false;
};
