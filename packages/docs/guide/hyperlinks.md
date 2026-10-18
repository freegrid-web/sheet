---
api: [Hyperlinks]
---

# Hyperlinks

A cell's `link` setting makes its text a link: underlined, in the link color.

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [
    ['FreeSheet on GitHub', 'Write to us'],
    ['Select a cell with a link', 'Ctrl+K edits it'],
  ],
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['link', '---------', 'copy', 'cut'],
  cell: [
    { row: 0, col: 0, link: 'https://github.com/freegrid-web/sheet' },
    { row: 0, col: 1, link: 'mailto:team@example.com' },
  ],
});
```

- **Selecting** a cell with a link shows a card under it: the address (it opens in a new tab), **Edit** and **Remove**.
- **Ctrl+click** (⌘+click on a Mac) opens the link.
- **Ctrl+K**, or the context menu's **Insert link** (add its key `'link'` to `contextMenu`), edits the selected cell's text and link. Enter applies, Escape
  cancels, and one undo step takes back both.
- **Addresses:** only web (`http`, `https`) and mail (`mailto`) links are kept. `example.com/page` becomes
  `https://example.com/page`; anything else, such as `javascript:`, is refused.
- **Saving:** `getDocument()` and Excel files keep the links.

From code:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const grid = new FreeSheet(document.getElementById('grid'), {
  data: [['', ''], ['', '']],
  colHeaders: true,
});
const links = grid.getPlugin('hyperlinks');

links.setLink(0, 0, 'https://example.com', 'Example'); // the text is optional
links.setLink(0, 1, 'example.org/docs');               // becomes https://example.org/docs
console.log(links.getLink(0, 1));                      // 'https://example.org/docs'
// links.removeLink(0, 0) keeps the text and removes the link.
```

Turn the feature off with `hyperlinks: false`. The CSS variable `--fs-link-color` colors the links.
