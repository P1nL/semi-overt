<script setup lang="ts">
// Adapted from Vue Bits: https://vue-bits.dev/r/WarpText.json
// Keep the registry shader; adapt sizing, hover isolation, fallback and lifecycle for orbiting glyphs.
import { Mesh, Program, Renderer, Texture, Triangle, type OGLRenderingContext } from 'ogl';
import { getWarpPointerTarget, isWarpTriggerTarget } from '@/shared/utils/warpText';
import { isTitleEffectOccluded } from '@/shared/utils/titleEffectOcclusion';
import { onMounted, onUnmounted, ref, watch, type CSSProperties } from 'vue';

interface WarpTextProps {
  pointerRegion?: (point: { x: number; y: number }) => boolean;
  interactionRoot?: HTMLElement | null;
  text?: string;
  color?: string;
  warpStrength?: number;
  warpScale?: number;
  speed?: number;
  pointerInfluence?: number;
  pointerStrength?: number;
  refraction?: number;
  ripple?: boolean;
  fontSize?: string | number;
  fontWeight?: string | number;
  fontFamily?: string;
  letterSpacing?: string | number;
  lineHeight?: string | number;
  className?: string;
  style?: CSSProperties;
}

interface RuntimeProps {
  text: string;
  color: string;
  fontSize: string | number;
  fontWeight: string | number;
  fontFamily: string;
  letterSpacing: string | number;
  lineHeight: string | number;
  warpStrength: number;
  warpScale: number;
  speed: number;
  pointerInfluence: number;
  pointerStrength: number;
  refraction: number;
  ripple: boolean;
}

interface RuntimeContext {
  program: Program;
  rasterize: () => void;
}

interface BuildTextCanvasArgs {
  container: HTMLElement;
  width: number;
  height: number;
  dpr: number;
  props: RuntimeProps;
}

const vertex = `#version 300 es
in vec2 position;
in vec2 uv;
out vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fragment = `#version 300 es
precision highp float;

uniform sampler2D uTextTexture;
uniform vec2 uResolution;
uniform vec2 uPointer;
uniform float uPointerActive;
uniform float uTime;
uniform float uWarpStrength;
uniform float uWarpScale;
uniform float uSpeed;
uniform float uPointerInfluence;
uniform float uPointerStrength;
uniform float uRefraction;
uniform float uRipple;
uniform float uMotion;

in vec2 vUv;
out vec4 fragColor;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);

  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));

  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    value += amplitude * noise(p);
    p *= 2.02;
    amplitude *= 0.5;
  }
  return value;
}

vec4 sampleText(vec2 uv) {
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
    return vec4(0.0);
  }
  return texture(uTextTexture, uv);
}

void main() {
  vec2 uv = vUv;
  float aspect = uResolution.x / max(uResolution.y, 1.0);
  float time = uTime * uSpeed;
  float scale = max(uWarpScale, 0.001);

  vec2 drift = vec2(time * 0.055, -time * 0.045);
  float n1 = fbm(uv * scale * 3.1 + drift);
  float n2 = fbm((uv + 19.17) * scale * 3.4 - drift.yx);
  vec2 ambient = (vec2(n1, n2) - 0.5) * uWarpStrength * 0.045 * uMotion;

  vec2 pointerDelta = uv - uPointer;
  vec2 aspectDelta = vec2(pointerDelta.x * aspect, pointerDelta.y);
  float dist = length(aspectDelta);
  float radius = max(uPointerInfluence, 0.001);
  float t = clamp(dist / radius, 0.0, 1.0);
  float lens = smoothstep(radius, 0.0, dist) * uPointerActive;
  float bulge = t * (1.0 - t) * (1.0 - t) * 6.75 * uPointerActive;
  vec2 dir = dist > 0.0001 ? vec2(aspectDelta.x / aspect, aspectDelta.y) / dist : vec2(0.0);

  float rippleWave = sin(dist * 28.0 - time * 4.2) * 0.5 + 0.5;
  float rippleRing = (rippleWave - 0.5) * uRipple;
  vec2 pointerWarp = -dir * bulge * uPointerStrength * 0.045;
  pointerWarp += dir * rippleRing * bulge * uPointerStrength * 0.016;

  vec2 displaced = uv + ambient + pointerWarp;
  vec2 splitDir = ambient + pointerWarp;
  float splitLen = length(splitDir);
  splitDir = splitLen > 0.00001 ? splitDir / splitLen : vec2(0.7071, 0.7071);
  vec2 split = splitDir * uRefraction * 0.16 * (0.35 + lens * 1.65);

  vec4 base = sampleText(displaced);
  float r = sampleText(displaced + split).r;
  float g = base.g;
  float b = sampleText(displaced - split).b;
  float a = max(max(sampleText(displaced + split).a, base.a), sampleText(displaced - split).a);

  vec3 color = vec3(r, g, b) + lens * base.a * 0.055;
  fragColor = vec4(color, a);
}
`;

const getFontValue = (value: string | number): string => (typeof value === 'number' ? `${value}px` : value);

const measureLine = (ctx: CanvasRenderingContext2D, line: string, letterSpacing: number): number => {
  const chars = Array.from(line);
  const textWidth = chars.reduce((width, char) => width + ctx.measureText(char).width, 0);
  return textWidth + Math.max(0, chars.length - 1) * letterSpacing;
};

const drawLine = (ctx: CanvasRenderingContext2D, line: string, x: number, y: number, letterSpacing: number): void => {
  const chars = Array.from(line);
  let cursor = x - measureLine(ctx, line, letterSpacing) / 2;

  chars.forEach((char, index) => {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + (index === chars.length - 1 ? 0 : letterSpacing);
  });
};

const buildTextCanvas = ({ container, width, height, dpr, props }: BuildTextCanvasArgs): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width * dpr));
  canvas.height = Math.max(1, Math.floor(height * dpr));

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const probe = document.createElement('span');
  probe.textContent = props.text;
  Object.assign(probe.style, {
    position: 'absolute',
    visibility: 'hidden',
    pointerEvents: 'none',
    whiteSpace: 'pre',
    inset: '0 auto auto 0',
    fontFamily: props.fontFamily,
    fontSize: getFontValue(props.fontSize),
    fontWeight: String(props.fontWeight),
    letterSpacing: getFontValue(props.letterSpacing),
    lineHeight: typeof props.lineHeight === 'number' ? String(props.lineHeight) : props.lineHeight
  });
  container.appendChild(probe);
  const computed = window.getComputedStyle(probe);
  let fontSizePx = parseFloat(computed.fontSize) || 96;
  const fontFamily = computed.fontFamily || 'sans-serif';
  const fontWeight = computed.fontWeight || String(props.fontWeight);
  let letterSpacing = computed.letterSpacing === 'normal' ? 0 : parseFloat(computed.letterSpacing) || 0;
  let lineHeight = parseFloat(computed.lineHeight);
  if (!Number.isFinite(lineHeight)) {
    lineHeight = fontSizePx * (typeof props.lineHeight === 'number' ? props.lineHeight : 0.92);
  }
  probe.remove();

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = props.color === 'currentColor' ? getComputedStyle(container).color : props.color;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  const lines = String(props.text || '').split('\n');
  const applyFont = () => {
    ctx.font = `${fontWeight} ${fontSizePx}px ${fontFamily}`;
  };
  applyFont();

  const maxWidth = width * 0.98;
  const maxHeight = height * 0.98;
  const widest = Math.max(...lines.map(line => measureLine(ctx, line, letterSpacing)), 1);
  const blockHeight = Math.max(lineHeight * lines.length, 1);
  const fit = Math.min(1, maxWidth / widest, maxHeight / blockHeight);

  if (fit < 1) {
    fontSizePx *= fit;
    letterSpacing *= fit;
    lineHeight *= fit;
    applyFont();
  }

  const startY = height / 2 - (lineHeight * (lines.length - 1)) / 2;
  lines.forEach((line, index) => drawLine(ctx, line, width / 2, startY + index * lineHeight, letterSpacing));

  return canvas;
};

const syncUniforms = (program: Program, props: RuntimeProps): void => {
  const uniforms = program.uniforms;
  uniforms.uWarpStrength.value = props.warpStrength;
  uniforms.uWarpScale.value = props.warpScale;
  uniforms.uSpeed.value = props.speed;
  uniforms.uPointerInfluence.value = props.pointerInfluence;
  uniforms.uPointerStrength.value = props.pointerStrength;
  uniforms.uRefraction.value = props.refraction;
  uniforms.uRipple.value = props.ripple ? 1 : 0;
};

const props = withDefaults(defineProps<WarpTextProps>(), {
  text: 'Bend the moment',
  color: 'currentColor',
  warpStrength: 0.08,
  warpScale: 1.7,
  speed: 0.55,
  pointerInfluence: 0.42,
  pointerStrength: 0.38,
  refraction: 0.018,
  ripple: true,
  fontSize: '1em',
  fontWeight: 900,
  fontFamily: 'inherit',
  letterSpacing: 0,
  lineHeight: 1,
  className: ''
});

const containerRef = ref<HTMLElement | null>(null);
const ready = ref(false);

let context: RuntimeContext | null = null;
let teardown: (() => void) | null = null;

const buildRuntimeProps = (): RuntimeProps => ({
  text: props.text,
  color: props.color,
  fontSize: props.fontSize,
  fontWeight: props.fontWeight,
  fontFamily: props.fontFamily,
  letterSpacing: props.letterSpacing,
  lineHeight: props.lineHeight,
  warpStrength: props.warpStrength,
  warpScale: props.warpScale,
  speed: props.speed,
  pointerInfluence: props.pointerInfluence,
  pointerStrength: props.pointerStrength,
  refraction: props.refraction,
  ripple: props.ripple
});

watch(
  () => [
    props.text,
    props.color,
    props.fontSize,
    props.fontWeight,
    props.fontFamily,
    props.letterSpacing,
    props.lineHeight,
    props.warpStrength,
    props.warpScale,
    props.speed,
    props.pointerInfluence,
    props.pointerStrength,
    props.refraction,
    props.ripple
  ],
  () => {
    if (context) {
      syncUniforms(context.program, buildRuntimeProps());
      context.rasterize();
    }
  }
);

onMounted(() => {
  const container = containerRef.value;
  if (!container || typeof window === 'undefined') return;

  // The DOM glyph remains visible if WebGL is unavailable.
  let renderer: Renderer;
  let gl: OGLRenderingContext;
  let resizeObserver: ResizeObserver | null = null;
  let intersectionObserver: IntersectionObserver | null = null;
  let raf = 0;
  let disposed = false;
  let contextLost = false;
  let visible = true;
  let pageVisible = !document.hidden;
  let reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
  let rasterVersion = 0;
  let themeObserver: MutationObserver | null = null;

  const pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, active: 0, activeTarget: 0 };
  const startTime = performance.now();

  try {
    renderer = new Renderer({
      webgl: 2,
      alpha: true,
      premultipliedAlpha: false,
      antialias: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2)
    });
    gl = renderer.gl;
  } catch (error) {
    console.warn('WarpText: WebGL could not be initialized.', error);
    return;
  }

  gl.clearColor(0, 0, 0, 0);
  const canvas = gl.canvas;
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = reduceMotion ? 'none' : 'block';
  canvas.style.pointerEvents = 'none';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const texture = new Texture(gl, {
    generateMipmaps: false,
    minFilter: gl.LINEAR,
    magFilter: gl.LINEAR,
    wrapS: gl.CLAMP_TO_EDGE,
    wrapT: gl.CLAMP_TO_EDGE
  });

  const geometry = new Triangle(gl);
  const program = new Program(gl, {
    vertex,
    fragment,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uTextTexture: { value: texture },
      uResolution: { value: new Float32Array([1, 1]) },
      uPointer: { value: new Float32Array([0.5, 0.5]) },
      uPointerActive: { value: 0 },
      uTime: { value: 0 },
      uWarpStrength: { value: props.warpStrength },
      uWarpScale: { value: props.warpScale },
      uSpeed: { value: props.speed },
      uPointerInfluence: { value: props.pointerInfluence },
      uPointerStrength: { value: props.pointerStrength },
      uRefraction: { value: props.refraction },
      uRipple: { value: props.ripple ? 1 : 0 },
      uMotion: { value: 0 }
    }
  });
  const mesh = new Mesh(gl, { geometry, program });

  const renderOnce = () => {
    if (disposed || contextLost || reduceMotion) return;
    renderer.render({ scene: mesh });
    ready.value = true;
  };

  const rasterize = async () => {
    const version = ++rasterVersion;
    if (document.fonts?.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* font loading failed; proceed with whatever is available */
      }
    }
    if (disposed || contextLost || version !== rasterVersion) return;

    const rect = { width: container.clientWidth, height: container.clientHeight };
    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const textCanvas = buildTextCanvas({
      container,
      width: rect.width,
      height: rect.height,
      dpr,
      props: buildRuntimeProps()
    });
    texture.image = textCanvas;
    texture.needsUpdate = true;
    renderOnce();
  };

  const resize = () => {
    if (disposed || contextLost) return;
    const rect = { width: container.clientWidth, height: container.clientHeight };
    if (rect.width <= 0 || rect.height <= 0) return;

    renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setSize(rect.width, rect.height);
    program.uniforms.uResolution.value[0] = gl.drawingBufferWidth;
    program.uniforms.uResolution.value[1] = gl.drawingBufferHeight;
    rasterize();
  };

  const onPointerLeave = (): void => {
    const wasActive = pointer.activeTarget > 0 || pointer.active > 0;
    pointer.activeTarget = 0;
    if (wasActive && !disposed && !contextLost && !reduceMotion && pageVisible && visible && !raf) raf = requestAnimationFrame(loop);
  };

  const onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType === 'touch' || reduceMotion || !pageVisible || !visible) return;
    if (isTitleEffectOccluded(event, document)) { onPointerLeave(); return; }
    const target = event.target instanceof Element ? event.target : null;
    const point = { x: event.clientX, y: event.clientY };
    if (!(props.pointerRegion ? props.pointerRegion(point) : isWarpTriggerTarget(target, container, props.interactionRoot ?? null))) {
      onPointerLeave();
      return;
    }
    const next = getWarpPointerTarget(
      { x: event.clientX, y: event.clientY }, canvas.getBoundingClientRect(),
      container.clientWidth / Math.max(1, container.clientHeight), props.pointerInfluence,
    );
    if (!next) { onPointerLeave(); return; }
    pointer.tx = next.x;
    pointer.ty = next.y;
    pointer.activeTarget = 1;
    if (!raf) raf = requestAnimationFrame(loop);
  };
  const onPointerOut = (event: PointerEvent): void => {
    if (!event.relatedTarget) onPointerLeave();
  };

  const onContextLost = (event: Event): void => {
    event.preventDefault();
    contextLost = true;
    ready.value = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const onVisibility = (): void => {
    pageVisible = !document.hidden;
    pointer.activeTarget = 0;
    if (pageVisible && visible && !reduceMotion && !contextLost && !raf) raf = requestAnimationFrame(loop);
    if (!pageVisible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  };

  const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const onReducedMotion = (event: MediaQueryListEvent): void => {
    reduceMotion = event.matches;
    pointer.activeTarget = 0;
    pointer.active = 0;
    program.uniforms.uPointerActive.value = 0;
    program.uniforms.uMotion.value = 0;
    canvas.style.display = reduceMotion ? 'none' : 'block';
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    ready.value = false;
    if (!reduceMotion) rasterize();
  };

  const loop = (now: number): void => {
    raf = 0;
    if (disposed || contextLost || reduceMotion || !pageVisible || !visible) return;
    pointer.x += (pointer.tx - pointer.x) * 0.12;
    pointer.y += (pointer.ty - pointer.y) * 0.12;
    pointer.active += (pointer.activeTarget - pointer.active) * 0.12;
    if (pointer.activeTarget === 0 && pointer.active < 0.001) pointer.active = 0;
    program.uniforms.uPointer.value[0] = pointer.x;
    program.uniforms.uPointer.value[1] = pointer.y;
    program.uniforms.uPointerActive.value = pointer.active;
    program.uniforms.uMotion.value = pointer.active;
    // Idle glyphs render once; only nearby glyphs in the same group keep animating.
    program.uniforms.uTime.value = (now - startTime) * 0.001;
    renderOnce();
    if (pointer.activeTarget > 0 || pointer.active > 0) raf = requestAnimationFrame(loop);
  };

  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);

  intersectionObserver = new IntersectionObserver(
    ([entry]: IntersectionObserverEntry[]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible && pageVisible && !reduceMotion && !contextLost && !raf) raf = requestAnimationFrame(loop);
      if (!visible && raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    },
    { threshold: 0 }
  );
  intersectionObserver.observe(container);

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerout', onPointerOut);
  window.addEventListener('blur', onPointerLeave);
  canvas.addEventListener('webglcontextlost', onContextLost, false);
  document.addEventListener('visibilitychange', onVisibility);
  mediaQuery?.addEventListener('change', onReducedMotion);
  document.fonts?.addEventListener('loadingdone', rasterize);
  themeObserver = new MutationObserver(() => { rasterize(); });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style'] });

  syncUniforms(program, buildRuntimeProps());
  context = { program, rasterize };
  resize();
  if (!reduceMotion && pageVisible) raf = requestAnimationFrame(loop);

  teardown = () => {
    disposed = true;
    context = null;
    if (raf) cancelAnimationFrame(raf);
    resizeObserver?.disconnect();
    intersectionObserver?.disconnect();
    themeObserver?.disconnect();
    document.fonts?.removeEventListener('loadingdone', rasterize);
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerout', onPointerOut);
    window.removeEventListener('blur', onPointerLeave);
    canvas.removeEventListener('webglcontextlost', onContextLost);
    document.removeEventListener('visibilitychange', onVisibility);
    mediaQuery?.removeEventListener('change', onReducedMotion);

    if (!contextLost) {
      try {
        if (texture?.texture) gl.deleteTexture(texture.texture);
        geometry?.remove?.();
        program?.remove?.();
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        /* teardown best-effort; context may already be gone */
      }
    }

    if (canvas.parentNode === container) container.removeChild(canvas);
  };
});

onUnmounted(() => {
  teardown?.();
  teardown = null;
});
</script>

<template>
  <span ref="containerRef" class="warp-text" :class="className" :style="style" :aria-label="text">
    <span class="warp-text__fallback" :style="{ opacity: ready ? 0 : 1 }">{{ text }}</span>
  </span>
</template>

<style scoped>
.warp-text { position: relative; display: block; width: 100%; height: 1em; isolation: isolate; font: inherit; line-height: 1; }
.warp-text__fallback { display: block; line-height: 1; font: inherit; }
</style>
