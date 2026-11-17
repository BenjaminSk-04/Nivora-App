# Nivora — Finance & Health

Android app (Capacitor) for expenses, budgets, group splits and medicine reminders. Vanilla JS + Tailwind, no framework. All data stays on the device (`localStorage`). The same code also runs as a web app/PWA.

## Release the Android app on GitHub
The APK is built by GitHub Actions (`.github/workflows/android.yml`) and attached to a GitHub Release.

**One-time setup — signing key** (needed so users can update the app later)
```bash
keytool -genkeypair -v -keystore nivora.jks -alias nivora -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 nivora.jks        # macOS: base64 -i nivora.jks
```
Back up `nivora.jks` and its passwords somewhere safe. If you lose it you can never ship an update under the same signature.

In the repo: **Settings → Secrets and variables → Actions → New repository secret**:
`ANDROID_KEYSTORE_BASE64` (output above), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`nivora`), `ANDROID_KEY_PASSWORD`.

**Every release**
```bash
git tag v1.0.0
git push origin v1.0.0
```
After a few minutes, **Releases** has `Nivora-v1.0.0.apk`. Without the secrets, the workflow still builds a *debug* APK for testing.

**Before launch:** change `appId` in `capacitor.config.json` (currently `com.nivora.app`) to an ID you own. It cannot change once the app is on Google Play.

**Install:** download the APK on the phone, allow "install unknown apps" for the browser, open the file.

## Run locally (web)
```bash
npm install
npm run dev        # builds Tailwind, serves http://localhost:5173
```

## Optional: web demo on GitHub Pages
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
- **Medicine reminders still use in-page timers**, so they only fire while the app is open. Next step: schedule native alarms with `@capacitor/local-notifications`.
- **The adherence report opens a pop-up window**, which Android WebViews usually block. Needs an in-app report view.
- Inter font, Leaflet and Tesseract load from CDNs (cached by the service worker after first use).
- `assets/icon-192.png` and `icon-512.png` are upscaled from the 180px icon — replace with real high-res artwork.
