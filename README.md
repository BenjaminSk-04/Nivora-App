# Nivora

Nivora is an offline-first Android app for personal finance and everyday health records.

## Product principles

- Local-first: personal records stay on the device.
- No online account required.
- No generic medicine finder, medicine price comparison, or Jan Aushadhi locator.
- Modern interface that follows the device light/dark appearance.
- Android minimum API 24.
- MIT licensed.

## Current first-build scope

Implemented in this foundation:
- Dashboard with monthly income, expenses and net cash flow.
- Income and expense records.
- Monthly category budgets.
- Independent savings goals and contributions.
- Personal medicine records.
- Bills and medical bill records.
- Shared expense records.
- Local profile and JSON export.
- Native SQLite storage on Android; localStorage is used only for browser preview.

Not yet implemented:
- Exact medicine dose alarm scheduling and reboot rescheduling.
- Taken/missed dose adherence history.
- Camera/gallery receipt capture and bundled offline OCR.
- Full shared-expense settlement calculation.
- PIN/biometric app lock.
These will be added in subsequent development steps. Do not rely on this initial build for medication reminders.

## Requirements

- Node.js 22+
- Java 21 and Android SDK are required by GitHub Actions, not by Termux.
- Termux is sufficient for editing, dependency installation, and source builds.

## Build from Termux

```bash
pkg update
pkg install nodejs-lts git -y
npm install --bin-links=false
node node_modules/vite/bin/vite.js build
node node_modules/@capacitor/cli/bin/capacitor add android
node scripts/patch-android.mjs
node node_modules/@capacitor/cli/bin/capacitor sync android
```

The Android folder is generated locally and intentionally ignored by Git. GitHub Actions generates it again and builds a debug APK.

## GitHub APK

Upload the repository contents to the `main` branch. Open **Actions → Build Nivora Android APK**. Download the `Nivora-debug-apk` artifact after the workflow succeeds.

## SQLite note

The native Android app uses `@capacitor-community/sqlite`. The browser preview uses localStorage only as a development fallback. Browser preview data is not migrated to Android SQLite.

## License

MIT. See `LICENSE`.
