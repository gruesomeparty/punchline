// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { toggleOverlay } from './overlay.ts';

describe('toggleOverlay', () => {
  it('opens and closes the preview frame', () => {
    document.body.replaceChildren();
    expect(toggleOverlay(document, 'about:blank')).toBe(true);
    expect(document.getElementById('punchline-overlay')).not.toBeNull();
    expect(toggleOverlay(document, 'about:blank')).toBe(false);
    expect(document.getElementById('punchline-overlay')).toBeNull();
  });
});
