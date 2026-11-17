// Runs in CI after `npx cap add android`. Idempotent.
// 1) declares only the permissions the app really uses  2) sets versionCode / versionName
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const root = process.env.ANDROID_DIR || 'android';
const manifest = `${root}/app/src/main/AndroidManifest.xml`;
const gradleFiles = [`${root}/app/build.gradle`, `${root}/app/build.gradle.kts`].filter(existsSync);

const PERMISSIONS = [
  'android.permission.ACCESS_COARSE_LOCATION', // nearby Jan Aushadhi Kendras
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',                 // bill / prescription scan
  'android.permission.POST_NOTIFICATIONS',     // medicine reminders (Android 13+)
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
console.log(`Permissions added: ${missing.length ? missing.join(', ') : 'none (already present)'}`);

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
