---
api: [Localization]
---

# Localization

The built-in UI (for example the context menu) is in English (`en-US`) by default. FreeSheet includes 15 more
languages: `de-CH`, `de-DE`, `es-MX`, `fr-FR`, `it-IT`, `ja-JP`, `ko-KR`, `lv-LV`, `nb-NO`, `nl-NL`, `pl-PL`,
`pt-BR`, `ru-RU`, `zh-CN` and `zh-TW`.

Load a language, then select it with the `language` setting:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';
import '@freegrid/sheet/languages/de-DE'; // or '@freegrid/sheet/languages/all'

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(3, 3),
  colHeaders: true,
  rowHeaders: true,
  contextMenu: true, // right-click: the menu is in German
  language: 'de-DE',
});
```

With `<script>` tags, load `dist/languages/de-DE.js` (or `all.js`) after the grid script.

## Your own language

Register a dictionary that maps phrase keys to text. Keys you leave out fall back to English:

```js live
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const C = FreeSheet.languages.dictionaryKeys;

FreeSheet.languages.registerLanguageDictionary({
  languageCode: 'xx-XX',
  [C.CONTEXTMENU_ITEMS_ROW_ABOVE]: 'New row up here',
  [C.CONTEXTMENU_ITEMS_ROW_BELOW]: 'New row down there',
});

const grid = new FreeSheet(document.getElementById('grid'), {
  data: FreeSheet.helper.createSpreadsheetData(3, 3),
  colHeaders: true,
  rowHeaders: true,
  contextMenu: ['row_above', 'row_below', '---------', 'remove_row'], // the last one falls back to English
  language: 'xx-XX',
});
```

Contributions of new languages are welcome.
