---
api: [Files]
---

# Excel and CSV files

FreeSheet opens and saves Excel files (.xlsx) and CSV, itself: no library to install.

```js
const blob = await hot.exportFile('xlsx');          // the document as a Blob
await hot.downloadFile('xlsx', 'report.xlsx');      // saved by the browser
await hot.importFile(file);                         // a File from <input type="file">, a Blob or an ArrayBuffer
```

```html
<input type="file" accept=".xlsx,.csv" onchange="hot.importFile(this.files[0])">
```

## What an Excel file keeps

Export writes every sheet, and import reads them back (an .xlsx file replaces the document):

- sheet names and order, and the active sheet;
- values (numbers, text, true/false, errors) and **formulas** (with their results, so Excel and other programs show
  them; with [formulas](./formulas) FreeSheet calculates them again);
- number formats (`numericFormat: { pattern: '0,0.00' }` ↔ `#,##0.00`) and dates and times (`type: 'date'` with
  `dateFormat` ↔ Excel dates);
- cell styles: bold, italic, underline, strike-through, text and fill color, borders (the `style` cell setting), and
  alignment (`fs-left`, `fs-center`, `fs-right`, `fs-top`, `fs-middle`, `fs-bottom`);
- column widths and row heights, merged cells, hidden rows and columns, frozen rows and columns
  (`fixedRowsTop`, `fixedColumnsLeft`);
- [conditional formatting](./conditional-formatting): highlights, top and bottom, averages, duplicates, dates,
  formulas, color scales, data bars and icon sets;
- comments (Excel notes), with their author.

Charts, pictures, pivot tables, macros and data validation are not read; a file that has them still opens.

## Options

```js
await hot.exportFile('xlsx', { headers: true });    // the column headers as a first row (bold, frozen)
await hot.importFile(file, { headers: true });      // the first row becomes the column headers
```

## CSV

`exportFile('csv')` gives the active sheet's values (formula results), separated by commas, as UTF-8 that Excel
reads. `importFile` reads a `.csv` file or CSV text into the active sheet; the delimiter (`,`, `;` or tab) is guessed,
or set with `delimiter`. Numbers become numbers.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['']],
  colHeaders: true,
  rowHeaders: true,
});

await grid.importFile('name;units\nNorth;12\nSouth;7', { headers: true });
console.log(grid.getDataAtCell(1, 1)); // 7, a number
```

## Cell styles

A cell's `style` setting draws on the cell (conditional formatting draws over it):

```js
cell: [{ row: 0, col: 0, style: { fontWeight: 'bold', color: '#1f4e78', background: '#ddebf7' } }],
```

## Loading state

`importFile` shows a loading state while it reads a file. Show it yourself while your data comes:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['', ''], ['', ''], ['', '']],
  colHeaders: ['Order', 'Total'],
  rowHeaders: true,
});
// A server that answers after two seconds.
const fetchOrders = () => new Promise(resolve => setTimeout(() => resolve([['#101', 120], ['#102', 75]]), 2000));

grid.setLoading('Fetching orders…'); // or true
grid.loadData(await fetchOrders());
grid.setLoading(false);
```

A layer with a spinner covers the grid and takes the clicks; the grid ignores the keyboard and is marked busy for
screen readers. `isLoading()` tells whether it shows. The layer follows the theme (`--fs-loading-background`).

## Events

`beforeImportFile(format, source)` (return `false` to cancel), `afterImportFile(format)` and
`afterExportFile(format, blob)`.
