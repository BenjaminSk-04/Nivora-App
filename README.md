<p align="center">
  <img src="docs/app-icon-512.png" alt="Nivora logo" width="120" />
</p>

<h1 align="center">Nivora</h1>

<p align="center">
  <strong>One platform. A healthier tomorrow.</strong><br/>
  A private, open-source Android app for managing everyday money and medicines.
</p>

<p align="center">
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="Platform: Android 7.0+" src="https://img.shields.io/badge/platform-Android%207.0%2B-3DDC84.svg">
  <img alt="Min SDK 24" src="https://img.shields.io/badge/minSdk-24-informational.svg">
  <img alt="Target SDK 35" src="https://img.shields.io/badge/targetSdk-35-informational.svg">
  <img alt="Data stays on device" src="https://img.shields.io/badge/data-on--device%20only-success.svg">
</p>

---

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Privacy and Data Handling](#privacy-and-data-handling)
4. [Architecture](#architecture)
5. [Getting Started](#getting-started)
6. [Building a Release](#building-a-release)
7. [Android Permissions](#android-permissions)
8. [Backup and Restore](#backup-and-restore)
9. [Known Limitations](#known-limitations)
10. [Roadmap](#roadmap)
11. [Contributing](#contributing)
12. [Acknowledgements](#acknowledgements)
13. [License](#license)

---

## Overview

Nivora brings two things people juggle daily into one simple app: **where their
money goes** and **whether they have taken their medicines**.

It has no account system, no backend, and no analytics. Everything you enter is
stored on your own device, and you can export a full backup at any time.

| | |
|---|---|
| **Platform** | Android 7.0 (API 24) and above |
| **Language** | Kotlin (native shell) and JavaScript (application logic) |
| **Distribution** | Source on GitHub; build the APK yourself |
| **License** | MIT |

## Features

### Money

| Feature | Description |
|---|---|
| **Expense tracking** | Add, edit, search, filter, and delete expenses. Categories are suggested automatically from the note. |
| **Smart add** | Type a shorthand such as `250 swiggy`, or paste a bank SMS, and the amount, category, and note are filled in for you. SMS is pasted manually; Nivora never reads your messages. |
| **Scan bill** | Photograph or pick a receipt. The amount is read from the image using on-device OCR, categorized, and saved with the photo attached as a receipt. |
| **Budgets** | Monthly budget per category, with automatic redistribution when the overall budget changes. |
| **Shared expenses** | Create your own group, add flatmates, and split bills equally, by percentage, or by shares. See who owes whom, get simplified settle-up suggestions, pay via UPI, or send a reminder. |
| **Bills and forecast** | Track upcoming bills, see a "safe to spend" figure, and get a low-balance alert. |
| **Insights** | Spending by category, month-on-month comparison, and past-month summaries. |

### Health

| Feature | Description |
|---|---|
| **Medicine reminders** | Schedule doses by time of day, mark doses as taken or skipped, and see what is due next. |
| **Stock tracking** | Remaining quantity per medicine with low-stock warnings and one-tap restock. |
| **Duplicate detection** | Warns when a newly added medicine shares an active ingredient with one you already take. |
| **Caregiver alerts** | When a dose is skipped or more than an hour late, a ready-written WhatsApp message to your chosen contact is prepared; you tap send. |
| **Adherence report** | A shareable summary of doses taken versus missed, suitable for a doctor visit. |

### General

- Guided onboarding to create a local profile: name, health basics, emergency contact, monthly income and budget, **a budget for each expense category** (Food, Rent, Transport, Health, Utilities, Entertainment, Other, pre-filled from your total with a live total and an income check), and goals. There is no sign-up, password, or email.
- Large-text accessibility mode.
- Full **backup and restore** to a JSON file you control.
- Starts completely empty: no sample data is bundled.

## Privacy and Data Handling

- **Local only.** Expenses, medicines, profile, and receipts are stored in the
  WebView's local storage on your device. There is no server to send them to.
- **No account, no tracking.** No analytics, advertising, or crash-reporting SDKs are included.
- **Network use is limited to app resources.** The interface loads Tailwind CSS, the Inter typeface, and (only when you use *Scan bill*) the Tesseract.js OCR library from public CDNs. None of your data is sent in those requests.
- **You own your data.** Export it at any time, or remove everything with *Settings, Clear all data*.
- **Health data note.** Nivora is a personal reminder tool. It does not provide medical advice.

## Architecture

Nivora is a thin native Android shell around a self-contained web application.

```
┌──────────────────────────────────────────────────────────┐
│ Android app (Kotlin)                                      │
│   MainActivity ── hosts a full-screen WebView             │
│     • file chooser  → camera / gallery (Scan bill)        │
│     • AndroidBridge → backup export / import (SAF)        │
│     • external links → browser / WhatsApp via Intents     │
├──────────────────────────────────────────────────────────┤
│ Web app (assets/www) — vanilla JS, no framework or bundler│
│   index.html + js/*.js feature modules                    │
│   State persisted in localStorage (versioned + migrated)  │
└──────────────────────────────────────────────────────────┘
```

### Repository layout

```
.
├── README.md
├── LICENSE
├── docs/
│   └── app-icon-512.png
└── android/
    ├── build.gradle.kts, settings.gradle.kts, gradle.properties
    └── app/
        ├── build.gradle.kts
        └── src/main/
            ├── AndroidManifest.xml
            ├── java/com/nivora/app/MainActivity.kt
            ├── res/                      launcher icons, theme, strings
            └── assets/www/
                ├── index.html            page shell and ordered script list
                └── js/
                    ├── utils.js          formatting, dates, categories
                    ├── assets.js         logo and SVG icons
                    ├── identity.js       stable "me" key, display names
                    ├── state.js          state shape, storage, migrations
                    ├── forms.js          shared form helpers
                    ├── ui-core.js        toasts, modals, notifications
                    ├── nav.js            navigation and the views registry
                    ├── profile.js        profile and onboarding wizard
                    ├── charts.js         progress bars, pie and line charts
                    ├── dashboard.js      home screen
                    ├── expenses.js       expense list and forms, receipts
                    ├── budgets.js        budgets screen and editing
                    ├── splits.js         shared expenses and settle-up
                    ├── medicines.js      reminders, stock, caregiver, report
                    ├── insights.js       insights and past-month summary
                    ├── settings.js       settings screen
                    ├── backup.js         export and import
                    ├── smart-add.js      quick add and SMS parsing
                    ├── bills.js          bills, forecast, low-balance alerts
                    ├── scan-bill.js      camera/gallery, OCR, receipt parsing
                    ├── render.js         router and reminder loop
                    └── boot.js           startup sequence (must load last)
```

### Technology

| Layer | Technology |
|---|---|
| Native shell | Kotlin 2.0, AndroidX (AppCompat, Activity, Core), Android Gradle Plugin 8.5, Gradle 8.9 |
| Application | Vanilla JavaScript (ES2020), loaded as classic scripts |
| Styling | Tailwind CSS (CDN), Inter typeface |
| OCR | Tesseract.js 5 (loaded on demand) |
| Storage | `localStorage` with a schema version and migration chain |

### Design notes

- **Script order matters.** The modules are plain scripts that share one global
  scope, which lets them load straight from `file://` inside the WebView
  without a bundler. `nav.js` creates the `views` registry and must load
  before any file that registers a screen. `boot.js` is the only file that
  runs state-dependent code at startup and must always load last.
- **Stable identity.** The current user is stored internally under a fixed key
  rather than by display name, so renaming yourself never corrupts past
  splits or balances.
- **Versioned storage.** Changes to the stored data shape go through
  `SCHEMA_VERSION` and a `MIGRATIONS` step in `state.js`, so existing users keep
  their data across updates.

## Getting Started

### Prerequisites

- [Android Studio](https://developer.android.com/studio) Hedgehog (2023.1) or newer
- JDK 17
- An Android device or emulator running Android 7.0 (API 24) or newer

### Build and run

1. Clone the repository.
   ```bash
   git clone https://github.com/<your-username>/nivora.git
   ```
2. In Android Studio choose **File, Open** and select the **`android/`** folder
   (not the repository root).
3. **Gradle wrapper.** The binary `gradle/wrapper/gradle-wrapper.jar` is not
   committed. Android Studio offers to restore it when you open the project;
   accept the prompt. From the command line, run this once (requires a local
   Gradle installation):
   ```bash
   cd android
   gradle wrapper --gradle-version 8.9
   ```
4. Let Gradle sync, then press **Run** on a device or emulator.

### Command-line build

```bash
cd android
./gradlew assembleDebug        # debug APK
./gradlew assembleRelease      # unsigned release APK
```

Outputs are written to `android/app/build/outputs/apk/`.

### Working on the web app

All application code is in `android/app/src/main/assets/www/`. Edit a module,
rebuild, and run. Each file begins with a header describing what it owns.

| Task | Where |
|---|---|
| Change a screen | Its module (for example, Budgets is `budgets.js`). Each screen is a `views['/route']` function that returns HTML. |
| Add a screen | Create `js/yourfeature.js`, register `views['/yourfeature']`, add a `<script>` tag in `index.html` before `render.js`, and link it from `nav.js`. |
| Change stored data | Edit `buildSeed()` in `state.js`, bump `SCHEMA_VERSION`, and add a `MIGRATIONS` step. |
| Change branding | `assets.js` (in-app logo) and `res/mipmap-*` (launcher icon). |

## Building a Release

1. Open the project in Android Studio.
2. Choose **Build, Generate Signed App Bundle / APK**.
3. Create or select a keystore and complete the wizard.

Keep your keystore and its passwords private. `*.jks` and `*.keystore` files
are already excluded by `.gitignore`.

## Android Permissions

| Permission | Why it is needed |
|---|---|
| `INTERNET` | Loads the UI libraries and fonts (and the OCR library on first use of *Scan bill*). No personal data is transmitted. |
| `ACCESS_NETWORK_STATE` | Lets the WebView handle connectivity changes gracefully. |
| `CAMERA` | Requested only when you choose to photograph a bill. Camera hardware is optional; the app works without it. |

Nivora does **not** request SMS, contacts, location, or broad storage access.
Backups and bill photos use Android's system file picker and a private cache.

## Backup and Restore

Open **Settings, Backup and Restore**.

- **Export** saves a JSON file to a location you choose (Downloads, Drive, etc.).
- **Import** reads a backup file and, after confirmation, replaces the current data.

The file is human-readable JSON:

```json
{
  "app": "nivora",
  "exportedAt": "2026-01-01T09:30:00.000Z",
  "schemaVersion": 3,
  "state": { "...": "..." }
}
```

Backups from older versions are migrated automatically on import. Because the
app stores data only on the device, export a backup before changing phones or
uninstalling.

## Known Limitations

- **Internet on first use.** Styling, fonts, and the OCR library come from CDNs.
  Once cached by the WebView they load faster, but Nivora is not yet fully offline-first.
- **Reminders need the app running.** Dose reminders are driven by a timer inside
  the app and do not use Android's alarm or notification-channel APIs, so they
  will not wake a phone if Nivora has been closed.
- **OCR accuracy varies.** Scan quality, lighting, and receipt layout affect
  results. Always review the amount before saving.
- **Currency.** Amounts are formatted in Indian rupees (INR), and UPI payment links
  are specific to India.
- **No automated tests.** The project currently relies on manual testing.

## Roadmap

- [ ] Native background reminders (AlarmManager or WorkManager with notification channels)
- [ ] Bundle Tailwind, fonts, and the OCR library for fully offline use
- [ ] Automated tests for the balance, split, and parsing logic
- [ ] Configurable currency
- [ ] CSV export of expenses
- [ ] Dark theme

## Contributing

Contributions are welcome.

1. Fork the repository and create a branch (`feature/short-description`).
2. Keep changes focused. Most work happens in `assets/www/js/`; native code in
   `MainActivity.kt` is intentionally small.
3. Preserve data compatibility: any change to the stored shape needs a
   `SCHEMA_VERSION` bump and a migration.
4. Test on a real device or emulator, covering onboarding, adding an expense,
   splitting a bill, scanning a bill, and backup and restore.
5. Open a pull request describing the change and how you tested it.

Please open an issue first for large features so the approach can be agreed
before you invest time.

## Acknowledgements

- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Inter](https://rsms.me/inter/) typeface
- [Tesseract.js](https://github.com/naptha/tesseract.js) for in-browser OCR

## License

Released under the [MIT License](LICENSE).
