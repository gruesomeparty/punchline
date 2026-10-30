import { describe, expect, it } from 'vitest';
import { findForbiddenFiles } from './forbidden-files.ts';

describe('findForbiddenFiles', () => {
  it.each([
    '.env',
    '.env.local',
    'config/.env.production',
    'harvest-token.json',
    'secrets.yaml',
    'credentials.txt',
    '.harvest.token',
    'certs/extension.pem',
    'punchline.crx',
    '.ssh/id_ed25519',
    'capture.har',
    'fixtures/hrworks.HAR',
    'page.mhtml',
    'punchline-0.1.0.zip',
    'dist/background.js',
    'coverage/index.html',
    'docs/hrworks-timesheet.png',
    'docs/recording.json',
    'docs/snapshots/day.html',
    'docs\\screenshot.jpg',
  ])('blocks %s', (path) => {
    expect(findForbiddenFiles([path])).toHaveLength(1);
  });

  it.each([
    '.env.example',
    'docs/README.md',
    'docs/architecture/overview.md',
    'src/manifest.json',
    'src/lib/tokenizer.ts',
    'src/auth/token-store.ts',
    'README.md',
    'package.json',
  ])('allows %s', (path) => {
    expect(findForbiddenFiles([path])).toEqual([]);
  });

  it('reports the reason', () => {
    expect(findForbiddenFiles(['a.har'])).toEqual([
      { path: 'a.har', reason: 'captured browser session' },
    ]);
  });
});
