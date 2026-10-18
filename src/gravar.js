// Imagem e vídeo do mapa. O WebGL não guarda o quadro depois de mostrado,
// então a cópia acontece logo após o render, num canvas 2D que também
// recebe o relógio, a legenda e o endereço do site.

const SITE = 'zednaked.github.io/cheia';

export class Recorder {
  constructor(glCanvas) {
    this.gl = glCanvas;
    this.c = document.createElement('canvas');
    this.ctx = this.c.getContext('2d');
    this.shot = null;
    this.rec = null;
  }

  get recording() { return !!this.rec; }

  // Chamado pelo laço logo depois de view.render().
  afterRender(info) {
    if (!this.shot && !this.rec) return;
    this.compose(info);
    if (this.shot) {
      const done = this.shot;
      this.shot = null;
      this.c.toBlob((b) => done(b), 'image/png');
    }
  }

  compose({ clock, sub, title, legend }) {
    const { gl, c, ctx } = this;
    const scale = Math.min(1, 1920 / gl.width);
    const w = Math.round(gl.width * scale) & ~1, h = Math.round(gl.height * scale) & ~1;
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    ctx.drawImage(gl, 0, 0, w, h);
    const u = Math.max(1, h / 720);
    const pad = 18 * u;
    ctx.fillStyle = 'rgba(13,17,23,0.78)';
    ctx.fillRect(pad - 10 * u, pad - 10 * u, 360 * u, 92 * u);
    ctx.fillStyle = '#e6edf3';
    ctx.font = `600 ${15 * u}px system-ui, sans-serif`;
    ctx.fillText(title, pad, pad + 10 * u);
    ctx.font = `600 ${34 * u}px system-ui, sans-serif`;
    ctx.fillText(clock, pad, pad + 48 * u);
    ctx.font = `${13 * u}px system-ui, sans-serif`;
    ctx.fillStyle = '#8b98a8';
    ctx.fillText(sub, pad, pad + 70 * u);
    // legenda
    const lw = 240 * u, lx = w - lw - pad, ly = h - 44 * u - pad;
    ctx.fillStyle = 'rgba(13,17,23,0.78)';
    ctx.fillRect(lx - 10 * u, ly - 10 * u, lw + 20 * u, 54 * u);
    const g = ctx.createLinearGradient(lx, 0, lx + lw, 0);
    legend.stops.forEach(([p, col]) => g.addColorStop(p, col));
    ctx.fillStyle = g;
    ctx.fillRect(lx, ly + 16 * u, lw, 9 * u);
    ctx.fillStyle = '#8b98a8';
    ctx.font = `${11 * u}px system-ui, sans-serif`;
    ctx.fillText(legend.title, lx, ly + 8 * u);
    legend.ticks.forEach((t, i) => {
      ctx.textAlign = i === 0 ? 'left' : i === legend.ticks.length - 1 ? 'right' : 'center';
      ctx.fillText(t, lx + (lw * i) / (legend.ticks.length - 1), ly + 40 * u);
    });
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(230,237,243,0.8)';
    ctx.font = `600 ${13 * u}px system-ui, sans-serif`;
    ctx.fillText(`Cheia · ${SITE}`, pad, h - pad);
  }

  screenshot() {
    return new Promise((ok) => (this.shot = ok));
  }

  start() {
    const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    const type = types.find((t) => window.MediaRecorder?.isTypeSupported(t));
    if (!type) throw new Error('este navegador não grava vídeo do canvas');
    this.type = type;
    this.chunks = [];
    this.rec = new MediaRecorder(this.c.captureStream(30), { mimeType: type, videoBitsPerSecond: 8e6 });
    this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
    this.rec.start(500);
  }

  stop() {
    const rec = this.rec;
    this.rec = null;
    return new Promise((ok) => {
      rec.onstop = () => ok(new Blob(this.chunks, { type: this.type.split(';')[0] }));
      rec.stop();
    });
  }
}

export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}
