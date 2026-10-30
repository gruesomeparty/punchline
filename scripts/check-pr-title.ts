// Fails if the PR title (passed via PR_TITLE) is not a Conventional Commits header.
import { validateTitle } from './lib/conventional-commit.ts';

const title = process.env.PR_TITLE ?? '';
const errors = validateTitle(title);

if (errors.length > 0) {
  console.error(`✖ PR title "${title}" is not a Conventional Commit:`);
  for (const error of errors) console.error(`  - ${error}`);
  console.error(
    'The PR title becomes the squash commit on main. See https://www.conventionalcommits.org',
  );
  process.exit(1);
}
console.log(`✔ PR title "${title}" is a Conventional Commit`);
