# Required files for the app (GitHub Pages)

**Repo root** — these must be in the root:

| File | Purpose |
|------|--------|
| `index.html` | Entry page |
| `main.js` | App logic (MediaPipe + Three.js) |
| `style.css` | Layout and UI styles |
| `favicon.svg` | Browser tab icon |
| `.nojekyll` | So GitHub Pages serves all files |

**Watchdog Model folder** — the app loads the 3D model and texture from here:

| File | Purpose |
|------|--------|
| `Watchdog Model/watchdog_head.glb` | 3D head model (face tracking) |
| `Watchdog Model/Watchdog Image.png` | Texture so the model looks like your dog |

**If the GLB or texture is missing:** the app shows a **?** placeholder that still tracks your head.

**Other:**
- `README.md`, `.gitignore`, `.github/workflows/deploy.yml` — docs and deploy
- `Watchdog Model/` also has: Blender script (`create_watchdog_model.py`), ART_GUIDE.md, blendshape_names.txt — for creating/editing the model
- `src/` — legacy; app uses root `main.js` and `style.css`
