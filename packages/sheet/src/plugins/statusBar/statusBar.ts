import './statusBar.css';
import BasePlugin from './../_base';
import Hooks from './../../pluginHooks';
import { registerPlugin } from './../../plugins';
import * as C from './../../i18n/constants';
import { getWorkbook } from './../../workbook/workbook';
import type { PluginHost } from './../_base';

/** What the bar can show about the selected cells. */
export const STATUS_BAR_ITEMS = ['average', 'count', 'numericalCount', 'min', 'max', 'sum'] as const;

export type StatusBarItem = typeof STATUS_BAR_ITEMS[number];

const DEFAULT_ITEMS: StatusBarItem[] = ['average', 'count', 'sum'];

/** What an item's `value` and a `format` function get: the selected cells, their values and numbers, the grid. */
export type StatusBarContext = {
  /** The selected cells' values (formula results), empty ones too. */
  values: unknown[];
  /** The numbers among them. */
  numbers: number[];
  /** The selected cells, `[row, col]` (visual indexes). */
  cells: [number, number][];
  /** The grid whose selection the bar shows (the active sheet). */
  grid: PluginHost;
  /** The built-in item being formatted, or the item's label. */
  item?: string;
};

/** How numbers are written: `Intl.NumberFormat` options, or a function that writes the value as it likes. */
export type StatusBarFormat = Intl.NumberFormatOptions | ((value: unknown, context: StatusBarContext) => unknown);

/**
 * An item of the bar: a built-in one by name, or an object. The object either renames or formats a built-in item
 * (`item`), or computes a value of its own (`value`, which returns a number, a text, or `null` to hide the item).
 * `align: 'left'` puts it at the left, where it always shows; `always` shows a right item without a selection too.
 */
export type StatusBarItemSetting = StatusBarItem | {
  item?: StatusBarItem;
  label?: string;
  value?: (context: StatusBarContext) => unknown;
  format?: StatusBarFormat;
  align?: 'left' | 'right';
  always?: boolean;
};

type StatusBarSettings = { items?: StatusBarItemSetting[]; format?: StatusBarFormat };

const LABELS: Record<StatusBarItem, string> = {
  average: C.STATUS_BAR_AVERAGE,
  count: C.STATUS_BAR_COUNT,
  numericalCount: C.STATUS_BAR_NUMERICAL_COUNT,
  min: C.STATUS_BAR_MIN,
  max: C.STATUS_BAR_MAX,
  sum: C.STATUS_BAR_SUM,
};

/** The hooks of every grid that change what the bar shows (the bar follows the active sheet). */
const SHEET_HOOKS = ['afterSelectionEnd', 'afterDeselect', 'afterChange', 'afterSetDataAtCell', 'afterLoadData'];

/** The figures of the selected cells: values (formula results), not empty, and the numbers among them. */
export const summarize = (grid: PluginHost): Record<StatusBarItem, number> &
  { cells: number; context: StatusBarContext } => {
  const values: unknown[] = [];
  const positions: [number, number][] = [];
  const seen = new Set<string>();
  let cells = 0;

  (grid.getSelectedRange() || []).forEach((range) => {
    const from = range.getTopLeftCorner();
    const to = range.getBottomRightCorner();

    for (let row = Math.max(0, from.row); row <= Math.min(to.row, grid.countRows() - 1); row += 1) {
      for (let col = Math.max(0, from.col); col <= Math.min(to.col, grid.countCols() - 1); col += 1) {
        if (!seen.has(`${row}:${col}`)) {
          seen.add(`${row}:${col}`);
          cells += 1;
          positions.push([row, col]);
          values.push(grid.getDataAtCell(row, col));
        }
      }
    }
  });
  const filled = values.filter(value => value !== null && value !== void 0 && value !== '');
  const numbers = filled.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  const sum = numbers.reduce((total, value) => total + value, 0);

  return {
    cells,
    context: { values, numbers, cells: positions, grid },
    count: filled.length,
    numericalCount: numbers.length,
    sum: numbers.length ? sum : NaN,
    average: numbers.length ? sum / numbers.length : NaN,
    min: numbers.length ? Math.min(...numbers) : NaN,
    max: numbers.length ? Math.max(...numbers) : NaN,
  };
};

/**
 * The status bar: a strip below the grid (below the sheet tabs), as in Excel, with the average, count and sum of the
 * selected cells, when more than one cell is selected. It follows the active sheet.
 *
 * ```js
 * new FreeSheet(container, { data, statusBar: true });
 * // or choose what it shows:
 * new FreeSheet(container, { data, statusBar: { items: ['sum', 'min', 'max'] } });
 * ```
 */
class StatusBar extends BasePlugin {
  /** The bar's element, while the plugin is enabled. */
  element: HTMLDivElement | null = null;
  #onSheetHook = (grid: PluginHost) => {
    if (grid === this.activeSheet()) {
      this.refresh();
    }
  };
  #hooks: [string, (this: PluginHost) => void][] = [];

  isEnabled(): boolean {
    // Sheets added to a document do not inherit the setting: the document's grid has the bar.
    return !!this.hot.getSettings().statusBar;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const onSheetHook = this.#onSheetHook;

    this.createElement();
    this.#hooks = SHEET_HOOKS.map(name => [name, function onSheetHookOf(this: PluginHost) {
      onSheetHook(this);
    }]);
    // Every grid's hooks: the bar shows the active sheet, which may be another grid of the document.
    this.#hooks.forEach(([name, callback]) => Hooks.getSingleton().add(name, callback));
    this.addHook('afterSheetActivate', () => this.refresh());
    this.addHook('afterRender', () => this.matchGridWidth());
    // Items of your own may read the grid: the first refresh waits for it.
    this.addHook('afterInit', () => this.refresh());
    super.enablePlugin();
    if (this.hot.view) {
      this.refresh();
    }
  }

  disablePlugin(): void {
    this.#hooks.forEach(([name, callback]) => Hooks.getSingleton().remove(name, callback));
    this.#hooks = [];
    this.element?.remove();
    this.element = null;
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  destroy(): void {
    this.disablePlugin();
    super.destroy();
  }

  /**
   * The grid whose selection the bar shows.
   *
   * @private
   */
  activeSheet(): PluginHost {
    // Without a document yet, the grid itself (asking the grid would make a document before its sheets are read).
    const workbook = getWorkbook(this.hot as unknown as Parameters<typeof getWorkbook>[0]);

    return (workbook?.get(workbook.activeId)?.instance as unknown as PluginHost | undefined) || this.hot;
  }

  /** The `statusBar` setting as an object. */
  get settings(): StatusBarSettings {
    const setting = this.hot.getSettings().statusBar as boolean | StatusBarSettings;

    return typeof setting === 'object' && setting ? setting : {};
  }

  /** The items the `statusBar` setting asks for (unknown names left out). */
  getItems(): StatusBarItemSetting[] {
    const { items } = this.settings;

    return (Array.isArray(items) ? items : DEFAULT_ITEMS).filter(item => (typeof item === 'string' ?
      STATUS_BAR_ITEMS.includes(item) : !!item && typeof item === 'object' &&
      (typeof item.value === 'function' || STATUS_BAR_ITEMS.includes(item.item!))));
  }

  createElement(): void {
    const bar = document.createElement('div');
    const root = this.hot.rootElement;
    const frame = root.parentElement?.classList.contains('fs-document') ? root.parentElement : null;

    bar.className = 'fs-status-bar';
    bar.setAttribute('role', 'status');
    bar.setAttribute('aria-live', 'polite');
    bar.addEventListener('mousedown', event => event.stopPropagation());
    // At the bottom of the document: below the sheets and their tabs.
    if (frame) {
      frame.appendChild(bar);
    } else {
      root.parentNode?.insertBefore(bar, root.nextSibling);
    }
    this.element = bar;
  }

  /**
   * The bar is as wide as the drawn grid, as the formula bar is.
   *
   * @private
   */
  matchGridWidth(): void {
    const wtTable = this.hot.view?.wt?.wtTable;

    if (!this.element || !wtTable || this.element.parentElement?.classList.contains('fs-document')) {
      return;
    }
    const holder = wtTable.holder as HTMLElement;
    const width = Math.min(this.hot.rootElement.offsetWidth,
      (wtTable.TABLE as HTMLElement).offsetWidth + holder.offsetWidth - holder.clientWidth);

    this.element.style.width = width > 0 ? `${width}px` : '';
  }

  /**
   * Shows the items for the active sheet's selection: the right ones when more than one cell with a value is selected
   * (or with `always`), the left ones always. Call it when an item of your own depends on something else.
   */
  refresh(): void {
    if (!this.element) {
      return;
    }
    const themeClasses = Array.from(this.hot.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name));
    const figures = summarize(this.activeSheet());
    const selected = figures.cells >= 2 && figures.count > 0;
    const left = document.createElement('div');
    const right = document.createElement('div');

    this.element.className = ['fs-status-bar', ...themeClasses].join(' ');
    left.className = 'fs-status-bar__left';
    right.className = 'fs-status-bar__right';
    this.getItems().forEach((setting, index) => {
      const item = typeof setting === 'string' ? { item: setting } : setting;
      const atLeft = item.align === 'left';

      if (!atLeft && !item.always && !selected) {
        return;
      }
      const context = { ...figures.context, item: item.item || item.label };
      const value = item.value ? item.value(context) : figures[item.item!];

      // No value: average, minimum, maximum and sum need numbers (Excel leaves them out too); `null` hides an item.
      if (value === null || value === void 0 || (typeof value === 'number' && Number.isNaN(value))) {
        return;
      }
      const label = item.label ?? (item.item ? String(this.hot.getTranslatedPhrase(LABELS[item.item])) : '');
      const text = this.format(value, item.format ?? this.settings.format, context);
      const element = document.createElement('span');

      element.className = 'fs-status-bar__item';
      element.dataset.item = item.item || `item${index}`;
      element.textContent = label ? `${label}: ${text}` : text;
      (atLeft ? left : right).appendChild(element);
    });
    this.element.replaceChildren(left, right);
  }

  /**
   * A value as text: with a format function, `Intl.NumberFormat` options (numbers), or as it is.
   *
   * @private
   */
  format(value: unknown, format: StatusBarFormat | undefined, context: StatusBarContext): string {
    if (typeof format === 'function') {
      return String(format(value, context));
    }
    if (typeof value === 'number') {
      return new Intl.NumberFormat(void 0, { maximumFractionDigits: 10, ...format }).format(value);
    }

    return String(value);
  }
}

registerPlugin('statusBar', StatusBar);

export default StatusBar;
