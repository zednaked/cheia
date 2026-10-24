// Roda as próximas 48 h de previsão (Open-Meteo, o mesmo modo "previsão" do
// app) no simulador, na GPU, e registra antes da chuva o que o modelo espera:
// - nos 18 pontos de alagamento de 18/02/2025: pico da lâmina, quando passou
//   de 30 cm e a maior classe de perigo (mesmo critério de analise-pontos.mjs);
// - por bairro: área que passou de 30 cm, km de rua e lugares com água na porta.
// Guarda também a previsão crua usada e uma captura no pico da chuva.
// Saída: docs/previsao-AAAA-MM-DD/. Uso: node scripts/previsao.mjs
import { mkdir, writeFile } from 'node:fs/promises';
import { openPage } from '../test/cdp.mjs';

const FLOOD = 0.3;
const SAMPLE = 300; // s simulados entre leituras dos pontos
const AFTER = 2 * 3600; // a água continua escoando depois da última hora de chuva

const root = new URL('..', import.meta.url).pathname;
const now = new Date();
const dia = now.toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
const out = `${root}docs/previsao-${dia}`;
await mkdir(out, { recursive: true });

const page = await openPage('index.html#m=fc', { gpu: true, onLog: (m) => /erro|Open-Meteo/.test(m) && console.log(m) });
try {
  await page.waitFor('!!window.cheia', 180000);
  await page.waitFor(`document.getElementById('clock-sub').textContent.includes('previsão')`, 300000);
  // a mesma consulta de src/chuva.js (16 pontos), guardada como prova do que entrou
  const fc = JSON.parse(await page.evaluate(`(async () => {
    const { bbox } = await import('/src/region.js');
    const b = bbox(), N = 4, lat = [], lon = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      lat.push((b.north + ((b.south - b.north) * (j + 0.5)) / N).toFixed(3));
      lon.push((b.west + ((b.east - b.west) * (i + 0.5)) / N).toFixed(3));
    }
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&hourly=precipitation&forecast_hours=48&timezone=America%2FSao_Paulo';
    return JSON.stringify({ url, data: await (await fetch(url)).json() });
  })()`));
  await writeFile(`${out}/open-meteo.json`, JSON.stringify(fc));
  const list = Array.isArray(fc.data) ? fc.data : [fc.data];
  const times = list[0].hourly.time;
  const maxPorHora = times.map((_, h) => Math.max(...list.map((p) => p.hourly.precipitation[h] ?? 0)));
  const hPico = maxPorHora.indexOf(Math.max(...maxPorHora));
  const totais = list.map((p) => p.hourly.precipitation.reduce((s, v) => s + (v ?? 0), 0));

  await page.evaluate(`(async () => {
    const { lonLatToUV } = await import('/src/region.js');
    const ev = await (await fetch('data/evento-2025-02-18.json')).json();
    const { W, H } = cheia.sim;
    window.pts = ev.points.map((q) => {
      const [u, v] = lonLatToUV(...q.c);
      return { n: q.n, b: q.b, i: Math.floor(u * W), j: Math.floor(v * H), t30: null, pico: 0, tPico: 0, perigo: 0 };
    });
    const e = document.getElementById('speed'); e.value = 80; e.dispatchEvent(new Event('input'));
  })()`);
  const until = times.length * 3600 + AFTER;
  let shot = false;
  for (let last = -Infinity; ;) {
    const t = await page.evaluate('cheia.sim.time');
    if (t >= until) break;
    if (!shot && t >= (hPico + 1) * 3600) {
      shot = true;
      await writeFile(`${out}/pico.png`, await page.screenshot());
    }
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
  await writeFile(`${out}/fim.png`, await page.screenshot());
  const r = JSON.parse(await page.evaluate(`(async () => {
    const b = await cheia.sim.read(), { ids, areas, sim, pois, riverMask, roads } = cheia, cell = sim.dx * sim.dx, W = sim.W;
    const total = {}, wet = {}, rua = {}, lugares = {};
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
    }
    for (const p of pois) {
      let m = 0;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const kk = p.cell + dj * W + di;
        if (riverMask[kk] || b[kk * 4 + 2] < 0) continue;
        m = Math.max(m, b[kk * 4 + 1]);
      }
      const n = name(p.cell);
      if (m > ${FLOOD} && n !== null) (lugares[n] ||= []).push({ n: p.n || null, k: p.k, h: +m.toFixed(2) });
    }
    return JSON.stringify({ nomes: areas.map((a) => a.name), pts: pts.map(({ i, j, ...q }) => ({ ...q, pico: +q.pico.toFixed(2), perigo: Math.round(q.perigo) })), total, wet, rua, lugares });
  })()`));
  const bairros = Object.keys(r.wet)
    .filter((n) => r.total[n] > 5e5)
    .map((n) => ({ n: r.nomes[n], km2: +(r.wet[n] / 1e6).toFixed(2), fracao: +(r.wet[n] / r.total[n]).toFixed(3), ruaKm: +((r.rua[n] || 0) / 1000).toFixed(1), lugares: r.lugares[n] || [] }))
    .sort((a, b) => b.fracao - a.fracao);
  const result = {
    geradoEm: now.toISOString(),
    previsao: { inicio: times[0], horas: times.length, maxTotalMm: +Math.max(...totais).toFixed(1), mediaTotalMm: +(totais.reduce((s, v) => s + v, 0) / totais.length).toFixed(1), picoMmH: +maxPorHora[hPico].toFixed(1), horaPico: times[hPico] },
    criterio: { FLOOD, caixa: '3 × 3 células', amostra: SAMPLE },
    pontos: r.pts,
    bairros,
  };
  await writeFile(`${out}/resultado.json`, JSON.stringify(result, null, 1));
  const p = result.previsao;
  console.log(`previsão desde ${p.inicio}: até ${p.maxTotalMm} mm, média ${p.mediaTotalMm} mm, pico ${p.picoMmH} mm/h às ${p.horaPico}`);
  const molhados = r.pts.filter((q) => q.t30 !== null);
  console.log(`pontos de 18/02/2025 com mais de 30 cm: ${molhados.length} de ${r.pts.length}`);
  for (const q of r.pts) console.log(`  ${`${q.b}: ${q.n}`.slice(0, 50).padEnd(52)}${String(Math.round(q.pico * 100)).padStart(4)} cm  H${q.perigo}${q.t30 === null ? '' : `  >30 cm em ${Math.round(q.t30 / 3600)} h`}`);
  console.log('bairros (fração acima de 30 cm):', bairros.slice(0, 12).map((b) => `${b.n} ${(b.fracao * 100).toFixed(1)}%`).join(', '));
} finally {
  await page.close();
}
