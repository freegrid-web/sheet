import './filters.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { getTranslator } from './../../utils/recordTranslator';
import { CONDITIONS, toText } from './conditions';
import type { ConditionContext } from './conditions';
import type { IndexVisibility } from './../../utils/indexVisibility';

/** One condition: its name (`eq`, `contains`, `between`, `by_value`, …) and its arguments. */
export type FilterCondition = { name: string; args: unknown[] };

/** A column's conditions, joined by AND (`conjunction`) or OR (`disjunction`). `column` is a physical column. */
export type ColumnConditions = {
  column: number;
  operation: 'conjunction' | 'disjunction';
  conditions: FilterCondition[];
};

/** The `filters` setting as an object. */
export type FiltersSettings = {
  /** Conditions applied when the grid is created (physical columns), as `exportConditions()` gives them. */
  conditions?: ColumnConditions[];
  /** Filter again after every change of the data (by default an edited row stays visible until the next filter). */
  reapplyOnChange?: boolean;
};

/** The header of a column with conditions. */
export const FILTERED_COLUMN_CLASS_NAME = 'fs-filtered';
/** The grid, while a filter hides rows. */
export const FILTERED_GRID_CLASS_NAME = 'fs-has-filters';

const SOURCE = 'filters';

/** What filtering needs from nested rows. */
type NestedRowsFiltering = { enabled: boolean; filterTree(matching: boolean[], active: boolean): boolean[] };

/**
 * Filters: rows whose values do not meet the conditions of every filtered column are hidden. A column's conditions
 * are joined by AND or OR; a value list (`by_value`) keeps the rows whose value is in the list, on top of them.
 *
 * ```js
 * const filters = hot.getPlugin('filters');
 *
 * filters.addCondition(2, 'gt', [100]);
 * filters.addCondition(0, 'by_value', [['North', 'South']]);
 * filters.filter();
 * ```
 *
 * Conditions compare the value a cell shows (`getDataAtCell`, so formulas by their result); text comparisons ignore
 * case. Filtering hides rows as hidden rows do: `countRows()`, selection and copying skip them. An edited row stays
 * visible until the next `filter()`, unless `reapplyOnChange` is set.
 */
class Filters extends BasePlugin {
  /** Conditions by physical column. */
  #columns = new Map<number, { operation: ColumnConditions['operation']; conditions: FilterCondition[] }>();
  /** Whether the last `updateSettings` gave conditions: only then are they set again. */
  #conditionsGiven = false;

  get visibility(): IndexVisibility {
    return getTranslator(this.hot).rows!;
  }

  get settings(): FiltersSettings {
    const settings = this.hot.getSettings().filters;

    return settings && typeof settings === 'object' ? settings : {};
  }

  isEnabled(): boolean {
    return !!this.hot.getSettings().filters;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterLoadData', () => this.onAfterLoadData());
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.markHeader(column, TH));
    this.addHook('afterChange', (changes: unknown[] | null, source: string) => {
      if (changes && source !== 'loadData' && this.settings.reapplyOnChange && this.#columns.size) {
        this.filter();
      }
    });
    this.addHook('afterCreateCol', (index: number, amount: number) => this.shiftColumns(column =>
      (column >= index ? column + amount : column)));
    this.addHook('afterRemoveCol', (_index: number, _amount: number, physicalColumns: number[] = []) =>
      this.shiftColumns((column) => {
        if (physicalColumns.indexOf(column) !== -1) {
          return null;
        }

        return column - physicalColumns.filter(removed => removed < column).length;
      }));

    super.enablePlugin();
    this.applySettings();

    // Enabled after the data was loaded: filter now.
    if (this.hot.view && this.#columns.size) {
      this.filter();
    }
  }

  disablePlugin(): void {
    this.#columns.clear();
    this.visibility.setHidden(SOURCE, null);
    this.hot.rootElement.classList.remove(FILTERED_GRID_CLASS_NAME);
    super.disablePlugin();
  }

  onUpdateSettings(newSettings?: unknown): void {
    const setting = (newSettings as { filters?: unknown } | undefined)?.filters;

    this.#conditionsGiven = !!setting && typeof setting === 'object' &&
      Object.prototype.hasOwnProperty.call(setting, 'conditions');
    super.onUpdateSettings(newSettings);
  }

  updatePlugin(): void {
    // Other settings changing keeps the conditions users set since.
    if (this.#conditionsGiven) {
      this.applySettings();
      this.filter();
    }
    super.updatePlugin();
  }

  /**
   * Takes the conditions of the setting.
   *
   * @private
   */
  applySettings(): void {
    const { conditions } = this.settings;

    this.importConditions(Array.isArray(conditions) ? conditions : []);
  }

  onAfterLoadData(): void {
    if (this.#columns.size) {
      this.filter();
    }
  }

  /**
   * Adds a condition to a column. The column's conditions are joined by `operation` (the last one given wins).
   *
   * @param column Visual column index.
   * @param name The condition (`eq`, `neq`, `contains`, `gt`, `between`, `empty`, `by_value`, …).
   * @param args Its arguments (`by_value`: one array with the values to keep, as text).
   * @param operation `conjunction` (AND, the default) or `disjunction` (OR).
   */
  addCondition(column: number, name: string, args: unknown[] = [], operation: ColumnConditions['operation'] =
  'conjunction'): void {
    if (!CONDITIONS[name]) {
      throw new Error(`Unknown filter condition: ${name}`);
    }
    const physical = this.hot.toPhysicalColumn(column);
    const entry = this.#columns.get(physical) || { operation, conditions: [] };

    entry.operation = operation;
    entry.conditions.push({ name, args: [...args] });
    this.#columns.set(physical, entry);
  }

  /**
   * Removes a column's conditions (call `filter()` to apply).
   *
   * @param column Visual column index.
   */
  removeConditions(column: number): void {
    this.#columns.delete(this.hot.toPhysicalColumn(column));
  }

  /**
   * Removes the conditions of a column, or of every column (call `filter()` to apply).
   *
   * @param column Visual column index; every column when not given.
   */
  clearConditions(column?: number): void {
    if (column === void 0) {
      this.#columns.clear();
    } else {
      this.removeConditions(column);
    }
  }

  /**
   * A column's conditions.
   *
   * @param column Visual column index.
   */
  getConditions(column: number): FilterCondition[] {
    const entry = this.#columns.get(this.hot.toPhysicalColumn(column));

    return entry ? entry.conditions.map(({ name, args }) => ({ name, args: [...args] })) : [];
  }

  /**
   * How a column's conditions are joined.
   *
   * @param column Visual column index.
   *
   * @private
   */
  getOperation(column: number): ColumnConditions['operation'] {
    return this.#columns.get(this.hot.toPhysicalColumn(column))?.operation || 'conjunction';
  }

  /** Every column's conditions (physical columns), JSON-safe: for saving, or for `importConditions`. */
  exportConditions(): ColumnConditions[] {
    return Array.from(this.#columns)
      .sort(([a], [b]) => a - b)
      .map(([column, { operation, conditions }]) => ({
        column, operation, conditions: conditions.map(({ name, args }) => ({ name, args: [...args] })),
      }));
  }

  /**
   * Replaces every column's conditions (call `filter()` to apply).
   *
   * @param conditions As `exportConditions()` gives them.
   */
  importConditions(conditions: ColumnConditions[]): void {
    this.#columns.clear();
    conditions.forEach(({ column, operation, conditions: list }) => {
      const known = (list || []).filter(({ name }) => CONDITIONS[name]);

      if (Number.isInteger(column) && known.length) {
        this.#columns.set(column, { operation: operation === 'disjunction' ? 'disjunction' : 'conjunction',
          conditions: known.map(({ name, args }) => ({ name, args: [...(args || [])] })) });
      }
    });
  }

  /** Applies the conditions: hides the rows that do not meet them, shows the others. */
  filter(): void {
    const conditions = this.exportConditions();

    if (this.hot.runHooks('beforeFilter', conditions) === false) {
      return;
    }
    let shown = this.matchingRows();
    const nestedRows = this.hot.getPlugin('nestedRows' as 'filters') as unknown as NestedRowsFiltering | undefined;

    // In a tree, the parents of the matching rows are shown too.
    if (nestedRows?.enabled) {
      shown = nestedRows.filterTree(shown, this.#columns.size > 0);
    }
    this.visibility.setHidden(SOURCE, shown.flatMap((matches, row) => (matches ? [] : [row])));
    this.hot.rootElement.classList.toggle(FILTERED_GRID_CLASS_NAME, this.#columns.size > 0);
    this.hot.runHooks('afterFilter', conditions);
    this.refresh();
  }

  /**
   * Whether a column has conditions.
   *
   * @private
   */
  hasConditions(column: number): boolean {
    return this.#columns.has(this.hot.toPhysicalColumn(column));
  }

  /**
   * The values of a column, as text, of the rows that meet the conditions of the other columns (what a value list
   * offers), in order, each once.
   *
   * @param column Visual column index.
   */
  getColumnValues(column: number): string[] {
    const physical = this.hot.toPhysicalColumn(column);
    const values = new Set<string>();
    const rows = this.matchingRows(physical);

    this.readColumns([physical], (row, [value]) => {
      if (rows[row]) {
        values.add(toText(value));
      }
    });

    return Array.from(values).sort((a, b) => {
      const [x, y] = [Number(a), Number(b)];

      if (a !== '' && b !== '' && Number.isFinite(x) && Number.isFinite(y)) {
        return x - y;
      }

      return a.localeCompare(b);
    });
  }

  /**
   * The physical rows that do not meet the conditions.
   *
   * @private
   */
  rowsToHide(): number[] {
    const matching = this.matchingRows();
    const hidden: number[] = [];

    matching.forEach((matches, row) => {
      if (!matches) {
        hidden.push(row);
      }
    });

    return hidden;
  }

  /**
   * Whether each physical row meets the conditions of every column (but `exceptColumn`).
   *
   * @param exceptColumn A physical column to leave out.
   *
   * @private
   */
  matchingRows(exceptColumn?: number): boolean[] {
    const entries = Array.from(this.#columns).filter(([column]) => column !== exceptColumn);
    const matching: boolean[] = new Array(this.hot.countSourceRows()).fill(true);

    if (!entries.length) {
      return matching;
    }
    const contexts = entries.map(([column]) => this.columnContext(column));

    this.readColumns(entries.map(([column]) => column), (row, values) => {
      matching[row] = entries.every(([, { operation, conditions }], i) => {
        const test = ({ name, args }: FilterCondition) => CONDITIONS[name].test(values[i], args, contexts[i]);
        // A value list applies on top of the conditions; AND or OR joins the conditions.
        const lists = conditions.filter(({ name }) => name === 'by_value');
        const others = conditions.filter(({ name }) => name !== 'by_value');
        const meetsOthers = !others.length || (operation === 'disjunction' ? others.some(test) : others.every(test));

        return meetsOthers && lists.every(test);
      });
    });

    return matching;
  }

  /**
   * The cell type and date format of a physical column.
   *
   * @private
   */
  columnContext(physicalColumn: number): ConditionContext {
    const meta = this.hot.getColumnMeta(this.hot.toVisualColumn(physicalColumn) ?? physicalColumn) as
      ConditionContext;

    return { type: meta.type, dateFormat: meta.dateFormat };
  }

  /**
   * Reads the values of physical columns in every row, hidden ones too, as the cells show them.
   *
   * @param physicalColumns Physical column indexes.
   * @param callback Called with each physical row and its values.
   *
   * @private
   */
  readColumns(physicalColumns: number[], callback: (row: number, values: unknown[]) => void): void {
    const translator = getTranslator(this.hot);
    const { rows, columns } = translator;

    // While reading, visual indexes count every row and column (none is hidden).
    translator.rows = null;
    translator.columns = null;
    try {
      const columnIndexes = physicalColumns.map(column => this.hot.runHooks('unmodifyCol', column));
      const total = this.hot.countSourceRows();
      const sorted = this.hot.hasHook('modifyRow');

      for (let ordered = 0; ordered < total; ordered += 1) {
        const row = sorted ? this.hot.runHooks('modifyRow', ordered) : ordered;

        callback(row, columnIndexes.map(column => this.hot.getDataAtCell(ordered, column)));
      }
    } finally {
      translator.rows = rows;
      translator.columns = columns;
    }
  }

  shiftColumns(map: (column: number) => number | null): void {
    const columns = Array.from(this.#columns);

    this.#columns.clear();
    columns.forEach(([column, entry]) => {
      const next = map(column);

      if (next !== null) {
        this.#columns.set(next, entry);
      }
    });
  }

  markHeader(column: number, TH: HTMLTableCellElement): void {
    TH.classList.toggle(FILTERED_COLUMN_CLASS_NAME, column >= 0 && this.hasConditions(column));
  }

  /**
   * Redraws, keeping the selection on visible cells.
   *
   * @private
   */
  refresh(): void {
    const selected = this.hot.getSelectedLast();
    const count = this.hot.countRows();

    this.hot.forceFullRender = true;
    this.hot.render();
    this.hot.view?.wt.wtOverlays.adjustElementsSize(true);
    this.hot.render();

    if (selected && count > 0) {
      this.hot.selectCell(Math.min(selected[0], count - 1), selected[1], void 0, void 0, false);
    } else if (selected) {
      this.hot.deselectCell();
    }
  }
}

registerPlugin('filters', Filters);

export default Filters;
