---
api: [Find and replace]
---

# Find and replace

`findAndReplace: true` gives the grid a find box, as in a spreadsheet:

- **Ctrl+F** opens it at the top right of the grid. Typing highlights the matching cells and selects the first match
  at or after the selected cell. **Enter** or **↓** goes to the next match, **Shift+Enter** or **↑** to the previous
  one, and the box shows "2 of 5".
- **Ctrl+H**, or the **⇄** button, adds the replace field. **Replace** changes the current match and goes to the next
  one; **Replace all** changes every match. Undo takes a Replace all back in one step.
- **Escape** or **×** closes the box.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Apples', 'Fruit', 'EUR'],
    ['Pears', 'Fruit', 'EUR'],
    ['Carrots', 'Vegetable', 'EUR'],
    ['Apple juice', 'Drink', 'USD'],
  ],
  colHeaders: true,
  rowHeaders: true,
  findAndReplace: true, // click a cell, then press Ctrl+F or Ctrl+H
});
```

The matching rules:

- A cell matches when its text contains the query, ignoring case.
- **Match case** compares case too. **Entire cell** needs the whole cell to be the query.
- By default the box searches what cells show, so a formula is found by its result. **Search in formulas** searches
  the formulas' text instead (`A1`, `SUM`).
- Replacing always changes a cell's own text: a formula's text, never its result.
- A number stays a number when the replaced text is one. Read-only cells are not changed.

The plugin can also be used from code:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Apples', 'EUR'], ['apple pie', 'EUR'], ['Pears', 'USD']],
  colHeaders: true,
  findAndReplace: true,
});
const finder = grid.getPlugin('findAndReplace');

console.log(finder.find('apple'));                     // [{ row: 0, col: 0 }, { row: 1, col: 0 }]
console.log(finder.find('apple', { matchCase: true })); // [{ row: 1, col: 0 }]
finder.replace('EUR', '€', { entireCell: true });       // 2: how many cells changed
finder.open('replace');
```

See the [search example](../examples/search-and-languages).
