---
api: [Change history]
---

# Change history (Show Changes)

`changeHistory` records what users change. Each change keeps:

- its time and the user's name;
- the cells it touched, with each one's old and new value;
- for rows and columns added or removed: where and how many.

The **Changes** side panel lists the changes, newest first and grouped by day.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Item', 'Price', 'Stock'],
    ['Laptop', 1299, 12],
    ['Monitor', 249, 4],
    ['Keyboard', 79, 48],
  ],
  colHeaders: true,
  rowHeaders: true,
  changeHistory: { user: 'Ada' }, // the name shown with each change
  sidePanel: true,
  contextMenu: ['undo', 'redo', '---------', 'show_changes'],
});

// Two changes, so the panel has something to show. Edit a cell to add one.
grid.setDataAtCell(1, 1, 1199);
grid.setDataAtCell([[2, 2, 0], [3, 2, 40]]);
grid.openPanel('changes');
```

- **What is recorded:** typing, a paste, a fill, Replace all and an undo are each one change, however many cells they
  touch. Loading data is not recorded.
- **The panel** shows up to five old → new values for each change. A click selects the changed cells; in a document,
  it switches to their sheet. **The selected cells** shows only the changes of the selection.
- **`limit`** keeps the last changes, 1000 by default.

From code:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Ana', 31], ['Ben', 27], ['Cleo', 45]],
  colHeaders: ['Name', 'Age'],
  changeHistory: true,
});
const history = grid.getPlugin('changeHistory');

grid.addHook('afterChangeRecorded', (change) => {
  // For example, send it to your server.
  console.log(change.kind, change.cells);
});

grid.setDataAtCell(0, 1, 32);
grid.alter('insert_row', 3);
console.log(history.getChanges().length); // 2
// history.clearChanges() forgets them.
```

`getChanges()` gives `[{ id, time, user, kind, cells: [{ row, col, before, after }], index, amount, source }]`,
oldest first.

`kind` is `'edit'`, `'insert_row'`, `'remove_row'`, `'insert_col'` or `'remove_col'`. `row` and `col` are rows and
columns of the data (`getSourceData`).

The history lives in the page: it is not saved by `getDocument()`. To keep it, save what `afterChangeRecorded` gives
you.
