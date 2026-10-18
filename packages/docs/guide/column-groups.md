---
api: [Column groups]
---

# Column groups

A title over several columns, such as a year over its quarters. (To fold any columns away as Excel's **Group**
does, see [row and column groups](./row-groups#column-groups).)

A column with `columns` of its own is a group. A header row above the column headers shows the group's `title` over
its columns. Groups can be nested (a year over halves over quarters): each level adds a header row.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    { region: 'North', q1: 120, q2: 135, q3: 128, q4: 140, total: 523, q1_27: 150, q2_27: 155 },
    { region: 'South', q1: 98, q2: 101, q3: 110, q4: 104, total: 413, q1_27: 112, q2_27: 118 },
    { region: 'West', q1: 172, q2: 169, q3: 181, q4: 190, total: 712, q1_27: 195, q2_27: 201 },
  ],
  rowHeaders: true,
  columns: [
    { data: 'region', title: 'Region' },
    {
      title: '2026',
      collapsible: true,                      // a − / + button
      columns: [
        { data: 'q1', title: 'Q1' },
        { data: 'q2', title: 'Q2' },
        { data: 'q3', title: 'Q3' },
        { data: 'q4', title: 'Q4' },
        { data: 'total', title: 'Total', type: 'numeric', showWhenCollapsed: true },
      ],
    },
    {
      title: '2027',
      collapsible: true,
      collapsed: true,                        // starts collapsed
      columns: [{ data: 'q1_27', title: 'Q1' }, { data: 'q2_27', title: 'Q2' }],
    },
  ],
});
```

Everything about a column stays in one place: its data, title, type, width, its group, and whether it is hidden.
The grid works with the columns without children, in order (`getSettings().columns` lists them, and they are the
physical columns).

| On a group | |
| --- | --- |
| `title` | The group's header. |
| `columns` | Its columns (and groups). |
| `collapsible: true` | A − / + button that collapses the group. |
| `collapsed: true` | The group starts collapsed. |

| On a column | |
| --- | --- |
| `showWhenCollapsed: true` | The column that stays when its group is collapsed (the first one when none is marked). |
| `hidden: true` | The column starts hidden; Show columns in the context menu or `getPlugin('hiddenColumns').showColumns` show it. |

A click on a group header selects its columns. Columns can be moved inside their group (`manualColumnMove`), not
out of it or into another group.

## Collapsing with the API

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['North', 120, 135, 255, 150, 155, 305], ['South', 98, 101, 199, 112, 118, 230]],
  columns: [
    { title: 'Region' },
    {
      title: '2026',
      collapsible: true,
      columns: [{ title: 'H1' }, { title: 'H2' }, { title: 'Total', showWhenCollapsed: true }],
    },
    {
      title: '2027',
      collapsible: true,
      columns: [{ title: 'H1' }, { title: 'H2' }, { title: 'Total', showWhenCollapsed: true }],
    },
  ],
});
const groups = grid.getPlugin('collapsibleColumns');

groups.collapse(0, 1);                  // header row (0 = the top), any visual column of the group
console.log(groups.isCollapsed(0, 1));  // true
console.log(grid.getPlugin('nestedHeaders').getGroup(0, 4)); // the 2027 group: its label and columns
// groups.expand(0, 1), groups.collapseAll(), groups.expandAll()
```

Collapsed columns are hidden columns: `countCols()`, selection and copying skip them. The events
`beforeColumnCollapse` / `beforeColumnExpand` (return `false` to cancel) and `afterColumnCollapse` /
`afterColumnExpand` get the header row and the group's first physical column.

## Older configurations

`nestedHeaders` (rows of labels with `colspan`) and `collapsibleColumns` with a list of `{ row, col, show }` still
work, so configurations written for Handsontable keep working. Groups in `columns` say the same more simply; the
older settings will be removed in `1.0`.
