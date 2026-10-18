---
api: [Nested rows]
---

# Nested rows

For an outline of flat rows (Excel's Group), see [row groups](./row-groups).

Rows can have children, as in a tree grid. Put a row's children in `__children` and turn on `nestedRows`; a parent
row expands and collapses its children with the ▾ button in its row header.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    { task: 'Design', hours: 10, __children: [
      { task: 'Sketches', hours: 4 },
      { task: 'Review', hours: 6, __children: [{ task: 'Notes', hours: 1 }] },
    ] },
    { task: 'Build', hours: 20 },
  ],
  colHeaders: ['Task', 'Hours'],
  columns: [{ data: 'task' }, { data: 'hours', type: 'numeric' }],
  rowHeaders: true,
  contextMenu: true,
  nestedRows: true,
});
```

Rows must be objects (array rows cannot have children).

## Options

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    { name: 'src', children: [
      { name: 'core.ts' },
      { name: 'plugins', children: [{ name: 'filters.ts' }, { name: 'rowGroups.ts' }] },
    ] },
    { name: 'docs', children: [{ name: 'index.md' }] },
    { name: 'README.md' },
  ],
  colHeaders: ['Name'],
  columns: [{ data: 'name' }],
  rowHeaders: true,
  colWidths: 220,
  nestedRows: {
    childrenKey: 'children',   // the property with the children (default '__children')
    numbering: 'outline',      // row numbers 1, 1.1, 1.2, 2 (default 'flat': 1, 2, 3, as in Excel)
    collapsed: 2,              // true: start with every parent collapsed; a number: the levels shown (1 = top level)
    toggle: 'column',          // the button and the indent in the first column, as a file tree (default 'rowHeader')
    indent: 16,                // pixels per level
  },
});
```

With `numbering: 'outline'`, each row header shows the row's place in the tree (`1.2.1`). Sorted rows are numbered in
their new order; rows a filter hides leave gaps (`1.1, 1.3`).

## Expanding and collapsing

Click the ▾/▸ button, press <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>→</kbd> or <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>←</kbd>
on a selected row, use the context menu (Expand or Collapse, Expand all, Collapse all), or the API:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    { task: 'Design', __children: [{ task: 'Sketches' }, { task: 'Review' }] },
    { task: 'Build', __children: [{ task: 'Grid' }, { task: 'Docs' }] },
  ],
  columns: [{ data: 'task' }],
  rowHeaders: true,
  nestedRows: true,
});
const tree = grid.getPlugin('nestedRows');

tree.collapse(0);                  // visual row
console.log(tree.isCollapsed(0)); // true
// tree.expand(0), tree.toggle(0), tree.collapseAll(), tree.expandAll()
```

Collapsed rows are hidden rows: `countRows()`, selection, the arrow keys and copying skip them. The events
`beforeRowExpand` / `beforeRowCollapse` (return `false` to cancel) and `afterRowExpand` / `afterRowCollapse` get the
parent's physical row.

## Changing the tree

The context menu has **Insert child row** (a new last child), **Indent** (the row becomes the last child of the row
above it on its level) and **Outdent** (the row moves up a level, after its parent; the rows after it under the same
parent become its children, so no row moves). Insert row above and below add a row next to the row below the new one,
on its level. Removing a row removes its children too.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    { task: 'Design', __children: [{ task: 'Sketches' }, { task: 'Review' }] },
    { task: 'Build' },
  ],
  columns: [{ data: 'task' }],
  rowHeaders: true,
  nestedRows: { numbering: 'outline' },
});
const tree = grid.getPlugin('nestedRows');

tree.addChild(0, { task: 'Mockups' }); // a last child of Design: row 3
tree.indent(3);                        // Mockups becomes a child of Review
console.log(tree.getParent(3));        // 2: the visual row of the parent, or null
console.log(tree.getChildren(0));      // [1, 2]: visual rows of the visible children
console.log(tree.getLevel(3));         // 2 (0 for a top-level row)
console.log(tree.getRowNumber(3));     // '1.2.1'
// tree.outdent(3) moves it back up a level.
```

Because indenting and outdenting never move rows, formulas keep their references; inserting and removing rows moves
them as anywhere else.

## Data, sorting and filtering

The grid works with the tree's rows in order, each parent before its children: `getSourceData()`, `countSourceRows()`
and the physical row indexes count every row. `getPlugin('nestedRows').getSourceData()` returns the tree, and
`getDocument()` saves the tree and the collapsed parents.

- **Sorting** sorts the children of each parent; children stay under their parent.
- **Filtering** shows the rows that match and their parents (dimmed), also inside collapsed parents.
- Moving rows by dragging (`manualRowMove`) is not supported together with nested rows.
