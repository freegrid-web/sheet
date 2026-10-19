import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const sheetRequire = createRequire(new URL('../../packages/sheet/package.json', import.meta.url));
const { build } = createRequire(sheetRequire.resolve('vite/package.json'))('esbuild');
await build({ entryPoints: [fileURLToPath(new URL('../../packages/sheet/src/rendering/engine/gridEngine.ts', import.meta.url))],
  outfile: fileURLToPath(new URL('./dist/engine.mjs', import.meta.url)), bundle: true, minify: true,
  sourcemap: true, format: 'esm', target: 'es2022' });
