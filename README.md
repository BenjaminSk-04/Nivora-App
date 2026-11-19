# Nivora — Finance & Health

Android app (Capacitor) for expenses, budgets, group splits and medicine reminders.
**No server and no account:** you enter your name and start. All data stays on the phone, and users keep it safe with
**Export / Import backup** in Settings. Vanilla JS + Tailwind, no framework. The same code also runs in a browser.

## How data works
- **Profiles are just a name.** No email, no password. Several people can share one phone; each profile has its own data.
- Data lives in the app's local storage on the phone. **Uninstalling the app, resetting the phone or losing it deletes the data unless the user has a backup.**
  The app shows a reminder card until the first backup and again after 30 days.
- Android's automatic cloud backup is switched off on purpose (health data should not leave the phone unless the user exports it).
- There is no password, so anyone who can open the app on an unlocked phone can see the data. The phone's screen lock is the protection.

### Backup & restore (Settings, and the first screen)
- **Export backup** → one `.json` file. Optional password: the file is encrypted (PBKDF2-SHA256 600k iterations → AES-256-GCM). *A forgotten password cannot be recovered.* On Android the share sheet opens (save to Drive, Files, WhatsApp…); in a browser it downloads.
- **Import backup** (Settings) replaces the current profile's data after a confirmation, and keeps one-tap **Undo last import**.
- **"I have a backup — restore it"** on the first screen creates the profile straight from a backup (new phone).
- Imported files are treated as untrusted: every field is validated and rebuilt, damaged/edited/newer-version files are rejected, and names/ids/categories are restricted so a crafted file cannot inject code.
- "Just explore with sample data" opens a throw-away demo profile (fake data, clearly labelled).

## Release the Android app on GitHub
The APK is built by GitHub Actions (`.github/workflows/android.yml`) and attached to a GitHub Release.

**One-time: signing key** (so users can update the app later)
```bash
keytool -genkeypair -v -keystore nivora.jks -alias nivora -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 nivora.jks        # macOS: base64 -i nivora.jks
```
Back up `nivora.jks` and its passwords. If you lose it you can never ship an update under the same signature.
In the repo: **Settings → Secrets and variables → Actions → New repository secret**:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` (`nivora`), `ANDROID_KEY_PASSWORD`.

**Every release**
```bash
git tag v1.0.0
git push origin v1.0.0
```
A few minutes later **Releases** has `Nivora-v1.0.0.apk`. Without the secrets the workflow builds a *debug* APK (fine for testing).
Before launch, change `appId` in `capacitor.config.json` (now `com.nivora.app`) to an ID you own; it cannot change once on Google Play.
Install: download the APK on the phone, allow "install unknown apps", open it.

## Medicine alarms (Android)
`js/08-native-alarms.js` schedules the next 14 days of doses as native Android alarms, and rebuilds them whenever data changes or the app opens.
Taken/skipped doses, deleted medicines, notifications-off and switching profile cancel the matching alarms. Lock-screen text is hidden by default.
- Settings → **Send test reminder** schedules a real alarm in 10 s: close the app and confirm it rings.
- Android 12+ needs "Alarms & reminders" allowed for on-time delivery; the app guides the user there.
- Some phones (Xiaomi, Oppo, Vivo, Samsung "sleeping apps") kill background alarms; users may need to exempt Nivora from battery optimisation.
- Google Play will ask you to justify the exact-alarm permission (medication reminders).
- Reminders only ring for the profile that is open (switching profile asks first).

## Medicine report
Medicines → **Adherence report for your doctor** shows the last 30 days per medicine (taken / skipped / missed, %) inside the app, and **Share report** sends it as plain text through the Android share sheet (or copies it on the web).

## Develop & test
```bash
npm install
npm run dev          # builds Tailwind, serves http://localhost:5173
npm test             # build + 19 alarm checks + 70 profile/backup/security/report checks (needs: pip install playwright && playwright install chromium)
```
`scripts/patch-android.mjs` runs in CI after `cap add android`: declares only the permissions the app uses (camera for bill scan, notifications, exact alarms, vibrate — no location), turns off auto-backup, makes the cache folder shareable, sets the version.

## Structure
```
index.html, manifest.webmanifest, sw.js   app shell, PWA manifest, offline cache (web)
css/                styles.css + tailwind.src.css (compiled at build)
js/01..10-*.js      classic scripts sharing one global scope, order matters
  08-native-alarms  Android alarms        09-backup   export / import / validation
  10-account        name-only profiles
js/99-boot.js       load-time side effects (must be last)
scripts/            build.mjs, patch-android.mjs
tests/              native-alarms.test.py, local.test.py
```
Why classic scripts and not ES modules: the UI uses inline `onclick="fn()"` handlers, which need global functions.

## Known limitations (read before sharing publicly)
- Opening WhatsApp / SMS links from inside the Android WebView (caregiver alerts, UPI) has not been tested on a device.
- Group members are plain names for splitting expenses, not linked accounts. There is no sync between devices.
- `assets/icon-192.png` / `icon-512.png` are upscaled from a 180px icon — replace with real artwork.
- Not yet tested on a physical Android device (share sheet, file picker, background alarms). Do this before launch.
- The earlier server-account version (Supabase) is preserved in git history if you ever want cloud sync.
