import { CoreEngineBridge } from './dist/coreBridge.mjs';
const params = new URLSearchParams(location.search);
const rows = Number(params.get('rows') || 1000);
const columns = Number(params.get('columns') || 20);
const source = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, col) =>
  col === 0 ? `Record ${String(row).padStart(7, '0')}` : String((row * 31 + col * 17) % 100000)));
const core = new window.FreeSheet(document.querySelector('#original'), {
  data: source, rowHeaders: true, colHeaders: true, width: 1000, height: 260,
  rowHeights: 28, colWidths: 130, autoRowSize: false, autoColumnSize: false,
  columnSorting: true, manualRowMove: true, manualColumnMove: true, undo: true,
});
const changes = []; const cancellations = [];
core.addHook('afterChange', (changes_, source) => changes.push({ changes: changes_, source }));
core.selectCell(0, 0, 0, 0, false, false); core.unlisten();
let bridge;
let attachMs = 0;
function configure(painter = 'canvas') {
  bridge?.destroy();
  const start = performance.now();
  bridge = new CoreEngineBridge(core, document.querySelector('#mirror'), { painter,
    onEditCancelled(reason) {
      cancellations.push(reason); document.querySelector('#status').textContent = `Edit cancelled: ${reason}`;
    } });
  attachMs = performance.now() - start;
  document.querySelector('#painter').value = painter;
}
window.coreLab = {
  core, configure, changes, cancellations, get bridge() { return bridge; }, get attachMs() { return attachMs; },
  snapshot() { return { selection: bridge.source.getSelection(), scene: bridge.engine.getScene(),
    metrics: { ...bridge.engine.metrics }, rows: core.countRows(), columns: core.countCols(), changes, cancellations }; },
};
document.querySelector('#painter').onchange = event => configure(event.target.value);
let descending = false;
document.querySelector('#sort').onclick = () => {
  descending = !descending; core.getPlugin('columnSorting').sort({ column: 0, sortOrder: descending ? 'desc' : 'asc' });
};
document.querySelector('#undo').onclick = () => core.undo();
document.querySelector('#redo').onclick = () => core.redo();
document.querySelector('#load').onclick = () => core.loadData(source.map((row, i) => row.map((value, col) => col === 0 ? `Replacement ${i}` : value)));
configure(params.get('painter') || 'canvas');
