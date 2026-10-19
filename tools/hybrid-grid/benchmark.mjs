import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { startServer, root, vueFile } from './serve.mjs';
const { values } = parseArgs({ options: {
  trials: { type: 'string', default: '5' }, warmup: { type: 'string', default: '1' },
  frames: { type: 'string', default: '40' }, output: { type: 'string', default: `${root}results/benchmark.json` },
} });
for (const name of ['trials', 'warmup', 'frames']) {
  if (!/^\d+$/.test(values[name]) || Number(values[name]) < (name === 'warmup' ? 0 : 1)) throw new Error(`Invalid ${name}`);
}
const playwright = createRequire(new URL('../../packages/sheet/package.json', import.meta.url))('playwright');
const server = await startServer();
const browser = await playwright.chromium.launch();
await mkdir(`${root}results`, { recursive: true });
const percentile = (items, p) => [...items].sort((a, b) => a - b)[Math.max(0, Math.ceil(items.length * p) - 1)];
const hash = body => createHash('sha256').update(body).digest('hex');
const sources = {};
for (const file of (await readdir(root)).filter(file => /\.(mjs|css|html)$/.test(file))) sources[file] = hash(await readFile(root + file));
sources.vue = hash(await readFile(vueFile));
const report = { complete: false, browser: browser.version(), node: process.version, cpu: cpus()[0].model,
  viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1, config: values, sources,
  definition: 'Generated values, actual Vue components, variable sizes, 2 frozen rows/columns; shared model/controller. Scripted RAF sequence, not trusted input-to-display latency. CDP counters overlap. JS heap excludes total DOM/native/GPU memory.', results: [] };
const cases = { small: [100, 20], tall100k: [100000, 20], tall1m: [1000000, 20], wide: [100, 5000] };
const signatures = new Map();
try {
  for (const [name, [rows, columns]] of Object.entries(cases)) {
    for (const rich of [false, true]) {
      for (let trial = -Number(values.warmup); trial < Number(values.trials); trial++) {
        // Reverse the pair order on every fresh-page trial.
        for (const renderer of trial % 2 === 0 ? ['canvas', 'dom'] : ['dom', 'canvas']) {
          const page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: 1 });
          const errors = []; page.on('pageerror', error => errors.push(error.message));
          await page.goto(`${server.url}?${new URLSearchParams({ renderer, rows, columns, rich: rich ? '1' : '0' })}`);
          await page.evaluate(() => window.hybridLab.ready);
          const client = await page.context().newCDPSession(page); await client.send('Performance.enable');
          const initial = await page.evaluate(() => ({ readyMs: window.hybridLab.snapshot().metrics.readyMs }));
          await page.evaluate(async () => {
            const grid = window.hybridLab.grid;
            grid.scroll(grid.xAxis.logicalMax, grid.yAxis.logicalMax);
            for (let n = 0; n < 4; n++) await new Promise(requestAnimationFrame);
          });
          const last = await page.evaluate(() => window.hybridLab.snapshot());
          assert.ok(last.cells.some(cell => cell.row === rows - 1 && cell.column === columns - 1));
          await page.evaluate(async () => {
            const grid = window.hybridLab.grid; grid.scroll(grid.xAxis.logicalMax / 2, grid.yAxis.logicalMax / 2);
            for (let n = 0; n < 4; n++) await new Promise(requestAnimationFrame);
            grid.metrics.draws = [];
          });
          const metrics = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
          const before = await metrics();
          const frames = await page.evaluate(async count => {
            const grid = window.hybridLab.grid; const left = grid.left; const top = grid.top;
            const gaps = []; let previous;
            for (let index = 0; index <= count; index++) {
              const now = await new Promise(requestAnimationFrame);
              if (previous !== undefined) gaps.push(now - previous); previous = now;
              // Oscillate in both axes without hitting a small-case boundary.
              const step = index % 12 < 6 ? index % 6 : 6 - index % 6;
              grid.scroll(left + step * 30, top + step * 14);
            }
            for (let n = 0; n < 3; n++) await new Promise(requestAnimationFrame);
            return gaps;
          }, Number(values.frames));
          const after = await metrics();
          const state = await page.evaluate(() => window.hybridLab.snapshot());
          assert.equal(state.components.active, state.hosts);
          const signature = hash(JSON.stringify(state.cells));
          const signatureKey = `${name}:${rich}`;
          if (signatures.has(signatureKey)) assert.equal(signature, signatures.get(signatureKey));
          signatures.set(signatureKey, signature);
          const sortMs = await page.evaluate(async () => {
            const start = performance.now(); window.hybridLab.grid.sort();
            const synchronousMs = performance.now() - start;
            for (let n = 0; n < 4; n++) await new Promise(requestAnimationFrame);
            return synchronousMs;
          });
          const counters = {};
          for (const key of ['ScriptDuration', 'TaskDuration', 'LayoutDuration', 'RecalcStyleDuration']) counters[key] = (after[key] - before[key]) * 1000;
          assert.deepEqual(errors, []);
          if (trial >= 0) {
            const result = { name, rich, renderer, trial, readyMs: initial.readyMs, sortMs,
              drawP95Ms: percentile(state.metrics.draws, .95), frames, counters, nodes: state.nodes,
              cells: state.metrics.cells, hosts: state.hosts, signature };
            report.results.push(result); console.log(JSON.stringify({ ...result, frames: undefined, signature: undefined }));
            await writeFile(values.output, JSON.stringify(report, null, 2));
          }
          await page.close();
        }
      }
    }
  }
  report.complete = true;
  report.summary = [];
  for (const name of Object.keys(cases)) for (const rich of [false, true]) for (const renderer of ['canvas', 'dom']) {
    const results = report.results.filter(row => row.name === name && row.rich === rich && row.renderer === renderer);
    const median = fn => percentile(results.map(fn), .5);
    report.summary.push({ name, rich, renderer, readyMedianMs: median(row => row.readyMs),
      readyRangeMs: [Math.min(...results.map(row => row.readyMs)), Math.max(...results.map(row => row.readyMs))],
      drawP95MedianMs: median(row => row.drawP95Ms), frameP95Ms: percentile(results.flatMap(row => row.frames), .95),
      taskMedianMs: median(row => row.counters.TaskDuration), scriptMedianMs: median(row => row.counters.ScriptDuration),
      layoutMedianMs: median(row => row.counters.LayoutDuration), styleMedianMs: median(row => row.counters.RecalcStyleDuration),
      nodes: results[0].nodes, cells: results[0].cells, hosts: results[0].hosts });
  }
  await writeFile(values.output, JSON.stringify(report, null, 2));
} finally { await browser.close(); await server.close(); }
