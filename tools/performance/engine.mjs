// Private fixed-cell engine comparison. This does not measure the production renderer or presentation latency.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { cpus } from 'node:os';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startServer, root } from '../engine-lab/serve.mjs';
const { values } = parseArgs({ options: {
  trials: { type: 'string', default: '5' }, warmup: { type: 'string', default: '1' },
  frames: { type: 'string', default: '30' },
  output: { type: 'string', default: fileURLToPath(new URL('./results/engine.json', import.meta.url)) },
} });
for (const key of ['trials', 'warmup', 'frames']) {
  if (!/^\d+$/.test(values[key]) || Number(values[key]) < (key === 'warmup' ? 0 : 1)) throw new Error(`Invalid ${key}`);
}
const playwright = createRequire(new URL('../../packages/sheet/package.json', import.meta.url))('playwright');
const server = await startServer();
const browser = await playwright.chromium.launch();
const hash = text => createHash('sha256').update(text).digest('hex');
const sources = {};
for (const file of ['dist/engine.mjs', 'app.mjs', 'index.html']) sources[file] = hash(await readFile(root + file));
const report = { complete: false, cpu: cpus()[0].model, node: process.version, browser: browser.version(),
  viewport: { width: 1400, height: 1000 }, dpr: 1, sources, config: values,
  definition: 'Canvas and minimal DOM painters in the same private TS engine. Fixed 28x130 cells, 64x30 headers, no frozen/rich cells. Generated values, sparse edits, external selection. Not production compatibility or a before/after production speed-up. Input timings bracket the synchronous engine keydown listener with trusted Playwright events; exclude presentation. CDP counters cover the whole scripted scroll sequence and overlap.', results: [] };
const cases = { small: [100, 20], tall10k: [10000, 20], tall100k: [100000, 20], tall1m: [1000000, 20], wide: [100, 5000] };
const settle = page => page.evaluate(async () => { for (let n = 0; n < 4; n++) await new Promise(requestAnimationFrame); });
const percentile = (items, p) => [...items].sort((a, b) => a - b)[Math.max(0, Math.ceil(items.length * p) - 1)];
const signatures = new Map();
await mkdir(fileURLToPath(new URL('./results', import.meta.url)), { recursive: true });
try {
  for (const [name, [rows, columns]] of Object.entries(cases)) {
    for (let trial = -Number(values.warmup); trial < Number(values.trials); trial++) {
      for (const painter of trial % 2 === 0 ? ['canvas', 'dom'] : ['dom', 'canvas']) {
        const page = await browser.newPage({ viewport: report.viewport, deviceScaleFactor: 1 });
        const errors = []; page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${server.url}/?${new URLSearchParams({ rows, columns, painter })}`); await settle(page);
        const client = await page.context().newCDPSession(page); await client.send('Performance.enable');
        const metrics = async () => Object.fromEntries((await client.send('Performance.getMetrics')).metrics.map(m => [m.name, m.value]));
        await page.evaluate(() => {
          const engine = window.engineLab.engine; const { maxLeft, maxTop } = engine.getScroll();
          engine.scroll(maxLeft / 2, maxTop / 2);
        }); await settle(page);
        const before = await metrics();
        const scrollDrawMs = await page.evaluate(async frames => {
          const engine = window.engineLab.engine; const { left, top } = engine.getScroll(); const samples = [];
          for (let i = 0; i <= frames; i++) {
            await new Promise(requestAnimationFrame);
            const step = i % 12 < 6 ? i % 6 : 6 - i % 6;
            const start = performance.now(); engine.scroll(left + step * 30, top + step * 14);
            samples.push(performance.now() - start);
          }
          for (let n = 0; n < 3; n++) await new Promise(requestAnimationFrame);
          return samples;
        }, Number(values.frames));
        const after = await metrics();
        const state = await page.evaluate(() => window.engineLab.snapshot());
        const signature = hash(JSON.stringify(state.scene));
        if (signatures.has(name)) assert.equal(signature, signatures.get(name), `Scene differs for ${name}`);
        signatures.set(name, signature);
        await page.evaluate(() => {
          const lab = window.engineLab;
          lab.engine.scroll(0, 0); lab.source.select({ row: 2, col: 2 }); lab.engine.draw(false);
          const root = lab.engine.element; let start;
          window.engineInputSamples = [];
          root.addEventListener('keydown', event => { if (event.isTrusted) start = performance.now(); }, true);
          // Registered after the engine's bubbling listener, so this observes its synchronous completion.
          root.addEventListener('keydown', event => {
            if (event.isTrusted) window.engineInputSamples.push({ key: event.key, ms: performance.now() - start });
          });
          root.focus();
        });
        const selectionBefore = await page.evaluate(() => ({ reads: window.engineLab.snapshot().reads, paints: window.engineLab.engine.metrics.paints }));
        for (let i = 0; i < 20; i++) { await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp'); }
        const selectionAfter = await page.evaluate(() => ({ reads: window.engineLab.snapshot().reads, paints: window.engineLab.engine.metrics.paints }));
        assert.deepEqual(selectionAfter, selectionBefore);
        for (let i = 0; i < 10; i++) { await page.keyboard.press('F2'); await page.keyboard.press('Escape'); }
        const input = await page.evaluate(() => window.engineInputSamples);
        assert.equal(input.length, 60); assert.deepEqual(errors, []);
        const counters = {};
        for (const key of ['TaskDuration', 'ScriptDuration', 'LayoutDuration', 'RecalcStyleDuration']) counters[key] = (after[key] - before[key]) * 1000;
        if (trial >= 0) {
          const result = { name, painter, trial, attachMs: state.attachMs, scrollDrawMs, counters, input,
            cells: state.metrics.cells, nodes: state.nodes, signature };
          report.results.push(result);
          console.log(JSON.stringify({ name, painter, trial, taskMs: counters.TaskDuration, scrollP95: percentile(scrollDrawMs, .95) }));
          await writeFile(values.output, JSON.stringify(report, null, 2));
        }
        await page.close();
      }
    }
  }
  report.complete = true; report.summary = [];
  for (const name of Object.keys(cases)) for (const painter of ['canvas', 'dom']) {
    const results = report.results.filter(r => r.name === name && r.painter === painter);
    const input = results.flatMap(r => r.input);
    const selection = input.filter(r => r.key.startsWith('Arrow')).map(r => r.ms);
    const edit = input.filter(r => r.key === 'F2').map(r => r.ms);
    report.summary.push({ name, painter, attachMedianMs: percentile(results.map(r => r.attachMs), .5),
      scrollSubmissionP95Ms: percentile(results.flatMap(r => r.scrollDrawMs), .95),
      taskMedianMs: percentile(results.map(r => r.counters.TaskDuration), .5),
      scriptMedianMs: percentile(results.map(r => r.counters.ScriptDuration), .5),
      layoutMedianMs: percentile(results.map(r => r.counters.LayoutDuration), .5),
      selectionP50Ms: percentile(selection, .5), selectionP95Ms: percentile(selection, .95), selectionP99Ms: percentile(selection, .99),
      editP50Ms: percentile(edit, .5), editP95Ms: percentile(edit, .95), editP99Ms: percentile(edit, .99),
      cells: results[0].cells, nodes: results[0].nodes });
  }
  await writeFile(values.output, JSON.stringify(report, null, 2));
} finally { await browser.close(); await server.close(); }
