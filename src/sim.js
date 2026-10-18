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
// A chuva é a soma de três partes, todas em m/s: uma taxa uniforme, um mapa
// de chuva em grade grossa (temporal real, previsão) e uma célula de
// tempestade gaussiana que pode andar. As perdas (infiltração + galerias) são
// descontadas célula a célula.
//
// A cada poucos passos um pass de "saída" grava (h, h máx, chegada, perigo
// máx.), que é o que a tela desenha e o que é lido de volta para o ranking.
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
uniform float uDt, uDx, uManning2, uRain, uLoss, uMapScale;
uniform sampler2D uRainMap;  // grade grossa, canal r em m/s
uniform ivec2 uMapN;
uniform vec4 uCell;          // centro (células), raio (células), intensidade (m/s)

float rainAt(vec2 p) {
  float r = uRain;
  if (uMapScale > 0.0) {
    // bilinear à mão: textura float sem filtro linear em todas as GPUs
    vec2 g = clamp((p + 0.5) / vec2(uN) * vec2(uMapN) - 0.5, vec2(0.0), vec2(uMapN - 1));
    ivec2 i = ivec2(floor(g));
    ivec2 j = min(i + 1, uMapN - 1);
    vec2 f = g - vec2(i);
    float a = texelFetch(uRainMap, i, 0).r, b = texelFetch(uRainMap, ivec2(j.x, i.y), 0).r;
    float c = texelFetch(uRainMap, ivec2(i.x, j.y), 0).r, d = texelFetch(uRainMap, j, 0).r;
    r += uMapScale * mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  if (uCell.w > 0.0) {
    vec2 d = p - uCell.xy;
    r += uCell.w * exp(-dot(d, d) / (uCell.z * uCell.z));
  }
  return max(0.0, r - uLoss);
}

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
  gl_FragColor = vec4(max(0.0, h + uDt * (net + rainAt(vec2(p)))), qE, qS, b);
}
`;

// Velocidade média na célula (m/s) e classe de perigo, ARR 2019 (Smith et
// al. 2014): profundidade, velocidade e o produto das duas.
//   0 seco · 1 H1 seguro · 2 H2 perigoso p/ carro pequeno · 3 H3 p/ carro,
//   criança e idoso · 4 H4 p/ qualquer pessoa · 5 H5 p/ todos, construções
//   leves sofrem · 6 H6 qualquer construção pode ceder
export const HAZARD_GLSL = /* glsl */ `
vec2 cellVel(sampler2D S, ivec2 p, ivec2 n) {
  vec4 c = texelFetch(S, p, 0);
  if (c.r < 0.05) return vec2(0.0);
  float qW = p.x > 0 ? texelFetch(S, p - ivec2(1, 0), 0).g : 0.0;
  float qN = p.y > 0 ? texelFetch(S, p - ivec2(0, 1), 0).b : 0.0;
  return vec2(0.5 * (qW + c.g), 0.5 * (qN + c.b)) / c.r;
}
float hazard(float d, float v) {
  float dv = d * v;
  if (d < 0.05) return 0.0;
  if (d <= 0.3 && v <= 2.0 && dv <= 0.3) return 1.0;
  if (d <= 0.5 && v <= 2.0 && dv <= 0.6) return 2.0;
  if (d <= 1.2 && v <= 2.0 && dv <= 0.6) return 3.0;
  if (d <= 2.0 && v <= 2.0 && dv <= 1.0) return 4.0;
  if (d <= 4.0 && v <= 4.0 && dv <= 4.0) return 5.0;
  return 6.0;
}
`;

// Saída: r = h, g = h máx, b = momento em que passou de 30 cm (s; 0 = nunca,
// -1 = já começou assim), a = classe de perigo máxima até agora
const OUTPUT = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uS, uPrev;
uniform ivec2 uN;
uniform float uTime;
${HAZARD_GLSL}
void main() {
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uS, p, 0);
  vec4 o = texelFetch(uPrev, p, 0);
  float arrival = (o.b == 0.0 && s.r > 0.3) ? uTime : o.b;
  float hz = hazard(s.r, length(cellVel(uS, p, uN)));
  gl_FragColor = vec4(s.r, max(o.g, s.r), arrival, max(o.a, hz));
}
`;

// Saída inicial a partir de um estado já acomodado: o que começa acima de
// 30 cm fica marcado como "já estava assim" (chegada -1).
const INIT_OUT = /* glsl */ `
precision highp float;
uniform sampler2D uS;
void main() {
  vec4 s = texelFetch(uS, ivec2(gl_FragCoord.xy), 0);
  gl_FragColor = vec4(s.r, s.r, s.r > 0.3 ? -1.0 : 0.0, 0.0);
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
    this.loss = 0;         // m/s
    this.mapScale = 0;     // multiplica o mapa de chuva; 0 = desligado
    this.cell = null;      // { x, y, r (células), i (m/s) }
    this.rainMap = new THREE.DataTexture(new Float32Array(4), 1, 1, THREE.RedFormat, THREE.FloatType);
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
        uLoss: { value: 0 }, uMapScale: { value: 0 }, uRainMap: { value: this.rainMap },
        uMapN: { value: new THREE.Vector2(1, 1) }, uCell: { value: new THREE.Vector4() },
      },
    });
    this.outMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: OUTPUT,
      uniforms: { uS: { value: null }, uPrev: { value: null }, uTime: { value: 0 }, uN: { value: new THREE.Vector2(W, H) } },
    });
    this.copyMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: COPY, uniforms: { uSrc: { value: null } },
    });
    this.initOutMat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: INIT_OUT, uniforms: { uS: { value: null } },
    });
    this.base = null; // estado acomodado sem chuva (ver settle)
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

  // Textura que a tela desenha: (h, h máx, chegada, perigo máx.)
  get outputTex() { return this.out[0].texture; }
  // Estado atual: (h, q leste, q sul, leito)
  get stateTex() { return this.S[0].texture; }

  // Mapa de chuva n×m (m/s por célula da grade grossa, linha 0 = norte).
  setRainMap(values, n, m) {
    if (this.rainMap.image.width !== n || this.rainMap.image.height !== m) {
      this.rainMap.dispose();
      this.rainMap = new THREE.DataTexture(new Float32Array(n * m), n, m, THREE.RedFormat, THREE.FloatType);
      this.stepMat.uniforms.uRainMap.value = this.rainMap;
      this.stepMat.uniforms.uMapN.value.set(n, m);
    }
    this.rainMap.image.data.set(values);
    this.rainMap.needsUpdate = true;
  }

  // Chuva efetiva (m/s) numa célula, igual à do shader; para contabilidade.
  rainAt(x, y, uniform) {
    let r = uniform;
    if (this.mapScale > 0) {
      const { width: n, height: m, data } = this.rainMap.image;
      const gx = Math.min(n - 1, Math.max(0, ((x + 0.5) / this.W) * n - 0.5));
      const gy = Math.min(m - 1, Math.max(0, ((y + 0.5) / this.H) * m - 0.5));
      const i = Math.floor(gx), j = Math.floor(gy), i1 = Math.min(i + 1, n - 1), j1 = Math.min(j + 1, m - 1);
      const fx = gx - i, fy = gy - j;
      const top = data[j * n + i] * (1 - fx) + data[j * n + i1] * fx;
      const bot = data[j1 * n + i] * (1 - fx) + data[j1 * n + i1] * fx;
      r += this.mapScale * (top * (1 - fy) + bot * fy);
    }
    if (this.cell) r += this.cell.i * Math.exp(-((x - this.cell.x) ** 2 + (y - this.cell.y) ** 2) / this.cell.r ** 2);
    return Math.max(0, r - this.loss);
  }

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
      s[k * 4 + 3] = this.bed[k];
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

  // Deixa a água inicial dos rios se acomodar no relevo, sem chuva, por
  // `seconds` de tempo simulado, e guarda o resultado como ponto de partida.
  // Sem isso a água que transborda da calha para as várzeas no começo conta
  // como alagamento mesmo com chuva zero.
  // Roda em pedaços, um por quadro, para não travar a aba (são ~1.500 passos).
  async settle(h0, seconds, onProgress) {
    const keep = { loss: this.loss, mapScale: this.mapScale, cell: this.cell };
    this.reset(h0);
    while (this.time < seconds) {
      Object.assign(this, { loss: 0, mapScale: 0, cell: null });
      this.step(40, () => 0);
      onProgress?.(this.time / seconds);
      await new Promise((ok) => requestAnimationFrame(ok));
    }
    Object.assign(this, keep);
    this.base ??= target(this.W, this.H);
    this.copyMat.uniforms.uSrc.value = this.S[0].texture;
    this.pass(this.copyMat, this.base);
    this.renderer.setRenderTarget(null);
    this.restart();
  }

  // Volta ao estado acomodado, com o relógio em zero.
  restart() {
    this.copyMat.uniforms.uSrc.value = this.base.texture;
    for (const t of this.S) this.pass(this.copyMat, t);
    this.initOutMat.uniforms.uS.value = this.base.texture;
    for (const t of this.out) this.pass(this.initOutMat, t);
    this.renderer.setRenderTarget(null);
    this.time = 0;
    this.steps = 0;
  }

  output() {
    this.outMat.uniforms.uS.value = this.S[0].texture;
    this.outMat.uniforms.uPrev.value = this.out[0].texture;
    this.outMat.uniforms.uTime.value = this.time;
    this.pass(this.outMat, this.out[1]);
    this.out.reverse();
  }

  // forcing(t): ajusta a chuva para o instante t (rainMs uniforme, mapScale,
  // cell) e devolve a chuva uniforme em m/s
  step(n, forcing) {
    const r = this.renderer;
    const prevAuto = r.autoClear;
    r.autoClear = false;
    const u = this.stepMat.uniforms;
    u.uManning2.value = this.manning ** 2;
    for (let i = 0; i < n; i++) {
      this.time += this.dt;
      u.uS.value = this.S[0].texture;
      u.uRain.value = forcing(this.time);
      u.uLoss.value = this.loss;
      u.uMapScale.value = this.mapScale;
      const c = this.cell;
      if (c) u.uCell.value.set(c.x, c.y, c.r, c.i);
      else u.uCell.value.set(0, 0, 1, 0);
      this.pass(this.stepMat, this.S[1]);
      this.S.reverse();
      if (++this.steps % OUTPUT_EVERY === 0 || i === n - 1) this.output();
    }
    r.setRenderTarget(null);
    r.autoClear = prevAuto;
  }

  // Leitura assíncrona da saída (h, h máx, chegada, perigo máx.).
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
