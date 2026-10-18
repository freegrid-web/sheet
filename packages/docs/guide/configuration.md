---
api: [Lifecycle, Rows and columns, Rendering and scrolling]
---

# Configuration

A grid is configured with one settings object, passed to the constructor:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Ana', 'Oslo'], ['Ben', 'Riga'], ['Cleo', 'Rome']],
  colHeaders: true,
  rowHeaders: true,
  stretchH: 'all',
});
```

## Changing settings later

`updateSettings` merges new settings into the current ones and re-renders:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Ana', 'Oslo'], ['Ben', 'Riga']],
  colHeaders: true,
});

grid.updateSettings({ readOnly: true, colHeaders: ['Name', 'City'] });
```

## Settings cascade

Settings apply at three levels. The more specific level wins:

1. **Grid:** the top-level settings object.
2. **Column:** an entry in `columns`.
3. **Cell:** an entry in `cell`, or the result of the `cells` function.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['edit me', 'edit me too'], ['edit me', 'read only'], ['edit me', 'read only']],
  colHeaders: true,
  rowHeaders: true,
  readOnly: true,                       // every cell…
  columns: [
    { readOnly: false },                // …except the first column…
    {},
  ],
  cell: [
    { row: 0, col: 1, readOnly: false }, // …and this one cell
  ],
  cells(row, col) {
    // called for every cell; return settings for it
    return row === 2 ? { className: 'fs-center' } : {};
  },
});
```

To read the settings of a level, use `getCellMeta(row, column)` for a cell and `getColumnMeta(column)` for a column
(grid and column settings together).

Each level inherits from the one above it, so an object or array value (for example `numericFormat`) is the
**same object** in every cell that does not set its own. Do not change such a value in place: that changes it for
all those cells. Give the cell a new value instead:

```js
// Changes the format of every cell that shares it:
hot.getCellMeta(0, 1).numericFormat.pattern = '0.00';

// Changes only this cell:
hot.setCellMeta(0, 1, 'numericFormat', { ...hot.getCellMeta(0, 1).numericFormat, pattern: '0.00' });
```

## Frequently used settings

| Setting | What it does |
| --- | --- |
| `data` | Array of arrays or array of objects |
| `colHeaders`, `rowHeaders` | `true` for letters/numbers, an array of labels, or a function |
| `columns` | Per-column settings; with object rows, `data: 'key'` binds a column to a property |
| `width`, `height` | Grid size in pixels (or a function returning it) |
| `stretchH` | `'none'`, `'last'` or `'all'`: how columns fill the width |
| `readOnly` | Disable editing |
| `minSpareRows`, `minSpareCols` | Keep empty rows/columns at the end for new input |
| `fillContainer` | Empty cells fill the grid's element to its edges and grow as it scrolls, as in a spreadsheet; the empty end is not saved |
| `fixedRowsTop`, `fixedRowsBottom`, `fixedColumnsLeft` | Freeze rows and columns |
| `contextMenu` | `true` or a list of menu items |
| `columnSorting` | Enable sorting by clicking headers |
| `language` | UI language, e.g. `'de-DE'` (see [Localization](./localization)) |

The [API overview](../api/) lists more settings and instance methods.
