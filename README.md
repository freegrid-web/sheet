# FreeSheet

A free, MIT-licensed, Excel-style spreadsheet for the web — and it stays that way. FreeSheet (`@freegrid/sheet`) is
the first component of the FreeGrid family; more will follow under `@freegrid/*`, each in its own repository.

FreeSheet is an independent project that started from the code of **Handsontable 6.2.2**, the last
MIT-licensed release. From here on, its API, structure and releases are FreeSheet's own: it is being
modernized step by step (TypeScript, signals-based reactivity, CSS-variable theming). Versions start at
`0.1.0`; while FreeSheet is `0.x`, a compatibility layer helps projects migrate from Handsontable 6.x.

> FreeSheet is not affiliated with or endorsed by Handsoncode. "Handsontable" is a trademark of its owner
> and is used here only to describe where the code came from and how to migrate.

**Documentation and live examples:** https://freegrid-web.github.io/sheet/

## Status

FreeSheet is on npm as [`@freegrid/sheet`](https://www.npmjs.com/package/@freegrid/sheet) (latest: `0.8.0`). Until
`1.0.0` the API may still change between minor versions (see the [changelog](CHANGELOG.md)). What comes next:
the [roadmap](https://freegrid-web.github.io/sheet/project/roadmap).

## Usage

```bash
npm install @freegrid/sheet
```


```js
import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

new FreeSheet(document.getElementById('grid'), {
  data: [['A1', 'B1'], ['A2', 'B2']],
  rowHeaders: true,
  colHeaders: true,
});
```

Migrating from Handsontable 6.x (compatibility layer, available until FreeSheet 1.0):

```js
import Handsontable from '@freegrid/sheet/compat'; // the rest of your code stays the same
```

With a `<script>` tag: load `dist/freesheet.full.js`, then optionally `dist/compat.js` to get
`window.Handsontable`. Locales: `dist/languages/<code>.js` (or `all.js`) after the grid script; with a
bundler, `import '@freegrid/sheet/languages/de-DE';` (or `@freegrid/sheet/languages/all`).

## Development

Requires Node 24 and pnpm (`corepack enable`).

```bash
pnpm install
pnpm build
pnpm test
```

Browser tests use Playwright. If its system dependencies cannot be installed on your machine, run them
in Docker: `tools/in-playwright-docker.sh pnpm --dir packages/sheet test:e2e`.

Tests are compared against the recorded upstream results in [docs/baseline](docs/baseline): every test
that passed in Handsontable 6.2.2 must pass in FreeSheet.

## License

MIT — see [LICENSE](LICENSE).
