import './conditionalFormatting.css';
import './panel';
import { COLOR_SCALES, DATA_BAR_COLORS, ICON_SETS as MENU_ICON_SETS, selectionRanges } from './panel';
import * as C from './../../i18n/constants';
import type { MenuItem } from './../contextMenu/menuItem';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { getTranslator } from './../../utils/recordTranslator';
import { warn } from './../../helpers/console';
import { CONDITIONS, toText } from './../filters/conditions';
import type { ConditionContext } from './../filters/conditions';
import {
  formatRange, insertColumns, insertRows, parseRange, rectContains, removeColumns, removeRows, shiftFormula,
  subtractRect,
} from './ranges';
import type { Rect } from './ranges';
import { ICONS } from './../contextMenu/icons';
import { isTextOnFill, textOnFill } from './../../utils/cellStyle';

/** The style a highlight or formula rule gives a cell. */
export type ConditionalStyle = {
  background?: string;
  color?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  border?: string;
};

/** A conditional formatting rule (JSON-safe). */
export type ConditionalRule = {
  /** One or more A1 ranges of data cells: `B2`, `B2:F20`, `C:C`, `3:5` (not for a column's `format`). */
  range?: string | string[];
  /** A condition (`gt`, `between`, `contains`, `duplicate`, `top`, `aboveAverage`, …) or a formula (`=$F2<0`). */
  when?: string;
  /** The condition's value: a value, or two for `between` (`[low, high]`), or the count for `top` / `bottom`. */
  value?: unknown;
  /** `top` / `bottom`: `value` is a percentage of the cells. */
  percent?: boolean;
  /** 2 or 3 colors from the lowest number to the highest. */
  colorScale?: string[];
  /** A bar in the cell, as long as the number (a color). */
  dataBar?: string | { color: string };
  /** Three icons by thirds of the numbers. */
  iconSet?: 'arrows' | 'trafficLights' | 'signs';
  style?: ConditionalStyle;
  className?: string;
  /** No rule after this one formats a cell this one matches. */
  stopIfTrue?: boolean;
};

type Rule = { id: string; rule: ConditionalRule; rects: Rect[]; fromColumn: boolean };

/** What a rule needs to know about all of its cells. */
type Stats = { numbers: number[]; sorted: number[]; min: number; max: number; mean: number; counts: Map<string, number> };

type FormulaEngine = {
  enabled: boolean;
  setConditionFormulas(key: string, cells: { row: number; column: number; formula: string }[]): void;
  getConditionResult(key: string, row: number, column: number): boolean;
  removeConditionFormulas(key: string): void;
};

const STYLE_PROPERTIES: (keyof ConditionalStyle)[] = ['background', 'color', 'fontWeight', 'fontStyle',
  'textDecoration', 'border'];
const ICON_SETS = ['arrows', 'trafficLights', 'signs'];
/** The rule kinds that need every value of their ranges. */
const NEEDS_STATS = ['duplicate', 'unique', 'top', 'bottom', 'aboveAverage', 'belowAverage'];

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return null;
};

/** `#rgb` or `#rrggbb` as [r, g, b], or `null`. */
const parseColor = (color: string): [number, number, number] | null => {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(color).trim());

  if (!hex) {
    return null;
  }
  const digits = hex[1].length === 3 ? hex[1].split('').map(digit => digit + digit).join('') : hex[1];

  return [0, 2, 4].map(i => parseInt(digits.slice(i, i + 2), 16)) as [number, number, number];
};

const mix = (from: string, to: string, share: number): string => {
  const [a, b] = [parseColor(from), parseColor(to)];

  if (!a || !b) {
    return share < 0.5 ? from : to;
  }

  return `rgb(${a.map((channel, i) => Math.round(channel + (b[i] - channel) * share)).join(', ')})`;
};

/**
 * Conditional formatting: cells format themselves from their values, as in Excel. Rules apply to ranges of cells (or
 * to a column, with its `format`), and use the value a cell shows (a formula's result).
 *
 * ```js
 * new FreeSheet(container, {
 *   data,
 *   conditionalFormatting: [
 *     { range: 'F2:F20', when: 'gt', value: 1000, style: { background: '#f8d7da', color: '#842029' } },
 *     { range: 'B2:E20', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] },
 *   ],
 * });
 * ```
 *
 * Ranges name data rows and columns, as formulas do; they move with inserted and removed rows and columns. The first
 * rule wins where rules set the same style; `stopIfTrue` stops the rules after it for a cell.
 */
class ConditionalFormatting extends BasePlugin {
  #rules: Rule[] = [];
  #nextId = 1;
  #stats = new Map<string, Stats>();
  /** Formula rules need their formulas put into the engine again (after changes, before the next render). */
  #formulasDirty = true;
  #warnedFormulas = false;
  /** Whether the last `updateSettings` gave the rules (`conditionalFormatting` or `columns`). */
  #rulesGiven = false;

  isEnabled(): boolean {
    return !!this.hot.getSettings().conditionalFormatting || this.columnRules().length > 0;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, row: number, column: number, _prop: unknown,
      value: unknown, cellProperties: ConditionContext) => this.drawCell(TD, row, column, value, cellProperties));
    this.addHook('beforeRender', () => this.installFormulas());
    this.addHook('afterChange', () => this.invalidate(false));
    this.addHook('afterLoadData', () => this.invalidate(true));
    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addMenuItems(options));
    this.addHook('afterCreateRow', (index: number, amount: number) =>
      this.moveRanges(rect => insertRows(rect, index, amount)));
    this.addHook('afterRemoveRow', (_index: number, _amount: number, physicalRows: number[] = []) =>
      this.moveRanges(rect => removeRows(rect, physicalRows)));
    this.addHook('afterCreateCol', (index: number, amount: number) =>
      this.moveRanges(rect => insertColumns(rect, index, amount)));
    this.addHook('afterRemoveCol', (_index: number, _amount: number, physicalColumns: number[] = []) =>
      this.moveRanges(rect => removeColumns(rect, physicalColumns)));
    super.enablePlugin();
    this.applySettings();
  }

  disablePlugin(): void {
    this.#rules.forEach(rule => this.formulas?.removeConditionFormulas(this.formulaKey(rule)));
    this.#rules = [];
    this.#stats.clear();
    super.disablePlugin();
  }

  onUpdateSettings(newSettings?: unknown): void {
    const given = newSettings as Record<string, unknown> | undefined;

    this.#rulesGiven = !!given && (Object.prototype.hasOwnProperty.call(given, 'conditionalFormatting') ||
      Object.prototype.hasOwnProperty.call(given, 'columns'));
    super.onUpdateSettings(newSettings);
  }

  updatePlugin(): void {
    // Other settings changing keeps the rules added since.
    if (this.#rulesGiven) {
      this.applySettings();
    }
    super.updatePlugin();
  }

  get formulas(): FormulaEngine | null {
    const formulas = this.hot.getPlugin('formulas' as 'search') as unknown as FormulaEngine | undefined;

    return formulas && formulas.enabled ? formulas : null;
  }

  /**
   * The rules of the columns' `format`, each over its whole column.
   *
   * @private
   */
  columnRules(): { column: number; rule: ConditionalRule }[] {
    const columns = this.hot.getSettings().columns;

    return Array.isArray(columns) ? columns.flatMap((column: { format?: ConditionalRule[] } | null, index: number) =>
      (column && Array.isArray(column.format) ? column.format.map(rule => ({ column: index, rule })) : [])) : [];
  }

  /**
   * Takes the rules of the settings: `conditionalFormatting` and the columns' `format`.
   *
   * @private
   */
  applySettings(): void {
    const setting = this.hot.getSettings().conditionalFormatting;

    this.#rules.forEach(rule => this.formulas?.removeConditionFormulas(this.formulaKey(rule)));
    this.#rules = [];
    (Array.isArray(setting) ? setting as ConditionalRule[] : []).forEach(rule => this.#add(rule, false));
    this.columnRules().forEach(({ column, rule }) => {
      const internal = this.#make({ ...rule, range: void 0 }, true);

      internal.rects = [{ r1: 0, c1: column, r2: Infinity, c2: column }];
      this.#rules.push(internal);
    });
    this.invalidate(true);
  }

  #make(rule: ConditionalRule, fromColumn: boolean): Rule {
    const ranges = Array.isArray(rule.range) ? rule.range : rule.range === void 0 ? [] : [rule.range];
    const rects = ranges.map(range => parseRange(String(range))).filter((rect): rect is Rect => !!rect);

    return { id: `r${this.#nextId++}`, rule: JSON.parse(JSON.stringify(rule)), rects, fromColumn };
  }

  #add(rule: ConditionalRule, notify: boolean, index?: number): string {
    const internal = this.#make(rule, false);
    const sheetRules = this.#rules.filter(item => !item.fromColumn).length;
    const position = index === void 0 ? sheetRules : Math.max(0, Math.min(index, sheetRules));

    this.#rules.splice(position, 0, internal);
    if (notify) {
      this.changed();
    }

    return internal.id;
  }

  // -- API ----------------------------------------------------------------------------------------------------------

  /**
   * Adds a rule (at the end of the sheet's rules, or at `index`: 0 is the highest priority).
   *
   * @param rule The rule, with `range`.
   * @param index Its place among the sheet's rules.
   * @returns The rule's id.
   */
  addRule(rule: ConditionalRule, index?: number): string {
    return this.#add(rule, true, index);
  }

  /**
   * Replaces a rule.
   *
   * @param id The rule's id.
   * @param rule The new rule.
   */
  updateRule(id: string, rule: ConditionalRule): void {
    const index = this.#rules.findIndex(item => item.id === id);

    if (index === -1) {
      return;
    }
    this.formulas?.removeConditionFormulas(this.formulaKey(this.#rules[index]));
    this.#rules[index] = { ...this.#make(rule, this.#rules[index].fromColumn), id };
    this.changed();
  }

  /**
   * Removes a rule.
   *
   * @param id The rule's id.
   */
  removeRule(id: string): void {
    const rule = this.#rules.find(item => item.id === id);

    if (rule) {
      this.formulas?.removeConditionFormulas(this.formulaKey(rule));
      this.#rules = this.#rules.filter(item => item !== rule);
      this.changed();
    }
  }

  /**
   * Moves a rule to another place among the sheet's rules (0 is the highest priority).
   *
   * @param id The rule's id.
   * @param index Its new place.
   */
  moveRule(id: string, index: number): void {
    const rule = this.#rules.find(item => item.id === id && !item.fromColumn);

    if (!rule) {
      return;
    }
    this.#rules = this.#rules.filter(item => item !== rule);
    this.#rules.splice(Math.max(0, Math.min(index, this.#rules.filter(item => !item.fromColumn).length)), 0, rule);
    this.changed();
  }

  /** The sheet's rules (not the columns' `format`), with their ids and A1 ranges, in priority order. */
  getRules(): (ConditionalRule & { id: string })[] {
    return this.#rules.filter(rule => !rule.fromColumn).map(rule => this.#export(rule));
  }

  /**
   * The rules that apply to a cell (the columns' `format` too), in priority order.
   *
   * @param row Visual row index.
   * @param column Visual column index.
   */
  getRulesAt(row: number, column: number): (ConditionalRule & { id: string })[] {
    const [r, c] = [this.hot.toPhysicalRow(row), this.hot.toPhysicalColumn(column)];

    return this.#rules.filter(rule => rule.rects.some(rect => rectContains(rect, r, c))).map(rule => this.#export(rule));
  }

  /**
   * Removes the sheet's rules from a range (a rule over a larger range keeps the rest), or every sheet rule.
   *
   * @param range A1 range(s); every rule when not given.
   */
  clearRules(range?: string | string[]): void {
    if (range === void 0) {
      this.#rules.filter(rule => !rule.fromColumn).forEach(rule => this.formulas?.removeConditionFormulas(
        this.formulaKey(rule)));
      this.#rules = this.#rules.filter(rule => rule.fromColumn);
    } else {
      const cuts = (Array.isArray(range) ? range : [range]).map(text => parseRange(text))
        .filter((rect): rect is Rect => !!rect);

      this.#rules.forEach((rule) => {
        if (!rule.fromColumn) {
          rule.rects = cuts.reduce((rects, cut) => rects.flatMap(rect => subtractRect(rect, cut)), rule.rects);
        }
      });
      this.#rules.filter(rule => !rule.rects.length).forEach(rule => this.formulas?.removeConditionFormulas(
        this.formulaKey(rule)));
      this.#rules = this.#rules.filter(rule => rule.rects.length);
    }
    this.changed();
  }

  #export(rule: Rule): ConditionalRule & { id: string } {
    const ranges = rule.rects.map(formatRange);

    return { ...JSON.parse(JSON.stringify(rule.rule)), id: rule.id,
      ...(rule.fromColumn ? {} : { range: ranges.length === 1 ? ranges[0] : ranges }) };
  }

  changed(): void {
    this.invalidate(true);
    this.hot.runHooks('afterConditionalFormattingChange', this.getRules());
    this.hot.render();
  }

  // -- Context menu ------------------------------------------------------------------------------------------------

  /**
   * Conditional formatting ▸ in the context menu, as Excel's menu.
   *
   * @private
   */
  addMenuItems(options: { items: MenuItem[] }): void {
    const phrase = (key: string) => this.hot.getTranslatedPhrase(key, 0) as string;
    const editor = (preset: ConditionalRule) => () => this.hot.openPanel('conditionalFormattingRule', { preset });
    const addToSelection = (rule: ConditionalRule) => () => {
      const range = selectionRanges(this.hot);

      if (range.length) {
        this.addRule({ ...rule, range: range.length === 1 ? range[0] : range });
      }
    };
    // Keys are paths: `conditional_formatting`, `conditional_formatting:highlight`, `conditional_formatting:highlight:gt`.
    const ROOT = 'conditional_formatting';
    const item = (key: string, name: string, callback: () => void): MenuItem => ({
      key, name: () => name, callback, disabled: () => !this.hot.getSelectedLast(),
    }) as MenuItem;
    const group = (key: string, name: string, items: MenuItem[]): MenuItem => ({
      key, name: () => name, submenu: { items }, disabled: () => !this.hot.getSelectedLast(),
    }) as MenuItem;
    const path = (...parts: string[]) => [ROOT, ...parts].join(':');

    options.items.push({ name: '---------' } as MenuItem, { ...group(ROOT, phrase(C.CF_MENU), [
      group(path('highlight'), phrase(C.CF_HIGHLIGHT), [
        item(path('highlight', 'gt'), phrase(C.CF_GREATER), editor({ when: 'gt', value: '' })),
        item(path('highlight', 'lt'), phrase(C.CF_LESS), editor({ when: 'lt', value: '' })),
        item(path('highlight', 'between'), phrase(C.CF_BETWEEN), editor({ when: 'between', value: ['', ''] })),
        item(path('highlight', 'eq'), phrase(C.CF_EQUAL), editor({ when: 'eq', value: '' })),
        item(path('highlight', 'contains'), phrase(C.CF_TEXT_CONTAINS), editor({ when: 'contains', value: '' })),
        item(path('highlight', 'date'), phrase(C.CF_DATE), editor({ when: 'date_today' })),
        item(path('highlight', 'duplicate'), phrase(C.CF_DUPLICATE), editor({ when: 'duplicate' })),
      ]),
      group(path('top_bottom'), phrase(C.CF_TOP_BOTTOM), [
        item(path('top_bottom', 'top'), phrase(C.CF_TOP_ITEMS), editor({ when: 'top', value: 10 })),
        item(path('top_bottom', 'top_percent'), phrase(C.CF_TOP_PERCENT),
          editor({ when: 'top', value: 10, percent: true })),
        item(path('top_bottom', 'bottom'), phrase(C.CF_BOTTOM_ITEMS), editor({ when: 'bottom', value: 10 })),
        item(path('top_bottom', 'bottom_percent'), phrase(C.CF_BOTTOM_PERCENT),
          editor({ when: 'bottom', value: 10, percent: true })),
        item(path('top_bottom', 'above_average'), phrase(C.CF_ABOVE_AVERAGE), editor({ when: 'aboveAverage' })),
        item(path('top_bottom', 'below_average'), phrase(C.CF_BELOW_AVERAGE), editor({ when: 'belowAverage' })),
      ]),
      group(path('data_bars'), phrase(C.CF_DATA_BARS), DATA_BAR_COLORS.map((color, i) =>
        item(path('data_bars', `data_bar_${i}`), color, addToSelection({ dataBar: color })))),
      group(path('color_scales'), phrase(C.CF_COLOR_SCALES), COLOR_SCALES.map((colors, i) =>
        item(path('color_scales', `color_scale_${i}`), colors.join(' – '),
          addToSelection({ colorScale: [...colors] })))),
      group(path('icon_sets'), phrase(C.CF_ICON_SETS), MENU_ICON_SETS.map(set =>
        item(path('icon_sets', `icon_set_${set.name}`), phrase(set.phrase),
          addToSelection({ iconSet: set.name })))),
      { name: '---------' } as MenuItem,
      item(path('new'), phrase(C.CF_NEW_RULE), editor({ when: 'gt', value: '' })),
      group(path('clear'), phrase(C.CF_CLEAR), [
        item(path('clear', 'clear_selection'), phrase(C.CF_CLEAR_SELECTION),
          () => this.clearRules(selectionRanges(this.hot))),
        item(path('clear', 'clear_sheet'), phrase(C.CF_CLEAR_SHEET), () => this.clearRules()),
      ]),
      item(path('manage'), phrase(C.CF_MANAGE), () => this.hot.openPanel('conditionalFormatting')),
    ]), icon: ICONS.conditionalFormatting } as MenuItem);
  }

  // -- Evaluation ---------------------------------------------------------------------------------------------------

  /**
   * After a change: statistics are computed again; formulas are put again after structure changes.
   *
   * @private
   */
  invalidate(formulas: boolean): void {
    this.#stats.clear();
    if (formulas) {
      this.#formulasDirty = true;
    }
  }

  moveRanges(move: (rect: Rect) => Rect | null): void {
    this.#rules.forEach((rule) => {
      rule.rects = rule.rects.map(move).filter((rect): rect is Rect => !!rect);
    });
    this.#rules = this.#rules.filter(rule => rule.rects.length);
    this.invalidate(true);
  }

  formulaKey(rule: Rule): string {
    return `conditionalFormatting:${rule.id}`;
  }

  isFormulaRule(rule: Rule): boolean {
    return typeof rule.rule.when === 'string' && rule.rule.when.charAt(0) === '=';
  }

  /**
   * The number of data rows and columns, hidden ones included.
   *
   * @private
   */
  size(): { rows: number; columns: number } {
    const translator = getTranslator(this.hot);

    return { rows: translator.rows!.total(), columns: translator.columns!.total() };
  }

  /**
   * The cells of a rule's ranges, within the data.
   *
   * @private
   */
  cells(rule: Rule): { row: number; column: number }[] {
    const { rows, columns } = this.size();
    const cells: { row: number; column: number }[] = [];

    rule.rects.forEach((rect) => {
      for (let row = rect.r1; row <= Math.min(rect.r2, rows - 1); row += 1) {
        for (let column = rect.c1; column <= Math.min(rect.c2, columns - 1); column += 1) {
          cells.push({ row, column });
        }
      }
    });

    return cells;
  }

  /**
   * Puts the formulas of formula rules into the engine, moved for each cell of their ranges.
   *
   * @private
   */
  installFormulas(): void {
    if (!this.#formulasDirty) {
      return;
    }
    this.#formulasDirty = false;

    const formulaRules = this.#rules.filter(rule => this.isFormulaRule(rule));

    if (!formulaRules.length) {
      return;
    }
    const formulas = this.formulas;

    if (!formulas) {
      if (!this.#warnedFormulas) {
        this.#warnedFormulas = true;
        warn('Conditional formatting: formula rules need the formulas plugin (`formulas: { engine }`).');
      }

      return;
    }
    formulaRules.forEach((rule) => {
      const anchor = rule.rects[0];

      formulas.setConditionFormulas(this.formulaKey(rule), this.cells(rule).map(({ row, column }) => ({
        row, column, formula: shiftFormula(rule.rule.when!, row - anchor.r1, column - anchor.c1),
      })));
    });
  }

  /**
   * The values of a rule's cells, as the cells show them.
   *
   * @private
   */
  stats(rule: Rule): Stats {
    const cached = this.#stats.get(rule.id);

    if (cached) {
      return cached;
    }
    const translator = getTranslator(this.hot);
    const { rows, columns } = translator;
    const numbers: number[] = [];
    const counts = new Map<string, number>();
    const cells = this.cells(rule);

    // While reading, visual indexes count every row and column.
    translator.rows = null;
    translator.columns = null;
    try {
      cells.forEach(({ row, column }) => {
        const orderedRow = this.hot.hasHook('unmodifyRow') ? this.hot.runHooks('unmodifyRow', row) : row;
        const orderedColumn = this.hot.hasHook('unmodifyCol') ? this.hot.runHooks('unmodifyCol', column) : column;
        const value = this.hot.getDataAtCell(orderedRow, orderedColumn);
        const number = toNumber(value);
        const text = toText(value);

        if (number !== null) {
          numbers.push(number);
        }
        if (text !== '') {
          counts.set(text.toLowerCase(), (counts.get(text.toLowerCase()) || 0) + 1);
        }
      });
    } finally {
      translator.rows = rows;
      translator.columns = columns;
    }
    const sorted = [...numbers].sort((a, b) => a - b);
    const stats = {
      numbers,
      sorted,
      min: sorted.length ? sorted[0] : 0,
      max: sorted.length ? sorted[sorted.length - 1] : 0,
      mean: numbers.length ? numbers.reduce((sum, number) => sum + number, 0) / numbers.length : 0,
      counts,
    };

    this.#stats.set(rule.id, stats);

    return stats;
  }

  /**
   * Whether a highlight or formula rule matches a cell.
   *
   * @private
   */
  matches(rule: Rule, row: number, column: number, value: unknown, context: ConditionContext): boolean {
    const { when, value: argument, percent } = rule.rule;

    if (!when) {
      return false;
    }
    if (when.charAt(0) === '=') {
      return !!this.formulas?.getConditionResult(this.formulaKey(rule), row, column);
    }
    if (NEEDS_STATS.indexOf(when) !== -1) {
      const stats = this.stats(rule);
      const number = toNumber(value);
      const text = toText(value).toLowerCase();

      switch (when) {
        case 'duplicate':
          return text !== '' && (stats.counts.get(text) || 0) > 1;
        case 'unique':
          return text !== '' && stats.counts.get(text) === 1;
        case 'aboveAverage':
          return number !== null && number > stats.mean;
        case 'belowAverage':
          return number !== null && number < stats.mean;
        default: {
          if (number === null || !stats.sorted.length) {
            return false;
          }
          const size = Math.max(1, percent ? Math.ceil(stats.sorted.length * Number(argument) / 100) :
            Math.floor(Number(argument) || 10));
          const count = Math.min(size, stats.sorted.length);

          return when === 'top' ? number >= stats.sorted[stats.sorted.length - count] :
            number <= stats.sorted[count - 1];
        }
      }
    }
    const condition = CONDITIONS[when];

    if (!condition) {
      return false;
    }
    const args = Array.isArray(argument) && condition.arity === 2 ? argument : [argument];

    return condition.test(value, args, { type: context?.type, dateFormat: context?.dateFormat });
  }

  /**
   * Where a number is between the range's lowest and highest number, from 0 to 1.
   *
   * @private
   */
  share(rule: Rule, number: number): number {
    const { min, max } = this.stats(rule);

    return max === min ? 1 : (number - min) / (max - min);
  }

  // -- Drawing ------------------------------------------------------------------------------------------------------

  drawCell(TD: HTMLTableCellElement, row: number, column: number, value: unknown, context: ConditionContext): void {
    // The cell may have been another cell's before (cells are reused while scrolling).
    this.clearCell(TD, (context as { style?: Record<string, string> } | undefined)?.style);
    if (!this.#rules.length || row < 0 || column < 0) {
      return;
    }
    const r = this.hot.toPhysicalRow(row);
    const c = this.hot.toPhysicalColumn(column);
    const style: Record<string, string> = {};
    const classes: string[] = [];
    let icon: string | null = null;

    for (const rule of this.#rules) {
      if (!rule.rects.some(rect => rectContains(rect, r, c))) {
        continue;
      }
      const { colorScale, dataBar, iconSet } = rule.rule;
      const number = toNumber(value);

      if (colorScale && colorScale.length >= 2) {
        if (number !== null && style.background === void 0) {
          style.background = this.scaleColor(rule, colorScale, number);
        }
      } else if (dataBar) {
        if (number !== null && style.backgroundImage === void 0) {
          const { numbers } = this.stats(rule);
          const largest = Math.max(...numbers.map(Math.abs), 0);
          const width = largest ? Math.round(Math.abs(number) / largest * 100) : 0;
          const color = typeof dataBar === 'string' ? dataBar : dataBar.color;

          style.backgroundImage = `linear-gradient(to right, ${color} ${width}%, transparent ${width}%)`;
        }
      } else if (iconSet) {
        if (number !== null && icon === null && ICON_SETS.indexOf(iconSet) !== -1) {
          const share = this.share(rule, number);

          icon = `${iconSet}-${share >= 2 / 3 ? 'high' : share >= 1 / 3 ? 'middle' : 'low'}`;
        }
      } else if (this.matches(rule, r, c, value, context)) {
        STYLE_PROPERTIES.forEach((property) => {
          const styleValue = rule.rule.style?.[property];

          if (styleValue && style[property] === void 0) {
            style[property] = styleValue;
          }
        });
        if (rule.rule.className) {
          classes.push(...String(rule.rule.className).split(/\s+/).filter(Boolean));
        }
        if (rule.rule.stopIfTrue) {
          break;
        }
      }
    }
    this.paint(TD, style, classes, icon);
  }

  scaleColor(rule: Rule, colors: string[], number: number): string {
    const share = this.share(rule, number);

    if (colors.length === 2) {
      return mix(colors[0], colors[1], share);
    }
    // The middle color at the 50th percentile.
    const { sorted } = this.stats(rule);
    const median = sorted[Math.floor((sorted.length - 1) / 2)];
    const middle = this.share(rule, median);

    return share <= middle ? mix(colors[0], colors[1], middle ? share / middle : 0) :
      mix(colors[1], colors[2], middle < 1 ? (share - middle) / (1 - middle) : 1);
  }

  paint(TD: HTMLTableCellElement, style: Record<string, string>, ruleClasses: string[], icon: string | null): void {
    // With an icon, the icon and the number stay on one line, as in a spreadsheet.
    const classes = icon ? [...ruleClasses, 'fs-cf-has-icon'] : ruleClasses;
    // A fill without a text color keeps the text readable, unless the cell has a color of its own.
    const text = style.background && !style.color && (!TD.style.color || isTextOnFill(TD.style.color)) ?
      textOnFill(style.background) : null;

    if (text) {
      style.color = text;
    }
    const properties = Object.keys(style);

    if (!properties.length && !classes.length) {
      return;
    }
    properties.forEach((property) => {
      (TD.style as unknown as Record<string, string>)[property] = style[property];
    });
    classes.forEach(name => TD.classList.add(name));
    if (icon) {
      const span = document.createElement('span');

      span.className = `fs-cf-icon fs-cf-icon--${icon}`;
      span.setAttribute('aria-hidden', 'true');
      TD.insertBefore(span, TD.firstChild);
    }
    TD.dataset.fsCf = JSON.stringify({ properties, classes });
  }

  /**
   * Removes what this plugin drew on a cell; the cell's own style (`base`) comes back.
   *
   * @private
   */
  clearCell(TD: HTMLTableCellElement, base?: Record<string, string>): void {
    const applied = TD.dataset.fsCf;

    if (!applied) {
      return;
    }
    const { properties, classes } = JSON.parse(applied) as { properties: string[]; classes: string[] };

    properties.forEach((property) => {
      (TD.style as unknown as Record<string, string>)[property] = base?.[property] || '';
    });
    classes.forEach(name => TD.classList.remove(name));
    TD.querySelectorAll('.fs-cf-icon').forEach(span => span.remove());
    delete TD.dataset.fsCf;
  }
}

registerPlugin('conditionalFormatting', ConditionalFormatting);

export default ConditionalFormatting;
