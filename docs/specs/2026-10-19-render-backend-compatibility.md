# Render backend compatibility inventory

Baseline: `535ce612` (main). This is an inventory and migration tracker, not a Canvas support claim.
The public documentation model contains 117 methods, 177 documented events and 39 documented plugins.
`Core_methods.spec.js` additionally protects the complete runtime method list, including legacy/private names.
The API reference model must stay identical during extraction of internal dependencies.

## Current step

The internal `RenderQueries` boundary covers `getCell`, `getCoords`, `rowOffset`, `colOffset`,
`countRenderedRows`, `countVisibleRows`, `countRenderedCols` and `countVisibleCols`.
The Walkontable adapter delegates to the live engine; no snapshots, new public settings or alternate backend
are introduced. Rendered/visible count sentinels, real DOM cell identity and coordinate objects are preserved.
Existing scroll, draw, editor, selection and plugin paths are unchanged.

New integration specs run against unchanged main first. They cover frozen top/left/bottom cell access,
coordinates of child nodes, offscreen nulls, detached public methods, buffers and unrendered sentinels,
sorting/custom TD renderers, before/after render hooks and source replacement. They do not certify all APIs.
Existing Core/plugin/Walkontable suites remain the broader behavioral baseline.

## Command and lifecycle checkpoint on the engine branch

`RenderCommands` now carries synchronous draw, full-cell/row-only/column-only scrolling and engine destruction.
`TableView` uses the live Walkontable command adapter. Core render flags remain owned by the view and are
cleared after a completed draw, in the original order. The view destroys its event manager after engine
cleanup. The adapter preserves optional snap arguments and return values without introducing a scheduler.

Four additional contract specs pass on the pre-extraction engine in Chromium, Firefox and WebKit: snap edges
and independent axes (including fixed/invalid/unrendered requests); synchronous render-hook order and flags;
interrupted hidden draws and recovery; and DOM/listener disposal before afterDestroy while another grid works.
The existing query, method-list, plugin and broader render/destroy suites remain required regression controls.

This checkpoint is developed on `experiment/render-engine`, not as another main-targeted PR. It adds no public
backend setting and does not establish Canvas compatibility for any plugin or event listed below.

### Command checkpoint regression controls

Three measured fresh-page trials plus one discarded warm-up per case, 30 frames and source observation off
in both runs, using `tools/performance/scalability.mjs`. The before build is the archived query-only production
bundle (same runtime implementation as `61d5138f`); the after build is `74728119`.

| Case | Constructor median ms, before / after | Scroll ScriptDuration median ms, before / after | Scroll range ms, before / after |
| --- | ---: | ---: | --- |
| small | 43.0 / 41.5 | 53.2 / 53.2 | 52.7–53.8 / 52.3–54.0 |
| tall100k | 149.2 / 148.8 | 68.3 / 71.0 | 66.6–70.2 / 67.4–72.5 |
| tall1m | 1087.4 / 1090.4 | 228.2 / 214.9 | 221.9–229.0 / 213.9–229.7 |
| wide | 67.1 / 66.3 | 614.2 / 612.3 | 605.9–621.2 / 611.2–615.8 |

ScriptDuration covers the whole 31-mutation scroll sequence, not one frame or input-to-display latency.
The mixed differences in this single pair do not support a speed claim. Viewport snapshots, scroll extents,
DOM cell counts and minimum sort-key checks match across all 24 measured samples.

Environment: Intel(R) Core(TM) i7-14700KF, Chromium 156.0.8078.4, Node v24.21.0.
Before bundle SHA-256: `e076f762e34802b9ae8050feb3b3c982e8a99ca26a067439fa98fd4f97f35709`.
After bundle SHA-256: `58f74d2f4f39d6cf485e4158b6943058aa127513fd049ee28281b6afd88162c8`.
Raw complete reports are ignored at `tools/performance/results/render-command-{before,after}.json`.

### Command checkpoint validation

Lint, typecheck, unit (672), public types, build, dist (24), docs build and docs smoke passed. Full Chromium
and minified suites each ran 2451 specs with no failures; Walkontable ran 264 specs with no failures.
Firefox had 14 matched known failures and WebKit had 13 matched known failures, with no unexpected failures.
Existing pending counts and baseline files were unchanged. The public reference model remains identical.
Four command contract specs also passed on the old bundle in all three browsers before extraction.

## Behavior families

| Family | Required compatibility | Current boundary / next work |
| --- | --- | --- |
| Cell and viewport queries | Real TD/TH identity, clones, null/error behavior, coordinates, partial vs full visibility | Eight query methods extracted; Canvas implementation absent |
| Scrolling and geometry | Snap arguments, return values, fixed panes, RTL, nested containers, zoom, scroll hooks | TableView and direct engine consumers remain |
| Render lifecycle | Renderer/hook order, arguments, invocation semantics, async editor interactions | Existing engine only; inventory callbacks before adaptation |
| Selection and focus | Coordinate/range classes, borders, drag, keyboard, focus ownership, hooks | Existing selection and engine border internals remain |
| Editing and clipboard | Native/editor/plugin lifecycle, IME, paste semantics, validation and history | Existing DOM editors remain; future positioning adapter required |
| Sizing | Settings/functions/live arrays/meta, automatic/manual sizing, content measurement | Existing engine; caches must preserve mutable/callback behavior |
| Element-based APIs | `getCell`, `getCoords`, custom renderers, DOM reads/writes | Explicit real DOM contract; Canvas pixels alone cannot satisfy it |
| Structural/data APIs | Sort/filter/move/insert/remove/load, stable identities, synchronous results | Core/data/plugin ownership stays; future adapter must notify engine |
| Public events | All documented events plus existing callbacks and ordering | Keep current hook dispatch; unchanged reference model is necessary but not sufficient |
| Workbook, export, history, formulas | Same commands/results independent of painter | No changes here; validate again through integrated backend |
| Accessibility | Semantic grid, focus/navigation, screen readers, high contrast | Must be designed and manually validated before default replacement |

## Plugin inventory

All plugins currently run on the existing backend. Every new-backend status is **not yet validated**.
The last column is a static first-pass search of that plugin's TypeScript files for `.wt`, `Walkontable` or
`walkontable`. Imports of coordinate types count too; this is not a count of live engine method calls.
A dash means no direct match was found, not independence: shared base classes, Core methods, DOM and other
plugins can introduce indirect dependencies. `outline.ts`, menu utilities and other shared helpers require
separate call-site review. Each row needs actual behavioral coverage before being marked compatible.

| Plugin | New backend | Direct engine reference files |
| --- | --- | --- |
| AutoColumnSize | Not yet validated | `autoColumnSize/autoColumnSize.ts` |
| AutoRowSize | Not yet validated | `autoRowSize/autoRowSize.ts` |
| Autofill | Not yet validated | `autofill/utils.ts`, `autofill/autofill.ts` |
| ChangeHistory | Not yet validated | — |
| CollapsibleColumns | Not yet validated | `collapsibleColumns/collapsibleColumns.ts` |
| ColumnOutline | Not yet validated | Shared `rowGroups/outline.ts` (inherited) |
| ColumnSorting | Not yet validated | `columnSorting/columnSorting.ts` |
| Comments | Not yet validated | `comments/comments.ts` |
| ConditionalFormatting | Not yet validated | — |
| ContextMenu | Not yet validated | `contextMenu/menu.ts` |
| CopyPaste | Not yet validated | — |
| CustomBorders | Not yet validated | `customBorders/customBorders.ts`, `customBorders/utils.ts` |
| DataValidation | Not yet validated | — |
| DragToScroll | Not yet validated | `dragToScroll/dragToScroll.ts` |
| DropdownMenu | Not yet validated | `dropdownMenu/dropdownMenu.ts` |
| Filters | Not yet validated | `filters/filters.ts` |
| FindAndReplace | Not yet validated | — |
| FormattingBar | Not yet validated | — |
| FormulaBar | Not yet validated | `formulaBar/formulaBar.ts` |
| Formulas | Not yet validated | — |
| HiddenColumns | Not yet validated | Shared `hiddenRows/hiddenIndexes.ts` (inherited) |
| HiddenRows | Not yet validated | `hiddenRows/hiddenIndexes.ts` |
| Hyperlinks | Not yet validated | — |
| ManualColumnFreeze | Not yet validated | `manualColumnFreeze/contextMenuItem/freezeColumn.ts`, `manualColumnFreeze/contextMenuItem/unfreezeColumn.ts` |
| ManualColumnMove | Not yet validated | `manualColumnMove/manualColumnMove.ts` |
| ManualColumnResize | Not yet validated | `manualColumnResize/manualColumnResize.ts` |
| ManualRowMove | Not yet validated | `manualRowMove/manualRowMove.ts` |
| ManualRowResize | Not yet validated | `manualRowResize/manualRowResize.ts` |
| MergeCells | Not yet validated | `mergeCells/mergeCells.ts`, `mergeCells/cellCoords.ts`, `mergeCells/cellsCollection.ts`, `mergeCells/calculations/autofill.ts`, `mergeCells/calculations/selection.ts` |
| MultipleSelectionHandles | Not yet validated | `multipleSelectionHandles/multipleSelectionHandles.ts` |
| NestedHeaders | Not yet validated | `nestedHeaders/nestedHeaders.ts` |
| NestedRows | Not yet validated | `nestedRows/nestedRows.ts` |
| ObserveChanges | Not yet validated | — |
| PersistentState | Not yet validated | — |
| RowGroups | Not yet validated | `rowGroups/outline.ts` |
| Search | Not yet validated | — |
| StatusBar | Not yet validated | `statusBar/statusBar.ts` |
| TouchScroll | Not yet validated | `touchScroll/touchScroll.ts` |
| UndoRedo | Not yet validated | `undoRedo/undoRedo.ts` |

## Documented API names at the baseline

Every name below is **not yet validated on the new backend**. The query boundary above is only an internal
migration marker for the existing engine. These lists come from `buildReference()` at the stated baseline;
refresh them deliberately when the public API changes. The runtime method-list spec also covers legacy/private
methods that are not part of this documented reference.

### Methods

```text
activateSheet addHook addHookOnce addSheet alter clear closePanel colOffset colToProp countCols
countEmptyCols countEmptyRows countRenderedCols countRenderedRows countRows countSourceCols
countSourceRows countVisibleCols countVisibleRows deselectCell destroy destroyEditor downloadFile
emptySelectedCells exportFile getActiveEditor getActiveSheet getCell getCellEditor getCellMeta
getCellMetaAtRow getCellRenderer getCellValidator getCellsMeta getColHeader getColWidth getColumnMeta
getCoords getCopyableData getCopyableText getData getDataAtCell getDataAtCol getDataAtProp
getDataAtRow getDataAtRowProp getDataType getDocument getInstance getOpenPanel getPlugin getRowHeader
getRowHeight getSchema getSelected getSelectedLast getSelectedRange getSelectedRangeLast getSettings
getSheet getSheetId getSheetName getSheets getSourceData getSourceDataArray getSourceDataAtCell
getSourceDataAtCol getSourceDataAtRow getTranslatedPhrase getValue hasColHeaders hasHook
hasRowHeaders importFile isColumnModificationAllowed isEmptyCol isEmptyRow isListening isLoading
listen loadData loadDocument moveSheet openPanel populateFromArray propToCol removeCellMeta
removeHook removeSheet renameSheet render rowOffset runHooks scrollViewportTo selectAll selectCell
selectCellByProp selectCells selectColumns selectRows setCellMeta setCellMetaObject setCellStyle
setDataAtCell setDataAtRowProp setLoading spliceCol spliceRow toPhysicalColumn toPhysicalRow
toVisualColumn toVisualRow unlisten updateSettings validateCells validateColumns validateRows
```

### Events

```text
afterAddChild afterBeginEditing afterCellMetaReset afterChange afterChangeRecorded
afterChangesObserved afterColumnCollapse afterColumnExpand afterColumnMove afterColumnResize
afterColumnSort afterConditionalFormattingChange afterContextMenuDefaultOptions afterContextMenuHide
afterContextMenuShow afterCopy afterCopyLimit afterCreateCol afterCreateRow afterCut afterDeselect
afterDestroy afterDetachChild afterDocumentKeyDown afterDrawSelection afterDropdownMenuHide
afterDropdownMenuShow afterExportFile afterFilter afterGetCellMeta afterGetColHeader
afterGetColumnHeaderRenderers afterGetRowHeader afterGetRowHeaderRenderers afterHideColumns
afterHideRows afterImportFile afterInit afterLanguageChange afterListen afterLoadData afterMergeCells
afterModifyTransformEnd afterModifyTransformStart afterMomentumScroll afterOnCellContextMenu
afterOnCellCornerDblClick afterOnCellCornerMouseDown afterOnCellMouseDown afterOnCellMouseOut
afterOnCellMouseOver afterOnCellMouseUp afterPanelClose afterPanelOpen afterPaste
afterPluginsInitialized afterRedo afterRemoveCellMeta afterRemoveCol afterRemoveRow afterRender
afterRenderer afterRowCollapse afterRowExpand afterRowMove afterRowResize afterScrollHorizontally
afterScrollVertically afterSelection afterSelectionByProp afterSelectionEnd afterSelectionEndByProp
afterSetCellFormat afterSetCellMeta afterSetCellStyle afterSetDataAtCell afterSetDataAtRowProp
afterSheetActivate afterSheetAdd afterSheetMove afterSheetRemove afterSheetRename afterUndo
afterUnhideColumns afterUnhideRows afterUnlisten afterUnmergeCells afterUpdateSettings afterValidate
afterViewportColumnCalculatorOverride afterViewportRowCalculatorOverride beforeAddChild
beforeAutofill beforeAutofillInsidePopulate beforeCellAlignment beforeChange beforeChangeRender
beforeColumnCollapse beforeColumnExpand beforeColumnMove beforeColumnResize beforeColumnSort
beforeContextMenuSetItems beforeContextMenuShow beforeCopy beforeCreateCol beforeCreateRow beforeCut
beforeDetachChild beforeDrawBorders beforeDropdownMenuSetItems beforeDropdownMenuShow beforeFilter
beforeGetCellMeta beforeHideColumns beforeHideRows beforeImportFile beforeInit beforeInitWalkontable
beforeKeyDown beforeLanguageChange beforeLoadData beforeMergeCells beforeOnCellContextMenu
beforeOnCellMouseDown beforeOnCellMouseOut beforeOnCellMouseOver beforeOnCellMouseUp beforePaste
beforeRedo beforeRemoveCellClassNames beforeRemoveCellMeta beforeRemoveCol beforeRemoveRow
beforeRender beforeRenderer beforeRowCollapse beforeRowExpand beforeRowMove beforeRowResize
beforeSetRangeEnd beforeSetRangeStart beforeSetRangeStartOnly beforeSheetActivate beforeSheetAdd
beforeSheetRemove beforeSheetRename beforeStretchingColumnWidth beforeTouchScroll beforeUndo
beforeUnhideColumns beforeUnhideRows beforeUnmergeCells beforeValidate beforeValueRender construct
init modifyAutofillRange modifyCol modifyColHeader modifyColWidth modifyColumnHeaderHeight
modifyCopyableRange modifyData modifyGetCellCoords modifyRow modifyRowData modifyRowHeader
modifyRowHeaderWidth modifyRowHeight modifyTransformEnd modifyTransformStart persistentStateLoad
persistentStateReset persistentStateSave unmodifyCol unmodifyRow
```

## Migration gates

1. Extract a used boundary while the existing backend still executes it. Preserve the old behavior, including
   unusual runtime inputs and observable callbacks; investigate existing defects separately.
2. Add an engine implementation and exercise identical contract scenarios. Keep existing tests unchanged.
3. Audit each direct and indirect consumer before moving it; never simulate an entire `view.wt` tree.
4. Select the new backend only for an explicitly supported capability set during development. Before a public
   drop-in claim, resolve every documented API/plugin/event row, including real DOM compatibility paths.
5. Preserve default behavior until the compatibility and latency gates pass. Do not silently ignore a plugin,
   convert DOM renderers to pixels, or switch backends during editing.

This step is architectural preparation, not a rendering speed fix. Before/after performance numbers are
regression controls. No production speed-up or Canvas compatibility is claimed from this adapter.

## Private live-Core mirror evidence

`CoreEngineBridge` now reads/writes through the existing Core methods and observes selection/data/order/
structure hooks in a separate development mirror. Specific scenarios cover native edit validation and change
hooks, readOnly, undo/redo, visual-coordinate edits after sorting, row/column movement, insert/remove,
object-property mapping, source replacement and teardown. Core still runs its original DOM backend, supplies
real TDs, and dispatches production renderer hooks there. This is **not** new-backend certification for any
plugin, event family or element API in this inventory.

Before structural/order/source changes, uncommitted mirror drafts are explicitly cancelled; this does not
create stable record IDs. Pending asynchronous writes across such changes, framework state, production
editors/shortcuts and presentation/accessibility contracts remain unproven. The adapter's read and notification
work is additional to the original renderer. Keep these results separate from production speed claims and
from the eventual replacement-backend compatibility matrix.
