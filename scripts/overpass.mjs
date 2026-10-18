// Consulta ao Overpass com espelhos e espera crescente entre tentativas.
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];

export async function overpass(q, attempts = 9) {
  let wait = 5000;
  for (let attempt = 0; attempt < attempts; attempt++) {
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
