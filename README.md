# Watchdog Face Tracking Web App

Real-time face-tracking avatar in the browser using **MediaPipe Face Landmarker** and **Three.js**. Works on desktop and mobile (test on your phone over HTTPS).

- **Your avatar:** The app loads the 3D model and texture from the **Watchdog Model** folder: `watchdog_head.glb` and `Watchdog Image.png`. Put the exported GLB there; the texture is already there. If the GLB fails to load, a **?** placeholder tracks your head. See [ROOT-FILES.md](./ROOT-FILES.md) for required files.

## Deploy to GitHub and test on phone

1. **Create a repo** and push this project:
   ```bash
   git init
   git add .
   git commit -m "Watchdog face tracking web app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
   git push -u origin main
   ```

2. **Enable GitHub Pages:**
   - Repo → **Settings** → **Pages**
   - **Source:** GitHub Actions
   - Save

3. **Deploy:** The workflow runs on push to `main`. After it finishes, the site is at:
   `https://YOUR_USERNAME.github.io/YOUR_REPO/`

4. **Test on phone:** Open that URL on your phone, allow camera when prompted, and move your face; the avatar should follow.

**Note:** Camera and MediaPipe require **HTTPS**. GitHub Pages provides this automatically.

## Project layout

| Path | Purpose |
|------|--------|
| **Root** | |
| `index.html` | Entry page |
| `main.js` | App: Three.js, MediaPipe, avatar + texture |
| `style.css` | Layout and UI styles |
| `favicon.svg` | Tab icon |
| `.nojekyll` | Required for GitHub Pages |
| **Watchdog Model/** | |
| `watchdog_head.glb` | 3D head model (app loads this) |
| `Watchdog Image.png` | Texture (app applies this to the model) |
| `create_watchdog_model.py` | Blender script to create the model |
| `ART_GUIDE.md`, `blendshape_names.txt` | Docs for modeling |
| `ROOT-FILES.md` | Full list of required files |

## Adding your watchdog avatar

1. In Blender, run `Watchdog Model/create_watchdog_model.py` and export as **glTF 2.0 (.glb)** with shape keys enabled.
2. Save as `watchdog_head.glb` in the **Watchdog Model** folder (same folder as `Watchdog Image.png`).
3. Push to GitHub; the app loads the model and texture from that folder. If the GLB is missing, a **?** placeholder tracks your head. See [ROOT-FILES.md](./ROOT-FILES.md) for required files.

See [Watchdog Model/README.md](./Watchdog%20Model/README.md) and [ART_GUIDE.md](./Watchdog%20Model/ART_GUIDE.md) for modeling details.

## Debugging

Tap the **gear (⚙)** button → **Logs** to see debug logs and copy them to clipboard.
