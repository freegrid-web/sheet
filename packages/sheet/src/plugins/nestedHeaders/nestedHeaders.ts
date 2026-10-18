import './nestedHeaders.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { columnTreeLevels, getColumnTree } from './../../utils/columnTree';
import type { ColumnGroup } from './../../utils/columnTree';

/** One header cell of `nestedHeaders`: a label, or a label over several columns. */
export type NestedHeader = string | { label: string; colspan?: number };

/** A group: a header over physical columns `start` to `end` (inclusive) on a header row (`level`, 0 = the top). */
export type HeaderGroup = ColumnGroup;

/** What a group's header needs from collapsible columns. */
type GroupButtons = { enabled: boolean; button(group: HeaderGroup): HTMLElement | null };

/**
 * Nested headers: several header rows, where a header can span columns ("2026" over "Q1 Q2 Q3 Q4"). The last row of
 * `nestedHeaders` is the column headers; the rows above it are group rows.
 *
 * ```js
 * new FreeSheet(container, {
 *   data,
 *   nestedHeaders: [
 *     ['Region', { label: '2026', colspan: 4 }],
 *     ['', 'Q1', 'Q2', 'Q3', 'Q4'],
 *   ],
 * });
 * ```
 *
 * A group's label is drawn in its first visible column, as wide as its visible columns. A click on it selects the
 * group's columns. Columns can be moved inside their group, not out of it.
 */
class NestedHeaders extends BasePlugin {
  /** The groups of each header row, by physical column. */
  #levels: (HeaderGroup | undefined)[][] = [];

  isEnabled(): boolean {
    // Groups in `columns`, or (kept for older configurations) the `nestedHeaders` rows.
    return !!getColumnTree(this.hot) ||
      (Array.isArray(this.hot.getSettings().nestedHeaders) && this.hot.getSettings().nestedHeaders.length > 0);
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterGetColumnHeaderRenderers', (renderers: ((column: number, TH: HTMLTableCellElement) => void)[]) =>
      this.onAfterGetColumnHeaderRenderers(renderers));
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.onAfterGetColHeader(column, TH));
    this.addHook('afterOnCellMouseDown', (event: MouseEvent, coords: { row: number; col: number },
      TH: HTMLElement) => this.onAfterOnCellMouseDown(coords, TH));
    this.addHook('beforeColumnMove', (columns: number[], target: number) => this.onBeforeColumnMove(columns, target));
    this.addHook('afterCreateCol', () => this.readSettings());
    this.addHook('afterRemoveCol', () => this.readSettings());
    super.enablePlugin();
    // Once enabled: collapsible columns reads the groups through this plugin.
    this.readSettings();
  }

  disablePlugin(): void {
    this.#levels = [];
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.readSettings();
    super.updatePlugin();
  }

  /**
   * Reads the header rows into groups.
   *
   * @private
   */
  readSettings(): void {
    const tree = getColumnTree(this.hot);
    const rows = this.hot.getSettings().nestedHeaders as NestedHeader[][] || [];

    this.#levels = tree ? columnTreeLevels(tree) : rows.map((row, level) => {
      const groups: (HeaderGroup | undefined)[] = [];
      let column = 0;

      (Array.isArray(row) ? row : []).forEach((item) => {
        const label = typeof item === 'object' && item !== null ? String(item.label ?? '') : String(item ?? '');
        const span = typeof item === 'object' && item !== null && Number(item.colspan) > 1 ?
          Math.floor(Number(item.colspan)) : 1;
        const group = { level, label, start: column, end: column + span - 1 };

        for (let i = 0; i < span; i += 1) {
          groups[column + i] = group;
        }
        column += span;
      });

      return groups;
    });

    // Collapsed groups follow the groups read now.
    const collapsible = this.hot.getPlugin('collapsibleColumns' as 'search') as unknown as
      (GroupButtons & { updateVisibility(): void }) | undefined;

    if (collapsible?.enabled) {
      collapsible.updateVisibility();
    }
  }

  /** The number of header rows. */
  countLevels(): number {
    return this.#levels.length;
  }

  /**
   * The group of a header row over a physical column.
   *
   * @param level The header row (0 = the top).
   * @param physicalColumn Physical column index.
   *
   * @private
   */
  groupAt(level: number, physicalColumn: number): HeaderGroup | undefined {
    return this.#levels[level]?.[physicalColumn];
  }

  /**
   * Every group of every header row (each once).
   *
   * @private
   */
  groups(): HeaderGroup[] {
    return this.#levels.flatMap(groups => Array.from(new Set(groups.filter(Boolean)))) as HeaderGroup[];
  }

  /**
   * A group: its label and its visible columns.
   *
   * @param level The header row (0 = the top).
   * @param column Visual column index of any column in the group.
   */
  getGroup(level: number, column: number): { label: string; columns: number[] } | null {
    const group = this.groupAt(level, this.hot.toPhysicalColumn(column));

    return group ? { label: group.label, columns: this.visibleColumns(group) } : null;
  }

  /**
   * The visual columns of a group that are not hidden, in order.
   *
   * @private
   */
  visibleColumns(group: HeaderGroup): number[] {
    const columns: number[] = [];

    for (let physical = group.start; physical <= group.end; physical += 1) {
      const visual = this.hot.toVisualColumn(physical);

      if (visual !== null && visual >= 0) {
        columns.push(visual);
      }
    }

    return columns.sort((a, b) => a - b);
  }

  onAfterGetColumnHeaderRenderers(renderers: ((column: number, TH: HTMLTableCellElement) => void)[]): void {
    // The group rows go above the column headers.
    const groupRows = Array.from({ length: Math.max(0, this.#levels.length - 1) }, (_, level) =>
      (column: number, TH: HTMLTableCellElement) => this.renderGroupHeader(level, column, TH));

    // The column headers row: the grid's own, or one for the last row of `nestedHeaders` when `colHeaders` is off.
    if (!renderers.length && this.#levels.length) {
      renderers.push((column: number, TH: HTMLTableCellElement) => this.hot.view.appendColHeader(column, TH));
    }
    renderers.unshift(...groupRows);
  }

  renderGroupHeader(level: number, column: number, TH: HTMLTableCellElement): void {
    TH.textContent = '';
    TH.classList.remove('fs-group', 'fs-group-start', 'fs-group-end');
    TH.removeAttribute('title');
    if (column < 0) {
      return;
    }
    const group = this.groupAt(level, this.hot.toPhysicalColumn(column));

    if (!group) {
      return;
    }
    const columns = this.visibleColumns(group);
    const start = columns[0] === column;

    TH.classList.add('fs-group');
    TH.classList.toggle('fs-group-start', start);
    TH.classList.toggle('fs-group-end', columns[columns.length - 1] === column);
    if (!start) {
      return;
    }
    const container = document.createElement('div');
    const label = document.createElement('span');
    const wtTable = this.hot.view.wt.wtTable;
    // The widths as drawn (stretched columns are wider than their setting).
    const width = columns.reduce((sum, visual) => sum + (wtTable.getStretchedColumnWidth(visual) ||
      this.hot.getColWidth(visual)), 0);

    container.className = 'relative fs-group-label';
    // Up to the group's last border (a header with a left border starts one pixel later).
    container.style.width = `${Math.max(0, width - 1 - (parseFloat(getComputedStyle(TH).borderLeftWidth) || 0))}px`;
    label.className = 'colHeader';
    label.textContent = group.label;
    TH.title = group.label;

    const collapsible = this.hot.getPlugin('collapsibleColumns' as 'search') as unknown as GroupButtons | undefined;
    const button = collapsible?.enabled ? collapsible.button(group) : null;

    if (button) {
      container.classList.add('fs-group-label--button');
      container.appendChild(button);
    }
    container.appendChild(label);
    TH.appendChild(container);
  }

  /** The column headers row shows the last row of `nestedHeaders`. */
  onAfterGetColHeader(column: number, TH: HTMLTableCellElement): void {
    const last = this.#levels.length - 1;
    const group = column >= 0 && last >= 0 ? this.groupAt(last, this.hot.toPhysicalColumn(column)) : void 0;
    const label = TH.querySelector('.colHeader');

    if (label && (group || !this.hot.getSettings().colHeaders)) {
      label.textContent = group ? group.label : '';
    }
  }

  /** A click on a group's header selects its columns. */
  onAfterOnCellMouseDown(coords: { row: number; col: number }, TH: HTMLElement): void {
    const row = TH?.parentElement as HTMLTableRowElement | null;

    if (coords.row >= 0 || coords.col < 0 || !row || !TH.closest('thead')) {
      return;
    }
    const level = row.rowIndex;
    const group = level < this.#levels.length - 1 ? this.groupAt(level, this.hot.toPhysicalColumn(coords.col)) : void 0;
    const columns = group ? this.visibleColumns(group) : [];

    if (columns.length > 1) {
      this.hot.selectColumns(columns[0], columns[columns.length - 1]);
    }
  }

  /** A column moves inside its groups only, and not into another group. */
  onBeforeColumnMove(columns: number[], target: number): boolean | void {
    const count = this.hot.countCols();

    for (let level = 0; level < this.#levels.length - 1; level += 1) {
      const groups = new Set(columns.map(column => this.groupAt(level, this.hot.toPhysicalColumn(column))));

      if (groups.size > 1) {
        return false;
      }
      const [group] = Array.from(groups);
      const before = target > 0 ? this.groupAt(level, this.hot.toPhysicalColumn(target - 1)) : void 0;
      const after = target < count ? this.groupAt(level, this.hot.toPhysicalColumn(target)) : void 0;

      if (group && group.end > group.start ? before !== group && after !== group :
        !!after && after === before && after.end > after.start) {
        return false;
      }
    }
  }
}

registerPlugin('nestedHeaders', NestedHeaders);

export default NestedHeaders;
