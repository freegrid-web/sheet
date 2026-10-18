import './dataValidation.css';
import './panel';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { applyTheme } from './../../helpers/dom/theme';
import { getEditor } from './../../editors';
import { getRenderer } from './../../renderers';
import { formatCells } from './../../formatting/formatting';
import { parseRange } from './../conditionalFormatting/ranges';
import { addItem } from './../contextMenu/predefinedItems';
import { isValid, type Validation } from './rules';
import * as C from './../../i18n/constants';
import type { MenuItem } from './../contextMenu/menuItem';
import type { PluginHost } from './../_base';

export type { Validation } from './rules';

type Meta = Record<string, unknown> & { validation?: Validation; dateFormat?: string };

/** The settings a rule gives a cell, and the cell's own ones it had before (put back when the rule goes). */
type Applied = { rule: Validation; previous: Record<string, unknown> };

const RULE_SETTINGS = ['validator', 'allowInvalid', 'editor', 'renderer', 'source', 'strict', 'filter'];

/** The settings each cell got from its rule, by its meta object. */
const applied = new WeakMap<Meta, Applied>();

/**
 * Data validation, as in a spreadsheet: a cell's (or a column's) `validation` allows only some values.
 *
 * - `type: 'list'` with `source` (items, or a range of the sheet like `'A1:A5'`): the cell gets a dropdown.
 * - `'number'`, `'integer'`, `'date'`, `'textLength'` compare with `value` (and `value2`) by `operator`.
 * - `strict` (default) refuses a value that is not valid; `strict: false` keeps it and marks the cell.
 * - `message` shows when a value is not valid; `inputMessage` shows under the selected cell.
 * - The side panel `'dataValidation'` (context menu key `'data_validation'`) sets rules on the selected cells.
 * - `getDocument()` and Excel files keep the rules.
 *
 * It is on unless `dataValidation: false`.
 *
 * ```js
 * columns: [{}, { validation: { type: 'list', source: ['Open', 'Done'] } }]
 * ```
 */
class DataValidation extends BasePlugin {
  /** The card under the selected cell (its input message) or the card of a refused value. */
  element: HTMLDivElement | null = null;

  isEnabled(): boolean {
    return this.hot.getSettings().dataValidation !== false;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterGetCellMeta', (_row: number, _col: number, meta: Meta) => this.applyRule(meta));
    this.addHook('afterValidate', (valid: boolean, _value: unknown, row: number, prop: string | number) => {
      this.onAfterValidate(valid, row, prop);
    });
    this.addHook('afterSelectionEnd', () => this.showInputMessage());
    this.addHook('afterDeselect', () => this.closeCard());
    this.addHook('afterBeginEditing', () => this.closeCard());
    this.addHook('afterScrollVertically', () => this.closeCard());
    this.addHook('afterScrollHorizontally', () => this.closeCard());
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.closeCard();
    super.disablePlugin();
  }

  destroy(): void {
    this.closeCard();
    super.destroy();
  }

  /**
   * Gives a cell the validator (and for a list, the dropdown) of its rule; puts its own settings back without one.
   *
   * @private
   */
  applyRule(meta: Meta): void {
    const rule = meta.validation;
    const current = applied.get(meta);

    if (current && current.rule === rule) {
      return;
    }
    if (current) {
      RULE_SETTINGS.forEach((key) => {
        if (current.previous[key] === void 0) {
          delete meta[key];
        } else {
          meta[key] = current.previous[key];
        }
      });
      applied.delete(meta);
    }
    if (!rule || typeof rule !== 'object') {
      return;
    }
    const previous = Object.fromEntries(RULE_SETTINGS.map(key => [key,
      Object.prototype.hasOwnProperty.call(meta, key) ? meta[key] : void 0]));
    const itemsOf = () => this.itemsOf(rule);

    applied.set(meta, { rule, previous });
    meta.allowInvalid = rule.strict === false;
    meta.validator = function validator(this: Meta, value: unknown, callback: (valid: boolean) => void) {
      callback(isValid(rule, value, itemsOf(), this.dateFormat));
    };
    if (rule.type === 'list') {
      meta.editor = getEditor('dropdown');
      meta.renderer = getRenderer('autocomplete');
      meta.filter = false;
      meta.strict = rule.strict !== false;
      meta.source = (query: string, process: (items: unknown[]) => void) => process(itemsOf().map(item => String(item)));
    }
  }

  /**
   * A list's items: its own, or the values of its range.
   *
   * @private
   */
  itemsOf(rule: Validation): unknown[] {
    if (Array.isArray(rule.source)) {
      return rule.source;
    }
    const range = typeof rule.source === 'string' ? parseRange(rule.source.replace(/^=/, '').replace(/\$/g, '')) :
      null;
    const items: unknown[] = [];

    if (range) {
      for (let row = range.r1; row <= Math.min(range.r2, this.hot.countRows() - 1); row += 1) {
        for (let col = range.c1; col <= Math.min(range.c2, this.hot.countCols() - 1); col += 1) {
          const value = this.hot.getDataAtCell(row, col);

          if (value !== null && value !== void 0 && value !== '') {
            items.push(value);
          }
        }
      }
    }

    return items;
  }

  /** A cell's rule (visual indexes), or `null`. */
  getValidation(row: number, col: number): Validation | null {
    return (this.hot.getCellMeta(row, col) as Meta).validation || null;
  }

  /**
   * Gives cells a rule (`null` removes it): the selected cells, or `cells` (`[row, col]`, visual indexes). One undo
   * step; the cells are validated again.
   */
  setValidation(rule: Validation | null, cells?: [number, number][]): void {
    const targets = cells || this.selectedCells();

    formatCells(this.hot as unknown as Parameters<typeof formatCells>[0], targets.map(([row, col]) => ({
      row, col, values: { validation: rule ?? void 0 } })));
    this.hot.validateCells();
  }

  selectedCells(): [number, number][] {
    const cells: [number, number][] = [];

    (this.hot.getSelectedRange() || []).forEach((range) => {
      const from = range.getTopLeftCorner();
      const to = range.getBottomRightCorner();

      for (let row = Math.max(0, from.row); row <= Math.min(to.row, this.hot.countRows() - 1); row += 1) {
        for (let col = Math.max(0, from.col); col <= Math.min(to.col, this.hot.countCols() - 1); col += 1) {
          cells.push([row, col]);
        }
      }
    });

    return cells;
  }

  onAfterValidate(valid: boolean, row: number, prop: string | number): void {
    const col = this.hot.propToCol(prop as never) as number;
    const rule = valid || row < 0 || col < 0 ? null : this.getValidation(row, col);

    if (rule) {
      this.showCard(row, col, rule.message || String(this.hot.getTranslatedPhrase(C.VALIDATION_DEFAULT_MESSAGE)),
        'fs-validation-card fs-validation-card--error');
    }
  }

  showInputMessage(): void {
    const selected = this.hot.getSelectedLast();

    this.closeCard();
    if (!selected || selected[0] !== selected[2] || selected[1] !== selected[3] || selected[0] < 0 || selected[1] < 0) {
      return;
    }
    const rule = this.getValidation(selected[0], selected[1]);

    if (rule?.inputMessage) {
      this.showCard(selected[0], selected[1], rule.inputMessage, 'fs-validation-card');
    }
  }

  /**
   * A card under a cell (above it at the bottom of the window).
   *
   * @private
   */
  showCard(row: number, col: number, text: string, className: string): void {
    this.closeCard();
    const card = document.createElement('div');
    const td = this.hot.getCell(row, col, true) as HTMLElement | null;
    const box = (td || this.hot.rootElement).getBoundingClientRect();

    card.className = className;
    card.setAttribute('role', className.includes('error') ? 'alert' : 'status');
    card.textContent = text;
    document.body.appendChild(card);
    applyTheme(card, this.hot.rootElement);
    const below = box.bottom + 4;
    const top = below + card.offsetHeight > window.innerHeight ? box.top - card.offsetHeight - 4 : below;

    card.style.top = `${Math.max(0, top) + window.scrollY}px`;
    card.style.left = `${Math.max(0, box.left) + window.scrollX}px`;
    this.element = card;
  }

  closeCard(): void {
    this.element?.remove();
    this.element = null;
  }
}

// Not in the default menu: add the key 'data_validation' to `contextMenu`.
addItem('data_validation', (): MenuItem => ({
  key: 'data_validation',
  name(this: PluginHost) {
    return this.getTranslatedPhrase(C.VALIDATION_MENU);
  },
  callback(this: PluginHost) {
    (this as unknown as { openPanel(name: string): void }).openPanel('dataValidation');
  },
  disabled(this: PluginHost) {
    return !this.getSelectedLast() || !this.getPlugin('dataValidation')?.enabled;
  },
}));

registerPlugin('dataValidation', DataValidation);

export default DataValidation;
