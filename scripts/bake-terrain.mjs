// Pré-processa o relevo: baixa os tiles Terrarium (SRTM), queima os rios do
// OSM, abre as barragens falsas e preenche as depressões, e grava o resultado
// em public/data/terreno.bin.gz. O navegador só descompacta: não depende do
// S3 da AWS estar no ar e todo mundo simula sobre o mesmo leito.
//
// Formato (tudo little-endian, depois gzip):
//   Int32 W, H, Q            Q = unidades por metro
//   Int32[W*H]  leito com rios queimados, em 1/Q m, diferença para a célula à esquerda
//   Int32[W*H]  leito preenchido ("todas") menos o anterior, em 1/Q m
//   Uint8[W*H]  calha: 0 terra, 1 córrego/canal, 2 rio
//   Uint8[W*H]  metros de rua na célula (0-255), todas as vias
//   Uint8[W*H]  metros de via principal na célula (trunk, primary, secondary)
import { readFile, writeFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { REGION, lonLatToUV } from '../src/region.js';
import { burnRivers, fillPits } from '../src/data.js';
import { decodePNG } from './png.mjs';

const Q = 1024;
const r = REGION;
const W = r.nx * 256, H = r.ny * 256;
const DEM_URL = (z, x, y) => `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

async function get(url) {
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
    } catch {}
    await new Promise((ok) => setTimeout(ok, 1000 * (i + 1)));
  }
  throw new Error(`falhou: ${url}`);
}

console.log('relevo…');
const bed = new Float32Array(W * H);
for (let j = 0; j < r.ny; j++) {
  for (let i = 0; i < r.nx; i++) {
    const { rgb } = decodePNG(await get(DEM_URL(r.z, r.x0 + i, r.y0 + j)));
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const s = (y * 256 + x) * 3;
        bed[(j * 256 + y) * W + i * 256 + x] = rgb[s] * 256 + rgb[s + 1] + rgb[s + 2] / 256 - 32768;
      }
    }
  }
}

const osm = JSON.parse(await readFile(new URL('../public/data/osm.json', import.meta.url)));
console.log('rios…');
const riverMask = burnRivers(osm, bed, W, H);
const burned = Int32Array.from(bed, (z) => Math.round(z * Q));
console.log('depressões…');
const filledF = Float32Array.from(burned, (z) => z / Q);
const t0 = performance.now();
fillPits(filledF, W, H, Infinity);
console.log(`  ${((performance.now() - t0) / 1000).toFixed(1)} s`);

// ruas: metros de via por célula, amostrando cada segmento a cada ~5 m
const roadsAll = new Float32Array(W * H), roadsMain = new Float32Array(W * H);
let roadKm = 0;
try {
  const { roads } = JSON.parse(await readFile(new URL('../.cache/ruas.json', import.meta.url)));
  const dxm = 40075016.686 * Math.cos((-25.47 * Math.PI) / 180) / (256 * 2 ** r.z);
  for (const road of roads) {
    for (let i = 1; i < road.c.length; i++) {
      const [u0, v0] = lonLatToUV(...road.c[i - 1]), [u1, v1] = lonLatToUV(...road.c[i]);
      const len = Math.hypot((u1 - u0) * W, (v1 - v0) * H) * dxm;
      const n = Math.max(1, Math.ceil(len / 5));
      for (let s = 0; s < n; s++) {
        const x = Math.floor((u0 + ((u1 - u0) * (s + 0.5)) / n) * W);
        const y = Math.floor((v0 + ((v1 - v0) * (s + 0.5)) / n) * H);
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        roadsAll[y * W + x] += len / n;
        if (road.m) roadsMain[y * W + x] += len / n;
        roadKm += len / n / 1000;
      }
    }
  }
  console.log(`  ruas: ${Math.round(roadKm)} km`);
} catch (e) {
  console.log(`  sem ruas (${e.message}); rode npm run data`);
}

const head = new Int32Array([W, H, Q]);
const delta = new Int32Array(W * H), fill = new Int32Array(W * H);
for (let k = 0; k < W * H; k++) {
  delta[k] = k % W ? burned[k] - burned[k - 1] : burned[k];
  fill[k] = Math.round(filledF[k] * Q) - burned[k];
}
const u8 = (a) => Uint8Array.from(a, (v) => Math.min(255, Math.round(v)));
const parts = [head, delta, fill, riverMask, u8(roadsAll), u8(roadsMain)].map((a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength));
const gz = gzipSync(Buffer.concat(parts), { level: 9 });
await writeFile(new URL('../public/data/terreno.bin.gz', import.meta.url), gz);
console.log(`ok: ${W}×${H}, ${(gz.length / 1e6).toFixed(2)} MB`);
