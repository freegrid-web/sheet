import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { startServer } from './serve.mjs';
const { values } = parseArgs({ options: { browser: { type: 'string', default: 'chromium' } } });
if (!['chromium', 'firefox', 'webkit'].includes(values.browser)) throw new Error('Invalid browser');
const playwright = createRequire(new URL('../../packages/sheet/package.json', import.meta.url))('playwright');
const server = await startServer();
const browser = await playwright[values.browser].launch();
const errors = [];
const settle = page => page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
const snapshot = page => page.evaluate(() => window.engineLab.snapshot());
let checks = 0;
function done(name) { checks++; console.log(`PASS ${name}`); }
try {
  for (const painter of ['canvas', 'dom']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 2 });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${server.url}/?painter=${painter}&rows=1000000&columns=5000`); await settle(page);
    let state = await snapshot(page);
    assert.ok(state.metrics.cells > 100 && state.metrics.cells < 300);
    assert.ok(state.nodes < 400);
    if (painter === 'canvas') assert.equal(await page.locator('canvas').evaluate(c => c.width),
      await page.locator('canvas').evaluate(c => Math.round(c.clientWidth * 2)));
    done(`${painter}: bounded scene, DOM and high-DPI backing`);
    const bounds = await page.locator('.engine-viewport').boundingBox();
    await page.mouse.click(bounds.x + 64 + 130 + 20, bounds.y + 30 + 28 + 10);
    state = await snapshot(page); assert.deepEqual(state.selection, { row: 1, col: 1 });
    const reads = state.reads; const paints = state.metrics.paints;
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight');
    state = await snapshot(page); assert.deepEqual(state.selection, { row: 2, col: 2 });
    assert.equal(state.reads, reads); assert.equal(state.metrics.paints, paints);
    done(`${painter}: trusted pointer and arrows change selection without repaint/value reads`);
    await page.keyboard.press('F2'); assert.equal(await page.locator('textarea').count(), 1);
    await page.locator('textarea').fill('saved'); await page.keyboard.press('Enter');
    state = await snapshot(page); assert.ok(state.edits.some(([key, value]) => key === '2:2' && value === 'saved'));
    assert.equal(state.editing, false); assert.equal(state.scene.cells.find(c => c.row === 2 && c.col === 2).text, 'saved');
    await page.keyboard.press('F2'); await page.locator('textarea').fill('cancelled'); await page.keyboard.press('Escape');
    assert.equal((await snapshot(page)).scene.cells.find(c => c.row === 2 && c.col === 2).text, 'saved');
    done(`${painter}: native editor commit, cancel and visible data invalidation`);
    await page.keyboard.press('x'); assert.equal(await page.locator('textarea').inputValue(), 'x');
    await page.locator('textarea').evaluate(editor => editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await page.keyboard.press('Enter'); assert.equal(await page.locator('textarea').count(), 1);
    const compositionValue = await page.locator('textarea').inputValue();
    assert.ok(compositionValue.startsWith('x'));
    await page.evaluate(() => window.engineLab.engine.scroll(10000, 10000)); await settle(page);
    assert.equal(await page.locator('textarea').count(), 1);
    await page.locator('textarea').evaluate(editor => editor.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })));
    assert.equal(await page.locator('textarea').count(), 0);
    assert.ok((await snapshot(page)).edits.some(([key, value]) => key === '2:2' && value === compositionValue));
    done(`${painter}: composition guard and scroll-out commit policy (not a real IME test)`);
    await page.evaluate(() => {
      window.engineLab.source.select({ row: 999999, col: 4999 });
      window.engineLab.engine.scrollViewport({ row: 999999, col: 4999 });
    }); await settle(page);
    state = await snapshot(page);
    assert.equal(state.scroll.top, state.scroll.maxTop); assert.equal(state.scroll.left, state.scroll.maxLeft);
    assert.ok(state.scene.cells.some(c => c.row === 999999 && c.col === 4999));
    assert.equal(await page.evaluate(() => window.engineLab.engine.scrollViewport({ row: -1, col: 0 })), false);
    assert.equal(await page.evaluate(() => window.engineLab.engine.scrollViewport({ row: 999999, col: 4999 })), false);
    done(`${painter}: million-row/five-thousand-column endpoints and invalid reveal`);
    await page.evaluate(() => {
      window.engineLab.source.select({ row: 800001, col: 100 });
      window.engineLab.engine.scroll(0, 0); window.engineLab.engine.beginEdit();
    });
    assert.equal(await page.locator('textarea').count(), 1, 'revealed deep cell keeps its editor');
    await page.keyboard.press('Escape');
    done(`${painter}: editor reveal at a compressed-scroll boundary`);
    const snapped = await page.evaluate(() => {
      const engine = window.engineLab.engine;
      engine.scrollViewport({ row: 700000, col: 80 }, false, true, true, false);
      return engine.getCellRect({ row: 700000, col: 80 });
    });
    assert.ok(Math.abs(snapped.x + snapped.width - state.scene.width) < 4);
    assert.ok(Math.abs(snapped.y + snapped.height - state.scene.height) < 4);
    done(`${painter}: explicit bottom/right reveal from a later cell`);
    await page.evaluate(() => { document.querySelector('#grid').style.width = '700px'; document.querySelector('#grid').style.height = '400px'; });
    await settle(page); state = await snapshot(page); assert.ok(state.scene.width <= 700 && state.scene.height <= 400);
    assert.ok(state.metrics.cells < 150);
    await page.evaluate(() => { window.engineLab.engine.scroll(0, 0); window.engineLab.source.select({ row: 0, col: 0 }); window.engineLab.engine.draw(false); });
    await page.locator('.engine-viewport').focus(); await page.keyboard.press('F2');
    await page.locator('textarea').fill('scroll commit');
    await page.evaluate(() => window.engineLab.engine.element.addEventListener('wheel', event => {
      window.deliveredWheel = { dy: event.deltaY, trusted: event.isTrusted, mode: event.deltaMode };
    }, { once: true, capture: true }));
    await page.mouse.move(bounds.x + 300, bounds.y + 200); await page.mouse.wheel(0, 500); await settle(page);
    const wheel = await page.evaluate(() => window.deliveredWheel);
    assert.equal(wheel.trusted, true); assert.equal(wheel.mode, 0); assert.ok(wheel.dy > 0);
    state = await snapshot(page); assert.ok(Math.abs(state.scroll.top - wheel.dy) < 1, `wheel distance was ${state.scroll.top}`); assert.equal(state.editing, false);
    assert.ok(state.edits.some(([key, value]) => key === '0:0' && value === 'scroll commit'));
    done(`${painter}: resize, trusted wheel and non-composing scroll-out commit`);
    const backingReleased = await page.evaluate(() => {
      const engine = window.engineLab.engine; const canvas = engine.element.querySelector('canvas');
      engine.element.dispatchEvent(new Event('scroll')); engine.destroy(); engine.destroy();
      return !canvas || (canvas.width === 0 && canvas.height === 0);
    });
    assert.equal(backingReleased, true); await settle(page);
    assert.equal(await page.locator('#grid *').count(), 0);
    await page.evaluate(() => window.engineLab.configure('canvas')); await settle(page);
    assert.ok((await snapshot(page)).metrics.cells > 0);
    done(`${painter}: pending-frame teardown, idempotent destroy and remount`);
    const independent = await page.evaluate(async () => {
      const first = window.engineLab.engine; const host = document.createElement('div');
      host.style.cssText = 'width:400px;height:240px'; document.body.append(host);
      let selected = { row: 0, col: 0 };
      const source = { readCell: () => 'second', writeCell: () => {},
        getSelection: () => selected, select: address => { selected = address; } };
      const second = new first.constructor(host, source, { rows: 100, columns: 10, painter: 'canvas' });
      first.destroy(); second.element.focus();
      second.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
      const result = { selected, cells: second.metrics.cells }; second.destroy(); host.remove();
      for (let i = 0; i < 10; i++) window.engineLab.configure('canvas');
      return { ...result, instances: document.querySelectorAll('.engine-viewport').length };
    });
    assert.deepEqual(independent.selected, { row: 1, col: 0 });
    assert.ok(independent.cells > 0); assert.equal(independent.instances, 1);
    done(`${painter}: independent instances and ten create/destroy cycles`);
    await page.close();
  }
  assert.deepEqual(errors, []); console.log(`${values.browser}: ${checks} check groups passed`);
} finally { await browser.close(); await server.close(); }
