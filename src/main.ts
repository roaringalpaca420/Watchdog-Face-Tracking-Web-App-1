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
      },
      (progress) => {
        const pct = progress.total ? (100 * progress.loaded) / progress.total : 0;
        console.log('Loading model...', pct.toFixed(0), '%');
      },
      (err) => {
        if (this.url !== AVATAR_FALLBACK_URL) {
          console.warn('Watchdog model not found, using raccoon demo.');
          this.loadModel(AVATAR_FALLBACK_URL);
        } else {
          console.error('Avatar load failed:', err);
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
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    });
    video.srcObject = stream;
    await video.play();
    video.requestVideoFrameCallback(onVideoFrame);
    setStatus('Face tracking active', true);
  } catch (e) {
    console.error('Camera error:', e);
    setStatus('Camera access denied. Use HTTPS and allow camera.');
  }
}

async function runDemo(): Promise<void> {
  setStatus('Loading…');
  await streamWebcam();
  setStatus('Loading MediaPipe…');
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm'
  );
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
  setStatus('Ready — move your face', true);
  console.log('MediaPipe Face Landmarker ready.');
}

runDemo();
