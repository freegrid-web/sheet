---
api: [Status bar]
---

# Status bar and frozen panes

## Status bar

`statusBar: true` shows a bar at the bottom of the grid (below the sheet tabs), as in Excel. When more than one cell
is selected, it shows their average, count and sum:

- **Count** counts the cells that have a value.
- **Average** and **Sum** use the numbers among them (formula results count).
- Without numbers, only the count shows.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Rent', 1200, 1200],
    ['Power', 300, 260],
    ['Internet', 50, 50],
    ['Travel', 800, 450],
  ],
  colHeaders: ['Cost', 'Q1', 'Q2'],
  rowHeaders: true,
  statusBar: true,
});

grid.selectCell(0, 1, 3, 2); // the bar shows their average, count and sum
```

Choose the figures with `items`: `'average'`, `'count'`, `'numericalCount'` (cells with a number), `'min'`, `'max'`
and `'sum'`.

```js
statusBar: { items: ['sum', 'min', 'max'] }
```

### Items and formats of your own

An item can also be an object:

- **Rename or format a built-in item** with `item`, for example
  `{ item: 'sum', label: 'Total', format: { style: 'currency', currency: 'EUR' } }`.
- **Compute a value of your own** with `value`. It gets the selection and returns a number or a text; `null` hides the
  item. Its argument has these fields:
  - `values`: the selected cells' values, formula results, empty ones too;
  - `numbers`: the numbers among them;
  - `cells`: the selected cells as `[row, col]`;
  - `grid`: the active sheet.
- **Choose where it shows:**
  - `align: 'left'` puts the item at the left, where it always shows (a "Ready" or "Saved" text);
  - `always: true` shows a right item without a selection too.

`format` writes the numbers, for every item (`statusBar.format`) or one (`item.format`):

- **Options of `Intl.NumberFormat`**, such as `{ maximumFractionDigits: 2 }` or
  `{ style: 'currency', currency: 'EUR' }`.
- **A function** `(value, context) => text`, which can write the value its own way, compute something else or add
  text. `context` has the fields above, and `item`: the built-in item's name or the item's label.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

let saved = true;

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [[12.5, 7], [3.25, 18], [9, 4.75]],
  colHeaders: true,
  rowHeaders: true,
  statusBar: {
    items: [
      { align: 'left', value: () => (saved ? 'Saved' : 'Unsaved changes') },
      { item: 'sum', label: 'Total' },
      'average',
      { label: 'Median', value: ({ numbers }) => (numbers.length ? median(numbers) : null) },
      { label: 'Cells', value: ({ cells }) => cells.length, format: count => `${count} selected` },
    ],
    format: { maximumFractionDigits: 2 },
  },
  afterChange: (changes, source) => {
    if (source !== 'loadData') {
      saved = false;
      grid.getPlugin('statusBar').refresh();
    }
  },
});

grid.selectCell(0, 0, 2, 1);
```

The bar updates when the selection or the data changes. When an item depends on something else, call
`grid.getPlugin('statusBar').refresh()`.

In a document with [sheets](./sheets), one bar shows the active sheet's selection. See the
[budget example](../examples/budget).

## Frozen panes

Frozen rows stay at the top while the grid scrolls, frozen columns at the left. Set them with `fixedRowsTop` and
`fixedColumnsLeft`, or let users choose with the context menu's **Freeze** entry. Add its key `'freeze'` to your
menu:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(40, 20),
  colHeaders: true,
  rowHeaders: true,
  height: 260,
  fixedRowsTop: 1,
  fixedColumnsLeft: 1,
  contextMenu: ['undo', 'redo', '---------', 'freeze'],
});
```

**Freeze** has these commands:

- **Freeze panes** freezes the rows above the selected cell and the columns left of it.
- **Freeze top row** and **Freeze first column** freeze just those.
- **Unfreeze panes** turns freezing off.

Excel files and `getDocument()` keep frozen panes.
