// HRworks has its own light and dark look, separate from punchline's setting, so the bar and
// badges follow whatever the page around them shows.

/** Parses `rgb(…)`/`rgba(…)` as computed styles report it. Null for anything else. */
function parseRgb(value: string): { r: number; g: number; b: number; a: number } | null {
  const match = /^rgba?\(([^)]+)\)$/.exec(value.trim());
  if (!match?.[1]) return null;
  const [r, g, b, a = 1] = match[1]
    .split(/[\s,/]+/)
    .filter(Boolean)
    .map(Number);
  if (r === undefined || g === undefined || b === undefined) return null;
  return [r, g, b, a].some(Number.isNaN) ? null : { r, g, b, a };
}

/** Whether the first opaque background behind `element` is dark. */
export function isOnDarkBackground(element: Element | null): boolean {
  for (let node = element; node; node = node.parentElement) {
    const view = node.ownerDocument.defaultView;
    const colour = view ? parseRgb(view.getComputedStyle(node).backgroundColor) : null;
    if (!colour || colour.a < 0.5) continue;
    // Relative luminance, simplified: good enough to tell light from dark.
    return (0.2126 * colour.r + 0.7152 * colour.g + 0.0722 * colour.b) / 255 < 0.5;
  }
  return false;
}
