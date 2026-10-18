# FreeGrid changelog

## Unreleased

### Added

- `fillContainer: true`: empty rows and columns fill the grid's element to its edges, as in a spreadsheet, and more
  are added when the element grows.
- Formatting bar: strikethrough is one of the default buttons; the borders list shows an icon for each kind, and the
  borders button shows the kind it draws (the last one chosen).
- Excel (.xlsx) and CSV files, read and written by FreeSheet itself (no dependency): `exportFile(format, options)`
  (a Blob), `downloadFile(format, filename, options)`, `importFile(source, options)` (an .xlsx file replaces the
  document; CSV replaces the active sheet's data). An Excel file keeps the sheets, values and formulas (with their
  results), number and date formats, cell styles and alignment, column widths and row heights, merged, hidden and
  frozen cells, conditional formatting and comments. Options `headers` (the column headers as a first row) and
  `delimiter` (CSV). Events `beforeImportFile`, `afterImportFile`, `afterExportFile`. New guide page and example.
- Loading state: `setLoading(true | text | false)` and `isLoading()`: a layer with a spinner over the grid that takes
  the clicks while the grid ignores the keyboard (`aria-busy` for screen readers). `importFile` shows it while it
  reads a file.
- Cell styles: the `style` cell setting (`fontWeight`, `fontStyle`, `textDecoration`, `color`, `background`,
  `border`) draws on the cell, under conditional formatting; `getDocument()` keeps it.
- Formatting: Ctrl+B, Ctrl+I and Ctrl+U toggle bold, italic and underline; the context menu has a **Format** entry
  (bold, italic, underline, strikethrough, text and fill colors, clear formatting; add the key `'formatting'` to
  `contextMenu`); `setCellStyle(style, ranges?)` sets the `style` of cells; undo takes formatting back. Event
  `afterSetCellStyle`.
- Formatting bar (`formattingBar: true`, or `{ items }` to choose the buttons): a toolbar above the context menu, as
  in Excel, with bold, italic, underline, fill and text colors, alignment and clear formatting. Its color palettes (also
  in the menu's Text color and Fill color) show a color on the selected cells while the pointer is on it; a click keeps
  it. "More colors…" opens a color area with a hex field: the cells show the color while you choose, OK keeps it, and
  Cancel, Escape or a click elsewhere leaves the cells as they were. New example page.
- Status bar (`statusBar: true`, or `{ items }`): a bar below the grid and its sheet tabs, as in Excel, with the
  average, count and sum (or `numericalCount`, `min`, `max`) of the selected cells; in a document it follows the
  active sheet. Items of your own (`{ label, value }`, at the left with `align: 'left'`), renamed or formatted
  built-in items, and `format` as `Intl.NumberFormat` options or a function, for the bar or one item; `refresh()`.
  New guide page.
- Freezing from the context menu: the `'freeze'` entry (not in the default menu) freezes panes at the selected cell,
  the top row or the first column, or unfreezes.
- Find and replace (`findAndReplace: true`): Ctrl+F opens a find box at the top right of the grid that highlights
  the matches and goes through them ("2 of 5"); Ctrl+H adds Replace and Replace all (one undo step). Options: match
  case, entire cell, search in formulas. Read-only cells stay. The plugin's `find` and `replace` work from code. New
  guide page.
- The fill handle goes on with series, as in a spreadsheet: numbers by their step, dates (by days, or by months when
  they share the day; date cells in their `dateFormat`), month and weekday names, and text that ends with a number
  (`Item 1` → `Item 2`). A single number, other text and formulas repeat as before. New guide page "Fill and paste".
- Copy and paste keep formatting: a copy writes bold, italic, underline, strikethrough, colors and alignment into the
  clipboard's HTML, and a paste of a table from FreeSheet, Excel or Google Sheets gives the cells that formatting
  (one undo step with the values). `copyPaste: { formats: false }` pastes values only.
- Formatting bar: **Borders** (bottom, top, left, right, all, outside, thick outside, none), **Number format**
  (General, Number, Currency, Percent) and the **Format painter** (copies style, alignment and number format to the
  next selected cells; Escape cancels). Each is one undo step; event `afterSetCellFormat`.
- Cell borders per side: `borderTop`, `borderRight`, `borderBottom` and `borderLeft` in the `style` setting, drawn
  inside the cell (so its size never changes; `border` too), and kept side by side in Excel files.
- Row groups (`rowGroups: true`), as Excel's outline: group adjacent rows (context menu, Alt+Shift+→ and ←, or
  `getPlugin('rowGroups').groupRows(from, to)`) in up to 7 levels; a −/+ button in the row headers collapses a group,
  and the corner's level buttons show the outline down to a level. Groups follow added and removed rows;
  `getDocument()` and Excel files (`outlineLevel`) keep them. New guide page.
- Data validation: a cell's or a column's `validation` (`list` with a dropdown, `number`, `integer`, `date`,
  `textLength` with an operator) refuses other values, or with `strict: false` keeps and marks them; `message` and
  `inputMessage` explain the rule. The side panel `'dataValidation'` (context menu key `'data_validation'`) sets rules on
  the selected cells in one undo step. `getDocument()` and Excel files keep them. New guide page.
- The context menu shows an icon at the left of each built-in entry and its keyboard shortcut at the right (Ctrl+Z,
  Ctrl+C, Ctrl+B…; ⌘ on a Mac); entries of your own take `icon` and `shortcut`. The Modern style gives the menu round
  corners, a shadow and round hovered entries. New CSS variables `--fs-menu-icon-color`, `--fs-menu-shortcut-color`.
  New guide page "Context menu".
- Paste and Paste Special in the context menu (keys `'paste'` and `'paste_special'`): values only, formulas only,
  formatting only, transposed; formulas move with the paste (`=A1` becomes `=C3`); one undo step.
  `getPlugin('copyPaste').pasteSpecial(mode)`.
- Hyperlinks: a cell's `link` setting makes its text a link; a card under the selected link shows the address (opens in
  a new tab), Edit and Remove; Ctrl+click opens it; Ctrl+K (or Insert link in the context menu, key `'link'`) edits
  text and link in one undo step. Only web and mail links are kept. `getDocument()` and Excel files keep them. Plugin
  `hyperlinks` (on unless `false`). New guide page.
- Font and font size: `fontFamily` and `fontSize` (points, `'14pt'`) in the `style` setting; the formatting bar starts
  with a font list (each font shown in itself) and a size field with a list. Rows grow to fit their biggest font.
  Excel files keep the font and its size.
- Change history ("Show Changes", `changeHistory: { user, limit }`): every edit (old and new values), and rows and
  columns added or removed, with the time and the user. The side panel `'changes'` (context menu key `'show_changes'`)
  lists them newest first by day; a click selects the cells; a filter shows only the selected cells' changes. Plugin
  methods `getChanges()`, `clearChanges()`; event `afterChangeRecorded`. New guide page.
- Column groups as an outline (`columnOutline: true`), as Excel's Group for columns: brackets and −/+ buttons in a
  gutter above the column headers, level buttons in the corner, Group columns and Ungroup columns in the context menu,
  `getPlugin('columnOutline').groupColumns(from, to)`. `getDocument()` and Excel files keep them. Row groups and
  column groups share one outline model.
- `getDocument()` and `loadDocument()` keep frozen rows and columns (`fixedRowsTop`, `fixedColumnsLeft`).

- Docs:
  - the guide is grouped by topic (Data, Rows and columns, Editing, Look, Menus and panels, Extending), with new
    pages Formatting, Sorting, Comments and merged cells, and Selection and keyboard;
  - live examples in the guide pages: each code block that makes a grid shows it working;
  - every example has **Copy code** and **Open in playground** (LiveCodes, with the package from npm);
  - each guide page ends with the API of its topic: settings, methods, events and plugin methods with their signature
    and a one-line description;
  - the API reference lists every plugin (row groups, column outline, data validation, hyperlinks, change history,
    find and replace, status bar, formatting bar and others were missing) and the settings and events of filters, the
    column menu, hidden rows and columns, nested rows and nested headers.

### Fixed

- The column menu's ▾ button stays next to the header's name when a column outline draws its gutter in the header
  (it was drawn in the gutter), and headers with a gutter are no longer made again at every render.
- A context menu that fits neither below nor above the cell stays in the window: as low as the window allows, and a
  menu taller than the window scrolls inside. In the Modern style, the menu's frame holds all its items (the last ones
  were drawn outside it).
- The formatting bar's font size field is as wide as its value (`10.5`, `100`).
- Text on a fill is readable in every theme: a cell style or a conditional formatting rule with a background and no
  text color gets dark text on a light fill and white text on a dark one (`--fs-text-on-light-fill`,
  `--fs-text-on-dark-fill`). Before, a light fill in the dark theme had light text.
- In a document of several sheets, new settings for a sheet that is not shown no longer show its formula bar.
- A sheet with `minSpareRows` (or `minSpareCols`) in a document with formulas no longer fails while it is created.
- Conditional formatting: in a narrow column, an icon set's icon and its number stay on one line instead of the
  number moving under the icon and making the row twice as tall.
- Links in cells and the text of read-only cells are readable on the cell background (WCAG AA contrast): links have
  their own color, `--fs-color-link` (`#0563c1`, and `#6cb6ff` in the dark theme), instead of the accent color, and
  read-only text is `#6e6e6e` instead of `#777`.
- Types: `setCellStyle` and the `style` setting take every style property (`fontFamily`, `fontSize` and the borders
  of each side); `CellStyle` is a type of its own.
- The cell editor no longer takes the focus back a moment after a cell is selected while the grid does not have the
  keyboard (a box outside the grid, such as find and replace, keeps it).
- A command in a submenu inside a submenu (Conditional formatting ▸ Data Bars ▸ a color) did nothing when clicked, and
  left the first menu open.
- `updateSettings` on a sheet with formulas no longer makes the formula engine's model again when `formulas` did not
  change: in a document with several sheets this freed the model the other sheets use (`loadDocument` with formulas
  failed).

## 0.7.0 (2026-10-17)

FreeSheet becomes a data tool: hidden rows and columns, filters with a column menu (and conditions of your own),
nested rows as a tree grid, column groups written in `columns`, conditional formatting as in Excel, and a side panel
for comments and formatting rules.

### Added

- Hidden rows and columns (`hiddenRows`, `hiddenColumns`): hide them from the context menu (Hide rows, Show rows,
  Hide columns, Show columns) or with `getPlugin('hiddenRows').hideRows(rows)`, `showRows`, `showAllRows`,
  `isHidden`, `getHiddenRows` (and the same for columns). A hidden row leaves the visual order: `countRows()`,
  selection, the arrow keys and copying skip it. Headers keep the numbers and letters of the visible rows and
  columns (1, 2, 5; A, B, E) and mark hidden ones with a double line and small arrows; a click on an arrow (a button
  with a tooltip that lists them, "Show rows: 2–3") shows them. Hidden rows stay hidden when rows are sorted or
  moved, move with their data when rows are inserted or removed, can be undone, and are saved by `getDocument()`.
  New events `before/afterHideRows`, `before/afterUnhideRows`, `before/afterHideColumns`,
  `before/afterUnhideColumns`. New guide page and example.

- Filters (`filters`): hide the rows whose values do not meet conditions. `getPlugin('filters')` with
  `addCondition(column, name, args, operation)`, `removeConditions`, `clearConditions`, `filter`, `getConditions`,
  `getColumnValues`, `exportConditions` and `importConditions`. Conditions for text, numbers and dates (`eq`,
  `contains`, `gt`, `between`, `date_before`, `empty`, …), two per column joined with AND or OR, and value lists
  (`by_value`). Filtered rows are hidden rows (selection, the arrow keys and copying skip them, sorting keeps the
  filter); an edited row stays visible until the next filter unless `reapplyOnChange` is set. Events `beforeFilter`
  (return `false` to cancel) and `afterFilter`; `getDocument()` saves the conditions.
- Custom filter conditions: `FreeSheet.filters.registerCondition(name, { title, arity, types, test })` adds a
  condition (or replaces a built-in one) for every grid; the column menu offers it for the column types it lists.
  `FreeSheet.filters.getCondition` and `getConditionNames`.
- Column menu (`dropdownMenu`): a ▾ button in each column header opens a menu with sorting, filtering by condition and
  by values (a checkbox list with search), Clear filter and Hide column. Items can be chosen and custom items added.
  A filtered column shows a funnel; the row numbers of a filtered sheet turn blue. New guide page and example.

- Nested rows (`nestedRows`): rows with children in `__children` (or `childrenKey`), as a tree grid. A ▾/▸ button
  in the row header (or `toggle: 'column'`, in the first column) expands and collapses a parent; Alt+Shift+→/←,
  the context menu (Insert child row, Indent, Outdent, Expand/Collapse, Expand all, Collapse all) and the API
  (`expand`, `collapse`, `toggle`, `expandAll`, `collapseAll`, `addChild`, `indent`, `outdent`, `getParent`,
  `getChildren`, `getLevel`, `getRowNumber`, `getSourceData`). `numbering: 'outline'` numbers the rows 1, 1.1, 1.2;
  `collapsed` starts collapsed. Sorting sorts each parent's children; filtering shows the matching rows and their
  parents. Indent and Outdent never move rows, so formulas keep their references. `getDocument()` saves the tree and
  the collapsed parents. New events `before/afterRowExpand`, `before/afterRowCollapse`; `beforeAddChild`,
  `afterAddChild`, `beforeDetachChild` and `afterDetachChild` are fired. New guide page and example.
- Column groups: a column with `columns` of its own is a group, shown in a header row above its columns; groups can
  be nested. `collapsible: true` gives a group a − / + button, `collapsed: true` starts it collapsed, and
  `showWhenCollapsed: true` marks the column it keeps (a total). `hidden: true` on a column starts it hidden. A click
  on a group selects its columns; columns move only inside their group. API `getPlugin('collapsibleColumns')`:
  `collapse`, `expand`, `isCollapsed`, `collapseAll`, `expandAll`; events `before/afterColumnCollapse` and
  `before/afterColumnExpand`. `nestedHeaders` and `collapsibleColumns: [{ row, col, show }]` work too, for older
  configurations. New guide page and example.
- Conditional formatting (`conditionalFormatting`): rules over A1 ranges (or a column's `format`) that format cells
  from the value they show, formula results included. Conditions (`gt`, `between`, `contains`, `empty`, dates in a
  period, custom conditions), `duplicate` / `unique`, `top` / `bottom` (count or percent), `aboveAverage` /
  `belowAverage`, formulas (`'=$F2<0'`, with `formulas`); color scales, data bars and icon sets (arrows, traffic
  lights, signs). Priority by order, `stopIfTrue`. Ranges move with inserted and removed rows and columns. API
  `getPlugin('conditionalFormatting')`: `addRule`, `updateRule`, `removeRule`, `moveRule`, `getRules`, `getRulesAt`,
  `clearRules`; event `afterConditionalFormattingChange`; `getDocument()` saves the rules. New date conditions
  `date_last_7_days`, `date_this_week`, `date_last_week`, `date_next_week`, `date_this_month`, `date_last_month`,
  `date_next_month`. New guide page and example.
- Side panel: `openPanel(name)`, `closePanel()`, `getOpenPanel()`, events `afterPanelOpen` and `afterPanelClose`,
  setting `sidePanel` (`true`, or a panel to open at start). In the document's frame the sheets make room for it;
  otherwise it opens over the grid. **Comments**: every comment of every sheet with its cell, author and date; a click
  selects the cell (switching the sheet); edit, delete and New in place; Show all comments in the context menu.
  **Conditional formatting**: Conditional formatting ▸ in the context menu (Highlight Cell Rules, Top/Bottom Rules,
  Data Bars, Color Scales, Icon Sets, New Rule, Clear Rules, Manage Rules), a rule editor with a live preview, and a
  rule manager. New guide page.
- `beforeLoadData` event: a callback can return the data to load instead.

### Fixed

- `getCellsMeta()` no longer returns empty entries for rows whose cells were never read.
- With `stretchH`, the columns no longer lose a scrollbar's width (and the column headers no longer drift away from
  the cells) when the selected cell is in the last row of a grid without a height: the fill handle sticks out a few
  pixels but shows no scrollbar.

## 0.6.0 (2026-10-16)

Sheets: one document with several sheets and a tab bar, as in Excel. Formulas work across sheets (`=Costs!B2`).
`getDocument()` and `loadDocument()` save and load the whole document.

### Added

- Sheets: one document can hold several sheets, as an Excel file. The grid created with `new FreeSheet` is the first
  sheet (`Sheet1`); `addSheet(id, { name, data, … })` adds more and returns their grids, and `getSheet`,
  `getSheets`, `getActiveSheet`, `activateSheet`, `renameSheet`, `removeSheet`, `moveSheet`, `getSheetId` and
  `getSheetName` work from any sheet. The `sheets` setting creates sheets with the grid, `sheetName` and `sheetId`
  name the first one, `sheetTabs` controls the tab bar. The tab bar below the sheets switches sheets, adds one (+),
  renames one (double click), deletes or moves one (right click, or drag). New events `before/afterSheetAdd`,
  `…Activate`, `…Rename`, `…Remove` and `afterSheetMove`. With formulas, sheets share one engine: `=Costs!B2`
  works, renaming a sheet updates the formulas, removing it shows `#REF!`. `sheetTabsPosition: 'top'` puts the
  tabs above the sheets. `getDocument()` returns every sheet (data with formulas, changed sizes, merged cells, cell
  formats) as JSON-safe data, and `loadDocument()` loads it back. With `formulaBar`, `sheets` or `sheetTabs` set at
  creation, the given element holds the formula bar, the sheets and the tabs, and the sheet fills the height left.
  New guide page and two examples.

## 0.5.0 (2026-10-16)

Formulas, through the IronCalc engine (`formulas: { engine }`), and a formula bar above the grid. Large grids scroll
smoothly: at 1,000,000 rows the slowest frames fell from about 580 to 50 ms. Faster data operations (removing many
rows, pasting, inserting and removing rows and columns). New `getColumnMeta`.

### Added

- Formulas: cells that start with `=` show their result (`=SUM(A1:A3)`, `=B2*C2`, …). FreeSheet has no engine of its
  own; pass one with `formulas: { engine }`, for example IronCalc's `Model` from `@ironcalc/wasm` (tested with 0.8.4),
  so `@freegrid/sheet` keeps no dependencies. The editor and `getSourceDataAtCell` show the formula; `getDataAtCell`,
  the renderers, copying and sorting use the result. Inserting and removing rows and columns moves the references
  and updates the formulas in the data; errors get the class `fs-formula-error`. New guide page and example.
- Formula bar (`formulaBar: true`): a bar above the grid, as in Excel, with the selected cell's address and its
  formula or value. Edit the cell there (<kbd>Enter</kbd> writes, <kbd>Escape</kbd> cancels), or type an address
  such as `F6` to select that cell. It follows the grid's theme and can be turned on or off with `updateSettings`.
- `getColumnMeta(column)`: the column meta, the grid settings together with the column's settings from `columns`.
  Every cell meta of the column inherits from it. Unlike `getCellMeta`, it creates no cell meta and runs no hooks.

### Changed

- Column sorting reads a column's settings (`type`, `dateFormat`, `columnSorting`, …) from the column meta, not from
  the column's first cell. Settings that only the `cells` function or `cell` give to row 0 no longer affect sorting
  (#65).
- Faster data operations on large grids, with the same results and the same hook calls:
  - removing many rows at once (10,000 of 100,000 rows: about 59 → 27 ms);
  - inserting or removing many rows or columns while rows are sorted or rows/columns are moved;
  - column headers no longer scan the source columns when `columns` is not a function (pasting 100 cells into
    an object-based grid: about 27 → 17 ms);
  - writing to nested properties (`a.b.c`) splits the property path once, which helps large pastes.
- Scrolling and jumping deep into a large grid no longer adds up the height of every row above the viewport when all
  rows have the same base height (no per-row `rowHeights`, no `modifyRowHeight` hook). Rows that turn out taller,
  for example with wrapped text, are added on top without slowing this down.
  At 1,000,000 rows the 95th-percentile frame gap while scrolling fell from about 150 to 33 ms, and a jump to the
  middle from about 132 to 29 ms. Other grids keep the previous calculation.

### Internal

- `tools/performance`: benchmarks on the production build (browser scenarios and microbenchmarks), used to measure
  every performance change before and after.
- Column sorting no longer keeps its own cache of the columns' settings, and no longer clears it when columns are
  added or removed (#65).

## 0.4.0 (2026-10-14)

The spreadsheet is now called FreeSheet: new names for the class, the global, the files and the CSS classes and
variables. The repository moved to `freegrid-web/sheet`, and the whole library, including the rendering engine, is
written in TypeScript.

### Breaking

- The spreadsheet is now called **FreeSheet**. FreeGrid stays the name of the project and of the `@freegrid/*`
  package family; later components get their own names (for example FreeGantt).
  - `import FreeSheet from '@freegrid/sheet'`, `new FreeSheet(element, settings)`. The global is
    `window.FreeSheet`, and the type declarations use `FreeSheet` too.
  - The files in `dist/` are `freesheet.js`, `freesheet.css`, `freesheet.full.min.js`, … (they were `freegrid.*`),
    and the type declarations are `types/freesheet.d.ts`.
  - The jQuery plugin is `$(element).freesheet(…)`.
  - CSS: the root class is `freesheet` (was `freegrid`), class names start with `fs-` (were `fg-`), the CSS variables
    start with `--fs-` (were `--fg-`), and the theme attributes are `data-fs-theme` and `data-fs-style` (were
    `data-fg-…`). The old names are not kept: there were no users of them yet.

### Internal

- The rendering engine (Walkontable) is written in TypeScript; the whole library is TypeScript now.
- The repository is `freegrid-web/sheet` (was `freegrid-web/freegrid`), and the docs are at
  https://freegrid-web.github.io/sheet/. The package's folder is `packages/sheet` (was `packages/freegrid`).

## 0.3.0 (2026-10-14)

The package is now `@freegrid/sheet`. The whole grid is written in TypeScript (only the rendering engine is still
JavaScript). A review of known bugs brought more than twenty fixes, among them pasting, undo, sorting, validation,
the context menu and `updateSettings`. Several security fixes for pasted HTML and prototype pollution.

### Breaking

- The npm package is renamed from `@freegrid/core` to `@freegrid/sheet`: FreeGrid is an Excel-style spreadsheet, and
  `@freegrid/core` is kept for a core shared by future FreeGrid components. Install `@freegrid/sheet` and change the
  imports (`import FreeGrid from '@freegrid/sheet'`, `@freegrid/sheet/dist/freegrid.css`,
  `@freegrid/sheet/languages/…`). `FreeGrid.packageName` is `'@freegrid/sheet'`. The API does not change.
- Editors, renderers and validators have uniform names, the kind first: `FreeGrid.editors.EditorText`,
  `EditorAutocomplete`, `EditorDate`, …; `FreeGrid.renderers.RendererText`, `RendererNumeric`, …;
  `FreeGrid.validators.ValidatorDate`, `ValidatorTime`, … The old names (`TextEditor`, `TextRenderer`,
  `DateValidator`, `cellDecorator`, …) are removed. Names in settings (`type: 'date'`, `editor: 'text'`,
  `renderer: 'numeric'`) do not change. See [Migrating from Handsontable](https://freegrid-web.github.io/sheet/guide/migrating-from-handsontable#editor-renderer-and-validator-names).
- Editors are ES classes. A custom editor made with `FreeGrid.editors.EditorText.prototype.extend()` or
  `class MyEditor extends FreeGrid.editors.EditorText` keeps working; one that calls a parent editor as a function
  (`EditorText.call(this, instance)`) must use `class … extends` instead.
- `beforeChange` runs before the validators (it used to run after them), so a change it cancels is not validated,
  and the validators get the values `beforeChange` set (#80).

### Security

- Pasting HTML could run code from it (e.g. an image's `onerror`): the pasted table was put into an element's
  `innerHTML`. Pasted HTML is now parsed into an inert document.
- Prototype pollution (CodeQL):
  - a dotted data property through `__proto__`, `constructor` or `prototype` (e.g. `setDataAtRowProp(0,
    '__proto__.x', 1)`) changed `Object.prototype`; such a property is ignored;
  - `getCellMeta('__proto__', 0)` (or `constructor` / `prototype` as an index) wrote into `Array.prototype`; such an
    index throws;
  - `FreeGrid.helper.extend` skips `__proto__` and `constructor` keys, and `deepExtend` merges only into the
    target's own values (it could reach `Object.prototype`).
- `FreeGrid.helper.stripTags` repeats until no tag is left, so `<<b>script>` no longer becomes `<script>`.
- Checking whether a numeric cell's text is a number took quadratic time on long runs of spaces.

### Fixes

- Data and settings:
  - `clear()` keeps the selection; it left every cell selected (#82).
  - `loadData` drops the row and column order a user made with `manualRowMove` / `manualColumnMove`; an order given
    in the settings (an array) applies to the new data (#78).
  - `updateSettings` replaces the old `className` and `tableClassName`, hides the column headers when `colHeaders`
    is turned off, applies new `currentRowClassName` / `currentColClassName` / header class names, and keeps a column
    frozen with `freezeColumn` in place (#79).
  - A row or column removal that `beforeRemoveRow` / `beforeRemoveCol` cancels keeps the cell meta and the frozen
    rows or columns; removing index groups removes the meta of every removed row (#79).
  - A function in `enterMoves` gets the key event (it got the browser's global `window.event`).
  - A column header that had to be rebuilt ran `afterGetColHeader` twice.
- Undo: an edit that changes nothing is no undo step; undoing a row removal brings back the values of read-only
  cells and the rows' cell meta; undoing an inserted row or column keeps the frozen rows and columns (#74).
- Undo of a column removal restores the column order made with `manualColumnMove` (it scrambled the columns and
  could lose a value), and puts columns back in the right place when their indexes have two digits (#67).
- Copy and paste: text with `""` outside a quoted cell (e.g. JSON with an empty string) keeps its quotes (#75); a
  paste event without clipboard data is ignored (it threw an error).
- Column sorting: booleans sort `false` first, time cells sort by time, and the sort config moves with its column
  when columns are inserted or removed (#76).
- Context menu: an empty item list (`contextMenu: []`) opens nothing; alignment and "Read only" work after
  select-all; alignment covers a selection made upward (#77).
- Cell types and editors:
  - the select editor keeps the order of options given as an array of numbers (#81);
  - an emptied checkbox cell is unchecked instead of `#bad-value#` (#81);
  - a non-strict autocomplete cell respects `allowEmpty: false` (#80);
  - case-sensitive autocomplete (`filteringCaseSensitive`) bolds the typed text in the list;
  - the date editor kept `closeEditor`'s callback from running: after an async validation, the next cell's editor
    did not open.
- Plugins:
  - merged cells: clearing them (`clearCollections`, e.g. on `updateSettings`) left the cells a merged cell had
    covered invisible until the next render;
  - the `persistentStateReset` hook with a key cleared every saved value; it clears only that key;
  - touch screens: releasing one of two dragged selection handles stopped the other one;
  - manualColumnResize: a column header with `colspan="1"` gets the resize handle too;
  - a context submenu's class name replaces any character other than a letter or a digit with `_`.

### Deprecated (removed in 1.0)

- The `modifyRowData` hook: use `modifyData`. Adding a listener to it logs a warning once (#69).
- `populateFromArray`'s `direction` argument, which has no effect (#68).

### Changed

- Every grid method works without `this` (`const { selectCell } = hot`), and after `destroy()` every method throws.
- The TypeScript definitions have `FreeGrid.validators` (with `Validator`), and `getRenderer`/`registerRenderer`.
- Docs:
  - the API reference lists the settings `isEmptyRow` and `isEmptyCol`, shows the right description for
    `observeDOMVisibility`, and plugin methods with their TypeScript types; every entry has an example or a usage
    block; the right-hand lists are alphabetical with a filter box;
  - a live example's sticky column header stays under the top bar when the page scrolls;
  - a roadmap with the current status.

### Internal

- The whole grid is TypeScript except the rendering engine (Walkontable): the core (`Core` is a class with
  `#private` state), plugins, editors, renderers, validators, selection, helpers and utilities. Plugins declare
  what they add to the grid, and `getPlugin('mergeCells')` returns the `MergeCells` type.
- Cleanup: no unused `eslint-disable` comments (lint reports them now), no TODO/FIXME comments (the open work is in
  issues #65–#71), fewer `any`, stricter lint rules; the four specs skipped since the move to current Chromium run
  again (#1–#4).
- `AGENTS.md` describes the commands and rules for coding agents.

## 0.2.0 (2026-10-13)

FreeGrid has no runtime dependencies now: its own date and number formatting and its own date picker replace
moment, numbro and Pikaday. Theming with CSS variables, a dark theme, the Modern style and a complete API reference.

- Docs: a complete API reference, generated from the source code at every docs build:
  - [Methods](https://freegrid-web.github.io/sheet/api/methods): every method, with parameters, return value and
    examples.
  - Events: every event, with its arguments.
  - Settings: every setting, with its type and default.
  - Plugins: each plugin's setting and methods.

  Entries are grouped by topic and searchable. Guide pages list every related method, event and setting in a
  "Related API" column: on the right on wide screens, at the end of the page on narrow ones. Settings and events of
  features FreeGrid does not have (filters, formulas, nested headers, hidden rows/columns, …) are not listed.
  Outdated links and wording in the source code's comments were fixed.
- Modern style has its own look, inspired by modern spreadsheet apps:
  - light grid lines, soft text and light headers in medium weight;
  - a blue accent and a round fill handle;
  - a 14px font (Roboto or the system's sans-serif).

  These colors and the font are *style defaults* (`--fg-style-*`). Base variables that you or a theme set still win
  in Modern, and the dark theme gives Modern its dark colors. New: `--fg-fill-handle-radius`. New:
  `fg-style-classic` / `data-fg-style="classic"`, for a Classic grid inside a Modern page (the closest style wins).
  The Classic look is unchanged.
- Docs:
  - The live examples use Modern; **Grid** in the top bar switches all of them to Classic and back, and the choice
    is remembered.
  - The Theming page's variable tables have a Modern column.
- Numbers without numbro: FreeGrid formats `numericFormat` itself. numbro patterns keep working and give the same
  text; the separators and the currency of `culture` come from the browser (`Intl`), so every locale works without
  language files. Without a `pattern`, `numericFormat` takes `Intl.NumberFormat` options (`style`, `currency`,
  `unit`, `notation`, …). numbro is no longer a dependency: FreeGrid has no runtime dependencies, `freegrid.js` works
  on its own, and `freegrid.full.js` is the same build (it no longer sets `window.numbro`); about 37 KB smaller
  minified. Differences from numbro: `a` uses `k`/`m`/`b`/`t` in every culture, ordinals other than English are
  `.`, and currency symbols are the browser's (`￥` for `ja-JP`).
- FreeGrid's own date picker replaces Pikaday: themed by the `--fg-*` variables (dark theme and Modern style
  included), usable from the keyboard (<kbd>Alt</kbd>+<kbd>↓</kbd> in the editor, then arrows, Page Up/Down,
  Home/End, Enter, Esc), with screen-reader labels. It follows a date typed in the cell. `datePickerConfig` keeps
  Pikaday's option names for `firstDay`, `minDate`, `maxDate`, `disableDayFn`, `disableWeekends`, `yearRange`,
  `i18n`, `onSelect`, `onOpen`, `onClose` and `onDraw`; other Pikaday options are ignored. Pikaday is no longer a
  dependency: the plain UMD build needs only numbro, and every CSS build styles the calendar. Its classes are
  `fg-datepicker*` instead of `pika-*`; the Pikaday-only theme variables are gone and `--fg-datepicker-radius` and
  `--fg-datepicker-focus-color` are new.
- Dates without moment.js: FreeGrid reads and writes `dateFormat` / `timeFormat` itself, with moment's tokens and
  parsing rules, so existing formats keep working. moment is no longer a dependency: the plain UMD build
  (`freegrid.js`) no longer needs it on the page, `freegrid.full.js` no longer bundles it or sets `window.moment`,
  and the ESM build no longer imports it (the full build is about 54 KB smaller minified). Week tokens and
  non-English month and day names are not supported.
- Theming: every color, the font and the shadows come from CSS variables (`--fg-*`, all defined in
  `src/css/variables.css`). Override base variables such as `--fg-color-accent` on `:root`, or component variables on
  `.freegrid`. The default look is unchanged.
- Dark theme: class `fg-theme-dark` or `data-fg-theme="dark"` on the grid or any ancestor; `fg-theme-auto` /
  `data-fg-theme="auto"` follows the system setting; `fg-theme-light` keeps a grid light inside a dark page (the
  closest theme wins). The context menu, the comment editor and the date picker follow the grid's theme.
- Removed the unused styles of the mobile text editor (`.htMobileEditorContainer`); no FreeGrid code creates it.
- The selection border, fill border and fill handle colors are CSS variables instead of fixed colors in JavaScript.
- Borders added from the context menu (Borders > Top/Right/Bottom/Left) use `--fg-custom-border-color` (black in the
  light theme); `getBorders()` reports their color as `var(--fg-custom-border-color)` instead of `#000`.

## 0.1.0 (2026-10-12)

First release on npm, as `@freegrid/core`.

- The npm package is `@freegrid/core` (npm blocks the unscoped `freegrid` as too similar to an existing package).
- FreeGrid is an independent project; versions start at `0.1.0`. The Handsontable compatibility layer is
  a migration aid during `0.x` and will be removed in `1.0.0`.
- Forked from Handsontable 6.2.2 (MIT). Renamed to FreeGrid; a `Handsontable` alias is available via
  `freegrid/compat` (ESM) or `dist/compat.js` (script tag).
- Vite build (ESM + UMD), ES2020 target, Node 24, pnpm. CommonJS output and IE support dropped.
- `@babel/polyfill` removed. `setImmediate`, which 6.2.2 took from that polyfill, is now provided
  internally.
- moment upgraded from 2.20.1 to 2.31 (security fixes CVE-2022-24785 and CVE-2022-31129). Note:
  moment ≥ 2.25 parses some malformed date formats differently (for example `mm/dd/yy`, which means
  minutes/weekday/year); valid formats such as `MM/DD/YYYY` behave as before.
- Removed the unused Handsontable Pro license-key check.
- FreeGrid CSS class names (`fg-` prefix, `freegrid` root class). The legacy Handsontable names stay on every
  element and in the CSS during `0.x` and are removed in `1.0`. Alignment set from the context menu is stored
  as `fg-left`, `fg-center`, … in the cell's `className`.
- Deferred editor focus runs before later timers in Firefox and Safari (fixes focus lost to the editor after
  clicking an input next to the grid, and with several grids on a page).
- Code comments and runtime messages name FreeGrid (e.g. "this FreeGrid instance has been destroyed").
- jQuery plugin available as `$.fn.freegrid`; `$.fn.handsontable` remains as a compatibility name.
- Source code is moving to TypeScript (strict). The first converted module is `helpers/number`; there is no change
  in behavior.
- Removed IE and legacy-browser code. Removed helpers, with what to use instead:
  - `FreeGrid.helper.isIE`, `isIE8`, `isIE9`, `isEdge`, `isMSBrowser`: no replacement; IE and EdgeHTML are not
    supported.
  - `FreeGrid.helper.requestAnimationFrame`, `cancelAnimationFrame`: use `window.requestAnimationFrame` and
    `window.cancelAnimationFrame`.
  - `FreeGrid.helper.isWebComponentSupportedNatively` (Shadow DOM v0), `FreeGrid.helper.hasCaptionProblem`: no
    replacement; no supported browser needs them.
  - IE-only CSS (`-ms-` properties, IE9–11 selection-area fixes) removed from `freegrid.css`.
- Supported browsers are now Chrome/Edge 107+, Firefox 104+ and Safari 16+ (Vite's "Baseline Widely Available"
  set; previously Chrome 80, Firefox 74, Safari 14). On iPhone and iPad this needs iOS 16 or later.

---

# Upstream Handsontable changelog (up to 6.2.2)

All upstream releases are described at https://github.com/handsontable/handsontable/releases
