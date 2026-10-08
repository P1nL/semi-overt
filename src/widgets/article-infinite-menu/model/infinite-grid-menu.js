import { mat4, quat, vec2, vec3 } from 'gl-matrix';
import { getResultCardMotion, markResultCardMotionRendered } from '@/shared/utils/resultCardMotion';
import { stepPressCamera } from './press-camera';

const discVertShaderSource = `#version 300 es

uniform mat4 uWorldMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform vec3 uCameraPosition;
uniform vec4 uRotationAxisVelocity;
uniform int uTransitionMain;
uniform float uMainScale;
uniform float uOthersOpacity;
uniform bool uOpaqueMain;
uniform int uActiveCard;

in vec3 aModelPosition;
in vec3 aModelNormal;
in vec2 aModelUvs;
in mat4 aInstanceMatrix;

out vec2 vUvs;
out float vAlpha;
flat out int vInstanceId;

#define PI 3.141593

void main() {
    vec4 worldPosition = uWorldMatrix * aInstanceMatrix * vec4(aModelPosition, 1.);

    vec3 centerPos = (uWorldMatrix * aInstanceMatrix * vec4(0., 0., 0., 1.)).xyz;
    float radius = length(centerPos.xyz);

    // This mesh has four corners, not a centre vertex: deform all corners equally.
    // Fade the tangent near the rotation pole instead of normalizing a near-zero vector.
    vec3 tangent = cross(centerPos / max(radius, .0001), uRotationAxisVelocity.xyz);
    vec3 stretchDir = tangent / max(length(tangent), .2);
    float stretch = min(.08, uRotationAxisVelocity.w * 6.);
    vec3 relativeVertexPos = worldPosition.xyz - centerPos;
    worldPosition.xyz += stretchDir * dot(stretchDir, relativeVertexPos) * stretch;

    worldPosition.xyz = radius * normalize(worldPosition.xyz);

    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
    // Scale one instance around its own projected center, never the entire canvas.
    if (gl_InstanceID == uTransitionMain) {
        vec4 projectedCenter = uProjectionMatrix * uViewMatrix * vec4(centerPos, 1.);
        vec2 centerNdc = projectedCenter.xy / projectedCenter.w;
        gl_Position.xy = mix(centerNdc, gl_Position.xy / gl_Position.w, uMainScale) * gl_Position.w;
    }

    vAlpha = smoothstep(0.5, 1., normalize(worldPosition.xyz).z) * .9 + .1;
    if (uOpaqueMain && gl_InstanceID == uActiveCard) vAlpha = 1.;
    vAlpha *= gl_InstanceID == uTransitionMain ? step(0.00001, uMainScale) : uOthersOpacity;
    vUvs = aModelUvs;
    vInstanceId = gl_InstanceID;
}
`;

const discFragShaderSource = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform int uItemCount;
uniform int uAtlasSize;
uniform int uItemOffset;
uniform int uSwapVertex;
uniform int uNextAtlasSize;
uniform sampler2D uNextTex;

out vec4 outColor;

in vec2 vUvs;
in float vAlpha;
flat in int vInstanceId;

void main() {
    int itemIndex = (vInstanceId + uItemOffset) % uItemCount;
    int cellX = itemIndex % uAtlasSize;
    int cellY = itemIndex / uAtlasSize;
    vec2 cellSize = vec2(1.0) / float(uAtlasSize);
    vec2 cellOffset = vec2(float(cellX), float(cellY)) * cellSize;
    vec2 st = vec2(vUvs.x, 1.0 - vUvs.y) * cellSize + cellOffset;
    vec4 sampledColor = vInstanceId == uSwapVertex
        ? texture(uNextTex, vec2(vUvs.x, 1.0 - vUvs.y) / float(uNextAtlasSize))
        : texture(uTex, st);

    if (sampledColor.a < 0.02) discard;

    // Atlas pixels and the browser's WebGL canvas use premultiplied alpha.
    // Scale RGB together with alpha, otherwise a fading card leaves colour behind.
    outColor = sampledColor * vAlpha;
}
`;

const centerLabelVertShaderSource = `#version 300 es

uniform mat4 uModelMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;

in vec3 aModelPosition;
in vec2 aModelUvs;

out vec2 vUvs;

void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aModelPosition, 1.0);
    vUvs = aModelUvs;
}
`;

const centerLabelFragShaderSource = `#version 300 es
precision highp float;

uniform sampler2D uTex;
uniform float uOpacity;

in vec2 vUvs;
out vec4 outColor;

void main() {
    vec4 sampledColor = texture(uTex, vec2(vUvs.x, 1.0 - vUvs.y));
    if (sampledColor.a < 0.02) discard;

    outColor = vec4(sampledColor.rgb, sampledColor.a * uOpacity);
}
`;

class Face {
  constructor(a, b, c) {
    this.a = a;
    this.b = b;
    this.c = c;
  }
}

class Vertex {
  constructor(x, y, z) {
    this.position = vec3.fromValues(x, y, z);
    this.normal = vec3.create();
    this.uv = vec2.create();
  }
}

class Geometry {
  constructor() {
    this.vertices = [];
    this.faces = [];
  }

  addVertex(...args) {
    for (let i = 0; i < args.length; i += 3) {
      this.vertices.push(new Vertex(args[i], args[i + 1], args[i + 2]));
    }
    return this;
  }

  addFace(...args) {
    for (let i = 0; i < args.length; i += 3) {
      this.faces.push(new Face(args[i], args[i + 1], args[i + 2]));
    }
    return this;
  }

  get lastVertex() {
    return this.vertices[this.vertices.length - 1];
  }

  subdivide(divisions = 1) {
    const midPointCache = {};
    let f = this.faces;

    for (let div = 0; div < divisions; ++div) {
      const newFaces = new Array(f.length * 4);

      f.forEach((face, ndx) => {
        const mAB = this.getMidPoint(face.a, face.b, midPointCache);
        const mBC = this.getMidPoint(face.b, face.c, midPointCache);
        const mCA = this.getMidPoint(face.c, face.a, midPointCache);

        const i = ndx * 4;
        newFaces[i + 0] = new Face(face.a, mAB, mCA);
        newFaces[i + 1] = new Face(face.b, mBC, mAB);
        newFaces[i + 2] = new Face(face.c, mCA, mBC);
        newFaces[i + 3] = new Face(mAB, mBC, mCA);
      });

      f = newFaces;
    }

    this.faces = f;
    return this;
  }

  spherize(radius = 1) {
    this.vertices.forEach(vertex => {
      vec3.normalize(vertex.normal, vertex.position);
      vec3.scale(vertex.position, vertex.normal, radius);
    });
    return this;
  }

  get data() {
    return {
      vertices: this.vertexData,
      indices: this.indexData,
      normals: this.normalData,
      uvs: this.uvData
    };
  }

  get vertexData() {
    return new Float32Array(this.vertices.flatMap(v => Array.from(v.position)));
  }

  get normalData() {
    return new Float32Array(this.vertices.flatMap(v => Array.from(v.normal)));
  }

  get uvData() {
    return new Float32Array(this.vertices.flatMap(v => Array.from(v.uv)));
  }

  get indexData() {
    return new Uint16Array(this.faces.flatMap(f => [f.a, f.b, f.c]));
  }

  getMidPoint(ndxA, ndxB, cache) {
    const cacheKey = ndxA < ndxB ? `k_${ndxB}_${ndxA}` : `k_${ndxA}_${ndxB}`;
    if (Object.prototype.hasOwnProperty.call(cache, cacheKey)) {
      return cache[cacheKey];
    }
    const a = this.vertices[ndxA].position;
    const b = this.vertices[ndxB].position;
    const ndx = this.vertices.length;
    cache[cacheKey] = ndx;
    this.addVertex((a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5, (a[2] + b[2]) * 0.5);
    return ndx;
  }
}

class IcosahedronGeometry extends Geometry {
  constructor() {
    super();
    const t = Math.sqrt(5) * 0.5 + 0.5;
    this.addVertex(
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      0,
      0,
      -1,
      t,
      0,
      1,
      t,
      0,
      -1,
      -t,
      0,
      1,
      -t,
      t,
      0,
      -1,
      t,
      0,
      1,
      -t,
      0,
      -1,
      -t,
      0,
      1
    ).addFace(
      0,
      11,
      5,
      0,
      5,
      1,
      0,
      1,
      7,
      0,
      7,
      10,
      0,
      10,
      11,
      1,
      5,
      9,
      5,
      11,
      4,
      11,
      10,
      2,
      10,
      7,
      6,
      7,
      1,
      8,
      3,
      9,
      4,
      3,
      4,
      2,
      3,
      2,
      6,
      3,
      6,
      8,
      3,
      8,
      9,
      4,
      9,
      5,
      2,
      4,
      11,
      6,
      2,
      10,
      8,
      6,
      7,
      9,
      8,
      1
    );
  }
}

class CardGeometry extends Geometry {
  constructor(aspect = 0.8) {
    super();
    this.addVertex(
      -aspect, -1, 0,
      aspect, -1, 0,
      aspect, 1, 0,
      -aspect, 1, 0
    );
    this.vertices[0].uv = vec2.fromValues(0, 0);
    this.vertices[1].uv = vec2.fromValues(1, 0);
    this.vertices[2].uv = vec2.fromValues(1, 1);
    this.vertices[3].uv = vec2.fromValues(0, 1);
    this.addFace(0, 1, 2, 0, 2, 3);
  }
}

function createShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);

  if (success) {
    return shader;
  }

  console.error(gl.getShaderInfoLog(shader));
  gl.deleteShader(shader);
  return null;
}

function createProgram(gl, shaderSources, transformFeedbackVaryings, attribLocations) {
  const program = gl.createProgram();

  [gl.VERTEX_SHADER, gl.FRAGMENT_SHADER].forEach((type, ndx) => {
    const shader = createShader(gl, type, shaderSources[ndx]);
    if (shader) gl.attachShader(program, shader);
  });

  if (transformFeedbackVaryings) {
    gl.transformFeedbackVaryings(program, transformFeedbackVaryings, gl.SEPARATE_ATTRIBS);
  }

  if (attribLocations) {
    for (const attrib in attribLocations) {
      gl.bindAttribLocation(program, attribLocations[attrib], attrib);
    }
  }

  gl.linkProgram(program);
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);

  if (success) {
    return program;
  }

  console.error(gl.getProgramInfoLog(program));
  gl.deleteProgram(program);
  return null;
}

function makeVertexArray(gl, bufLocNumElmPairs, indices) {
  const va = gl.createVertexArray();
  gl.bindVertexArray(va);

  for (const [buffer, loc, numElem] of bufLocNumElmPairs) {
    if (loc === -1) continue;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, numElem, gl.FLOAT, false, 0, 0);
  }

  if (indices) {
    const indexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
  }

  gl.bindVertexArray(null);
  return va;
}

function resizeCanvasToDisplaySize(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio);
  const displayWidth = Math.round(canvas.clientWidth * dpr);
  const displayHeight = Math.round(canvas.clientHeight * dpr);
  const needResize = canvas.width !== displayWidth || canvas.height !== displayHeight;
  if (needResize) {
    canvas.width = displayWidth;
    canvas.height = displayHeight;
  }
  return needResize;
}

function makeBuffer(gl, sizeOrData, usage) {
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, sizeOrData, usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return buf;
}

function createAndSetupTexture(gl, minFilter, magFilter, wrapS, wrapT) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, wrapT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, magFilter);
  return texture;
}

function readCssToken(name, fallback) {
  const value = window.getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

function normalizeCenterLabel(label) {
  return String(label || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

function wrapCenterLabel(context, text, maxWidth) {
  const characters = Array.from(text);
  const lines = [];
  let line = '';

  for (const character of characters) {
    const candidate = line + character;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = character;
    } else {
      line = candidate;
    }
  }

  if (line) lines.push(line);
  return lines;
}

function fitCenterLabel(context, text, fontFamily, maxWidth, maxHeight) {
  const explicitLines = text.split('\n').filter(Boolean);
  const hasExplicitLineBreaks = explicitLines.length > 1;

  for (let fontSize = 208; fontSize >= 64; fontSize -= 8) {
    context.font = `900 ${fontSize}px ${fontFamily}`;
    const lines = hasExplicitLineBreaks ? explicitLines : wrapCenterLabel(context, text, maxWidth);
    const lineHeight = fontSize * (hasExplicitLineBreaks ? 0.9 : 1.08);
    const maxLines = hasExplicitLineBreaks ? 3 : 2;

    if (
      lines.length <= maxLines
      && lines.length * lineHeight <= maxHeight
      && lines.every(line => context.measureText(line).width <= maxWidth)
    ) {
      return { fontSize, lineHeight, lines };
    }
  }

  const characters = Array.from(text);
  const midpoint = Math.ceil(characters.length / 2);
  const lines = [characters.slice(0, midpoint).join(''), characters.slice(midpoint).join('')].filter(Boolean);
  let fontSize = 64;

  while (fontSize > 40) {
    context.font = `900 ${fontSize}px ${fontFamily}`;
    if (lines.every(line => context.measureText(line).width <= maxWidth)) break;
    fontSize -= 4;
  }

  return { fontSize, lineHeight: fontSize * 1.08, lines };
}

function createCenterLabelTextureCanvas(label) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 1024;
  canvas.height = 512;

  const normalizedLabel = normalizeCenterLabel(label);
  if (!context || !normalizedLabel) return canvas;

  const bareLabel = normalizedLabel.replace(/^[“”"]+|[“”"]+$/g, '').trim() || normalizedLabel;
  const displayLines = bareLabel.split('\n');
  displayLines[0] = `“${displayLines[0]}`;
  displayLines[displayLines.length - 1] = `${displayLines[displayLines.length - 1]}”`;
  const displayLabel = displayLines.join('\n');
  const fontFamily = readCssToken(
    '--font-display',
    '"Zhaohua Display", "Noto Serif SC", "Songti SC", "STSong", "SimSun", serif'
  ).replace(/\s+/g, ' ');
  const textColor = readCssToken('--color-text', '#f5f5f7');
  const fitted = fitCenterLabel(context, displayLabel, fontFamily, canvas.width - 144, canvas.height - 112);
  const totalHeight = fitted.lines.length * fitted.lineHeight;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = textColor;
  context.font = `900 ${fitted.fontSize}px ${fontFamily}`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  fitted.lines.forEach((line, index) => {
    const y = canvas.height / 2 - totalHeight / 2 + fitted.lineHeight * (index + 0.5);
    context.fillText(line, canvas.width / 2, y);
  });

  return canvas;
}

class ArcballControl {
  isPointerDown = false;
  orientation = quat.create();
  pointerRotation = quat.create();
  rotationVelocity = 0;
  rotationAxis = vec3.fromValues(1, 0, 0);
  snapDirection = vec3.fromValues(0, 0, -1);
  snapTargetDirection;
  EPSILON = 0.1;
  IDENTITY_QUAT = quat.create();
  autoRotation = null;
  pointerId = null;
  angularVelocity = vec3.create();

  stopAutoRotation() {
    this.autoRotation = null;
    this.snapTargetDirection = null;
    quat.identity(this.pointerRotation);
    quat.identity(this._combinedQuat);
    this._rotationVelocity = 0;
    this.rotationVelocity = 0;
    vec3.zero(this.angularVelocity);
  }

  rotateTo(target, duration) {
    this.stopAutoRotation();
    this.autoRotation = { from: quat.clone(this.orientation), target, elapsed: 0, duration };
  }

  constructor(canvas, updateCallback) {
    this.canvas = canvas;
    this.updateCallback = updateCallback || (() => null);

    this.pointerPos = vec2.create();
    this.previousPointerPos = vec2.create();
    this._rotationVelocity = 0;
    this._combinedQuat = quat.create();

    canvas.addEventListener('pointerdown', e => {
      if (this.pointerId !== null) return;
      this.stopAutoRotation();
      this.pointerId = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      const bounds = canvas.getBoundingClientRect();
      vec2.set(this.pointerPos, e.clientX - bounds.left, e.clientY - bounds.top);
      vec2.copy(this.previousPointerPos, this.pointerPos);
      this.isPointerDown = true;
    });
    const releasePointer = e => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.isPointerDown = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    };
    canvas.addEventListener('pointerup', releasePointer);
    canvas.addEventListener('pointercancel', releasePointer);
    canvas.addEventListener('lostpointercapture', releasePointer);
    canvas.addEventListener('pointermove', e => {
      if (this.isPointerDown && e.pointerId === this.pointerId) {
        const bounds = canvas.getBoundingClientRect();
        vec2.set(this.pointerPos, e.clientX - bounds.left, e.clientY - bounds.top);
      }
    });

    canvas.style.touchAction = 'none';
  }

  update(deltaTime, targetFrameDuration = 16, heldOverride = null) {
    const timeScale = deltaTime / targetFrameDuration + 0.00001;
    let angleFactor = timeScale;
    let snapRotation = quat.create();

    const held = heldOverride === null ? this.isPointerDown : heldOverride;
    if (this.autoRotation) {
      const flight = this.autoRotation;
      flight.elapsed += deltaTime;
      const progress = flight.duration > 0 ? Math.min(1, flight.elapsed / flight.duration) : 1;
      // Ease out on the sphere itself, keeping every card in the same world.
      const eased = 1 - Math.pow(1 - progress, 3);
      const next = quat.slerp(quat.create(), flight.from, flight.target, eased);
      quat.multiply(snapRotation, next, quat.conjugate(quat.create(), this.orientation));
      if (progress === 1) this.autoRotation = null;
    } else if (held) {
      const INTENSITY = 1 - Math.pow(0.7, timeScale);
      const ANGLE_AMPLIFICATION = 5 / timeScale;

      const midPointerPos = vec2.sub(vec2.create(), this.pointerPos, this.previousPointerPos);
      vec2.scale(midPointerPos, midPointerPos, INTENSITY);

      if (vec2.sqrLen(midPointerPos) > this.EPSILON) {
        vec2.add(midPointerPos, this.previousPointerPos, midPointerPos);

        const p = this.#project(midPointerPos);
        const q = this.#project(this.previousPointerPos);
        const a = vec3.normalize(vec3.create(), p);
        const b = vec3.normalize(vec3.create(), q);

        vec2.copy(this.previousPointerPos, midPointerPos);

        angleFactor *= ANGLE_AMPLIFICATION;

        this.quatFromVectors(a, b, this.pointerRotation, angleFactor);
      } else {
        quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);
      }
    } else {
      const INTENSITY = 1 - Math.pow(0.9, timeScale);
      quat.slerp(this.pointerRotation, this.pointerRotation, this.IDENTITY_QUAT, INTENSITY);

      if (this.snapTargetDirection) {
        const SNAPPING_INTENSITY = 0.2;
        const a = this.snapTargetDirection;
        const b = this.snapDirection;
        const sqrDist = vec3.squaredDistance(a, b);
        const distanceFactor = Math.max(0.1, 1 - sqrDist * 10);
        angleFactor *= SNAPPING_INTENSITY * distanceFactor;
        this.quatFromVectors(a, b, snapRotation, angleFactor);
      }
    }

    const combinedQuat = quat.multiply(quat.create(), snapRotation, this.pointerRotation);
    this.orientation = quat.multiply(quat.create(), combinedQuat, this.orientation);
    quat.normalize(this.orientation, this.orientation);

    // Normalize by frame duration BEFORE filtering. Smooth direction and speed together
    // so small pointer reversals do not swing the deformation axis at full strength.
    const sinHalf = Math.hypot(combinedQuat[0], combinedQuat[1], combinedQuat[2]);
    const rad = 2 * Math.atan2(sinHalf, Math.abs(combinedQuat[3]));
    const factor = sinHalf > 1e-8 ? rad * (combinedQuat[3] < 0 ? -1 : 1) / (sinHalf * 2 * Math.PI * timeScale) : 0;
    const velocity = vec3.fromValues(combinedQuat[0] * factor, combinedQuat[1] * factor, combinedQuat[2] * factor);
    vec3.lerp(this.angularVelocity, this.angularVelocity, velocity, 1 - Math.exp(-Math.max(0, deltaTime) / 100));
    this.rotationVelocity = vec3.length(this.angularVelocity);
    if (this.rotationVelocity > 1e-8) {
      vec3.scale(this.rotationAxis, this.angularVelocity, 1 / this.rotationVelocity);
    }

    this.updateCallback(deltaTime);
  }

  quatFromVectors(a, b, out, angleFactor = 1) {
    const axis = vec3.cross(vec3.create(), a, b);
    vec3.normalize(axis, axis);
    const d = Math.max(-1, Math.min(1, vec3.dot(a, b)));
    const angle = Math.acos(d) * angleFactor;
    quat.setAxisAngle(out, axis, angle);
    return { q: out, axis, angle };
  }

  #project(pos) {
    const r = 2;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const s = Math.max(w, h) - 1;

    const x = (2 * pos[0] - w - 1) / s;
    const y = (2 * pos[1] - h - 1) / s;
    let z = 0;
    const xySq = x * x + y * y;
    const rSq = r * r;

    if (xySq <= rSq / 2.0) {
      z = Math.sqrt(rSq - xySq);
    } else {
      z = rSq / Math.sqrt(xySq);
    }
    return vec3.fromValues(-x, y, z);
  }
}

class InfiniteGridMenu {
  TARGET_FRAME_DURATION = 1000 / 60;
  SPHERE_RADIUS = 2;

  #time = 0;
  #deltaTime = 0;
  #deltaFrames = 0;
  #frames = 0;
  #nextFrame = 0;

  camera = {
    matrix: mat4.create(),
    near: 0.1,
    far: 40,
    fov: Math.PI / 4,
    aspect: 1,
    position: vec3.fromValues(0, 0, 3),
    up: vec3.fromValues(0, 1, 0),
    matrices: {
      view: mat4.create(),
      projection: mat4.create(),
      inversProjection: mat4.create()
    }
  };

  itemOffset = 0;
  resultReplacement = null;
  nearestVertexIndex = null;
  smoothRotationVelocity = 0;
  scaleFactor = 1.0;
  movementActive = false;
  transitionMainIndex = null;
  presentationPress = null;
  lastWheelTime = -Infinity;
  wheelDistance = 0;
  wheelConsumed = false;

  handleWheel(event) {
    // Keep browser zoom and horizontal trackpad gestures native.
    if (event.ctrlKey || event.metaKey || !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (this.destroyed || !this.animationFrame || this.presentationPress !== null || getResultCardMotion(this.canvas)) return;
    event.preventDefault();
    const now = performance.now();
    if (now - this.lastWheelTime > 200) {
      this.wheelDistance = 0;
      this.wheelConsumed = false;
    }
    this.lastWheelTime = now;
    // Consume the whole burst, including its inertial tail; never queue flights.
    if (this.control.isPointerDown || this.control.autoRotation) {
      this.wheelConsumed = true;
      return;
    }
    if (this.wheelConsumed || this.items.length < 2) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.canvas.clientHeight : 1;
    this.wheelDistance += event.deltaY * unit;
    if (Math.abs(this.wheelDistance) < 12) return;
    this.wheelConsumed = true;

    const count = this.items.length;
    const current = (this.#findNearestVertexIndex() + this.itemOffset) % count;
    const targetItem = (current + Math.sign(this.wheelDistance) + count) % count;
    let targetVertex = -1;
    let bestAlignment = -Infinity;
    // Repeated instances share an article: choose the shortest trip to that article.
    for (let i = (targetItem - this.itemOffset + count) % count; i < this.instancePositions.length; i += count) {
      const direction = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(i));
      const alignment = vec3.dot(direction, this.control.snapDirection);
      if (alignment > bestAlignment) { bestAlignment = alignment; targetVertex = i; }
    }
    if (targetVertex < 0) return;
    const direction = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(targetVertex));
    const correction = quat.rotationTo(quat.create(), direction, this.control.snapDirection);
    const target = quat.multiply(quat.create(), correction, this.control.orientation);
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.control.rotateTo(target, reducedMotion ? 0 : 500);
  }

  paintCurrentFrame() {
    if (this.destroyed) return;
    this.#animate(0);
    this.#render();
  }

  captureResultState() {
    this.finishResultReplacement();
    return {
      items: this.items.slice(), orientation: Array.from(this.control.orientation),
      cameraZ: this.camera.position[2], itemOffset: this.itemOffset,
      instanceCount: this.instancePositions.length
    };
  }

  replaceResultsFrom(previous, direction = 1) {
    this.finishResultReplacement();
    const next = { items: this.items, tex: this.tex, atlasSize: this.atlasSize };
    this.items = previous.items;
    this.itemOffset = previous.itemOffset;
    this.#initTexture();
    quat.copy(this.control.orientation, previous.orientation);
    this.control.stopAutoRotation();
    this.smoothRotationVelocity = 0;
    this.camera.position[2] = previous.cameraZ;
    this.#updateCameraMatrix();
    // Keep the old sphere topology for the actual card flight, even if result counts differ.
    if (this.instancePositions.length !== previous.instanceCount) {
      const geo = new IcosahedronGeometry();
      while (geo.vertices.length < previous.instanceCount) geo.subdivide(1);
      geo.spherize(this.SPHERE_RADIUS);
      this.instancePositions = geo.vertices.map(v => v.position);
      this.DISC_INSTANCE_COUNT = this.instancePositions.length;
      this.gl.deleteBuffer(this.discInstances.buffer);
      this.#initDiscInstances(this.DISC_INSTANCE_COUNT);
    }
    const current = this.#findNearestVertexIndex();
    let targetVertex = -1, best = -Infinity;
    for (let i = 0; i < this.instancePositions.length; i++) {
      if (i === current) continue;
      const position = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(i));
      if (position[0] * direction <= .001) continue;
      const alignment = vec3.dot(position, this.control.snapDirection);
      if (alignment > best) { best = alignment; targetVertex = i; }
    }
    if (targetVertex < 0) targetVertex = (current + 1) % this.instancePositions.length;
    const position = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(targetVertex));
    const correction = quat.rotationTo(quat.create(), position, this.control.snapDirection);
    const target = quat.multiply(quat.create(), correction, this.control.orientation);
    this.resultReplacement = { ...next, targetVertex, target };
    this.control.rotateTo(target, 500);
    // Paint the inherited old pose before Vue reveals this replacement canvas.
    this.#animate(0);
    this.#render();
  }

  finishResultReplacement() {
    const next = this.resultReplacement;
    if (!next) return;
    this.control.stopAutoRotation();
    quat.copy(this.control.orientation, next.target);
    this.gl.deleteTexture(this.tex);
    this.items = next.items;
    this.tex = next.tex;
    this.atlasSize = next.atlasSize;
    this.itemOffset = (this.items.length - next.targetVertex % this.items.length) % this.items.length;
    this.resultReplacement = null;
    this.onActiveItemChange(0);
    // Admit all new results without changing the centred card's identity or pose.
    if (this.instancePositions.length < this.items.length) {
      const geo = new IcosahedronGeometry();
      while (geo.vertices.length < this.items.length) geo.subdivide(1);
      geo.spherize(this.SPHERE_RADIUS);
      this.instancePositions = geo.vertices.map(v => v.position);
      this.DISC_INSTANCE_COUNT = this.instancePositions.length;
      this.gl.deleteBuffer(this.discInstances.buffer);
      this.#initDiscInstances(this.DISC_INSTANCE_COUNT);
    }
  }

  setPresentationPress(value, initializeHidden = false) {
    if (value !== null && this.control?.autoRotation) this.control.stopAutoRotation();
    if (value !== null && this.presentationPress === null && value >= .99) this.canvas.dataset.viewPressPending = '';
    this.presentationPress = value === null ? null : Math.max(0, Math.min(1, value));
    if (initializeHidden && this.presentationPress !== null) {
      // Only prime an invisible returning panel. Visible entry always uses
      // the exact same damped update as a real pointerdown.
      this.camera.position[2] = 3 * this.scaleFactor + 2.5 * this.presentationPress;
      this.#updateCameraMatrix();
    }
  }

  pause() { cancelAnimationFrame(this.animationFrame); this.animationFrame = 0; }
  resume() { if (!this.animationFrame && !this.destroyed) this.run(performance.now()); }

  constructor(canvas, items, onActiveItemChange, onMovementChange, onInit = null, scale = 1.0, options = {}) {
    this.canvas = canvas;
    this.items = items || [];
    this.onActiveItemChange = onActiveItemChange || (() => {});
    this.onMovementChange = onMovementChange || (() => {});
    this.scaleFactor = scale;
    this.centerLabel = normalizeCenterLabel(options.centerLabel);
    this.opaqueMain = options.opaqueMain === true;
    this.camera.position[2] = 3 * scale;
    this.#init(onInit);
  }

  resize() {
    this.viewportSize = vec2.set(this.viewportSize || vec2.create(), this.canvas.clientWidth, this.canvas.clientHeight);

    const gl = this.gl;
    const needsResize = resizeCanvasToDisplaySize(gl.canvas);
    if (needsResize) {
      gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    this.#updateProjectionMatrix(gl);
  }

  run(time = 0) {
    if (this.destroyed) return;
    this.animationFrame = requestAnimationFrame(t => this.run(t));
    if (time + 0.01 < this.#nextFrame) return;
    this.#nextFrame += (Math.max(0, Math.floor((time - this.#nextFrame + 0.01) / this.TARGET_FRAME_DURATION)) + 1) * this.TARGET_FRAME_DURATION;

    this.#deltaTime = Math.min(32, time - this.#time);
    this.#time = time;
    this.#deltaFrames = this.#deltaTime / this.TARGET_FRAME_DURATION;
    this.#frames += this.#deltaFrames;

    this.#animate(this.#deltaTime);
    this.#render();

  }

  dispose() {
    this.destroyed = true;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);

    const gl = this.gl;
    if (!gl) return;

    if (this.centerLabelTexture) gl.deleteTexture(this.centerLabelTexture);
    if (this.centerLabelVAO) gl.deleteVertexArray(this.centerLabelVAO);
    if (this.centerLabelProgram) gl.deleteProgram(this.centerLabelProgram);
    if (this.tex) gl.deleteTexture(this.tex);
    if (this.resultReplacement?.tex) gl.deleteTexture(this.resultReplacement.tex);
    if (this.discVAO) gl.deleteVertexArray(this.discVAO);
    if (this.discInstances?.buffer) gl.deleteBuffer(this.discInstances.buffer);
    if (this.discProgram) gl.deleteProgram(this.discProgram);
  }

  #init(onInit) {
    this.gl = this.canvas.getContext('webgl2', { antialias: true, alpha: true, premultipliedAlpha: true });
    const gl = this.gl;
    if (!gl) {
      throw new Error('No WebGL 2 context!');
    }

    this.viewportSize = vec2.fromValues(this.canvas.clientWidth, this.canvas.clientHeight);
    this.drawBufferSize = vec2.clone(this.viewportSize);

    this.discProgram = createProgram(gl, [discVertShaderSource, discFragShaderSource], null, {
      aModelPosition: 0,
      aModelNormal: 1,
      aModelUvs: 2,
      aInstanceMatrix: 3
    });

    this.discLocations = {
      aModelPosition: gl.getAttribLocation(this.discProgram, 'aModelPosition'),
      aModelUvs: gl.getAttribLocation(this.discProgram, 'aModelUvs'),
      aInstanceMatrix: gl.getAttribLocation(this.discProgram, 'aInstanceMatrix'),
      uWorldMatrix: gl.getUniformLocation(this.discProgram, 'uWorldMatrix'),
      uViewMatrix: gl.getUniformLocation(this.discProgram, 'uViewMatrix'),
      uProjectionMatrix: gl.getUniformLocation(this.discProgram, 'uProjectionMatrix'),
      uCameraPosition: gl.getUniformLocation(this.discProgram, 'uCameraPosition'),
      uScaleFactor: gl.getUniformLocation(this.discProgram, 'uScaleFactor'),
      uRotationAxisVelocity: gl.getUniformLocation(this.discProgram, 'uRotationAxisVelocity'),
      uTransitionMain: gl.getUniformLocation(this.discProgram, 'uTransitionMain'),
      uMainScale: gl.getUniformLocation(this.discProgram, 'uMainScale'),
      uOthersOpacity: gl.getUniformLocation(this.discProgram, 'uOthersOpacity'),
      uOpaqueMain: gl.getUniformLocation(this.discProgram, 'uOpaqueMain'),
      uActiveCard: gl.getUniformLocation(this.discProgram, 'uActiveCard'),
      uTex: gl.getUniformLocation(this.discProgram, 'uTex'),
      uFrames: gl.getUniformLocation(this.discProgram, 'uFrames'),
      uItemCount: gl.getUniformLocation(this.discProgram, 'uItemCount'),
      uAtlasSize: gl.getUniformLocation(this.discProgram, 'uAtlasSize'),
      uItemOffset: gl.getUniformLocation(this.discProgram, 'uItemOffset'),
      uSwapVertex: gl.getUniformLocation(this.discProgram, 'uSwapVertex'),
      uNextAtlasSize: gl.getUniformLocation(this.discProgram, 'uNextAtlasSize'),
      uNextTex: gl.getUniformLocation(this.discProgram, 'uNextTex')
    };

    const cardTexture = this.items[0]?.texture;
    this.discGeo = new CardGeometry(cardTexture ? cardTexture.width / cardTexture.height : 0.8);
    this.discBuffers = this.discGeo.data;
    this.discVAO = makeVertexArray(
      gl,
      [
        [makeBuffer(gl, this.discBuffers.vertices, gl.STATIC_DRAW), this.discLocations.aModelPosition, 3],
        [makeBuffer(gl, this.discBuffers.uvs, gl.STATIC_DRAW), this.discLocations.aModelUvs, 2]
      ],
      this.discBuffers.indices
    );

    this.icoGeo = new IcosahedronGeometry();
    this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
    // Every loaded article must have a real sphere position to navigate to.
    while (this.icoGeo.vertices.length < this.items.length) this.icoGeo.subdivide(1).spherize(this.SPHERE_RADIUS);
    this.instancePositions = this.icoGeo.vertices.map(v => v.position);
    this.DISC_INSTANCE_COUNT = this.icoGeo.vertices.length;
    this.#initDiscInstances(this.DISC_INSTANCE_COUNT);

    this.worldMatrix = mat4.create();
    this.#initTexture();
    this.#initCenterLabel();

    this.control = new ArcballControl(this.canvas, deltaTime => this.#onControlUpdate(deltaTime));

    this.#updateCameraMatrix();
    this.#updateProjectionMatrix(gl);
    this.resize();

    if (onInit) onInit(this);
  }

  #initTexture() {
    const gl = this.gl;
    this.tex = createAndSetupTexture(gl, gl.LINEAR_MIPMAP_LINEAR, gl.LINEAR, gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);

    const itemCount = Math.max(1, this.items.length);
    this.atlasSize = Math.ceil(Math.sqrt(itemCount));
    const firstTexture = this.items[0]?.texture;
    const cellWidth = firstTexture?.width || 768;
    const cellHeight = firstTexture?.height || 960;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = this.atlasSize * cellWidth;
    canvas.height = this.atlasSize * cellHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    this.items.forEach((item, i) => {
      const x = (i % this.atlasSize) * cellWidth;
      const y = Math.floor(i / this.atlasSize) * cellHeight;
      ctx.drawImage(item.texture, x, y, cellWidth, cellHeight);
    });

    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
  }

  #initCenterLabel() {
    if (!this.centerLabel) return;

    const gl = this.gl;
    this.centerLabelProgram = createProgram(
      gl,
      [centerLabelVertShaderSource, centerLabelFragShaderSource],
      null,
      {
        aModelPosition: 0,
        aModelUvs: 1
      }
    );

    if (!this.centerLabelProgram) {
      throw new Error('Center label shader initialization failed.');
    }

    this.centerLabelLocations = {
      aModelPosition: gl.getAttribLocation(this.centerLabelProgram, 'aModelPosition'),
      aModelUvs: gl.getAttribLocation(this.centerLabelProgram, 'aModelUvs'),
      uModelMatrix: gl.getUniformLocation(this.centerLabelProgram, 'uModelMatrix'),
      uViewMatrix: gl.getUniformLocation(this.centerLabelProgram, 'uViewMatrix'),
      uProjectionMatrix: gl.getUniformLocation(this.centerLabelProgram, 'uProjectionMatrix'),
      uTex: gl.getUniformLocation(this.centerLabelProgram, 'uTex'),
      uOpacity: gl.getUniformLocation(this.centerLabelProgram, 'uOpacity')
    };

    const textureCanvas = createCenterLabelTextureCanvas(this.centerLabel);
    const textureAspect = textureCanvas.width / textureCanvas.height;
    this.centerLabelGeo = new CardGeometry(textureAspect);
    this.centerLabelBuffers = this.centerLabelGeo.data;
    this.centerLabelVAO = makeVertexArray(
      gl,
      [
        [makeBuffer(gl, this.centerLabelBuffers.vertices, gl.STATIC_DRAW), this.centerLabelLocations.aModelPosition, 3],
        [makeBuffer(gl, this.centerLabelBuffers.uvs, gl.STATIC_DRAW), this.centerLabelLocations.aModelUvs, 2]
      ],
      this.centerLabelBuffers.indices
    );

    this.centerLabelTexture = createAndSetupTexture(
      gl,
      gl.LINEAR_MIPMAP_LINEAR,
      gl.LINEAR,
      gl.CLAMP_TO_EDGE,
      gl.CLAMP_TO_EDGE
    );
    gl.bindTexture(gl.TEXTURE_2D, this.centerLabelTexture);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureCanvas);
    gl.generateMipmap(gl.TEXTURE_2D);

    this.centerLabelModelMatrix = mat4.fromScaling(mat4.create(), [0.2, 0.2, 1]);
  }

  #initDiscInstances(count) {
    const gl = this.gl;
    this.discInstances = {
      matricesArray: new Float32Array(count * 16),
      matrices: [],
      buffer: gl.createBuffer()
    };
    for (let i = 0; i < count; ++i) {
      const instanceMatrixArray = new Float32Array(this.discInstances.matricesArray.buffer, i * 16 * 4, 16);
      instanceMatrixArray.set(mat4.create());
      this.discInstances.matrices.push(instanceMatrixArray);
    }
    gl.bindVertexArray(this.discVAO);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, this.discInstances.matricesArray.byteLength, gl.DYNAMIC_DRAW);
    const mat4AttribSlotCount = 4;
    const bytesPerMatrix = 16 * 4;
    for (let j = 0; j < mat4AttribSlotCount; ++j) {
      const loc = this.discLocations.aInstanceMatrix + j;
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, bytesPerMatrix, j * 4 * 4);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  #animate(deltaTime) {
    const gl = this.gl;
    const motion = getResultCardMotion(this.canvas);
    if (motion) {
      if (this.control.autoRotation) this.control.stopAutoRotation();
      if (this.transitionMainIndex === null) {
        this.transitionMainIndex = this.#findNearestVertexIndex();
        // A cold renderer enters at its normal snapped pose before any card is visible.
        if (motion.mainScale < 0.001) {
          const from = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(this.transitionMainIndex));
          const correction = quat.rotationTo(quat.create(), from, this.control.snapDirection);
          quat.multiply(this.control.orientation, correction, this.control.orientation);
        }
        this.onActiveItemChange((this.transitionMainIndex + this.itemOffset) % Math.max(1, this.items.length));
        this.onMovementChange(false);
        this.movementActive = false;
      }
    } else {
      this.transitionMainIndex = null;
      this.control.update(deltaTime, this.TARGET_FRAME_DURATION,
        this.presentationPress === null ? null : this.presentationPress > 0);
    }

    if (this.resultReplacement && !this.control.autoRotation) this.finishResultReplacement();

    let positions = this.instancePositions.map(p => vec3.transformQuat(vec3.create(), p, this.control.orientation));
    const scale = 0.25;
    const SCALE_INTENSITY = 0.6;
    positions.forEach((p, ndx) => {
      const s = (Math.abs(p[2]) / this.SPHERE_RADIUS) * SCALE_INTENSITY + (1 - SCALE_INTENSITY);
      const finalScale = s * scale;
      const matrix = mat4.create();
      mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), vec3.negate(vec3.create(), p)));
      mat4.multiply(matrix, matrix, mat4.targetTo(mat4.create(), [0, 0, 0], p, [0, 1, 0]));
      mat4.multiply(matrix, matrix, mat4.fromScaling(mat4.create(), [finalScale, finalScale, finalScale]));
      mat4.multiply(matrix, matrix, mat4.fromTranslation(mat4.create(), [0, 0, -this.SPHERE_RADIUS]));

      mat4.copy(this.discInstances.matrices[ndx], matrix);
    });

    // Keep DOM copy outside the actual projected card, including after resize.
    const activeMatrix = this.discInstances.matrices[this.#findNearestVertexIndex()];
    if (activeMatrix) {
      const radius = Math.hypot(activeMatrix[12], activeMatrix[13], activeMatrix[14]);
      let halfWidth = 0;
      for (const x of [-0.8, 0.8]) {
        for (const y of [-1, 0, 1]) {
          const point = vec3.transformMat4(vec3.create(), [x, y, 0], activeMatrix);
          vec3.normalize(point, point);
          vec3.scale(point, point, radius);
          vec3.transformMat4(point, point, this.camera.matrices.view);
          vec3.transformMat4(point, point, this.camera.matrices.projection);
          halfWidth = Math.max(halfWidth, Math.abs(point[0]) * gl.canvas.clientWidth / 2);
        }
      }
      const edge = `${Math.ceil(halfWidth)}px`;
      if (gl.canvas.parentElement?.style.getPropertyValue('--infinite-menu-copy-edge') !== edge) {
        gl.canvas.parentElement?.style.setProperty('--infinite-menu-copy-edge', edge);
      }
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.discInstances.buffer);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.discInstances.matricesArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.smoothRotationVelocity = motion || this.presentationPress !== null ? 0 : this.control.rotationVelocity;
  }

  #render() {
    const gl = this.gl;
    gl.useProgram(this.discProgram);

    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    gl.uniformMatrix4fv(this.discLocations.uWorldMatrix, false, this.worldMatrix);
    gl.uniformMatrix4fv(this.discLocations.uViewMatrix, false, this.camera.matrices.view);
    gl.uniformMatrix4fv(this.discLocations.uProjectionMatrix, false, this.camera.matrices.projection);
    gl.uniform3f(
      this.discLocations.uCameraPosition,
      this.camera.position[0],
      this.camera.position[1],
      this.camera.position[2]
    );
    gl.uniform4f(
      this.discLocations.uRotationAxisVelocity,
      this.control.rotationAxis[0],
      this.control.rotationAxis[1],
      this.control.rotationAxis[2],
      this.smoothRotationVelocity * 1.1
    );

    gl.uniform1i(this.discLocations.uItemCount, this.items.length);
    gl.uniform1i(this.discLocations.uAtlasSize, this.atlasSize);
    gl.uniform1i(this.discLocations.uItemOffset, this.itemOffset);
    gl.uniform1i(this.discLocations.uSwapVertex, this.resultReplacement?.targetVertex ?? -1);
    gl.uniform1i(this.discLocations.uNextAtlasSize, this.resultReplacement?.atlasSize ?? this.atlasSize);
    gl.uniform1i(this.discLocations.uNextTex, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.resultReplacement?.tex ?? this.tex);
    const motion = getResultCardMotion(this.canvas);
    gl.uniform1i(this.discLocations.uTransitionMain, this.transitionMainIndex ?? -1);
    gl.uniform1f(this.discLocations.uMainScale, motion?.mainScale ?? 1);
    gl.uniform1f(this.discLocations.uOthersOpacity, motion?.othersOpacity ?? 1);
    gl.uniform1i(this.discLocations.uOpaqueMain, this.opaqueMain ? 1 : 0);
    gl.uniform1i(this.discLocations.uActiveCard, this.opaqueMain ? (this.transitionMainIndex ?? this.#findNearestVertexIndex()) : -1);

    gl.uniform1f(this.discLocations.uFrames, this.#frames);
    gl.uniform1f(this.discLocations.uScaleFactor, this.scaleFactor);
    gl.uniform1i(this.discLocations.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    gl.bindVertexArray(this.discVAO);
    gl.drawElementsInstanced(
      gl.TRIANGLES,
      this.discBuffers.indices.length,
      gl.UNSIGNED_SHORT,
      0,
      this.DISC_INSTANCE_COUNT
    );

    this.#renderCenterLabel();
    markResultCardMotionRendered(this.canvas, motion);
    if (import.meta.env.DEV) {
      this.canvas.dataset.cameraZ = this.camera.position[2].toFixed(6);
      this.canvas.dataset.pointerHeld = String(this.control.isPointerDown);
    }
    if (this.presentationPress !== null) {
      delete this.canvas.dataset.viewPressPending;
      if (import.meta.env.DEV) this.canvas.dataset.renderedViewPress = String(this.presentationPress);
    }
  }

  #renderCenterLabel() {
    if (!this.centerLabelProgram || !this.centerLabelTexture || !this.centerLabelVAO) return;

    const gl = this.gl;
    const opacity = (this.movementActive ? 0.48 : 0.66) * (getResultCardMotion(this.canvas)?.othersOpacity ?? 1);

    gl.useProgram(this.centerLabelProgram);
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(false);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    gl.uniformMatrix4fv(this.centerLabelLocations.uModelMatrix, false, this.centerLabelModelMatrix);
    gl.uniformMatrix4fv(this.centerLabelLocations.uViewMatrix, false, this.camera.matrices.view);
    gl.uniformMatrix4fv(this.centerLabelLocations.uProjectionMatrix, false, this.camera.matrices.projection);
    gl.uniform1f(this.centerLabelLocations.uOpacity, opacity);
    gl.uniform1i(this.centerLabelLocations.uTex, 0);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.centerLabelTexture);
    gl.bindVertexArray(this.centerLabelVAO);
    gl.drawElements(gl.TRIANGLES, this.centerLabelBuffers.indices.length, gl.UNSIGNED_SHORT, 0);

    gl.disable(gl.BLEND);
    gl.enable(gl.CULL_FACE);
    gl.depthMask(true);
  }

  #updateCameraMatrix() {
    mat4.targetTo(this.camera.matrix, this.camera.position, [0, 0, 0], this.camera.up);
    mat4.invert(this.camera.matrices.view, this.camera.matrix);
  }

  #updateProjectionMatrix(gl) {
    this.camera.aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
    const height = this.SPHERE_RADIUS * 0.35;
    const distance = 3 * this.scaleFactor;
    if (this.camera.aspect > 1) {
      this.camera.fov = 2 * Math.atan(height / distance);
    } else {
      this.camera.fov = 2 * Math.atan(height / this.camera.aspect / distance);
    }
    mat4.perspective(
      this.camera.matrices.projection,
      this.camera.fov,
      this.camera.aspect,
      this.camera.near,
      this.camera.far
    );
    mat4.invert(this.camera.matrices.inversProjection, this.camera.matrices.projection);
  }

  #onControlUpdate(deltaTime) {
    const controlled = this.presentationPress !== null;
    const pressed = controlled ? this.presentationPress > 0 : this.control.isPointerDown;
    const flight = this.control.autoRotation;
    const isMoving = pressed || Boolean(flight) || (!controlled && Math.abs(this.smoothRotationVelocity) > 0.01);

    if (isMoving !== this.movementActive) {
      this.movementActive = isMoving;
      this.onMovementChange(isMoving);
    }

    if (!pressed && !flight) {
      const nearestVertexIndex = this.#findNearestVertexIndex();
      const itemIndex = (nearestVertexIndex + this.itemOffset) % Math.max(1, this.items.length);
      if (!this.resultReplacement) this.onActiveItemChange(itemIndex);
      const snapDirection = vec3.normalize(vec3.create(), this.#getVertexWorldPosition(nearestVertexIndex));
      this.control.snapTargetDirection = snapDirection;
    }
    const flightHeld = flight && flight.duration > 0 && flight.elapsed / flight.duration < 0.55;
    this.camera.position[2] = stepPressCamera(this.camera.position[2], 3 * this.scaleFactor, pressed || Boolean(flightHeld),
      this.control.rotationVelocity, deltaTime, this.TARGET_FRAME_DURATION);
    this.#updateCameraMatrix();
  }

  #findNearestVertexIndex() {
    const n = this.control.snapDirection;
    const inversOrientation = quat.conjugate(quat.create(), this.control.orientation);
    const nt = vec3.transformQuat(vec3.create(), n, inversOrientation);

    let maxD = -1;
    let nearestVertexIndex;
    for (let i = 0; i < this.instancePositions.length; ++i) {
      const d = vec3.dot(nt, this.instancePositions[i]);
      if (d > maxD) {
        maxD = d;
        nearestVertexIndex = i;
      }
    }
    return nearestVertexIndex;
  }

  #getVertexWorldPosition(index) {
    const nearestVertexPos = this.instancePositions[index];
    return vec3.transformQuat(vec3.create(), nearestVertexPos, this.control.orientation);
  }
}


export { InfiniteGridMenu };
