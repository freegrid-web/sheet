---
api: [Formatting]
---

# Formatting

Cells take a style as in a spreadsheet: a font and its size, bold, italic, underline, colors, borders and a number
format. Users format cells with the formatting bar, the context menu and the usual shortcuts; code sets the same
`style` on cells. Undo takes any of it back, and Excel files keep it.

## Styles in the settings

A cell's `style` is drawn on the cell. Set it like any other cell setting: on a column in `columns`, on one cell in
`cell`, or from a function in `cells`.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const header = { fontWeight: 'bold', color: '#1f2937', background: '#d9e1f2', borderBottom: '2px solid #1f4e79' };

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Product', 'Price', 'Stock'],
    ['Laptop', 1299, 12],
    ['Monitor', 249, 0],
    ['Keyboard', 79, 48],
  ],
  colHeaders: true,
  rowHeaders: true,
  columns: [
    { style: { fontStyle: 'italic' } },
    { style: { color: '#1f4e79' } },
    {},
  ],
  cell: [
    { row: 0, col: 0, style: header },
    { row: 0, col: 1, style: header },
    { row: 0, col: 2, style: header },
    { row: 2, col: 2, style: { color: '#c00000', fontWeight: 'bold' } },
  ],
});
```

The properties:

| Property | Example |
| --- | --- |
| `fontFamily` | `'Georgia, serif'` |
| `fontSize` | `'14pt'`: points, as in a spreadsheet (other CSS sizes work too); the row grows to fit |
| `fontWeight`, `fontStyle` | `'bold'`, `'italic'` |
| `textDecoration` | `'underline'`, `'line-through'` |
| `color`, `background` | `'#c00000'` |
| `border` | `'1px solid #000000'`: a line on every side |
| `borderTop`, `borderRight`, `borderBottom`, `borderLeft` | `'2px solid #c00000'`: one side (it wins over `border`) |

Borders are drawn inside the cell, so they never change its size. [Conditional formatting](./conditional-formatting)
is drawn over a cell's own style.

## The formatting bar

`formattingBar: true` opens a bar above the context menu, as in Excel. Select some cells and right-click:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Region', 'Q1', 'Q2', 'Share'],
    ['North', 1200.5, 1350, 0.31],
    ['South', 980, 1010.25, 0.24],
    ['West', 1720, 1690, 0.45],
  ],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['undo', 'redo', '---------', 'alignment', 'formatting'],
  formattingBar: true,
});
```

It has:

- the font (each one shown in itself) and its size (pick one, or type a size and press Enter);
- bold, italic, underline and strikethrough;
- fill and text colors: a palette shows a color on the selected cells while the pointer is on it, a click keeps it,
  and closing the palette without a choice leaves the cells as they were. **More colors** opens a full color picker;
- **Borders**: bottom, top, left, right, all, outside, thick outside, or none. The button draws the last one chosen;
- alignment;
- **Number format**: General, Number `0,0.00`, Currency `$0,0.00`, Percent `0.00%`;
- **Format painter**: copies the selected cells' style, alignment and number format to the next cells you select
  (Escape cancels it);
- clear formatting.

`formattingBar: { items: [...] }` chooses the buttons from `'font_family'`, `'font_size'`, `'bold'`, `'italic'`,
`'underline'`, `'strikethrough'`, `'fill_color'`, `'text_color'`, `'borders'`, `'alignment'`, `'number_format'`,
`'format_painter'` and `'clear'`:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['Right-click me', '', ''], ['', '', ''], ['', '', ''], ['', '', '']],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['copy', 'cut'],
  formattingBar: { items: ['bold', 'italic', 'fill_color', 'text_color', 'clear'] },
});
```

The keyboard works without the bar: **Ctrl+B**, **Ctrl+I** and **Ctrl+U** toggle bold, italic and underline for the
selected cells (on for all of them, or off when all of them have it). The context menu's `'formatting'` entry
(**Format**) has the same commands as a submenu.

## Formatting from code

`setCellStyle(style, ranges?)` merges `style` into the selected cells, or into the given ranges. A `null` property
removes that property, and a `null` style removes the whole style. It is one undo step, and the `afterSetCellStyle`
event gets the changes.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Task', 'Owner', 'Due'],
    ['Write the report', 'Ana', '2026-11-02'],
    ['Check the numbers', 'Ben', '2026-11-04'],
    ['Send it', 'Ana', '2026-11-05'],
  ],
  colHeaders: true,
  rowHeaders: true,
});

grid.addHook('afterSetCellStyle', (changes) => {
  console.log(`${changes.length} cells changed`);
});

grid.selectCell(0, 0, 0, 2);
grid.setCellStyle({ fontWeight: 'bold', borderBottom: '2px solid #000000' });

grid.selectCell(3, 0, 3, 2);
grid.setCellStyle({ textDecoration: 'line-through', color: '#7f7f7f' });
```

## Number formats

A number format is the `numericFormat` of a `numeric` cell, as a [numbro](https://numbrojs.com) pattern. The
formatting bar's **Number format** sets the same settings on the selected cells.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['Coffee', 3.5, 1200, 0.125],
    ['Tea', 2.25, 860, 0.0875],
    ['Juice', 4, 410, 0.04],
  ],
  colHeaders: ['Product', 'Price', 'Sold', 'Growth'],
  columns: [
    {},
    { type: 'numeric', numericFormat: { pattern: '$0,0.00' } },
    { type: 'numeric', numericFormat: { pattern: '0,0' } },
    { type: 'numeric', numericFormat: { pattern: '0.0%' } },
  ],
});
```

See [cell types](./cell-types) for the other types and their formats.

## Saving

`getDocument()` keeps every cell's `style` and number format, and Excel files keep the fonts, fills, borders and number
formats both ways. A whole workbook example is [Formatting](../examples/formatting).
