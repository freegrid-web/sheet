---
api: [Rows and columns]
---

# Hidden rows and columns

Hide rows or columns from the context menu or the API, as in Excel. Turn hiding on with `hiddenRows` and
`hiddenColumns`; an object can also list what is hidden at start (physical indexes, that is, positions in the data):

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(6, 4),
  rowHeaders: true,
  colHeaders: true,
  contextMenu: true,
  hiddenRows: { rows: [2, 3] },
  hiddenColumns: { columns: [1] },
});
```

A column can also say it itself: `{ data: 'notes', title: 'Notes', hidden: true }` in `columns` starts hidden (no
`hiddenColumns` setting needed). See [Column header groups](./column-groups).

## What a hidden row is

A hidden row leaves the grid's visual order. `countRows()` counts the visible rows (`countSourceRows()` counts all),
visual indexes skip hidden rows, and so do selection, the arrow keys and copying. The row headers keep each row's
number, so the gaps show where rows are hidden (1, 2, 5), and a double line with small arrows marks the spot
(`indicators: false` turns them off). Columns work the same way, with letters (A, B, E).

What is hidden is kept per data row, so a hidden row stays hidden when the rows are sorted or moved. Inserting or
removing rows moves the hidden ones with their data. Formulas still calculate hidden cells.

## Hiding and showing

- **Context menu**: Hide rows hides the selected rows. Show rows shows the hidden rows inside the selection (select
  the rows on both sides of the gap, or the first or last row for rows hidden at the edge).
- **A click** on one of the small arrows beside the double line shows the rows hidden there (on hover the arrow
  becomes a button, and its tooltip lists what is hidden: "Show rows: 2–3").
- **API**: hiding takes visual indexes; a hidden row has no visual index, so showing takes physical ones.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(6, 4),
  rowHeaders: true,
  colHeaders: true,
  hiddenRows: true,
  hiddenColumns: true,
});
const rows = grid.getPlugin('hiddenRows');

rows.hideRows([1, 2]);              // visual rows
console.log(rows.getHiddenRows()); // physical rows: [1, 2]
rows.showRows([2]);                 // physical rows
console.log(rows.isHidden(1));     // true (a physical row)
grid.getPlugin('hiddenColumns').hideColumns([0]);
// rows.showAllRows() shows them all.
```

Hiding and showing can be undone. The events `beforeHideRows` (return `false` to cancel), `afterHideRows`,
`beforeUnhideRows` and `afterUnhideRows` get the physical rows; the column events have the same names with
`Columns`.

A merged cell moves with its rows when rows above it are hidden or shown; rows (columns) inside a merged cell cannot
be hidden. `getDocument()` saves the hidden rows and columns of each sheet, and `loadDocument()` hides them again.
