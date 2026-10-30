// Bundles the extension into dist/. Pass --watch for a rebuild loop during development.
import { cp, mkdir, rm } from 'node:fs/promises';
import { type BuildOptions, build, context } from 'esbuild';

const outdir = 'dist';
const staticFiles = ['manifest.json', 'popup/popup.html', 'popup/popup.css'];

const options: BuildOptions = {
  entryPoints: {
    background: 'src/background.ts',
    'popup/popup': 'src/popup/popup.ts',
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
    await cp(`src/${file}`, `${outdir}/${file}`);
  }
}

await rm(outdir, { recursive: true, force: true });
await copyStatic();

if (process.argv.includes('--watch')) {
  const ctx = await context({
    ...options,
    plugins: [{ name: 'static', setup: (b) => b.onEnd(copyStatic) }],
  });
  await ctx.watch();
} else {
  await build(options);
}
