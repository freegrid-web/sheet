# Styling

Include one of the stylesheets:

- `@freegrid/sheet/dist/freesheet.full.css` also contains the date picker styles.
- `@freegrid/sheet/dist/freesheet.css` contains the grid only (bring your own Pikaday styles).

To change colors and fonts, or to use the dark theme, see [Theming](./theming).

## Classes

FreeSheet's class names use the `fs-` prefix. The root element has the class `freesheet`.

Add classes to cells, columns or the whole grid with `className`. Several helper classes are built in:

| Class | Effect |
| --- | --- |
| `fs-left`, `fs-center`, `fs-right`, `fs-justify` | Horizontal alignment |
| `fs-top`, `fs-middle`, `fs-bottom` | Vertical alignment |
| `fs-dimmed` | Read-only look |
| `fs-invalid` | Added automatically to invalid cells |
| `fs-search-result` | Added by the search plugin to matching cells |

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

// In your stylesheet: .freesheet td.my-highlight { background: #fff3b0; color: #1f2937; }
const style = document.createElement('style');

style.textContent = '.freesheet td.my-highlight { background: #fff3b0; color: #1f2937; }';
document.head.append(style);

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Centered', 'Highlighted'], ['A', 'B']],
  colHeaders: true,
  colWidths: 140,
  columns: [{ className: 'fs-center' }, { className: 'my-highlight' }],
});
```

The `cells` setting and custom renderers can set classes per cell, based on the value.

## Cell styles

A cell's own fonts, colors, borders and number formats are its `style` setting and its number format: see
[Formatting](./formatting).

## Legacy class names

FreeSheet started from Handsontable 6, whose classes were named `handsontable`, `htCore`, `htCenter` and so on.
During FreeSheet `0.x` **both names work**:

- every element FreeSheet creates carries both its FreeSheet and its legacy class, so stylesheets written for
  the old names keep matching;
- FreeSheet's CSS styles both names, so `className: 'htCenter'` still centers text.

The legacy names are removed in FreeSheet `1.0`. To prepare, switch your selectors and `className` values to
the names below. Class names without a brand prefix (such as `current`, `area` or `manualColumnResizer`) are
unchanged.

::: details All class names
| FreeSheet | Legacy (until 1.0) |
| --- | --- |
| `fs-active-highlight` | `ht__active_highlight` |
| `fs-auto-size` | `htAutoSize` |
| `fs-autocomplete` | `htAutocomplete` |
| `fs-autocomplete-arrow` | `htAutocompleteArrow` |
| `fs-autocomplete-wrapper` | `htAutocompleteWrapper` |
| `fs-bad-value` | `htBadValue` |
| `fs-border` | `htBorder` |
| `fs-bordered` | `htBordered` |
| `fs-borders` | `htBorders` |
| `fs-bottom` | `htBottom` |
| `fs-bottom-border-solid` | `htBottomBorderSolid` |
| `fs-center` | `htCenter` |
| `fs-checkbox-renderer-input` | `htCheckboxRendererInput` |
| `fs-checkbox-renderer-label` | `htCheckboxRendererLabel` |
| `fs-clone-bottom` | `ht_clone_bottom` |
| `fs-clone-bottom-left-corner` | `ht_clone_bottom_left_corner` |
| `fs-clone-corner` | `ht_clone_corner` |
| `fs-clone-debug` | `ht_clone_debug` |
| `fs-clone-left` | `ht_clone_left` |
| `fs-clone-top` | `ht_clone_top` |
| `fs-clone-top-left-corner` | `ht_clone_top_left_corner` |
| `fs-collapse-button` | `htCollapseButton` |
| `fs-comment-cell` | `htCommentCell` |
| `fs-comment-text-area` | `htCommentTextArea` |
| `fs-comments` | `htComments` |
| `fs-comments-container` | `htCommentsContainer` |
| `fs-context-menu` | `htContextMenu` |
| `fs-core` | `htCore` |
| `fs-custom-menu-renderer` | `htCustomMenuRenderer` |
| `fs-datepicker-holder` | `htDatepickerHolder` |
| `fs-debug-visible` | `wtDebugVisible` |
| `fs-dimmed` | `htDimmed` |
| `fs-disabled` | `htDisabled` |
| `fs-editor-grid` | `handsontableEditor` |
| `fs-editor-holder` | `handsontableInputHolder` |
| `fs-editor-input` | `handsontableInput` |
| `fs-expand-button` | `htExpandButton` |
| `fs-fill-border` | `htFillBorder` |
| `fs-ghost-table` | `htGhostTable` |
| `fs-group-indicator-container` | `htGroupIndicatorContainer` |
| `fs-hidden` | `htHidden` |
| `fs-hider` | `wtHider` |
| `fs-highlight` | `ht__highlight` |
| `fs-holder` | `wtHolder` |
| `fs-invalid` | `htInvalid` |
| `fs-item-wrapper` | `htItemWrapper` |
| `fs-justify` | `htJustify` |
| `fs-left` | `htLeft` |
| `fs-left-border-solid` | `htLeftBorderSolid` |
| `fs-mac-scroll` | `htMacScroll` |
| `fs-manual-column-move` | `ht__manualColumnMove` |
| `fs-manual-column-move--backlight` | `ht__manualColumnMove--backlight` |
| `fs-manual-column-move--guideline` | `ht__manualColumnMove--guideline` |
| `fs-manual-row-move` | `ht__manualRowMove` |
| `fs-manual-row-move--backlight` | `ht__manualRowMove--backlight` |
| `fs-manual-row-move--guideline` | `ht__manualRowMove--guideline` |
| `fs-master` | `ht_master` |
| `fs-menu` | `htMenu` |
| `fs-middle` | `htMiddle` |
| `fs-mobile-editor-container` | `htMobileEditorContainer` |
| `fs-no-frame` | `htNoFrame` |
| `fs-no-wrap` | `htNoWrap` |
| `fs-numeric` | `htNumeric` |
| `fs-placeholder` | `htPlaceholder` |
| `fs-right` | `htRight` |
| `fs-right-border-solid` | `htRightBorderSolid` |
| `fs-row-headers` | `htRowHeaders` |
| `fs-search-result` | `htSearchResult` |
| `fs-select-editor` | `htSelectEditor` |
| `fs-selection--columns` | `ht__selection--columns` |
| `fs-selection--rows` | `ht__selection--rows` |
| `fs-selection-border` | `wtBorder` |
| `fs-selection-disabled` | `htSelectionDisabled` |
| `fs-separator` | `htSeparator` |
| `fs-spreader` | `wtSpreader` |
| `fs-submenu` | `htSubmenu` |
| `fs-top` | `htTop` |
| `fs-top-border-solid` | `htTopBorderSolid` |
| `freesheet` | `handsontable` |
:::

::: info Coming next
Theming with CSS variables (including a dark theme) is on the [roadmap](../project/roadmap).
:::
