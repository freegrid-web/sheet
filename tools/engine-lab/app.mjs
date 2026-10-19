import { GridEngine } from './dist/engine.mjs';
const params = new URLSearchParams(location.search);
const rows = Number(params.get('rows') || 100000);
const columns = Number(params.get('columns') || 20);
const host = document.querySelector('#grid');
let engine;
let selection = { row: 0, col: 0 };
let reads = 0;
let attachMs = 0;
const edits = new Map();
const source = {
  readCell({ row, col }) {
    reads++;
    return edits.get(`${row}:${col}`) ?? (col === 0 ? `Record ${row}` : String((row * 31 + col * 17) % 100000));
  },
  writeCell({ row, col }, value) { edits.set(`${row}:${col}`, value); },
  getSelection: () => selection,
  select(address) { selection = { ...address }; },
};
function configure(painter = 'canvas') {
  engine?.destroy(); selection = { row: 0, col: 0 }; reads = 0;
  const start = performance.now();
  engine = new GridEngine(host, source, { rows, columns, painter });
  attachMs = performance.now() - start;
  document.querySelector('#painter').value = painter;
  document.querySelector('#status').textContent = `${rows.toLocaleString()} × ${columns.toLocaleString()}`;
}
window.engineLab = {
  get engine() { return engine; }, source, configure,
  snapshot() { return { selection, reads, attachMs, edits: [...edits], metrics: { ...engine.metrics },
    scroll: engine.getScroll(), scene: engine.getScene(), nodes: host.querySelectorAll('*').length,
    editing: !!host.querySelector('textarea') }; },
};
document.querySelector('#painter').onchange = event => configure(event.target.value);
document.querySelector('#last').onclick = () => { source.select({ row: rows - 1, col: columns - 1 }); engine.scrollViewport(selection); };
document.querySelector('#first').onclick = () => { source.select({ row: 0, col: 0 }); engine.scrollViewport(selection); };
configure(params.get('painter') || 'canvas');
