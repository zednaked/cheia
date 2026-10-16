// Baixa do OpenStreetMap (Overpass) os rios e os limites de municípios/bairros
// da região e grava public/data/osm.json, servido junto com o site.
import { writeFile } from 'node:fs/promises';
import { bbox } from '../src/region.js';

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const b = bbox();
const bb = `${b.south},${b.west},${b.north},${b.east}`;

async function overpass(q) {
  let wait = 5000;
  for (let attempt = 0; attempt < 9; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'cheia/0.1' },
        body: 'data=' + encodeURIComponent(q),
      });
      if (res.ok) return await res.json();
      console.log(`  ${new URL(url).host}: ${res.status}`);
    } catch (e) {
      console.log(`  ${new URL(url).host}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, wait));
    wait = Math.min(wait * 2, 60000);
  }
  throw new Error('Overpass indisponível');
}

const r5 = (v) => Math.round(v * 1e5) / 1e5;
const pts = (geom) => geom.map((p) => [r5(p.lon), r5(p.lat)]);

// Junta os trechos de uma relação em anéis fechados.
function joinRings(segments) {
  const rings = [];
  const pool = segments.map((s) => s.slice());
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];
  while (pool.length) {
    let ring = pool.pop();
    let grew = true;
    while (!same(ring[0], ring[ring.length - 1]) && grew) {
      grew = false;
      const end = ring[ring.length - 1];
      for (let i = 0; i < pool.length; i++) {
        const s = pool[i];
        if (same(s[0], end)) ring = ring.concat(s.slice(1));
        else if (same(s[s.length - 1], end)) ring = ring.concat(s.slice().reverse().slice(1));
        else continue;
        pool.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring.length > 3) rings.push(ring);
  }
  return rings;
}

console.log('rios…');
const water = await overpass(`[out:json][timeout:120];
(way["waterway"~"^(river|stream|canal)$"](${bb}););
out geom;`);
const rivers = water.elements
  .filter((e) => e.geometry)
  .map((e) => ({ n: e.tags.name || '', t: e.tags.waterway, c: pts(e.geometry) }));

console.log('lagos e represas…');
const lakesRes = await overpass(`[out:json][timeout:120];
(way["natural"="water"](${bb}); relation["natural"="water"](${bb}););
out geom;`);
const lakes = [];
for (const e of lakesRes.elements) {
  if (e.type === 'way' && e.geometry) lakes.push({ n: e.tags?.name || '', rings: [pts(e.geometry)] });
  if (e.type === 'relation') {
    const outer = e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => pts(m.geometry));
    const rings = joinRings(outer);
    if (rings.length) lakes.push({ n: e.tags?.name || '', rings });
  }
}

console.log('municípios e bairros…');
const adm = await overpass(`[out:json][timeout:180];
(relation["boundary"="administrative"]["admin_level"~"^(8|10)$"](${bb}););
out geom;`);
const areas = adm.elements
  .filter((e) => e.type === 'relation')
  .map((e) => ({
    n: e.tags.name,
    l: +e.tags.admin_level,
    rings: joinRings(e.members.filter((m) => m.role === 'outer' && m.geometry).map((m) => pts(m.geometry))),
  }))
  .filter((a) => a.rings.length);

const out = { bbox: b, fetched: new Date().toISOString(), rivers, lakes, areas };
await writeFile(new URL('../public/data/osm.json', import.meta.url), JSON.stringify(out));
console.log(`ok: ${rivers.length} rios, ${lakes.length} lagos, ${areas.length} áreas ` +
  `(${areas.filter((a) => a.l === 8).length} municípios, ${areas.filter((a) => a.l === 10).length} bairros)`);
