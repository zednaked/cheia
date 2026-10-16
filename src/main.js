import {
  loadElevation, loadImagery, loadOSM, drawRivers, drawLimits, rasterizeAreas, rasterizeLakes, burnRivers, fillPits,
} from './data.js';
import { FloodSim } from './sim.js';
import { View } from './scene.js';

const $ = (id) => document.getElementById(id);

// Curva IDF de Curitiba (Fendrich): i [mm/h] para TR [anos] e duração t [min].
const idf = (T, t) => (5726.64 * T ** 0.159) / (t + 41) ** 1.041;

const fmtTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const km2 = (cells, dx) => (cells * dx * dx) / 1e6;

function progress(msg, f) {
  $('load-msg').textContent = msg;
  $('load-fill').style.width = `${Math.round(f * 100)}%`;
}

const view = new View($('gl'));

progress('relevo (SRTM)…', 0);
const dem = await loadElevation((f) => progress('relevo (SRTM)…', f * 0.2));
progress('rios e bairros (OSM)…', 0.2);
const osm = await loadOSM();
const maxTex = Math.min(view.renderer.capabilities.maxTextureSize, 6144);
const imagery = await loadImagery(maxTex, (f) => progress('imagem de satélite…', 0.25 + f * 0.65));
progress('preparando…', 0.92);
await new Promise((r) => setTimeout(r, 0));

const riverMask = burnRivers(osm, dem.bed, dem.W, dem.H);
const bedBurned = dem.bed.slice();
const PIT_MODES = { all: Infinity, shallow: 3, none: 0 };
function prepareBed(mode) {
  dem.bed.set(bedBurned);
  if (PIT_MODES[mode]) fillPits(dem.bed, dem.W, dem.H, PIT_MODES[mode]);
}
prepareBed($('pits').value);
const lakeMask = rasterizeLakes(osm, dem.W, dem.H);
const { ids, areas } = rasterizeAreas(osm, dem.W, dem.H);
const overlaySize = Math.min(maxTex, 4096);
const sim = new FloodSim(view.renderer, dem);
view.build(dem, sim, imagery, drawRivers(osm, overlaySize), drawLimits(osm, overlaySize));
$('loading').remove();

// ---- parâmetros ----
const P = {};
function bind(id, out, fmt, onChange) {
  const el = $(id);
  const upd = () => {
    P[id] = +el.value;
    $(out).textContent = fmt(P[id]);
    onChange?.(P[id]);
  };
  el.addEventListener('input', upd);
  upd();
  return el;
}
const updTotal = () => ($('o-total').textContent = `${Math.round(P.rate * P.dur)} mm`);
bind('rate', 'o-rate', (v) => `${v} mm/h`, () => { updTotal(); });
bind('dur', 'o-dur', (v) => (v < 1 ? `${v * 60} min` : `${v} h`), updTotal);
bind('loss', 'o-loss', (v) => `${v} mm/h`);
bind('base', 'o-base', (v) => `${v.toFixed(1)} m`);
bind('man', 'o-man', (v) => v.toFixed(3), (v) => (sim.manning = v));
bind('speed', 'o-speed', (v) => `até ${v} passos/quadro`);
bind('exag', 'o-exag', (v) => `${v}×`, (v) => {
  view.uniforms.uExag.value = v;
  view.updateBounds();
});
bind('minshow', 'o-min', (v) => `${Math.round(v * 100)} cm`, (v) => (view.uniforms.uMinShow.value = v));
for (const [id, u] of [['c-img', 'uShowImg'], ['c-riv', 'uShowRivers'], ['c-lim', 'uShowLimits'], ['c-max', 'uShowMax']]) {
  const el = $(id);
  const upd = () => (view.uniforms[u].value = el.checked ? 1 : 0);
  el.addEventListener('change', upd);
  upd();
}
for (const id of ['rate', 'dur']) $(id).addEventListener('input', () => ($('preset').value = 'custom'));

function applyPreset() {
  const v = $('preset').value;
  if (v === 'custom') return;
  const [T, t] = v.split(',').map(Number);
  $('rate').value = Math.round(idf(T, t));
  $('dur').value = t / 60;
  for (const id of ['rate', 'dur']) $(id).dispatchEvent(new Event('input'));
  $('preset').value = v;
}
$('preset').addEventListener('change', applyPreset);
applyPreset();

// ---- simulação ----
let running = false;
let rainNow = 0;
const rain = (t) => {
  rainNow = t <= P.dur * 3600 ? P.rate : 0;
  return Math.max(0, rainNow - P.loss) / 3.6e6;
};

function reset() {
  const h0 = new Float32Array(dem.W * dem.H);
  for (let k = 0; k < h0.length; k++) h0[k] = riverMask[k] === 2 ? P.base : riverMask[k] === 1 ? P.base * 0.4 : 0;
  sim.reset(h0);
  view.uniforms.uOut.value = sim.outputTex;
  rainNow = 0;
  lastRead = -Infinity;
  readback();
}
window.cheia = { sim, view, dem };
$('reset').addEventListener('click', reset);
$('pits').addEventListener('change', () => {
  prepareBed($('pits').value);
  reset();
});
$('play').addEventListener('click', () => {
  running = !running;
  $('play').textContent = running ? '❚❚ Pausar' : '▶ Simular';
});

// ---- leitura de volta: estatísticas e ranking ----
let buf = null;
let lastRead = -Infinity;
let reading = false;
const FLOOD = 0.3;

async function readback() {
  if (reading) return;
  reading = true;
  buf = await sim.read(buf);
  reading = false;
  const dx = dem.dx;
  const stats = areas.map(() => ({ now: 0, max: 0, deep: 0 }));
  let now = 0, max = 0, vol = 0, hTop = 0;
  for (let k = 0, n = dem.W * dem.H; k < n; k++) {
    const h = buf[k * 4], hm = buf[k * 4 + 1];
    if (h > hTop) hTop = h;
    if (riverMask[k] || lakeMask[k]) continue; // calha e lagos não contam como alagamento
    vol += h;
    if (h > FLOOD) now++;
    if (hm > FLOOD) {
      max++;
      const id = ids[k];
      if (id) {
        const s = stats[id - 1];
        s.max++;
        if (h > FLOOD) s.now++;
        if (hm > s.deep) s.deep = hm;
      }
    }
  }
  sim.setMaxDepth(hTop);
  $('s-area').textContent = `${km2(now, dx).toFixed(2)} km²`;
  $('s-max').textContent = `${km2(max, dx).toFixed(2)} km²`;
  $('s-vol').textContent = `${((vol * dx * dx) / 1e6).toFixed(2)} hm³`;
  renderRanking(stats);
}

function renderRanking(stats) {
  const rows = areas
    .map((a, i) => ({ a, i, s: stats[i] }))
    .filter((r) => r.s.max > 0)
    .sort((x, y) => y.s.max - x.s.max)
    .slice(0, 25);
  const tbl = $('rank');
  if (!rows.length) {
    tbl.innerHTML = '';
    return;
  }
  $('rank-sub').textContent = 'Área que já passou de 30 cm de água (pico) · % do bairro · prof. máx.';
  const top = rows[0].s.max;
  tbl.innerHTML = rows.map((r) => `
    <tr data-i="${r.i}">
      <td>${r.a.name}<span class="muni">${r.a.level === 8 ? ' · município' : ''}</span>
        <div class="bar" style="width:${(100 * r.s.max) / top}%"></div></td>
      <td class="n">${km2(r.s.max, dem.dx).toFixed(2)} km²<br>
        <span class="muni">${Math.round((100 * r.s.max) / r.a.cells)}% · ${r.s.deep.toFixed(1)} m</span></td>
    </tr>`).join('');
}

// clicar numa linha do ranking leva a câmera até a área
$('rank').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const id = +tr.dataset.i + 1;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < ids.length; k++) if (ids[k] === id) { sx += k % dem.W; sy += Math.floor(k / dem.W); n++; }
  if (!n) return;
  const u = sx / n / dem.W, v = sy / n / dem.H;
  const p = view.gridToWorld(u, v, dem.bed[Math.floor(sy / n) * dem.W + Math.floor(sx / n)]);
  const off = view.camera.position.clone().sub(view.controls.target).setLength(6000);
  view.controls.target.copy(p);
  view.camera.position.copy(p).add(off);
});

// ---- dica ao passar o mouse ----
const tip = $('tip');
let pickPending = null;
$('gl').addEventListener('pointermove', (e) => (pickPending = e));
$('gl').addEventListener('pointerleave', () => { pickPending = null; tip.style.display = 'none'; });
function updateTip() {
  const e = pickPending;
  if (!e) return;
  pickPending = null;
  const r = view.renderer.domElement.getBoundingClientRect();
  const hit = view.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, dem);
  if (!hit) { tip.style.display = 'none'; return; }
  const a = ids[hit.k] ? areas[ids[hit.k] - 1] : null;
  const h = buf ? buf[hit.k * 4] : 0, hm = buf ? buf[hit.k * 4 + 1] : 0, arr = buf ? buf[hit.k * 4 + 2] : 0;
  tip.innerHTML = `<b>${a ? a.name : 'fora dos limites'}</b><br>
    Altitude ${dem.bed[hit.k].toFixed(0)} m<br>
    Água agora ${h < 0.01 ? '–' : (h * 100).toFixed(0) + ' cm'} · pico ${hm < 0.01 ? '–' : (hm * 100).toFixed(0) + ' cm'}
    ${arr > 0 ? `<br>Passou de 30 cm em ${fmtTime(arr)}` : ''}
    ${riverMask[hit.k] ? '<br><span class="muni">calha de rio</span>' : ''}`;
  tip.style.display = 'block';
  tip.style.left = `${e.clientX + 14}px`;
  tip.style.top = `${e.clientY + 14}px`;
}

// ---- laço ----
reset();
// Passos por quadro se adaptam para manter a tela fluida; o controle de
// velocidade é o teto.
let budget = 4, lastTs = 0, simT0 = 0, realT0 = 0;
function frame(ts) {
  const ft = ts - lastTs;
  lastTs = ts;
  if (running) {
    if (ft > 45) budget = Math.max(1, budget * 0.85);
    else if (ft < 30) budget += 0.5;
    budget = Math.min(budget, P.speed);
    sim.step(Math.max(1, Math.round(budget)), rain);
    view.uniforms.uOut.value = sim.outputTex;
    $('clock').textContent = fmtTime(sim.time);
    $('rain-now').textContent = rainNow;
    if (ts - lastRead > 1500) {
      lastRead = ts;
      readback();
    }
    if (ts - realT0 > 1000) {
      const rate = (sim.time - simT0) / ((ts - realT0) / 1000) / 60;
      if (realT0) $('o-speed').textContent = `≈ ${rate < 10 ? rate.toFixed(1) : Math.round(rate)} min/s`;
      simT0 = sim.time;
      realT0 = ts;
    }
  }
  updateTip();
  view.render();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
