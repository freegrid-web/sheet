---
api: [Row groups, Column outline]
---

# Row and column groups (outline)

Row groups are a spreadsheet's outline, like Excel's **Data ▸ Group**. Group any adjacent rows, put groups inside
groups, and collapse a group to hide its rows. The data stays flat. For data that is a tree, with parent rows that
hold their children, see [nested rows](./nested-rows).

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Costs', 'Q1', 'Q2'],
    ['Rent', 1200, 1200],
    ['Power', 300, 260],
    ['Internet', 50, 50],
    ['Office total', 1550, 1510],
    ['Travel', 800, 450],
  ],
  rowHeaders: true,
  colHeaders: true,
  contextMenu: true,
  rowGroups: true,
});

grid.getPlugin('rowGroups').groupRows(1, 3); // rows 2 to 4
```

## Using groups

- **Group:** select rows and choose **Group rows** in the context menu, or press **Alt+Shift+→**. **Ungroup rows**,
  or **Alt+Shift+←**, removes the groups inside the selected rows. Without such groups, it removes the innermost
  group that holds them.
- **The gutter:** the row headers get a column per level, with a bracket along each group's rows. Each group's
  **−/+** button is on the row after it, or on the row before it when the group ends the data.
- **Levels:** the corner shows a button for each level. **1** shows only the rows outside all groups, **2** one level
  more, and the last button shows every row. Up to 7 levels, as in Excel.
- **Changing rows:** groups follow rows that are added and removed.

## API

```js
const groups = grid.getPlugin('rowGroups');

groups.groupRows(from, to);    // visual rows
groups.ungroupRows(from, to);
groups.collapseGroup(row);     // the group of a row, or the group whose −/+ is on that row
groups.expandGroup(row);
groups.showLevel(2);
groups.expandAll();
groups.getGroups();            // [{ from, to, level, collapsed }], rows of the data
```

See the [example](../examples/row-groups).

## Column groups

`columnOutline: true` does the same for columns. Each part works like the rows' outline:

- **Gutter:** brackets and **−/+** buttons sit in a gutter above the column headers, and the buttons are on the
  column after each group.
- **Levels:** the level buttons sit one under another in the corner.
- **Context menu:** **Group columns** and **Ungroup columns**.
- **Hiding:** a collapsed group hides its columns.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['North', 120, 135, 128, 383], ['South', 98, 101, 110, 309]],
  colHeaders: ['Region', 'Jan', 'Feb', 'Mar', 'Q1'],
  rowHeaders: true,
  contextMenu: true,
  columnOutline: true,
});
const columns = grid.getPlugin('columnOutline');

columns.groupColumns(1, 3);      // B to D
columns.collapseGroup(1);
console.log(columns.getGroups()); // [{ from, to, level, collapsed }], columns of the data
// columns.expandGroup(1), columns.showLevel(1)
```

This is not the same as [column header groups](./column-groups): those are a title over several columns,
made with `columns`. The outline groups any columns and hides them, as Excel's **Group** does.

Rows and columns can have an outline at the same time.

## Saving

`getDocument()` and Excel files keep the groups of rows and of columns: their levels and the collapsed groups. Imported Excel files show their
outline. A saved document has them as `rowGroups: [{ from, to, collapsed }]`. The grid takes the same list as
`rowGroups: { groups: [...] }`, with rows as data indexes.
