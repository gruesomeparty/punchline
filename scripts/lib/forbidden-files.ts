/**
 * Files that must never be committed: secrets, captured HRworks/Harvest sessions and build output.
 * Keep in sync with .gitignore. The pre-commit hook and CI both enforce this list.
 */
const RULES: readonly { pattern: RegExp; reason: string }[] = [
  { pattern: /(^|\/)\.env(\.(?!example$)[^/]+)?$/i, reason: 'environment file' },
  { pattern: /\.(pem|key|p12|pfx|crx)$/i, reason: 'private key or signed package' },
  { pattern: /(^|\/)id_(rsa|dsa|ecdsa|ed25519)$/i, reason: 'SSH private key' },
  {
    pattern: /(^|\/)[^/]*(token|secret|credential)s?[^/]*\.(json|txt|ya?ml|env)$/i,
    reason: 'token or credentials file',
  },
  { pattern: /(^|\/)[^/]*\.token$/i, reason: 'token file' },
  { pattern: /\.(har|mhtml?)$/i, reason: 'captured browser session' },
  { pattern: /\.zip$/i, reason: 'packaged extension' },
  { pattern: /^(dist|coverage)\//, reason: 'build output' },
  { pattern: /^docs\/(?!.*\.md$)/i, reason: 'local-only file in docs/ (only Markdown is allowed)' },
];

export type Violation = { path: string; reason: string };

export function findForbiddenFiles(paths: readonly string[]): Violation[] {
  const violations: Violation[] = [];
  for (const raw of paths) {
    const path = raw.replaceAll('\\', '/');
    const rule = RULES.find(({ pattern }) => pattern.test(path));
    if (rule) violations.push({ path, reason: rule.reason });
  }
  return violations;
}
