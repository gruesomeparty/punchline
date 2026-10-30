// Applies the appearance chosen in Settings. "system" leaves it to prefers-color-scheme in
// page.css, the other two pin it with data-theme on <html>.

import { loadSettings, type Theme } from '../settings/settings.ts';

export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement): void {
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = theme;
}

/** Applies the stored theme now and whenever Settings changes it. */
export function followThemeSetting(): void {
  void loadSettings().then((settings) => applyTheme(settings.theme));
  chrome.storage.onChanged.addListener(() => {
    void loadSettings().then((settings) => applyTheme(settings.theme));
  });
}
