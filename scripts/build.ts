// Bundles the extension into dist/. Pass --watch for a rebuild loop during development.
import { cp, mkdir, rm } from 'node:fs/promises';
import { type BuildOptions, build, context } from 'esbuild';

const outdir = 'dist';
const staticFiles = [
  'manifest.json',
  'popup/popup.html',
  'popup/popup.css',
  'options/options.html',
  'days/days.html',
  'ui/page.css',
  'icons',
];

const options: BuildOptions = {
  entryPoints: {
    background: 'src/background.ts',
    'popup/popup': 'src/popup/popup.ts',
    'options/options': 'src/options/options.ts',
    'days/days': 'src/days/days.ts',
  },
  outdir,
  bundle: true,
  format: 'esm',
  target: 'chrome120',
  legalComments: 'none',
  logLevel: 'info',
};

async function copyStatic(): Promise<void> {
  for (const file of staticFiles) {
    await mkdir(`${outdir}/${file}`.replace(/\/[^/]+$/, ''), { recursive: true });
    await cp(`src/${file}`, `${outdir}/${file}`, { recursive: true });
  }
}

// Content scripts can't be ES modules, so they get their own build as plain scripts.
const contentOptions: BuildOptions = {
  ...options,
  entryPoints: { 'hrworks/content': 'src/hrworks/content.ts' },
  format: 'iife',
};

await rm(outdir, { recursive: true, force: true });
await copyStatic();

if (process.argv.includes('--watch')) {
  const ctx = await context({
    ...options,
    plugins: [{ name: 'static', setup: (b) => b.onEnd(copyStatic) }],
  });
  const contentCtx = await context(contentOptions);
  await Promise.all([ctx.watch(), contentCtx.watch()]);
} else {
  await Promise.all([build(options), build(contentOptions)]);
}
