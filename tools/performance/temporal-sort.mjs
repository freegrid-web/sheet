// MIT. Measure date/time sorting through the built grid, including row-key preparation and rendering.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { configuration, distribution, metadata, save, sheet } from './common.mjs';
import { startServer } from '../../packages/sheet/test/runner/server.js';

const config = { ...configuration('browser'), scenario: 'temporal-sort', columns: 3 };
const evidence = { ...metadata(config, ['dist/freesheet.full.min.js', 'dist/freesheet.full.min.css']),
  kind: 'temporal-sort', settings: { width: 1000, height: 600, rowHeights: 23, colWidths: 120,
    autoRowSize: false, autoColumnSize: false, observeChanges: false,
    dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm:ss' }, results: [] };
const { chromium } = createRequire(resolve(sheet, 'package.json'))('playwright');
const server = await startServer(sheet, { '/temporal-sort.html': '<link rel="stylesheet" href="/dist/freesheet.full.min.css"><script src="/dist/freesheet.full.min.js"></script><div id="grid"></div>' });
let browser;
try {
  browser = await chromium.launch({ ignoreDefaultArgs: ['--hide-scrollbars'] });
  evidence.browser = browser.version();
  for (const rows of config.rows) for (const type of ['date', 'time']) {
    const samples = [];
    for (let trial = -config.warmup; trial < config.trials; trial++) {
      const page = await browser.newPage({ viewport: { width: 1200, height: 1000 }, deviceScaleFactor: 1 });
      const watchdog = setTimeout(() => page.close().catch(() => {}), 120000);
      try {
        await page.goto(`${server.url}/temporal-sort.html`);
        await page.evaluate(({ rows, type }) => {
          // Deterministic shuffled keys, repeated times and stable row identities; data creation is untimed.
          let seed = 314159;
          const indexes = Array.from({ length: rows }, (_, index) => index);
          for (let index = rows - 1; index > 0; index--) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            const other = seed % (index + 1);
            [indexes[index], indexes[other]] = [indexes[other], indexes[index]];
          }
          const pad = value => String(value).padStart(2, '0');
          window.sortData = indexes.map(index => {
            const key = type === 'date' ? index : index % 86400;
            const date = new Date(Date.UTC(1900, 0, 1 + key));
            const value = type === 'date'
              ? `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`
              : `${pad(Math.floor(key / 3600))}:${pad(Math.floor(key / 60) % 60)}:${pad(key % 60)}`;
            return [value, key, index];
          });
          window.sortGrid = new window.FreeSheet(document.getElementById('grid'), {
            data: window.sortData, width: 1000, height: 600,
            rowHeights: 23, colWidths: 120, autoRowSize: false, autoColumnSize: false,
            observeChanges: false, columnSorting: true,
            columns: [{ type, dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm:ss' }, {}, {}],
          });
        }, { rows, type });
        await page.waitForTimeout(200);
        const result = await page.evaluate(() => {
          const grid = window.sortGrid;
          const start = performance.now();
          grid.getPlugin('columnSorting').sort({ column: 0, sortOrder: 'asc' });
          const synchronousMs = performance.now() - start;
          const sorted = grid.getData();
          const expected = [...window.sortData].sort((a, b) => a[1] - b[1]);
          const correct = sorted.every((row, index) => row[2] === expected[index][2]);
          grid.destroy();
          return { synchronousMs, correct, count: sorted.length };
        });
        assert.equal(result.correct, true);
        assert.equal(result.count, rows);
        if (trial >= 0) samples.push(result.synchronousMs);
      } finally {
        clearTimeout(watchdog);
        await page.close();
      }
    }
    const result = { rows, type, samplesMs: samples, summaryMs: distribution(samples) };
    evidence.results.push(result);
    save(config.output, evidence);
    console.log(JSON.stringify(result));
  }
  save(config.output, { ...evidence, complete: true });
} finally {
  await browser?.close();
  await server.close();
}
