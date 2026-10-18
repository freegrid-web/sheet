---
api: [Data, Cell types and meta]
---

# Formulas

A cell whose value starts with `=` (for example `=SUM(A1:A3)`) shows the result of its formula. FreeSheet has no
formula engine of its own, so `@freegrid/sheet` stays small and has no dependencies. You add an engine:
[IronCalc](https://github.com/ironcalc/IronCalc) (MIT/Apache-2.0), a spreadsheet engine compiled to WebAssembly, with
several hundred Excel functions.

```sh
npm install @ironcalc/wasm
```

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import init, { Model } from '@ironcalc/wasm';

await init(); // loads the WebAssembly (about 2 MB, 0.6 MB compressed) once

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    [1, 2, '=A1+B1'],
    [10, 20, '=SUM(A2:B2)'],
    ['', '', '=C1*C2'],
  ],
  colHeaders: true,
  rowHeaders: true,
  formulas: { engine: Model },
  formulaBar: true, // select a cell to see its formula
});

console.log(grid.getDataAtCell(2, 2));                        // 90: the result
console.log(grid.getPlugin('formulas').getFormula(2, 2));     // '=C1*C2'
```

With Vite's dev server, exclude the package from dependency pre-bundling; otherwise `init()` cannot find the
WebAssembly file and fails with "expected magic word 00 61 73 6d":

```js
// vite.config.js
export default { optimizeDeps: { exclude: ['@ironcalc/wasm'] } };
```

FreeSheet is tested with `@ironcalc/wasm` 0.8.4. Optional settings: `locale`, `timezone` and `language`, passed to
the engine (default `'en'`, `'UTC'`, `'en'`).

## How it works

- **The data keeps the formula.** `getSourceDataAtCell` and the editor show `=A1+B1`; `getDataAtCell`, the
  renderers, copying and sorting use the result. `getPlugin('formulas').getFormula(row, column)` returns a cell's
  formula, or `null`.
- **Changes recalculate.** Editing, pasting, undo and redo update the results that depend on the changed cells.
- **Inserting and removing rows and columns moves the references**, as in Excel, and the formulas in your data are
  updated to match. A reference to a removed cell becomes `#REF!`.
- **Errors** (`#DIV/0!`, `#NAME?`, `#REF!`, …) are shown as text, and the cell gets the class `fs-formula-error`.
- **References follow the data rows and columns.** Sorting and moving rows or columns only change how they are
  shown: after sorting, `=A1` still means the first row of your data, not the first row on screen.
- Column letters in formulas are the data columns (`A` is the first column of the data). One grid is one sheet;
  references to other grids are not supported yet.

## The formula bar

`formulaBar: true` shows a bar above the grid, as in Excel: the selected cell's address and its formula (or value).
Type in the bar and press <kbd>Enter</kbd> to write the cell, or <kbd>Escape</kbd> to cancel. Type an address such
as `F6` in the address box and press <kbd>Enter</kbd> to select that cell. It works without formulas too. Turn it on
or off at any time with `updateSettings({ formulaBar: false })`.

See it working in the [Formulas example](../examples/formulas).
