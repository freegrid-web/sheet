import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { startServer, root } from './serve.mjs';
const { values } = parseArgs({ options: { browser: { type: 'string', default: 'chromium' } } });
if (!['chromium', 'firefox', 'webkit'].includes(values.browser)) throw new Error('Invalid browser');
const playwright = createRequire(new URL('../../packages/sheet/package.json', import.meta.url))('playwright');
const server = await startServer();
await mkdir(`${root}results`, { recursive: true });
const browser = await playwright[values.browser].launch();
const errors = [];
const checks = [];
const done = name => { checks.push(name); console.log(`PASS ${name}`); };
async function settle(page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame);
  });
}
const snapshot = page => page.evaluate(() => window.hybridLab.snapshot());
try {
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(server.url); await page.evaluate(() => window.hybridLab.ready); await settle(page);
  for (const renderer of ['canvas', 'dom']) {
    await page.evaluate(renderer => window.hybridLab.configure({ renderer }), renderer); await settle(page);
    let state = await snapshot(page);
    assert.ok(state.metrics.cells > 100 && state.metrics.cells < 300);
    assert.equal(state.components.active, state.hosts); assert.ok(state.hosts > 10 && state.hosts < 30);
    assert.equal(await page.locator('canvas').count(), renderer === 'canvas' ? 1 : 0);
    assert.equal(await page.locator('.editor').count(), 0);
    if (renderer === 'canvas') {
      assert.equal(await page.locator('canvas').evaluate(canvas => canvas.width),
        await page.locator('canvas').evaluate(canvas => Math.round(canvas.clientWidth * 2)));
    }
    done(`${renderer}: bounded visible cells, actual Vue hosts and high-DPI surface`);
    const vote = page.locator('.vote[data-id="0"]');
    await vote.click(); await vote.click(); assert.match(await vote.textContent(), /Vote 0: 2/);
    await page.evaluate(() => window.hybridLab.grid.scroll(2000, 6000)); await settle(page);
    state = await snapshot(page);
    const frozen = state.cells.find(cell => cell.row === 0 && cell.column === 0);
    assert.equal(frozen.x, 64); assert.equal(frozen.y, 30);
    assert.ok(state.components.unmounted > 0); assert.equal(state.components.active, state.hosts);
    await page.evaluate(() => window.hybridLab.grid.scroll(0, 0)); await settle(page);
    assert.match(await vote.textContent(), /Vote 0: 2/);
    // Record 3 leaves the viewport and remounts, retaining model state rather than component-local state.
    const vote3 = page.locator('.vote[data-id="3"]'); await vote3.click();
    await page.evaluate(() => window.hybridLab.grid.scroll(0, 6000)); await settle(page);
    assert.equal(await vote3.count(), 0);
    await page.evaluate(() => window.hybridLab.grid.scroll(0, 0)); await settle(page);
    assert.match(await vote3.textContent(), /Vote 3: 1/);
    done(`${renderer}: frozen panes, injected Vue context and offscreen unmount/remount state`);
    await page.evaluate(() => {
      const grid = window.hybridLab.grid; grid.focus = { row: 3, column: 3 }; grid.startEdit();
    });
    await page.locator('.editor').fill('saved by ID'); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.evaluate(() => window.hybridLab.grid.model.value(3, 3)), 'saved by ID');
    await page.keyboard.press('F2'); await page.locator('.editor').fill('cancelled'); await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => window.hybridLab.grid.model.value(3, 3)), 'saved by ID');
    await page.keyboard.press('F2'); await page.locator('.editor').fill('中文');
    await page.locator('.editor').evaluate(editor => editor.dispatchEvent(new KeyboardEvent('keydown',
      { key: 'Enter', isComposing: true, bubbles: true })));
    assert.equal(await page.locator('.editor').count(), 1); await page.keyboard.press('Escape');
    await page.evaluate(() => window.hybridLab.grid.sort()); await settle(page);
    assert.equal(await page.evaluate(() => window.hybridLab.grid.model.order[window.hybridLab.grid.focus.row]), 3);
    assert.equal(await page.evaluate(() => window.hybridLab.grid.model.value(3, 3)), 'saved by ID');
    assert.match(await vote3.textContent(), /Vote 3: 1/);
    done(`${renderer}: editing commit/cancel/composition guard and global sort keep the correct record`);
    const hostRect = await page.locator('.cell-host[data-key="3:1"]').boundingBox();
    assert.ok(hostRect.width > 100 && hostRect.height >= 28);
    await page.evaluate(() => {
      const grid = window.hybridLab.grid;
      grid.rows.resize(grid.focus.row, 60); grid.columns.resize(1, 180); grid.resize();
    }); await settle(page);
    const resized = await page.locator('.cell-host[data-key="3:1"]').boundingBox();
    assert.equal(resized.width, 180); assert.equal(resized.height, 60);
    // Pointer coordinates use the same clipped geometry as Canvas and DOM hosts.
    await page.evaluate(() => { window.hybridLab.grid.scroll(0, 0); }); await settle(page);
    const rect = await page.locator('.port').boundingBox();
    const cell = (await snapshot(page)).cells.find(cell => cell.row === 0 && cell.column === 0);
    await page.mouse.dblclick(rect.x + cell.x + 12, rect.y + cell.y + 12);
    assert.equal(await page.locator('.editor').count(), 1); await page.keyboard.press('Escape');
    await page.evaluate(() => { document.querySelector('#grid').style.width = '800px'; }); await settle(page);
    assert.ok((await snapshot(page)).metrics.cells < 300);
    done(`${renderer}: resize, pointer editing and host alignment`);
    await page.evaluate(() => { const grid = window.hybridLab.grid; grid.focus = { row: 99999, column: 199 }; grid.reveal(); });
    await settle(page); state = await snapshot(page);
    assert.ok(state.cells.some(cell => cell.row === 99999 && cell.column === 199));
    await page.screenshot({ path: `${root}results/${values.browser}-${renderer}.png` });
    const counts = await page.evaluate(() => { const grid = window.hybridLab.grid; grid.destroy(); return grid.components.counts; });
    assert.equal(counts.active, 0); assert.equal(counts.mounted, counts.unmounted);
    await page.waitForTimeout(1100);
    assert.equal(await page.evaluate(() => window.hybridLab.grid.components.counts.ticks), counts.ticks);
    assert.equal(await page.locator('#grid *').count(), 0);
    done(`${renderer}: last-cell reachability and complete Vue/timer/DOM cleanup`);
    await page.evaluate(() => { document.querySelector('#grid').style.width = ''; });
  }
  await page.evaluate(() => window.hybridLab.configure({ rows: 1000000, columns: 5000, frozenRows: 0, frozenColumns: 0 }));
  await settle(page);
  await page.evaluate(() => { const grid = window.hybridLab.grid; grid.focus = { row: 999999, column: 4999 }; grid.reveal(); });
  await settle(page);
  assert.ok((await snapshot(page)).cells.some(cell => cell.row === 999999 && cell.column === 4999));
  assert.ok((await snapshot(page)).nodes < 1000);
  done('million-row / 5000-column logical range, no frozen panes, bounded viewport');
  assert.deepEqual(errors, []);
  await writeFile(`${root}results/verify-${values.browser}.json`, JSON.stringify({ browser: browser.version(), checks, complete: true }, null, 2));
} finally { await browser.close(); await server.close(); }
