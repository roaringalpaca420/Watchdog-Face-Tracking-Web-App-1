/**
 * Watchdog Face Tracking — MediaPipe + Three.js
 *
 * Flow: camera → MediaPipe Face Landmarker → face matrix + blendshapes → 3D avatar.
 * Avatar loads from Watchdog Model/watchdog_head.glb + Watchdog Image.png.
 * If GLB fails, a ? placeholder tracks your head.
 */

import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  FilesetResolver,
  FaceLandmarker,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.1.0-alpha-16";

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

const logLines = [];
function logMsg(msg) {
  const now = new Date();
  const tsUtc = now.toISOString(); // e.g. 2026-02-02T07:27:18.449Z
  const tsLocal = now.toLocaleString("en-US", {
    timeZone: "America/Los_Angeles", // San Diego (Pacific Time)
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }); // e.g. 02/01/2026, 11:27:18 PM
  const line = `[UTC ${tsUtc} | PT ${tsLocal}] ${msg}`;
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

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// How big / how far the head sits in front of the camera.
// We keep these modest and let face tracking tweak scale slightly.
const AVATAR_SCALE = 1.0;
const AVATAR_DEPTH = -2.5;

function getAvatarModelUrl() {
  try {
    return new URL("Watchdog Model/watchdog_head.glb", window.location.href).href;
  } catch (_) {
    return "Watchdog Model/watchdog_head.glb";
  }
}

const WATCHDOG_TEXTURE_URL = "Watchdog Model/Watchdog Image.png";

// ---------------------------------------------------------------------------
// Scene
// ---------------------------------------------------------------------------

class BasicScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = null; // no solid color background

    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2000);
    this.camera.position.set(0, 0, 0);
    this.camera.lookAt(0, 0, AVATAR_DEPTH);

    // Transparent canvas so we’re not painting a black rectangle
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    THREE.ColorManagement.legacy = false;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    const container = document.querySelector(".container");
    this.resize();
    if (container) {
      container.insertBefore(this.renderer.domElement, container.firstChild);
    } else {
      document.body.appendChild(this.renderer.domElement);
    }

    // Log initial render surface info (no device IDs etc., just generic sizes).
    const w = window.innerWidth;
    const h = window.innerHeight;
    logMsg(`Initial canvas size: ${w}x${h}, dpr=${window.devicePixelRatio || 1}`);

    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(0, 1, 0);
    this.scene.add(dir);

    this.lastTime = performance.now();
    window.addEventListener("resize", () => this.resize());
    this.render();
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  render(time = this.lastTime) {
    this.lastTime = time;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame((t) => this.render(t));
  }
}

// ---------------------------------------------------------------------------
// Avatar (GLB + texture, or ? placeholder)
// ---------------------------------------------------------------------------

class Avatar {
  constructor(url, scene, options = {}) {
    this.scene = scene;
    this.textureUrl = options.textureUrl || null;
    this.loader = new GLTFLoader();
    this.gltf = null;
    this.root = null;
    this.placeholderMesh = null;
    this.morphTargetMeshes = [];
    // Show a simple hologram placeholder immediately so something is always visible.
    this.showPlaceholder();
    this.loadModel(url);
  }

  loadModel(url) {
    logMsg(`Loading avatar: ${url}`);
    this.loader.load(
      url,
      (gltf) => {
        if (this.gltf) {
          this.gltf.scene.remove();
          this.morphTargetMeshes = [];
        }
        this.gltf = gltf;
        if (this.textureUrl) {
          const texUrl = this.textureUrl.startsWith("http")
            ? this.textureUrl
            : new URL(this.textureUrl, window.location.href).href;
          const texLoader = new THREE.TextureLoader();
          texLoader.load(
            texUrl,
            (texture) => {
              texture.encoding = THREE.sRGBEncoding;
              // Apply a bright hologram-style material so the shape is clearly visible,
              // regardless of how dark the source texture is.
              this.gltf.scene.traverse((obj) => {
                if (obj.isMesh && obj.material) {
                  const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                  const newMats = mats.map(
                    () =>
                      new THREE.MeshBasicMaterial({
                        map: texture,
                        color: new THREE.Color("#00ffa3"), // Solana neon tint
                        morphTargets: true,
                        transparent: true,
                        opacity: 0.9,
                        side: THREE.DoubleSide,
                      })
                  );
                  obj.material = newMats.length === 1 ? newMats[0] : newMats;
                }
              });
              this.addToScene();
            },
            undefined,
            () => {
              logMsg("Texture failed, using model default.");
              this.addToScene();
            }
          );
        } else {
          this.addToScene();
        }
      },
      undefined,
      (err) => {
        logMsg(`Watchdog load failed: ${err}. Showing ? placeholder.`);
        this.showPlaceholder();
      }
    );
  }

  addToScene() {
    this.scene.add(this.gltf.scene);
    this.init(this.gltf);
    this.normalizeAndCenter();
    this.setVisiblePosition();
    // Replace placeholder hologram with real dog once loaded.
    if (this.placeholderMesh) {
      this.scene.remove(this.placeholderMesh);
      this.placeholderMesh = null;
    }
    logMsg("Avatar loaded.");
  }

  init(gltf) {
    gltf.scene.traverse((obj) => {
      if (obj.isBone && !this.root) this.root = obj;
      if (!obj.isMesh) return;
      obj.frustumCulled = false;
      if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
        this.morphTargetMeshes.push(obj);
      }
    });
  }

  // Normalize model size and center it so it always fits the camera view.
  normalizeAndCenter() {
    if (!this.gltf) return;
    const s = this.gltf.scene;
    const box = new THREE.Box3().setFromObject(s);
    if (!box.isEmpty()) {
      const size = new THREE.Vector3();
      const center = new THREE.Vector3();
      box.getSize(size);
      box.getCenter(center);
      const maxSize = Math.max(size.x, size.y, size.z) || 1;
      const targetUnitSize = 1; // normalize model so its largest dimension is ~1
      const scaleFactor = targetUnitSize / maxSize;
      s.scale.multiplyScalar(scaleFactor);
      s.position.sub(center); // move model so its center is at origin

      logMsg(
        `Avatar bbox size: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(
          2
        )}, scaleFactor=${scaleFactor.toFixed(3)}`
      );
    }
  }

  setVisiblePosition() {
    if (this.placeholderMesh) {
      this.placeholderMesh.position.set(0, 0, AVATAR_DEPTH);
      this.placeholderMesh.scale.set(-1.5, 1.5, 1.5);
      this.placeholderMesh.rotation.set(0, 0, 0);
      this.placeholderMesh.matrixAutoUpdate = true;
      return;
    }
    if (!this.gltf) return;
    const s = this.gltf.scene;
    s.position.set(0, 0, AVATAR_DEPTH);
    s.scale.set(1.5, 1.5, 1.5);
    s.rotation.set(0, Math.PI, 0);
    s.matrixAutoUpdate = true;
  }

  showPlaceholder() {
    if (this.placeholderMesh) return; // already created
    const geo = new THREE.PlaneGeometry(1, 1);
    const loader = new THREE.TextureLoader();
    const texUrl = new URL("wireframe-face.png", window.location.href).href;

    loader.load(
      texUrl,
      (tex) => {
        tex.encoding = THREE.sRGBEncoding;
        const mat = new THREE.MeshBasicMaterial({
          map: tex,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: true,
        });
        this.placeholderMesh = new THREE.Mesh(geo, mat);
        this.placeholderMesh.frustumCulled = false;
        this.scene.add(this.placeholderMesh);
        this.setVisiblePosition();
        logMsg("Wireframe hologram placeholder loaded.");
      },
      undefined,
      () => {
        // Fallback to simple ? canvas if texture is missing.
        const canvas = document.createElement("canvas");
        const size = 256;
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = "#fff";
        ctx.font = "bold 180px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", size / 2, size / 2);
        const texFallback = new THREE.CanvasTexture(canvas);
        texFallback.encoding = THREE.sRGBEncoding;
        const mat = new THREE.MeshBasicMaterial({
          map: texFallback,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: true,
        });
        this.placeholderMesh = new THREE.Mesh(geo, mat);
        this.placeholderMesh.frustumCulled = false;
        this.scene.add(this.placeholderMesh);
        this.setVisiblePosition();
        logMsg("Wireframe hologram missing, using ? placeholder.");
      }
    );
  }

  updateBlendshapes(blendshapes) {
    if (this.placeholderMesh) return;
    for (const mesh of this.morphTargetMeshes) {
      if (!mesh.morphTargetDictionary || !mesh.morphTargetInfluences) continue;
      for (const [name, value] of blendshapes) {
        if (name in mesh.morphTargetDictionary) {
          mesh.morphTargetInfluences[mesh.morphTargetDictionary[name]] = value;
        }
      }
    }
  }

  applyMatrix(matrix, options = {}) {
    const scale = options.scale ?? AVATAR_SCALE;
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
}

// ---------------------------------------------------------------------------
// Face tracking
// ---------------------------------------------------------------------------

let faceLandmarker = null;
let video = null;
let scene = null;
let avatar = null;
let loggedFirstFace = false;

// Simple calibration state so we can tell the user what's happening.
// 'idle' -> 'calibrating' -> 'success' or 'failed'
let calibrationState = "idle";
let calibrationStartedAt = 0;
const CALIBRATION_TIMEOUT_MS = 7000;

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
  const map = new Map();
  for (const c of categories) {
    const name = c.categoryName;
    let gain = BLENDSHAPE_GAIN.default;
    if (/mouth|Mouth/.test(name)) gain = BLENDSHAPE_GAIN.mouth;
    else if (/jaw|Jaw/.test(name)) gain = BLENDSHAPE_GAIN.jaw;
    else if (/tongue|Tongue/.test(name)) gain = BLENDSHAPE_GAIN.tongue;
    else if (/eye|Eye/.test(name)) gain = BLENDSHAPE_GAIN.eye;
    else if (/brow|Brow/.test(name)) gain = BLENDSHAPE_GAIN.brow;
    map.set(name, Math.min(1, c.score * gain));
  }
  return map;
}

function detectFaceLandmarks(time) {
  if (!faceLandmarker || !video || !avatar) return;
  const result = faceLandmarker.detectForVideo(video, time);
  const matrices = result.facialTransformationMatrixes;
  if (matrices && matrices.length > 0) {
    const matrix = new THREE.Matrix4().fromArray(matrices[0].data);

    // Approximate how \"big\" the user's head is from the face matrix.
    // We measure the length of the first column (scale component) and
    // use that to adapt the avatar scale so it feels like a hologram
    // that matches the user's head size.
    const e = matrix.elements;
    const col0 = new THREE.Vector3(e[0], e[1], e[2]);
    const headScaleRaw = col0.length() || 1;
    // Base around 4, but clamp to a safe range so it never becomes a tiny speck
    // or fills the whole screen. This should feel good on an iPhone 15 Pro.
    let dynamicScale = 4 / headScaleRaw;
    dynamicScale = Math.max(2.0, Math.min(6.0, dynamicScale));

    avatar.applyMatrix(matrix, { scale: dynamicScale });

    const blendshapes = result.faceBlendshapes;
    if (blendshapes && blendshapes.length > 0) {
      avatar.updateBlendshapes(retarget(blendshapes));
      if (!loggedFirstFace) {
        loggedFirstFace = true;
        logMsg(
          `Face tracking active: headScaleRaw=${headScaleRaw.toFixed(
            3
          )}, dynamicScale=${dynamicScale.toFixed(2)}, blendshapes=${
            blendshapes[0].categories.length
          }`
        );
        if (calibrationState === "calibrating") {
          calibrationState = "success";
          setStatus("Calibration complete. Ready — move your face", true);
        }
      }
    } else if (!loggedFirstFace) {
      logMsg(
        `Face tracking: matrix present (headScaleRaw=${headScaleRaw.toFixed(
          3
        )}) but no blendshape data.`
      );
    }
  }
}

function onVideoFrame(time) {
  detectFaceLandmarks(time);
  if (video && typeof video.requestVideoFrameCallback === "function") {
    video.requestVideoFrameCallback(onVideoFrame);
  }
}

// ---------------------------------------------------------------------------
// Camera stream
// ---------------------------------------------------------------------------

async function streamWebcam() {
  video = document.getElementById("video");
  if (!video) {
    setStatus("Error: no video element");
    return Promise.reject(new Error("No video element"));
  }
  setStatus("Requesting camera… Allow when prompted.");
  logMsg("Calling getUserMedia…");
  return new Promise((resolve, reject) => {
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      .then((stream) => {
        video.srcObject = stream;
        video.onloadedmetadata = () => {
          video
            .play()
            .then(() => {
              logMsg("Camera started.");
              if (typeof video.requestVideoFrameCallback === "function") {
                video.requestVideoFrameCallback(onVideoFrame);
              } else {
                logMsg("Using requestAnimationFrame fallback (Safari/iOS).");
                function raf() {
                  if (video.readyState >= 2) detectFaceLandmarks(performance.now());
                  requestAnimationFrame(raf);
                }
                requestAnimationFrame(raf);
              }
              resolve();
            })
            .catch(reject);
        };
      })
      .catch((e) => {
        const msg = e.message || String(e);
        logMsg(`Camera error: ${msg}`);
        setStatus(`Camera error: ${msg}. Tap gear → Logs to copy.`);
        reject(e);
      });
  });
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function runDemo() {
  logMsg(`App started. Secure: ${window.isSecureContext}.`);
  setStatus("Loading 3D watchdog…");

  // 1) Always create the 3D scene + dog immediately, before camera permissions.
  try {
    scene = new BasicScene();
    avatar = new Avatar(getAvatarModelUrl(), scene.scene, { textureUrl: WATCHDOG_TEXTURE_URL });
    logMsg("Scene created (watchdog should be visible even without camera).");
  } catch (e) {
    logMsg(`Scene error: ${e.message || e}`);
    setStatus(`Scene error. Tap gear → Logs to copy.`);
    return;
  }

  // 2) Then try to start the camera for tracking.
  let cameraOk = true;
  calibrationState = "calibrating";
  calibrationStartedAt = performance.now();
  setStatus("Calibrating hologram… line up your face.");
  setTimeout(() => {
    if (calibrationState === "calibrating") {
      calibrationState = "failed";
      setStatus("Calibration failed. Using default scale.");
      logMsg("Calibration timeout reached without stable face data.");
    }
  }, CALIBRATION_TIMEOUT_MS);
  try {
    await streamWebcam();
  } catch (e) {
    cameraOk = false;
    const msg = e?.message || String(e || "unknown");
    logMsg(`Camera unavailable or denied: ${msg}`);
    setStatus("No camera / permission denied. Watchdog will show but not track.");
  }

  // 3) If no camera, we stop here (dog stays visible but static).
  if (!cameraOk) return;

  // 4) If camera is OK, load MediaPipe for tracking.
  setStatus("Loading face model…");
  logMsg("Loading MediaPipe…");
  try {
    const vision = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.1.0-alpha-16/wasm"
    );
    const modelPath =
      "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";
    for (const delegate of ["GPU", "CPU"]) {
      try {
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
        logMsg(`GPU failed, trying CPU.`);
      }
    }
    // FaceLandmarker is ready; we still wait for first good face data to mark success.
    setStatus("Calibrating hologram… move closer and look at the camera.");
  } catch (e) {
    const msg = e.message || String(e);
    logMsg(`MediaPipe error: ${msg}`);
    setStatus(`MediaPipe error. Tap gear → Logs to copy.`);
  }
}

runDemo().catch((e) => {
  logMsg(`runDemo failed: ${e.message || e}`);
  setStatus("Error. Tap gear → Logs to copy.");
});
