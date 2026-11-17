// Static build: compile Tailwind, copy the app into dist/, stamp the service worker with a content hash.
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const dist = join(root, 'dist');

if (!process.env.SKIP_CSS) execSync('npm run css', { cwd: root, stdio: 'inherit' });

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const p of ['index.html', 'manifest.webmanifest', 'sw.js', 'css/styles.css', 'css/tailwind.css', 'js', 'assets']) {
  cpSync(join(root, p), join(dist, p), { recursive: true });
}
writeFileSync(join(dist, '.nojekyll'), '');

const walk = d => readdirSync(d).flatMap(n => { const f = join(d, n); return statSync(f).isDirectory() ? walk(f) : [f]; });
const h = createHash('sha1');
for (const f of walk(dist).sort()) if (!f.endsWith('sw.js')) h.update(readFileSync(f));
const sw = join(dist, 'sw.js');
writeFileSync(sw, readFileSync(sw, 'utf8').replaceAll('__BUILD__', h.digest('hex').slice(0, 10)));
console.log('Built dist/');
