// Carrega relevo (tiles Terrarium/SRTM), imagem de satélite (Esri) e os dados
// do OSM pré-baixados, e rasteriza tudo na grade da região.
import { REGION, lonLatToUV, cellSize } from './region.js';

const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const IMG_URL = (z, x, y) =>
  `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;

async function loadImage(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { mode: 'cors' });
      if (res.ok) return await createImageBitmap(await res.blob());
    } catch {}
  }
  return null;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
}

function tileList(z, x0, y0, nx, ny) {
  const out = [];
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) out.push({ x: x0 + i, y: y0 + j, i, j });
  return out;
}

export async function loadElevation(progress) {
  const r = REGION;
  const W = r.nx * 256, H = r.ny * 256;
  const canvas = new OffscreenCanvas(W, H);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const tiles = tileList(r.z, r.x0, r.y0, r.nx, r.ny);
  let done = 0;
  await pool(tiles, 8, async (t) => {
    const img = await loadImage(DEM_URL(r.z, t.x, t.y));
    if (img) ctx.drawImage(img, t.i * 256, t.j * 256);
    progress(++done / tiles.length);
  });
  const px = ctx.getImageData(0, 0, W, H).data;
  const bed = new Float32Array(W * H);
  for (let k = 0; k < W * H; k++) {
    bed[k] = px[k * 4] * 256 + px[k * 4 + 1] + px[k * 4 + 2] / 256 - 32768;
  }
  return { W, H, bed, dx: cellSize() };
}

export async function loadImagery(maxSize, progress) {
  const r = REGION;
  const f = 2 ** (r.imageryZ - r.z);
  const nx = r.nx * f, ny = r.ny * f;
  const size = Math.min(nx * 256, maxSize);
  const ts = size / nx;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = Math.round(ny * ts);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#4a5a44';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const tiles = tileList(r.imageryZ, r.x0 * f, r.y0 * f, nx, ny);
  let done = 0;
  await pool(tiles, 16, async (t) => {
    const img = await loadImage(IMG_URL(r.imageryZ, t.x, t.y));
    if (img) ctx.drawImage(img, t.i * ts, t.j * ts, ts + 0.5, ts + 0.5);
    progress(++done / tiles.length);
  });
  return canvas;
}

export async function loadOSM() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/osm.json`);
  return res.json();
}

// ---- rasterização ----

function tracePath(ctx, coords, w, h) {
  coords.forEach(([lon, lat], i) => {
    const [u, v] = lonLatToUV(lon, lat);
    if (i === 0) ctx.moveTo(u * w, v * h);
    else ctx.lineTo(u * w, v * h);
  });
}

const RIVER_W = { river: 3, canal: 2.5, stream: 1.2 };

// Camada visual dos rios e lagos (textura RGBA transparente).
export function drawRivers(osm, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const s = size / 4096;
  ctx.fillStyle = 'rgba(20,50,90,0.85)';
  for (const lake of osm.lakes) {
    ctx.beginPath();
    for (const ring of lake.rings) tracePath(ctx, ring, size, size);
    ctx.fill('evenodd');
  }
  ctx.lineCap = ctx.lineJoin = 'round';
  for (const t of ['stream', 'canal', 'river']) {
    ctx.strokeStyle = t === 'river' ? 'rgba(170,235,225,0.85)' : 'rgba(170,235,225,0.45)';
    ctx.lineWidth = RIVER_W[t] * s * (t === 'river' ? 1 : 0.8);
    ctx.beginPath();
    for (const r of osm.rivers) if (r.t === t) tracePath(ctx, r.c, size, size);
    ctx.stroke();
  }
  return c;
}

// Contorno de municípios (grosso) e bairros (fino).
export function drawLimits(osm, size) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  const s = size / 4096;
  ctx.lineJoin = 'round';
  for (const lvl of [10, 8]) {
    ctx.strokeStyle = lvl === 8 ? 'rgba(255,240,200,0.9)' : 'rgba(255,255,255,0.45)';
    ctx.lineWidth = (lvl === 8 ? 2.2 : 0.9) * s;
    ctx.beginPath();
    for (const a of osm.areas) if (a.l === lvl) for (const ring of a.rings) tracePath(ctx, ring, size, size);
    ctx.stroke();
  }
  return c;
}

// Mapa célula -> índice da área (bairro onde há bairro, senão município).
export function rasterizeAreas(osm, W, H) {
  const list = [...osm.areas.filter((a) => a.l === 8), ...osm.areas.filter((a) => a.l === 10)];
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = false;
  list.forEach((a, i) => {
    const id = i + 1;
    ctx.fillStyle = `rgb(${id & 255},${id >> 8},0)`;
    ctx.beginPath();
    for (const ring of a.rings) tracePath(ctx, ring, W, H);
    ctx.fill('evenodd');
  });
  const px = ctx.getImageData(0, 0, W, H).data;
  const ids = new Uint16Array(W * H);
  for (let k = 0; k < W * H; k++) {
    // Bordas com antialiasing misturam cores; só aceita pixels opacos.
    if (px[k * 4 + 3] === 255) ids[k] = px[k * 4] | (px[k * 4 + 1] << 8);
  }
  const areas = list.map((a) => ({ name: a.n, level: a.l, municipio: null, cells: 0 }));
  for (let k = 0; k < W * H; k++) if (ids[k] && ids[k] <= areas.length) areas[ids[k] - 1].cells++;
  return { ids, areas };
}

// "Queima" os rios do OSM no relevo: ao longo de cada curso d'água (que no
// OSM é desenhado no sentido da correnteza) força o leito a só descer, e
// aprofunda um pouco o canal. Sem isso o ruído do SRTM, pontes e prédios
// represam os rios e a água não escoa.
export function burnRivers(osm, bed, W, H, depth = { river: 3, canal: 2, stream: 1 }, maxCut = 10) {
  const mask = new Uint8Array(W * H);
  const orig = bed.slice();
  const lower = (k, z) => (bed[k] = Math.min(bed[k], Math.max(z, orig[k] - maxCut)));
  // Duas passadas: os trechos de um mesmo rio vêm fora de ordem no OSM.
  for (let pass = 0; pass < 2; pass++) for (const r of osm.rivers) {
    const d = depth[r.t] ?? 1;
    const wide = r.t === 'river';
    let zRun = Infinity;
    for (let i = 1; i < r.c.length; i++) {
      const [u0, v0] = lonLatToUV(...r.c[i - 1]);
      const [u1, v1] = lonLatToUV(...r.c[i]);
      const steps = Math.max(1, Math.ceil(Math.hypot((u1 - u0) * W, (v1 - v0) * H) * 2));
      for (let s = 0; s <= steps; s++) {
        const x = Math.floor((u0 + ((u1 - u0) * s) / steps) * W);
        const y = Math.floor((v0 + ((v1 - v0) * s) / steps) * H);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const k = y * W + x;
        if (!mask[k]) zRun = Math.min(zRun, bed[k] - d);
        else zRun = Math.min(zRun, bed[k]);
        lower(k, zRun);
        mask[k] = wide ? 2 : 1;
        if (wide) {
          for (const kk of [k + 1, k + W]) {
            if (kk < W * H) {
              lower(kk, zRun);
              mask[kk] = 2;
            }
          }
        }
      }
    }
  }
  return mask;
}

export function rasterizeLakes(osm, W, H) {
  const c = new OffscreenCanvas(W, H);
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  for (const lake of osm.lakes) {
    ctx.beginPath();
    for (const ring of lake.rings) tracePath(ctx, ring, W, H);
    ctx.fill('evenodd');
  }
  const px = ctx.getImageData(0, 0, W, H).data;
  const mask = new Uint8Array(W * H);
  for (let k = 0; k < W * H; k++) mask[k] = px[k * 4 + 3] > 127 ? 1 : 0;
  return mask;
}

// Priority-flood (Barnes et al. 2014) a partir das bordas. Devolve o relevo
// preenchido (com inclinação mínima eps nas áreas preenchidas), a ordem em
// que as células saíram da fila e, para cada célula, a vizinha pela qual foi
// alcançada (o "próximo passo" rumo à borda).
function priorityFlood(bed, W, H, eps) {
  const n = W * H;
  const filled = new Float32Array(bed);
  const parent = new Int32Array(n).fill(-1);
  const order = new Int32Array(n);
  const done = new Uint8Array(n);
  const heap = new Int32Array(n);
  let size = 0, popped = 0;
  const less = (a, b) => filled[a] < filled[b];
  const push = (k) => {
    let i = size++;
    heap[i] = k;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (!less(heap[i], heap[p])) break;
      const t = heap[p]; heap[p] = heap[i]; heap[i] = t;
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    heap[0] = heap[--size];
    let i = 0;
    for (;;) {
      const l = 2 * i + 1, r = l + 1;
      let m = i;
      if (l < size && less(heap[l], heap[m])) m = l;
      if (r < size && less(heap[r], heap[m])) m = r;
      if (m === i) break;
      const t = heap[m]; heap[m] = heap[i]; heap[i] = t;
      i = m;
    }
    return top;
  };
  const seed = (k) => { if (!done[k]) { done[k] = 1; push(k); } };
  for (let x = 0; x < W; x++) { seed(x); seed((H - 1) * W + x); }
  for (let y = 1; y < H - 1; y++) { seed(y * W); seed(y * W + W - 1); }
  while (size) {
    const k = pop();
    order[popped++] = k;
    const x = k % W, z = filled[k];
    for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k >= W ? k - W : -1, k + W < n ? k + W : -1]) {
      if (j < 0 || done[j]) continue;
      done[j] = 1;
      parent[j] = k;
      if (filled[j] <= z) filled[j] = z + eps;
      push(j);
    }
  }
  return { filled, order, parent };
}

// Corrige depressões do relevo. O SRTM mede o topo de matas, prédios e
// aterros, que viram "barragens" falsas nos vales e prendem a chuva.
//   1. abre passagem: rebaixa o caminho de saída de cada depressão em até
//      maxCut metros (como o breach do WhiteboxTools, simplificado);
//   2. preenche o que sobrou, com inclinação mínima para escoar.
// maxDepth < Infinity mantém depressões mais fundas que isso (após o passo 1).
export function fillPits(bed, W, H, maxDepth = Infinity, { eps = 2e-3, maxCut = 5 } = {}) {
  const n = W * H;
  if (maxCut > 0) {
    const { order, parent } = priorityFlood(bed, W, H, eps);
    const orig = bed.slice();
    // de montante para jusante: o próximo passo nunca fica acima do atual
    for (let o = n - 1; o >= 0; o--) {
      const j = order[o], p = parent[j];
      if (p < 0) continue;
      const want = bed[j] - 1e-3;
      if (bed[p] > want) bed[p] = Math.max(want, orig[p] - maxCut);
    }
  }
  const { filled } = priorityFlood(bed, W, H, eps);
  if (maxDepth === Infinity) {
    let filledCells = 0;
    for (let k = 0; k < n; k++) if (filled[k] > bed[k]) { bed[k] = filled[k]; filledCells++; }
    return { filledCells, keptPits: 0 };
  }
  // componentes conectados de células preenchidas; mede a profundidade máxima
  const comp = new Int32Array(n).fill(-1);
  const stack = new Int32Array(n);
  let filledCells = 0, keptPits = 0;
  for (let s = 0; s < n; s++) {
    if (comp[s] !== -1 || filled[s] - bed[s] <= 0) continue;
    let top = 0, deepest = 0;
    const members = [];
    stack[top++] = s;
    comp[s] = s;
    while (top) {
      const k = stack[--top];
      members.push(k);
      deepest = Math.max(deepest, filled[k] - bed[k]);
      const x = k % W;
      for (const j of [x > 0 ? k - 1 : -1, x < W - 1 ? k + 1 : -1, k - W, k + W]) {
        if (j < 0 || j >= n || comp[j] !== -1 || filled[j] - bed[j] <= 0) continue;
        comp[j] = s;
        stack[top++] = j;
      }
    }
    if (deepest < maxDepth) {
      for (const k of members) bed[k] = filled[k];
      filledCells += members.length;
    } else keptPits++;
  }
  return { filledCells, keptPits };
}
