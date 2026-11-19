// Runs in CI after `npx cap add android`. Idempotent.
// 1) declares only the permissions the app really uses  2) sets versionCode / versionName
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = process.env.ANDROID_DIR || 'android';
const manifest = `${root}/app/src/main/AndroidManifest.xml`;
const gradleFiles = [`${root}/app/build.gradle`, `${root}/app/build.gradle.kts`].filter(existsSync);

const PERMISSIONS = [
  'android.permission.CAMERA',                 // bill / prescription scan
  'android.permission.POST_NOTIFICATIONS',     // medicine reminders (Android 13+)
  'android.permission.SCHEDULE_EXACT_ALARM',  // on-time dose alarms (user can revoke in Settings)
  'android.permission.VIBRATE',                // reminder vibration
];

let xml = readFileSync(manifest, 'utf8');
const missing = PERMISSIONS.filter(p => !xml.includes(`"${p}"`));
if (missing.length) {
  const lines = missing.map(p => `    <uses-permission android:name="${p}" />`).join('\n');
  if (!xml.includes('<application')) throw new Error('No <application> tag in manifest');
  xml = xml.replace('<application', `${lines}\n\n    <application`);
  writeFileSync(manifest, xml);
}
// Health data must not leave the phone unless the user exports it: turn off Android's automatic cloud backup.
xml = readFileSync(manifest, 'utf8');
if (xml.includes('android:allowBackup="true"')) { writeFileSync(manifest, xml.replace('android:allowBackup="true"', 'android:allowBackup="false"')); console.log('allowBackup set to false'); }
console.log(`Permissions added: ${missing.length ? missing.join(', ') : 'none (already present)'}`);

// Backups are written to the app cache and handed to the share sheet through Android's FileProvider.
// FileProvider can only share folders listed in res/xml/file_paths.xml, so make sure the cache folder is listed.
const filePaths = `${root}/app/src/main/res/xml/file_paths.xml`;
if (existsSync(filePaths)) {
  let fp = readFileSync(filePaths, 'utf8');
  if (!/<cache-path\b/.test(fp)) {
    fp = fp.replace('</paths>', '    <cache-path name="nivora_cache" path="." />\n</paths>');
    writeFileSync(filePaths, fp); console.log('file_paths.xml: added <cache-path> so backups can be shared');
  } else console.log('file_paths.xml: cache-path already present');
} else console.warn('WARNING: res/xml/file_paths.xml not found - sharing backups from the cache may fail on Android');

const code = process.env.VERSION_CODE, name = process.env.VERSION_NAME;
if (code && name) {
  if (!gradleFiles.length) throw new Error('app/build.gradle not found');
  for (const f of gradleFiles) {
    let g = readFileSync(f, 'utf8');
    const before = g;
    g = g.replace(/versionCode(\s*=?\s*)\d+/, `versionCode$1${code}`)
         .replace(/versionName(\s*=?\s*)"[^"]*"/, `versionName$1"${name.replace(/^v/, '')}"`);
    if (g === before) console.warn(`WARNING: version fields unchanged in ${f}`);
    writeFileSync(f, g);
    console.log(`Version set to ${name} (${code}) in ${f}`);
  }
}
