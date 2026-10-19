import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Model, Geometry, axis, layout } from './model.mjs';
test('edits and component state belong to stable IDs through global sorting', () => {
  const model = new Model(1000, 20);
  model.set(4, 3, 'retained'); model.votes.set(4, 2); model.sort();
  assert.equal(model.order[995], 4); assert.equal(model.value(model.order[995], 3), 'retained');
  assert.equal(model.votes.get(model.order[995]), 2);
  model.sort(); assert.equal(model.order[4], 4);
});
test('prefix lookup agrees with a direct walk, including resized and fractional dimensions', () => {
  const geometry = new Geometry(300, 28, true); geometry.resize(127, 40.5);
  let offset = 0;
  for (let row = 0; row < 300; row++) {
    assert.equal(geometry.prefix[row], offset); assert.equal(geometry.at(offset), row);
    assert.equal(geometry.at(offset + geometry.size(row) - .01), row); offset += geometry.size(row);
  }
  assert.equal(geometry.prefix[300], offset);
});
test('four panes share bounded, unique visible cells and preserve frozen coordinates', () => {
  const model = new Model(1000000, 5000);
  const rows = new Geometry(model.rows, 28, true); const columns = new Geometry(model.columns, 130, true);
  const panes = layout(model, rows, columns, 1000, 600, 30000, 300000, 2, 2, true);
  const cells = panes.flatMap(pane => pane.cells);
  assert.ok(cells.length < 300); assert.equal(new Set(cells.map(cell => cell.key)).size, cells.length);
  assert.equal(cells.find(cell => cell.row === 0 && cell.column === 0).x, 64);
  assert.equal(cells.find(cell => cell.row === 0 && cell.column === 0).y, 30);
  assert.ok(cells.some(cell => cell.row > 9000 && cell.column > 200));
});
test('scroll projection keeps both ends reachable without huge native extents', () => {
  const geometry = new Geometry(1000000, 28, true); const result = axis(geometry, 30, 600);
  assert.equal(result.extent, 8000000);
  assert.ok(Math.abs(result.physicalMax * result.scale - result.logicalMax) < 1e-6);
});
