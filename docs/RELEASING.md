# Releasing a signed APK

This guide is for maintainers. Android only installs and updates apps that are
signed, and an update is only accepted when it is signed with **the same key**
as the version already installed. So you create one release key, keep it safe,
and use it for every release.

> **Back up your keystore (`.jks`) and its passwords somewhere safe and private.**
> If you lose it you can never publish an update that installs over existing
> users' copies. Never commit it to Git.

## 1. Create the release key (once)

```bash
keytool -genkeypair -v \
  -keystore nivora-release.jks \
  -alias nivora \
  -keyalg RSA -keysize 2048 -validity 10000
```

You will be asked for a keystore password, a key password, and your name and
organisation details. Remember the **alias** (`nivora`) and both passwords.

## 2. Publish from GitHub (recommended)

The workflow in `.github/workflows/release.yml` builds, signs, verifies and
publishes the APK for you. No local Android setup is needed.

**Add four repository secrets** (Settings, Secrets and variables, Actions):

| Secret | Value |
|---|---|
| `SIGNING_KEYSTORE_BASE64` | The keystore encoded as base64 (see below) |
| `SIGNING_STORE_PASSWORD` | The keystore password |
| `SIGNING_KEY_ALIAS` | `nivora` (or the alias you chose) |
| `SIGNING_KEY_PASSWORD` | The key password |

Encode the keystore:

```bash
base64 -w0 nivora-release.jks        # Linux
base64 -i nivora-release.jks | tr -d '\n'   # macOS
```

**Release a version.** Update `versionCode` (must increase every release) and
`versionName` in `android/app/build.gradle.kts`, commit, then:

```bash
git tag v1.0
git push origin v1.0
```

The workflow attaches `Nivora-v1.0.apk` and a `.sha256` checksum to a new
GitHub Release. Tags containing a hyphen (for example `v1.2.0-beta1`) are
marked as pre-releases. You can also run the workflow manually from the
Actions tab to get the APK as a downloadable artifact without a release.

## 3. Build a signed APK locally (optional)

1. Copy `android/keystore.properties.example` to `android/keystore.properties`
   and fill it in (this file is git-ignored).
2. From the `android/` folder run `./gradlew assembleRelease`
   (see "Gradle wrapper" below if `./gradlew` is not yet usable).
3. The signed APK is `android/app/build/outputs/apk/release/app-release.apk`.

Verify it is signed:

```bash
apksigner verify --print-certs app-release.apk
```

Without a key configured, `assembleRelease` still works but produces an
**unsigned** APK that Android will refuse to install.

### Gradle wrapper

The binary `gradle/wrapper/gradle-wrapper.jar` is not committed. Android Studio
offers to restore it when you open `android/`, or run once:
`gradle wrapper --gradle-version 8.9`. The GitHub workflow does not need it.

## Changing keys on an existing install

Android refuses to update an app with a differently signed one. If earlier
builds were signed with a different key (for example the automatic debug key
from Android Studio), people must **uninstall the old version before
installing the first release signed with the new key**, and uninstalling erases
the app's data. Tell them to export a backup first (Settings, Backup and
Restore) and import it afterwards.
