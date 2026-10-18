import './workbook.css';
import type Core from '../core';
import { trimEmptyEnd } from './../utils/emptyEnd';
import type { AnyObject } from '../types';

/** One sheet of the document: its id, its name and its grid. */
export type Sheet = { id: string; name: string; instance: Core };

/** The part of a formula engine model the sheets use (IronCalc's `Model`). */
type SheetsModel = {
  newSheet(): void;
  renameSheet(sheet: number, name: string): void;
  deleteSheet(sheet: number): void;
  moveSheet(sheet: number, newIndex: number): void;
  free?(): void;
};

/** Creates a sheet's grid (FreeSheet's constructor; passed in, so this module does not import the core). */
export type CreateSheet = (rootElement: HTMLElement, settings: AnyObject) => Core;

/** Settings a new sheet takes from the document's first sheet unless it sets its own. */
const INHERITED_SETTINGS = ['formulas', 'formulaBar', 'findAndReplace', 'formattingBar', 'rowHeaders', 'colHeaders', 'contextMenu', 'width', 'height',
  'stretchH', 'language', 'manualColumnResize', 'manualRowResize', 'columnSorting', 'outsideClickDeselects'];

/** One sheet in a saved document (`getDocument`). */
export type SheetDocument = {
  id: string;
  name: string;
  data: unknown[];
  colWidths?: (number | null)[];
  rowHeights?: (number | null)[];
  mergeCells?: { row: number; col: number; rowspan: number; colspan: number }[];
  /** Frozen rows at the top and columns at the left. */
  fixedRowsTop?: number;
  fixedColumnsLeft?: number;
  /** Column headers (an imported file's first row). */
  colHeaders?: string[];
  /** Hidden rows and columns (physical indexes). */
  hiddenRows?: number[];
  hiddenColumns?: number[];
  /** Filter conditions (as `getPlugin('filters').exportConditions()` gives them). */
  filters?: AnyObject[];
  /** Conditional formatting rules (as `getPlugin('conditionalFormatting').getRules()` gives them). */
  conditionalFormatting?: AnyObject[];
  /** Nested rows: the physical rows of the collapsed parents. */
  collapsedRows?: number[];
  /** Row groups (rows as data indexes). */
  rowGroups?: { from: number; to: number; collapsed?: boolean }[];
  /** Column groups as an outline (columns as data indexes). */
  columnOutline?: { from: number; to: number; collapsed?: boolean }[];
  cell?: AnyObject[];
};

/** A saved document: every sheet, in tab order, and the sheet that was shown. */
export type SavedDocument = { version: 1; activeSheet: string; sheets: SheetDocument[] };

/** Cell settings a saved document keeps (what users change in the grid: comments, formats, read-only cells). */
const SAVED_CELL_SETTINGS = ['comment', 'className', 'readOnly', 'type', 'numericFormat', 'dateFormat', 'timeFormat',
  'source', 'checkedTemplate', 'uncheckedTemplate', 'placeholder', 'wordWrap', 'style', 'validation', 'link'];

const sparse = <T>(values: (T | undefined)[]): (T | null)[] | undefined => {
  if (!values.some(value => value !== void 0 && value !== null)) {
    return void 0;
  }

  return Array.from(values, value => (value === void 0 ? null : value));
};

/** A sheet's grid as a saved sheet. */
const saveSheet = (sheet: Sheet): SheetDocument => {
  const { instance } = sheet;
  const plugin = (name: string) => instance.getPlugin(name as 'search') as unknown as AnyObject | undefined;
  const columnResize = plugin('manualColumnResize');
  const rowResize = plugin('manualRowResize');
  const mergeCells = plugin('mergeCells');
  const saved: SheetDocument = {
    id: sheet.id,
    name: sheet.name,
    // Nested rows: the tree, not the grid's rows.
    data: JSON.parse(JSON.stringify(plugin('nestedRows')?.enabled ?
      (plugin('nestedRows')!.getSourceData as () => unknown[])() : instance.getSourceData())),
  };
  const colWidths = columnResize?.enabled ? sparse(columnResize.manualColumnWidths as (number | undefined)[]) : void 0;
  const rowHeights = rowResize?.enabled ? sparse(rowResize.manualRowHeights as (number | undefined)[]) : void 0;
  const merged = mergeCells?.enabled ? (mergeCells.mergedCellsCollection as AnyObject).mergedCells as AnyObject[] : [];
  const cell = (instance.getCellsMeta() as AnyObject[]).flatMap((meta) => {
    const own = SAVED_CELL_SETTINGS.filter(key => Object.prototype.hasOwnProperty.call(meta, key) &&
      meta[key] !== void 0);

    return own.length ? [Object.fromEntries([['row', meta.row], ['col', meta.col], ...own.map(key => [key, meta[key]])])] :
      [];
  });

  // fillContainer's empty rows and columns at the end are not saved; cells with settings of their own and merged
  // cells are.
  if (instance.getSettings().fillContainer && !plugin('nestedRows')?.enabled) {
    const ends = [...cell.map(({ row, col }) => [row + 1, col + 1]),
      ...merged.map(({ row, col, rowspan, colspan }) => [row + rowspan, col + colspan])] as [number, number][];

    saved.data = trimEmptyEnd(saved.data as unknown[], Math.max(0, ...ends.map(([row]) => row)),
      Math.max(0, ...ends.map(([, col]) => col)));
  }
  if (colWidths) {
    saved.colWidths = colWidths;
  }
  if (rowHeights) {
    saved.rowHeights = rowHeights;
  }
  if (merged.length) {
    saved.mergeCells = merged.map(({ row, col, rowspan, colspan }) => ({ row, col, rowspan, colspan }));
  }
  (['hiddenRows', 'hiddenColumns'] as const).forEach((name) => {
    const hidden = plugin(name)?.enabled ? (plugin(name)!.getHidden as () => number[])() : [];

    if (hidden.length) {
      saved[name] = hidden;
    }
  });
  const filters = plugin('filters')?.enabled ? (plugin('filters')!.exportConditions as () => AnyObject[])() : [];

  if (filters.length) {
    saved.filters = JSON.parse(JSON.stringify(filters));
  }
  const rules = plugin('conditionalFormatting')?.enabled ?
    (plugin('conditionalFormatting')!.getRules as () => AnyObject[])() : [];

  if (rules.length) {
    saved.conditionalFormatting = rules.map(({ id: _id, ...rule }) => rule);
  }
  const collapsedRows = plugin('nestedRows')?.enabled ? (plugin('nestedRows')!.getCollapsedRows as () => number[])() :
    [];

  if (collapsedRows.length) {
    saved.collapsedRows = collapsedRows;
  }
  const rowGroups = plugin('rowGroups')?.enabled ?
    (plugin('rowGroups')!.getSavedGroups as () => SheetDocument['rowGroups'])()! : [];

  if (rowGroups.length) {
    saved.rowGroups = rowGroups;
  }
  const columnOutline = plugin('columnOutline')?.enabled ?
    (plugin('columnOutline')!.getSavedGroups as () => SheetDocument['columnOutline'])()! : [];

  if (columnOutline.length) {
    saved.columnOutline = columnOutline;
  }
  const { fixedRowsTop, fixedColumnsLeft } = instance.getSettings();

  if (fixedRowsTop) {
    saved.fixedRowsTop = fixedRowsTop;
  }
  if (fixedColumnsLeft) {
    saved.fixedColumnsLeft = fixedColumnsLeft;
  }
  if (cell.length) {
    saved.cell = JSON.parse(JSON.stringify(cell));
  }

  return saved;
};

/** The grid settings of a saved sheet. */
const sheetSettings = (sheet: SheetDocument): AnyObject => {
  const settings: AnyObject = { data: sheet.data };

  if (sheet.colWidths) {
    settings.colWidths = sheet.colWidths.map(width => (width === null ? void 0 : width));
  }
  if (sheet.rowHeights) {
    settings.rowHeights = sheet.rowHeights.map(height => (height === null ? void 0 : height));
  }
  if (sheet.mergeCells) {
    settings.mergeCells = sheet.mergeCells;
  }
  if (sheet.hiddenRows) {
    settings.hiddenRows = { rows: sheet.hiddenRows };
  }
  if (sheet.hiddenColumns) {
    settings.hiddenColumns = { columns: sheet.hiddenColumns };
  }
  if (sheet.filters) {
    settings.filters = { conditions: sheet.filters };
  }
  if (sheet.conditionalFormatting) {
    settings.conditionalFormatting = sheet.conditionalFormatting;
  }
  if (sheet.rowGroups) {
    settings.rowGroups = { groups: sheet.rowGroups };
  }
  if (sheet.columnOutline) {
    settings.columnOutline = { groups: sheet.columnOutline };
  }
  settings.fixedRowsTop = sheet.fixedRowsTop || 0;
  settings.fixedColumnsLeft = sheet.fixedColumnsLeft || 0;
  if (sheet.colHeaders) {
    settings.colHeaders = sheet.colHeaders;
  }
  settings.cell = sheet.cell || [];
  // Comments show with the comments plugin.
  if (settings.cell.some((meta: AnyObject) => meta.comment)) {
    settings.comments = true;
  }

  return settings;
};

/** Characters a sheet name cannot have (as in Excel). */
const INVALID_NAME = /[[\]:*?/\\]/;

const workbooks = new WeakMap<Core, Workbook>();
/** While a sheet's grid is being created, its element knows its document (the grid is not registered yet). */
const pendingSheets = new WeakMap<HTMLElement, Workbook>();

/** The document a grid belongs to, or `null` while it has only its own sheet. */
export const getWorkbook = (instance: Core): Workbook | null => workbooks.get(instance) || null;

/**
 * The document: every sheet made with `addSheet`, as the sheets of an Excel file. It is created by the first sheet API
 * call on a grid; until then a grid has no tab bar and costs nothing extra. The grid created with `new FreeSheet`
 * holds the document: its hooks get the sheet events, it cannot be removed, and destroying it destroys every sheet.
 */
export class Workbook {
  readonly root: Core;
  sheets: Sheet[] = [];
  activeId: string;
  /** The formula model all sheets share (sheet `i` of the model is `sheets[i]`), when formulas are on. */
  model: SheetsModel | null = null;
  #createSheet: CreateSheet;
  #tabs: HTMLDivElement | null = null;
  #menu: HTMLDivElement | null = null;
  #counter = 1;
  /** The sheet whose tab is being dragged. */
  #draggedId: string | null = null;
  #onDocumentMouseDown = (event: MouseEvent) => {
    if (this.#menu && !this.#menu.contains(event.target as Node)) {
      this.closeMenu();
    }
  };

  constructor(root: Core, createSheet: CreateSheet) {
    const settings = root.getSettings() as AnyObject;
    const id = typeof settings.sheetId === 'string' && settings.sheetId ? settings.sheetId : 'sheet1';
    const name = typeof settings.sheetName === 'string' && settings.sheetName ? settings.sheetName : 'Sheet1';

    this.root = root;
    this.#createSheet = createSheet;
    this.activeId = id;
    this.sheets.push({ id, name, instance: root });
    workbooks.set(root, this);
    this.watchWidth(root);

    // The first sheet's formula model becomes the document's; the engine's first sheet gets the sheet's name.
    const formulas = root.getPlugin('formulas') as unknown as { enabled: boolean; model: SheetsModel | null };

    if (formulas && formulas.enabled && formulas.model) {
      this.model = formulas.model;
      this.model.renameSheet(0, name);
    }
  }

  /** The sheet with an id, or `undefined`. */
  get(id: string): Sheet | undefined {
    return this.sheets.find(sheet => sheet.id === id);
  }

  /** The sheet of a grid, or `undefined`. */
  sheetOf(instance: Core): Sheet | undefined {
    return this.sheets.find(sheet => sheet.instance === instance);
  }

  indexOf(instance: Core): number {
    return this.sheets.findIndex(sheet => sheet.instance === instance);
  }

  /** A sheet by id, or an error that names the id. */
  require(id: string): Sheet {
    const sheet = this.get(id);

    if (!sheet) {
      throw new Error(`There is no sheet "${id}".`);
    }

    return sheet;
  }

  /** Throws for a name a sheet cannot have: empty, longer than 31 characters, `[]:*?/\`, or already used. */
  validateName(name: string, except?: Sheet): void {
    if (typeof name !== 'string' || name.trim() === '' || name.length > 31 || INVALID_NAME.test(name)) {
      throw new Error(`"${name}" is not a valid sheet name (1–31 characters, without [ ] : * ? / \\).`);
    }
    if (this.sheets.some(sheet => sheet !== except && sheet.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`A sheet named "${name}" already exists.`);
    }
  }

  /** The next free default id and name (`sheet2`, `Sheet2`, …). */
  nextDefault(): { id: string; name: string } {
    let number = this.#counter;
    let id: string;
    let name: string;

    do {
      number += 1;
      id = `sheet${number}`;
      name = `Sheet${number}`;
    } while (this.get(id) || this.sheets.some(sheet => sheet.name.toLowerCase() === name.toLowerCase()));
    this.#counter = number;

    return { id, name };
  }

  add(id: string | undefined, settings: AnyObject = {}): Core {
    const defaults = id === void 0 || id === null || id === '' ? this.nextDefault() : null;
    const sheetId = defaults ? defaults.id : String(id);
    const name = typeof settings.name === 'string' ? settings.name : (defaults ? defaults.name : sheetId);

    if (this.get(sheetId)) {
      throw new Error(`A sheet with the id "${sheetId}" already exists.`);
    }
    this.validateName(name);

    if (this.runRootHooks('beforeSheetAdd', sheetId, name) === false) {
      throw new Error(`Adding the sheet "${sheetId}" was cancelled by beforeSheetAdd.`);
    }
    // The engine gets the new sheet first, so the grid's formulas find it when the grid loads its data.
    if (this.model) {
      this.model.newSheet();
      this.model.renameSheet(this.sheets.length, name);
    }
    const rootSettings = this.root.getSettings() as AnyObject;
    const sheetSettings: AnyObject = {};

    INHERITED_SETTINGS.forEach((key) => {
      if (rootSettings[key] !== void 0) {
        sheetSettings[key] = rootSettings[key];
      }
    });
    Object.keys(settings).forEach((key) => {
      if (key !== 'name') {
        sheetSettings[key] = settings[key];
      }
    });
    sheetSettings.sheetId = sheetId;
    sheetSettings.sheetName = name;

    const element = this.createSheetElement();
    // Registered before the grid is created: its formulas plugin looks up its sheet while it loads the data.
    const sheet = { id: sheetId, name, instance: null as unknown as Core };

    this.sheets.push(sheet);
    pendingSheets.set(element, this);
    // Created where the browser lays it out (a hidden grid cannot measure its columns and rows), out of sight.
    const { position, visibility, left, top } = element.style;

    Object.assign(element.style, { position: 'absolute', visibility: 'hidden', left: '-100000px', top: '0' });
    sheet.instance = this.#createSheet(element, sheetSettings);
    Object.assign(element.style, { position, visibility, left, top });
    pendingSheets.delete(element);
    workbooks.set(sheet.instance, this);
    this.watchWidth(sheet.instance);

    this.setVisible(sheet, false);
    this.renderTabs();
    this.runRootHooks('afterSheetAdd', sheetId, name);

    return sheet.instance;
  }

  /** The element of a new sheet's grid: after the last sheet, with the first sheet's classes and inline style. */
  createSheetElement(): HTMLDivElement {
    const rootElement = this.root.rootElement;
    const element = document.createElement('div');
    const last = this.sheets[this.sheets.length - 1].instance.rootElement;

    element.className = Array.from(rootElement.classList)
      .filter(name => !/^(freesheet|handsontable|fs-|ht)/.test(name) || /^fs-document__sheet/.test(name)).join(' ');
    // The first sheet's inline style (an explicit size); otherwise a sheet is as tall as its content, like any grid.
    element.style.cssText = rootElement.style.cssText;
    last.parentNode!.insertBefore(element, last.nextSibling);

    return element;
  }

  activate(id: string): void {
    const sheet = this.require(id);
    const previousId = this.activeId;

    if (id === previousId) {
      return;
    }
    if (this.runRootHooks('beforeSheetActivate', id, previousId) === false) {
      return;
    }
    const previous = this.get(previousId);

    if (previous) {
      previous.instance.unlisten();
      this.setVisible(previous, false);
    }
    this.activeId = id;
    this.setVisible(sheet, true);
    this.refreshSize(sheet.instance);
    sheet.instance.listen();
    this.renderTabs();
    this.runRootHooks('afterSheetActivate', id, previousId);
  }

  rename(id: string, name: string): void {
    const sheet = this.require(id);
    const oldName = sheet.name;

    if (name === oldName) {
      return;
    }
    this.validateName(name, sheet);

    if (this.runRootHooks('beforeSheetRename', id, oldName, name) === false) {
      return;
    }
    // The engine renames the references to the sheet in every formula.
    if (this.model) {
      this.model.renameSheet(this.sheets.indexOf(sheet), name);
    }
    sheet.name = name;
    sheet.instance.updateSettings({ sheetName: name });
    this.syncFormulas();
    this.renderTabs();
    this.runRootHooks('afterSheetRename', id, oldName, name);
  }

  remove(id: string): void {
    const sheet = this.require(id);

    if (sheet.instance === this.root) {
      throw new Error(`The sheet "${id}" holds the document (it was created with new FreeSheet) and cannot be removed.`);
    }
    if (this.runRootHooks('beforeSheetRemove', id) === false) {
      return;
    }
    const index = this.sheets.indexOf(sheet);

    if (this.activeId === id) {
      this.activate(this.sheets[index === this.sheets.length - 1 ? index - 1 : index + 1].id);
    }
    // References to the removed sheet become #REF!.
    if (this.model) {
      this.model.deleteSheet(index);
    }
    this.sheets.splice(index, 1);
    workbooks.delete(sheet.instance);

    const element = sheet.instance.rootElement;
    const bar = this.formulaBarOf(sheet);

    sheet.instance.destroy();
    element.remove();
    bar?.remove();
    this.syncFormulas();
    this.renderTabs();
    this.runRootHooks('afterSheetRemove', id);
  }

  move(id: string, index: number): void {
    const sheet = this.require(id);
    const from = this.sheets.indexOf(sheet);
    const to = Math.max(0, Math.min(this.sheets.length - 1, Math.floor(index)));

    if (from === to) {
      return;
    }
    if (this.model) {
      this.model.moveSheet(from, to);
    }
    this.sheets.splice(from, 1);
    this.sheets.splice(to, 0, sheet);
    this.renderTabs();
    this.runRootHooks('afterSheetMove', id, to, from);
  }

  /** After the engine changed formulas (moved references, a renamed or removed sheet), every sheet's data follows. */
  syncFormulas(): void {
    if (!this.model) {
      return;
    }
    this.sheets.forEach(({ instance }) => {
      // A sheet still being created (its data loads into the engine) has no grid yet.
      const formulas = instance?.getPlugin('formulas') as unknown as { enabled: boolean; syncFormulas(): void } | undefined;

      if (formulas && formulas.enabled) {
        formulas.syncFormulas();
      }
    });
    this.get(this.activeId)?.instance.render();
  }

  /** The formula bar element of a sheet, when it has one. */
  formulaBarOf(sheet: Sheet): HTMLElement | null {
    const plugin = sheet.instance.getPlugin('formulaBar') as unknown as { element: HTMLElement | null } | undefined;

    return plugin && plugin.element ? plugin.element : null;
  }

  setVisible(sheet: Sheet, visible: boolean): void {
    const display = visible ? '' : 'none';

    sheet.instance.rootElement.style.display = display;
    const bar = this.formulaBarOf(sheet);

    if (bar) {
      bar.style.display = display;
    }
  }

  /** Runs a document hook on the first sheet (the grid that holds the document). */
  runRootHooks(key: string, ...args: unknown[]): unknown {
    return (this.root.runHooks as (key: string, ...hookArgs: unknown[]) => unknown)(key, ...args);
  }

  /** Whether the tab bar shows: with more than one sheet, or always with `sheetTabs: true`. */
  showsTabs(): boolean {
    const setting = (this.root.getSettings() as AnyObject).sheetTabs;

    return setting === false ? false : (setting === true || this.sheets.length > 1);
  }

  /**
   * The tab bar below the sheets: ☰ (every sheet in a menu), the tabs (scrolled sideways, with the wheel too, faded at
   * a hidden edge; a right click opens a menu; drag to reorder) and + (a new sheet).
   */
  renderTabs(): void {
    if (!this.showsTabs()) {
      this.#tabs?.remove();
      this.#tabs = null;

      return;
    }
    if (!this.#tabs) {
      this.#tabs = document.createElement('div');
      this.#tabs.addEventListener('mousedown', event => event.stopPropagation());
    }
    this.placeTabs();
    const themeClasses = Array.from(this.root.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name));
    const scrollLeft = this.#tabs.querySelector('.fs-sheet-tabs__list')?.scrollLeft || 0;

    this.#tabs.className = ['fs-sheet-tabs', ...themeClasses].join(' ');
    this.#tabs.textContent = '';
    this.placeTabs();

    const button = (className: string, label: string, text: string, onClick: (event: MouseEvent) => void) => {
      const element = document.createElement('button');

      element.type = 'button';
      element.className = className;
      element.title = label;
      element.setAttribute('aria-label', label);
      element.textContent = text;
      element.addEventListener('click', onClick);

      return element;
    };
    const list = document.createElement('div');

    list.className = 'fs-sheet-tabs__list';
    list.setAttribute('role', 'tablist');

    this.sheets.forEach((sheet, index) => {
      const tab = document.createElement('button');

      tab.type = 'button';
      tab.className = `fs-sheet-tab${sheet.id === this.activeId ? ' fs-sheet-tab--active' : ''}`;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', String(sheet.id === this.activeId));
      tab.dataset.sheetId = sheet.id;
      tab.textContent = sheet.name;
      tab.draggable = true;
      tab.addEventListener('click', () => this.activate(sheet.id));
      tab.addEventListener('dblclick', () => this.startRename(tab, sheet));
      tab.addEventListener('contextmenu', (event) => {
        event.preventDefault();
        this.openSheetMenu(sheet, event.clientX, event.clientY);
      });
      // Dragging a tab: a line before or after the tab under the pointer shows where it goes.
      const after = (event: DragEvent) => {
        const rect = tab.getBoundingClientRect();

        return event.clientX > rect.left + rect.width / 2;
      };
      const clearMarks = () => list.querySelectorAll('.fs-sheet-tab--drop-before, .fs-sheet-tab--drop-after')
        .forEach(element => element.classList.remove('fs-sheet-tab--drop-before', 'fs-sheet-tab--drop-after'));

      tab.addEventListener('dragstart', (event) => {
        this.#draggedId = sheet.id;
        event.dataTransfer?.setData('text/plain', sheet.id);
      });
      tab.addEventListener('dragend', () => {
        this.#draggedId = null;
        clearMarks();
      });
      tab.addEventListener('dragover', (event) => {
        if (!this.#draggedId) {
          return;
        }
        event.preventDefault();
        clearMarks();
        tab.classList.add(after(event) ? 'fs-sheet-tab--drop-after' : 'fs-sheet-tab--drop-before');
      });
      tab.addEventListener('dragleave', () => tab.classList.remove('fs-sheet-tab--drop-before',
        'fs-sheet-tab--drop-after'));
      tab.addEventListener('drop', (event) => {
        event.preventDefault();
        const draggedId = this.#draggedId || event.dataTransfer?.getData('text/plain');
        const dragged = draggedId ? this.get(draggedId) : undefined;

        clearMarks();
        this.#draggedId = null;

        if (dragged) {
          // The place among the other tabs: before or after this one.
          const from = this.sheets.indexOf(dragged);
          let to = index + (after(event) ? 1 : 0);

          if (from < to) {
            to -= 1;
          }
          this.move(dragged.id, to);
        }
      });
      list.appendChild(tab);
    });
    // The wheel scrolls the tabs sideways (a wheel that reports lines or pages, as in Firefox, in pixels too); the
    // fades show where tabs are hidden.
    list.addEventListener('wheel', (event) => {
      const delta = Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
      const unit = event.deltaMode === 1 ? 40 : (event.deltaMode === 2 ? list.clientWidth : 1);

      if (list.scrollWidth > list.clientWidth && delta !== 0) {
        event.preventDefault();
        list.scrollLeft += delta * unit;
        this.updateFades(list);
      }
    }, { passive: false });
    list.addEventListener('scroll', () => this.updateFades(list));

    this.#tabs.appendChild(button('fs-sheet-tabs__menu', 'All sheets', '☰', (event) => {
      const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

      this.openMenu(this.sheets.map(sheet => ({
        label: sheet.name,
        active: sheet.id === this.activeId,
        action: () => this.activate(sheet.id),
      })), rect.left, rect.top, true);
    }));
    // ‹ › scroll the tabs by most of the visible width.
    const step = (direction: number) => () => {
      list.scrollLeft += direction * Math.max(60, list.clientWidth * 0.75);
      this.updateFades(list);
    };

    this.#tabs.appendChild(button('fs-sheet-tabs__scroll fs-sheet-tabs__scroll--start', 'Scroll tabs left', '‹',
      step(-1)));
    this.#tabs.appendChild(button('fs-sheet-tabs__scroll fs-sheet-tabs__scroll--end', 'Scroll tabs right', '›',
      step(1)));
    this.#tabs.appendChild(list);
    this.#tabs.appendChild(button('fs-sheet-tabs__add', 'Add sheet', '+', () => this.activate(this.add(void 0).getSheetId())));

    list.scrollLeft = scrollLeft;
    this.matchGridWidth();
    list.querySelector<HTMLElement>('.fs-sheet-tab--active')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    this.updateFades(list);
  }

  /**
   * Puts the tab bar after the sheets (or before them, `sheetTabsPosition: 'top'`). The place comes from the page,
   * not from the order of the tabs: moving a tab does not move the sheets' elements.
   */
  placeTabs(): void {
    const tabs = this.#tabs!;
    const elements = this.sheets.flatMap((sheet) => {
      const bar = this.formulaBarOf(sheet);

      return bar ? [bar, sheet.instance.rootElement] : [sheet.instance.rootElement];
    });
    const inPageOrder = elements.sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
    const top = (this.root.getSettings() as AnyObject).sheetTabsPosition === 'top';
    const anchor = top ? inPageOrder[0] : inPageOrder[inPageOrder.length - 1];

    tabs.classList.toggle('fs-sheet-tabs--top', top);

    if (top && tabs.nextSibling !== anchor) {
      anchor.parentNode!.insertBefore(tabs, anchor);
    } else if (!top && tabs.previousSibling !== anchor) {
      anchor.parentNode!.insertBefore(tabs, anchor.nextSibling);
    }
  }

  /** Fades the edges of the tab list where tabs are scrolled out of sight. */
  updateFades(list: HTMLElement): void {
    const end = list.scrollWidth - list.clientWidth - list.scrollLeft;

    list.classList.toggle('fs-sheet-tabs__list--fade-start', list.scrollLeft > 1);
    list.classList.toggle('fs-sheet-tabs__list--fade-end', end > 1);

    const bar = list.parentElement;
    const start = bar?.querySelector<HTMLButtonElement>('.fs-sheet-tabs__scroll--start');
    const finish = bar?.querySelector<HTMLButtonElement>('.fs-sheet-tabs__scroll--end');

    if (start && finish) {
      start.disabled = list.scrollLeft <= 1;
      finish.disabled = end <= 1;
    }
  }

  /** The tab bar is as wide as the active sheet's drawn grid (its table and vertical scrollbar); the tabs scroll. */
  matchGridWidth(): void {
    const sheet = this.get(this.activeId);
    const wtTable = sheet?.instance.view?.wt?.wtTable;

    if (!this.#tabs || !sheet || !wtTable) {
      return;
    }
    const holder = wtTable.holder as HTMLElement;
    const width = Math.min(sheet.instance.rootElement.offsetWidth,
      (wtTable.TABLE as HTMLElement).offsetWidth + holder.offsetWidth - holder.clientWidth);

    this.#tabs.style.width = width > 0 ? `${width}px` : '';
    const list = this.#tabs.querySelector<HTMLElement>('.fs-sheet-tabs__list');

    if (list) {
      this.updateFades(list);
    }
  }

  /**
   * Draws a sheet that was hidden: a hidden grid cannot measure its rows, so the first draw measures the taller
   * rows (wrapped text) and the second sizes the grid's holder for them.
   */
  refreshSize(instance: Core): void {
    instance.forceFullRender = true;
    instance.view.render();
    instance.view.wt.wtOverlays.adjustElementsSize(true);
    instance.forceFullRender = true;
    instance.view.render();
  }

  /** The tab bar follows the active sheet's width when it renders (columns resized, data loaded, …). */
  watchWidth(instance: Core): void {
    instance.addHook('afterRender', () => {
      if (this.sheetOf(instance)?.id === this.activeId) {
        this.matchGridWidth();
      }
    });
  }

  /** Renames a sheet in place: the tab becomes an input (Enter or leaving it keeps the name, Escape cancels). */
  startRename(tab: HTMLElement, sheet: Sheet): void {
    const input = document.createElement('input');

    input.className = 'fs-sheet-tab__input';
    input.value = sheet.name;
    input.setAttribute('aria-label', 'Sheet name');
    tab.textContent = '';
    tab.appendChild(input);
    input.focus();
    input.select();

    let done = false;
    const finish = (keep: boolean) => {
      if (done) {
        return;
      }
      done = true;
      try {
        if (keep) {
          this.rename(sheet.id, input.value.trim());
        }
      } catch (error) {
        tab.title = (error as Error).message;
      }
      this.renderTabs();
    };

    input.addEventListener('keydown', (event) => {
      event.stopPropagation();

      if (event.key === 'Enter') {
        finish(true);
      } else if (event.key === 'Escape') {
        finish(false);
      }
    });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('click', event => event.stopPropagation());
  }

  /** The right-click menu of a tab. */
  openSheetMenu(sheet: Sheet, x: number, y: number): void {
    const index = this.sheets.indexOf(sheet);

    this.openMenu([
      { label: 'Rename', action: () => {
        const tab = this.#tabs?.querySelector<HTMLElement>(`[data-sheet-id="${CSS.escape(sheet.id)}"]`);

        if (tab) {
          this.startRename(tab, sheet);
        }
      } },
      { label: 'Delete', disabled: sheet.instance === this.root, action: () => this.remove(sheet.id) },
      { label: 'Move left', disabled: index === 0, action: () => this.move(sheet.id, index - 1) },
      { label: 'Move right', disabled: index === this.sheets.length - 1, action: () => this.move(sheet.id, index + 1) },
    ], x, y);
  }

  /** A small menu at a point (above it when `above`). */
  openMenu(items: { label: string; action: () => void; disabled?: boolean; active?: boolean }[], x: number, y: number,
    above = false): void {
    this.closeMenu();
    const menu = document.createElement('div');

    menu.className = ['fs-sheet-menu',
      ...Array.from(this.root.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name))].join(' ');
    menu.setAttribute('role', 'menu');
    items.forEach(({ label, action, disabled, active }) => {
      const item = document.createElement('button');

      item.type = 'button';
      item.className = `fs-sheet-menu__item${active ? ' fs-sheet-menu__item--active' : ''}`;
      item.setAttribute('role', 'menuitem');
      item.textContent = label;
      item.disabled = !!disabled;
      item.addEventListener('click', () => {
        this.closeMenu();
        action();
      });
      menu.appendChild(item);
    });
    document.body.appendChild(menu);
    menu.style.left = `${x}px`;
    menu.style.top = `${above ? Math.max(0, y - menu.offsetHeight) : y}px`;
    this.#menu = menu;
    document.addEventListener('mousedown', this.#onDocumentMouseDown, true);
  }

  closeMenu(): void {
    this.#menu?.remove();
    this.#menu = null;
    document.removeEventListener('mousedown', this.#onDocumentMouseDown, true);
  }

  /** The whole document as JSON-safe data: every sheet's data (with formulas), sizes, merged cells and cell formats. */
  save(): SavedDocument {
    return { version: 1, activeSheet: this.activeId, sheets: this.sheets.map(saveSheet) };
  }

  /**
   * Replaces the document with a saved one: the first sheet takes the first saved sheet, the other sheets are removed
   * and the saved ones added, in their order; then the saved active sheet is shown.
   */
  load(saved: SavedDocument): void {
    if (!saved || !Array.isArray(saved.sheets) || saved.sheets.length === 0) {
      throw new Error('loadDocument needs a document from getDocument (an object with a non-empty `sheets` list).');
    }
    const [first, ...others] = saved.sheets;
    const rootSheet = this.sheetOf(this.root)!;

    this.activate(rootSheet.id);
    this.sheets.filter(sheet => sheet !== rootSheet).forEach(sheet => this.remove(sheet.id));

    // The first sheet keeps its grid: its id, name and content follow the saved first sheet.
    rootSheet.id = first.id;
    this.activeId = first.id;

    if (first.name !== rootSheet.name) {
      this.rename(first.id, first.name);
    }
    // The sizes and merged cells users changed belong to the old content: they go before the saved ones apply.
    const plugin = (name: string) => this.root.getPlugin(name as 'search') as unknown as AnyObject | undefined;
    const settings = sheetSettings(first);

    if (plugin('manualColumnResize')?.enabled) {
      plugin('manualColumnResize')!.manualColumnWidths = [];
    }
    if (plugin('manualRowResize')?.enabled) {
      plugin('manualRowResize')!.manualRowHeights = [];
    }
    if (!settings.mergeCells && plugin('mergeCells')?.enabled) {
      settings.mergeCells = [];
    }
    // The first sheet keeps its hiding options; what is hidden follows the saved sheet.
    const kept = [['hiddenRows', 'rows'], ['hiddenColumns', 'columns'], ['filters', 'conditions'],
      ['rowGroups', 'groups'], ['columnOutline', 'groups']] as const;

    kept.forEach(([name, key]) => {
      const current = this.root.getSettings()[name];

      if (current || settings[name]) {
        settings[name] = { ...(typeof current === 'object' ? current : {}), [key]: first[name] || [] };
      }
    });
    // The rules follow the saved sheet (none when it has none).
    if (!settings.conditionalFormatting && plugin('conditionalFormatting')?.enabled) {
      settings.conditionalFormatting = true;
    }
    this.root.updateSettings(settings);
    others.forEach(sheet => this.add(sheet.id, { name: sheet.name, ...sheetSettings(sheet) }));
    // Nested rows: the parents that were collapsed.
    saved.sheets.forEach((sheet) => {
      const nestedRows = this.get(sheet.id)?.instance.getPlugin('nestedRows' as 'search') as unknown as AnyObject | undefined;

      if (nestedRows?.enabled && sheet.collapsedRows) {
        (nestedRows.setCollapsedRows as (rows: number[]) => void)(sheet.collapsedRows);
      }
    });

    if (saved.activeSheet && this.get(saved.activeSheet)) {
      this.activate(saved.activeSheet);
    }
    this.renderTabs();
  }

  /** Destroys every other sheet and the tab bar (the first sheet destroys itself). */
  destroy(): void {
    this.closeMenu();
    this.sheets.filter(sheet => sheet.instance !== this.root).forEach((sheet) => {
      const element = sheet.instance.rootElement;
      const bar = this.formulaBarOf(sheet);

      workbooks.delete(sheet.instance);
      sheet.instance.destroy();
      element.remove();
      bar?.remove();
    });
    this.sheets = this.sheets.filter(sheet => sheet.instance === this.root);
    this.#tabs?.remove();
    this.#tabs = null;
    workbooks.delete(this.root);
  }
}

/** The document of a grid, including one that is being created by `addSheet`. */
export const getWorkbookOf = (instance: Core): Workbook | null => workbooks.get(instance) ||
  (instance.rootElement ? pendingSheets.get(instance.rootElement) || null : null);
