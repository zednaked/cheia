// Previsão sazonal x climatologia x El Niños passados, e a tradução disso em
// condições iniciais para a simulação (umidade do solo, nível dos rios,
// intensificação das tempestades pelo calor).

const SEASONAL = 'https://seasonal-api.open-meteo.com/v1/seasonal?latitude=-25.43&longitude=-49.27' +
  '&daily=precipitation_sum,temperature_2m_max&forecast_days=183&past_days=31';

export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const q = (arr, f) => {
  const a = [...arr].sort((x, y) => x - y);
  const p = f * (a.length - 1), i = Math.floor(p);
  return a[i] + (a[Math.min(i + 1, a.length - 1)] - a[i]) * (p - i);
};

async function fetchSeasonal() {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 10000);
  try {
    const res = await fetch(SEASONAL, { signal: ctl.signal });
    if (!res.ok) throw new Error(res.status);
    return { daily: (await res.json()).daily, fetched: new Date().toISOString().slice(0, 10), live: true };
  } finally {
    clearTimeout(t);
  }
}

export async function loadClimate() {
  const data = await (await fetch(`${import.meta.env.BASE_URL}data/clima.json`)).json();
  let seasonal;
  try {
    seasonal = await fetchSeasonal();
  } catch {
    seasonal = { ...data.seasonal, live: false };
  }
  return analyse(data, seasonal);
}

function analyse(data, seasonal) {
  const d = seasonal.daily;
  const members = Object.keys(d).filter((k) => k.startsWith('precipitation_sum'));
  const tKeys = Object.keys(d).filter((k) => k.startsWith('temperature_2m_max'));
  const obs = new Map(data.recent);
  const lastObs = data.recent.at(-1)[0];

  // Viés medido: dias em que há observação ERA5 e "passado" do modelo.
  let bObs = 0, bMod = 0, bDays = 0;
  const today = seasonal.fetched;
  d.time.forEach((t, i) => {
    if (t < today && obs.has(t) && d.precipitation_sum[i] != null) {
      bObs += obs.get(t);
      bMod += d.precipitation_sum[i];
      bDays++;
    }
  });

  // Por mês e por membro: total, maior chuva em 5 dias, máxima média.
  // Dias já observados usam o ERA5 em todos os membros.
  const byMonth = new Map();
  const run5 = members.map(() => []);
  d.time.forEach((t, i) => {
    const ym = t.slice(0, 7);
    if (!byMonth.has(ym)) {
      byMonth.set(ym, { ym, days: 0, obsDays: 0, total: members.map(() => 0), max5: members.map(() => 0), tsum: 0, tn: 0 });
    }
    const m = byMonth.get(ym);
    m.days++;
    const observed = obs.has(t);
    if (observed) m.obsDays++;
    members.forEach((k, j) => {
      const v = observed ? obs.get(t) : d[k][i] ?? 0;
      m.total[j] += v;
      run5[j].push(v);
      if (run5[j].length > 5) run5[j].shift();
      m.max5[j] = Math.max(m.max5[j], run5[j].reduce((s, x) => s + x, 0));
    });
    const tv = tKeys.map((k) => d[k][i]).filter((v) => v != null);
    if (tv.length && !observed) {
      m.tsum += tv.reduce((s, x) => s + x, 0) / tv.length;
      m.tn++;
    }
  });

  const months = [];
  for (const m of byMonth.values()) {
    const mo = +m.ym.slice(5);
    const [y] = m.ym.split('-').map(Number);
    const daysInMonth = new Date(y, mo, 0).getDate();
    if (m.days < daysInMonth || m.obsDays === m.days) continue; // só meses completos e com previsão
    const c = data.clim[mo];
    months.push({
      ym: m.ym,
      label: `${MONTHS[mo - 1]}/${String(y).slice(2)}`,
      mo,
      obsDays: m.obsDays,
      clim: c,
      fc: {
        p10: q(m.total, 0.1), p50: q(m.total, 0.5), p90: q(m.total, 0.9),
        wet: m.total.filter((v) => v > c.p67).length / m.total.length,
        dry: m.total.filter((v) => v < c.p33).length / m.total.length,
        max5: { p50: q(m.max5, 0.5), p90: q(m.max5, 0.9) },
        tanom: m.tn ? m.tsum / m.tn - c.tmax : 0,
        n: members.length,
      },
      analogs: data.analogs
        .map((a) => ({ year: a.year, oni: a.oni, m: a.months.find((x) => +x.ym.slice(5) === mo) }))
        .filter((a) => a.m),
    });
  }
  return {
    months,
    seasonal: { fetched: seasonal.fetched, live: seasonal.live, members: members.length },
    bias: { obs: bObs, model: bMod, days: bDays, lastObs },
    analogYears: data.analogs.map((a) => ({ year: a.year, oni: a.oni })),
  };
}

// ---- de condições do mês para parâmetros da simulação ----

// Condição de umidade antecedente do método SCS (Curva-Número), pela chuva dos
// 5 dias anteriores na estação de crescimento: < 35,6 mm I (seco), até 53,3 mm
// II (normal), acima III (encharcado).
const CN2 = 75;
const cnFor = (amc) => (amc === 1 ? (4.2 * CN2) / (10 - 0.058 * CN2) : amc === 3 ? (23 * CN2) / (10 + 0.13 * CN2) : CN2);
const retention = (cn) => 25400 / cn - 254;
export const BASE_LOSS = 15;   // mm/h na condição II
export const BASE_RIVER = 0.8; // m num mês normal

export function conditions(month, kind) {
  let total, max5, tanom, label;
  if (kind === 'p50' || kind === 'p90') {
    total = month.fc[kind];
    max5 = month.fc.max5[kind];
    tanom = month.fc.tanom;
    label = kind === 'p50' ? 'típico da previsão (mediana dos membros)' : 'chuvoso da previsão (só 1 em cada 10 membros chove mais)';
  } else {
    const a = month.analogs.find((x) => String(x.year) === kind);
    total = a.m.total;
    max5 = a.m.max5;
    tanom = a.m.tanom;
    label = `como em ${MONTHS[month.mo - 1]} de ${a.m.ym.slice(0, 4)} (El Niño de ${a.year}, ONI ${a.oni.toFixed(1).replace(".", ",")})`;
  }
  const amc = max5 < 35.6 ? 1 : max5 <= 53.3 ? 2 : 3;
  const loss = BASE_LOSS * (retention(cnFor(amc)) / retention(CN2));
  const river = Math.min(3, Math.max(0.3, (BASE_RIVER * total) / month.clim.p50));
  const stormFactor = 1.07 ** tanom; // Clausius-Clapeyron: ~7% por °C
  return { label, total, max5, tanom, amc, loss, river, stormFactor };
}
