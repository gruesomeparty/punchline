// Zips dist/ into punchline-<version>.zip, ready to upload to the Chrome Web Store.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { type Zippable, zipSync } from 'fflate';

const distDir = 'dist';
if (!existsSync(join(distDir, 'manifest.json'))) {
  console.error('✖ dist/manifest.json not found. Run `npm run build` first.');
  process.exit(1);
}

// Fixed timestamp keeps the archive reproducible.
const mtime = new Date('2000-01-01T00:00:00Z');
const files: Zippable = {};
for (const entry of readdirSync(distDir, { recursive: true, withFileTypes: true })) {
  if (!entry.isFile()) continue;
  const path = join(entry.parentPath, entry.name);
  files[relative(distDir, path).replaceAll('\\', '/')] = [readFileSync(path), { mtime }];
}

const { version } = JSON.parse(readFileSync(join(distDir, 'manifest.json'), 'utf8'));
const out = `punchline-${version}.zip`;
writeFileSync(out, zipSync(files, { level: 9 }));
console.log(`✔ ${out} (${Object.keys(files).length} files)`);
