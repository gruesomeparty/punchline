/**
 * Permission policy for the extension manifest. Anything not listed here is rejected.
 * Widening this list is a security decision: do it in a dedicated, reviewed PR.
 */
export const ALLOWED_HOSTS: readonly string[] = [
  'https://api.harvestapp.com/*', // Harvest API v2
  'https://id.getharvest.com/*', // Harvest OAuth2
  'https://hrworks.de/*',
  'https://*.hrworks.de/*',
];

export const ALLOWED_PERMISSIONS: readonly string[] = ['storage', 'alarms'];

const UNSAFE_CSP_TOKENS = ["'unsafe-eval'", "'unsafe-inline'", 'http:', 'https:', 'data:', 'blob:'];

type Manifest = Record<string, unknown>;

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
}

function asObjectArray(value: unknown): Manifest[] {
  return Array.isArray(value)
    ? value.filter((v): v is Manifest => typeof v === 'object' && v !== null)
    : [];
}

function checkHosts(field: string, patterns: string[], errors: string[]): void {
  for (const pattern of patterns) {
    if (!ALLOWED_HOSTS.includes(pattern)) {
      errors.push(`${field}: host pattern "${pattern}" is not in the allowlist`);
    }
  }
}

function checkPermissions(field: string, permissions: string[], errors: string[]): void {
  for (const permission of permissions) {
    if (!ALLOWED_PERMISSIONS.includes(permission)) {
      errors.push(`${field}: permission "${permission}" is not in the allowlist`);
    }
  }
}

function checkCsp(csp: unknown, errors: string[]): void {
  if (typeof csp !== 'object' || csp === null) return;
  for (const [key, policy] of Object.entries(csp)) {
    if (typeof policy !== 'string') continue;
    for (const token of UNSAFE_CSP_TOKENS) {
      if (policy.split(/[\s;]+/).includes(token)) {
        errors.push(`content_security_policy.${key}: "${token}" is not allowed`);
      }
    }
  }
}

/** Returns a list of policy violations. An empty list means the manifest is acceptable. */
export function validateManifest(manifest: Manifest): string[] {
  const errors: string[] = [];

  if (manifest.manifest_version !== 3) {
    errors.push('manifest_version must be 3');
  }

  checkPermissions('permissions', asStringArray(manifest.permissions), errors);
  checkPermissions('optional_permissions', asStringArray(manifest.optional_permissions), errors);
  checkHosts('host_permissions', asStringArray(manifest.host_permissions), errors);
  checkHosts(
    'optional_host_permissions',
    asStringArray(manifest.optional_host_permissions),
    errors,
  );

  for (const [i, script] of asObjectArray(manifest.content_scripts).entries()) {
    checkHosts(`content_scripts[${i}].matches`, asStringArray(script.matches), errors);
  }
  for (const [i, resource] of asObjectArray(manifest.web_accessible_resources).entries()) {
    checkHosts(`web_accessible_resources[${i}].matches`, asStringArray(resource.matches), errors);
  }

  const external = manifest.externally_connectable;
  if (typeof external === 'object' && external !== null) {
    const { matches, ids } = external as Manifest;
    checkHosts('externally_connectable.matches', asStringArray(matches), errors);
    if (asStringArray(ids).includes('*')) {
      errors.push('externally_connectable.ids must not contain "*"');
    }
  }

  checkCsp(manifest.content_security_policy, errors);

  return errors;
}
