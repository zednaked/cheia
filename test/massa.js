// Testes do modelo hidráulico em grades sintéticas pequenas, na GPU de
// verdade (ou no SwiftShader, no headless). Resultado em window.__result.
import * as THREE from 'three';
import { FloodSim } from '../src/sim.js';

const renderer = new THREE.WebGLRenderer({ canvas: document.createElement('canvas') });
const results = [];
const check = (name, ok, detail) => results.push({ name, ok: !!ok, detail });

function grid(n, f) {
  const bed = new Float32Array(n * n);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) bed[j * n + i] = f(i, j);
  return bed;
}
const bowl = (n, depth = 50) => grid(n, (i, j) => depth * (((i - n / 2) / (n / 2)) ** 2 + ((j - n / 2) / (n / 2)) ** 2));

// soma da chuva efetiva (m³ por m² de célula) que o modelo deve ter recebido
function run(sim, steps, uniform = 0) {
  let added = 0;
  const forcing = (t) => {
    let s = 0;
    for (let j = 0; j < sim.H; j++) for (let i = 0; i < sim.W; i++) s += sim.rainAt(i, j, uniform);
    added += s * sim.dt;
    return uniform;
  };
  for (let done = 0; done < steps; done += 20) sim.step(Math.min(20, steps - done), forcing);
  return added;
}
async function stored(sim) {
  const b = await sim.read();
  let v = 0, neg = 0, bad = 0, hmax = 0, haz = 0;
  for (let k = 0; k < sim.W * sim.H; k++) {
    const h = b[k * 4];
    if (!Number.isFinite(h)) bad++;
    if (h < 0) neg++;
    v += h;
    hmax = Math.max(hmax, h);
    haz = Math.max(haz, b[k * 4 + 3]);
  }
  return { v, neg, bad, hmax, haz, b };
}

// 1. Bacia fechada, célula de tempestade no meio: toda a chuva tem que estar lá.
{
  const n = 128;
  const sim = new FloodSim(renderer, { W: n, H: n, bed: bowl(n), dx: 30 });
  sim.reset(null);
  sim.cell = { x: n / 2, y: n / 2, r: 15, i: 100 / 3.6e6 };
  const added = run(sim, 600);
  const { v, neg } = await stored(sim);
  const err = Math.abs(v - added) / added;
  check('massa: bacia fechada com célula de tempestade', err < 1e-4 && !neg, `entrou ${added.toFixed(3)}, ficou ${v.toFixed(3)} (erro ${(err * 100).toFixed(3)}%)`);
}

// 2. Mapa de chuva + perdas: a conta em JS (rainAt) tem que bater com o shader.
{
  const n = 128;
  const sim = new FloodSim(renderer, { W: n, H: n, bed: bowl(n), dx: 30 });
  sim.reset(null);
  const map = new Float32Array(16);
  map[5] = map[6] = map[9] = 80;  // mm/h no miolo; borda seca
  map[10] = 40;
  sim.setRainMap(map, 4, 4);
  sim.mapScale = 1 / 3.6e6;
  sim.loss = 15 / 3.6e6;
  const added = run(sim, 600);
  const { v, neg } = await stored(sim);
  const err = Math.abs(v - added) / added;
  check('massa: mapa de chuva com perdas', err < 1e-4 && !neg, `entrou ${added.toFixed(3)}, ficou ${v.toFixed(3)} (erro ${(err * 100).toFixed(3)}%)`);
}

// 3. Lago em repouso: água parada numa bacia tem que continuar parada.
{
  const n = 96;
  const bed = bowl(n, 40);
  const h0 = Float32Array.from(bed, (z) => Math.max(0, 15 - z));
  const sim = new FloodSim(renderer, { W: n, H: n, bed, dx: 30 });
  sim.reset(h0);
  run(sim, 800);
  const { b } = await stored(sim);
  let drift = 0;
  for (let k = 0; k < n * n; k++) if (h0[k] > 0.01) drift = Math.max(drift, Math.abs(b[k * 4] + bed[k] - 15));
  check('lago em repouso', drift < 5e-3, `maior desvio do nível: ${(drift * 1000).toFixed(2)} mm`);
}

// 4. Relevo áspero, chuva forte, bordas abertas: nunca negativo, nunca NaN,
// e a água que sai pelas bordas não pode ser mais do que entrou.
{
  const n = 160;
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bed = grid(n, (i, j) => 0.4 * i + 8 * Math.sin(j / 9) + rnd() * 6);
  const sim = new FloodSim(renderer, { W: n, H: n, bed, dx: 30 });
  sim.reset(null);
  const added = run(sim, 900, 150 / 3.6e6);
  const { v, neg, bad, haz } = await stored(sim);
  check('relevo áspero: lâmina finita e não negativa', !neg && !bad, `${neg} negativas, ${bad} não finitas`);
  check('relevo áspero: não cria água', v <= added * 1.002, `entrou ${added.toFixed(2)}, ficou ${v.toFixed(2)}`);
  check('perigo: rampa com chuva forte gera classe ≥ 2', haz >= 2, `classe máxima ${haz}`);
}

// 5. Canal inclinado: velocidade de equilíbrio perto da de Manning.
{
  const n = 64, S = 0.01, man = 0.05;
  const sim = new FloodSim(renderer, { W: n, H: n, bed: grid(n, (i) => (n - i) * 30 * S), dx: 30 });
  sim.manning = man;
  sim.reset(null);
  run(sim, 3000, 60 / 3.6e6);
  const { b } = await stored(sim);
  // no meio do domínio, longe das bordas
  const j = n / 2, i = n - 8, k = j * n + i;
  const h = b[k * 4];
  const q = (60 / 3.6e6) * i * 30; // vazão por metro de largura que chega ali
  const v = q / h, vManning = (h ** (2 / 3) * Math.sqrt(S)) / man;
  const err = Math.abs(v - vManning) / vManning;
  check('canal: velocidade de Manning em regime permanente', err < 0.1, `h ${(h * 100).toFixed(1)} cm, v ${v.toFixed(3)} m/s, Manning ${vManning.toFixed(3)} m/s`);
}

document.getElementById('out').textContent = results.map((r) => `${r.ok ? 'ok  ' : 'FALHOU'} ${r.name}: ${r.detail}`).join('\n');
window.__result = results;
