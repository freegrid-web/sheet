import './nestedRows.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { getTranslator } from './../../utils/recordTranslator';
import { stopImmediatePropagation } from './../../helpers/dom/event';
import { warn } from './../../helpers/console';
import * as C from './../../i18n/constants';
import type { IndexVisibility } from './../../utils/indexVisibility';
import type { MenuItem } from './../contextMenu/menuItem';

type Row = Record<string, unknown>;

/** The `nestedRows` setting as an object. */
export type NestedRowsSettings = {
  /** The property that holds a row's children (default `__children`). */
  childrenKey?: string;
  /** `flat` (1, 2, 3, as in Excel, the default) or `outline` (1, 1.1, 1.2, 2) row numbers. */
  numbering?: 'flat' | 'outline';
  /** `true`: every parent starts collapsed; a number: the levels shown at start (1 = the top level only). */
  collapsed?: boolean | number;
  /** Where the expand/collapse button is: in the row header (default) or in the first column. */
  toggle?: 'rowHeader' | 'column';
  /** The indent of each level, in pixels (default 16). */
  indent?: number;
};

const SOURCE = 'nestedRows';
const TOGGLE_CLASS_NAME = 'fs-nested-toggle';
/** Rows shown only because a filtered descendant matches. */
const CONTEXT_CLASS_NAME = 'fs-nested-context';

/**
 * Nested rows: rows with children, as a tree grid. A row's children are in `__children` (or `childrenKey`); a parent
 * row expands and collapses its children with the button in its row header (or in the first column).
 *
 * ```js
 * new FreeSheet(container, {
 *   data: [{ task: 'Design', __children: [{ task: 'Sketches' }, { task: 'Review' }] }, { task: 'Build' }],
 *   columns: [{ data: 'task' }],
 *   rowHeaders: true,
 *   nestedRows: { numbering: 'outline' },
 * });
 * ```
 *
 * The grid works with the tree's rows in order (each parent before its children): `getSourceData()` and the physical
 * row indexes count every row, and `getSourceData()` of this plugin returns the tree. Sorting sorts the children of
 * each parent; filtering shows the rows that match and their parents. Insert child row, Indent and Outdent in the
 * context menu change the tree without moving rows, so formulas keep their references.
 */
class NestedRows extends BasePlugin {
  /** The tree the grid was given. */
  #tree: Row[] = [];
  /** The rows in order (the grid's data). */
  #rows: Row[] = [];
  #parent = new Map<Row, Row | null>();
  #level = new Map<Row, number>();
  #index = new Map<Row, number>();
  #collapsed = new Set<Row>();
  /** While a filter is on: the rows shown only as parents of matching rows. */
  #context = new Set<Row>();
  #filtering = false;
  /** The parent the next inserted rows go to (addChild). */
  #pendingParent: Row | null = null;
  /** The rows about to be removed. */
  #removing: Row[] = [];
  /** Outline numbers by row, while valid. */
  #numbers: Map<Row, string> | null = null;
  /** The `childrenKey` the tree was read with. */
  #readKey = '';

  get settings(): NestedRowsSettings {
    const settings = this.hot.getSettings().nestedRows;

    return settings && typeof settings === 'object' ? settings : {};
  }

  get childrenKey(): string {
    return this.settings.childrenKey || '__children';
  }

  get indentWidth(): number {
    return Number.isFinite(this.settings.indent) ? Number(this.settings.indent) : 16;
  }

  get visibility(): IndexVisibility {
    return getTranslator(this.hot).rows!;
  }

  isEnabled(): boolean {
    return !!this.hot.getSettings().nestedRows;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('beforeLoadData', (data: unknown) => this.onBeforeLoadData(data));
    this.addHook('afterLoadData', () => this.applyCollapsedSetting());
    this.addHook('afterCreateRow', (index: number, amount: number) => this.onAfterCreateRow(index, amount));
    this.addHook('modifyRemovedAmount', (amount: number, row: number) => this.onModifyRemovedAmount(amount, row));
    this.addHook('beforeRemoveRow', (_row: number, _amount: number, physicalRows: number[] = []) => {
      this.#removing = physicalRows.map(row => this.#rows[row]).filter(Boolean);
    });
    this.addHook('afterRemoveRow', () => this.onAfterRemoveRow());
    this.addHook('afterColumnSort', () => {
      this.#numbers = null;
    });
    this.addHook('afterGetRowHeader', (row: number, TH: HTMLTableCellElement) => this.decorateRowHeader(row, TH));
    this.addHook('modifyRowHeaderWidth', (width: number) => this.onModifyRowHeaderWidth(width));
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, row: number, column: number) =>
      this.decorateCell(TD, row, column));
    this.addHook('beforeKeyDown', (event: KeyboardEvent) => this.onBeforeKeyDown(event));
    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addMenuItems(options));
    this.hot.rootElement.addEventListener('mousedown', this.onToggleMouseDown, true);
    this.hot.rootElement.classList.add('fs-nested-rows');

    super.enablePlugin();

    // Turned on after the data was loaded: load it again as a tree.
    if (this.hot.view) {
      this.hot.loadData(this.hot.getSourceData());
    }
  }

  disablePlugin(): void {
    const tree = this.#tree;

    this.hot.rootElement.removeEventListener('mousedown', this.onToggleMouseDown, true);
    this.hot.rootElement.classList.remove('fs-nested-rows');
    this.visibility.setHidden(SOURCE, null);
    this.#reset();
    super.disablePlugin();

    // The grid gets the tree back as its data.
    if (this.hot.view && !this.hot.isDestroyed) {
      this.hot.loadData(tree);
    }
  }

  updatePlugin(): void {
    // Another `childrenKey` reads the tree again; other options only redraw.
    if (this.childrenKey !== this.#readKey) {
      this.hot.loadData(this.#tree);
    } else {
      this.refresh();
    }
    super.updatePlugin();
  }

  #reset(): void {
    this.#tree = [];
    this.#rows = [];
    this.#parent.clear();
    this.#level.clear();
    this.#index.clear();
    this.#collapsed.clear();
    this.#context.clear();
    this.#numbers = null;
  }

  /** The tree, as the grid was given it (with the changes made since). */
  getSourceData(): Row[] {
    return this.#tree;
  }

  onBeforeLoadData(data: unknown): unknown {
    // Already the rows (the grid reloading its own data).
    if (!Array.isArray(data) || data === this.#rows) {
      return data;
    }
    if (data.some(row => Array.isArray(row))) {
      warn('nestedRows needs rows that are objects; array rows cannot have children.');

      return data;
    }
    const tree = data as Row[];
    const previous = new Set(this.#rows);

    this.#tree = tree;
    this.#readKey = this.childrenKey;
    // The grid's rows are a new array: the tree stays as it was given.
    this.#rows = [];
    this.#collapsed = new Set(Array.from(this.#collapsed).filter(row => previous.has(row)));
    this.rebuild();

    return this.#rows;
  }

  /**
   * Reads the tree again: the rows in order, each row's parent, level and index.
   *
   * @private
   */
  rebuild(): void {
    const key = this.childrenKey;
    const rows: Row[] = [];

    this.#parent.clear();
    this.#level.clear();
    const walk = (children: Row[], parent: Row | null, level: number) => {
      children.forEach((row) => {
        rows.push(row);
        this.#parent.set(row, parent);
        this.#level.set(row, level);

        const nested = row[key];

        if (Array.isArray(nested) && nested.length) {
          walk(nested as Row[], row, level + 1);
        }
      });
    };

    walk(this.#tree, null, 0);
    // The same array the grid reads: its content changes, not the array.
    this.#rows.length = 0;
    rows.forEach(row => this.#rows.push(row));
    this.#index.clear();
    this.#rows.forEach((row, index) => this.#index.set(row, index));
    this.#collapsed.forEach((row) => {
      if (!this.hasChildren(row)) {
        this.#collapsed.delete(row);
      }
    });
    this.#numbers = null;
    this.updateVisibility();
  }

  children(row: Row): Row[] {
    const nested = row[this.childrenKey];

    return Array.isArray(nested) ? nested as Row[] : [];
  }

  hasChildren(row: Row): boolean {
    return this.children(row).length > 0;
  }

  /**
   * Every descendant of a row, in order.
   *
   * @private
   */
  descendants(row: Row): Row[] {
    const result: Row[] = [];
    const walk = (parent: Row) => this.children(parent).forEach((child) => {
      result.push(child);
      walk(child);
    });

    walk(row);

    return result;
  }

  /**
   * The rows collapsed parents hide (none while a filter is on: it shows the matching rows and their parents).
   *
   * @private
   */
  updateVisibility(): void {
    const hidden: number[] = [];

    if (!this.#filtering) {
      this.#collapsed.forEach((row) => {
        if (this.#index.has(row) && this.isVisibleParent(row)) {
          this.descendants(row).forEach(child => hidden.push(this.#index.get(child)!));
        }
      });
    }
    this.visibility.setHidden(SOURCE, hidden);
  }

  /**
   * Whether no collapsed ancestor already hides the row.
   *
   * @private
   */
  isVisibleParent(row: Row): boolean {
    let parent = this.#parent.get(row) || null;

    while (parent) {
      if (this.#collapsed.has(parent)) {
        return false;
      }
      parent = this.#parent.get(parent) || null;
    }

    return true;
  }

  /**
   * The `collapsed` setting, after new data is loaded.
   *
   * @private
   */
  applyCollapsedSetting(): void {
    const { collapsed } = this.settings;

    if (collapsed === true || typeof collapsed === 'number') {
      const depth = collapsed === true ? 0 : Math.max(0, collapsed - 1);

      this.#rows.forEach((row) => {
        if (this.hasChildren(row) && this.#level.get(row)! >= depth) {
          this.#collapsed.add(row);
        }
      });
    }
    this.updateVisibility();
  }

  // -- Rows by index ------------------------------------------------------------------------------------------------

  rowAt(visualRow: number): Row | undefined {
    const physical = this.hot.toPhysicalRow(visualRow);

    return physical === null || physical < 0 ? void 0 : this.#rows[physical];
  }

  visualOf(row: Row): number | null {
    const physical = this.#index.get(row);

    return physical === void 0 ? null : this.hot.toVisualRow(physical);
  }

  /**
   * The level of a row: 0 for a top-level row.
   *
   * @param row Visual row index.
   */
  getLevel(row: number): number {
    const node = this.rowAt(row);

    return node ? this.#level.get(node) || 0 : 0;
  }

  /**
   * The parent of a row, as a visual row index (`null` for a top-level row).
   *
   * @param row Visual row index.
   */
  getParent(row: number): number | null {
    const parent = this.rowAt(row) ? this.#parent.get(this.rowAt(row)!) : null;

    return parent ? this.visualOf(parent) : null;
  }

  /**
   * The visible children of a row, as visual row indexes.
   *
   * @param row Visual row index.
   */
  getChildren(row: number): number[] {
    const node = this.rowAt(row);

    return node ? this.children(node).map(child => this.visualOf(child)).filter((index): index is number =>
      index !== null) : [];
  }

  /**
   * Whether a row has children.
   *
   * @param row Visual row index.
   */
  isParent(row: number): boolean {
    const node = this.rowAt(row);

    return !!node && this.hasChildren(node);
  }

  /**
   * Whether a row is collapsed.
   *
   * @param row Visual row index.
   */
  isCollapsed(row: number): boolean {
    const node = this.rowAt(row);

    return !!node && this.#collapsed.has(node);
  }

  /**
   * The row's number: its path among its siblings (`1.2.3`) with `numbering: 'outline'`, otherwise its row number.
   *
   * @param row Visual row index.
   */
  getRowNumber(row: number): string {
    const node = this.rowAt(row);

    if (!node) {
      return '';
    }
    if (this.settings.numbering !== 'outline') {
      return String(this.visibility.toOrdered(row) + 1);
    }

    return this.numbers().get(node) || '';
  }

  /**
   * The outline numbers, in the order the rows are shown (sorted siblings count in their new order).
   *
   * @private
   */
  numbers(): Map<Row, string> {
    if (this.#numbers) {
      return this.#numbers;
    }
    const numbers = new Map<Row, string>();
    const order = (row: Row) => this.hot.runHooks('unmodifyRow', this.#index.get(row)!) as number;
    const walk = (children: Row[], prefix: string) => {
      [...children].sort((a, b) => order(a) - order(b)).forEach((child, i) => {
        const number = `${prefix}${i + 1}`;

        numbers.set(child, number);
        walk(this.children(child), `${number}.`);
      });
    };

    walk(this.#tree, '');
    this.#numbers = numbers;

    return numbers;
  }

  // -- Expanding and collapsing -------------------------------------------------------------------------------------

  /**
   * Shows a row's children.
   *
   * @param row Visual row index.
   */
  expand(row: number): void {
    this.setCollapsed(this.rowAt(row), false);
  }

  /**
   * Hides a row's children.
   *
   * @param row Visual row index.
   */
  collapse(row: number): void {
    this.setCollapsed(this.rowAt(row), true);
  }

  /**
   * Expands a collapsed row, collapses an expanded one.
   *
   * @param row Visual row index.
   */
  toggle(row: number): void {
    const node = this.rowAt(row);

    this.setCollapsed(node, !!node && !this.#collapsed.has(node));
  }

  /** Shows every row. */
  expandAll(): void {
    this.#collapsed.clear();
    this.updateVisibility();
    this.refresh();
  }

  /** Collapses every parent. */
  collapseAll(): void {
    this.#rows.forEach(row => this.hasChildren(row) && this.#collapsed.add(row));
    this.updateVisibility();
    this.refresh();
  }

  /** The physical rows of the collapsed parents (for saving). */
  getCollapsedRows(): number[] {
    return Array.from(this.#collapsed).map(row => this.#index.get(row)!).filter(Number.isInteger).sort((a, b) => a - b);
  }

  /**
   * Collapses the given parents and expands the others.
   *
   * @param physicalRows Physical row indexes.
   */
  setCollapsedRows(physicalRows: number[]): void {
    this.#collapsed = new Set(physicalRows.map(row => this.#rows[row]).filter(row => row && this.hasChildren(row)));
    this.updateVisibility();
    this.refresh();
  }

  setCollapsed(node: Row | undefined, collapsed: boolean): void {
    if (!node || !this.hasChildren(node) || this.#collapsed.has(node) === collapsed) {
      return;
    }
    const physical = this.#index.get(node)!;
    const action = collapsed ? 'Collapse' : 'Expand';

    if (this.hot.runHooks(`beforeRow${action}`, physical) === false) {
      return;
    }
    if (collapsed) {
      this.#collapsed.add(node);
    } else {
      this.#collapsed.delete(node);
    }
    this.updateVisibility();
    this.refresh();
    this.hot.runHooks(`afterRow${action}`, physical);
  }

  // -- Changing the tree --------------------------------------------------------------------------------------------

  /**
   * Adds a child row at the end of a row's children (the row expands).
   *
   * @param row Visual row index.
   * @param data The new row (a blank row when not given).
   */
  addChild(row: number, data?: Row): void {
    const parent = this.rowAt(row);

    if (!parent || this.hot.runHooks('beforeAddChild', parent, data) === false) {
      return;
    }
    this.setCollapsed(parent, false);

    const last = [parent, ...this.descendants(parent)].pop()!;
    const lastVisual = this.visualOf(last) ?? row;

    this.#pendingParent = parent;
    this.hot.alter('insert_row', lastVisual + 1, 1, 'NestedRows.addChild');
    this.#pendingParent = null;

    const child = this.children(parent)[this.children(parent).length - 1];

    if (data && child) {
      Object.assign(child, data);
      this.hot.render();
    }
    this.hot.runHooks('afterAddChild', parent, child);
  }

  /** New rows: their parent follows from where they are (before the next row, among its siblings). */
  onAfterCreateRow(index: number, amount: number): void {
    const created = this.#rows.slice(index, index + amount);
    const next = this.#rows[index + amount];
    const previous = this.#rows[index - 1];
    let siblings: Row[] = this.#tree;
    let position = siblings.length;

    if (this.#pendingParent) {
      siblings = this.childList(this.#pendingParent);
      position = siblings.length;
    } else if (next && this.#index.has(next)) {
      const parent = this.#parent.get(next) || null;

      siblings = parent ? this.childList(parent) : this.#tree;
      position = siblings.indexOf(next);
    } else if (previous && this.#index.has(previous)) {
      const parent = this.#parent.get(previous) || null;

      siblings = parent ? this.childList(parent) : this.#tree;
      position = siblings.indexOf(previous) + 1;
    }
    created.forEach(row => delete row[this.childrenKey]);
    siblings.splice(position, 0, ...created);
    this.rebuild();
  }

  /**
   * A row's children array (created when it has none).
   *
   * @private
   */
  childList(row: Row): Row[] {
    if (!Array.isArray(row[this.childrenKey])) {
      row[this.childrenKey] = [];
    }

    return row[this.childrenKey] as Row[];
  }

  /** Removing a row removes its children too: collapsed ones are shown first, so they are removed with it. */
  onModifyRemovedAmount(amount: number, row: number): number {
    if (typeof row !== 'number' || row < 0) {
      return amount;
    }
    const nodes = Array.from({ length: amount }, (_, i) => this.rowAt(row + i)).filter((node): node is Row => !!node);
    let last = row + amount - 1;
    let changed = false;

    nodes.forEach((node) => {
      [node, ...this.descendants(node)].forEach((descendant) => {
        if (this.#collapsed.delete(descendant)) {
          changed = true;
        }
      });
    });
    if (changed) {
      this.updateVisibility();
    }
    nodes.forEach((node) => {
      this.descendants(node).forEach((descendant) => {
        const visual = this.visualOf(descendant);

        if (visual !== null && visual > last) {
          last = visual;
        }
      });
    });

    return last - row + 1;
  }

  /** Removed rows leave the tree; their children that stay (hidden by a filter) take their place. */
  onAfterRemoveRow(): void {
    const removed = new Set(this.#removing);

    this.#removing = [];
    const prune = (children: Row[]): Row[] => children.flatMap((child) => {
      const kept = prune(this.children(child));

      if (Array.isArray(child[this.childrenKey])) {
        (child[this.childrenKey] as Row[]).splice(0, Infinity, ...kept);
      }

      return removed.has(child) ? kept : [child];
    });
    const top = prune(this.#tree);

    this.#tree.splice(0, Infinity, ...top);
    removed.forEach(row => this.#collapsed.delete(row));
    this.rebuild();
  }

  /**
   * Makes a row the last child of the row above it on its level (with its children). The rows keep their order.
   *
   * @param row Visual row index.
   */
  indent(row: number): void {
    const node = this.rowAt(row);
    const parent = node ? this.#parent.get(node) || null : null;
    const siblings = parent ? this.children(parent) : this.#tree;
    const position = node ? siblings.indexOf(node) : -1;

    if (!node || position < 1) {
      return;
    }
    const newParent = siblings[position - 1];

    if (this.hot.runHooks('beforeAddChild', newParent, node) === false) {
      return;
    }
    siblings.splice(position, 1);
    this.childList(newParent).push(node);
    this.#collapsed.delete(newParent);
    this.rebuild();
    this.refresh();
    this.hot.runHooks('afterAddChild', newParent, node);
  }

  /**
   * Moves a row up a level, after its parent; the rows after it under the same parent become its children, so the rows
   * keep their order.
   *
   * @param row Visual row index.
   */
  outdent(row: number): void {
    const node = this.rowAt(row);
    const parent = node ? this.#parent.get(node) || null : null;

    if (!node || !parent || this.hot.runHooks('beforeDetachChild', parent, node) === false) {
      return;
    }
    const siblings = this.children(parent);
    const position = siblings.indexOf(node);
    const following = siblings.splice(position);
    const grandParent = this.#parent.get(parent) || null;
    const parentSiblings = grandParent ? this.children(grandParent) : this.#tree;

    following.shift();
    if (following.length) {
      this.childList(node).push(...following);
    }
    if (!siblings.length) {
      delete parent[this.childrenKey];
    }
    parentSiblings.splice(parentSiblings.indexOf(parent) + 1, 0, node);
    this.rebuild();
    this.refresh();
    this.hot.runHooks('afterDetachChild', parent, node);
  }

  // -- Sorting and filtering ----------------------------------------------------------------------------------------

  /**
   * Sorts each parent's children (used by column sorting).
   *
   * @param entries `[physical row, ...values]` for every row.
   * @param sortList Sorts a list of entries in place.
   * @returns The physical rows in their sorted order.
   */
  sortTree<T extends [number, ...unknown[]]>(entries: T[], sortList: (list: T[]) => void): number[] {
    const byParent = new Map<Row | null, T[]>();

    entries.forEach((entry) => {
      const row = this.#rows[entry[0]];
      const parent = row ? this.#parent.get(row) || null : null;

      if (!byParent.has(parent)) {
        byParent.set(parent, []);
      }
      byParent.get(parent)!.push(entry);
    });
    byParent.forEach(list => sortList(list));

    const order: number[] = [];
    const walk = (parent: Row | null) => (byParent.get(parent) || []).forEach((entry) => {
      order.push(entry[0]);
      walk(this.#rows[entry[0]]);
    });

    walk(null);

    return order;
  }

  /**
   * The rows a filter shows: the matching rows and their parents (used by filters).
   *
   * @param matching Whether each physical row matches.
   * @param active Whether any condition is set.
   *
   * @private
   */
  filterTree(matching: boolean[], active: boolean): boolean[] {
    const shown = [...matching];

    this.#context.clear();
    this.#filtering = active;
    if (active) {
      matching.forEach((matches, index) => {
        let parent = matches ? this.#parent.get(this.#rows[index]) || null : null;

        while (parent && !shown[this.#index.get(parent)!]) {
          shown[this.#index.get(parent)!] = true;
          this.#context.add(parent);
          parent = this.#parent.get(parent) || null;
        }
      });
    }
    this.updateVisibility();

    return shown;
  }

  // -- Drawing ------------------------------------------------------------------------------------------------------

  toggleElement(node: Row): HTMLElement {
    const toggle = document.createElement('span');
    const collapsed = this.#collapsed.has(node) && !this.#filtering;

    toggle.className = `${TOGGLE_CLASS_NAME}${collapsed ? ` ${TOGGLE_CLASS_NAME}--collapsed` : ''}`;
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-expanded', String(!collapsed));
    toggle.setAttribute('aria-label', this.hot.getTranslatedPhrase(collapsed ? C.NESTED_ROWS_EXPAND :
      C.NESTED_ROWS_COLLAPSE, 0) as string);
    toggle.dataset.row = String(this.#index.get(node));

    return toggle;
  }

  decorateRowHeader(row: number, TH: HTMLTableCellElement): void {
    if (row < 0) {
      return;
    }
    const node = this.rowAt(row);
    const container = (TH.querySelector(':scope > .relative') || TH) as HTMLElement;
    const inHeader = (this.settings.toggle || 'rowHeader') === 'rowHeader';

    TH.querySelectorAll(`.${TOGGLE_CLASS_NAME}`).forEach(toggle => toggle.remove());
    container.style.paddingLeft = node && inHeader ? `${(this.#level.get(node) || 0) * this.indentWidth + 16}px` : '';
    container.classList.toggle('fs-nested-header', !!node && inHeader);
    if (!node) {
      return;
    }
    const label = TH.querySelector('.rowHeader');

    if (label && this.hot.getSettings().rowHeaders === true) {
      label.textContent = this.getRowNumber(row);
    }
    if (inHeader && this.hasChildren(node)) {
      container.insertBefore(this.toggleElement(node), container.firstChild);
    }
  }

  decorateCell(TD: HTMLTableCellElement, row: number, column: number): void {
    const node = this.rowAt(row);

    if (!node) {
      return;
    }
    const level = this.#level.get(node) || 0;

    TD.classList.add(`fs-nested-level-${level}`);
    if (this.hasChildren(node)) {
      TD.classList.add('fs-nested-parent');
    }
    if (this.#context.has(node)) {
      TD.classList.add(CONTEXT_CLASS_NAME);
    }
    if (TD.style.paddingLeft) {
      TD.style.paddingLeft = '';
    }
    if (this.settings.toggle === 'column' && column === 0) {
      TD.classList.add('fs-nested-cell');
      TD.style.paddingLeft = `${level * this.indentWidth + 20}px`;
      if (this.hasChildren(node)) {
        TD.insertBefore(this.toggleElement(node), TD.firstChild);
      }
    }
  }

  /** Room in the row header for the indent, the button and the number. */
  onModifyRowHeaderWidth(width: number): number {
    if ((this.settings.toggle || 'rowHeader') !== 'rowHeader' || !this.#rows.length) {
      return width;
    }
    let deepest = 0;
    let longest = String(this.#rows.length).length;

    this.#rows.forEach((row) => {
      deepest = Math.max(deepest, this.#level.get(row) || 0);
    });
    if (this.settings.numbering === 'outline') {
      this.numbers().forEach((number) => {
        longest = Math.max(longest, number.length);
      });
    }

    return Math.max(width || 50, deepest * this.indentWidth + 16 + longest * 8 + 14);
  }

  onToggleMouseDown = (event: MouseEvent): void => {
    const toggle = event.button === 0 ? (event.target as HTMLElement).closest(`.${TOGGLE_CLASS_NAME}`) : null;

    if (!toggle || !this.hot.rootElement.contains(toggle)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    const node = this.#rows[Number((toggle as HTMLElement).dataset.row)];

    this.setCollapsed(node, !!node && !this.#collapsed.has(node));
  };

  /** Alt+Shift+→ expands, Alt+Shift+← collapses the selected row. */
  onBeforeKeyDown(event: KeyboardEvent): void {
    const selected = this.hot.getSelectedLast();

    const left = event.key === 'ArrowLeft' || event.keyCode === 37;
    const right = event.key === 'ArrowRight' || event.keyCode === 39;

    if (!selected || !event.altKey || !event.shiftKey || (!left && !right)) {
      return;
    }
    event.preventDefault();
    stopImmediatePropagation(event);
    this.setCollapsed(this.rowAt(selected[0]), left);
  }

  addMenuItems(options: { items: MenuItem[] }): void {
    const selectedRow = () => {
      const selected = this.hot.getSelectedLast();

      return selected ? Math.max(0, Math.min(selected[0], selected[2])) : null;
    };
    const item = (key: string, phrase: string, callback: (row: number) => void,
      disabled: (row: number) => boolean = () => false) => ({
      key,
      name: () => this.hot.getTranslatedPhrase(phrase, 0) as string,
      callback: () => {
        const row = selectedRow();

        if (row !== null) {
          callback(row);
        }
      },
      disabled: () => {
        const row = selectedRow();

        return row === null || disabled(row);
      },
    }) as MenuItem;
    const position = (row: number) => {
      const node = this.rowAt(row);
      const parent = node ? this.#parent.get(node) || null : null;

      return node ? (parent ? this.children(parent) : this.#tree).indexOf(node) : -1;
    };

    options.items.push(
      { name: '---------' } as MenuItem,
      item('nested_rows_insert_child', C.CONTEXTMENU_ITEMS_NESTED_ROWS_INSERT_CHILD, row => this.addChild(row)),
      item('nested_rows_indent', C.NESTED_ROWS_INDENT, row => this.indent(row), row => position(row) < 1),
      item('nested_rows_outdent', C.NESTED_ROWS_OUTDENT, row => this.outdent(row), row => this.getLevel(row) === 0),
      item('nested_rows_toggle', C.NESTED_ROWS_COLLAPSE, row => this.toggle(row), row => !this.isParent(row)),
      item('nested_rows_expand_all', C.NESTED_ROWS_EXPAND_ALL, () => this.expandAll()),
      item('nested_rows_collapse_all', C.NESTED_ROWS_COLLAPSE_ALL, () => this.collapseAll()),
    );
    // Collapse or Expand, as the selected row needs.
    const toggle = options.items[options.items.length - 3];

    toggle.name = () => {
      const row = selectedRow();

      return this.hot.getTranslatedPhrase(row !== null && this.isCollapsed(row) ? C.NESTED_ROWS_EXPAND :
        C.NESTED_ROWS_COLLAPSE, 0) as string;
    };
  }

  /**
   * Redraws, keeping the selection on visible cells.
   *
   * @private
   */
  refresh(): void {
    const selected = this.hot.getSelectedLast();
    const count = this.hot.countRows();

    this.#numbers = null;
    this.hot.forceFullRender = true;
    this.hot.render();
    this.hot.view?.wt.wtOverlays.adjustElementsSize(true);
    this.hot.render();
    if (selected && count > 0) {
      this.hot.selectCell(Math.min(selected[0], count - 1), selected[1], void 0, void 0, false);
    }
  }

  destroy(): void {
    this.hot.rootElement?.removeEventListener('mousedown', this.onToggleMouseDown, true);
    super.destroy();
  }
}

registerPlugin('nestedRows', NestedRows);

export default NestedRows;
