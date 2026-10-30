// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { applyTheme } from './theme.ts';

describe('applyTheme', () => {
  it('pins light or dark and leaves system to the browser', () => {
    const root = document.createElement('html');
    applyTheme('dark', root);
    expect(root.dataset.theme).toBe('dark');
    applyTheme('light', root);
    expect(root.dataset.theme).toBe('light');
    applyTheme('system', root);
    expect(root.hasAttribute('data-theme')).toBe(false);
  });
});
