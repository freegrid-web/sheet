# Fill and paste

## Fill handle

Drag the small square at the corner of the selection to fill the cells next to it. As in a spreadsheet, each column
(or row, when you drag sideways) goes on as a series when its values are one:

| Selected | Filled |
| --- | --- |
| `1`, `3` | `5`, `7`, `9` |
| `Item 1` | `Item 2`, `Item 3` |
| `Q1`, `Q3` | `Q5`, `Q7` |
| `Jan` | `Feb`, `Mar` (month and weekday names, short or long, in their case) |
| `2026-01-30` | `2026-01-31`, `2026-02-01` (one date: day by day) |
| `2026-01-15`, `2026-02-15` | `2026-03-15` (the same day of the month: month by month) |

- A single number is repeated, as is text that is no series.
- A column with an empty cell among the selected ones repeats too.
- Dragging up or left fills the values before the series.
- Date cells (`type: 'date'`) go on in their `dateFormat`.
- Formulas are copied with their references moved.
- A fill is one undo step.

Select the first rows and drag the square down:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    [1, 'Item 1', 'Jan', 'Mon', '2026-01-30'],
    [3, '', 'Feb', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
    ['', '', '', '', ''],
  ],
  colHeaders: ['Step 2', 'Text', 'Months', 'Days', 'Dates'],
  rowHeaders: true,
  columns: [{}, {}, {}, {}, { type: 'date', dateFormat: 'YYYY-MM-DD' }],
});

grid.selectCell(0, 0, 1, 4);
```

`fillHandle: false` turns the handle off; `fillHandle: 'vertical'` allows only up and down.

## Copy and paste with formatting

Copy and paste keep the cells' formatting:

- **Copying** from FreeSheet puts bold, italic, underline, strikethrough, text and fill colors, and the horizontal
  alignment on the clipboard. Pasted into Excel or Google Sheets, the cells keep their formatting.
- **Pasting** a table from Excel, Google Sheets, a web page or FreeSheet gives the cells the pasted formatting, as in
  Excel. Text without formatting, such as plain text or a table with no styles, leaves the cells' own formatting.
- Undo takes back the values and their formatting in one step.

Turn it off to paste values only:

```js
copyPaste: { formats: false }
```

## Paste and Paste Special

Add **Paste** (Ctrl+V) and **Paste special** to the context menu with the keys `'paste'` and `'paste_special'`:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Price', 'Qty', 'Total'],
    [4, 3, ''],
    [2.5, 10, ''],
    ['', '', ''],
  ],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['copy', 'cut', 'paste', 'paste_special'],
  cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }, { row: 0, col: 1, style: { fontWeight: 'bold' } }],
});
// Copy A1:B1, select A4 and right-click ▸ Paste special ▸ Formatting only, or ▸ Transposed.
```


| Entry | Pastes |
| --- | --- |
| Values only | The formula results, without formatting |
| Formulas only | The values and formulas, without formatting |
| Formatting only | Only the formatting; the values stay |
| Transposed | Rows become columns, with the formatting |

- **Formulas move with the paste:** `=A1` copied from B1 and pasted into D3 becomes `=C3`, as in a spreadsheet.
- **One undo step** takes back a paste with its formatting.
- **What is pasted:** the menu entries paste what the grid copied last. A browser does not let a page read the
  clipboard from a menu without asking. When the user has already allowed it and the clipboard holds something else,
  that text is pasted (values only).

From code, `pasteSpecial(mode)` pastes the last copy into the selection:

```js
await grid.getPlugin('copyPaste').pasteSpecial('values'); // 'all', 'values', 'formulas', 'formats', 'transpose'
```

