---
layout: home

hero:
  name: FreeSheet
  text: A free data grid for the web
  tagline: Spreadsheet-like editing, sorting, merged cells, comments and more. MIT-licensed, today and tomorrow.
  image:
    src: /logo.svg
    alt: FreeSheet
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: Examples
      link: /examples/
    - theme: alt
      text: View on GitHub
      link: https://github.com/freegrid-web/sheet

features:
  - title: Feels like a spreadsheet
    details: Keyboard navigation, copy and paste with Excel, fill handle, undo and redo, context menu.
    link: /examples/basics
    linkText: Try it
  - title: Fast with large data
    details: Only the visible cells are rendered, so 10,000 rows scroll smoothly.
    link: /examples/large-data
    linkText: See 10,000 rows
  - title: Free forever
    details: MIT-licensed with no paid tier and no license key. Started from the last MIT release of Handsontable (6.2.2).
    link: /project/origin-and-license
    linkText: Origin and license
---

## Install

::: code-group

```sh [npm]
npm install @freegrid/sheet
```

```sh [pnpm]
pnpm add @freegrid/sheet
```

```sh [yarn]
yarn add @freegrid/sheet
```

```sh [bun]
bun add @freegrid/sheet
```

:::


## Quick start

Give the grid an element, import FreeSheet and its styles, and create an instance:

```html
<div id="grid"></div>
```

<<< @/examples/getting-started.js

<LiveExample name="getting-started" />

No bundler? Load `freesheet.full.min.js` and `freesheet.full.min.css` with `<script>` and `<link>` tags.
The [getting started guide](./guide/getting-started#without-a-bundler) shows how.

## Why FreeSheet

- **Free, without a catch.** MIT today and tomorrow. There is no license key, no paid tier and no
  "community edition".
- **A real spreadsheet feel.** Editing, selection, the fill handle, copy and paste with Excel, undo and redo, and
  sorting all work out of the box.
- **Batteries included.** Includes [cell types](./guide/cell-types), validation, merged cells, comments, custom
  borders, search, frozen rows and columns, and [15 more UI languages](./guide/localization).
- **Easy to move to.** Coming from Handsontable 6? Follow the
  [migration guide](./guide/migrating-from-handsontable).

## Read the guide

- [Introduction](./guide/introduction): what FreeSheet is and where it comes from
- [Getting started](./guide/getting-started): install it and build your first grid
- [Examples](./examples/basics): every feature, live, with its code
- [Roadmap](./project/roadmap): TypeScript, signals, theming, filters, formulas
