import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

const bold = { fontWeight: 'bold' };
const line = '1px solid #7f7f7f';

export default async function createGrid(container) {
  await init(); // loads IronCalc's WebAssembly once

  const toolbar = document.createElement('div');
  const element = document.createElement('div');

  toolbar.className = 'example-toolbar';
  toolbar.innerHTML = '<button type="button">Download .xlsx</button>';
  container.append(toolbar, element);

  const grid = new FreeSheet(element, {
    data: [
      ['Invoice 2026-041', '', '', ''],
      ['Billed to: Northwind Studio, Vilnius', '', '', ''],
      ['', '', '', ''],
      ['Item', 'Quantity', 'Price', 'Amount'],
      ['Design, hours', 12, 65, '=B5*C5'],
      ['Development, hours', 30, 70, '=B6*C6'],
      ['Hosting, months', 3, 25, '=B7*C7'],
      ['', '', '', ''],
      ['', '', 'Subtotal', '=SUM(D5:D8)'],
      ['', '', 'VAT 21 %', '=ROUND(D9*0.21, 2)'],
      ['', '', 'Total', '=D9+D10'],
    ],
    colHeaders: true,
    rowHeaders: true,
    colWidths: [240, 90, 100, 110],
    formulas: { engine: Model },
    formulaBar: true,
    mergeCells: [{ row: 0, col: 0, rowspan: 1, colspan: 4 }, { row: 1, col: 0, rowspan: 1, colspan: 4 }],
    columns: [
      {},
      { type: 'numeric' },
      { type: 'numeric', numericFormat: { pattern: '$0,0.00' } },
      { type: 'numeric', numericFormat: { pattern: '$0,0.00' } },
    ],
    cell: [
      { row: 0, col: 0, style: { fontSize: '16pt', fontWeight: 'bold' } },
      { row: 1, col: 0, style: { fontStyle: 'italic' } },
      ...[0, 1, 2, 3].map(col => ({ row: 3, col, style: { ...bold, borderBottom: line, background: '#d9e1f2', color: '#1f2937' } })),
      { row: 8, col: 2, type: 'text' },
      { row: 9, col: 2, type: 'text' },
      { row: 10, col: 2, type: 'text', style: bold },
      { row: 10, col: 3, style: { ...bold, borderTop: line, borderBottom: '2px solid #000000' } },
    ],
    contextMenu: ['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo', '---------', 'formatting'],
    formattingBar: true,
  });

  toolbar.querySelector('button').addEventListener('click', () => grid.downloadFile('xlsx', 'invoice-2026-041.xlsx'));

  return grid;
}
