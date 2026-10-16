// Malha única do terreno: cada vértice é uma célula da simulação e sobe até a
// superfície da água quando há lâmina. Satélite, rios, limites e cor da água
// são combinados no fragment shader.
import * as THREE from 'three';
import { MapControls } from 'three/examples/jsm/controls/MapControls.js';

// position = (coluna, linha, saia) da célula; a posição no mundo sai do shader.
const VERT = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uOut;      // (h, h máx, chegada, leito)
uniform ivec2 uN;
uniform vec2 uSize;
uniform float uDx, uExag, uBase, uMinShow;
uniform int uShowMax;
varying vec2 vUv;
varying vec3 vNormal;
float surf(ivec2 p) {
  vec4 o = texelFetch(uOut, clamp(p, ivec2(0), uN - 1), 0);
  float h = uShowMax == 1 ? o.g : o.r;
  return o.a + (h > uMinShow ? h : 0.0);
}
void main() {
  ivec2 p = ivec2(position.xy);
  float z = surf(p);
  float dzx = (surf(p + ivec2(1, 0)) - surf(p - ivec2(1, 0))) * uExag / (2.0 * uDx);
  float dzy = (surf(p + ivec2(0, 1)) - surf(p - ivec2(0, 1))) * uExag / (2.0 * uDx);
  vNormal = normalize(vec3(-dzx, 1.0, -dzy));
  vUv = (vec2(p) + 0.5) / vec2(uN);
  vec3 pos = vec3((vUv.x - 0.5) * uSize.x, (z - uBase) * uExag - position.z * 40.0 * uExag, (vUv.y - 0.5) * uSize.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uImg, uRivers, uLimits, uOut;
uniform float uShowImg, uShowRivers, uShowLimits, uMinShow;
uniform int uShowMax;
uniform vec3 uSun;
varying vec2 vUv;
varying vec3 vNormal;
vec3 depthColor(float d) {
  // 0,1 m  claro -> 0,5 m -> 1 m -> 2 m -> 4 m+ escuro
  vec3 c = mix(vec3(0.55, 0.9, 1.0), vec3(0.15, 0.6, 1.0), smoothstep(0.05, 0.5, d));
  c = mix(c, vec3(0.1, 0.3, 0.9), smoothstep(0.5, 1.0, d));
  c = mix(c, vec3(0.3, 0.1, 0.7), smoothstep(1.0, 2.0, d));
  c = mix(c, vec3(0.45, 0.0, 0.35), smoothstep(2.0, 4.0, d));
  return c;
}
void main() {
  vec3 n = normalize(vNormal);
  float diff = max(dot(n, uSun), 0.0);
  vec3 img = texture2D(uImg, vUv).rgb;
  vec3 base = mix(vec3(0.62, 0.64, 0.56), img, uShowImg);
  vec3 col = base * (0.45 + 0.75 * diff);
  vec4 r = texture2D(uRivers, vUv);
  col = mix(col, r.rgb, r.a * uShowRivers);
  // profundidade amostrada por fragmento: a cor da água não depende do LOD
  vec4 o = texture2D(uOut, vUv);
  float vDepth = uShowMax == 1 ? o.g : o.r;
  if (vDepth > uMinShow) {
    float a = smoothstep(uMinShow, uMinShow + 0.25, vDepth) * 0.88;
    vec3 w = depthColor(vDepth) * (0.65 + 0.45 * diff);
    w += pow(max(dot(reflect(-uSun, n), vec3(0.0, 1.0, 0.0)), 0.0), 40.0) * 0.25;
    col = mix(col, w, a);
  }
  vec4 l = texture2D(uLimits, vUv);
  col = mix(col, l.rgb, l.a * uShowLimits);
  gl_FragColor = vec4(col, 1.0);
}
`;

const CHUNK = 128;
const LODS = [1, 2, 4, 8];
const LOD_PX = 2.5;

// Grade de um bloco com passo `step` + saia nas bordas (esconde fendas entre
// blocos de níveis diferentes).
function chunkGeometry(i0, j0, size, step, W, H) {
  const cols = [], rows = [];
  for (let i = i0; i <= Math.min(i0 + size, W - 1); i += step) cols.push(i);
  if (cols.at(-1) !== Math.min(i0 + size, W - 1)) cols.push(Math.min(i0 + size, W - 1));
  for (let j = j0; j <= Math.min(j0 + size, H - 1); j += step) rows.push(j);
  if (rows.at(-1) !== Math.min(j0 + size, H - 1)) rows.push(Math.min(j0 + size, H - 1));
  const nx = cols.length, ny = rows.length;
  const pos = [];
  for (const j of rows) for (const i of cols) pos.push(i, j, 0);
  const idx = [];
  const at = (x, y) => y * nx + x;
  for (let y = 0; y < ny - 1; y++) {
    for (let x = 0; x < nx - 1; x++) {
      const a = at(x, y), b = at(x + 1, y), c = at(x, y + 1), d = at(x + 1, y + 1);
      idx.push(a, c, b, b, c, d);
    }
  }
  // saia: contorno percorrido em sentido único, com uma cópia rebaixada
  const ring = [];
  for (let x = 0; x < nx; x++) ring.push(at(x, 0));
  for (let y = 1; y < ny; y++) ring.push(at(nx - 1, y));
  for (let x = nx - 2; x >= 0; x--) ring.push(at(x, ny - 1));
  for (let y = ny - 2; y > 0; y--) ring.push(at(0, y));
  const base = pos.length / 3;
  for (const k of ring) pos.push(pos[k * 3], pos[k * 3 + 1], 1);
  for (let r = 0; r < ring.length; r++) {
    const a = ring[r], b = ring[(r + 1) % ring.length];
    const sa = base + r, sb = base + ((r + 1) % ring.length);
    idx.push(a, b, sa, b, sb, sa);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g;
}

function canvasTex(c, renderer) {
  const t = new THREE.CanvasTexture(c);
  t.flipY = false;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

export class View {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.Fog(0x0d1117, 60000, 140000);
    this.camera = new THREE.PerspectiveCamera(45, 1, 20, 300000);
    this.controls = new MapControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.47;
    this.controls.screenSpacePanning = false;
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  resize() {
    const c = this.renderer.domElement;
    const w = c.clientWidth, h = c.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  build({ W, H, dx, bed }, sim, imagery, rivers, limits) {
    let min = Infinity;
    for (const z of bed) if (z < min && z > -100) min = z;
    this.size = { W: W * dx, H: H * dx };
    this.uniforms = {
      uOut: { value: sim.outputTex },
      uN: { value: new THREE.Vector2(W, H) },
      uSize: { value: new THREE.Vector2(this.size.W, this.size.H) },
      uDx: { value: dx },
      uExag: { value: 2 },
      uBase: { value: min },
      uMinShow: { value: 0.05 },
      uShowMax: { value: 0 },
      uImg: { value: canvasTex(imagery, this.renderer) },
      uRivers: { value: canvasTex(rivers, this.renderer) },
      uLimits: { value: canvasTex(limits, this.renderer) },
      uShowImg: { value: 1 },
      uShowRivers: { value: 1 },
      uShowLimits: { value: 1 },
      uSun: { value: new THREE.Vector3(-0.5, 0.8, -0.35).normalize() },
    };
    const material = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms, side: THREE.DoubleSide,
    });

    // Blocos de CHUNK células, cada um com 4 níveis de detalhe (passo 1, 2, 4, 8).
    this.chunks = [];
    this.dx = dx;
    for (let cj = 0; cj < H / CHUNK; cj++) {
      for (let ci = 0; ci < W / CHUNK; ci++) {
        let lo = Infinity, hi = -Infinity;
        for (let j = cj * CHUNK; j < (cj + 1) * CHUNK; j++) {
          for (let i = ci * CHUNK; i < (ci + 1) * CHUNK; i++) {
            const z = bed[j * W + i];
            if (z < lo) lo = z;
            if (z > hi) hi = z;
          }
        }
        const levels = LODS.map((step) => chunkGeometry(ci * CHUNK, cj * CHUNK, CHUNK, step, W, H));
        const mesh = new THREE.Mesh(levels[0], material);
        mesh.matrixAutoUpdate = false;
        const chunk = { mesh, levels, lo, hi, cu: (ci + 0.5) * CHUNK / W, cv: (cj + 0.5) * CHUNK / H, level: 0 };
        this.chunks.push(chunk);
        this.scene.add(mesh);
      }
    }
    this.updateBounds();
    this.camera.position.set(0, this.size.W * 0.45, this.size.H * 0.55);
    this.controls.target.set(0, 0, 0);
    this.controls.update();
  }

  // Esferas envolventes por bloco (dependem do exagero vertical) para o culling.
  updateBounds() {
    const ex = this.uniforms.uExag.value, base = this.uniforms.uBase.value;
    const half = (CHUNK * this.dx) / 2;
    for (const c of this.chunks) {
      const center = this.gridToWorld(c.cu, c.cv, (c.lo + c.hi) / 2 + 10);
      const r = Math.hypot(half, half, ((c.hi - c.lo) / 2 + 60) * ex);
      for (const g of c.levels) g.boundingSphere = new THREE.Sphere(center, r);
      c.center = center;
    }
  }

  // Escolhe o nível de cada bloco para que um triângulo tenha ~LOD_PX pixels.
  updateLOD() {
    const focal = this.renderer.domElement.height / (2 * Math.tan((this.camera.fov * Math.PI) / 360));
    for (const c of this.chunks) {
      const d = Math.max(1, c.center.distanceTo(this.camera.position) - (CHUNK * this.dx) / 2);
      const want = (LOD_PX * d) / (this.dx * focal);
      let level = 0;
      while (level < LODS.length - 1 && LODS[level + 1] <= want) level++;
      if (level !== c.level) {
        c.level = level;
        c.mesh.geometry = c.levels[level];
      }
    }
  }

  // Coordenada de grade (fracionária) -> posição no mundo
  gridToWorld(u, v, z = 0) {
    return new THREE.Vector3((u - 0.5) * this.size.W, (z - this.uniforms.uBase.value) * this.uniforms.uExag.value, (v - 0.5) * this.size.H);
  }

  // Raio da câmera contra o relevo (CPU, marcha no heightfield).
  pick(ndcX, ndcY, data) {
    const ray = new THREE.Raycaster();
    ray.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const { origin, direction } = ray.ray;
    const ex = this.uniforms.uExag.value, base = this.uniforms.uBase.value;
    const step = data.dx * 0.5;
    for (let t = 0; t < 300000; t += step) {
      const x = origin.x + direction.x * t, y = origin.y + direction.y * t, z = origin.z + direction.z * t;
      const u = x / this.size.W + 0.5, v = z / this.size.H + 0.5;
      if (u < 0 || v < 0 || u >= 1 || v >= 1) {
        if (t > 0 && y < -1000) return null;
        continue;
      }
      const i = Math.floor(u * data.W), j = Math.floor(v * data.H);
      if (y <= (data.bed[j * data.W + i] - base) * ex) return { i, j, k: j * data.W + i };
    }
    return null;
  }

  render() {
    this.controls.update();
    this.updateLOD();
    this.renderer.render(this.scene, this.camera);
  }
}
