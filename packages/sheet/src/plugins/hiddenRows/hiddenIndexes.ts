import './hidden.css';
import BasePlugin from './../_base';
import { getTranslator } from './../../utils/recordTranslator';
import { spreadsheetColumnLabel } from './../../helpers/data';
import * as C from './../../i18n/constants';
import type { IndexVisibility } from './../../utils/indexVisibility';
import type { MenuItem } from './../contextMenu/menuItem';

/** The `hiddenRows` / `hiddenColumns` setting as an object. */
export type HiddenIndexesSettings = {
  /** Physical rows (columns) hidden at start. */
  rows?: number[];
  columns?: number[];
  /** Marks where hidden rows (columns) are, with a double line in the headers (default `true`). */
  indicators?: boolean;
};

/** A header cell next to hidden rows (columns). */
export const HIDDEN_BEFORE_CLASS_NAME = 'fs-hidden-before';
export const HIDDEN_AFTER_CLASS_NAME = 'fs-hidden-after';

/** The button on a header's edge that shows the hidden rows (columns) next to it. */
export const TOGGLE_CLASS_NAME = 'fs-hidden-toggle';

/**
 * Hiding rows or columns (the shared part of `hiddenRows` and `hiddenColumns`). A hidden row leaves the visual order:
 * `countRows()` skips it, and so do selection, the keyboard and copying. What is hidden is kept per physical index, so
 * it stays hidden when rows are sorted or moved.
 */
abstract class HiddenIndexes extends BasePlugin {
  abstract readonly axis: 'row' | 'column';

  /** `Rows` or `Columns`, for the hook names. */
  get noun(): 'Rows' | 'Columns' {
    return this.axis === 'row' ? 'Rows' : 'Columns';
  }

  get settingName(): 'hiddenRows' | 'hiddenColumns' {
    return this.axis === 'row' ? 'hiddenRows' : 'hiddenColumns';
  }

  get visibility(): IndexVisibility {
    const translator = getTranslator(this.hot);

    return (this.axis === 'row' ? translator.rows : translator.columns)!;
  }

  get settings(): HiddenIndexesSettings {
    const settings = this.hot.getSettings()[this.settingName];

    return settings && typeof settings === 'object' ? settings : {};
  }

  isEnabled(): boolean {
    return !!this.hot.getSettings()[this.settingName] || this.hiddenByColumns().length > 0;
  }

  /**
   * Columns: the physical columns marked `hidden: true` in `columns`.
   *
   * @private
   */
  hiddenByColumns(): number[] {
    const columns = this.axis === 'column' ? this.hot.getSettings().columns : null;

    return Array.isArray(columns) ? columns.flatMap((column: { hidden?: boolean } | null, index: number) =>
      (column && column.hidden ? [index] : [])) : [];
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.applySettings();

    if (this.axis === 'row') {
      this.addHook('afterGetRowHeader', (row: number, TH: HTMLTableCellElement) => this.markHeader(row, TH));
    } else {
      this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.markHeader(column, TH));
    }
    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addMenuItems(options));
    this.addHook('afterLoadData', () => this.dropMissing());
    // Before the grid's own mousedown, which would select the row (column).
    this.hot.rootElement.addEventListener('mousedown', this.onIndicatorMouseDown, true);

    super.enablePlugin();
  }

  disablePlugin(): void {
    this.visibility.setHidden(this.settingName, null);
    this.hot.rootElement.removeEventListener('mousedown', this.onIndicatorMouseDown, true);
    super.disablePlugin();
  }

  /** Whether the last `updateSettings` gave the hidden rows (columns): only then are they set again. */
  #listGiven = false;

  onUpdateSettings(newSettings?: unknown): void {
    const setting = (newSettings as Record<string, unknown> | undefined)?.[this.settingName];

    // The hidden columns are given again by `hiddenColumns.columns`, or by `columns` (`hidden: true`).
    this.#listGiven = (!!setting && typeof setting === 'object' &&
      Object.prototype.hasOwnProperty.call(setting, this.axis === 'row' ? 'rows' : 'columns')) ||
      (this.axis === 'column' && !!newSettings && Object.prototype.hasOwnProperty.call(newSettings, 'columns'));
    super.onUpdateSettings(newSettings);
  }

  updatePlugin(): void {
    // Other settings changing keeps what users hid since.
    if (this.#listGiven) {
      this.applySettings();
    }
    this.refresh();
    super.updatePlugin();
  }

  /**
   * Hides the rows (columns) the setting lists.
   *
   * @private
   */
  applySettings(): void {
    const indexes = this.axis === 'row' ? this.settings.rows : this.settings.columns;

    this.visibility.setHidden(this.settingName, [...(Array.isArray(indexes) ? indexes.filter(Number.isInteger) : []),
      ...this.hiddenByColumns()]);
  }

  /**
   * The number of physical rows (columns).
   *
   * @private
   */
  total(): number {
    return this.axis === 'row' ? this.hot.countSourceRows() : this.hot.countSourceCols();
  }

  /**
   * Ordered index (before hiding) → physical.
   *
   * @private
   */
  orderedToPhysical(ordered: number): number {
    const hook = this.axis === 'row' ? 'modifyRow' : 'modifyCol';

    return this.hot.hasHook(hook) ? this.hot.runHooks(hook, ordered) : ordered;
  }

  /**
   * Physical → ordered index (before hiding).
   *
   * @private
   */
  physicalToOrdered(physical: number): number {
    return this.hot.runHooks(this.axis === 'row' ? 'unmodifyRow' : 'unmodifyCol', physical);
  }

  /**
   * The visible rows (columns).
   *
   * @private
   */
  count(): number {
    return this.axis === 'row' ? this.hot.countRows() : this.hot.countCols();
  }

  /**
   * Hides rows (columns).
   *
   * @param visualIndexes Visual indexes.
   *
   * @private
   */
  hide(visualIndexes: number[]): void {
    const count = this.count();
    const physical = visualIndexes
      .filter(index => Number.isInteger(index) && index >= 0 && index < count)
      .map(index => this.orderedToPhysical(this.visibility.toOrdered(index)))
      .filter(index => index !== null && !this.visibility.isHiddenBy(this.settingName, index));
    const changed = [...new Set(physical)];

    this.change([...this.getHidden(), ...changed], changed, 'Hide');
  }

  /**
   * Shows hidden rows (columns).
   *
   * @param physicalIndexes Physical indexes (a hidden row has no visual index).
   *
   * @private
   */
  show(physicalIndexes: number[]): void {
    const shown = [...new Set(physicalIndexes)].filter(index => this.visibility.isHiddenBy(this.settingName, index));

    this.change(this.getHidden().filter(index => shown.indexOf(index) === -1), shown, 'Unhide');
  }

  /**
   * The hidden rows (columns) as physical indexes, in ascending order.
   *
   * @private
   */
  getHidden(): number[] {
    return this.visibility.getHidden(this.settingName);
  }

  /**
   * Whether this plugin hides a row (column).
   *
   * @param physicalIndex Physical index.
   */
  isHidden(physicalIndex: number): boolean {
    return this.visibility.isHiddenBy(this.settingName, physicalIndex);
  }

  /**
   * Sets the hidden rows (columns), running the hooks and redrawing.
   *
   * @param hidden Every hidden physical index after the change.
   * @param changed The physical indexes hidden or shown.
   * @param action `Hide` or `Unhide`.
   *
   * @private
   */
  change(hidden: number[], changed: number[], action: 'Hide' | 'Unhide'): void {
    if (!changed.length || this.hot.runHooks(`before${action}${this.noun}`, changed) === false) {
      return;
    }
    const previous = this.getHidden();

    this.visibility.setHidden(this.settingName, hidden);
    this.hot.runHooks(`after${action}${this.noun}`, changed, previous);
    this.refresh();
  }

  /**
   * Sets the hidden rows (columns) to a saved set (undo and redo), through the hooks.
   *
   * @private
   */
  restore(hidden: number[]): void {
    const current = this.getHidden();
    const shown = current.filter(index => hidden.indexOf(index) === -1);
    const added = hidden.filter(index => current.indexOf(index) === -1);

    this.change(current.filter(index => shown.indexOf(index) === -1), shown, 'Unhide');
    this.change(hidden, added, 'Hide');
    if (!shown.length && !added.length) {
      this.refresh();
    }
  }

  /**
   * Redraws, keeping the selection on visible cells.
   *
   * @private
   */
  refresh(): void {
    const selected = this.hot.getSelectedLast();
    const count = this.count();

    // First the new rows (columns), then the sizes that depend on them (the grid's height decides whether a
    // scrollbar takes width from stretched columns), then the selection.
    this.hot.forceFullRender = true;
    this.hot.render();
    this.hot.view?.wt.wtOverlays.adjustElementsSize(true);
    this.hot.render();

    if (selected && count > 0) {
      const [row, column] = selected;

      if (this.axis === 'row') {
        this.hot.selectCell(Math.min(row, count - 1), column, void 0, void 0, false);
      } else {
        this.hot.selectCell(row, Math.min(column, count - 1), void 0, void 0, false);
      }
    } else if (selected) {
      this.hot.deselectCell();
    }
  }

  /**
   * After new data is loaded, indexes past its end are no longer hidden.
   *
   * @private
   */
  dropMissing(): void {
    const total = this.total();
    const hidden = this.getHidden();

    if (hidden.some(index => index >= total)) {
      this.visibility.setHidden(this.settingName, hidden.filter(index => index < total));
    }
  }

  /**
   * Whether the row (column) next to a visible one, before or after it, is hidden by this plugin.
   *
   * @private
   */
  isGap(visual: number, side: -1 | 1): boolean {
    const neighbour = this.visibility.toOrdered(visual) + side;

    return neighbour >= 0 && neighbour < this.total() && this.isHidden(this.orderedToPhysical(neighbour));
  }

  /**
   * Marks a header next to hidden rows (columns): a double line and an arrow that shows them.
   *
   * @private
   */
  markHeader(visual: number, TH: HTMLTableCellElement): void {
    const indicators = this.settings.indicators !== false && visual >= 0;
    const before = indicators && this.isGap(visual, -1);
    const after = indicators && this.isGap(visual, 1);

    TH.classList.toggle(HIDDEN_BEFORE_CLASS_NAME, before);
    TH.classList.toggle(HIDDEN_AFTER_CLASS_NAME, after);
    TH.querySelectorAll(`.${TOGGLE_CLASS_NAME}`).forEach(toggle => toggle.remove());

    if (!before && !after) {
      return;
    }
    const ordered = this.visibility.toOrdered(visual);

    ([[before, 'before', -1], [after, 'after', 1]] as const).forEach(([shown, side, direction]) => {
      if (shown) {
        const toggle = document.createElement('span');
        const title = this.toggleTitle(ordered, direction);

        toggle.className = `${TOGGLE_CLASS_NAME} ${TOGGLE_CLASS_NAME}--${side}`;
        toggle.title = title;
        toggle.setAttribute('role', 'button');
        toggle.setAttribute('aria-label', title);
        TH.appendChild(toggle);
      }
    });
  }

  /**
   * The hidden rows (columns) inside a visual range: between its first and last row, and before the first visible row
   * or after the last one when the range reaches them.
   *
   * @private
   */
  hiddenWithin(from: number, to: number): number[] {
    const count = this.count();
    const low = from <= 0 ? 0 : this.visibility.toOrdered(from);
    const high = to >= count - 1 ? Infinity : this.visibility.toOrdered(to);

    return this.getHidden().filter((physical) => {
      const ordered = this.physicalToOrdered(physical);

      return ordered >= low && ordered <= high;
    });
  }

  /**
   * The selected visual range along this axis, or `null`.
   *
   * @private
   */
  selectedRange(): [number, number] | null {
    const selected = this.hot.getSelectedLast();

    if (!selected) {
      return null;
    }
    const [row, column, row2, column2] = selected;
    const [from, to] = this.axis === 'row' ? [row, row2] : [column, column2];

    return [Math.max(0, Math.min(from, to)), Math.max(from, to)];
  }

  /** A click on the arrow next to hidden rows (columns) shows them. */
  onIndicatorMouseDown = (event: MouseEvent): void => {
    const toggle = event.button === 0 ? (event.target as HTMLElement).closest(`.${TOGGLE_CLASS_NAME}`) : null;
    const TH = toggle?.closest('th');
    const coords = TH ? this.hot.view.wt.wtTable.getCoords(TH) : null;
    const visual = this.axis === 'row' ? coords?.row : coords?.col;
    const isHeader = this.axis === 'row' ? coords?.col === -1 : coords?.row === -1;

    if (!toggle || !isHeader || visual === void 0 || visual < 0) {
      return;
    }
    const side = toggle.classList.contains(`${TOGGLE_CLASS_NAME}--before`) ? -1 : 1;
    const shown = this.adjacentHidden(this.visibility.toOrdered(visual), side);

    // Not a click on the header: the row (column) is not selected.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (shown.length) {
      this.show(shown);
    }
  };

  /**
   * The tooltip of an arrow: what it shows, for example "Show rows: 2–3" or "Show columns: B, D–F".
   *
   * @private
   */
  toggleTitle(ordered: number, side: -1 | 1): string {
    const limit = 1000;
    const total = this.total();
    const indexes: number[] = [];

    for (let index = ordered + side; index >= 0 && index < total && indexes.length <= limit; index += side) {
      if (!this.isHidden(this.orderedToPhysical(index))) {
        break;
      }
      indexes.push(index);
    }
    indexes.sort((a, b) => a - b);

    const label = (index: number) => (this.axis === 'row' ? String(index + 1) : spreadsheetColumnLabel(index));
    // Consecutive indexes as ranges.
    const ranges: string[] = [];
    let start = 0;

    for (let i = 1; i <= indexes.length; i += 1) {
      if (i === indexes.length || indexes[i] !== indexes[i - 1] + 1) {
        ranges.push(i - 1 === start ? label(indexes[start]) : `${label(indexes[start])}–${label(indexes[i - 1])}`);
        start = i;
      }
    }
    const phrase = this.hot.getTranslatedPhrase(this.axis === 'row' ? C.CONTEXTMENU_ITEMS_SHOW_ROW :
      C.CONTEXTMENU_ITEMS_SHOW_COLUMN, indexes.length > 1 ? 1 : 0) as string;

    return `${phrase}: ${ranges.join(', ')}${indexes.length > limit ? '…' : ''}`;
  }

  /**
   * The hidden rows (columns) right before or after an ordered index, up to the next visible one.
   *
   * @private
   */
  adjacentHidden(ordered: number, side: -1 | 1): number[] {
    const hidden: number[] = [];
    const total = this.total();

    for (let index = ordered + side; index >= 0 && index < total; index += side) {
      const physical = this.orderedToPhysical(index);

      if (!this.isHidden(physical)) {
        break;
      }
      hidden.push(physical);
    }

    return hidden;
  }

  addMenuItems(options: { items: MenuItem[] }): void {
    const isRow = this.axis === 'row';
    const range = () => this.selectedRange();

    options.items.push(
      { name: '---------' } as MenuItem,
      {
        key: isRow ? 'hide_rows' : 'hide_columns',
        name: () => {
          const selected = range();

          return this.hot.getTranslatedPhrase(isRow ? C.CONTEXTMENU_ITEMS_HIDE_ROW : C.CONTEXTMENU_ITEMS_HIDE_COLUMN,
            selected && selected[1] > selected[0] ? 1 : 0);
        },
        callback: () => {
          const selected = range();

          if (selected) {
            this.hide(Array.from({ length: selected[1] - selected[0] + 1 }, (_, i) => selected[0] + i));
          }
        },
        disabled: () => {
          const selected = range();

          // At least one row (column) stays visible.
          return !selected || selected[1] - selected[0] + 1 >= this.count();
        },
      } as MenuItem,
      {
        key: isRow ? 'show_rows' : 'show_columns',
        name: () => this.hot.getTranslatedPhrase(isRow ? C.CONTEXTMENU_ITEMS_SHOW_ROW :
          C.CONTEXTMENU_ITEMS_SHOW_COLUMN, 1),
        callback: () => {
          const selected = range();

          if (selected) {
            this.show(this.hiddenWithin(selected[0], selected[1]));
          }
        },
        disabled: () => {
          const selected = range();

          return !selected || this.hiddenWithin(selected[0], selected[1]).length === 0;
        },
      } as MenuItem,
    );
  }
}

export default HiddenIndexes;
