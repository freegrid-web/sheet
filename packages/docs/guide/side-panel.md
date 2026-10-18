---
api: [Side panel]
---

# Side panel

The side panel opens at the right of the document, as in Excel: **Comments** lists every comment, **Conditional
Formatting** the formatting rules. It opens from the context menu (Show all comments; Conditional formatting ▸ Manage
Rules, or any rule), or with the API:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(5, 4),
  colHeaders: true,
  rowHeaders: true,
  contextMenu: true,
  comments: true,
  conditionalFormatting: true,
  sidePanel: true,           // the element holds the panel: the sheet makes room for it
  cell: [{ row: 1, col: 1, comment: { value: 'Check this one.', author: 'Ana' } }],
});

grid.openPanel('comments');
console.log(grid.getOpenPanel()); // 'comments'
// grid.closePanel() closes it.
```

With `sidePanel: true` (or a panel's name, which also opens it at start: `sidePanel: 'comments'`) the element you
give FreeSheet holds the formula bar, the sheets, the tabs and the panel; when the panel opens, the sheet gets
narrower. In a container narrower than 600 px, and in a grid without `sidePanel`, the panel opens over the grid. The
panel is 300 px wide (`--fs-side-panel-width`) and follows the grid's theme.

`afterPanelOpen` and `afterPanelClose` get the panel's name. <kbd>Escape</kbd> closes the panel.

## Comments

The Comments panel lists the comments of every sheet, with the cell (`Costs!H4` when there are several sheets), the
author and the date when the comment has them (`comment: { value, author, date }`). A click on a comment selects its
cell, switching to its sheet. The pencil edits a comment in place, the bin deletes it, and **New** adds a comment to
the selected cell.

## Conditional formatting

The context menu gets **Conditional formatting ▸**, as Excel's menu:

- **Highlight Cell Rules ▸** Greater Than, Less Than, Between, Equal To, Text that Contains, A Date Occurring,
  Duplicate Values; and **Top/Bottom Rules ▸** Top 10 items, Top 10 %, Bottom 10 items, Bottom 10 %, Above Average,
  Below Average: these open the rule editor for the selected cells.
- **Data Bars ▸**, **Color Scales ▸** and **Icon Sets ▸** add the rule to the selected cells at once.
- **New Rule**, **Clear Rules ▸** (from the selected cells, from the entire sheet) and **Manage Rules**.

The **rule editor** has the range (*Apply to*, with a button that takes the selected cells), the kind of rule
(highlight, top or bottom, data bar, color scale, icon set, formula), its condition and values, *Stop if true*, and
the format: six styles as in Excel, or a custom fill, text color, bold and italic. The grid shows the rule while you
edit it; **Done** keeps it, **Cancel**, the back arrow, <kbd>Escape</kbd> or closing the panel drop the changes.

**Manage Rules** lists the rules of the selection or of the whole sheet, each with its format, a description and its
range. A click opens a rule in the editor, **+** adds one, the arrows change the priority and the bin deletes a rule.

Everything the panel does goes through the plugin's API (`getPlugin('conditionalFormatting')`), so the rules are the
same as the ones in the settings.
