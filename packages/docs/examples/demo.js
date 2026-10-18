import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

// FreeSheet with every feature on, as a spreadsheet app: a toolbar, a workbook of three sheets, the formula bar, the
// status bar and the side panel.

// As a spreadsheet's menu: the formatting is in the formatting bar above it.
const MENU = [
  'cut', 'copy', 'paste', 'paste_special', '---------',
  'row_above', 'row_below', 'col_left', 'col_right', '---------',
  'remove_row', 'remove_col', '---------',
  'commentsAddEdit', 'link', 'conditional_formatting', 'data_validation', '---------',
  'freeze',
]

// The settings every sheet has.
const COMMON = {
  rowHeaders: true,
  colHeaders: true,
  contextMenu: MENU,
  formattingBar: true,
  manualColumnResize: true,
  manualRowResize: true,
  manualColumnMove: true,
  columnSorting: true,
  filters: true,
  dropdownMenu: true,
  hiddenRows: true,
  hiddenColumns: true,
  mergeCells: true,
  comments: true,
  customBorders: true,
  conditionalFormatting: true,
  rowGroups: true,
  columnOutline: true,
  findAndReplace: true,
  changeHistory: { user: 'You' },
  // Empty cells fill the window, as in a spreadsheet.
  minRows: 60,
  minCols: 26,
};

const header = { fontWeight: 'bold', background: '#d9e1f2', color: '#1f2937', borderBottom: '1px solid #8ea9db' };
const headerRow = count => Array.from({ length: count }, (_, col) => ({ row: 0, col, style: header }));

const sales = {
  data: [
    ['Region', 'Jan', 'Feb', 'Mar', 'Q1', 'Apr', 'May', 'Jun', 'Q2', 'H1'],
    ['North', 120, 135, 128, '=SUM(B2:D2)', 140, 152, 149, '=SUM(F2:H2)', '=E2+I2'],
    ['South', 98, 101, 110, '=SUM(B3:D3)', 104, 99, 121, '=SUM(F3:H3)', '=E3+I3'],
    ['East', 143, 139, 150, '=SUM(B4:D4)', 161, 158, 170, '=SUM(F4:H4)', '=E4+I4'],
    ['West', 87, 92, 95, '=SUM(B5:D5)', 90, 101, 99, '=SUM(F5:H5)', '=E5+I5'],
    ['Online', 210, 236, 251, '=SUM(B6:D6)', 262, 280, 301, '=SUM(F6:H6)', '=E6+I6'],
    ['Total', '=SUM(B2:B6)', '=SUM(C2:C6)', '=SUM(D2:D6)', '=SUM(E2:E6)', '=SUM(F2:F6)', '=SUM(G2:G6)',
      '=SUM(H2:H6)', '=SUM(I2:I6)', '=SUM(J2:J6)'],
  ],
  fixedRowsTop: 1,
  fixedColumnsLeft: 1,
  columnOutline: { groups: [{ from: 1, to: 3 }, { from: 5, to: 7 }] },
  cell: [
    ...headerRow(10),
    // The numbers with a thousands separator.
    ...Array.from({ length: 6 }, (_, row) => Array.from({ length: 9 }, (__, col) => ({
      row: row + 1, col: col + 1, type: 'numeric', numericFormat: { pattern: '0,0' },
    }))).flat(),
    ...Array.from({ length: 10 }, (_, col) => ({ row: 6, col, style: { fontWeight: 'bold', borderTop: '1px solid #7f7f7f' } })),
    { row: 5, col: 0, comment: { value: 'Online grew every month.', author: 'Ana' } },
  ],
  conditionalFormatting: [
    { range: 'B2:D6', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
    { range: 'F2:H6', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
    { range: 'J2:J6', dataBar: '#638ec6' },
  ],
};

const tasks = {
  name: 'Tasks',
  data: [
    ['Task', 'Owner', 'Status', 'Due', 'Hours', 'Link'],
    ['Plan the release', 'Ana', 'Done', '2026-03-02', 6, 'example.com/issues/1'],
    ['Write the notes', 'Ben', 'In progress', '2026-03-09', 4, 'example.com/issues/2'],
    ['Check the numbers', 'Cleo', 'Blocked', '2026-03-11', 3, 'example.com/issues/3'],
    ['Send it', 'Dan', 'Not started', '2026-03-16', 1, 'example.com/issues/4'],
  ],
  colWidths: [180, 80, 110, 100, 70, 200],
  fixedRowsTop: 1,
  columns: [
    {},
    { validation: { type: 'list', source: ['Ana', 'Ben', 'Cleo', 'Dan'] } },
    { validation: { type: 'list', source: ['Not started', 'In progress', 'Blocked', 'Done'] } },
    { type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
    { type: 'numeric', validation: { type: 'number', operator: 'between', value: 0, value2: 40, message: '0 to 40 hours' } },
    {},
  ],
  cell: [
    ...headerRow(6).map(cell => ({ ...cell, validation: null, type: 'text' })),
    ...[1, 2, 3, 4].map(row => ({ row, col: 5, link: `https://example.com/issues/${row}` })),
  ],
  conditionalFormatting: [
    { range: 'C2:C100', when: 'eq', value: 'Blocked', style: { background: '#f8d7da', color: '#842029' } },
    { range: 'C2:C100', when: 'eq', value: 'Done', style: { color: '#1a7f37' } },
  ],
};

const summary = {
  name: 'Summary',
  data: [
    ['Summary', ''],
    ['Half-year sales', '=Sales!J7'],
    ['Best month', '=MAX(Sales!B7:D7, Sales!F7:H7)'],
    ['Hours planned', '=SUM(Tasks!E2:E100)'],
    ['Tasks blocked', '=COUNTIF(Tasks!C2:C100, "Blocked")'],
  ],
  colWidths: [180, 120],
  mergeCells: [{ row: 0, col: 0, rowspan: 1, colspan: 2 }],
  cell: [
    { row: 0, col: 0, style: { fontSize: '14pt', fontWeight: 'bold' } },
    { row: 1, col: 1, type: 'numeric', numericFormat: { pattern: '0,0' } },
  ],
};

export default async function createDemo(container) {
  await init(); // loads IronCalc's WebAssembly once

  const toolbar = document.createElement('div');
  const book = document.createElement('div');

  toolbar.className = 'demo-toolbar';
  toolbar.innerHTML = `
    <label class="demo-button">Open… <input type="file" accept=".xlsx,.csv" hidden></label>
    <button type="button" class="demo-button" data-action="xlsx">Download .xlsx</button>
    <button type="button" class="demo-button" data-action="csv">Download .csv</button>
    <span class="demo-separator"></span>
    <button type="button" class="demo-button" data-action="find">Find</button>
    <button type="button" class="demo-button" data-action="changes">Changes</button>
    <button type="button" class="demo-button" data-action="comments">Comments</button>
    <span class="demo-hint">Right-click a cell for the menu and the formatting bar.</span>`;
  book.className = 'demo-book';
  container.append(toolbar, book);

  const grid = new FreeSheet(book, {
    ...COMMON,
    ...sales,
    sheetName: 'Sales',
    formulas: { engine: Model },
    formulaBar: true,
    statusBar: true,
    sidePanel: true,
    sheets: [{ id: 'tasks', ...COMMON, ...tasks }, { id: 'summary', ...COMMON, ...summary }],
  });

  toolbar.addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]')?.dataset.action;
    const sheet = grid.getActiveSheet();

    if (action === 'xlsx' || action === 'csv') {
      grid.downloadFile(action, `freesheet-demo.${action}`);
    } else if (action === 'find') {
      sheet.selectCell(0, 0);
      sheet.getPlugin('findAndReplace').open();
    } else if (action === 'changes') {
      grid.openPanel('changes');
    } else if (action === 'comments') {
      grid.openPanel('comments');
    }
  });
  toolbar.querySelector('input').addEventListener('change', (event) => {
    if (event.target.files[0]) {
      grid.importFile(event.target.files[0]);
    }
  });

  return grid;
}
