---
api: [Selection, Mouse and keyboard]
---

# Selection and keyboard

## Selecting cells

Users select cells as in a spreadsheet: click a cell, drag or Shift+click for a range, Ctrl+click (⌘ on a Mac) to add
another range, and click a row or column header to select the whole row or column.

`selectionMode` limits what can be selected: `'single'` (one cell), `'range'` (one range) or `'multiple'` (several
ranges, the default).

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['A1', 'B1', 'C1'], ['A2', 'B2', 'C2'], ['A3', 'B3', 'C3']],
  colHeaders: true,
  rowHeaders: true,
  selectionMode: 'range', // try Ctrl+click: it starts a new range instead of adding one
});
```

## Selecting from code

The methods take visual indexes. `getSelected()` gives every range as `[startRow, startCol, endRow, endCol]`;
`getSelectedLast()` the last one.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Ana', 31, 'Oslo'], ['Ben', 27, 'Riga'], ['Cleo', 45, 'Rome'], ['Dan', 19, 'Bern']],
  colHeaders: ['Name', 'Age', 'City'],
  rowHeaders: true,
});

grid.selectCells([[0, 0, 1, 1], [3, 2]]); // two ranges: A1:B2 and C4
console.log(grid.getSelected()); // [[0, 0, 1, 1], [3, 2, 3, 2]]
// Also: selectCell(row, col, endRow?, endCol?), selectRows(from, to?), selectColumns(from, to?), selectAll(),
// deselectCell().
```

The selection events tell what the user selects: `afterSelection` while the mouse moves, `afterSelectionEnd` when the
selection is done.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [[1, 2, 3], [4, 5, 6], [7, 8, 9]],
  colHeaders: true,
  rowHeaders: true,
});

grid.addHook('afterSelectionEnd', (row, col, row2, col2) => {
  const values = grid.getData(row, col, row2, col2).flat();

  console.log(`${values.length} cells, sum ${values.reduce((sum, value) => sum + value, 0)}`);
});
```

For a sum under the grid without code, see the [status bar](./status-bar-and-freezing).

## Keyboard

| Keys | What they do |
| --- | --- |
| Arrows | Move to the next cell; with Shift, extend the selection |
| Home, End | The first or last cell of the row; with Ctrl, of the column |
| Page Up, Page Down | Move a screen up or down |
| Tab, Shift+Tab | The next or previous cell in the row (see `tabMoves` and `autoWrapRow`) |
| Enter, Shift+Enter | Open the editor; in the editor, save and move down or up (see `enterMoves`) |
| F2 | Open the editor with the cursor at the end |
| Typing | Replaces the cell's value |
| Delete, Backspace | Empty the selected cells |
| Escape | Close the editor without saving |
| Alt+Enter, Ctrl+Enter | A new line in the cell's text; Ctrl+Enter with several cells selected fills them all |
| Ctrl+A | Select all |
| Ctrl+C, Ctrl+X, Ctrl+V | Copy, cut and paste ([Fill and paste](./fill-and-paste)) |
| Ctrl+Z, Ctrl+Y | Undo and redo |
| Ctrl+B, Ctrl+I, Ctrl+U | Bold, italic, underline ([Formatting](./formatting)) |
| Ctrl+F, Ctrl+H | Find, and find and replace, with `findAndReplace` ([Find and replace](./find-and-replace)) |
| Ctrl+K | Add or edit a link, with `hyperlinks` ([Hyperlinks](./hyperlinks)) |
| Alt+Shift+→, Alt+Shift+← | Group and ungroup rows, with `rowGroups` ([Row groups](./row-groups)) |

On a Mac, ⌘ works as Ctrl.

`enterMoves` and `tabMoves` set where Enter and Tab go, as `{ row, col }` steps:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['', '', ''], ['', '', ''], ['', '', '']],
  colHeaders: true,
  rowHeaders: true,
  enterMoves: { row: 0, col: 1 }, // Enter goes right, as Tab does
  autoWrapRow: true, // and on to the next row at the end of a row
});
```

## Keys of your own

`beforeKeyDown` gets every key the grid gets, before the grid handles it. Call `stopImmediatePropagation()` on the
event to keep the grid from handling it:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Copy me'], ['Select me and press Ctrl+D'], [''], ['']],
  colHeaders: true,
  rowHeaders: true,
  colWidths: 240,
});

grid.addHook('beforeKeyDown', (event) => {
  const [row, col] = grid.getSelectedLast() || [];

  if ((event.ctrlKey || event.metaKey) && event.key === 'd' && row > 0) {
    grid.setDataAtCell(row, col, grid.getDataAtCell(row - 1, col));
    event.preventDefault();
    event.stopImmediatePropagation();
  }
});
```

A grid listens to the keyboard after a click in it; `listen()` and `unlisten()` give or take the keyboard from code,
and `isListening()` tells whether it has it.
