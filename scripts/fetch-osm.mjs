// Baixa do OpenStreetMap (Overpass) os rios e os limites de municípios/bairros
// da região e grava public/data/osm.json, servido junto com o site.
import { writeFile } from 'node:fs/promises';
import { bbox } from '../src/region.js';
import { overpass } from './overpass.mjs';

const b = bbox();
const bb = `${b.south},${b.west},${b.north},${b.east}`;

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

// Lugares que importam numa cheia: onde estão crianças, doentes e o socorro.
console.log('escolas, saúde e socorro…');
const POI_KIND = {
  school: 'escola', kindergarten: 'creche', college: 'escola', university: 'escola',
  hospital: 'hospital', clinic: 'saúde', doctors: 'saúde',
  fire_station: 'bombeiros', police: 'polícia', nursing_home: 'asilo', social_facility: 'asilo',
};
const poiRes = await overpass(`[out:json][timeout:180];
(nwr["amenity"~"^(${Object.keys(POI_KIND).join('|')})$"](${bb}););
out center tags;`);
const seen = new Set();
const pois = [];
for (const e of poiRes.elements) {
  const lon = e.lon ?? e.center?.lon, lat = e.lat ?? e.center?.lat;
  const a = e.tags?.amenity;
  if (lon == null || !POI_KIND[a]) continue;
  if (a === 'social_facility' && !/senior|elder|idos/i.test(e.tags['social_facility:for'] || e.tags.social_facility || '')) continue;
  const key = `${a}${e.tags.name || ''}${r5(lon).toFixed(3)}${r5(lat).toFixed(3)}`;
  if (seen.has(key)) continue;
  seen.add(key);
  pois.push({ n: e.tags.name || '', k: POI_KIND[a], c: [r5(lon), r5(lat)] });
}

const out = { bbox: b, fetched: new Date().toISOString(), rivers, lakes, areas, pois };
await writeFile(new URL('../public/data/osm.json', import.meta.url), JSON.stringify(out));
console.log(`ok: ${rivers.length} rios, ${lakes.length} lagos, ${areas.length} áreas ` +
  `(${areas.filter((a) => a.l === 8).length} municípios, ${areas.filter((a) => a.l === 10).length} bairros), ` +
  `${pois.length} lugares`);
