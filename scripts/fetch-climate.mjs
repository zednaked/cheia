// Gera public/data/clima.json: climatologia de Curitiba (ERA5, 1991-2020),
// os meses de out a abr dos El Niños fortes desde 1982 e uma cópia da previsão
// sazonal (ECMWF SEAS5 via Open-Meteo) para usar se a API falhar no navegador.
import { writeFile } from 'node:fs/promises';

const LAT = -25.43, LON = -49.27;
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const SEASONAL = 'https://seasonal-api.open-meteo.com/v1/seasonal';

// Pico do ONI (NOAA CPC) de cada El Niño forte; o ano é o do início do evento.
const STRONG_NINOS = [
  { year: 1982, oni: 2.2 }, { year: 1991, oni: 1.7 }, { year: 1997, oni: 2.4 },
  { year: 2009, oni: 1.6 }, { year: 2015, oni: 2.6 }, { year: 2023, oni: 2.0 },
];

async function get(url) {
  for (let i = 0; i < 4; i++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    console.log(`  ${res.status}, tentando de novo…`);
    await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
  }
  throw new Error(url);
}

const today = new Date().toISOString().slice(0, 10);
const end = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10); // ERA5 atrasa ~5 dias
console.log('ERA5 1981 →', end);
const era = (await get(`${ARCHIVE}?latitude=${LAT}&longitude=${LON}&start_date=1981-01-01&end_date=${end}` +
  '&daily=precipitation_sum,temperature_2m_max&timezone=America%2FSao_Paulo')).daily;

// por mês: total, maior chuva em 5 dias seguidos, média da máxima
const months = new Map();
for (let i = 0; i < era.time.length; i++) {
  const ym = era.time[i].slice(0, 7);
  if (!months.has(ym)) months.set(ym, { ym, total: 0, max5: 0, tsum: 0, n: 0 });
  const m = months.get(ym);
  m.total += era.precipitation_sum[i] ?? 0;
  m.tsum += era.temperature_2m_max[i] ?? 0;
  m.n++;
  let s5 = 0;
  for (let j = Math.max(0, i - 4); j <= i; j++) s5 += era.precipitation_sum[j] ?? 0;
  m.max5 = Math.max(m.max5, s5);
}
for (const m of months.values()) m.tmax = m.tsum / m.n;

const q = (arr, f) => {
  const a = [...arr].sort((x, y) => x - y);
  const p = f * (a.length - 1), i = Math.floor(p);
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (p - i);
};
const r1 = (v) => Math.round(v * 10) / 10;

const clim = {};
for (let mo = 1; mo <= 12; mo++) {
  const ms = [...months.values()].filter((m) => +m.ym.slice(0, 4) >= 1991 && +m.ym.slice(0, 4) <= 2020 && +m.ym.slice(5) === mo);
  const tot = ms.map((m) => m.total), m5 = ms.map((m) => m.max5);
  clim[mo] = {
    p10: r1(q(tot, 0.1)), p33: r1(q(tot, 1 / 3)), p50: r1(q(tot, 0.5)), p67: r1(q(tot, 2 / 3)), p90: r1(q(tot, 0.9)),
    max5_p50: r1(q(m5, 0.5)), max5_p90: r1(q(m5, 0.9)),
    tmax: r1(ms.reduce((s, m) => s + m.tmax, 0) / ms.length),
  };
}

const analogs = STRONG_NINOS.map(({ year, oni }) => {
  const list = [];
  for (const [y, mo] of [[year, 10], [year, 11], [year, 12], [year + 1, 1], [year + 1, 2], [year + 1, 3], [year + 1, 4]]) {
    const m = months.get(`${y}-${String(mo).padStart(2, '0')}`);
    if (m && m.n >= 28) list.push({ ym: m.ym, total: r1(m.total), max5: r1(m.max5), tanom: r1(m.tmax - clim[mo].tmax) });
  }
  return { year, oni, months: list };
});

// últimos 45 dias observados (para a umidade antecedente do mês corrente)
const recent = [];
for (let i = Math.max(0, era.time.length - 45); i < era.time.length; i++) {
  recent.push([era.time[i], r1(era.precipitation_sum[i] ?? 0)]);
}

console.log('SEAS5…');
const seasonal = await get(`${SEASONAL}?latitude=${LAT}&longitude=${LON}&daily=precipitation_sum,temperature_2m_max` +
  '&forecast_days=183&past_days=31');

const out = {
  place: 'Curitiba (ponto ERA5 mais próximo de -25,43, -49,27)',
  built: today,
  clim, analogs, recent,
  seasonal: { fetched: today, daily: seasonal.daily },
};
await writeFile(new URL('../public/data/clima.json', import.meta.url), JSON.stringify(out));
console.log('ok', Object.keys(clim).length, 'meses de climatologia,', analogs.length, 'El Niños,', recent.length, 'dias recentes');
for (const a of analogs) console.log(a.year, a.months.map((m) => `${m.ym.slice(2)} ${Math.round(m.total)}`).join(' | '));
