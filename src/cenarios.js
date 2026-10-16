// Painel "Próximos meses": gráfico de chuva mensal (normal x previsão x El
// Niños passados), temperatura, e o montador de cenários que ajusta a
// simulação.
import { loadClimate, conditions, MONTHS, BASE_LOSS, BASE_RIVER } from './clima.js';

const $ = (id) => document.getElementById(id);
const fmt = (v, d = 0) => v.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
const signed = (v, d = 1) => (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), d);
const AMC = { 1: 'seco', 2: 'normal', 3: 'encharcado' };

export function setupScenarios({ presets, idf, run }) {
  const panel = $('scen');
  let C = null;

  $('open-scen').addEventListener('click', async () => {
    panel.hidden = false;
    if (C) return;
    $('scen-body').innerHTML = '<p class="sub">carregando previsão sazonal…</p>';
    try {
      C = await loadClimate();
      render();
    } catch (e) {
      $('scen-body').innerHTML = `<p class="sub">Não foi possível carregar os dados climáticos (${e.message}).</p>`;
    }
  });
  $('close-scen').addEventListener('click', () => (panel.hidden = true));
  addEventListener('keydown', (e) => e.key === 'Escape' && (panel.hidden = true));

  function render() {
    const { months, seasonal, bias } = C;
    const biasPct = bias.obs > 0 ? Math.round((100 * (bias.model - bias.obs)) / bias.obs) : 0;
    $('scen-body').innerHTML = `
      <p class="ctx"><b>Contexto em 16/out/2026:</b> a NOAA mantém alerta de El Niño, com evento
        forte a muito forte provável até março de 2027
        (<a href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.html" target="_blank" rel="noopener">CPC, 8/out</a>).
        No Sul do Brasil, El Niño forte costuma trazer primavera e verão mais chuvosos.</p>

      <div class="legend-row">
        <span><i class="sw band"></i>normal 1991–2020 (8 em cada 10 anos)</span>
        <span><i class="sw dot fc"></i>previsão ECMWF, ${seasonal.members} membros</span>
        <span><i class="sw dot an"></i>El Niños fortes de 1982 a 2023</span>
      </div>
      <div class="chart-wrap">${chart(months)}<div id="chart-tip" class="panel" hidden></div></div>

      <div class="mgrid" style="--n:${months.length}">
        <div class="rowlabel">chance de mês chuvoso</div>
        ${months.map((m) => `<div class="cell ${m.fc.wet >= 0.5 ? 'hot' : ''}">${Math.round(m.fc.wet * 100)}%</div>`).join('')}
        <div class="rowlabel">temperatura máx. vs normal</div>
        ${months.map((m) => `<div class="cell">${signed(m.fc.tanom)} °C</div>`).join('')}
      </div>
      <p class="note">"Mês chuvoso" = acima do terço mais úmido dos anos de 1991 a 2020. Num ano qualquer
        essa chance é 33%.</p>

      <details class="caveat"><summary>Quanto confiar nisso</summary>
        <p>Previsão sazonal diz se o mês tende a ser mais ou menos chuvoso, não em que dia vai chover.
          Ela não foi corrigida pelo viés do modelo: nos ${bias.days} dias até ${bias.lastObs.split('-').reverse().join('/')}
          o modelo marcou <b>${fmt(bias.model)} mm</b> em Curitiba onde a reanálise ERA5 registrou
          <b>${fmt(bias.obs)} mm</b> (${signed(biasPct, 0)}%). É pouco tempo para corrigir, mas indica
          que a previsão pode estar úmida demais. Os El Niños passados (pontos laranja) são medição,
          não modelo, e servem de contraprova. Dados: ECMWF SEAS5 e ERA5 via Open-Meteo${seasonal.live ? '' : ` (cópia de ${seasonal.fetched}; a API não respondeu)`}.</p>
      </details>

      <h3>Montar um cenário</h3>
      <div class="builder">
        <label>Mês <select id="sc-month">${months.map((m, i) => `<option value="${i}">${m.label}</option>`).join('')}</select></label>
        <label>Condição do mês <select id="sc-kind"></select></label>
        <label>Tempestade <select id="sc-storm">${presets.map((p) => `<option value="${p.value}">${p.text}</option>`).join('')}</select></label>
      </div>
      <div id="sc-out"></div>
      <div class="buttons"><button id="sc-run" class="primary">▶ Rodar este cenário no mapa</button></div>

      <details class="caveat"><summary>Tabela com os números</summary>${table(months)}</details>`;

    // dicas no gráfico
    const tip = $('chart-tip');
    $('scen-body').querySelectorAll('.col-hit').forEach((el) => {
      el.addEventListener('pointerenter', () => {
        const m = months[+el.dataset.i];
        tip.innerHTML = `<b>${m.label}</b><br>
          Normal: ${fmt(m.clim.p50)} mm (8 em 10 anos entre ${fmt(m.clim.p10)} e ${fmt(m.clim.p90)})<br>
          Previsão: ${fmt(m.fc.p50)} mm (faixa ${fmt(m.fc.p10)}–${fmt(m.fc.p90)})${m.obsDays ? `, ${m.obsDays} dias já observados` : ''}<br>
          ${m.analogs.map((a) => `${a.m.ym.slice(0, 4)}: ${fmt(a.m.total)} mm`).join(' · ')}`;
        tip.hidden = false;
        const r = el.getBoundingClientRect(), w = el.closest('.chart-wrap').getBoundingClientRect();
        tip.style.left = `${Math.min(r.left - w.left + r.width, w.width - 260)}px`;
        tip.style.top = '8px';
      });
      el.addEventListener('pointerleave', () => (tip.hidden = true));
    });

    const fillKinds = () => {
      const m = months[+$('sc-month').value];
      $('sc-kind').innerHTML = `
        <option value="p90">Chuvoso (previsão, 90%)</option>
        <option value="p50">Típico (previsão, mediana)</option>
        ${m.analogs.map((a) => `<option value="${a.year}">Como em ${a.m.ym.slice(0, 4)} (El Niño ${a.year})</option>`).join('')}`;
    };
    const show = () => {
      const m = months[+$('sc-month').value];
      const c = conditions(m, $('sc-kind').value);
      const [T, t] = $('sc-storm').value.split(',').map(Number);
      const base = idf(T, t);
      $('sc-out').innerHTML = `
        <p class="sub">${m.label}, ${c.label}</p>
        <dl class="stats">
          <dt>Chuva no mês</dt><dd>${fmt(c.total)} mm <span class="muted">(normal ${fmt(m.clim.p50)})</span></dd>
          <dt>Maior chuva em 5 dias</dt><dd>${fmt(c.max5)} mm → solo ${AMC[c.amc]}</dd>
          <dt>Perdas (infiltração + galerias)</dt><dd>${fmt(c.loss, 1)} mm/h <span class="muted">(normal ${BASE_LOSS})</span></dd>
          <dt>Nível inicial dos rios</dt><dd>${fmt(c.river, 1)} m <span class="muted">(normal ${fmt(BASE_RIVER, 1)})</span></dd>
          <dt>Calor vs normal</dt><dd>${signed(c.tanom)} °C → tempestade ×${fmt(c.stormFactor, 2)}</dd>
          <dt>Tempestade</dt><dd>${fmt(base * c.stormFactor)} mm/h por ${t < 60 ? t + ' min' : fmt(t / 60) + ' h'}</dd>
        </dl>`;
      return { rate: Math.round(base * c.stormFactor), dur: t / 60, loss: Math.round(c.loss), river: Math.round(c.river * 10) / 10 };
    };
    fillKinds();
    $('sc-storm').value = '10,60';
    show();
    $('sc-month').addEventListener('change', () => { fillKinds(); show(); });
    $('sc-kind').addEventListener('change', show);
    $('sc-storm').addEventListener('change', show);
    $('sc-run').addEventListener('click', () => {
      run(show());
      panel.hidden = true;
    });
  }
}

function chart(months) {
  const W = 640, H = 240, L = 44, R = 8, T = 22, B = 26;
  const top = Math.max(...months.flatMap((m) => [m.clim.p90, m.fc.p90, ...m.analogs.map((a) => a.m.total)]));
  const ymax = Math.ceil(top / 100) * 100;
  const y = (v) => T + (H - T - B) * (1 - v / ymax);
  const cw = (W - L - R) / months.length;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Chuva mensal em Curitiba: normal, previsão e El Niños passados">`;
  for (let v = 0; v <= ymax; v += 100) {
    s += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" class="grid"/>`;
    s += `<text x="${L - 6}" y="${y(v) + 4}" class="ax" text-anchor="end">${v}</text>`;
  }
  s += `<text x="${L - 6}" y="11" class="ax" text-anchor="end">mm</text>`;
  months.forEach((m, i) => {
    const cx = L + cw * (i + 0.5);
    s += `<rect x="${cx - 26}" y="${y(m.clim.p90)}" width="52" height="${y(m.clim.p10) - y(m.clim.p90)}" rx="4" class="band"/>`;
    s += `<line x1="${cx - 26}" x2="${cx + 26}" y1="${y(m.clim.p50)}" y2="${y(m.clim.p50)}" class="med"/>`;
    const fx = cx - 9;
    s += `<line x1="${fx}" x2="${fx}" y1="${y(m.fc.p10)}" y2="${y(m.fc.p90)}" class="fc-range"/>`;
    s += `<circle cx="${fx}" cy="${y(m.fc.p50)}" r="5.5" class="fc-dot"/>`;
    m.analogs.forEach((a, j) => {
      s += `<circle cx="${cx + 5 + (j % 3) * 6}" cy="${y(a.m.total)}" r="4" class="an-dot"/>`;
    });
    s += `<text x="${cx}" y="${H - 8}" class="ax" text-anchor="middle">${m.label}</text>`;
    s += `<rect x="${cx - cw / 2}" y="0" width="${cw}" height="${H}" class="col-hit" data-i="${i}"/>`;
  });
  return s + '</svg>';
}

function table(months) {
  return `<table class="num"><thead><tr><th>Mês</th><th>Normal</th><th>Previsão (10–50–90%)</th><th>Mês chuvoso</th><th>Temp.</th>
    ${months[0].analogs.map((a) => `<th>${a.year}</th>`).join('')}</tr></thead><tbody>
    ${months.map((m) => `<tr><td>${m.label}</td><td>${fmt(m.clim.p50)}</td>
      <td>${fmt(m.fc.p10)} · ${fmt(m.fc.p50)} · ${fmt(m.fc.p90)}</td><td>${Math.round(m.fc.wet * 100)}%</td>
      <td>${signed(m.fc.tanom)}</td>
      ${months[0].analogs.map((a0) => { const a = m.analogs.find((x) => x.year === a0.year); return `<td>${a ? fmt(a.m.total) : '–'}</td>`; }).join('')}</tr>`).join('')}
    </tbody></table><p class="note">Chuva em mm no mês. Colunas por ano: o El Niño que começou naquele ano.</p>`;
}
