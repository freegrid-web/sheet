import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { parseArgs } from 'node:util';
import { startServer } from './serve.mjs';
const { values } = parseArgs({ options: { browser: { type: 'string', default: 'chromium' } } });
if (!['chromium', 'firefox', 'webkit'].includes(values.browser)) throw new Error('Invalid browser');
const playwright = createRequire(new URL('../../packages/sheet/package.json', import.meta.url))('playwright');
const server = await startServer(); const browser = await playwright[values.browser].launch();
const settle = page => page.evaluate(async () => { for (let i = 0; i < 4; i++) await new Promise(requestAnimationFrame); });
let checks = 0;
const done = name => { checks++; console.log(`PASS ${name}`); };
try {
  for (const painter of ['canvas', 'dom']) {
    const page = await browser.newPage({ viewport: { width: 1400, height: 1200 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${server.url}/core.html?painter=${painter}&rows=100&columns=20`); await settle(page);
    assert.ok(await page.locator('#original td').count() > 0);
    assert.ok(await page.evaluate(() => window.coreLab.snapshot().scene.cells.length > 100));
    const bounds = await page.locator('#mirror .engine-viewport').boundingBox();
    await page.mouse.click(bounds.x + 64 + 130 + 10, bounds.y + 30 + 28 + 10);
    await page.keyboard.press('ArrowDown');
    assert.deepEqual(await page.evaluate(() => window.coreLab.core.getSelectedLast()), [2, 1, 2, 1]);
    assert.equal(await page.evaluate(() => window.coreLab.core.isListening()), false);
    assert.equal(await page.locator('#mirror .engine-viewport').evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('F2');
    await page.locator('#mirror textarea').fill('shared edit');
    await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.core.getDataAtCell(2, 1)), 'shared edit');
    assert.ok(await page.evaluate(() => window.coreLab.changes.some(change => change.source === 'engine.edit')));
    assert.equal(await page.evaluate(() => window.coreLab.core.getCell(2, 1).textContent), 'shared edit');
    done(`${painter}: trusted input shares Core selection, data, real TDs and change hooks`);
    await page.evaluate(() => window.coreLab.core.undo()); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 2 && c.col === 1).text), '79');
    await page.evaluate(() => window.coreLab.core.redo()); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 2 && c.col === 1).text), 'shared edit');
    done(`${painter}: existing Core undo and redo update the mirror`);
    await page.evaluate(() => {
      const core = window.coreLab.core;
      core.setCellMeta(2, 1, 'validator', (value, callback) => setTimeout(() => callback(value !== 'reject'), 10));
      core.setCellMeta(2, 1, 'allowInvalid', false);
    });
    await page.locator('#mirror .engine-viewport').focus(); await page.keyboard.press('F2');
    await page.locator('#mirror textarea').fill('reject'); await page.keyboard.press('Enter');
    await page.waitForTimeout(80); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.core.getDataAtCell(2, 1)), 'shared edit');
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 2 && c.col === 1).text), 'shared edit');
    await page.evaluate(() => window.coreLab.core.setCellMeta(2, 1, 'readOnly', true));
    await page.locator('#mirror .engine-viewport').focus(); await page.keyboard.press('F2');
    assert.equal(await page.locator('#mirror textarea').count(), 0);
    await page.evaluate(() => window.coreLab.core.setCellMeta(2, 1, 'readOnly', false));
    await page.evaluate(() => window.coreLab.core.addHookOnce('beforeChange', () => false));
    await page.locator('#mirror .engine-viewport').focus(); await page.keyboard.press('F2');
    await page.locator('#mirror textarea').fill('cancelled by hook'); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.core.getDataAtCell(2, 1)), 'shared edit');
    done(`${painter}: async validation, readOnly and beforeChange cancellation remain owned by Core`);
    await page.evaluate(() => {
      const core = window.coreLab.core;
      core.selectCell(0, 0, 0, 0, false, false);
      core.setDataAtCell(0, 1, 'external', 'api');
    }); await settle(page);
    assert.deepEqual(await page.evaluate(() => window.coreLab.bridge.source.getSelection()), { row: 0, col: 0 });
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 0 && c.col === 1).text), 'external');
    await page.evaluate(() => {
      window.coreLab.core.getSourceData()[0][1] = 'mutated source'; window.coreLab.core.render();
    });
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 0 && c.col === 1).text), 'mutated source');
    done(`${painter}: public API and live source mutation followed by render refresh the same values`);
    await page.evaluate(() => {
      const core = window.coreLab.core;
      core.setCellMeta(0, 2, 'validator', (_value, callback) => { window.finishPendingValidation = () => callback(true); });
      core.setDataAtCell(0, 2, 'delayed update');
    });
    await page.locator('#mirror .engine-viewport').focus(); await page.keyboard.press('F2');
    await page.locator('#mirror textarea').fill('new draft');
    await page.evaluate(() => window.finishPendingValidation()); await settle(page);
    assert.equal(await page.locator('#mirror textarea').inputValue(), 'new draft');
    assert.equal(await page.locator('#mirror textarea').evaluate(element => element === document.activeElement), true);
    assert.equal(await page.evaluate(() => window.coreLab.core.getDataAtCell(0, 2)), 'delayed update');
    await page.keyboard.press('Escape');
    done(`${painter}: delayed validation preserves the new editor draft and focus`);
    await page.locator('#mirror .engine-viewport').focus(); await page.keyboard.press('F2');
    assert.equal(await page.locator('#mirror textarea').count(), 1, JSON.stringify(await page.evaluate(() => ({
      cancelled: window.coreLab.cancellations, selection: window.coreLab.bridge.source.getSelection(),
      canEdit: window.coreLab.bridge.source.canEdit({ row: 0, col: 0 }),
      scroll: window.coreLab.bridge.engine.getScroll(), active: document.activeElement?.outerHTML.slice(0, 180),
    }))));
    await page.locator('#mirror textarea').fill('must not move');
    await page.evaluate(() => window.coreLab.core.getPlugin('columnSorting').sort({ column: 0, sortOrder: 'desc' })); await settle(page);
    assert.equal(await page.locator('#mirror textarea').count(), 0);
    assert.equal(await page.evaluate(() => window.coreLab.core.getDataAtCell(0, 0)), 'Record 0000099');
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 0 && c.col === 0).text), 'Record 0000099');
    assert.ok(await page.evaluate(() => window.coreLab.cancellations.includes('beforeColumnSort')));
    await page.locator('#mirror .engine-viewport').focus(); await page.keyboard.press('F2');
    await page.locator('#mirror textarea').fill('sorted record edit'); await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.core.getSourceDataAtCell(99, 0)), 'sorted record edit');
    assert.equal(await page.evaluate(() => window.coreLab.core.getSourceDataAtCell(0, 0)), 'Record 0000000');
    done(`${painter}: sorting cancels stale edits and new edits use Core visual-to-source translation`);
    await page.evaluate(() => {
      window.coreLab.core.getPlugin('columnSorting').clearSort();
      window.coreLab.core.selectCell(0, 1, 0, 1, false, false);
      window.coreLab.core.getPlugin('manualRowMove').moveRow(0, 2);
      window.coreLab.core.getPlugin('manualColumnMove').moveColumn(1, 3);
      window.coreLab.core.render();
    }); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 0 && c.col === 1).text),
      await page.evaluate(() => String(window.coreLab.core.getDataAtCell(0, 1))));
    done(`${painter}: moved row/column values follow existing translators`);
    await page.evaluate(() => { window.coreLab.core.alter('insert_row', 1, 2); window.coreLab.core.alter('insert_col', 1, 1); }); await settle(page);
    assert.deepEqual(await page.evaluate(() => [window.coreLab.bridge.engine.rows.count, window.coreLab.bridge.engine.columns.count]), [102, 21]);
    await page.evaluate(() => { window.coreLab.core.alter('remove_row', 1, 2); window.coreLab.core.alter('remove_col', 1, 1); }); await settle(page);
    assert.deepEqual(await page.evaluate(() => [window.coreLab.bridge.engine.rows.count, window.coreLab.bridge.engine.columns.count]), [100, 20]);
    done(`${painter}: insert/remove rebuild dimensions without a second data model`);
    await page.evaluate(() => { window.coreLab.core.selectCell(0, 0, 0, 0, false, false); window.coreLab.bridge.engine.beginEdit(); });
    await page.locator('#mirror textarea').fill('unfinished composition');
    await page.locator('#mirror textarea').evaluate(editor => editor.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true })));
    await page.evaluate(() => window.coreLab.core.loadData([['replacement', 'source'], ['second', 'row']])); await settle(page);
    assert.equal(await page.locator('#mirror textarea').count(), 0);
    assert.deepEqual(await page.evaluate(() => [window.coreLab.core.getDataAtCell(0, 0), window.coreLab.bridge.engine.rows.count,
      window.coreLab.bridge.engine.columns.count]), ['replacement', 2, 2]);
    assert.ok(await page.evaluate(() => window.coreLab.cancellations.includes('beforeLoadData')));
    done(`${painter}: source replacement explicitly aborts composition without writing to the new source`);
    await page.evaluate(() => {
      const core = window.coreLab.core;
      core.updateSettings({ columns: [{ data: 'id' }, { data: 'name' }], data: [{ id: 'row-a', name: 'first' }] });
      window.coreLab.bridge.source.select({ row: 0, col: 1 });
    });
    await page.keyboard.press('F2'); await page.locator('#mirror textarea').fill('property edit');
    await page.keyboard.press('Enter'); await settle(page);
    assert.equal(await page.evaluate(() => window.coreLab.core.getSourceData()[0].name), 'property edit');
    assert.equal(await page.evaluate(() => window.coreLab.bridge.engine.getScene().cells.find(c => c.row === 0 && c.col === 1).text), 'property edit');
    done(`${painter}: object data and column properties use Core mapping`);
    await page.evaluate(() => { window.coreLab.bridge.destroy(); window.coreLab.bridge.destroy(); window.coreLab.core.setDataAtCell(0, 0, 'still live'); });
    assert.equal(await page.locator('#mirror *').count(), 0);
    assert.equal(await page.evaluate(() => window.coreLab.core.getDataAtCell(0, 0)), 'still live');
    await page.evaluate(painter => { window.coreLab.configure(painter); window.coreLab.core.destroy(); }, painter);
    assert.equal(await page.locator('#mirror *').count(), 0);
    assert.deepEqual(errors, []);
    done(`${painter}: independent bridge cleanup and Core-owned destruction`);
    await page.close();
  }
  console.log(`${values.browser}: ${checks} Core bridge groups passed`);
} finally { await browser.close(); await server.close(); }
