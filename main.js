/* Watchdog Face Tracking — MediaPipe + Three.js */

import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  FilesetResolver,
  FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.1.0-alpha-16";

// Debug log buffer
const logLines = [];
function logMsg(msg) {
  const line = `[${new Date().toISOString().slice(11, 23)}] ${msg}`;
  logLines.push(line);
  console.log(msg);
  const pre = document.getElementById("logs-content");
  if (pre) {
    pre.textContent = logLines.join("\n");
    pre.scrollTop = pre.scrollHeight;
  }
}

function setStatus(text, hide = false) {
  logMsg(text);
  const el = document.getElementById("status");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("hidden", hide);
}

// Avatar model URLs — resolve from current page so it works on GitHub Pages
function getAvatarModelUrl() {
  try {
    return new URL("watchdog_head.glb", window.location.href).href;
  } catch (_) {
    return "watchdog_head.glb";
  }
}
// If watchdog model loads, we can optionally apply Watchdog Image.png so it looks like your dog (same as other project).
const WATCHDOG_TEXTURE_URL = "Watchdog Model/Watchdog Image.png";

function getViewportSizeAtDepth(camera, depth) {
  const viewportHeightAtDepth =
    2 * depth * Math.tan(THREE.MathUtils.degToRad(0.5 * camera.fov));
  const viewportWidthAtDepth = viewportHeightAtDepth * camera.aspect;
  return new THREE.Vector2(viewportWidthAtDepth, viewportHeightAtDepth);
}

function createCameraPlaneMesh(camera, depth, material) {
  if (camera.near > depth || depth > camera.far) {
    console.warn("Camera plane geometry will be clipped by the camera!");
  }
  const viewportSize = getViewportSizeAtDepth(camera, depth);
  const cameraPlaneGeometry = new THREE.PlaneGeometry(
    viewportSize.width,
    viewportSize.height
  );
  cameraPlaneGeometry.translate(0, 0, -depth);
  return new THREE.Mesh(cameraPlaneGeometry, material);
}

class BasicScene {
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
    this.renderer.setClearColor(0x000000, 1);
    THREE.ColorManagement.legacy = false;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    const container = document.querySelector(".container");
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild);
    } else {
      document.body.appendChild(this.renderer.domElement);
    }

    this.scene.background = new THREE.Color(0x000000);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(0, 1, 0);
    this.scene.add(directionalLight);

    this.camera.position.z = 0;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    const orbitTarget = this.camera.position.clone();
    orbitTarget.z -= 5;
    this.controls.target = orbitTarget;
    this.controls.update();

    // No video background — floating head on black only

    this.lastTime = performance.now();
    this.callbacks = [];
    this.render();
    window.addEventListener("resize", this.resize.bind(this));
  }

  resize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.render(this.scene, this.camera);
  }

  render(time = this.lastTime) {
    const delta = (time - this.lastTime) / 1000;
    this.lastTime = time;
    for (const callback of this.callbacks) {
      callback(delta);
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.render(t));
  }
}

class Avatar {
  constructor(url, scene, options = {}) {
    this.url = url;
    this.scene = scene;
    this.textureUrl = options.textureUrl || null;
    this.loader = new GLTFLoader();
    this.gltf = null;
    this.root = null;
    this.placeholderMesh = null;
    this.morphTargetMeshes = [];
    this.loadModel(this.url);
  }

  loadModel(url) {
    this.url = url;
    logMsg(`Loading avatar from: ${url}`);
    this.loader.load(
      url,
      (gltf) => {
        if (this.gltf) {
          this.gltf.scene.remove();
          this.morphTargetMeshes = [];
        }
        this.gltf = gltf;
        if (this.textureUrl) {
          const texLoader = new THREE.TextureLoader();
          const texUrl = this.textureUrl.startsWith("http") ? this.textureUrl : new URL(this.textureUrl, window.location.href).href;
          texLoader.load(
            texUrl,
            (texture) => {
              texture.encoding = THREE.sRGBEncoding;
              this.gltf.scene.traverse((object) => {
                if (object.isMesh && object.material) {
                  const materials = Array.isArray(object.material) ? object.material : [object.material];
                  const newMats = materials.map(
                    () =>
                      new THREE.MeshBasicMaterial({
                        map: texture,
                        morphTargets: true,
                        side: THREE.FrontSide,
                      })
                  );
                  object.material = newMats.length === 1 ? newMats[0] : newMats;
                }
              });
              this.scene.add(this.gltf.scene);
              this.init(this.gltf);
              logMsg(`Avatar loaded with watchdog texture: ${url}`);
            },
            undefined,
            (e) => {
              logMsg("Texture load failed, using model default: " + (e.message || e));
              this.scene.add(this.gltf.scene);
              this.init(this.gltf);
              logMsg(`Avatar loaded: ${url}`);
            }
          );
        } else {
          this.scene.add(gltf.scene);
          this.init(gltf);
          logMsg(`Avatar loaded: ${url}`);
        }
      },
      (progress) => {
        const pct = progress.total
          ? ((100 * progress.loaded) / progress.total).toFixed(0)
          : "...";
        if (pct === "100" || pct === "...") logMsg(`Model loading ${pct}%`);
      },
      (error) => {
        logMsg(`Watchdog load failed: ${error}. Showing ? placeholder.`);
        this.showQuestionMarkPlaceholder();
      }
    );
  }

  showQuestionMarkPlaceholder() {
    const canvas = document.createElement("canvas");
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 180px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", size / 2, size / 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: true,
    });
    const geometry = new THREE.PlaneGeometry(1, 1);
    this.placeholderMesh = new THREE.Mesh(geometry, material);
    this.placeholderMesh.frustumCulled = false;
    this.scene.add(this.placeholderMesh);
  }

  init(gltf) {
    gltf.scene.traverse((object) => {
      if (object.isBone && !this.root) {
        this.root = object;
      }
      if (!object.isMesh) return;
      const mesh = object;
      mesh.frustumCulled = false;
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) return;
      this.morphTargetMeshes.push(mesh);
    });
  }

  updateBlendshapes(blendshapes) {
    if (this.placeholderMesh) return;
    for (const mesh of this.morphTargetMeshes) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      for (const [name, value] of blendshapes) {
        if (!Object.keys(mesh.morphTargetDictionary).includes(name)) continue;
        const idx = mesh.morphTargetDictionary[name];
        mesh.morphTargetInfluences[idx] = value;
      }
    }
  }

  applyMatrix(matrix, options = {}) {
    const { scale = 1 } = options;
    const m = matrix.clone().scale(new THREE.Vector3(scale, scale, scale));
    if (this.placeholderMesh) {
      this.placeholderMesh.matrixAutoUpdate = false;
      this.placeholderMesh.matrix.copy(m);
      return;
    }
    if (!this.gltf) return;
    this.gltf.scene.matrixAutoUpdate = false;
    this.gltf.scene.matrix.copy(m);
  }

  offsetRoot(offset, rotation) {
    if (this.root) {
      this.root.position.copy(offset);
      if (rotation) {
        const offsetQuat = new THREE.Quaternion().setFromEuler(
          new THREE.Euler(rotation.x, rotation.y, rotation.z)
        );
        this.root.quaternion.copy(offsetQuat);
      }
    }
  }
}

let faceLandmarker = null;
let video = null;
let scene = null;
let avatar = null;

function detectFaceLandmarks(time) {
  if (!faceLandmarker || !video) return;
  const landmarks = faceLandmarker.detectForVideo(video, time);

  const transformationMatrices = landmarks.facialTransformationMatrixes;
  if (transformationMatrices && transformationMatrices.length > 0) {
    const matrix = new THREE.Matrix4().fromArray(transformationMatrices[0].data);
    if (avatar) {
      avatar.applyMatrix(matrix, { scale: 40 });
      const blendshapes = landmarks.faceBlendshapes;
      if (blendshapes && blendshapes.length > 0) {
        avatar.updateBlendshapes(retarget(blendshapes));
      }
    }
  }
}

// Blendshape gain for responsiveness
const BLENDSHAPE_GAIN = {
  mouth: 2.2,
  jaw: 2.2,
  tongue: 2.5,
  eye: 1.2,
  brow: 1.2,
  default: 1,
};

function retarget(blendshapes) {
  const categories = blendshapes[0].categories;
  const coefsMap = new Map();
  for (let i = 0; i < categories.length; ++i) {
    const blendshape = categories[i];
    const name = blendshape.categoryName;
    let gain = BLENDSHAPE_GAIN.default;
    if (name.includes("mouth") || name.includes("Mouth")) gain = BLENDSHAPE_GAIN.mouth;
    else if (name.includes("jaw") || name.includes("Jaw")) gain = BLENDSHAPE_GAIN.jaw;
    else if (name.includes("tongue") || name.includes("Tongue")) gain = BLENDSHAPE_GAIN.tongue;
    else if (name.includes("eye") || name.includes("Eye")) gain = BLENDSHAPE_GAIN.eye;
    else if (name.includes("brow") || name.includes("Brow")) gain = BLENDSHAPE_GAIN.brow;
    const score = Math.min(1, blendshape.score * gain);
    coefsMap.set(name, score);
  }
  return coefsMap;
}

function onVideoFrame(time) {
  detectFaceLandmarks(time);
  if (video && typeof video.requestVideoFrameCallback === "function") {
    video.requestVideoFrameCallback(onVideoFrame);
  }
}

async function streamWebcam() {
  video = document.getElementById("video");
  if (!video) {
    setStatus("Error: no video element");
    return Promise.reject(new Error("No video element"));
  }

  setStatus("Requesting camera… Allow when prompted.");
  logMsg("Calling getUserMedia…");

  return new Promise((resolve, reject) => {
    function onAcquiredUserMedia(stream) {
      video.srcObject = stream;
      video.onloadedmetadata = () => {
        video
          .play()
          .then(() => {
            logMsg("Camera started.");
            if (typeof video.requestVideoFrameCallback === "function") {
              video.requestVideoFrameCallback(onVideoFrame);
            } else {
              // Safari / iOS fallback: use requestAnimationFrame
              logMsg("Using requestAnimationFrame fallback (Safari/iOS).");
              function rafLoop() {
                if (video.readyState >= 2) detectFaceLandmarks(performance.now());
                requestAnimationFrame(rafLoop);
              }
              requestAnimationFrame(rafLoop);
            }
            resolve();
          })
          .catch(reject);
      };
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then(onAcquiredUserMedia)
      .catch((e) => {
        const errMsg = e.message || String(e);
        logMsg(`Camera error: ${errMsg}`);
        setStatus(`Camera error: ${errMsg}. Tap gear → Logs to copy.`);
        reject(e);
      });
  });
}

async function runDemo() {
  logMsg(`App started. Secure: ${window.isSecureContext}. UA: ${navigator.userAgent.slice(0, 60)}…`);
  setStatus("Loading…");

  try {
    await streamWebcam();
  } catch (e) {
    // Camera error already shown
    return;
  }

  setStatus("Starting 3D view…");
  try {
    scene = new BasicScene();
    avatar = new Avatar(getAvatarModelUrl(), scene.scene, { textureUrl: WATCHDOG_TEXTURE_URL });
    logMsg("Scene created.");
  } catch (e) {
    logMsg(`Scene error: ${e.message || e}`);
    setStatus(`Scene error. Tap gear → Logs to copy.`);
    return;
  }

  setStatus("Loading face model… (may take a moment)");
  logMsg("Loading MediaPipe WASM…");

  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.1.0-alpha-16/wasm"
    );

    const modelPath =
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

    // Try GPU first, fall back to CPU
    for (const delegate of ["GPU", "CPU"]) {
      try {
        logMsg(`Trying FaceLandmarker with ${delegate}…`);
        faceLandmarker = await FaceLandmarker.createFromModelPath(vision, modelPath);
        await faceLandmarker.setOptions({
          baseOptions: { delegate },
          runningMode: "VIDEO",
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true,
        });
        logMsg(`FaceLandmarker ready (${delegate}).`);
        break;
      } catch (e) {
        if (delegate === "CPU") throw e;
        logMsg(`GPU failed, trying CPU: ${e.message || e}`);
      }
    }

    setStatus("Ready — move your face", true);
  } catch (e) {
    const errMsg = e.message || String(e);
    logMsg(`MediaPipe error: ${errMsg}`);
    setStatus(`MediaPipe error. Tap gear → Logs to copy.`);
  }
}

runDemo().catch((e) => {
  const msg = e.message || String(e);
  logMsg(`runDemo failed: ${msg}`);
  setStatus(`Error. Tap gear → Logs to copy.`);
});
