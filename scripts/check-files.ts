// Fails if forbidden files (secrets, HAR captures, screenshots, build output) are tracked.
// Usage: check-files.ts            all tracked files (CI)
//        check-files.ts --staged   staged files only (pre-commit hook)
import { execFileSync } from 'node:child_process';
import { findForbiddenFiles } from './lib/forbidden-files.ts';

const staged = process.argv.includes('--staged');
const args = staged
  ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
  : ['ls-files', '-z'];
const paths = execFileSync('git', args, { encoding: 'utf8' }).split('\0').filter(Boolean);

const violations = findForbiddenFiles(paths);
if (violations.length > 0) {
  console.error(`✖ ${violations.length} file(s) must never be committed:`);
  for (const { path, reason } of violations) console.error(`  - ${path} (${reason})`);
  console.error('Remove them from the index: git rm --cached <file>. See docs/README.md.');
  process.exit(1);
}
console.log(`✔ no forbidden files among ${paths.length} ${staged ? 'staged' : 'tracked'} file(s)`);
