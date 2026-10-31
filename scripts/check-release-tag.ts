// Fails the release if the pushed tag doesn't match package.json and the manifest.
// Usage: check-release-tag.ts v1.2.3
import { readFileSync } from 'node:fs';
import { validateReleaseTag } from './lib/release-tag.ts';

const tag = process.argv[2] ?? '';
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('src/manifest.json', 'utf8'));

const errors = validateReleaseTag(tag, pkg.version, manifest.version);
if (errors.length > 0) {
  console.error(`✖ tag ${tag || '(none)'} can't be released:`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error('Bump package.json and src/manifest.json together, merge, then tag.');
  process.exit(1);
}
console.log(`✔ ${tag} matches package.json and the manifest`);
