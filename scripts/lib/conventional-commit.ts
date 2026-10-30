/**
 * Conventional Commits header check. PRs are squash-merged with the PR title as the commit
 * title, so CI runs this on the PR title to keep history on main consistent.
 */
export const TYPES = [
  'feat',
  'fix',
  'docs',
  'style',
  'refactor',
  'perf',
  'test',
  'build',
  'ci',
  'chore',
  'revert',
] as const;

// Matches commitlint's default header-max-length.
export const MAX_LENGTH = 100;

const HEADER = /^([a-z]+)(?:\([^()\s]+\))?!?: (\S.*)$/;

export function validateTitle(title: string): string[] {
  const match = HEADER.exec(title);
  if (!match) {
    return ['must look like "type(scope): subject", e.g. "feat(popup): show sync status"'];
  }

  const errors: string[] = [];
  const [, type = '', subject = ''] = match;
  if (!(TYPES as readonly string[]).includes(type)) {
    errors.push(`type "${type}" is not one of: ${TYPES.join(', ')}`);
  }
  if (subject.trimEnd() !== subject) errors.push('subject must not end with whitespace');
  if (subject.endsWith('.')) errors.push('subject must not end with a period');
  if (title.length > MAX_LENGTH) {
    errors.push(`must be at most ${MAX_LENGTH} characters (is ${title.length})`);
  }
  return errors;
}
