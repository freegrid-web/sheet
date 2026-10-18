# Migrating from Handsontable 6

FreeSheet started from the code of Handsontable 6.2.2, so a project built on Handsontable 6.x can usually
switch with a few changes. The compatibility layer described here is a migration aid: it stays available
throughout FreeSheet `0.x` and is removed in `1.0`.

## 1. Replace the package

```sh
npm uninstall handsontable
npm install @freegrid/sheet
```

## 2. Update imports

The quickest switch keeps the `Handsontable` name through the compatibility entry:

```js
import Handsontable from '@freegrid/sheet/compat';
import '@freegrid/sheet/dist/freesheet.full.css';
```

When you have time, move to the FreeSheet name. The API is the same:

```js
import FreeSheet from '@freegrid/sheet';
```

With `<script>` tags, load `dist/freesheet.full.js` and then `dist/compat.js`, which defines
`window.Handsontable` as an alias of `window.FreeSheet`.

## 3. Language files

```js
// before
import 'handsontable/languages/de-DE';
// after
import '@freegrid/sheet/languages/de-DE';
```

With `<script>` tags, use `dist/languages/de-DE.js`.

## 4. Check these differences

- **No license key.** The `licenseKey` setting is ignored, because there is nothing to unlock.
- **CommonJS and IE are not supported.** FreeSheet ships ES modules and UMD bundles for Chrome/Edge
  107+, Firefox 104+ and Safari 16+.
- **jQuery:** the plugin is `$(el).freesheet(...)`. `$(el).handsontable(...)` still works during `0.x`.
- **Dates:** FreeSheet no longer needs moment.js. `dateFormat` and `timeFormat` keep moment's tokens and parsing
  rules (see [Date and time formats](./cell-types#date-and-time-formats)); use real formats (`MM/DD/YYYY`, not
  `mm/dd/yy`). Week tokens (`w`, `W`, `gggg`) and locales other than English are not supported.
- **Numbers:** FreeSheet no longer needs numbro. `numericFormat` patterns keep numbro's syntax and give the same text;
  the separators and the currency come from the browser, so no numbro language files are needed (see
  [Number formats](./cell-types#number-formats)).
- **Date picker:** FreeSheet has its own calendar instead of Pikaday (classes `fs-datepicker*` instead of `pika-*`).
  `datePickerConfig` keeps Pikaday's names for the common options (see [Date picker](./cell-types#date-picker));
  other Pikaday options are ignored. You no longer load Pikaday or its CSS.
- **CSS class names** are now FreeSheet's own (`.freesheet`, `.fs-core`, `.fs-center`, …). During `0.x` the
  old names (`.handsontable`, `.htCore`, `.htCenter`, …) keep working, so your CSS does not break. Plan to
  switch before `1.0`; see the full list in [Styling](./styling#legacy-class-names). The context menu now
  writes `fs-` alignment classes into `getCellMeta(...).className`.
- **Editor, renderer and validator names** have the kind first (see below).
- **Pro features** (filters, dropdown menu, hidden rows and columns, nested headers, export, formulas)
  were never part of the MIT release. FreeSheet writes them from scratch; most keep the familiar setting names
  (`filters`, `dropdownMenu`, `hiddenRows`, `hiddenColumns`, `nestedRows`, `nestedHeaders`, `collapsibleColumns`),
  see the [roadmap](../project/roadmap).
- **Column groups:** `nestedHeaders` (rows of labels with `colspan`) and `collapsibleColumns: [{ row, col, show }]`
  work, but the simpler form is groups in `columns`: a column with `columns`, `collapsible: true`, `collapsed: true`,
  and `showWhenCollapsed: true` / `hidden: true` on a column (see [Column header groups](./column-groups)). The older
  settings will be removed in `1.0`.

## Editor, renderer and validator names

The classes and functions under `FreeSheet.editors`, `FreeSheet.renderers` and `FreeSheet.validators` have uniform
names, the kind first. The old names are removed. Names used in settings (`type: 'date'`, `editor: 'text'`,
`renderer: 'numeric'`, `validator: 'time'`) do not change.

| Handsontable 6 | FreeSheet |
| --- | --- |
| `editors.BaseEditor` | `editors.EditorBase` |
| `editors.TextEditor` | `editors.EditorText` |
| `editors.AutocompleteEditor` | `editors.EditorAutocomplete` |
| `editors.CheckboxEditor` | `editors.EditorCheckbox` |
| `editors.DateEditor` | `editors.EditorDate` |
| `editors.DropdownEditor` | `editors.EditorDropdown` |
| `editors.HandsontableEditor` | `editors.EditorHandsontable` |
| `editors.NumericEditor` | `editors.EditorNumeric` |
| `editors.PasswordEditor` | `editors.EditorPassword` |
| `editors.SelectEditor` | `editors.EditorSelect` |
| `renderers.BaseRenderer`, `renderers.cellDecorator` | `renderers.RendererBase` |
| `renderers.TextRenderer` | `renderers.RendererText` |
| `renderers.AutocompleteRenderer` | `renderers.RendererAutocomplete` |
| `renderers.CheckboxRenderer` | `renderers.RendererCheckbox` |
| `renderers.HtmlRenderer` | `renderers.RendererHtml` |
| `renderers.NumericRenderer` | `renderers.RendererNumeric` |
| `renderers.PasswordRenderer` | `renderers.RendererPassword` |
| `validators.AutocompleteValidator` | `validators.ValidatorAutocomplete` |
| `validators.DateValidator` | `validators.ValidatorDate` |
| `validators.NumericValidator` | `validators.ValidatorNumeric` |
| `validators.TimeValidator` | `validators.ValidatorTime` |

```js
// before
class UpperCaseEditor extends Handsontable.editors.TextEditor { … }
// after
class UpperCaseEditor extends FreeSheet.editors.EditorText { … }
```

Your own editors, renderers and validators keep the names you register them under
(`registerEditor('upper', UpperCaseEditor)`, then `editor: 'upper'`).
