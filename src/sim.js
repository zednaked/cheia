// Escoamento superficial 2D na GPU: formulação inercial local de Bates et al.
// (2010), a mesma do LISFLOOD-FP. Por célula: profundidade h; por face: vazão
// unitária q (m²/s).
//
// Estado compactado numa textura RGBA32F: r = h, g = q na face leste,
// b = q na face sul, a = leito. Cada passo é um único pass: a célula recalcula
// as vazões das 4 faces (as faces oeste/norte pertencem aos vizinhos, que
// chegam ao mesmo valor com as mesmas entradas) e atualiza h. Isso lê 5 texels
// por célula em vez de ~11 da versão em dois passes.
//
// A cada poucos passos um pass de "saída" grava (h, h máx, chegada, leito),
// que é o que a tela desenha e o que é lido de volta para o ranking.
import * as THREE from 'three';

const G = 9.81;

const VERT = /* glsl */ `
void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }
`;

const STEP = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uS;
uniform ivec2 uN;
uniform float uDt, uDx, uManning2, uRain;

float faceQ(float q, float hi, float bi, float hj, float bj) {
  float Hi = bi + hi, Hj = bj + hj;
  float hf = max(Hi, Hj) - max(bi, bj);       // lâmina que pode passar pela face
  if (hf < 1e-3) return 0.0;
  float S = (Hj - Hi) / uDx;
  float qn = (q - ${G} * hf * uDt * S) /
             (1.0 + ${G} * uDt * uManning2 * abs(q) / pow(hf, 7.0 / 3.0));
  // Cada face só tira 1/4 da água da célula de origem por passo:
  // a profundidade nunca fica negativa.
  float cap = (qn > 0.0 ? hi : hj) * uDx / (4.0 * uDt);
  return clamp(qn, -cap, cap);
}

void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uS, p, 0);
  float h = c.r, b = c.a;
  float qE = 0.0, qS = 0.0, qW = 0.0, qN = 0.0;
  if (p.x < uN.x - 1) { vec4 e = texelFetch(uS, p + ivec2(1, 0), 0); qE = faceQ(c.g, h, b, e.r, e.a); }
  if (p.y < uN.y - 1) { vec4 s = texelFetch(uS, p + ivec2(0, 1), 0); qS = faceQ(c.b, h, b, s.r, s.a); }
  if (p.x > 0)        { vec4 w = texelFetch(uS, p - ivec2(1, 0), 0); qW = faceQ(w.g, w.r, w.a, h, b); }
  if (p.y > 0)        { vec4 n = texelFetch(uS, p - ivec2(0, 1), 0); qN = faceQ(n.b, n.r, n.a, h, b); }
  float net = (qW - qE + qN - qS) / uDx;
  // Bordas abertas: a água sai da região em regime crítico.
  int edges = int(p.x == 0) + int(p.y == 0) + int(p.x == uN.x - 1) + int(p.y == uN.y - 1);
  if (edges > 0 && h > 1e-3) {
    float qo = min(h * sqrt(${G} * h), h * uDx / (4.0 * uDt));
    net -= float(edges) * qo / uDx;
  }
  gl_FragColor = vec4(max(0.0, h + uDt * (net + uRain)), qE, qS, b);
}
`;

// Saída: r = h, g = h máx, b = momento em que passou de 30 cm (s; 0 = nunca, -1 = já começou assim), a = leito
const OUTPUT = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uS, uPrev;
uniform float uTime;
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uS, p, 0);
  vec4 o = texelFetch(uPrev, p, 0);
  float arrival = (o.b == 0.0 && s.r > 0.3) ? uTime : o.b;
  gl_FragColor = vec4(s.r, max(o.g, s.r), arrival, s.a);
}
`;

const COPY = /* glsl */ `
precision highp float;
uniform sampler2D uSrc;
void main() { gl_FragColor = texelFetch(uSrc, ivec2(gl_FragCoord.xy), 0); }
`;

function target(W, H, linear = false) {
  const filter = linear ? THREE.LinearFilter : THREE.NearestFilter;
  return new THREE.WebGLRenderTarget(W, H, {
    type: THREE.FloatType,
    format: THREE.RGBAFormat,
    minFilter: filter,
    magFilter: filter,
    depthBuffer: false,
    generateMipmaps: false,
  });
}

const OUTPUT_EVERY = 4;

export class FloodSim {
  constructor(renderer, { W, H, bed, dx }) {
    this.renderer = renderer;
    this.W = W;
    this.H = H;
    this.dx = dx;
    this.bed = bed;
    this.time = 0;
    this.steps = 0;
    this.manning = 0.05;
    // Passo estável para lâminas até ~15 m (CFL com α = 0,7).
    this.dt = Math.min(2, (0.7 * dx) / Math.sqrt(G * 15));

    this.S = [target(W, H), target(W, H)];
    // A tela lê a saída com filtro bilinear quando a GPU suporta (OES_texture_float_linear).
    const linear = renderer.extensions.has('OES_texture_float_linear');
    this.out = [target(W, H, linear), target(W, H, linear)];

    const VS = VERT;
    this.stepMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: STEP,
      uniforms: {
        uS: { value: null }, uN: { value: new THREE.Vector2(W, H) },
        uDt: { value: this.dt }, uDx: { value: dx }, uManning2: { value: 0 }, uRain: { value: 0 },
      },
    });
    this.outMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: OUTPUT,
      uniforms: { uS: { value: null }, uPrev: { value: null }, uTime: { value: 0 } },
    });
    this.copyMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: COPY, uniforms: { uSrc: { value: null } },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.quad.frustumCulled = false;
    this.scene = new THREE.Scene();
    this.scene.add(this.quad);
    this.camera = new THREE.OrthographicCamera();
  }

  // Passo adaptativo (CFL) a partir da maior lâmina observada, com folga.
  setMaxDepth(h) {
    this.dt = Math.min(6, Math.max(0.5, (0.7 * this.dx) / Math.sqrt(G * (h * 1.5 + 1))));
    this.stepMat.uniforms.uDt.value = this.dt;
  }

  // Textura que a tela desenha: (h, h máx, chegada, leito)
  get outputTex() { return this.out[0].texture; }

  pass(material, target) {
    this.quad.material = material;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.scene, this.camera);
  }

  upload(data, targets) {
    const tex = new THREE.DataTexture(data, this.W, this.H, THREE.RGBAFormat, THREE.FloatType);
    tex.needsUpdate = true;
    this.copyMat.uniforms.uSrc.value = tex;
    for (const t of targets) this.pass(this.copyMat, t);
    tex.dispose();
  }

  // h0: Float32Array W*H com a lâmina inicial (rios com água de base).
  reset(h0) {
    const n = this.W * this.H;
    const s = new Float32Array(n * 4);
    const o = new Float32Array(n * 4);
    for (let k = 0; k < n; k++) {
      const h = h0 ? h0[k] : 0;
      s[k * 4] = o[k * 4] = o[k * 4 + 1] = h;
      o[k * 4 + 2] = h > 0.3 ? -1 : 0; // já começa acima de 30 cm: sem hora de chegada
      s[k * 4 + 3] = o[k * 4 + 3] = this.bed[k];
    }
    this.upload(s, this.S);
    this.upload(o, this.out);
    this.renderer.setRenderTarget(null);
    this.time = 0;
    this.steps = 0;
    let hmax = 0;
    for (let k = 0; k < n; k++) if (s[k * 4] > hmax) hmax = s[k * 4];
    this.setMaxDepth(hmax);
  }

  output() {
    this.outMat.uniforms.uS.value = this.S[0].texture;
    this.outMat.uniforms.uPrev.value = this.out[0].texture;
    this.outMat.uniforms.uTime.value = this.time;
    this.pass(this.outMat, this.out[1]);
    this.out.reverse();
  }

  // rainMs(t): chuva efetiva em m/s no instante t
  step(n, rainMs) {
    const r = this.renderer;
    const prevAuto = r.autoClear;
    r.autoClear = false;
    const u = this.stepMat.uniforms;
    u.uManning2.value = this.manning ** 2;
    for (let i = 0; i < n; i++) {
      this.time += this.dt;
      u.uS.value = this.S[0].texture;
      u.uRain.value = rainMs(this.time);
      this.pass(this.stepMat, this.S[1]);
      this.S.reverse();
      if (++this.steps % OUTPUT_EVERY === 0 || i === n - 1) this.output();
    }
    r.setRenderTarget(null);
    r.autoClear = prevAuto;
  }

  // Leitura assíncrona da saída (h, h máx, chegada, leito).
  async read(buf) {
    buf ??= new Float32Array(this.W * this.H * 4);
    const t = this.out[0];
    if (this.renderer.readRenderTargetPixelsAsync) {
      await this.renderer.readRenderTargetPixelsAsync(t, 0, 0, this.W, this.H, buf);
    } else {
      this.renderer.readRenderTargetPixels(t, 0, 0, this.W, this.H, buf);
    }
    return buf;
  }
}
