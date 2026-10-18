// Estado do simulador no endereço (#r=98&d=1&…): quem recebe o link abre a
// mesma chuva, a mesma câmera e o mesmo pino, e a simulação já começa.

export function readHash() {
  const out = {};
  for (const [k, v] of new URLSearchParams(location.hash.slice(1))) out[k] = v;
  return out;
}

let pending = 0;
export function writeHash(state) {
  clearTimeout(pending);
  pending = setTimeout(() => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(state)) if (v !== undefined && v !== null && v !== '') q.set(k, v);
    history.replaceState(null, '', `#${q.toString().replace(/%2C/g, ',')}`);
  }, 250);
}

export const num = (v, d = 4) => (v == null ? undefined : String(+(+v).toFixed(d)));
