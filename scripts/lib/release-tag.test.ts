import { describe, expect, it } from 'vitest';
import { validateReleaseTag } from './release-tag.ts';

describe('validateReleaseTag', () => {
  it('accepts a tag that matches both versions', () => {
    expect(validateReleaseTag('v0.1.0', '0.1.0', '0.1.0')).toEqual([]);
  });

  it('rejects tags that are not vX.Y.Z', () => {
    for (const tag of ['0.1.0', 'v0.1', 'v0.1.0-beta', 'release-1']) {
      expect(validateReleaseTag(tag, '0.1.0', '0.1.0')).toEqual([
        `tag "${tag}" must look like v1.2.3`,
      ]);
    }
  });

  it('reports each version that drifts from the tag', () => {
    expect(validateReleaseTag('v0.2.0', '0.1.0', '0.3.0')).toEqual([
      'package.json version "0.1.0" does not match tag v0.2.0',
      'src/manifest.json version "0.3.0" does not match tag v0.2.0',
    ]);
  });

  it('rejects versions Chrome would refuse', () => {
    expect(validateReleaseTag('v0.0.0', '0.0.0', '0.0.0')).toEqual([
      'version 0.0.0 is all zeros, which Chrome rejects',
    ]);
    expect(validateReleaseTag('v1.65536.0', '1.65536.0', '1.65536.0')).toEqual([
      'version 1.65536.0 has a part above 65535, which Chrome rejects',
    ]);
  });
});
