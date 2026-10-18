---
api: [Comments and merged cells]
---

# Comments and merged cells

## Comments

`comments: true` lets users add a note to a cell: right-click it and choose **Add comment**. A small red corner
marks a cell with a comment, and the comment shows while the pointer is on the cell. A cell's comment is its
`comment` setting: `{ value }`, with `author` and `date` when you have them, and `readOnly: true` to keep users from
changing it.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Invoice', 'Amount', 'Paid'],
    ['2026-101', 1200, 'yes'],
    ['2026-102', 860, 'no'],
    ['2026-103', 410, 'no'],
  ],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: true,
  comments: true,
  cell: [
    { row: 2, col: 2, comment: { value: 'Reminder sent on 3 November.', author: 'Ana' } },
    { row: 3, col: 1, comment: { value: 'Discount included.', readOnly: true } },
  ],
});
```

From code, the plugin's methods take visual indexes:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Plan', 'Done'], ['Write', 'yes'], ['Review', 'no']],
  colHeaders: true,
  comments: true,
});
const comments = grid.getPlugin('comments');

comments.setCommentAtCell(2, 1, 'Waiting for the numbers.');
comments.showAtCell(2, 1);
console.log(comments.getCommentAtCell(2, 1)); // 'Waiting for the numbers.'
// comments.removeCommentAtCell(2, 1) removes it.
```

The context menu's comment entries are `'commentsAddEdit'`, `'commentsRemove'` and `'commentsReadOnly'`, and
`'commentsPanel'` opens the [side panel](./side-panel#comments) that lists every comment of the document.
`getDocument()` and Excel files keep the comments.

## Merged cells

`mergeCells: true` lets users merge the selected cells into one: right-click and choose **Merge cells** (again to
unmerge). The merged cell shows the value of its top-left cell. A list merges cells at start: each item has the
top-left `row` and `col`, and how many rows and columns it covers.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Sales 2026', '', '', ''],
    ['Region', 'Q1', 'Q2', 'Q3'],
    ['North', 120, 135, 128],
    ['South', 98, 101, 110],
  ],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: true,
  mergeCells: [{ row: 0, col: 0, rowspan: 1, colspan: 4 }],
  cell: [{ row: 0, col: 0, className: 'fs-center', style: { fontWeight: 'bold' } }],
});
```

From code:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['A', 'B', 'C'], ['D', 'E', 'F'], ['G', 'H', 'I']],
  colHeaders: true,
  mergeCells: true,
});
const merge = grid.getPlugin('mergeCells');

merge.merge(1, 1, 2, 2); // rows 2–3, columns B–C
// merge.unmerge(1, 1, 2, 2) splits it again.
```

`beforeMergeCells`, `afterMergeCells`, `beforeUnmergeCells` and `afterUnmergeCells` run around each change.
`getDocument()` and Excel files keep merged cells.
