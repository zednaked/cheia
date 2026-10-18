// Correnteza: 65 mil partículas que andam com a velocidade da água, cada
// uma desenhada como um risco curto na direção do escoamento. Posições numa
// textura float atualizada na GPU; partículas em lugar seco renascem em
// alguma célula com água.
import * as THREE from 'three';
import { HAZARD_GLSL } from './sim.js';

const SIDE = 256;
// Escala de tempo da animação: segundos de escoamento por segundo de tela.
// A 1 m/s uma partícula anda ~2 células por segundo.
const FLOW_TIME = 70;

const QUAD_VERT = /* glsl */ `void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }`;

const UPDATE = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uP, uS;
uniform ivec2 uN;
uniform float uDx, uDtFlow, uDtReal, uSeed, uMinH;
uniform vec4 uBox;   // região visível (uv mín., uv máx.): as partículas nascem onde se está olhando
${HAZARD_GLSL}
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main() {
  ivec2 q = ivec2(gl_FragCoord.xy);
  vec4 s = texelFetch(uP, q, 0);
  vec2 pos = s.xy;
  float age = s.z + uDtReal, life = s.w;
  ivec2 c = ivec2(floor(pos));
  bool inside = pos.x >= 0.0 && pos.y >= 0.0 && c.x < uN.x && c.y < uN.y;
  float h = inside ? texelFetch(uS, c, 0).r : 0.0;
  if (!inside || h < uMinH || age > life) {
    pos = vec2(-10.0);
    for (int i = 0; i < 6; i++) {
      vec2 r = vec2(hash(vec2(q) * 0.731 + uSeed + float(i) * 7.13), hash(vec2(q.yx) * 1.37 + uSeed * 1.31 + float(i) * 3.71));
      vec2 cand = (uBox.xy + r * (uBox.zw - uBox.xy)) * vec2(uN);
      if (texelFetch(uS, ivec2(cand), 0).r > uMinH) { pos = cand; break; }
    }
    age = 0.0;
    life = 1.2 + 2.5 * hash(vec2(q) * 0.37 + uSeed);
  } else {
    pos += cellVel(uS, c, uN) * uDtFlow / uDx;
  }
  gl_FragColor = vec4(pos, age, life);
}
`;

const DRAW_VERT = /* glsl */ `
precision highp float;
precision highp sampler2D;
uniform sampler2D uP, uS;
uniform ivec2 uN;
uniform vec2 uSize;
uniform float uDx, uExag, uBase, uTrail, uMinShow;
attribute vec3 ref;   // texel da partícula, 0 = cabeça / 1 = cauda
varying float vA;
${HAZARD_GLSL}
void main() {
  vec4 s = texelFetch(uP, ivec2(ref.xy), 0);
  if (s.x < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vA = 0.0; return; }
  ivec2 c = clamp(ivec2(floor(s.xy)), ivec2(0), uN - 1);
  vec4 st = texelFetch(uS, c, 0);
  vec2 v = cellVel(uS, c, uN);
  float sp = length(v);
  if (sp > 3.0) v *= 3.0 / sp;
  vec2 p = s.xy - v * uTrail * ref.z / uDx;
  vec2 uv = p / vec2(uN);
  float z = st.a + st.r;
  vec3 w = vec3((uv.x - 0.5) * uSize.x, (z - uBase) * uExag + 2.0 * uExag, (uv.y - 0.5) * uSize.y);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(w, 1.0);
  float fade = smoothstep(0.0, 0.3, s.z) * (1.0 - smoothstep(s.w - 0.4, s.w, s.z));
  // beiradas rasas têm velocidade alta e pouca água: quase não aparecem
  vA = fade * smoothstep(0.1, 0.8, sp) * (1.0 - 0.9 * ref.z) * smoothstep(uMinShow + 0.1, uMinShow + 0.6, st.r);
}
`;

const DRAW_FRAG = /* glsl */ `
precision highp float;
varying float vA;
void main() { gl_FragColor = vec4(0.9, 0.98, 1.0, vA * 0.4); }
`;

function target() {
  return new THREE.WebGLRenderTarget(SIDE, SIDE, {
    type: THREE.FloatType, format: THREE.RGBAFormat,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: false,
  });
}

export class Flow {
  constructor(view, sim) {
    this.view = view;
    this.sim = sim;
    this.renderer = view.renderer;
    this.P = [target(), target()];
    const N = new THREE.Vector2(sim.W, sim.H);
    this.updMat = new THREE.ShaderMaterial({
      vertexShader: QUAD_VERT, fragmentShader: UPDATE,
      uniforms: {
        uP: { value: null }, uS: { value: null }, uN: { value: N }, uDx: { value: sim.dx },
        uDtFlow: { value: 0 }, uDtReal: { value: 0 }, uSeed: { value: 0 }, uMinH: { value: 0.1 },
        uBox: { value: new THREE.Vector4(0, 0, 1, 1) },
      },
    });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.updMat);
    this.quad.frustumCulled = false;
    this.qScene = new THREE.Scene();
    this.qScene.add(this.quad);
    this.qCam = new THREE.OrthographicCamera();

    const ref = new Float32Array(SIDE * SIDE * 2 * 3);
    for (let j = 0, k = 0; j < SIDE; j++) {
      for (let i = 0; i < SIDE; i++) {
        ref.set([i, j, 0, i, j, 1], k);
        k += 6;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SIDE * SIDE * 2 * 3), 3));
    g.setAttribute('ref', new THREE.BufferAttribute(ref, 3));
    const vu = view.uniforms;
    this.drawMat = new THREE.ShaderMaterial({
      vertexShader: DRAW_VERT, fragmentShader: DRAW_FRAG,
      uniforms: {
        uP: { value: null }, uS: { value: null }, uN: { value: N }, uSize: vu.uSize, uDx: { value: sim.dx },
        uExag: vu.uExag, uBase: vu.uBase, uMinShow: vu.uMinShow, uTrail: { value: 12 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.lines = new THREE.LineSegments(g, this.drawMat);
    this.lines.frustumCulled = false;
    this.lines.renderOrder = 2;
    view.scene.add(this.lines);
    this.last = 0;
  }

  set visible(v) { this.lines.visible = v; }
  get visible() { return this.lines.visible; }

  update(ts) {
    if (!this.lines.visible) return;
    const dt = this.last ? Math.min(0.1, (ts - this.last) / 1000) : 0;
    this.last = ts;
    const u = this.updMat.uniforms;
    u.uP.value = this.P[0].texture;
    u.uS.value = this.sim.stateTex;
    u.uDtFlow.value = dt * FLOW_TIME;
    u.uDtReal.value = dt;
    u.uSeed.value = Math.random() * 100;
    u.uMinH.value = Math.max(0.05, this.view.uniforms.uMinShow.value);
    this.visibleBox(u.uBox.value);
    this.renderer.setRenderTarget(this.P[1]);
    this.renderer.render(this.qScene, this.qCam);
    this.renderer.setRenderTarget(null);
    this.P.reverse();
    this.drawMat.uniforms.uP.value = this.P[0].texture;
    this.drawMat.uniforms.uS.value = this.sim.stateTex;
    this.drawMat.uniforms.uTrail.value = FLOW_TIME * 0.4;
  }

  // Retângulo da grade (uv) que a câmera enxerga: os cantos da tela
  // projetados no plano do alvo, limitados a 3× a distância da câmera.
  visibleBox(out) {
    const { camera, controls, size } = this.view;
    const ray = new THREE.Raycaster();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -controls.target.y);
    const far = camera.position.distanceTo(controls.target) * 3;
    let u0 = 1, v0 = 1, u1 = 0, v1 = 0;
    const p = new THREE.Vector3();
    for (const [x, y] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1]]) {
      ray.setFromCamera({ x, y }, camera);
      if (!ray.ray.intersectPlane(plane, p) || p.distanceTo(camera.position) > far) {
        ray.ray.at(far, p);
      }
      const u = p.x / size.W + 0.5, v = p.z / size.H + 0.5;
      u0 = Math.min(u0, u); u1 = Math.max(u1, u);
      v0 = Math.min(v0, v); v1 = Math.max(v1, v);
    }
    out.set(Math.max(0, u0), Math.max(0, v0), Math.min(1, u1), Math.min(1, v1));
    if (out.z <= out.x || out.w <= out.y) out.set(0, 0, 1, 1);
  }
}
