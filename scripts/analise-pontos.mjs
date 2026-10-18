// Roda as chuvas de projeto no simulador (Chromium sem tela, na GPU) e mede:
// - nos 18 pontos de alagamento de 18/02/2025: pico da lâmina, quando passou
//   de 30 cm e a maior classe de perigo, num quadrado de 3 × 3 células em volta;
// - por bairro: área que passou de 30 cm no pico, em km² e em fração do bairro.
// O que já estava molhado antes da chuva (calha, várzea, lagos) não conta.
// Saída: docs/analise.json. Uso: node scripts/analise-pontos.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { openPage } from '../test/cdp.mjs';

const STORMS = [
  ['2,60', 'TR 2 anos, 1 h'],
  ['10,60', 'TR 10 anos, 1 h'],
  ['25,180', 'TR 25 anos, 3 h'],
  ['100,60', 'TR 100 anos, 1 h'],
];
const FLOOD = 0.3;
const SAMPLE = 300; // s simulados entre leituras dos pontos

const root = new URL('..', import.meta.url).pathname;
const osm = JSON.parse(await readFile(`${root}public/data/osm.json`, 'utf8'));

// município de cada bairro: o que contém o centroide do maior anel
function inside(x, y, ring) {
  let c = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[j];
    if (y1 > y !== y2 > y && x < ((x2 - x1) * (y - y1)) / (y2 - y1) + x1) c = !c;
  }
  return c;
}
// mesma ordem de rasterizeAreas (src/data.js): municípios, depois bairros
const munis = osm.areas.filter((a) => a.l === 8);
const muniOf = [...munis, ...osm.areas.filter((a) => a.l === 10)].map((a) => {
  if (a.l === 8) return a.n;
  const r = a.rings.reduce((m, x) => (x.length > m.length ? x : m));
  const x = r.reduce((s, p) => s + p[0], 0) / r.length, y = r.reduce((s, p) => s + p[1], 0) / r.length;
  return munis.find((m) => m.rings.some((rr) => inside(x, y, rr)))?.n ?? '?';
});

const result = { geradoEm: new Date().toISOString(), criterio: { FLOOD, caixa: '3 × 3 células', amostra: SAMPLE }, chuvas: {} };
for (const [p, label] of STORMS) {
  const page = await openPage(`index.html#p=${p}`, { gpu: true, onLog: (m) => /erro/.test(m) && console.log(m) });
  try {
    await page.waitFor('!!window.cheia', 180000);
    await page.waitFor(`document.getElementById('clock-sub').textContent === 'tempo simulado'`, 300000);
    await page.evaluate(`(async () => {
      const { lonLatToUV } = await import('/src/region.js');
      const ev = await (await fetch('data/evento-2025-02-18.json')).json();
      const { W, H } = cheia.sim;
      window.pts = ev.points.map((q) => {
        const [u, v] = lonLatToUV(...q.c);
        return { n: q.n, b: q.b, i: Math.floor(u * W), j: Math.floor(v * H), t30: null, pico: 0, tPico: 0, perigo: 0 };
      });
      const e = document.getElementById('speed'); e.value = 80; e.dispatchEvent(new Event('input'));
      document.getElementById('play').click();
    })()`);
    const dur = +p.split(',')[1] * 60;
    const until = dur + 2 * 3600;
    for (let last = -Infinity; ;) {
      const t = await page.evaluate('cheia.sim.time');
      if (t >= until) break;
      if (t - last >= SAMPLE) {
        last = t;
        await page.evaluate(`(async () => {
          const b = await cheia.sim.read(), W = cheia.sim.W, t = cheia.sim.time;
          for (const q of pts) {
            let h = 0, hz = 0;
            for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
              const k = ((q.j + dj) * W + q.i + di) * 4;
              if (b[k + 2] < 0) continue;
              h = Math.max(h, b[k]);
              hz = Math.max(hz, b[k + 3]);
            }
            if (h > q.pico) { q.pico = h; q.tPico = t; }
            if (q.t30 === null && h > ${FLOOD}) q.t30 = t;
            q.perigo = Math.max(q.perigo, hz);
          }
        })()`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    const r = JSON.parse(await page.evaluate(`(async () => {
      const b = await cheia.sim.read(), { ids, areas, sim, pois, riverMask, roads } = cheia, cell = sim.dx * sim.dx, W = sim.W;
      const total = {}, wet = {}, rua = {}, ruaPerigo = {}, lugares = {};
      // chave = índice da área: há vários "Centro" na região
      const name = (k) => (ids[k] && areas[ids[k] - 1].level !== 8 ? ids[k] - 1 : null);
      for (let k = 0; k < ids.length; k++) {
        const n = name(k);
        if (n === null) continue;
        total[n] = (total[n] || 0) + cell;
        if (riverMask[k] || b[k * 4 + 2] < 0) continue;
        if (b[k * 4 + 1] > ${FLOOD}) {
          wet[n] = (wet[n] || 0) + cell;
          rua[n] = (rua[n] || 0) + roads[k];
        }
        if (b[k * 4 + 3] >= 2) ruaPerigo[n] = (ruaPerigo[n] || 0) + roads[k];
      }
      // mesmo critério do painel "Lugares": pico em 3 × 3 células, fora da calha
      for (const p of pois) {
        let m = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          const kk = p.cell + dj * W + di;
          if (riverMask[kk] || b[kk * 4 + 2] < 0) continue;
          m = Math.max(m, b[kk * 4 + 1]);
        }
        const n = name(p.cell);
        if (m > ${FLOOD} && n !== null) (lugares[n] ||= []).push({ n: p.n || null, k: p.k, h: +m.toFixed(2), c: p.c });
      }
      const nomes = areas.map((a) => a.name);
      return JSON.stringify({ nomes, pts: pts.map(({ i, j, ...q }) => ({ ...q, pico: +q.pico.toFixed(2), perigo: Math.round(q.perigo) })), total, wet, rua, ruaPerigo, lugares });
    })()`));
    const bairros = Object.keys(r.wet)
      .filter((n) => r.total[n] > 5e5) // bairros com menos de 0,5 km² na grade ficam de fora
      .map((n) => ({
        n: r.nomes[n], municipio: muniOf[n] ?? '?', km2: +(r.wet[n] / 1e6).toFixed(2), fracao: +(r.wet[n] / r.total[n]).toFixed(3),
        ruaKm: +((r.rua[n] || 0) / 1000).toFixed(1), ruaPerigoKm: +((r.ruaPerigo[n] || 0) / 1000).toFixed(1),
        lugares: (r.lugares[n] || []).sort((a, b) => b.h - a.h),
      }))
      .sort((a, b) => b.fracao - a.fracao);
    result.chuvas[label] = { pontos: r.pts, bairros };
    console.log(`${label}: ok`);
  } finally {
    await page.close();
  }
}
// Prioridade social, na chuva de 10 anos: serviços essenciais com mais de 30 cm
// na porta, com peso pelo quanto a população depende deles numa emergência,
// mais os km de rua onde a água passa a arrastar carro (perigo H2 ou mais).
const PESO = { hospital: 5, asilo: 5, saúde: 3, creche: 3, escola: 2, bombeiros: 2, polícia: 1 };
result.prioridade = {
  chuva: 'TR 10 anos, 1 h', pesos: PESO, kmRuaPerigo: 1,
  bairros: result.chuvas['TR 10 anos, 1 h'].bairros
    .map((b) => {
      const conta = {};
      for (const l of b.lugares) conta[l.k] = (conta[l.k] || 0) + 1;
      const pontos = Object.entries(conta).reduce((s, [k, v]) => s + PESO[k] * v, 0) + b.ruaPerigoKm;
      return { n: b.n, municipio: b.municipio, pontos: +pontos.toFixed(1), lugares: conta, ruaPerigoKm: b.ruaPerigoKm, fracao: b.fracao };
    })
    .sort((a, b) => b.pontos - a.pontos)
    .slice(0, 30),
};
await writeFile(`${root}docs/analise.json`, JSON.stringify(result, null, 1));

// resumo no terminal
const L = Object.keys(result.chuvas);
const fmt = (q) => `${String(Math.round(q.pico * 100)).padStart(4)} cm ${q.t30 === null ? '     -' : `${String(Math.round(q.t30 / 60)).padStart(3)} min`} H${q.perigo}`;
console.log(`\n${'ponto'.padEnd(46)}${L.map((l) => l.padEnd(22)).join('')}`);
result.chuvas[L[0]].pontos.forEach((q, i) => {
  console.log(`${`${q.b}: ${q.n}`.slice(0, 45).padEnd(46)}${L.map((l) => fmt(result.chuvas[l].pontos[i]).padEnd(22)).join('')}`);
});
for (const l of L) {
  const top = (f) => result.chuvas[l].bairros.filter(f).slice(0, 10).map((b) => `${b.n} (${b.municipio === 'Curitiba' ? '' : `${b.municipio}, `}${(b.fracao * 100).toFixed(1)}%)`).join(', ');
  console.log(`\n${l}\n  Curitiba: ${top((b) => b.municipio === 'Curitiba')}\n  RMC: ${top((b) => b.municipio !== 'Curitiba')}`);
}
console.log('\nprioridade social (TR 10 anos, 1 h)');
result.prioridade.bairros.slice(0, 15).forEach((b, i) => console.log(`  ${i + 1}. ${b.n} (${b.municipio}) ${b.pontos} · ${JSON.stringify(b.lugares)} · ${b.ruaPerigoKm} km de rua H2+`));
