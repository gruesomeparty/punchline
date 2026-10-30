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

  it('marks a theme chosen in Settings, and leaves System to the browser', () => {
    document.body.replaceChildren();
    toggleOverlay(document, 'about:blank', 'dark');
    expect(document.getElementById('punchline-overlay')?.dataset.theme).toBe('dark');
    toggleOverlay(document, 'about:blank');
    toggleOverlay(document, 'about:blank', 'system');
    expect(document.getElementById('punchline-overlay')?.hasAttribute('data-theme')).toBe(false);
  });
});
