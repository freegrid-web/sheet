import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const REGIONS = ['North', 'South', 'East', 'West', 'Online'];

// Column letters: A is the region, then each quarter's three months and its total, then the year.
const letter = index => String.fromCharCode(65 + index);

export default async function createGrid(container) {
  await init(); // loads IronCalc's WebAssembly once

  const headers = ['Region'];
  const groups = [];

  [0, 1, 2, 3].forEach((quarter) => {
    groups.push({ from: headers.length, to: headers.length + 2, collapsed: quarter > 0 });
    headers.push(...MONTHS.slice(quarter * 3, quarter * 3 + 3), `Q${quarter + 1}`);
  });
  headers.push('Year');

  const rows = REGIONS.map((region, index) => {
    const row = [region];

    [0, 1, 2, 3].forEach((quarter) => {
      const first = row.length;

      [0, 1, 2].forEach(month => row.push(80 + ((index * 37 + quarter * 23 + month * 11) % 70)));
      row.push(`=SUM(${letter(first)}${index + 2}:${letter(first + 2)}${index + 2})`);
    });
    row.push(`=${[4, 8, 12, 16].map(col => `${letter(col)}${index + 2}`).join('+')}`);

    return row;
  });
  const total = ['Total', ...headers.slice(1).map((_, col) =>
    `=SUM(${letter(col + 1)}2:${letter(col + 1)}${REGIONS.length + 1})`)];
  const quarterColumns = [4, 8, 12, 16];

  return new FreeSheet(container, {
    data: [headers, ...rows, total],
    rowHeaders: true,
    colHeaders: true,
    colWidths: [80, ...headers.slice(1).map(() => 64)],
    formulas: { engine: Model },
    formulaBar: true,
    fixedRowsTop: 1,
    fixedColumnsLeft: 1,
    // Each quarter's months are a column group: Q1 open, the others collapsed to their total.
    columnOutline: { groups },
    columns: headers.map((_, col) => (col ? { type: 'numeric', numericFormat: { pattern: '0,0' } } : {})),
    cell: [
      ...headers.map((_, col) => ({ row: 0, col, type: 'text', style: { fontWeight: 'bold' } })),
      ...headers.map((_, col) => ({ row: REGIONS.length + 1, col, style: { fontWeight: 'bold', borderTop: '1px solid #7f7f7f' } })),
      ...quarterColumns.flatMap(col => REGIONS.map((__, row) => ({ row: row + 1, col, style: { fontWeight: 'bold' } }))),
    ],
    conditionalFormatting: [
      // Each quarter's totals on a scale from red to green.
      { range: quarterColumns.map(col => `${letter(col)}2:${letter(col)}${REGIONS.length + 1}`), colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
      { range: `R2:R${REGIONS.length + 1}`, dataBar: '#638ec6' },
    ],
    contextMenu: true,
    statusBar: true,
  });
}
