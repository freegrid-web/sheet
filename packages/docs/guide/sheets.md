---
api: [Sheets]
---

# Sheets

A FreeSheet grid can hold several sheets, as an Excel file does. The grid you create with `new FreeSheet` is the
first sheet, `Sheet1`; every sheet you add belongs to the same document. Until you add one, a grid has no tabs and
costs nothing extra.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['January', 1200], ['February', 1350]],
  sheetName: 'Sales',
  colHeaders: true,
});

const costs = grid.addSheet('costs', { name: 'Costs', data: [['Rent', 800], ['Power', 120]] }); // its grid

grid.activateSheet('costs');
console.log(costs.getDataAtCell(0, 0)); // 'Rent'
console.log(grid.getSheets());          // [{ id, name }, …] in the order of the tabs
```

The tab bar appears below the sheets as soon as there is more than one. Users switch sheets by clicking a tab, add
one with **+**, rename one with a double click, and delete or move one from the tab's right-click menu or by
dragging it (a line shows where it goes). `sheetTabs: true` shows the tabs for a single sheet too (so users can add
sheets); `false` hides them. `sheetTabsPosition: 'top'` puts them above the sheets.

To create several sheets at once, list them in the `sheets` setting:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  sheetName: 'Sales',
  data: [['January', 1200], ['February', 1350]],
  colHeaders: true,
  rowHeaders: true,
  sheets: [
    { id: 'costs', name: 'Costs', data: [['Rent', 800], ['Power', 120]] },
    { id: 'summary', name: 'Summary', data: [['Profit', 1630]] },
  ],
});
```

## Each sheet is a grid

`addSheet`, `getSheet` and `getActiveSheet` return a sheet's grid, with every method a grid has. Cell methods always
work on **their own** sheet: `hot.getDataAtCell(0, 0)` reads `Sales` even while the user looks at `Costs`. Use
`hot.getSheet('costs')` or `hot.getActiveSheet()` for another sheet. Every sheet has its own data, settings, undo,
selection and scroll position.

A new sheet takes `formulas`, `formulaBar`, the headers, the size and a few other settings from the first sheet,
unless you pass its own.

| Method | Does |
| --- | --- |
| `addSheet(id, settings)` | Adds a sheet after the last one and returns its grid. `settings.name` is its name. |
| `getSheet(id)` | The grid of a sheet, or `null`. |
| `getSheets()` | `[{ id, name }, …]` in the order of the tabs. |
| `getActiveSheet()` | The grid of the sheet the user sees. |
| `activateSheet(id)` | Shows a sheet. |
| `renameSheet(id, name)` | Renames a sheet (its id stays). |
| `removeSheet(id)` | Removes a sheet and destroys its grid. |
| `moveSheet(id, index)` | Moves a sheet in the tab order. |
| `getSheetId()`, `getSheetName()` | The sheet of this grid. |

Any sheet can call the document methods; they act on the same document. The first sheet (the grid created with
`new FreeSheet`) holds the document: it cannot be removed, its hooks get the sheet events
(`afterSheetAdd`, `afterSheetActivate`, `afterSheetRename`, `afterSheetMove`, `afterSheetRemove`, and the `before…`
events, which can cancel), and destroying it destroys every sheet.

A sheet name has 1 to 31 characters, without `[ ] : * ? / \`, and is unique in the document (as in Excel).

## Saving and loading

`getDocument()` returns the whole document as JSON-safe data: every sheet in tab order with its id, name and data
(formulas stay formulas), the column widths and row heights users changed, merged cells, cell formats (comments,
`className`, `readOnly`, `type`, number and date formats) and the active sheet. `loadDocument(document)` puts it
back: the sheets, their order and content, and the active sheet.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Saved', 'with'], ['its', 'style']],
  colHeaders: true,
  sheets: [{ id: 'notes', name: 'Notes', data: [['A second sheet']] }],
  cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }],
});

const saved = JSON.stringify(grid.getDocument()); // or send it to your server
console.log(`${saved.length} characters`);

grid.setDataAtCell(0, 0, 'Changed');
grid.loadDocument(JSON.parse(saved)); // back as it was
```

## Fitting in your element

With `formulaBar`, `statusBar`, `sheets` or `sheetTabs` set when the grid is created, the element you give
FreeSheet holds everything: the formula bar, every sheet, the tab bar and the status bar. When the element has a height, the bars take what they
need and the sheet fills the rest and scrolls inside; without a height, everything is as tall as its content. Make
the element as big as you want the whole component to be. (`rootElement` is then the sheet's own element inside it.)
Turned on later (`updateSettings`, or `addSheet` on a grid created without these settings), the bars and the sheets
go next to the element instead.

## Formulas across sheets

With [formulas](./formulas), all sheets share one formula engine, so a formula can refer to another sheet by its
name: `=Costs!B2`, `=SUM(Sales!B2:B13)`, or `='Sales 2026'!A1` for a name with spaces.

- Renaming a sheet updates the formulas that refer to it.
- Removing a sheet turns the references to it into `#REF!`.
- Inserting or removing rows or columns moves the references on every sheet.

See the [Sheets](../examples/sheets) and [Budget across sheets](../examples/budget) examples.
