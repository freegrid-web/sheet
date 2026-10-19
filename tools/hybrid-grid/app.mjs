import { Grid } from './grid.mjs';
const host = document.querySelector('#grid');
const form = document.querySelector('#controls');
let grid;
let retired;
const defaults = { renderer: 'canvas', rows: 100000, columns: 200, rich: true, varied: true, frozenRows: 2, frozenColumns: 2 };
async function configure(options = {}) {
  if (grid) { grid.destroy(); retired = grid; }
  const start = performance.now();
  grid = new Grid(host, { ...defaults, ...options });
  const attachMs = performance.now() - start;
  await grid.ready;
  grid.metrics.readyMs = performance.now() - start;
  document.querySelector('#info').textContent = `${grid.config.renderer} · ${grid.config.rows.toLocaleString()} × ${grid.config.columns} · initialization ${attachMs.toFixed(1)} ms · keyboard and double-click editing`;
  return grid.snapshot();
}
form.addEventListener('submit', event => {
  event.preventDefault(); const values = new FormData(form);
  configure({ renderer: values.get('renderer'), rows: Number(values.get('rows')), columns: Number(values.get('columns')),
    rich: values.has('rich'), varied: values.has('varied'), frozenRows: values.has('frozen') ? 2 : 0,
    frozenColumns: values.has('frozen') ? 2 : 0 });
});
document.querySelector('#sort').onclick = () => grid.sort();
document.querySelector('#last').onclick = () => {
  grid.focus = { row: grid.model.rows - 1, column: grid.model.columns - 1 }; grid.reveal();
};
document.querySelector('#home').onclick = () => { grid.focus = { row: 0, column: 0 }; grid.scroll(0, 0); };
document.querySelector('#resize').onclick = () => {
  grid.rows.resize(grid.focus.row, grid.rows.size(grid.focus.row) + 8);
  grid.columns.resize(grid.focus.column, grid.columns.size(grid.focus.column) + 15); grid.resize();
};
window.hybridLab = {
  configure, snapshot: () => grid.snapshot(), get grid() { return grid; },
  retired: () => retired?.snapshot(),
  destroy: () => { grid.destroy(); return grid.snapshot(); },
};
const query = new URLSearchParams(location.search);
const initial = {};
if (query.has('renderer')) initial.renderer = query.get('renderer') === 'dom' ? 'dom' : 'canvas';
for (const name of ['rows', 'columns']) if (query.has(name)) initial[name] = Number(query.get(name));
if (query.has('rich')) initial.rich = query.get('rich') === '1';
window.hybridLab.ready = configure(initial);
