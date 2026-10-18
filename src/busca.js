// Busca: bairros, municípios e lugares (escolas, hospitais…) sem rede; se
// nada bater, endereço pelo Nominatim, restrito à área simulada.
import { bbox } from './region.js';

const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const $ = (id) => document.getElementById(id);
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function setupSearch({ areas, pois, onPick }) {
  const input = $('search'), box = $('search-res');
  const index = [
    ...areas.map((a) => ({ name: a.name, sub: a.level === 8 ? 'município' : 'bairro', key: norm(a.name), area: a })),
    ...pois.filter((p) => p.n).map((p) => ({ name: p.n, sub: p.k, key: norm(p.n), lonlat: p.c })),
  ];
  let results = [], sel = 0, seq = 0;

  const show = () => {
    box.hidden = !results.length;
    box.innerHTML = results.map((r, i) => `<button data-i="${i}" class="${i === sel ? 'on' : ''}">${esc(r.name)}
      <span class="muni"> · ${esc(r.sub)}</span></button>`).join('');
  };
  const pick = (r) => {
    box.hidden = true;
    input.value = r.name;
    input.blur();
    onPick(r);
  };

  input.addEventListener('input', () => {
    const q = norm(input.value.trim());
    sel = 0;
    if (q.length < 2) { results = []; return show(); }
    const starts = [], has = [];
    for (const r of index) {
      if (r.key.startsWith(q)) starts.push(r);
      else if (r.key.includes(q)) has.push(r);
    }
    // bairros e municípios antes dos lugares
    const rank = (r) => (r.area ? 0 : 1);
    results = [...starts.sort((a, b) => rank(a) - rank(b)), ...has.sort((a, b) => rank(a) - rank(b))].slice(0, 8);
    if (!results.length) results = [{ name: `Procurar “${input.value.trim()}” como endereço`, sub: 'Enter', geocode: true }];
    show();
  });
  input.addEventListener('keydown', async (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % Math.max(1, results.length);
      show();
      e.preventDefault();
    } else if (e.key === 'Enter') {
      const r = results[sel];
      if (r && !r.geocode) pick(r);
      else geocode(input.value.trim());
    } else if (e.key === 'Escape') {
      box.hidden = true;
    }
  });
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const r = results[+b.dataset.i];
    if (r.geocode) geocode(input.value.trim());
    else pick(r);
  });
  addEventListener('pointerdown', (e) => { if (!e.target.closest('.search')) box.hidden = true; });

  async function geocode(q) {
    if (!q) return;
    const my = ++seq;
    const b = bbox();
    results = [{ name: 'procurando…', sub: 'OpenStreetMap', geocode: true }];
    show();
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&countrycodes=br&bounded=1' +
        `&viewbox=${b.west},${b.north},${b.east},${b.south}&q=${encodeURIComponent(q)}`;
      const list = await (await fetch(url, { headers: { 'Accept-Language': 'pt-BR' } })).json();
      if (my !== seq) return;
      results = list.map((p) => ({
        name: p.display_name.split(',').slice(0, 2).join(','),
        sub: p.display_name.split(',').slice(2, 4).join(',').trim(),
        lonlat: [+p.lon, +p.lat],
      }));
      if (!results.length) results = [{ name: 'Nada encontrado dentro da área simulada', sub: '', geocode: true }];
    } catch {
      results = [{ name: 'Busca de endereço indisponível agora', sub: '', geocode: true }];
    }
    sel = 0;
    show();
  }
}
