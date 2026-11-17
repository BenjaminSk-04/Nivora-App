# Nivora — Finance & Health

Installable PWA for expenses, budgets, group splits and medicine reminders. Vanilla JS + Tailwind, no framework. All data stays in the browser (`localStorage`).

## Run locally
```bash
npm install
npm run dev        # builds Tailwind, serves http://localhost:5173
```

## Deploy (GitHub Pages)
1. Push this repo to GitHub (branch `main`).
2. **Settings → Pages → Source: GitHub Actions**.
3. Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.

Site URL: `https://<your-username>.github.io/<repo-name>/`

## Structure
```
index.html            app shell
manifest.webmanifest  PWA manifest
sw.js                 service worker (offline cache, versioned per build)
css/                  styles.css (custom) + tailwind.src.css (compiled at build)
js/01..08-*.js        classic scripts sharing one global scope — order matters
assets/               icons and logos
scripts/build.mjs     build: Tailwind → dist/, stamps sw.js cache version
```
Why classic scripts and not ES modules: the UI uses inline `onclick="fn()"` handlers, which need global functions. Moving to modules means replacing those with event listeners — a good next refactor.

## Demo limitations (read before sharing publicly)
- **Auth is a demo**: any username works with password `demo1234`, checked client-side. There is no real account system.
- **Health data is stored unencrypted** in the browser's localStorage.
- **Medicine reminders only fire while the app is open.** Reliable background alarms need a native wrapper (e.g. Capacitor) or push notifications.
- Inter font, Leaflet and Tesseract load from CDNs (cached by the service worker after first use).
- `assets/icon-192.png` and `icon-512.png` are upscaled from the 180px icon — replace with real high-res artwork.
