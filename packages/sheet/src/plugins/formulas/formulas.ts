import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { addClass } from './../../helpers/dom/element';
import { getWorkbookOf } from './../../workbook/workbook';

/**
 * The part of a formula engine model the plugin uses. IronCalc's `Model` (`@ironcalc/wasm`) has it: rows and columns
 * are 1-based, sheet 0 is the only sheet.
 */
export type FormulaModel = {
  setUserInput(sheet: number, row: number, column: number, input: string): void;
  getCellContent(sheet: number, row: number, column: number): string;
  getFormattedCellValue(sheet: number, row: number, column: number): string;
  getCellType(sheet: number, row: number, column: number): number;
  insertRows(sheet: number, row: number, count: number): void;
  deleteRows(sheet: number, row: number, count: number): void;
  insertColumns(sheet: number, column: number, count: number): void;
  deleteColumns(sheet: number, column: number, count: number): void;
  rangeClearAll(sheet: number, row: number, column: number, row2: number, column2: number): void;
  pauseEvaluation(): void;
  resumeEvaluation(): void;
  evaluate(): void;
  free?(): void;
};

/** The `formulas` setting: the engine's model class, and optionally its locale and time zone. */
export type FormulasSettings = {
  engine: new (name: string, locale: string, timezone: string, language: string) => FormulaModel;
  locale?: string;
  timezone?: string;
  language?: string;
};

/** The cell types of the engine (`getCellType`). */
const CELL_TYPE = { NUMBER: 1, TEXT: 2, BOOLEAN: 4, ERROR: 16 };
/** The engine's last column (as in Excel). */
const MAX_COLUMNS = 16384;
/** The class of a formula cell whose result is an error (`#DIV/0!`, `#REF!`, …). */
export const ERROR_CLASS_NAME = 'fs-formula-error';

const isFormula = (value: unknown): value is string => typeof value === 'string' && value.charAt(0) === '=';

/** The text the engine gets for a cell value. */
const toInput = (value: unknown): string => {
  if (value === null || value === void 0) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }

  return String(value);
};

/**
 * Formulas: a cell whose value starts with `=` shows the result of the formula. The grid keeps the formula as the
 * cell's source value (the editor shows it); `getDataAtCell` and the renderers get the result. The calculation is done
 * by a formula engine passed in the settings, for example IronCalc:
 *
 * ```js
 * import init, { Model } from '@ironcalc/wasm';
 *
 * await init();
 * new FreeSheet(container, { data, formulas: { engine: Model } });
 * ```
 *
 * References follow the data rows and columns: sorting or moving rows only changes how they are shown. Inserting and
 * removing rows and columns moves the references, and the grid's formulas are updated to match.
 */
class Formulas extends BasePlugin {
  /** The largest area this sheet has filled in a shared model (cleared before the sheet loads its data again). */
  #extent = { rows: 0, columns: 0 };

  /** The model this grid created, while it has no document with other sheets (or holds that document). */
  ownModel: FormulaModel | null = null;

  /** The engine's model: the document's, shared by all its sheets, or this grid's own. */
  get model(): FormulaModel | null {
    const workbook = getWorkbookOf(this.hot);

    return workbook && workbook.model ? workbook.model as unknown as FormulaModel : this.ownModel;
  }

  /**
   * This grid's sheet in the engine's model (0 for a grid alone).
   *
   * @private
   */
  sheet(): number {
    const workbook = getWorkbookOf(this.hot);

    if (!workbook) {
      return 0;
    }
    const index = workbook.indexOf(this.hot);

    // A sheet whose grid is being created by addSheet is the last one.
    return index === -1 ? workbook.sheets.length - 1 : index;
  }

  isEnabled(): boolean {
    const settings = this.hot.getSettings().formulas as FormulasSettings | undefined;

    return !!settings && typeof settings.engine === 'function';
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterLoadData', () => this.recalculateFull());
    // Before the grid renders the change (afterChange runs after the render).
    this.addHook('beforeChangeRender', (changes: [number, string | number, unknown, unknown][] | null, source: string) =>
      this.onBeforeChangeRender(changes, source));
    this.addHook('modifyData', (row: number, column: number, valueHolder: { value: unknown }, ioMode: string) =>
      this.onModifyData(row, column, valueHolder, ioMode));
    this.addHook('afterCreateRow', (index: number, amount: number) => this.onStructureChange(() =>
      this.model!.insertRows(this.sheet(), index + 1, amount)));
    this.addHook('afterRemoveRow', (_index: number, _amount: number, physicalRows: number[] = []) =>
      this.onStructureChange(() => [...physicalRows].sort((a, b) => b - a)
        .forEach(row => this.model!.deleteRows(this.sheet(), row + 1, 1))));
    this.addHook('afterCreateCol', (index: number, amount: number) => this.onStructureChange(() =>
      this.model!.insertColumns(this.sheet(), index + 1, amount)));
    this.addHook('afterRemoveCol', (_index: number, _amount: number, physicalColumns: number[] = []) =>
      this.onStructureChange(() => [...physicalColumns].sort((a, b) => b - a)
        .forEach(column => this.model!.deleteColumns(this.sheet(), column + 1, 1))));
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, row: number, column: number) =>
      this.onAfterRenderer(TD, row, column));

    super.enablePlugin();

    // At start-up the data is not loaded yet: `afterLoadData` builds the model. Enabled later, build it now.
    if (this.hot.view) {
      this.recalculateFull();
    }
  }

  disablePlugin(): void {
    this.freeModel();
    super.disablePlugin();
  }

  /** Whether the last `updateSettings` gave `formulas` (only then is the engine's model made again). */
  #engineGiven = false;

  onUpdateSettings(newSettings?: unknown): void {
    this.#engineGiven = !!newSettings && Object.prototype.hasOwnProperty.call(newSettings, 'formulas');
    super.onUpdateSettings(newSettings);
  }

  updatePlugin(): void {
    // Other settings changing keeps the model (a document's sheets share it); new data is read by afterLoadData.
    if (this.#engineGiven) {
      this.disablePlugin();
      this.enablePlugin();
    }
    super.updatePlugin();
  }

  destroy(): void {
    this.freeModel();
    super.destroy();
  }

  /**
   * The formula of a cell (its source value), or `null` when the cell has none.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   */
  getFormula(row: number, column: number): string | null {
    const value = this.hot.getSourceDataAtCell(this.hot.toPhysicalRow(row), column);

    return isFormula(value) ? value : null;
  }

  /** Builds the engine's model again from the whole source data. */
  recalculateFull(): void {
    if (!this.enabled && !this.isEnabled()) {
      return;
    }
    const settings = this.hot.getSettings().formulas as FormulasSettings;
    const workbook = getWorkbookOf(this.hot);
    const sheet = this.sheet();

    if (workbook && workbook.model) {
      // A sheet of a document: only its own cells are loaded again. (Clearing the engine's whole sheet is not
      // possible: the engine fails on a range that large.)
      const rowsToClear = Math.max(this.#extent.rows, this.hot.countSourceRows());
      const columnsToClear = Math.max(this.#extent.columns, this.hot.countSourceCols());

      if (rowsToClear > 0 && columnsToClear > 0) {
        this.model!.rangeClearAll(sheet, 1, 1, rowsToClear, columnsToClear);
      }
    } else {
      this.freeModel();
      this.ownModel = new settings.engine('FreeSheet', settings.locale || 'en', settings.timezone || 'UTC',
        settings.language || 'en');
    }
    const model = this.model!;

    model.pauseEvaluation();

    const rows = this.hot.countSourceRows();
    const columns = this.hot.countSourceCols();

    this.#extent = { rows: Math.max(this.#extent.rows, rows), columns: Math.max(this.#extent.columns, columns) };

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const input = toInput(this.readSource(row, column));

        if (input !== '') {
          model.setUserInput(sheet, row + 1, column + 1, input);
        }
      }
    }
    model.resumeEvaluation();
    model.evaluate();
  }

  /** Kept for undo, which reports restored cells; the full recalculation that follows covers them. */
  onAfterSetDataAtCell(): void {}

  /**
   * The source value at a physical row and column.
   *
   * @private
   */
  readSource(row: number, column: number): unknown {
    return this.hot.getSourceDataAtCell(row, this.hot.toVisualColumn(column));
  }

  /**
   * Writes a source value without running the change hooks (the engine already has the change).
   *
   * @private
   */
  writeSource(row: number, column: number, value: string): void {
    const sourceRow = this.hot.getSourceDataAtRow(row) as unknown;

    if (Array.isArray(sourceRow)) {
      sourceRow[column] = value;

      return;
    }
    const prop = this.hot.colToProp(this.hot.toVisualColumn(column));

    if (sourceRow && typeof sourceRow === 'object' && typeof prop === 'string' && prop.indexOf('.') === -1) {
      (sourceRow as Record<string, unknown>)[prop] = value;
    }
  }

  onBeforeChangeRender(changes: [number, string | number, unknown, unknown][] | null, source: string): void {
    if (!this.model || !changes || source === 'loadData') {
      return;
    }
    changes.forEach(([row, prop, , value]) => {
      const physicalRow = this.hot.toPhysicalRow(row);
      const physicalColumn = this.hot.toPhysicalColumn(this.hot.propToCol(prop) as number);

      if (physicalRow !== null && physicalRow >= 0 && physicalColumn !== null && physicalColumn >= 0) {
        this.model!.setUserInput(this.sheet(), physicalRow + 1, physicalColumn + 1, toInput(value));
      }
    });
    this.model.evaluate();
  }

  /** For a formula cell, `getDataAtCell` and the renderers get the result instead of the formula. */
  onModifyData(row: number, column: number, valueHolder: { value: unknown }, ioMode: string): void {
    if (ioMode !== 'get' || !this.model || !isFormula(valueHolder.value)) {
      return;
    }
    const physicalColumn = this.hot.toPhysicalColumn(column);

    valueHolder.value = this.getResult(row + 1, physicalColumn + 1);
  }

  /** The result of a cell in the engine (1-based row and column). */
  getResult(row: number, column: number): unknown {
    const model = this.model!;
    const text = model.getFormattedCellValue(this.sheet(), row, column);
    const type = model.getCellType(this.sheet(), row, column);

    if (type === CELL_TYPE.BOOLEAN) {
      return text === 'TRUE';
    }
    if (type === CELL_TYPE.NUMBER && text !== '' && Number.isFinite(Number(text))) {
      return Number(text);
    }

    return text;
  }

  /**
   * After rows or columns are inserted or removed, the engine moves the references; the grid's formulas are updated
   * to the engine's.
   */
  onStructureChange(change: () => void): void {
    if (!this.model) {
      return;
    }
    change();
    this.model.evaluate();
    this.#extent = {
      rows: Math.max(this.#extent.rows, this.hot.countSourceRows()),
      columns: Math.max(this.#extent.columns, this.hot.countSourceCols()),
    };

    const workbook = getWorkbookOf(this.hot);

    // References in other sheets may have moved too.
    if (workbook && workbook.model) {
      workbook.syncFormulas();
    } else {
      this.syncFormulas();
    }
  }

  /**
   * Writes the engine's formulas (with moved references) into this sheet's data.
   *
   * @private
   */
  syncFormulas(): void {
    const model = this.model;

    if (!model) {
      return;
    }
    const sheet = this.sheet();
    const rows = this.hot.countSourceRows();
    const columns = this.hot.countSourceCols();

    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if (isFormula(this.readSource(row, column))) {
          this.writeSource(row, column, model.getCellContent(sheet, row + 1, column + 1));
        }
      }
    }
  }

  onAfterRenderer(TD: HTMLTableCellElement, row: number, column: number): void {
    if (!this.model || this.getFormula(row, column) === null) {
      return;
    }
    const physicalRow = this.hot.toPhysicalRow(row);
    const physicalColumn = this.hot.toPhysicalColumn(column);

    if (this.model.getCellType(this.sheet(), physicalRow + 1, physicalColumn + 1) === CELL_TYPE.ERROR) {
      addClass(TD, ERROR_CLASS_NAME);
    }
  }

  /** Formulas of conditional formatting, by owner: their block of engine cells far to the right of the sheet. */
  #conditionBlocks = new Map<string, { column: number; width: number; rows: number; top: number; left: number }>();

  /**
   * Puts formulas into the engine (not into the grid's data), in a block of cells far to the right of the sheet, so a
   * recalculation evaluates them all; `getConditionResult` reads their results. A key's earlier formulas are cleared.
   * Used by conditional formatting.
   *
   * @param key The owner of the formulas.
   * @param cells A formula for each physical cell, written for that cell.
   *
   * @private
   */
  setConditionFormulas(key: string, cells: { row: number; column: number; formula: string }[]): void {
    const model = this.model;

    if (!model) {
      return;
    }
    this.removeConditionFormulas(key, false);
    if (!cells.length) {
      return;
    }
    const top = Math.min(...cells.map(cell => cell.row));
    const bottom = Math.max(...cells.map(cell => cell.row));
    const left = Math.min(...cells.map(cell => cell.column));
    const width = Math.max(...cells.map(cell => cell.column)) - left + 1;
    const used = Array.from(this.#conditionBlocks.values()).reduce((sum, block) => sum + block.width, 0);
    // The engine's last column is 16384; blocks are put next to each other from there to the left.
    const column = MAX_COLUMNS - used - width + 1;

    if (column <= this.hot.countSourceCols() + 1) {
      return;
    }
    this.#conditionBlocks.set(key, { column, width, rows: bottom - top + 1, top, left });
    model.pauseEvaluation();
    cells.forEach(cell => model.setUserInput(this.sheet(), cell.row + 1, column + cell.column - left, cell.formula));
    model.resumeEvaluation();
    model.evaluate();
  }

  /**
   * Whether the condition formula of a cell is true (TRUE or a number other than 0).
   *
   * @param key The owner of the formulas.
   * @param row Physical row.
   * @param column Physical column.
   *
   * @private
   */
  getConditionResult(key: string, row: number, column: number): boolean {
    const block = this.#conditionBlocks.get(key);
    const model = this.model;

    if (!block || !model || row < block.top || row >= block.top + block.rows || column < block.left ||
      column >= block.left + block.width) {
      return false;
    }
    const value = this.getResult(row + 1, block.column + column - block.left);

    return value === true || (typeof value === 'number' && value !== 0);
  }

  /**
   * Clears a key's condition formulas.
   *
   * @private
   */
  removeConditionFormulas(key: string, evaluate = true): void {
    const block = this.#conditionBlocks.get(key);
    const model = this.model;

    this.#conditionBlocks.delete(key);
    if (!block || !model) {
      return;
    }
    model.rangeClearAll(this.sheet(), block.top + 1, block.column, block.top + block.rows, block.column + block.width - 1);
    if (evaluate) {
      model.evaluate();
    }
  }

  /**
   * Frees the model this grid created (a document's shared model is freed with the grid that holds it).
   *
   * @private
   */
  freeModel(): void {
    this.#conditionBlocks.clear();
    if (this.ownModel && typeof this.ownModel.free === 'function') {
      this.ownModel.free();
    }
    this.ownModel = null;
  }
}

registerPlugin('formulas', Formulas);

export default Formulas;
