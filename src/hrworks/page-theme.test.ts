// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { isOnDarkBackground } from './page-theme.ts';

afterEach(() => {
  document.body.innerHTML = '';
  document.body.removeAttribute('style');
});

describe('isOnDarkBackground', () => {
  it('finds the first opaque background up the tree', () => {
    document.body.innerHTML =
      '<div style="background-color: rgb(32, 32, 36)"><div style="background-color: rgba(255, 255, 255, 0)"><span id="x"></span></div></div>';
    expect(isOnDarkBackground(document.getElementById('x'))).toBe(true);
  });

  it('treats a light page as light', () => {
    document.body.style.backgroundColor = 'rgb(250, 250, 250)';
    document.body.innerHTML = '<span id="x"></span>';
    expect(isOnDarkBackground(document.getElementById('x'))).toBe(false);
  });

  it('defaults to light when nothing has a background', () => {
    document.body.innerHTML = '<span id="x"></span>';
    expect(isOnDarkBackground(document.getElementById('x'))).toBe(false);
  });
});
