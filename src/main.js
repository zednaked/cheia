import {
  loadTerrain, loadElevation, loadImagery, loadOSM, drawRivers, drawLimits, drawPois, rasterizeAreas, rasterizeLakes,
  burnRivers, fillPits,
} from './data.js';
import { lonLatToUV, uvToLonLat } from './region.js';
import { FloodSim } from './sim.js';
import { View } from './scene.js';
import { Flow } from './fluxo.js';
import { setupScenarios } from './cenarios.js';
import { setupSearch } from './busca.js';
import { loadEvent, loadForecast } from './chuva.js';
import { readHash, writeHash, num } from './estado.js';
import { Recorder, download } from './gravar.js';

const $ = (id) => document.getElementById(id);
// Nomes vêm do OSM, do Nominatim e do endereço da página: sempre escapados.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const mobile = matchMedia('(max-width: 760px)').matches;

// Curva IDF de Curitiba (Fendrich): i [mm/h] para TR [anos] e duração t [min].
const idf = (T, t) => (5726.64 * T ** 0.159) / (t + 41) ** 1.041;

const fmtTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
  return h >= 24 ? `${Math.floor(h / 24)}d ${String(h % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`
    : `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};
const km2 = (cells, dx) => (cells * dx * dx) / 1e6;
const cm = (h) => (h < 0.01 ? '–' : h < 1 ? `${Math.round(h * 100)} cm` : `${h.toFixed(2).replace('.', ',')} m`);
const HAZ = ['seco', 'raso, seguro', 'perigoso para carro pequeno', 'perigoso para carro, criança e idoso',
  'perigoso para qualquer pessoa', 'perigoso para todos; construções leves sofrem', 'qualquer construção pode ceder'];

function progress(msg, f) {
  $('load-msg').textContent = msg;
  $('load-fill').style.width = `${Math.round(f * 100)}%`;
}

const view = new View($('gl'));

// ---- dados ----
progress('relevo e rios…', 0);
const [terrain, osm] = await Promise.all([loadTerrain((f) => progress('relevo e rios…', f * 0.25)), loadOSM()]);
let dem, riverMask, burned, filled, roads = null, roadsMain = null;
if (terrain) {
  ({ riverMask, burned, filled, roads, roadsMain } = terrain);
  dem = { W: terrain.W, H: terrain.H, dx: terrain.dx, bed: filled.slice() };
} else {
  // sem o terreno pré-processado (npm run bake): monta tudo aqui, como antes
  dem = await loadElevation((f) => progress('relevo (SRTM)…', f * 0.25));
  riverMask = burnRivers(osm, dem.bed, dem.W, dem.H);
  burned = dem.bed.slice();
  filled = burned.slice();
  fillPits(filled, dem.W, dem.H, Infinity);
  dem.bed.set(filled);
}
const maxTex = Math.min(view.renderer.capabilities.maxTextureSize, 6144);
const imagery = await loadImagery(maxTex, (f) => progress('imagem de satélite…', 0.25 + f * 0.65));
progress('preparando…', 0.92);
await new Promise((r) => setTimeout(r, 0));

function prepareBed(mode) {
  if (mode === 'all') return dem.bed.set(filled);
  dem.bed.set(burned);
  if (mode === 'shallow') fillPits(dem.bed, dem.W, dem.H, 3);
}
const lakeMask = rasterizeLakes(osm, dem.W, dem.H);
const { ids, areas } = rasterizeAreas(osm, dem.W, dem.H);
const W = dem.W, H = dem.H, N = W * H;
const cellOf = ([lon, lat]) => {
  const [u, v] = lonLatToUV(lon, lat);
  const i = Math.floor(u * W), j = Math.floor(v * H);
  return i < 0 || j < 0 || i >= W || j >= H ? -1 : j * W + i;
};
const pois = (osm.pois || []).map((p) => ({ ...p, cell: cellOf(p.c) })).filter((p) => p.cell >= 0);
const overlaySize = Math.min(maxTex, 4096);
const sim = new FloodSim(view.renderer, dem);
view.build(dem, sim, imagery, drawRivers(osm, overlaySize), drawLimits(osm, overlaySize), drawPois(pois, overlaySize));
const flow = new Flow(view, sim);
const recorder = new Recorder(view.renderer.domElement);
$('loading').remove();

// estado da página (declarado antes de qualquer handler rodar)
let ready = false;      // só grava o endereço depois de aplicar o que veio nele
let running = false;
let series = [];        // lâmina no pino ao longo do tempo
let pin = null;
let validation = null;
let buf = null;
let lastRead = -Infinity;
let reading = false;

// ---- estado vindo do link ----
const hash = readHash();
const setVal = (id, v) => { if (v !== undefined) $(id).value = v; };
setVal('rate', hash.r);
setVal('dur', hash.d);
setVal('loss', hash.l);
setVal('base', hash.b);
setVal('man', hash.n);
setVal('pits', hash.pit);
setVal('exag', hash.ex);
setVal('minshow', hash.ms);
setVal('cr', hash.cr);
setVal('cd', hash.cd);
setVal('cs', hash.cs);
if (hash.v !== undefined) {
  for (const [id, ch] of [['c-img', 'i'], ['c-riv', 'r'], ['c-lim', 'l'], ['c-max', 'm'], ['c-flow', 'f'], ['c-poi', 's']]) {
    $(id).checked = hash.v.includes(ch);
  }
}
if (hash.p) $('preset').value = hash.p;
else if (hash.r) $('preset').value = 'custom';
if (hash.pit) prepareBed(hash.pit);

// ---- parâmetros ----
const P = {};
function bind(id, out, fmt, onChange) {
  const el = $(id);
  const upd = () => {
    P[id] = +el.value;
    $(out).textContent = fmt(P[id]);
    onChange?.(P[id]);
    saveHash();
  };
  el.addEventListener('input', upd);
  upd();
  return el;
}
const updTotal = () => ($('o-total').textContent = `${Math.round(P.rate * P.dur)} mm`);
bind('rate', 'o-rate', (v) => `${v} mm/h`, updTotal);
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
bind('cr', 'o-cr', (v) => `${String(v).replace('.', ',')} km`);
bind('cs', 'o-cs', (v) => ($('cd').value === '-1' ? 'parada' : `${v} km/h`));
$('cd').addEventListener('change', () => { $('cs').dispatchEvent(new Event('input')); });
for (const [id, u] of [['c-img', 'uShowImg'], ['c-riv', 'uShowRivers'], ['c-lim', 'uShowLimits'], ['c-max', 'uShowMax'], ['c-poi', 'uShowPois']]) {
  const el = $(id);
  const upd = () => {
    view.uniforms[u].value = el.checked ? 1 : 0;
    flow.visible = $('c-flow').checked && !$('c-max').checked;
    saveHash();
  };
  el.addEventListener('change', upd);
  upd();
}
$('c-flow').addEventListener('change', () => {
  flow.visible = $('c-flow').checked && !$('c-max').checked;
  saveHash();
});
flow.visible = $('c-flow').checked && !$('c-max').checked;

let colorMode = hash.cm === 'h' ? 1 : 0;
function setColorMode(m) {
  colorMode = m;
  view.uniforms.uColorMode.value = m;
  $('cm-depth').setAttribute('aria-pressed', m === 0);
  $('cm-haz').setAttribute('aria-pressed', m === 1);
  $('leg-depth').hidden = m === 1;
  $('leg-haz').hidden = m === 0;
  saveHash();
}
$('cm-depth').addEventListener('click', () => setColorMode(0));
$('cm-haz').addEventListener('click', () => setColorMode(1));

for (const id of ['rate', 'dur']) {
  $(id).addEventListener('input', (e) => {
    if (e.isTrusted) {
      $('preset').value = 'custom';
      leaveSpecial();
    }
  });
}

function applyPreset() {
  const v = $('preset').value;
  if (v === 'custom') return;
  const [T, t] = v.split(',').map(Number);
  $('rate').value = Math.round(idf(T, t));
  $('dur').value = t / 60;
  for (const id of ['rate', 'dur']) $(id).dispatchEvent(new Event('input'));
  $('preset').value = v;
  saveHash();
}
$('preset').addEventListener('change', () => {
  leaveSpecial();
  applyPreset();
});
if (!hash.r || hash.p) applyPreset();

// ---- onde chove: região toda, célula de tempestade, temporal real, previsão ----
let where = hash.w === 'c' ? 'cell' : 'all';
let cellAt = hash.cx ? lonLatToUV(+hash.cx, +hash.cy) : lonLatToUV(-49.27, -25.44);
let armed = false;
let special = null; // chuva de evento ou previsão (chuva.js)

function setWhere(w) {
  where = w;
  $('where-all').setAttribute('aria-pressed', w === 'all');
  $('where-cell').setAttribute('aria-pressed', w === 'cell');
  $('cell-opts').hidden = w !== 'cell';
  if (w !== 'cell') arm(false);
  saveHash();
}
function arm(on) {
  armed = on;
  $('cell-arm').setAttribute('aria-pressed', on);
  $('gl').style.cursor = on ? 'crosshair' : '';
}
$('where-all').addEventListener('click', () => { leaveSpecial(); setWhere('all'); });
$('where-cell').addEventListener('click', () => { leaveSpecial(); setWhere('cell'); arm(true); });
$('cell-arm').addEventListener('click', () => arm(!armed));
setWhere(where);

function cellAtTime(t) {
  const dir = +$('cd').value;
  const s = dir < 0 ? 0 : P.cs / 3.6 / dem.dx; // células por segundo
  const a = (dir * Math.PI) / 180;
  return { x: cellAt[0] * W + Math.sin(a) * s * t, y: cellAt[1] * H - Math.cos(a) * s * t };
}

let rainNow = 0;
function forcing(t) {
  sim.loss = P.loss / 3.6e6;
  if (special) {
    sim.cell = null;
    const f = special.forcing(sim, t);
    rainNow = Math.round(f.peak);
    return f.uniform;
  }
  sim.mapScale = 0;
  const on = t <= P.dur * 3600;
  rainNow = on ? P.rate : 0;
  if (where === 'cell') {
    const c = cellAtTime(t);
    sim.cell = on ? { x: c.x, y: c.y, r: (P.cr * 1000) / dem.dx, i: P.rate / 3.6e6 } : null;
    return 0;
  }
  sim.cell = null;
  return rainNow / 3.6e6;
}

function showModeBox() {
  const box = $('mode-on');
  if (!special) {
    box.hidden = true;
    $('tabs-valid').hidden = true;
    return;
  }
  box.hidden = false;
  if (special.kind === 'event') {
    const e = special.ev;
    box.innerHTML = `<b>${e.label}</b><br>${e.summary}<br>
      <span class="muted">Chuva interpolada de ${e.stations.length} pluviômetros da Defesa Civil.
      Os pontos no mapa são os ${e.points.length} alagamentos reportados naquele dia: verde se a simulação alagou ali,
      vermelho se não.</span><br><button id="leave-special">Voltar à chuva de projeto</button>`;
  } else {
    const dry = special.maxTotal < 5;
    box.innerHTML = `<b>Próximas 48 horas</b> (Open-Meteo, ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })})<br>
      ${dry ? '<b>Tempo seco ou quase:</b> a previsão não traz chuva para alagar nada agora. ' : ''}Até <b>${Math.round(special.maxTotal)} mm</b> no ponto mais chuvoso, média de ${Math.round(special.meanTotal)} mm na região,
      pico de ${Math.round(special.maxHour)} mm numa hora.
      <br><span class="muted">Previsão em 16 pontos, hora a hora: suaviza as tempestades curtas, que costumam ser mais
      intensas e mais localizadas. 48 h de simulação levam alguns minutos.</span>
      <br><button id="leave-special">Voltar à chuva de projeto</button>`;
  }
  $('leave-special').addEventListener('click', () => { leaveSpecial(); reset(); });
  $('tabs-valid').hidden = special.kind !== 'event';
}

function leaveSpecial() {
  if (!special) return;
  special = null;
  sim.mapScale = 0;
  validation = null;
  $('vpins').innerHTML = '';
  showModeBox();
  setTab('bairros');
  saveHash();
}

let specialSeq = 0;
async function enterSpecial(load, btn) {
  const my = ++specialSeq;
  const label = btn.textContent;
  btn.textContent = 'carregando…';
  btn.disabled = true;
  try {
    const next = await load();
    if (my !== specialSeq) return; // outro modo foi pedido enquanto este carregava
    leaveSpecial();
    special = next;
    special.setup(sim);
    setWhere('all');
    if (special.kind === 'event') {
      $('preset').value = 'custom';
      startValidation(special.ev);
    }
    showModeBox();
    reset();
    if (!running) togglePlay();
    saveHash();
  } catch (e) {
    toast(`Não foi possível carregar (${e.message}).`);
  } finally {
    btn.textContent = label;
    btn.disabled = false;
  }
}
$('mode-event').addEventListener('click', (e) => enterSpecial(loadEvent, e.currentTarget));
$('mode-fc').addEventListener('click', (e) => enterSpecial(loadForecast, e.currentTarget));

// ---- simulação ----

// Os rios começam com água na calha e se acomodam por 2 h sem chuva antes do
// relógio zerar (sim.settle); o resultado fica guardado até mudar o nível
// inicial ou o relevo.
const SETTLE = 2 * 3600;

// Lâmina inicial na calha: o nível escolhido, mas sem passar da margem (a
// célula de fora da calha mais baixa a até 2 células), senão o rio já começa
// transbordando para a várzea.
function riverStart() {
  const h0 = new Float32Array(N);
  for (let k = 0; k < N; k++) {
    if (!riverMask[k]) continue;
    const x = k % W, y = Math.floor(k / W);
    let bank = Infinity;
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
        const kk = yy * W + xx;
        if (!riverMask[kk] && !lakeMask[kk]) bank = Math.min(bank, dem.bed[kk]);
      }
    }
    const want = riverMask[k] === 2 ? P.base : P.base * 0.4;
    h0[k] = Math.max(0, Math.min(want, bank - dem.bed[k]));
  }
  return h0;
}
let settledFor = null;
let settling = null;  // promessa do aquecimento em curso
let resetGen = 0;
async function reset() {
  const my = ++resetGen;
  for (;;) {
    const key = `${P.base}|${$('pits').value}`;
    if (key === settledFor) break;
    settling ??= (async () => {
      $('clock-sub').textContent = 'acomodando os rios…';
      await sim.settle(riverStart(), SETTLE, (f) => ($('clock-sub').textContent = `acomodando os rios… ${Math.round(f * 100)}%`));
      settledFor = key;
      settling = null;
    })();
    await settling;
    if (my !== resetGen) return; // outro reset foi pedido enquanto este esperava
  }
  sim.restart();
  if (special) special.setup(sim);
  view.uniforms.uOut.value = sim.outputTex;
  view.uniforms.uS.value = sim.stateTex;
  forcing(0);
  rainNow = 0;
  lastRead = -Infinity;
  series = [];
  updateClock();
  readback();
}
function togglePlay() {
  running = !running;
  $('play').textContent = running ? '❚❚ Pausar' : '▶ Simular';
}
window.cheia = { sim, view, dem, get validation() { return validation?.last; }, get running() { return running; }, get pin() { return pin; }, ids, areas, pois, riverMask, roads, roadsMain };

setupScenarios({
  idf,
  presets: [...$('preset').options].filter((o) => o.value !== 'custom').map((o) => ({ value: o.value, text: o.text })),
  run({ rate, dur, loss, river }) {
    leaveSpecial();
    const set = (id, v) => { $(id).value = v; $(id).dispatchEvent(new Event('input')); };
    set('rate', rate);
    set('dur', dur);
    set('loss', loss);
    set('base', river);
    $('preset').value = 'custom';
    $('c-max').checked = false;
    $('c-max').dispatchEvent(new Event('change'));
    reset();
    if (!running) togglePlay();
  },
});
$('reset').addEventListener('click', reset);
$('pits').addEventListener('change', () => {
  prepareBed($('pits').value);
  reset();
  saveHash();
});
$('play').addEventListener('click', togglePlay);

function updateClock() {
  if (special) {
    const c = special.clock(sim.time);
    $('clock').textContent = c.text;
    $('clock-sub').textContent = `${c.sub} · ${fmtTime(sim.time)} de simulação`;
  } else {
    $('clock').textContent = fmtTime(sim.time);
    $('clock-sub').textContent = 'tempo simulado';
  }
  $('rain-now').textContent = special ? `até ${rainNow}` : rainNow;
}

// ---- leitura de volta: estatísticas, ranking, exposição, ponto, validação ----
const FLOOD = 0.3;

let readAgain = false;
async function readback() {
  if (reading) {
    readAgain = true;
    return;
  }
  reading = true;
  const gen = resetGen;
  buf = await sim.read(buf);
  reading = false;
  // um reset no meio da leitura: estes números são da simulação anterior
  if (gen !== resetGen || readAgain) {
    readAgain = false;
    return readback();
  }
  const dx = dem.dx;
  const stats = areas.map(() => ({ max: 0, deep: 0 }));
  let now = 0, max = 0, vol = 0, hTop = 0, road = 0, roadMain = 0, roadUnsafe = 0;
  for (let k = 0; k < N; k++) {
    const h = buf[k * 4], hm = buf[k * 4 + 1];
    if (h > hTop) hTop = h;
    // calha, lagos e o que já estava molhado antes da chuva não contam como alagamento
    if (riverMask[k] || lakeMask[k] || buf[k * 4 + 2] < 0) continue;
    vol += h;
    if (h > FLOOD) now++;
    if (hm > FLOOD) {
      max++;
      const id = ids[k];
      if (id) {
        const s = stats[id - 1];
        s.max++;
        if (hm > s.deep) s.deep = hm;
      }
      if (roads) {
        road += roads[k];
        roadMain += roadsMain[k];
      }
    }
    if (roads && buf[k * 4 + 3] >= 2) roadUnsafe += roads[k];
  }
  sim.setMaxDepth(hTop);
  $('s-area').textContent = `${km2(now, dx).toFixed(2)} km²`;
  $('s-max').textContent = `${km2(max, dx).toFixed(2)} km²`;
  $('s-vol').textContent = `${((vol * dx * dx) / 1e6).toFixed(2)} hm³`;
  renderRanking(stats);
  renderExposure({ road, roadMain, roadUnsafe });
  if (pin) {
    series.push({ t: sim.time, h: buf[pin.k * 4] });
    renderPin();
  }
  if (validation) runValidation();
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
      <td>${esc(r.a.name)}<span class="muni">${r.a.level === 8 ? ' · município' : r.a.muni && r.a.muni !== 'Curitiba' ? ` · ${esc(r.a.muni)}` : ''}</span>
        <div class="bar" style="width:${(100 * r.s.max) / top}%"></div></td>
      <td class="n">${km2(r.s.max, dem.dx).toFixed(2)} km²<br>
        <span class="muni">${Math.round((100 * r.s.max) / r.a.cells)}% · ${r.s.deep.toFixed(1)} m</span></td>
    </tr>`).join('');
}

// Lâmina de pico em volta de um lugar (3×3 células, ~100 m): o ponto do OSM
// costuma cair no telhado, que no SRTM é mais alto que a rua.
function peakNear(k) {
  let m = 0;
  const x = k % W;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (x + dx < 0 || x + dx >= W) continue;
      const kk = k + dy * W + dx;
      if (kk < 0 || kk >= N || riverMask[kk] || buf[kk * 4 + 2] < 0) continue;
      m = Math.max(m, buf[kk * 4 + 1]);
    }
  }
  return m;
}

const KIND_GROUP = {
  escola: 'Escolas e creches', creche: 'Escolas e creches', hospital: 'Hospitais e postos de saúde',
  'saúde': 'Hospitais e postos de saúde', bombeiros: 'Bombeiros e polícia', 'polícia': 'Bombeiros e polícia', asilo: 'Asilos',
};
let poiHits = [];
function renderExposure({ road, roadMain, roadUnsafe }) {
  const groups = {};
  for (const g of Object.values(KIND_GROUP)) groups[g] ??= { hit: 0, all: 0 };
  poiHits = [];
  for (const p of pois) {
    const g = groups[KIND_GROUP[p.k]];
    g.all++;
    const hm = peakNear(p.cell);
    if (hm > FLOOD) {
      g.hit++;
      poiHits.push({ p, hm });
    }
  }
  poiHits.sort((a, b) => b.hm - a.hm);
  const km = (m) => `${(m / 1000).toFixed(m < 10000 ? 1 : 0).replace('.', ',')} km`;
  $('expo').innerHTML = Object.entries(groups).map(([g, v]) => `<dt>${g}</dt><dd><b>${v.hit}</b> de ${v.all}</dd>`).join('') +
    (roads ? `<dt>Ruas com mais de 30 cm</dt><dd><b>${km(road)}</b></dd>
      <dt>Vias principais com mais de 30 cm</dt><dd><b>${km(roadMain)}</b></dd>
      <dt>Ruas perigosas para carro (H2+)</dt><dd><b>${km(roadUnsafe)}</b></dd>` : '');
  $('poi-rank').innerHTML = poiHits.slice(0, 40).map(({ p, hm }, i) => `
    <tr data-p="${i}"><td>${esc(p.n) || `(${p.k} sem nome)`}<br><span class="muni">${p.k}${ids[p.cell] ? ` · ${esc(areas[ids[p.cell] - 1].name)}${areas[ids[p.cell] - 1].muni !== 'Curitiba' && areas[ids[p.cell] - 1].level === 10 ? `, ${esc(areas[ids[p.cell] - 1].muni)}` : ''}` : ''}</span></td>
    <td class="n">${cm(hm)}</td></tr>`).join('');
  const tab = document.querySelector('[data-tab=lugares]');
  tab.textContent = poiHits.length ? `Lugares (${poiHits.length})` : 'Lugares';
}
$('poi-rank').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  const { p } = poiHits[+tr.dataset.p];
  setPin(p.cell, p.n || p.k, true);
});

// abas do ranking
function setTab(name) {
  document.querySelectorAll('#ranking .tabs button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.tab === name));
  document.querySelectorAll('#ranking [data-pane]').forEach((p) => (p.hidden = p.dataset.pane !== name));
}
document.querySelector('[data-tab=valid]').id = 'tabs-valid';
document.querySelectorAll('#ranking .tabs button').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('rank-toggle').addEventListener('click', () => {
  const c = $('ranking').classList.toggle('collapsed');
  $('rank-toggle').textContent = `${c ? '▾' : '▴'} Mais afetados`;
});
$('panel-toggle').addEventListener('click', () => {
  const c = $('controls').classList.toggle('collapsed');
  $('panel-toggle').textContent = c ? 'mais controles' : 'menos controles';
});
if (mobile) {
  $('ranking').classList.add('collapsed');
  $('controls').classList.add('collapsed');
  $('panel-toggle').textContent = 'mais controles';
}

// clicar numa linha do ranking leva a câmera até a área
$('rank').addEventListener('click', (e) => {
  const tr = e.target.closest('tr');
  if (!tr) return;
  flyToArea(+tr.dataset.i);
});
function flyToArea(i) {
  const id = i + 1;
  let sx = 0, sy = 0, n = 0;
  for (let k = 0; k < N; k++) if (ids[k] === id) { sx += k % W; sy += Math.floor(k / W); n++; }
  if (!n) return;
  const k = Math.floor(sy / n) * W + Math.floor(sx / n);
  view.flyTo(sx / n / W, sy / n / H, dem.bed[k], Math.max(3000, Math.sqrt(n) * dem.dx * 2.2));
}

// ---- pino: "e a minha rua?" ----
function setPin(k, name = null, fly = false) {
  const i = k % W, j = Math.floor(k / W);
  pin = { k, u: (i + 0.5) / W, v: (j + 0.5) / H, name };
  series = buf ? [{ t: sim.time, h: buf[k * 4] }] : [];
  if (fly) view.flyTo(pin.u, pin.v, dem.bed[k], 2500);
  $('marker').hidden = false;
  $('ponto').hidden = false;
  document.body.classList.add('has-pin');
  renderPin();
  saveHash();
}
function clearPin() {
  pin = null;
  $('marker').hidden = true;
  $('ponto').hidden = true;
  document.body.classList.remove('has-pin');
  saveHash();
}

function renderPin() {
  if (!pin) return;
  const k = pin.k;
  const a = ids[k] ? areas[ids[k] - 1] : null;
  const h = buf ? buf[k * 4] : 0, hm = buf ? buf[k * 4 + 1] : 0, arr = buf ? buf[k * 4 + 2] : 0, hz = buf ? buf[k * 4 + 3] : 0;
  const hm_ = (t) => `${Math.floor(t / 3600)}h${String(Math.floor((t % 3600) / 60)).padStart(2, '0')}`;
  const when = (t) => (special ? `às <b>${special.clock(t).text}</b>` : `com <b>${hm_(t)}</b> de chuva e escoamento`);
  let big;
  if (riverMask[k]) big = 'Você marcou a calha de um rio: aqui sempre tem água.';
  else if (arr < 0) big = 'Aqui já havia água antes da chuva (várzea, lagoa ou o rio fora da calha).';
  else if (arr > 0) big = `A água passou de 30 cm aqui ${when(arr)}. Pico de <b>${cm(hm)}</b>.`;
  else if (hm > 0.05) big = `Pico de <b>${cm(hm)}</b> até agora, sem passar de 30 cm.`;
  else big = sim.time > 0 ? 'Seco até agora.' : 'Rode a simulação para ver a água chegar aqui.';
  const title = pin.name || a?.name || 'Ponto marcado';
  const sub = [pin.name && a ? a.name : null, a?.level === 10 ? a.muni : null, `${dem.bed[k].toFixed(0)} m de altitude`].filter(Boolean).join(' · ');
  $('ponto').innerHTML = `
    <header><div><h3>${esc(title)}</h3><div class="sub">${esc(sub)}</div></div><button class="x" id="pin-x" aria-label="Fechar">✕</button></header>
    <div class="big">${big}</div>
    <div class="sub">Agora ${cm(h)} · perigo no pico: ${HAZ[Math.round(hz)]}</div>
    ${spark()}
    <div class="tools"><button id="pin-link">🔗 Link deste ponto</button></div>`;
  $('pin-x').addEventListener('click', clearPin);
  $('pin-link').addEventListener('click', () => copyLink());
}

function spark() {
  if (series.length < 2) return '';
  const w = 280, h = 64, tMax = Math.max(series.at(-1).t, 1);
  const hMax = Math.max(0.5, ...series.map((s) => s.h)) * 1.1;
  const x = (t) => (t / tMax) * w, y = (v) => h - 4 - (v / hMax) * (h - 10);
  const line = series.map((s, i) => `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.h).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${w} ${h}" aria-label="Lâmina d'água no ponto ao longo do tempo">
    <line x1="0" x2="${w}" y1="${y(0.3)}" y2="${y(0.3)}" stroke="#ff8a3a" stroke-dasharray="3 3" stroke-width="1"/>
    <text x="${w}" y="${y(0.3) - 3}" fill="#ff8a3a" font-size="10" text-anchor="end">30 cm</text>
    <path d="${line}L${x(series.at(-1).t)},${h - 4}L${x(series[0].t)},${h - 4}Z" fill="#3aa0ff33"/>
    <path d="${line}" fill="none" stroke="#3aa0ff" stroke-width="1.8"/>
    <text x="2" y="10" fill="#8b98a8" font-size="10">${cm(hMax / 1.1)}</text></svg>`;
}

// ---- validação: 18/02/2025 ----
function startValidation(ev) {
  validation = {
    ev,
    pts: ev.points.map((p) => ({ ...p, k: cellOf(p.c) })).filter((p) => p.k >= 0),
    win: new Float32Array(N), tmp: new Float32Array(N),
  };
  $('vpins').innerHTML = validation.pts.map((p, i) => `<div class="vpin wait" data-i="${i}" title="${esc(p.n)} (${esc(p.b)})"></div>`).join('');
  $('vpins').querySelectorAll('.vpin').forEach((el) => el.addEventListener('click', () => {
    const p = validation.pts[+el.dataset.i];
    setPin(p.k, p.n, true);
  }));
  setTab('valid');
  if (mobile) $('ranking').classList.remove('collapsed');
}

// Alagou "perto": pico de pelo menos 20 cm num quadrado de 9 × 9 células
// (~310 m de lado) em volta do ponto,
// fora da calha. A mesma régua aplicada a todo ponto urbano dá a chance de
// acertar por sorte.
const VR = 4, VTH = 0.2;
function runValidation() {
  const { win, tmp, pts } = validation;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let m = 0;
      for (let d = -VR; d <= VR; d++) {
        const x = i + d;
        if (x < 0 || x >= W) continue;
        const k = j * W + x;
        if (!riverMask[k] && !lakeMask[k] && buf[k * 4 + 2] >= 0) m = Math.max(m, buf[k * 4 + 1]);
      }
      tmp[j * W + i] = m;
    }
  }
  let urban = 0, wet = 0;
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      let m = 0;
      for (let d = -VR; d <= VR; d++) {
        const y = j + d;
        if (y >= 0 && y < H) m = Math.max(m, tmp[y * W + i]);
      }
      const k = j * W + i;
      win[k] = m;
      const a = ids[k] ? areas[ids[k] - 1] : null;
      if (a && a.level === 10 && !riverMask[k]) {
        urban++;
        if (m >= VTH) wet++;
      }
    }
  }
  let hits = 0;
  const rows = pts.map((p) => {
    const hit = win[p.k] >= VTH;
    hits += hit;
    return { p, hit, d: win[p.k] };
  });
  const chance = urban ? wet / urban : 0;
  document.querySelectorAll('#vpins .vpin').forEach((el, i) => (el.className = `vpin ${sim.time > 0 ? (rows[i].hit ? 'hit' : 'miss') : 'wait'}`));
  $('valid').innerHTML = `
    <div class="big" style="font-size:14px;margin-bottom:4px"><b>${hits} de ${pts.length}</b> alagamentos reportados
      apareceram na simulação</div>
    <div class="sub">Critério: pico de ${VTH * 100} cm ou mais num quadrado de ~${Math.round((2 * VR + 1) * dem.dx)} m em volta do ponto, fora da calha.
      Com a mesma régua, ${Math.round(chance * 100)}% dos pontos urbanos estão alagados agora, então acertar por sorte daria
      uns ${Math.round(chance * pts.length)} de ${pts.length}.</div>
    <table style="margin-top:8px">${rows.map((r, i) => `<tr data-v="${i}"><td>${esc(r.p.n)}<br><span class="muni">${esc(r.p.b)}</span></td>
      <td class="n ${r.hit ? 'hit' : 'miss'}">${r.hit ? '✓' : '✗'} ${r.hit ? cm(r.d) : r.d < 0.01 ? '–' : `${Math.floor(r.d * 100)} cm`}</td></tr>`).join('')}</table>
    <p class="note">${validation.ev.pointsNote}</p>
    <p class="note">${validation.ev.stationsNote} ${validation.ev.shapeNote}</p>`;
  $('valid').querySelectorAll('tr').forEach((tr) => tr.addEventListener('click', () => {
    const p = pts[+tr.dataset.v];
    setPin(p.k, p.n, true);
  }));
  validation.last = { hits, n: pts.length, chance };
}

// ---- busca ----
setupSearch({
  areas, pois,
  onPick(r) {
    if (r.area) flyToArea(areas.indexOf(r.area));
    else {
      const k = cellOf(r.lonlat);
      if (k < 0) return toast('Fora da área simulada.');
      setPin(k, r.name, true);
    }
  },
});

// ---- mapa: dica ao passar o mouse, toque/clique para marcar ----
const tip = $('tip');
let pickPending = null;
const glEl = $('gl');
glEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') pickPending = e; });
glEl.addEventListener('pointerleave', () => { pickPending = null; tip.style.display = 'none'; });

function pickAt(e) {
  const r = view.renderer.domElement.getBoundingClientRect();
  const showMax = view.uniforms.uShowMax.value === 1, minShow = view.uniforms.uMinShow.value;
  const surface = (k) => {
    const h = buf ? buf[k * 4 + (showMax ? 1 : 0)] : 0;
    return dem.bed[k] + (h > minShow ? h : 0);
  };
  return view.pick(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1, dem, surface);
}

let down = null;
glEl.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
glEl.addEventListener('pointerup', (e) => {
  if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6 || performance.now() - down.t > 600) return;
  const hit = pickAt(e);
  if (!hit) return;
  if (armed) {
    cellAt = [(hit.i + 0.5) / W, (hit.j + 0.5) / H];
    arm(false);
    leaveSpecial();
    saveHash();
    if (sim.time === 0 && !running) togglePlay();
  } else setPin(hit.k);
});

function updateTip() {
  const e = pickPending;
  if (!e) return;
  pickPending = null;
  const hit = pickAt(e);
  if (!hit) { tip.style.display = 'none'; return; }
  const a = ids[hit.k] ? areas[ids[hit.k] - 1] : null;
  const h = buf ? buf[hit.k * 4] : 0, hm = buf ? buf[hit.k * 4 + 1] : 0, arr = buf ? buf[hit.k * 4 + 2] : 0;
  const hz = buf ? buf[hit.k * 4 + 3] : 0;
  tip.innerHTML = `<b>${a ? esc(a.name) : 'fora dos limites'}</b>${a?.level === 10 && a.muni ? ` <span class="muni">${esc(a.muni)}</span>` : ''}<br>
    Altitude ${dem.bed[hit.k].toFixed(0)} m<br>
    Água agora ${cm(h)} · pico ${cm(hm)}
    ${arr > 0 ? `<br>Passou de 30 cm em ${fmtTime(arr)}` : ''}
    ${hz >= 2 ? `<br>Perigo: ${HAZ[Math.round(hz)]}` : ''}
    ${riverMask[hit.k] ? '<br><span class="muni">calha de rio</span>' : ''}
    <br><span class="muni">clique para acompanhar este ponto</span>`;
  tip.style.display = 'block';
  tip.style.left = `${e.clientX + 14}px`;
  tip.style.top = `${e.clientY + 14}px`;
}

// marcadores HTML acompanham a câmera
function placeMarkers() {
  if (pin) {
    const p = view.project(pin.u, pin.v, dem.bed[pin.k] + (buf ? buf[pin.k * 4] : 0));
    $('marker').style.display = p ? '' : 'none';
    if (p) $('marker').style.transform = `translate(${p.x}px, ${p.y}px)`;
    $('marker').style.left = $('marker').style.top = '0';
  }
  if (validation) {
    const els = $('vpins').children;
    validation.pts.forEach((pt, i) => {
      const k = pt.k;
      const p = view.project(((k % W) + 0.5) / W, (Math.floor(k / W) + 0.5) / H, dem.bed[k]);
      els[i].style.display = p ? '' : 'none';
      if (p) els[i].style.transform = `translate(${p.x}px, ${p.y}px)`;
      els[i].style.left = els[i].style.top = '0';
    });
  }
}

// ---- link ----
const lonlatOfCell = (k) => uvToLonLat(((k % W) + 0.5) / W, (Math.floor(k / W) + 0.5) / H);
function state() {
  const vis = [['c-img', 'i'], ['c-riv', 'r'], ['c-lim', 'l'], ['c-max', 'm'], ['c-flow', 'f'], ['c-poi', 's']]
    .filter(([id]) => $(id).checked).map(([, c]) => c).join('');
  const s = {
    p: $('preset').value !== 'custom' ? $('preset').value : undefined,
    r: $('preset').value === 'custom' ? P.rate : undefined,
    d: $('preset').value === 'custom' ? P.dur : undefined,
    l: P.loss, b: P.base, n: P.man, pit: $('pits').value !== 'all' ? $('pits').value : undefined,
    ex: P.exag, ms: P.minshow, v: vis || '-', cm: colorMode ? 'h' : undefined,
    m: special ? (special.kind === 'event' ? 'ev' : 'fc') : undefined,
  };
  if (where === 'cell' && !special) {
    const [lon, lat] = uvToLonLat(...cellAt);
    Object.assign(s, { w: 'c', cx: num(lon), cy: num(lat), cr: P.cr, cd: $('cd').value, cs: P.cs });
  }
  if (pin) {
    const [lon, lat] = lonlatOfCell(pin.k);
    s.pin = `${num(lon, 5)},${num(lat, 5)}`;
    if (pin.name) s.pn = pin.name;
  }
  const c = view.camera.position, t = view.controls.target;
  s.cam = [c.x, c.y, c.z, t.x, t.y, t.z].map((v) => Math.round(v)).join(',');
  return s;
}
function saveHash() {
  if (ready) writeHash(state());
}
view.controls.addEventListener('end', saveHash);
view.onFlightEnd = saveHash;

async function copyLink() {
  const url = `${location.origin}${location.pathname}#${new URLSearchParams({ ...clean(state()), go: 1 }).toString().replace(/%2C/g, ',')}`;
  try {
    if (navigator.share && mobile) await navigator.share({ title: 'Cheia', url });
    else {
      await navigator.clipboard.writeText(url);
      toast('Link copiado. Quem abrir vê esta chuva, este lugar e a simulação já rodando.');
    }
  } catch {
    toast(`Copie o link: ${url}`, 12000);
  }
}
const clean = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''));
$('share-link').addEventListener('click', copyLink);

let toastT = 0;
function toast(msg, ms = 3500) {
  $('toast').textContent = msg;
  $('toast').hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => ($('toast').hidden = true), ms);
}

// ---- imagem e vídeo ----
function recInfo() {
  const c = special ? special.clock(sim.time) : { text: fmtTime(sim.time), sub: 'tempo simulado' };
  const title = special?.kind === 'event' ? special.ev.label
    : special ? 'Previsão das próximas 48 h'
      : `${$('preset').value !== 'custom' ? $('preset').selectedOptions[0].text : `${P.rate} mm/h por ${$('o-dur').textContent}`}${where === 'cell' ? ' · célula de tempestade' : ''}`;
  const legend = colorMode
    ? { title: 'Perigo (ARR 2019)', stops: [[0, '#fadb59'], [0.2, '#faa633'], [0.4, '#ed661f'], [0.6, '#d1261f'], [0.8, '#8c0d33'], [1, '#4d0040']], ticks: ['seguro', 'carro', 'pessoa', 'tudo'] }
    : { title: 'Profundidade da água', stops: [[0, '#8ce6ff'], [0.2, '#2699ff'], [0.4, '#1a4de6'], [0.65, '#4d1ab3'], [1, '#730059']], ticks: ['5 cm', '50 cm', '1 m', '2 m', '4 m+'] };
  return { clock: c.text, sub: `${c.sub} · chovendo ${rainNow} mm/h`, title: `Cheia · ${title}`, legend };
}
$('share-img').addEventListener('click', async () => {
  download(await recorder.screenshot(), `cheia-${Date.now()}.png`);
});
$('rec').addEventListener('click', async () => {
  if (recorder.recording) {
    $('rec').setAttribute('aria-pressed', 'false');
    $('rec').textContent = '⏺ Vídeo';
    const blob = await recorder.stop();
    download(blob, `cheia-${Date.now()}.${blob.type.includes('mp4') ? 'mp4' : 'webm'}`);
    return;
  }
  try {
    recorder.compose(recInfo());
    recorder.start();
    $('rec').setAttribute('aria-pressed', 'true');
    $('rec').textContent = '⏹ Parar';
    if (!running) togglePlay();
  } catch (e) {
    toast(e.message);
  }
});

// ---- laço ----
reset();
setColorMode(colorMode);
if (hash.cam) {
  const [cx, cy, cz, tx, ty, tz] = hash.cam.split(',').map(Number);
  view.camera.position.set(cx, cy, cz);
  view.controls.target.set(tx, ty, tz);
  view.controls.update();
}
if (hash.pin) {
  const k = cellOf(hash.pin.split(',').map(Number));
  if (k >= 0) setPin(k, hash.pn || null);
}
ready = true;
if (hash.m === 'ev') enterSpecial(loadEvent, $('mode-event'));
else if (hash.m === 'fc') enterSpecial(loadForecast, $('mode-fc'));
else if (hash.go) togglePlay();
saveHash();

if (import.meta.env.PROD && 'serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});

// Passos por quadro se adaptam para manter a tela fluida; o controle de
// velocidade é o teto.
let budget = 4, lastTs = 0, simT0 = 0, realT0 = 0;
function frame(ts) {
  const ft = ts - lastTs;
  lastTs = ts;
  if (running && !settling) {
    if (ft > 45) budget = Math.max(1, budget * 0.85);
    else if (ft < 30) budget += 0.5;
    budget = Math.min(budget, P.speed);
    sim.step(Math.max(1, Math.round(budget)), forcing);
    view.uniforms.uOut.value = sim.outputTex;
    view.uniforms.uS.value = sim.stateTex;
    updateClock();
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
  // anel da célula de tempestade
  const showCell = where === 'cell' && !special && (sim.time <= P.dur * 3600 || armed);
  if (showCell) {
    const c = cellAtTime(sim.time);
    view.uniforms.uCellRing.value.set(c.x / W, c.y / H, (P.cr * 1000) / (dem.dx * W), 1);
  } else view.uniforms.uCellRing.value.w = 0;
  flow.update(ts);
  updateTip();
  view.render();
  recorder.afterRender(recInfo());
  placeMarkers();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
