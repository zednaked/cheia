// Chuva que varia no espaço: o temporal de 18/02/2025 (pluviômetros da
// Defesa Civil interpolados) e a previsão das próximas 48 horas (Open-Meteo,
// 16 pontos sobre a região). As duas viram um mapa de chuva em grade grossa
// que o shader interpola.
import { bbox, lonLatToUV } from './region.js';

// Inverso do quadrado da distância, dos pluviômetros para uma grade M×M.
function idw(stations, M) {
  const pts = stations.map((s) => ({ uv: lonLatToUV(...s.c), v: s.mm }));
  const out = new Float32Array(M * M);
  for (let j = 0; j < M; j++) {
    for (let i = 0; i < M; i++) {
      const u = (i + 0.5) / M, v = (j + 0.5) / M;
      let sw = 0, sv = 0;
      for (const p of pts) {
        const d2 = (p.uv[0] - u) ** 2 + (p.uv[1] - v) ** 2 + 1e-6;
        sw += 1 / d2;
        sv += p.v / d2;
      }
      out[j * M + i] = sv / sw;
    }
  }
  return out;
}

export async function loadEvent() {
  const ev = await (await fetch(`${import.meta.env.BASE_URL}data/evento-2025-02-18.json`)).json();
  const M = 32;
  const map = idw(ev.stations, M);
  const slot = ev.slotMin * 60;
  const [h0, m0] = ev.start.split(':').map(Number);
  const peakMm = Math.max(...ev.stations.map((s) => s.mm));
  return {
    kind: 'event',
    ev,
    duration: ev.shape.length * slot,
    // mapa em mm do dia inteiro; a forma no tempo distribui esse total
    setup(sim) {
      sim.setRainMap(map, M, M);
    },
    forcing(sim, t) {
      const i = Math.floor(t / slot);
      const f = i < ev.shape.length ? ev.shape[i] : 0;
      sim.mapScale = f / slot / 1000;
      return { uniform: 0, peak: (peakMm * f * 3600) / slot };
    },
    clock(t) {
      const m = h0 * 60 + m0 + Math.floor(t / 60);
      return { text: `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, sub: '18/02/2025' };
    },
  };
}

const FC_N = 4;

export async function loadForecast() {
  const b = bbox();
  const lat = [], lon = [];
  for (let j = 0; j < FC_N; j++) {
    for (let i = 0; i < FC_N; i++) {
      lat.push((b.north + ((b.south - b.north) * (j + 0.5)) / FC_N).toFixed(3));
      lon.push((b.west + ((b.east - b.west) * (i + 0.5)) / FC_N).toFixed(3));
    }
  }
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    '&hourly=precipitation&forecast_hours=48&timezone=America%2FSao_Paulo';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  const list = Array.isArray(data) ? data : [data];
  const times = list[0].hourly.time;
  const hours = times.map((_, h) => Float32Array.from(list, (p) => p.hourly.precipitation[h] ?? 0));
  const totals = Float32Array.from(list, (p) => p.hourly.precipitation.reduce((s, v) => s + (v ?? 0), 0));
  // a primeira hora do Open-Meteo é a que termina no horário marcado
  const start = new Date(new Date(times[0]).getTime() - 3600e3);
  let cur = -1;
  return {
    kind: 'forecast',
    duration: hours.length * 3600,
    start,
    maxTotal: Math.max(...totals),
    meanTotal: totals.reduce((s, v) => s + v, 0) / totals.length,
    maxHour: Math.max(...hours.map((h) => Math.max(...h))),
    setup(sim) {
      cur = -1;
      sim.mapScale = 1 / 3.6e6;
    },
    forcing(sim, t) {
      const i = Math.min(hours.length - 1, Math.floor(t / 3600));
      if (t > hours.length * 3600) {
        sim.mapScale = 0;
        return { uniform: 0, peak: 0 };
      }
      if (i !== cur) {
        cur = i;
        sim.setRainMap(hours[i], FC_N, FC_N);
      }
      sim.mapScale = 1 / 3.6e6;
      return { uniform: 0, peak: Math.max(...hours[i]) };
    },
    clock(t) {
      const d = new Date(start.getTime() + t * 1000);
      const p = (v) => String(v).padStart(2, '0');
      return { text: `${p(d.getHours())}:${p(d.getMinutes())}`, sub: `${p(d.getDate())}/${p(d.getMonth() + 1)} · previsão` };
    },
  };
}
