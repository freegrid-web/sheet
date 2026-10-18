---
api: [Context menu]
---

# Context menu

A right click on a cell opens the context menu. Its entries show an icon at the left and their keyboard shortcut at
the right, as in a spreadsheet. In the Modern style, the menu has round corners and a shadow.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(4, 4),
  colHeaders: true,
  rowHeaders: true,
  contextMenu: true, // right-click a cell
});
```

## Choosing the entries

`true` shows the default entries. A list chooses them and their order (`'---------'` is a separator):

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(4, 4),
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['undo', 'redo', '---------', 'row_above', 'row_below', '---------', 'formatting', 'freeze'],
});
```

| Key | Entry |
| --- | --- |
| `row_above`, `row_below` | Insert a row |
| `col_left`, `col_right` | Insert a column |
| `remove_row`, `remove_col` | Remove rows or columns |
| `clear_column` | Clear a column |
| `undo`, `redo` | Undo and redo (Ctrl+Z, Ctrl+Y) |
| `make_read_only` | Read only |
| `alignment` | Alignment (a submenu) |
| `formatting` | Format: bold, italic, colors… ([styling](./styling)) |
| `freeze` | Freeze panes ([guide](./status-bar-and-freezing)) |
| `copy`, `cut` | Copy and cut (Ctrl+C, Ctrl+X) |
| `paste`, `paste_special` | Paste and Paste special ([guide](./fill-and-paste)) |
| `link` | Insert or edit a link (Ctrl+K, [guide](./hyperlinks)) |
| `show_changes` | The Changes panel ([guide](./change-history)) |
| `data_validation` | The Data validation panel ([guide](./data-validation)) |
| `commentsAddEdit`, `commentsRemove` | Comments (with `comments`) |

Plugins add their own entries to the default menu, for example copy and cut, conditional formatting and row groups.

## Entries of your own

An object of entries by key adds entries of your own next to the built-in ones:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(4, 4),
  colHeaders: true,
  rowHeaders: true,
  contextMenu: {
    items: {
      undo: {},                 // a built-in entry, by its key
      sep1: '---------',
      highlight: {
        name: 'Highlight',
        icon: '<svg viewBox="0 0 16 16" width="16" height="16"><circle cx="8" cy="8" r="5" fill="gold"/></svg>',
        shortcut: 'Ctrl+Shift+H',
        callback(key, selection) {
          this.setCellStyle({ background: '#fff3b0', color: '#1f2937' });
        },
        disabled() {
          return !this.getSelectedLast();
        },
      },
      size: {
        name: 'Size',
        submenu: {
          items: [
            { key: 'size:small', name: 'Small', callback() { this.setCellStyle({ fontSize: '9pt' }); } },
            { key: 'size:large', name: 'Large', callback() { this.setCellStyle({ fontSize: '14pt' }); } },
          ],
        },
      },
    },
  },
});
```

- **`name`** is a text, or a function that returns one.
- **`callback(key, selection)`** runs with the grid as `this`.
- **`disabled` and `hidden`** are booleans, or functions.
- **`submenu: { items: [...] }`** makes a submenu.
- **`icon`** is drawn at the left. It is SVG or other HTML written by your code, never text from users.
- **`shortcut`** is shown at the right, for example `'Ctrl+K'`. A Mac shows it as ⌘K. The shortcut is only shown:
  handle the keys yourself, for example with `beforeKeyDown`.

## Look

The menu follows the grid's theme and style. These CSS variables change it:

| Variable | What |
| --- | --- |
| `--fs-menu-background` | Background |
| `--fs-menu-border-color` | Border |
| `--fs-menu-hover-background` | The hovered entry |
| `--fs-menu-icon-color` | Icons |
| `--fs-menu-shortcut-color` | Shortcuts |
| `--fs-menu-shadow`, `--fs-radius` | Shadow and corners |

See [Theming](./theming).
