import './dropdownMenu.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import * as C from './../../i18n/constants';
import { CONDITIONS, conditionsForType } from './../filters/conditions';
import type Filters from './../filters/filters';
import type { ColumnConditions, FilterCondition } from './../filters/filters';

/** A custom item of the column menu. */
export type DropdownMenuItem = {
  key?: string;
  name: string | ((column: number) => string);
  callback?: (column: number) => void;
  disabled?: boolean | ((column: number) => boolean);
};

/** The `dropdownMenu` setting: `true`, a list of items (keys or custom items), or `{ items }`. */
export type DropdownMenuSettings = boolean | (string | DropdownMenuItem)[] | { items: (string | DropdownMenuItem)[] };

const SEPARATOR = '---------';
/** The items of `dropdownMenu: true`; the ones a disabled plugin needs are left out. */
const DEFAULT_ITEMS = ['sort_asc', 'sort_desc', 'clear_sort', SEPARATOR, 'filter_by_condition', 'filter_by_value',
  'filter_action_bar', 'clear_filter', SEPARATOR, 'hide_column'];
/** The most values the value list draws at once (a search narrows them). */
const MAX_DRAWN_VALUES = 1000;

/** The button in a column header that opens the menu. */
export const BUTTON_CLASS_NAME = 'fs-dropdown-button';
const MENU_CLASS_NAME = 'fs-dropdown-menu';

type SortingPlugin = {
  enabled: boolean;
  sort(config?: { column: number; sortOrder: 'asc' | 'desc' }): void;
  clearSort(): void;
  getSortConfig(column: number): unknown;
};
type HidingPlugin = { enabled: boolean; hideColumns(columns: number[]): void };

/** An element with attributes (`text` sets its text) and children: the menu is built without HTML strings. */
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, attributes: Record<string, string | boolean> = {},
  children: (Node | null)[] = []): HTMLElementTagNameMap[K] => {
  const element = document.createElement(tag);

  Object.entries(attributes).forEach(([name, value]) => {
    if (name === 'text') {
      element.textContent = String(value);
    } else if (typeof value === 'boolean') {
      (element as unknown as Record<string, boolean>)[name] = value;
    } else {
      element.setAttribute(name, value);
    }
  });
  children.forEach(child => child && element.appendChild(child));

  return element;
};

/**
 * The column menu: a ▾ button in each column header opens a menu with sorting, filtering (by condition and by
 * values, with `filters`) and hiding the column (with `hiddenColumns`).
 *
 * ```js
 * new FreeSheet(container, { data, colHeaders: true, columnSorting: true, filters: true, dropdownMenu: true });
 * ```
 *
 * `dropdownMenu` can list the items: `sort_asc`, `sort_desc`, `clear_sort`, `filter_by_condition`, `filter_by_value`,
 * `filter_action_bar` (OK and Cancel), `clear_filter`, `hide_column`, `---------` (a separator), and custom items
 * `{ name, callback(column), disabled }`.
 */
class DropdownMenu extends BasePlugin {
  /** The open menu, or `null`. */
  element: HTMLDivElement | null = null;
  /** The visual column of the open menu. */
  column: number | null = null;
  /** The value list's values and the checked ones (as text). */
  #values: string[] = [];
  #checked = new Set<string>();
  #search = '';

  isEnabled(): boolean {
    return !!this.hot.getSettings().dropdownMenu;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.addButton(column, TH));
    this.addHook('afterScrollHorizontally', () => this.close());
    this.addHook('afterScrollVertically', () => this.close());
    // Before the grid's own mousedown, which would select (or sort) the column.
    this.hot.rootElement.addEventListener('mousedown', this.onRootMouseDown, true);
    this.hot.rootElement.classList.add('fs-has-dropdown-menu');

    super.enablePlugin();
    if (this.hot.view) {
      this.hot.render();
    }
  }

  disablePlugin(): void {
    this.close();
    this.hot.rootElement.removeEventListener('mousedown', this.onRootMouseDown, true);
    this.hot.rootElement.classList.remove('fs-has-dropdown-menu');
    this.hot.rootElement.querySelectorAll(`.${BUTTON_CLASS_NAME}`).forEach(button => button.remove());
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.close();
    super.updatePlugin();
  }

  destroy(): void {
    this.close();
    super.destroy();
  }

  get filters(): Filters | null {
    const filters = this.hot.getPlugin('filters') as unknown as Filters | undefined;

    return filters && filters.enabled ? filters : null;
  }

  get sorting(): SortingPlugin | null {
    const sorting = this.hot.getPlugin('columnSorting') as unknown as SortingPlugin | undefined;

    return sorting && sorting.enabled ? sorting : null;
  }

  get hiding(): HidingPlugin | null {
    const hiding = this.hot.getPlugin('hiddenColumns') as unknown as HidingPlugin | undefined;

    return hiding && hiding.enabled ? hiding : null;
  }

  phrase(key: string): string {
    return this.hot.getTranslatedPhrase(key, 0) as string;
  }

  addButton(column: number, TH: HTMLTableCellElement): void {
    if (column < 0) {
      return;
    }
    let button = TH.querySelector(`.${BUTTON_CLASS_NAME}`) as HTMLButtonElement | null;

    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.tabIndex = -1;
      button.className = BUTTON_CLASS_NAME;
      // Into the header's label box, not into what other plugins put before it (a column outline's gutter).
      (TH.querySelector(':scope > .relative') || TH).appendChild(button);
    }
    button.setAttribute('aria-label', this.phrase(C.COLUMN_MENU_BUTTON));
    button.setAttribute('aria-haspopup', 'true');
    // Shown all the time while the column is filtered or sorted.
    button.classList.toggle(`${BUTTON_CLASS_NAME}--active`, !!(this.filters?.hasConditions(column) ||
      this.sorting?.getSortConfig(column)));
    button.classList.toggle(`${BUTTON_CLASS_NAME}--open`, this.element !== null && this.column === column);
  }

  onRootMouseDown = (event: MouseEvent): void => {
    const button = (event.target as HTMLElement).closest(`.${BUTTON_CLASS_NAME}`);
    const TH = button?.closest('th');

    if (!button || !TH || event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    const column = this.hot.view.wt.wtTable.getCoords(TH)?.col;

    if (column === void 0 || column < 0) {
      return;
    }
    if (this.element && this.column === column) {
      this.close();
    } else {
      this.open(column);
    }
  };

  /**
   * The items for the open column, as keys and custom items.
   *
   * @private
   */
  items(): (string | DropdownMenuItem)[] {
    const setting = this.hot.getSettings().dropdownMenu as DropdownMenuSettings;
    let items: (string | DropdownMenuItem)[] = DEFAULT_ITEMS;

    if (Array.isArray(setting)) {
      items = setting;
    } else if (setting && typeof setting === 'object' && Array.isArray(setting.items)) {
      items = setting.items;
    }
    const available = (item: string | DropdownMenuItem) => {
      if (typeof item !== 'string' || item === SEPARATOR) {
        return true;
      }
      if (item.startsWith('sort_') || item === 'clear_sort') {
        return !!this.sorting;
      }
      if (item.startsWith('filter_') || item === 'clear_filter') {
        return !!this.filters;
      }

      return item === 'hide_column' ? !!this.hiding : false;
    };
    const kept = items.filter(available);

    // No separator at the ends or twice in a row.
    return kept.filter((item, i) => item !== SEPARATOR || (i > 0 && i < kept.length - 1 && kept[i - 1] !== SEPARATOR));
  }

  /**
   * Opens the menu of a column.
   *
   * @param column Visual column index.
   */
  open(column: number): void {
    this.close();
    if (this.hot.runHooks('beforeDropdownMenuShow', column) === false) {
      return;
    }
    const items = this.items();

    this.hot.runHooks('beforeDropdownMenuSetItems', items, column);

    const menu = document.createElement('div');

    menu.className = [MENU_CLASS_NAME,
      ...Array.from(this.hot.rootElement.classList).filter(name => /^fs-(theme|style)-/.test(name))].join(' ');
    menu.setAttribute('role', 'dialog');
    menu.setAttribute('aria-label', String(this.hot.getColHeader(column)));
    this.element = menu;
    this.column = column;
    items.forEach(item => this.renderItem(menu, item, column));

    menu.addEventListener('keydown', event => this.onKeyDown(event));
    menu.addEventListener('mousedown', event => event.stopPropagation());
    document.body.appendChild(menu);
    this.position();
    document.addEventListener('mousedown', this.onDocumentMouseDown, true);
    this.hot.unlisten();
    this.hot.render();
    this.hot.runHooks('afterDropdownMenuShow', column);
  }

  /** Closes the menu. */
  close(): void {
    if (!this.element) {
      return;
    }
    const column = this.column;

    this.element.remove();
    this.element = null;
    this.column = null;
    document.removeEventListener('mousedown', this.onDocumentMouseDown, true);
    this.hot.listen();
    this.hot.render();
    this.hot.runHooks('afterDropdownMenuHide', column);
  }

  onDocumentMouseDown = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;

    // The button toggles the menu itself.
    if (this.element && !this.element.contains(target) && !target.closest(`.${BUTTON_CLASS_NAME}`)) {
      this.close();
    }
  };

  onKeyDown(event: KeyboardEvent): void {
    event.stopPropagation();
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
    } else if (event.key === 'Enter' && (event.target as HTMLElement).tagName === 'INPUT' &&
      (event.target as HTMLInputElement).type !== 'checkbox') {
      event.preventDefault();
      this.apply();
    }
  }

  /**
   * Below the column's header, inside the window.
   *
   * @private
   */
  position(): void {
    const menu = this.element!;
    const button = this.hot.view.wt.wtTable.getColumnHeader(this.column!) as HTMLElement | null;
    const rect = (button || this.hot.rootElement).getBoundingClientRect();
    const left = Math.min(rect.left, window.innerWidth - menu.offsetWidth - 4);
    const top = rect.bottom + menu.offsetHeight > window.innerHeight ?
      Math.max(4, window.innerHeight - menu.offsetHeight - 4) : rect.bottom;

    menu.style.left = `${Math.max(4, left)}px`;
    menu.style.top = `${top}px`;
  }

  renderItem(menu: HTMLElement, item: string | DropdownMenuItem, column: number): void {
    if (item === SEPARATOR) {
      menu.appendChild(el('div', { class: `${MENU_CLASS_NAME}__separator`, role: 'separator' }));

      return;
    }
    if (item === 'filter_by_condition') {
      this.renderConditions(menu, column);

      return;
    }
    if (item === 'filter_by_value') {
      this.renderValues(menu, column);

      return;
    }
    if (item === 'filter_action_bar') {
      this.renderActions(menu);

      return;
    }
    const action = typeof item === 'string' ? this.action(item, column) : {
      name: typeof item.name === 'function' ? item.name(column) : item.name,
      callback: () => item.callback?.(column),
      disabled: typeof item.disabled === 'function' ? item.disabled(column) : !!item.disabled,
    };

    if (!action) {
      return;
    }
    const button = document.createElement('button');

    button.type = 'button';
    button.className = `${MENU_CLASS_NAME}__item`;
    button.textContent = action.name;
    button.disabled = action.disabled;
    if (typeof item === 'string') {
      button.dataset.key = item;
    } else if (item.key) {
      button.dataset.key = item.key;
    }
    button.addEventListener('click', () => {
      this.close();
      action.callback();
    });
    menu.appendChild(button);
  }

  /**
   * A predefined action item.
   *
   * @private
   */
  action(key: string, column: number): { name: string; callback: () => void; disabled: boolean } | null {
    switch (key) {
      case 'sort_asc':
      case 'sort_desc':
        return {
          name: this.phrase(key === 'sort_asc' ? C.COLUMN_MENU_SORT_ASC : C.COLUMN_MENU_SORT_DESC),
          callback: () => this.sorting?.sort({ column, sortOrder: key === 'sort_asc' ? 'asc' : 'desc' }),
          disabled: false,
        };
      case 'clear_sort':
        return {
          name: this.phrase(C.COLUMN_MENU_CLEAR_SORT),
          callback: () => this.sorting?.clearSort(),
          disabled: !this.sorting?.getSortConfig(column),
        };
      case 'clear_filter':
        return {
          name: this.phrase(C.FILTERS_CLEAR_COLUMN),
          callback: () => {
            this.filters?.removeConditions(column);
            this.filters?.filter();
          },
          disabled: !this.filters?.hasConditions(column),
        };
      case 'hide_column':
        return {
          name: this.phrase(C.CONTEXTMENU_ITEMS_HIDE_COLUMN),
          callback: () => this.hiding?.hideColumns([column]),
          disabled: this.hot.countCols() <= 1,
        };
      default:
        return null;
    }
  }

  renderConditions(menu: HTMLElement, column: number): void {
    const filters = this.filters!;
    let type = (this.hot.getColumnMeta(column) as { type?: string }).type;

    // A column without a type whose values are all numbers gets the number conditions.
    if (!type || type === 'text') {
      const values = filters.getColumnValues(column).filter(value => value !== '');

      if (values.length && values.every(value => Number.isFinite(Number(value)))) {
        type = 'numeric';
      }
    }
    const names = conditionsForType(type);
    const existing = filters.getConditions(column).filter(({ name }) => name !== 'by_value');
    const select = (index: number, selected?: string) => el('select', { class: 'fs-filter-condition',
      'data-index': String(index) }, [
      el('option', { value: '', text: this.phrase(C.FILTERS_CONDITIONS_NONE) }),
      ...Array.from(new Set([...names, ...(selected ? [selected] : [])])).map(name =>
        el('option', { value: name, text: this.conditionTitle(name), selected: name === selected })),
    ]);
    const inputs = (index: number, condition?: FilterCondition) => [0, 1].map(arg => el('input', {
      class: 'fs-filter-input',
      type: 'text',
      'data-index': String(index),
      'data-arg': String(arg),
      placeholder: this.phrase(arg === 0 ? C.FILTERS_BUTTONS_PLACEHOLDER_VALUE : C.FILTERS_BUTTONS_PLACEHOLDER_SECOND_VALUE),
      value: condition && condition.args[arg] !== void 0 ? String(condition.args[arg]) : '',
    }));
    const operation = filters.getOperation(column);
    const radio = (value: ColumnConditions['operation'], phrase: string) => el('label', {}, [
      el('input', { type: 'radio', name: 'fs-filter-operation', value, checked: operation === value }),
      document.createTextNode(` ${this.phrase(phrase)}`),
    ]);
    const section = el('div', { class: `${MENU_CLASS_NAME}__section fs-filter-by-condition` }, [
      el('div', { class: `${MENU_CLASS_NAME}__title`, text: this.phrase(C.FILTERS_DIVS_FILTER_BY_CONDITION) }),
      select(0, existing[0]?.name),
      ...inputs(0, existing[0]),
      el('div', { class: 'fs-filter-operation' }, [radio('conjunction', C.FILTERS_LABELS_CONJUNCTION),
        radio('disjunction', C.FILTERS_LABELS_DISJUNCTION)]),
      select(1, existing[1]?.name),
      ...inputs(1, existing[1]),
    ]);

    section.addEventListener('change', () => this.updateConditionInputs());
    menu.appendChild(section);
    this.updateConditionInputs();
  }

  /**
   * A condition's name in the menu.
   *
   * @private
   */
  conditionTitle(name: string): string {
    const { title, phrase } = CONDITIONS[name];

    return title || (phrase ? this.phrase(phrase) : name);
  }

  /**
   * Shows the inputs a condition needs, and the second condition once the first is chosen.
   *
   * @private
   */
  updateConditionInputs(): void {
    const section = this.element?.querySelector('.fs-filter-by-condition');

    if (!section) {
      return;
    }
    const selects = Array.from(section.querySelectorAll('select')) as HTMLSelectElement[];
    const first = selects[0].value;

    (section.querySelector('.fs-filter-operation') as HTMLElement).hidden = !first;
    selects[1].hidden = !first;
    selects.forEach((select, index) => {
      const arity = select.value && !select.hidden ? CONDITIONS[select.value].arity : 0;

      section.querySelectorAll(`.fs-filter-input[data-index="${index}"]`).forEach((input) => {
        (input as HTMLInputElement).hidden = Number((input as HTMLInputElement).dataset.arg) >= arity;
      });
    });
  }

  renderValues(menu: HTMLElement, column: number): void {
    const filters = this.filters!;
    const list = filters.getConditions(column).find(({ name }) => name === 'by_value');

    this.#values = filters.getColumnValues(column);
    this.#checked = new Set(list && Array.isArray(list.args[0]) ? (list.args[0] as unknown[]).map(String) : this.#values);
    this.#search = '';

    const section = el('div', { class: `${MENU_CLASS_NAME}__section fs-filter-by-value` }, [
      el('div', { class: `${MENU_CLASS_NAME}__title`, text: this.phrase(C.FILTERS_DIVS_FILTER_BY_VALUE) }),
      el('input', { class: 'fs-filter-search', type: 'search', placeholder: this.phrase(C.FILTERS_BUTTONS_PLACEHOLDER_SEARCH) }),
      el('div', { class: 'fs-filter-links' }, [
        el('button', { type: 'button', class: 'fs-filter-select-all', text: this.phrase(C.FILTERS_BUTTONS_SELECT_ALL) }),
        el('button', { type: 'button', class: 'fs-filter-clear', text: this.phrase(C.FILTERS_BUTTONS_CLEAR) }),
      ]),
      el('div', { class: 'fs-filter-values', role: 'group' }),
    ]);

    section.querySelector('.fs-filter-search')!.addEventListener('input', (event) => {
      this.#search = (event.target as HTMLInputElement).value.toLowerCase();
      this.renderValueList();
    });
    // Select all and Clear act on the values the search finds.
    section.querySelector('.fs-filter-select-all')!.addEventListener('click', () => {
      this.searchedValues().forEach(value => this.#checked.add(value));
      this.renderValueList();
    });
    section.querySelector('.fs-filter-clear')!.addEventListener('click', () => {
      this.searchedValues().forEach(value => this.#checked.delete(value));
      this.renderValueList();
    });
    section.querySelector('.fs-filter-values')!.addEventListener('change', (event) => {
      const checkbox = event.target as HTMLInputElement;

      if (checkbox.checked) {
        this.#checked.add(checkbox.value);
      } else {
        this.#checked.delete(checkbox.value);
      }
    });
    menu.appendChild(section);
    this.renderValueList();
  }

  searchedValues(): string[] {
    return this.#search ? this.#values.filter(value => value.toLowerCase().includes(this.#search)) : this.#values;
  }

  renderValueList(): void {
    const list = this.element?.querySelector('.fs-filter-values');

    if (!list) {
      return;
    }
    const blank = this.phrase(C.FILTERS_VALUES_BLANK_CELLS);

    list.replaceChildren(...this.searchedValues().slice(0, MAX_DRAWN_VALUES).map(value => el('label',
      { class: 'fs-filter-value' }, [
        el('input', { type: 'checkbox', value, checked: this.#checked.has(value) }),
        el('span', { text: value === '' ? `(${blank})` : value }),
      ])));
  }

  renderActions(menu: HTMLElement): void {
    const actions = el('div', { class: `${MENU_CLASS_NAME}__actions` }, [
      el('button', { type: 'button', class: 'fs-filter-ok', text: this.phrase(C.FILTERS_BUTTONS_OK) }),
      el('button', { type: 'button', class: 'fs-filter-cancel', text: this.phrase(C.FILTERS_BUTTONS_CANCEL) }),
    ]);

    actions.querySelector('.fs-filter-ok')!.addEventListener('click', () => this.apply());
    actions.querySelector('.fs-filter-cancel')!.addEventListener('click', () => this.close());
    menu.appendChild(actions);
  }

  /**
   * Sets the column's conditions from the menu, filters and closes the menu.
   *
   * @private
   */
  apply(): void {
    const filters = this.filters;
    const menu = this.element;
    const column = this.column;

    if (!filters || !menu || column === null) {
      return;
    }
    const section = menu.querySelector('.fs-filter-by-condition');
    const conditions: FilterCondition[] = [];
    let operation: ColumnConditions['operation'] = filters.getOperation(column);

    if (section) {
      operation = ((section.querySelector('input[name="fs-filter-operation"]:checked') as HTMLInputElement | null)
        ?.value || 'conjunction') as ColumnConditions['operation'];
      (Array.from(section.querySelectorAll('select')) as HTMLSelectElement[]).forEach((select, index) => {
        if (select.value && !select.hidden) {
          const args = Array.from({ length: CONDITIONS[select.value].arity }, (_, arg) =>
            (section.querySelector(`.fs-filter-input[data-index="${index}"][data-arg="${arg}"]`) as HTMLInputElement)
              .value);

          conditions.push({ name: select.value, args });
        }
      });
    } else {
      conditions.push(...filters.getConditions(column).filter(({ name }) => name !== 'by_value'));
    }
    if (menu.querySelector('.fs-filter-by-value')) {
      if (this.#values.some(value => !this.#checked.has(value))) {
        conditions.push({ name: 'by_value', args: [this.#values.filter(value => this.#checked.has(value))] });
      }
    } else {
      conditions.push(...filters.getConditions(column).filter(({ name }) => name === 'by_value'));
    }

    filters.removeConditions(column);
    conditions.forEach(({ name, args }) => filters.addCondition(column, name, args, operation));
    this.close();
    filters.filter();
  }
}

registerPlugin('dropdownMenu', DropdownMenu);

export default DropdownMenu;
