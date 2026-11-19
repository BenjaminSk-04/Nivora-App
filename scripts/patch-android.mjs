import { readFileSync, writeFileSync, existsSync } from "node:fs";

const root = process.env.ANDROID_DIR || "android";
const manifestPath = `${root}/app/src/main/AndroidManifest.xml`;
const gradlePath = `${root}/app/build.gradle`;
if (!existsSync(manifestPath) || !existsSync(gradlePath)) {
  throw new Error("Android project not found. Run Capacitor add android first.");
}

const permissions = [
  "android.permission.CAMERA",
  "android.permission.POST_NOTIFICATIONS",
  "android.permission.SCHEDULE_EXACT_ALARM",
  "android.permission.VIBRATE"
];
let xml = readFileSync(manifestPath, "utf8");
const missing = permissions.filter(p => !xml.includes(`android:name="${p}"`));
if (missing.length) {
  const lines = missing.map(p => `    <uses-permission android:name="${p}" />`).join("\n");
  xml = xml.replace("<application", `${lines}\n\n    <application`);
}
xml = xml.replace(/android:allowBackup="true"/, 'android:allowBackup="false"');
if (!xml.includes('android:allowBackup=')) {
  xml = xml.replace("<application", '<application android:allowBackup="false"');
}
writeFileSync(manifestPath, xml);

let gradle = readFileSync(gradlePath, "utf8");
gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${process.env.VERSION_CODE || 1}`);
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${(process.env.VERSION_NAME || "1.0").replace(/^v/, "")}"`);
if (!/minSdkVersion\s+rootProject\.ext\.minSdkVersion/.test(gradle) &&
    !/minSdkVersion\s+24/.test(gradle)) {
  gradle = gradle.replace(/defaultConfig\s*\{/, "defaultConfig {\n        minSdkVersion 24");
}
writeFileSync(gradlePath, gradle);
console.log(`Android manifest patched. Added permissions: ${missing.join(", ") || "none"}`);
console.log(`Version: ${process.env.VERSION_NAME || "1.0"} (${process.env.VERSION_CODE || 1}); minimum API 24`);
