// Chromium headless controlado pelo protocolo de depuração (CDP), com o
// Vite servindo o projeto. Usado pelo npm test e pelo script de validação.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'vite';

export async function openPage(path, { gpu = false, width = 1280, height = 800, onLog } = {}) {
  const server = await createServer({ root: new URL('..', import.meta.url).pathname, logLevel: 'error', server: { port: 0 } });
  await server.listen();
  const url = `http://localhost:${server.httpServer.address().port}/${path}`;
  const profile = await mkdtemp(join(tmpdir(), 'cheia-cdp-'));
  const chrome = spawn(process.env.CHROME || 'chromium', [
    '--headless=new', `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run',
    `--window-size=${width},${height}`, '--ignore-gpu-blocklist',
    ...(gpu ? ['--use-angle=gl'] : ['--enable-unsafe-swiftshader']),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  const ws = await new Promise((ok, fail) => {
    let err = '';
    chrome.stderr.on('data', (d) => {
      err += d;
      const m = err.match(/ws:\/\/[^\s]+/);
      if (m) ok(m[0]);
    });
    chrome.once('exit', () => fail(new Error(`Chromium saiu: ${err.slice(-500)}`)));
  });
  const base = ws.replace(/\/devtools\/browser\/.*/, '').replace('ws://', 'http://');
  const target = await (await fetch(`${base}/json/new?about:blank`, { method: 'PUT' })).json();
  const sock = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((ok) => sock.addEventListener('open', ok));
  let id = 0;
  const pending = new Map();
  sock.addEventListener('message', (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) pending.get(m.id)(m);
    if (m.method === 'Runtime.exceptionThrown') (onLog || console.error)(`[erro] ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
    if (m.method === 'Runtime.consoleAPICalled' && onLog) onLog(`[${m.params.type}] ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
  });
  const send = (method, params = {}) => new Promise((ok) => {
    pending.set(++id, ok);
    sock.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Page.navigate', { url });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description);
    return r.result?.result?.value;
  };
  const waitFor = async (expression, timeout = 300000) => {
    const t0 = Date.now();
    while (Date.now() - t0 < timeout) {
      const v = await evaluate(expression).catch(() => null);
      if (v) return v;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error(`tempo esgotado esperando: ${expression}`);
  };
  const screenshot = async () => Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).result.data, 'base64');
  const close = async () => {
    sock.close();
    const exited = new Promise((ok) => chrome.once('exit', ok));
    chrome.kill();
    await exited;
    await server.close();
    await rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
  };
  return { send, evaluate, waitFor, screenshot, close };
}
