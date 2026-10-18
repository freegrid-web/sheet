// Smoke test for the built docs site: every example page renders its live grid without console errors.
// Usage: pnpm build (FreeSheet) && pnpm --filter @freegrid/docs build && node test/smoke.js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = '/sheet/';
const dist = fileURLToPath(new URL('../.vitepress/dist', import.meta.url));
const PAGES = [
  { path: '', grids: 1 },
  { path: 'guide/getting-started.html', grids: 1 },
  { path: 'examples/basics.html', grids: 1 },
  { path: 'examples/cell-types.html', grids: 1 },
  { path: 'examples/merged-cells-and-comments.html', grids: 1 },
  { path: 'examples/large-data.html', grids: 1 },
  { path: 'examples/search-and-languages.html', grids: 1 },
  { path: 'examples/formulas.html', grids: 1 },
  { path: 'guide/formulas.html', grids: 0 },
  { path: 'examples/sheets.html', grids: 1 },
  { path: 'examples/budget.html', grids: 1 },
  { path: 'guide/sheets.html', grids: 0 },
  { path: 'examples/hidden-rows-and-columns.html', grids: 1 },
  { path: 'guide/hidden-rows-and-columns.html', grids: 0 },
  { path: 'examples/filters.html', grids: 1 },
  { path: 'guide/filters.html', grids: 0 },
  { path: 'examples/nested-rows.html', grids: 1 },
  { path: 'examples/row-groups.html', grids: 1 },
  { path: 'guide/nested-rows.html', grids: 0 },
  { path: 'guide/row-groups.html', grids: 0 },
  { path: 'examples/column-groups.html', grids: 1 },
  { path: 'guide/column-groups.html', grids: 0 },
  { path: 'examples/conditional-formatting.html', grids: 1 },
  { path: 'guide/conditional-formatting.html', grids: 0 },
  { path: 'guide/side-panel.html', grids: 0 },
  { path: 'examples/files.html', grids: 1 },
  { path: 'examples/formatting.html', grids: 1 },
  { path: 'guide/files.html', grids: 0 },
  { path: 'guide/data-validation.html', grids: 0 },
  { path: 'guide/context-menu.html', grids: 0 },
  { path: 'guide/hyperlinks.html', grids: 0 },
  { path: 'guide/change-history.html', grids: 0 },
  { path: 'guide/status-bar-and-freezing.html', grids: 0 },
  { path: 'guide/find-and-replace.html', grids: 0 },
  { path: 'guide/fill-and-paste.html', grids: 0 },
  { path: 'guide/theming.html', grids: 1 },
  { path: 'guide/data-and-events.html', grids: 0 },
  { path: 'api/methods.html', grids: 0 },
  { path: 'api/events.html', grids: 0 },
  { path: 'api/settings.html', grids: 0 },
  { path: 'api/plugins.html', grids: 0 },
];
// The API reference must be complete (it is generated from the source code; a broken parser would give empty pages).
const API_ENTRIES = { 'api/methods.html': 90, 'api/events.html': 120, 'api/settings.html': 100, 'api/plugins.html': 150 };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2' };

if (!existsSync(dist)) {
  console.error('Docs are not built: run `pnpm --filter @freegrid/docs build` first.');
  process.exit(1);
}

// Every other guide page too: its live examples (```js live blocks) must render.
for (const file of readdirSync(join(dist, 'guide')).filter(name => name.endsWith('.html'))) {
  if (!PAGES.some(page => page.path === `guide/${file}`)) PAGES.push({ path: `guide/${file}`, grids: 0 });
}
// Every example page has its grid; the gallery and the demo's code page have none.
for (const file of readdirSync(join(dist, 'examples')).filter(name => name.endsWith('.html'))) {
  if (!PAGES.some(page => page.path === `examples/${file}`)) {
    PAGES.push({ path: `examples/${file}`, grids: ['index.html', 'demo-source.html'].includes(file) ? 0 : 1 });
  }
}
// The full demo: one document of three sheets, each with a formula bar, only the active one shown.
PAGES.push({ path: 'demo.html', grids: 0 });

// Serves the built site under BASE, like GitHub Pages (including `/x` → `/x.html`).
const server = createServer(async(req, res) => {
  let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);

  if (!path.startsWith(BASE)) {
    res.writeHead(404).end();
    return;
  }
  path = path.slice(BASE.length) || 'index.html';
  if (path.endsWith('/')) path += 'index.html';
  let file = normalize(join(dist, path));

  if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  let body;

  try {
    body = await readFile(file);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' }).end(body);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch();
const failures = [];

// Every page in the docs' dark and light appearance (live examples follow it: fs-theme-dark in dark only), with the
// Modern and the Classic grid style (the Grid switch in the top bar).
for (const style of ['modern', 'classic']) for (const appearance of ['dark', 'light']) for (const { path, grids } of PAGES) {
  const page = await browser.newPage({ colorScheme: appearance, viewport: { width: 1600, height: 900 } });

  await page.addInitScript(([value, gridStyle]) => {
    localStorage.setItem('vitepress-theme-appearance', value);
    localStorage.setItem('freesheet-docs-grid-style', gridStyle);
  }, [appearance, style]);
  const errors = [];

  page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
  await page.goto(`${origin}${BASE}${path}`);
  // Every live example of the page renders (the pages' ```js live blocks too), at least `grids`.
  await page.waitForLoadState('load');
  const frames = await page.locator('.live-example').count();
  const expected = Math.max(grids, frames);

  if (expected > 0) {
    await page.waitForFunction(count => [...document.querySelectorAll('.live-example, .theme-playground')]
      .filter(el => el.querySelector('.htCore')).length >= count, expected, { timeout: 10000 }).catch(() => {});
  }
  const rendered = await page.locator('.live-example, .theme-playground').evaluateAll(els => els.filter(el => el.querySelector('.htCore')).length);
  // The formulas example loads IronCalc: Apples' total (=B2*C2) shows its result.
  if (path === 'examples/formulas.html' &&
    !(await page.locator('.live-example .ht_master td').allTextContents()).includes('12')) {
    failures.push(`${path}: the formula =B2*C2 does not show 12`);
  }
  // The sheets examples show their tabs.
  if (path.startsWith('examples/sheets') || path.startsWith('examples/budget')) {
    const tabs = await page.locator('.live-example .fs-sheet-tab').count();

    if (tabs < 3) failures.push(`${path}: ${tabs} sheet tabs, expected 3`);
  }
  // The docs theme must not restyle the grid: tables keep `display: table`, rows keep FreeSheet's height
  // (--fs-row-height, plus the first row's top border) and the grid's viewport shows more than a sliver.
  const layoutProblems = await page.locator('.live-example, .theme-playground').evaluateAll(els => els.flatMap((el) => {
    // The visible sheet's grid (a document with several sheets hides the others).
    const master = Array.from(el.querySelectorAll('.ht_master')).find(node => node.offsetParent !== null);
    const table = master && master.querySelector('table.htCore');
    // A cell without a font size of its own (a bigger font makes its row taller, as it should).
    const cell = master && Array.from(master.querySelectorAll('td')).find(td => !td.style.fontSize && !td.closest('tr').querySelector('td[style*="font-size"]'));
    const holder = master && master.querySelector('.wtHolder');

    if (!table || !cell || !holder) return [];
    const problems = [];

    if (getComputedStyle(table).display !== 'table') problems.push(`table display is ${getComputedStyle(table).display}`);
    const rowHeight = parseInt(getComputedStyle(cell).getPropertyValue('--fs-row-height'), 10);

    if (Math.abs(cell.getBoundingClientRect().height - rowHeight) > 1) {
      problems.push(`row height is ${cell.getBoundingClientRect().height}px, --fs-row-height is ${rowHeight}px`);
    }
    // A small grid may be short, but never shorter than its rows (or 80px).
    const needed = Math.min(80, table.getBoundingClientRect().height);

    if (holder.getBoundingClientRect().height < needed - 1) problems.push(`grid viewport is ${holder.getBoundingClientRect().height}px tall`);
    // Text must stay readable on the cell background in the light and the dark theme (WCAG AA: 4.5:1).
    const luminance = (color) => {
      const [r, g, b] = color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
        .map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });

      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const [lighter, darker] = [luminance(getComputedStyle(cell).color), luminance(getComputedStyle(cell).backgroundColor)]
      .sort((a, b) => b - a);
    const contrast = (lighter + 0.05) / (darker + 0.05);

    if (contrast < 4.5) problems.push(`cell text ${getComputedStyle(cell).color} on ${getComputedStyle(cell).backgroundColor} has contrast ${contrast.toFixed(1)}`);
    if (holder.getBoundingClientRect().right > el.getBoundingClientRect().right + 1) problems.push('grid viewport overflows its frame');
    return problems;
  }));

  if (API_ENTRIES[path]) {
    const entries = await page.locator('.vp-doc h3[id]').count();

    if (entries < API_ENTRIES[path]) failures.push(`${path}: ${entries} entries, expected at least ${API_ENTRIES[path]}`);
    // The right-hand index lists every entry of the page, alphabetically in each group (plugin methods by plugin).
    const groups = await page.locator('.related-api--aside .related-api__group')
      .evaluateAll(els => els.map(el => [...el.querySelectorAll('li')].map(li => li.textContent.trim())));
    const listed = groups.flat().length;

    if (listed < entries) failures.push(`${path}: the index lists ${listed} of ${entries} entries`);
    groups.forEach((group) => {
      const sorted = [...group].sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));

      if (group.join() !== sorted.join()) failures.push(`${path}: an index group is not in alphabetical order`);
    });
  }
  if (path === 'guide/data-and-events.html') {
    // Every "Related API" link leads to an entry of the reference.
    const links = await page.locator('.related-api--aside a').evaluateAll(els => els.map(el => el.getAttribute('href')));

    if (links.length < 30) failures.push(`${path}: "Related API" has ${links.length} links`);
    for (const href of links.slice(0, 5).concat(links.slice(-5))) {
      const target = await browser.newPage();

      await target.goto(`${origin}${href}`);
      if (!await target.locator(`[id="${href.split('#')[1]}"]`).count()) failures.push(`${path}: dead link ${href}`);
      await target.close();
    }
  }
  // A guide page ends with the API of its topics: Row groups has the settings and both plugins' methods.
  if (path === 'guide/row-groups.html') {
    const entries = await page.locator('.api-block dt a').evaluateAll(els => els.map(el => el.textContent));

    ['rowGroups: Boolean|Object', 'groupRows(from, to)', 'groupColumns(from, to?)'].forEach((entry) => {
      if (!entries.includes(entry)) failures.push(`${path}: the API block has no ${entry}`);
    });
  }
  if (path === 'demo.html') {
    await page.waitForSelector('.demo-app .htCore', { timeout: 15000 }).catch(() => {});
    const tabs = await page.locator('.demo-app .fs-sheet-tab').count();
    const bars = await page.locator('.demo-app .fs-formula-bar').evaluateAll(els => els.filter(el => el.offsetParent).length);
    const fills = await page.locator('.demo-app').evaluate(el => el.getBoundingClientRect().bottom - window.innerHeight);

    if (tabs !== 3) failures.push(`${path}: ${tabs} sheet tabs, expected 3`);
    if (bars !== 1) failures.push(`${path}: ${bars} visible formula bars, expected 1`);
    if (Math.abs(fills) > 1) failures.push(`${path}: the demo ends ${fills}px from the window's bottom`);
  }
  if (path === 'guide/theming.html') {
    const rows = await page.locator('table.theming-variables tbody tr').count();

    if (rows < 50) failures.push(`${path}: the variable tables have ${rows} rows`);
  }
  const wrongTheme = await page.locator('.live-example').evaluateAll((els, dark) => els
    .filter(el => el.classList.contains('fs-theme-dark') !== dark).length, appearance === 'dark');

  if (wrongTheme) failures.push(`${path || '/'} (${appearance}): ${wrongTheme} live example(s) with the wrong theme`);
  const wrongStyle = await page.locator('.live-example').evaluateAll((els, gridStyle) => els
    .filter(el => el.getAttribute('data-fs-style') !== gridStyle).length, style);

  if (wrongStyle) failures.push(`${path || '/'} (${style}): ${wrongStyle} live example(s) without the ${style} style`);
  // The isolation of theme styles must not break the theme itself, e.g. the home page content width.
  if (path === '') {
    const contentWidth = await page.evaluate(() => document.querySelector('.VPHomeContent .vp-doc')?.getBoundingClientRect().width);

    if (!contentWidth || contentWidth > 1152) failures.push(`/: home content is ${contentWidth}px wide (theme max is 1152px)`);
  }
  // Scrolled past an example, the top bar stays on top: the grid's sticky header (fixed, z-index 101) goes under it.
  if (rendered) {
    const coveredNav = await page.evaluate(async() => {
      const example = document.querySelector('.live-example, .theme-playground');
      const left = example.getBoundingClientRect().left + 60;

      window.scrollBy(0, example.getBoundingClientRect().top + 40);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const hit = document.elementFromPoint(left, 30);

      window.scrollTo(0, 0);
      return hit?.closest('.live-example, .theme-playground') ? hit.className || hit.tagName : null;
    });

    if (coveredNav) failures.push(`${path || '/'}: a live example covers the top bar (${coveredNav})`);
  }
  if (rendered < expected) failures.push(`${path || '/'}: expected ${expected} live grid(s), found ${rendered}`);
  // Each example has its Copy and Open in playground buttons.
  const actions = await page.locator('.live-example .live-example__actions button').count();

  if (actions !== frames * 2) failures.push(`${path || '/'}: ${actions} example buttons for ${frames} example(s)`);
  layoutProblems.forEach(p => failures.push(`${path || '/'}: ${p}`));
  errors.forEach(e => failures.push(`${path || '/'}: ${e}`));
  console.log(`${failures.length ? '…' : '✓'} ${path || '/'} [${style}, ${appearance}] (${rendered} grid(s))`);
  await page.close();
}

await browser.close();
server.close();
if (failures.length) {
  console.log(`\nFAILED:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log('\nDocs smoke test passed.');
