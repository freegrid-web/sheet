import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const sheetRequire = createRequire(new URL('../../packages/sheet/package.json', import.meta.url));
const { build } = createRequire(sheetRequire.resolve('vite/package.json'))('esbuild');
for (const [entry, output] of [['gridEngine', 'engine'], ['coreBridge', 'coreBridge']]) {
  await build({ entryPoints: [fileURLToPath(new URL(`../../packages/sheet/src/rendering/engine/${entry}.ts`, import.meta.url))],
    outfile: fileURLToPath(new URL(`./dist/${output}.mjs`, import.meta.url)), bundle: true, minify: true,
    sourcemap: true, format: 'esm', target: 'es2022' });
}
