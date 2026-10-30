// Fails if the manifest requests permissions or host access outside the allowlist,
// or if its version drifts from package.json.
import { readFileSync } from 'node:fs';
import { validateManifest } from './lib/manifest-policy.ts';

const manifestPath = process.argv[2] ?? 'src/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

const errors = validateManifest(manifest);
if (manifest.version !== pkg.version) {
  errors.push(`version "${manifest.version}" does not match package.json "${pkg.version}"`);
}

if (errors.length > 0) {
  console.error(`✖ ${manifestPath} violates the permission policy:`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error('See scripts/lib/manifest-policy.ts to review the allowlist.');
  process.exit(1);
}
console.log(`✔ ${manifestPath} is within the permission policy`);
