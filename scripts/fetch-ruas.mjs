// Malha viária do OSM, em 64 pedaços para o Overpass aguentar. Só o
// bake-terrain usa: ele grava, por célula, quantos metros de rua ela tem.
// O arquivo bruto (dezenas de MB) fica em .cache/, fora do git e do site.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { bbox } from '../src/region.js';
import { overpass } from './overpass.mjs';

const b = bbox();
const K = 8;
const MAIN = /^(motorway|trunk|primary|secondary)(_link)?$/;
const r5 = (v) => Math.round(v * 1e5) / 1e5;
const CACHE = new URL('../.cache/ruas/', import.meta.url);
await mkdir(CACHE, { recursive: true });
const seen = new Set();
const roads = [];
const QUERY = (s, w, n, e) => `[out:json][timeout:120];
way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street)(_link)?$"](${s},${w},${n},${e});
out geom qt;`;

// Um pedaço; se o Overpass não der conta, divide em quatro e tenta de novo.
async function piece(name, s, w, n, e, depth = 0) {
  // cada pedaço fica guardado: se o Overpass cair no meio, rodar de novo continua daqui
  const file = new URL(`${name}.json`, CACHE);
  let res;
  try {
    res = JSON.parse(await readFile(file));
  } catch {
    try {
      res = await overpass(QUERY(s, w, n, e), depth < 2 ? 4 : 9);
    } catch (err) {
      if (depth >= 2) throw err;
      console.log(`  ${name}: dividindo em 4`);
      const ms = (s + n) / 2, mw = (w + e) / 2;
      await piece(`${name}a`, s, w, ms, mw, depth + 1);
      await piece(`${name}b`, s, mw, ms, e, depth + 1);
      await piece(`${name}c`, ms, w, n, mw, depth + 1);
      await piece(`${name}d`, ms, mw, n, e, depth + 1);
      return;
    }
    await writeFile(file, JSON.stringify(res));
  }
  for (const el of res.elements) {
    if (!el.geometry || seen.has(el.id)) continue;
    seen.add(el.id);
    roads.push({ m: MAIN.test(el.tags.highway) ? 1 : 0, c: el.geometry.map((p) => [r5(p.lon), r5(p.lat)]) });
  }
}

for (let j = 0; j < K; j++) {
  for (let i = 0; i < K; i++) {
    console.log(`ruas ${j * K + i + 1}/${K * K}…`);
    await piece(`${j}-${i}`,
      b.south + ((b.north - b.south) * j) / K, b.west + ((b.east - b.west) * i) / K,
      b.south + ((b.north - b.south) * (j + 1)) / K, b.west + ((b.east - b.west) * (i + 1)) / K);
  }
}
await writeFile(new URL('../.cache/ruas.json', import.meta.url), JSON.stringify({ roads }));
console.log(`ok: ${roads.length} vias; agora rode npm run bake`);
