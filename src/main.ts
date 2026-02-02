/*
 * Watchdog Face Tracking — MediaPipe Face Virtual Avatar
 * Based on MediaPipe demo; uses Three.js + Face Landmarker for real-time avatar.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  FilesetResolver,
  FaceLandmarker,
  type FaceLandmarkerResult,
} from '@mediapipe/tasks-vision';

// Use watchdog_head.glb from public/ when you have it; else raccoon demo model
const AVATAR_MODEL_URL = './watchdog_head.glb';
const AVATAR_FALLBACK_URL = 'https://assets.codepen.io/9177687/raccoon_head.glb';

// Debug log buffer for Logs UI
const logLines: string[] = [];
function logMsg(msg: string): void {
  const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
  logLines.push(line);
  console.log(msg);
  const pre = document.getElementById('logs-content');
  if (pre) {
    pre.textContent = logLines.join('\n');
    pre.scrollTop = pre.scrollHeight;
  }
}

function setupLogsUI(): void {
  const gearBtn = document.getElementById('gear-btn');
  const settingsPanel = document.getElementById('settings-panel');
  const settingsClose = document.getElementById('settings-close');
  const logsOption = document.getElementById('logs-option');
  const logsDropdown = document.getElementById('logs-dropdown');
  const logsContent = document.getElementById('logs-content');
  const logsCopyBtn = document.getElementById('logs-copy');
  const logsCopiedMsg = document.getElementById('logs-copied-msg');

  if (!gearBtn || !settingsPanel || !logsOption || !logsDropdown || !logsContent) return;

  function copyLogs(): void {
    try {
      navigator.clipboard.writeText(logLines.join('\n'));
      if (logsCopiedMsg) {
        logsCopiedMsg.removeAttribute('hidden');
        setTimeout(() => logsCopiedMsg.setAttribute('hidden', ''), 1500);
      }
    } catch {
      logMsg('(Copy failed)');
    }
  }

  gearBtn.addEventListener('click', () => {
    const hidden = settingsPanel.hasAttribute('hidden');
    if (hidden) {
      settingsPanel.removeAttribute('hidden');
    } else {
      settingsPanel.setAttribute('hidden', '');
    }
  });

  settingsClose?.addEventListener('click', () => settingsPanel.setAttribute('hidden', ''));

  logsOption.addEventListener('click', () => {
    const dropHidden = logsDropdown.hasAttribute('hidden');
    if (dropHidden) {
      logsDropdown.removeAttribute('hidden');
      logsContent.textContent = logLines.join('\n');
      logsContent.scrollTop = logsContent.scrollHeight;
      copyLogs();
    } else {
      logsDropdown.setAttribute('hidden', '');
    }
  });

  logsCopyBtn?.addEventListener('click', () => {
    copyLogs();
  });
}

function getViewportSizeAtDepth(
  camera: THREE.PerspectiveCamera,
  depth: number
): THREE.Vector2 {
  const viewportHeightAtDepth =
    2 * depth * Math.tan(THREE.MathUtils.degToRad(0.5 * camera.fov));
  const viewportWidthAtDepth = viewportHeightAtDepth * camera.aspect;
  return new THREE.Vector2(viewportWidthAtDepth, viewportHeightAtDepth);
}

function createCameraPlaneMesh(
  camera: THREE.PerspectiveCamera,
  depth: number,
  material: THREE.Material
): THREE.Mesh {
  if (camera.near > depth || depth > camera.far) {
    console.warn('Camera plane geometry will be clipped by the camera!');
  }
  const viewportSize = getViewportSizeAtDepth(camera, depth);
  const cameraPlaneGeometry = new THREE.PlaneGeometry(
    viewportSize.width,
    viewportSize.height
  );
  cameraPlaneGeometry.translate(0, 0, -depth);
  return new THREE.Mesh(cameraPlaneGeometry, material);
}

type RenderCallback = (delta: number) => void;

class BasicScene {
  scene: THREE.Scene;
  width: number;
  height: number;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  lastTime = 0;
  callbacks: RenderCallback[] = [];

  constructor() {
    this.height = window.innerHeight;
    this.width = (this.height * 1280) / 720;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      60,
      this.width / this.height,
      0.01,
      5000
    );

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.setSize(this.width, this.height);
    if ('outputColorSpace' in this.renderer) {
      (this.renderer as THREE.WebGLRenderer & { outputColorSpace: string }).outputColorSpace = 'srgb';
    } else if ('outputEncoding' in this.renderer) {
      (this.renderer as THREE.WebGLRenderer & { outputEncoding: number }).outputEncoding = 3001; // sRGB
    }
    const container = document.querySelector('.container');
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild);
    } else {
      document.body.appendChild(this.renderer.domElement);
    }

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
    directionalLight.position.set(0, 1, 0);
    this.scene.add(directionalLight);

    this.camera.position.z = 0;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    const orbitTarget = this.camera.position.clone();
    orbitTarget.z -= 5;
    this.controls.target = orbitTarget;
    this.controls.update();

    const video = document.getElementById('video') as HTMLVideoElement;
    const inputFrameTexture = new THREE.VideoTexture(video);
    if ('colorSpace' in inputFrameTexture) {
      (inputFrameTexture as THREE.VideoTexture & { colorSpace: string }).colorSpace = 'srgb';
    } else if ('encoding' in inputFrameTexture) {
      (inputFrameTexture as THREE.VideoTexture & { encoding: number }).encoding = 3001;
    }
    const inputFramesDepth = 500;
    const inputFramesPlane = createCameraPlaneMesh(
      this.camera,
      inputFramesDepth,
      new THREE.MeshBasicMaterial({ map: inputFrameTexture })
    );
    this.scene.add(inputFramesPlane);

    this.render();
    window.addEventListener('resize', this.resize.bind(this));
  }

  resize(): void {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.render(this.scene, this.camera);
  }

  render(time = this.lastTime): void {
    const delta = (time - this.lastTime) / 1000;
    this.lastTime = time;
    for (const callback of this.callbacks) {
      callback(delta);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.render(t));
  }
}

interface MatrixRetargetOptions {
  decompose?: boolean;
  scale?: number;
}

class Avatar {
  scene: THREE.Scene;
  loader = new GLTFLoader();
  gltf!: GLTF;
  root!: THREE.Bone;
  morphTargetMeshes: THREE.Mesh[] = [];
  url: string;

  constructor(url: string, scene: THREE.Scene) {
    this.url = url;
    this.scene = scene;
    this.loadModel(this.url);
  }

  loadModel(url: string): void {
    this.url = url;
    this.loader.load(
      url,
      (gltf) => {
        if (this.gltf) {
          this.gltf.scene.remove();
          this.morphTargetMeshes = [];
        }
        this.gltf = gltf;
        this.scene.add(gltf.scene);
        this.init(gltf);
        logMsg(`Avatar loaded: ${url}`);
      },
      (progress) => {
        const pct = progress.total ? (100 * progress.loaded) / progress.total : 0;
        if (pct >= 99 || Math.floor(pct) % 25 === 0) {
          logMsg(`Model loading ${pct.toFixed(0)}%`);
        }
      },
      (err) => {
        if (this.url !== AVATAR_FALLBACK_URL) {
          logMsg(`Watchdog model not found, trying raccoon.`);
          this.loadModel(AVATAR_FALLBACK_URL);
        } else {
          logMsg(`Avatar load failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    );
  }

  init(gltf: GLTF): void {
    gltf.scene.traverse((object) => {
      const obj = object as THREE.Object3D & { isBone?: boolean; isMesh?: boolean };
      if (obj.isBone && !(this as { root?: THREE.Bone }).root) {
        this.root = object as THREE.Bone;
      }
      if (!(obj as THREE.Mesh).isMesh) return;
      const mesh = object as THREE.Mesh;
      mesh.frustumCulled = false;
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      this.morphTargetMeshes.push(mesh);
    });
  }

  updateBlendshapes(blendshapes: Map<string, number>): void {
    for (const mesh of this.morphTargetMeshes) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      for (const [name, value] of blendshapes) {
        if (!(name in mesh.morphTargetDictionary)) continue;
        const idx = mesh.morphTargetDictionary[name];
        mesh.morphTargetInfluences[idx] = value;
      }
    }
  }

  applyMatrix(
    matrix: THREE.Matrix4,
    opts?: MatrixRetargetOptions
  ): void {
    const { scale = 1 } = opts ?? {};
    if (!this.gltf) return;
    matrix.scale(new THREE.Vector3(scale, scale, scale));
    this.gltf.scene.matrixAutoUpdate = false;
    this.gltf.scene.matrix.copy(matrix);
  }

  offsetRoot(offset: THREE.Vector3, rotation?: THREE.Vector3): void {
    if (!this.root) return;
    this.root.position.copy(offset);
    if (rotation) {
      const q = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(rotation.x, rotation.y, rotation.z)
      );
      this.root.quaternion.copy(q);
    }
  }
}

let faceLandmarker: FaceLandmarker | null = null;
let video: HTMLVideoElement;

const scene = new BasicScene();
const avatar = new Avatar(AVATAR_MODEL_URL, scene.scene);

function setStatus(text: string, hide = false): void {
  logMsg(text);
  const el = document.getElementById('status');
  if (!el) return;
  el.textContent = text;
  el.classList.toggle('hidden', hide);
}

function detectFaceLandmarks(time: DOMHighResTimeStamp): void {
  if (!faceLandmarker || !video) return;
  const results = faceLandmarker.detectForVideo(video, time);
  const transformationMatrices = (results as FaceLandmarkerResult & {
    facialTransformationMatrixes?: { data: Float32Array }[];
  }).facialTransformationMatrixes;
  if (transformationMatrices?.length) {
    const matrix = new THREE.Matrix4().fromArray(transformationMatrices[0].data);
    avatar.applyMatrix(matrix, { scale: 40 });
  }
  const faceBlendshapes = (results as FaceLandmarkerResult & {
    faceBlendshapes?: { categories: { categoryName: string; score: number }[] }[];
  }).faceBlendshapes;
  if (faceBlendshapes?.length) {
    const coefsMap = retarget(faceBlendshapes[0].categories);
    coefsMap.set('tongueOut', 0);
    avatar.updateBlendshapes(coefsMap);
  }
}

function retarget(
  categories: { categoryName: string; score: number }[]
): Map<string, number> {
  const coefsMap = new Map<string, number>();
  for (const c of categories) {
    let score = c.score;
    switch (c.categoryName) {
      case 'browOuterUpLeft':
      case 'browOuterUpRight':
      case 'eyeBlinkLeft':
      case 'eyeBlinkRight':
        score *= 1.2;
        break;
    }
    coefsMap.set(c.categoryName, score);
  }
  return coefsMap;
}

function onVideoFrame(time: DOMHighResTimeStamp): void {
  detectFaceLandmarks(time);
  video.requestVideoFrameCallback(onVideoFrame);
}

async function streamWebcam(): Promise<void> {
  video = document.getElementById('video') as HTMLVideoElement;
  if (!video) {
    setStatus('Error: no video element');
    return;
  }
  setStatus('Requesting camera… Allow when your browser prompts.');
  logMsg('Calling getUserMedia…');
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    logMsg('Camera allowed, starting video.');
    video.srcObject = stream;
    await video.play();
    video.requestVideoFrameCallback(onVideoFrame);
    setStatus('Face tracking active', true);
  } catch (e) {
    const errMsg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    logMsg(`Camera error: ${errMsg}`);
    setStatus(`Camera error: ${errMsg}. Tap Logs to copy details.`);
  }
}

async function runDemo(): Promise<void> {
  setupLogsUI();
  logMsg(`App started. Secure: ${window.isSecureContext}. UA: ${navigator.userAgent.slice(0, 60)}…`);
  setStatus('Requesting camera…');
  await streamWebcam();
  setStatus('Loading MediaPipe…');
  logMsg('Loading MediaPipe WASM…');
  try {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
    );
    logMsg('Loading face_landmarker.task…');
    faceLandmarker = await FaceLandmarker.createFromModelPath(
      vision,
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task'
    );
    await faceLandmarker.setOptions({
      baseOptions: { delegate: 'GPU' },
      runningMode: 'VIDEO',
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    logMsg('MediaPipe ready.');
    setStatus('Ready — move your face', true);
  } catch (e) {
    const errMsg = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    logMsg(`MediaPipe error: ${errMsg}`);
    setStatus(`MediaPipe error. Tap Logs to copy.`);
  }
}

runDemo();
