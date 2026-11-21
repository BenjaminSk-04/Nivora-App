# Nivora

Nivora is a simple, open-source Android app for tracking everyday expenses and
medicines. All your data stays on your own device — there's no server, no
account, and no tracking.

> **Status:** this app is a thin native **WebView wrapper** around a
> self-contained HTML/JS/CSS app (`android/app/src/main/assets/www/index.html`).
> See [How it's built](#how-its-built) below for what that means in practice.

![Nivora icon](docs/app-icon-512.png)

## Features

**Money**
- Add, edit, and categorize expenses (manually, or via **Smart add** — paste a
  bank SMS or type a shorthand like `250 swiggy` and it's parsed automatically)
- **Scan bill**: photograph or pick a receipt, the app reads the total amount
  off it on-device (via OCR) and pre-fills the expense form, auto-categorized
- Monthly budgets per category, with automatic redistribution when you change
  your total budget
- Flatmate/group bill splitting — name your own group and add/remove real
  flatmates any time (Splits → Manage); nothing is pre-filled with sample people
- Spending insights: category breakdown, trends, balance forecast

**Health**
- Medicine reminders with times, stock tracking, and low-stock/duplicate alerts
- A shareable adherence report, and a WhatsApp alert you can send to a
  caregiver

**General**
- A short onboarding flow to set up your name and profile (no sign-up, no
  password, no email — it's just you)
- **Backup & Restore**: export all your data to a JSON file you control, and
  restore it later (Settings → Backup & Restore)
- Light/large-text accessibility toggle

### Starts empty

A fresh install has no expenses, no medicines, and no flatmates — a real
person's app shouldn't come pre-loaded with someone else's sample data. The
only defaults are starting monthly budget numbers (you can edit or zero these
out any time in Budgets). This was also an architectural fix, not just a data
one: the original prototype had the demo person's name hard-coded as the
identity used throughout the splitting/expense logic, which only worked
because the sample data matched it. That's been replaced with a stable
internal "you" identity that's independent of your display name, and the
group name + flatmates are now data you manage yourself (Splits → Manage).

## Removed from the original prototype

Per the project owner's request, two features from the original prototype are
**not** part of this app and have been fully removed from the code (not just
hidden): the **"Medicine Finder" generic-medicine price comparison** tool, and
the **"Locations" / Jan Aushadhi Kendra finder** (map + nearby-store list).
Medicine reminders and stock tracking themselves are untouched.

## How it's built

The app (UI, logic, data handling) is plain client-side JavaScript — no
framework, no build step — split into small feature modules under:

```
android/app/src/main/assets/www/
  index.html          <- page shell: styles, Tailwind, and the <script> list
  js/
    utils.js  assets.js  identity.js  state.js  forms.js  ui-core.js   (foundation)
    nav.js  profile.js  charts.js                                       (shared UI)
    dashboard.js  expenses.js  budgets.js  splits.js                    (money)
    medicines.js                                                        (health)
    insights.js  settings.js  backup.js  smart-add.js  bills.js  scan-bill.js
    render.js  boot.js                                                  (router + startup)
```

`MainActivity.kt` hosts this in a full-screen `WebView` and bridges the few
things a plain web page can't do on Android:

| Feature in the web app | How the Android shell makes it work |
|---|---|
| **Scan bill** (camera/gallery `<input type=file>`) | `WebChromeClient.onShowFileChooser` launches the real system camera or document picker and feeds the result back in. |
| **Backup & Restore** | `window.AndroidBridge.saveBackup()` / `.pickBackup()` use Android's Storage Access Framework so you pick a real save/open location. |
| External links (e.g. the WhatsApp caregiver-alert link) | Opened in a real browser/WhatsApp via an Android `Intent`. |

### Modifying the app

Each file starts with a header comment saying what it owns. Typical edits:

- **Change a screen** — open its file (e.g. Budgets → `budgets.js`). Each screen
  is a `views['/route'] = () => ...` function returning an HTML string.
- **Add a screen** — create `js/myfeature.js`, register `views['/myfeature']`,
  add a `<script src="js/myfeature.js">` line in `index.html` (before
  `render.js`), and link to it from `nav.js`.
- **Change what is stored** — edit `buildSeed()` in `state.js`, bump
  `SCHEMA_VERSION`, and add a `MIGRATIONS` step so existing users keep their data.
- **Branding** — logos and icons live in `assets.js`.

**Script order matters.** These are classic (non-module) scripts sharing one
global scope, so they work straight from `file://` inside the WebView with no
bundler. Rules: `nav.js` (which creates the `views` registry) loads before any
file that registers a view, and `boot.js` always loads last — it is the only
file that runs state-dependent code at startup. Everything else just defines
functions.

### Known limitations

- **Needs internet for styling/fonts/OCR.** The page loads Tailwind CSS, a
  Google Font, and (only when you use "Scan bill") the Tesseract.js OCR
  library from a CDN. Your actual data (expenses, medicines, profile) never
  leaves the device — only these third-party libraries are fetched online.
  The WebView's HTTP cache means repeat launches are faster, but this is not
  a fully offline-first app yet.
- **Reminders only fire while the app is open.** Like the original browser
  prototype, medicine reminders are a JavaScript timer loop — there's no
  Android `AlarmManager`/notification-channel integration yet, so a reminder
  won't wake your phone if Nivora isn't running. This would be a good first
  native feature for a contributor to add.
- **No automated tests.** Given its size, this app currently relies on manual
  testing. Contributions adding tests are very welcome.

## Building the app

You'll need [Android Studio](https://developer.android.com/studio) (Hedgehog
or newer) and a JDK 17.

1. Clone the repo and open the **`android/`** folder in Android Studio (not
   the repo root) — `File → Open`.
2. **Gradle wrapper jar:** this repo does not include the binary
   `gradle/wrapper/gradle-wrapper.jar` file. When you open the project,
   Android Studio will detect the wrapper is incomplete and offer to fix it
   automatically — accept that prompt. If it doesn't, or you're building from
   the command line, run this once (requires a system-wide Gradle install,
   e.g. `brew install gradle` / `sdk install gradle`):
   ```
   gradle wrapper --gradle-version 8.9
   ```
3. Let Gradle sync, then **Run ▶** on an emulator or a physical device
   (minimum Android 7.0 / API 24).

To build a release APK from the command line once the wrapper is in place:
```
cd android
./gradlew assembleRelease
```
The unsigned APK lands in `android/app/build/outputs/apk/release/`.

## Project layout

```
android/
  app/
    src/main/
      assets/www/             ← the web app: index.html + js/ feature modules
      java/com/nivora/app/
        MainActivity.kt       ← WebView host + native bridges
      res/                    ← app icon, theme, strings
      AndroidManifest.xml
  build.gradle.kts, settings.gradle.kts, gradle.properties
```

## Privacy

Nivora stores everything — expenses, medicines, your profile — only in the
WebView's local storage on your device. There is no backend, no analytics,
and no account. Use **Settings → Backup & Restore** to make your own copy of
your data (e.g. before switching phones); that file is yours to keep wherever
you like.

## Contributing

Issues and pull requests are welcome. Most feature work happens in the
modules under `assets/www/js/` — the Android-specific code in
`MainActivity.kt` is intentionally small and focused on the native bridges
listed above.

## License

[MIT](LICENSE) — see the LICENSE file.
