// Live code blocks: a ```js live block in a page is shown as its code and as a working grid (LiveExample.vue).
//
// The block is a complete script a reader can copy: imports, then code that finds `#grid` and makes `grid`.
// Each block is also written to examples/live/<page>-<n>.js as a module the page runs:
//
//   <the block's imports>
//   export const source = '<the block>';
//   export default async function create(container, log) { <the rest, with #grid as `container`>; return grid; }
//
// `log` gets what the block passes to console.log, which LiveExample.vue shows under the grid.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'examples', 'live');
const FENCE = /^```js live([^\n]*)\n([\s\S]*?)^```$/gm;
const GRID = /document\.(?:getElementById\('grid'\)|querySelector\('#grid'\))/g;

/** The module name of a page's n-th live block: `guide-row-groups-0`. */
export const liveName = (relativePath, index) => `${relativePath.replace(/\.md$/, '').replace(/[^\w]+/g, '-')}-${index}`;

/** The options after `js live`: `height=300px`. */
export const liveOptions = info => Object.fromEntries([...info.matchAll(/(\w+)=(\S+)/g)].map(([, key, value]) => [key, value]));

/** A block's module (see the top of this file). */
export const liveModule = (code) => {
  const lines = code.replace(/\n$/, '').split('\n');
  const imports = lines.filter(line => line.startsWith('import '));
  const body = lines.filter(line => !line.startsWith('import ')).join('\n').replace(GRID, 'container').trim();

  if (!/\b(?:const|let) grid\b/.test(body)) {
    throw new Error(`A live block makes no \`grid\`:\n${code}`);
  }

  return [
    ...imports,
    '',
    `export const source = ${JSON.stringify(code)};`,
    '',
    'export default async function create(container, log = () => {}) {',
    // The block's console.log also shows under its grid.
    ...(/\bconsole\.log\(/.test(body) ? [
      '  const console = { ...globalThis.console, log: (...values) => { globalThis.console.log(...values); log(values); } };',
      '',
    ] : []),
    body.split('\n').map(line => (line ? `  ${line}` : line)).join('\n'),
    '',
    '  return grid;',
    '}',
    '',
  ].join('\n');
};

/** Writes the modules of one page's live blocks; returns their files. */
const writePage = (file) => {
  const relativePath = path.relative(ROOT, file).split(path.sep).join('/');
  const text = fs.readFileSync(file, 'utf8');
  const files = [];

  [...text.matchAll(FENCE)].forEach(([, , code], index) => {
    const target = path.join(OUT, `${liveName(relativePath, index)}.js`);
    const content = liveModule(code);

    files.push(target);
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      fs.writeFileSync(target, content);
    }
  });

  return files;
};

const pages = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
  const file = path.join(dir, entry.name);

  if (entry.isDirectory()) {
    return ['node_modules', '.vitepress', 'public', 'live'].includes(entry.name) ? [] : pages(file);
  }

  return entry.name.endsWith('.md') ? [file] : [];
});

/** Writes every page's live modules and removes the ones of blocks that are gone. */
export const writeLiveModules = () => {
  fs.mkdirSync(OUT, { recursive: true });
  const files = new Set(pages(ROOT).flatMap(writePage));

  fs.readdirSync(OUT).map(name => path.join(OUT, name)).filter(file => !files.has(file)).forEach(file => fs.rmSync(file));
};

/** The markdown-it part: a live block renders as the grid, then its code. */
export const liveBlocks = (md) => {
  const fence = md.renderer.rules.fence;
  const counts = new WeakMap();

  md.renderer.rules.fence = (tokens, idx, options, env, self) => {
    const token = tokens[idx];
    const match = /^js live(.*)$/.exec(token.info.trim());

    if (!match) {
      return fence(tokens, idx, options, env, self);
    }
    const index = counts.get(env) ?? 0;
    const { height } = liveOptions(match[1]);

    counts.set(env, index + 1);
    token.info = 'js';

    return `<LiveExample name="live/${liveName(env.relativePath, index)}"${height ? ` height="${height}"` : ''} />\n${
      fence(tokens, idx, options, env, self)}`;
  };
};

/** The Vite part: writes the modules before a build and again when a page changes in `vitepress dev`. */
export const livePlugin = () => ({
  name: 'freesheet-live-blocks',
  buildStart() {
    writeLiveModules();
  },
  handleHotUpdate({ file }) {
    // Pages only: not the built site's copies or the packages' Markdown.
    if (file.endsWith('.md') && file.startsWith(ROOT) && !/[\\/](\.vitepress|node_modules)[\\/]/.test(file)) {
      writePage(file);
    }
  },
});
