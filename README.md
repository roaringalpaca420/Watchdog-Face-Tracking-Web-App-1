# Watchdog Face Tracking Web App

Real-time face-tracking avatar in the browser using **MediaPipe Face Landmarker** and **Three.js**. Works on desktop and mobile (test on your phone over HTTPS).

- **Default avatar:** Raccoon head (demo model).  
- **Your avatar:** Export a GLB from the [Watchdog Model](./Watchdog%20Model/) Blender pipeline and add `watchdog_head.glb` to the project root; the app will use it automatically and fall back to the raccoon if the file is missing.

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
| `main.js` | App entry: Three.js scene, MediaPipe Face Landmarker, avatar GLB loading and blendshapes |
| `src/style.css` | Layout and mobile-friendly styles |
| `index.html` | HTML entry with settings UI and logs |
| `Watchdog Model/` | Blender script and docs to create a watchdog GLB with MediaPipe blendshapes |

## Adding your watchdog avatar

1. In Blender, run `Watchdog Model/create_watchdog_model.py` and export as **glTF 2.0 (.glb)** with shape keys enabled.
2. Save as `watchdog_head.glb` in the **project root** (same folder as `index.html`).
3. Push to GitHub; the app will load `./watchdog_head.glb` and only use the raccoon if the file is missing.

See [Watchdog Model/README.md](./Watchdog%20Model/README.md) and [ART_GUIDE.md](./Watchdog%20Model/ART_GUIDE.md) for modeling details.

## Debugging

Tap the **gear (⚙)** button → **Logs** to see debug logs and copy them to clipboard.
