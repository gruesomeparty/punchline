import { describe, expect, it } from 'vitest';
import manifest from '../../src/manifest.json' with { type: 'json' };
import { ALLOWED_HOSTS, validateManifest } from './manifest-policy.ts';

const base = { manifest_version: 3 };

describe('validateManifest', () => {
  it('accepts the real manifest', () => {
    expect(validateManifest(manifest)).toEqual([]);
  });

  it('accepts every allowlisted host and permission', () => {
    expect(
      validateManifest({
        ...base,
        permissions: ['storage', 'alarms'],
        host_permissions: [...ALLOWED_HOSTS],
        content_scripts: [{ matches: ['https://*.hrworks.de/*'] }],
      }),
    ).toEqual([]);
  });

  it('requires manifest v3', () => {
    expect(validateManifest({ manifest_version: 2 })).toEqual(['manifest_version must be 3']);
  });

  it.each([
    '<all_urls>',
    '*://*/*',
    'https://*/*',
    'http://api.harvestapp.com/*',
    'https://*.harvestapp.com/*',
    'https://evil-hrworks.de/*',
  ])('rejects host pattern %s', (pattern) => {
    expect(validateManifest({ ...base, host_permissions: [pattern] })).toHaveLength(1);
  });

  it('rejects broad patterns in every host field', () => {
    const errors = validateManifest({
      ...base,
      optional_host_permissions: ['<all_urls>'],
      content_scripts: [{ matches: ['<all_urls>'] }, 'garbage'],
      web_accessible_resources: [{ matches: ['<all_urls>'] }],
      externally_connectable: { matches: ['<all_urls>'], ids: ['*'] },
    });
    expect(errors).toHaveLength(5);
  });

  it('rejects permissions outside the allowlist', () => {
    const errors = validateManifest({
      ...base,
      permissions: ['storage', 'cookies', '<all_urls>'],
      optional_permissions: ['debugger'],
    });
    expect(errors).toEqual([
      'permissions: permission "cookies" is not in the allowlist',
      'permissions: permission "<all_urls>" is not in the allowlist',
      'optional_permissions: permission "debugger" is not in the allowlist',
    ]);
  });

  it('rejects unsafe CSP directives', () => {
    const errors = validateManifest({
      ...base,
      content_security_policy: {
        extension_pages: "script-src 'self' 'unsafe-eval' https:; object-src 'self'",
        sandbox: 42,
      },
    });
    expect(errors).toEqual([
      `content_security_policy.extension_pages: "'unsafe-eval'" is not allowed`,
      'content_security_policy.extension_pages: "https:" is not allowed',
    ]);
  });

  it('accepts a strict CSP', () => {
    expect(
      validateManifest({
        ...base,
        content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
      }),
    ).toEqual([]);
  });
});
