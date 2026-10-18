import './findAndReplace.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { applyTheme } from './../../helpers/dom/theme';
import * as C from './../../i18n/constants';

/** How `find` and `replace` compare: case, the whole cell, and the formulas instead of their results. */
export type FindOptions = { matchCase?: boolean; entireCell?: boolean; inFormulas?: boolean };

/** A cell that matches (visual indexes). */
export type FindMatch = { row: number; col: number };

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const textOf = (value: unknown): string => (value === null || value === void 0 ? '' : String(value));

/** Whether a cell's text matches the query. */
const matches = (text: string, query: string, { matchCase, entireCell }: FindOptions): boolean => {
  const a = matchCase ? text : text.toLowerCase();
  const b = matchCase ? query : query.toLowerCase();

  return entireCell ? a === b : a.includes(b);
};

/** The text with the query replaced (every occurrence, or the whole text for `entireCell`). */
const replaceIn = (text: string, query: string, replacement: string, options: FindOptions): string => {
  if (options.entireCell) {
    return replacement;
  }

  return text.replace(new RegExp(escapeRegExp(query), options.matchCase ? 'g' : 'gi'), () => replacement);
};

/**
 * Find and replace, as in a spreadsheet: Ctrl+F opens a find box at the top right of the grid, Ctrl+H the same box
 * with a replace field. The matches are highlighted; Enter (or ↓) goes to the next one, Shift+Enter (or ↑) to the
 * previous one. Replace changes the current match, Replace all every match (one undo step). Options: match case,
 * match the entire cell, and search in formulas (instead of their results). Read-only cells are not replaced.
 *
 * ```js
 * new FreeSheet(container, { data, findAndReplace: true });
 * hot.getPlugin('findAndReplace').open('replace');
 * ```
 */
class FindAndReplace extends BasePlugin {
  /** The box, while it is open. */
  element: HTMLDivElement | null = null;
  /** The matches of the last search, in reading order (rows, then columns). */
  matches: FindMatch[] = [];
  /** The index of the current match in `matches`, or -1. */
  current = -1;
  #matchKeys = new Set<string>();
  #query = '';
  #options: FindOptions = {};

  isEnabled(): boolean {
    return !!this.hot.getSettings().findAndReplace;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('beforeKeyDown', (event: KeyboardEvent) => this.onBeforeKeyDown(event));
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, row: number, col: number) => this.markCell(TD, row, col));
    this.addHook('afterChange', (changes: unknown, source: string) => {
      if (this.element && source !== 'loadData') {
        this.search(false);
      }
    });
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.close();
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.disablePlugin();
    this.enablePlugin();
    super.updatePlugin();
  }

  destroy(): void {
    this.close();
    super.destroy();
  }

  /** Ctrl+F opens the find box, Ctrl+H the replace box (instead of the browser's own find). */
  onBeforeKeyDown(event: KeyboardEvent): void {
    const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;

    if (ctrlDown && (event.keyCode === 70 || event.keyCode === 72) && !this.hot.getActiveEditor()?.isOpened?.()) {
      event.preventDefault();
      (event as KeyboardEvent & { stopImmediatePropagation(): void }).stopImmediatePropagation();
      this.open(event.keyCode === 72 ? 'replace' : 'find');
    }
  }

  /**
   * The cells that match `query`, in reading order. Without a query, none.
   *
   * @param query The text to find.
   * @param options Match case, match the entire cell, search in formulas.
   */
  find(query: string, options: FindOptions = {}): FindMatch[] {
    const found: FindMatch[] = [];

    if (!query) {
      return found;
    }
    for (let row = 0; row < this.hot.countRows(); row += 1) {
      for (let col = 0; col < this.hot.countCols(); col += 1) {
        const value = options.inFormulas ? this.hot.getSourceDataAtCell(row, col) : this.hot.getDataAtCell(row, col);

        if (matches(textOf(value), query, options)) {
          found.push({ row, col });
        }
      }
    }

    return found;
  }

  /**
   * Replaces `query` in the matching cells (or only in `cells`), in their source text (a formula's text): every
   * occurrence, or the whole cell with `entireCell`. Read-only cells stay. One undo step. Returns how many cells
   * changed.
   *
   * @param query The text to find.
   * @param replacement The text it becomes.
   * @param options Match case, match the entire cell, search in formulas.
   * @param cells The cells to change (all matches by default).
   */
  replace(query: string, replacement: string, options: FindOptions = {}, cells = this.find(query, options)): number {
    const changes: [number, number, unknown][] = [];

    cells.forEach(({ row, col }) => {
      const source = this.hot.getSourceDataAtCell(row, col);
      const text = textOf(source);

      if (this.hot.getCellMeta(row, col).readOnly || !matches(text, query, options)) {
        return;
      }
      const result = replaceIn(text, query, replacement, options);
      // A number stays a number when the result is one.
      const value = typeof source === 'number' && result.trim() !== '' && Number.isFinite(Number(result)) ?
        Number(result) : result;

      if (value !== source) {
        changes.push([row, col, value]);
      }
    });
    if (changes.length) {
      this.hot.setDataAtCell(changes, 'findAndReplace');
    }

    return changes.length;
  }

  /** Opens the box (`'replace'` with the replace field) and searches from the selected cell. */
  open(mode: 'find' | 'replace' = 'find'): void {
    if (!this.element) {
      this.element = this.createElement();
      document.body.appendChild(this.element);
    }
    applyTheme(this.element, this.hot.rootElement);
    this.element.classList.toggle('fs-find--replace', mode === 'replace');
    this.position();
    const input = this.element.querySelector<HTMLInputElement>('.fs-find__query')!;

    input.focus();
    input.select();
    this.search(true);
  }

  /** Closes the box and removes the highlights. */
  close(): void {
    if (!this.element) {
      return;
    }
    this.element.remove();
    this.element = null;
    this.matches = [];
    this.#matchKeys.clear();
    this.current = -1;
    this.hot.render();
    this.hot.listen();
  }

  /** Goes to the next match (or the previous one with `step` -1) and selects it. */
  next(step = 1): void {
    if (!this.matches.length) {
      return;
    }
    this.current = (this.current + step + this.matches.length) % this.matches.length;
    this.showCurrent();
  }

  /** Replaces the current match, then goes to the next one. */
  replaceCurrent(): void {
    const match = this.matches[this.current];

    if (!match || !this.element) {
      return;
    }
    const replacement = this.element.querySelector<HTMLInputElement>('.fs-find__replacement')!.value;

    this.replace(this.#query, replacement, this.#options, [match]);
    this.search(false);
    if (this.matches.length) {
      // The next match after the replaced cell.
      const after = this.matches.findIndex(({ row, col }) => row > match.row || (row === match.row && col > match.col));

      this.current = after === -1 ? 0 : after;
      this.showCurrent();
    }
  }

  /** Replaces every match. */
  replaceAll(): void {
    if (!this.element) {
      return;
    }
    const replacement = this.element.querySelector<HTMLInputElement>('.fs-find__replacement')!.value;
    const count = this.replace(this.#query, replacement, this.#options);

    this.search(false);
    this.setStatus(String(this.hot.getTranslatedPhrase(C.FIND_REPLACED)).replace('{count}', String(count)));
  }

  /**
   * Searches with the box's query and options; `fromSelection` makes the first match the one at or after the cell.
   *
   * @private
   */
  search(fromSelection: boolean): void {
    if (!this.element) {
      return;
    }
    const checked = (name: string) => this.element!.querySelector<HTMLInputElement>(`[name="${name}"]`)!.checked;

    this.#query = this.element.querySelector<HTMLInputElement>('.fs-find__query')!.value;
    this.#options = { matchCase: checked('matchCase'), entireCell: checked('entireCell'),
      inFormulas: checked('inFormulas') };
    const previous = this.matches[this.current];

    this.matches = this.find(this.#query, this.#options);
    this.#matchKeys = new Set(this.matches.map(({ row, col }) => `${row}:${col}`));
    const [row, col] = (fromSelection ? this.hot.getSelectedLast() : previous && [previous.row, previous.col]) ||
      [0, 0];
    const at = this.matches.findIndex(match => match.row > row || (match.row === row && match.col >= col));

    this.current = this.matches.length ? Math.max(0, at) : -1;
    if (fromSelection && this.current >= 0) {
      this.showCurrent();
    } else {
      this.hot.render();
      this.updateCount();
    }
  }

  /**
   * Selects the current match (keeping the focus in the box) and shows "2 of 5".
   *
   * @private
   */
  showCurrent(): void {
    const match = this.matches[this.current];

    if (match) {
      // Selecting a cell gives the grid the focus; typing goes on in the box.
      const focused = document.activeElement as HTMLElement | null;

      this.hot.selectCell(match.row, match.col);
      this.hot.unlisten();
      if (focused && this.element?.contains(focused)) {
        focused.focus();
      }
    }
    this.hot.render();
    this.updateCount();
    this.keepClearOf(match);
  }

  /**
   * Moves the box to the bottom of the grid (or back to the top) when it covers the current match.
   *
   * @private
   */
  keepClearOf(match: FindMatch | undefined): void {
    const cell = match && this.hot.getCell(match.row, match.col, true);

    if (!this.element || !cell) {
      return;
    }
    const covers = (box: DOMRect, other: DOMRect) => box.left < other.right && other.left < box.right &&
      box.top < other.bottom && other.top < box.bottom;

    if (covers(this.element.getBoundingClientRect(), cell.getBoundingClientRect())) {
      const grid = this.hot.rootElement.getBoundingClientRect();
      const atTop = this.element.dataset.place !== 'bottom';
      const top = atTop ? Math.min(grid.bottom, window.innerHeight) - this.element.offsetHeight - 4 :
        Math.max(grid.top, 0) + 4;

      this.element.dataset.place = atTop ? 'bottom' : 'top';
      this.element.style.top = `${top + window.scrollY}px`;
    }
  }

  updateCount(): void {
    if (!this.#query) {
      this.setStatus('');
    } else if (!this.matches.length) {
      this.setStatus(String(this.hot.getTranslatedPhrase(C.FIND_NO_RESULTS)));
    } else {
      this.setStatus(String(this.hot.getTranslatedPhrase(C.FIND_COUNT)).replace('{current}', String(this.current + 1))
        .replace('{count}', String(this.matches.length)));
    }
  }

  setStatus(text: string): void {
    const status = this.element?.querySelector('.fs-find__status');

    if (status) {
      status.textContent = text;
    }
  }

  /**
   * Highlights the matching cells (the current one more).
   *
   * @private
   */
  markCell(TD: HTMLTableCellElement, row: number, col: number): void {
    const key = `${row}:${col}`;
    const current = this.matches[this.current];

    TD.classList.toggle('fs-find-result', this.#matchKeys.has(key));
    TD.classList.toggle('fs-find-result--current', !!current && current.row === row && current.col === col);
  }

  /**
   * At the top right of the grid's visible area.
   *
   * @private
   */
  position(): void {
    if (!this.element) {
      return;
    }
    const box = this.hot.rootElement.getBoundingClientRect();
    const width = this.element.offsetWidth;

    this.element.style.top = `${Math.max(box.top, 0) + window.scrollY + 4}px`;
    this.element.style.left = `${Math.max(box.left + 4, box.right - width - 20) + window.scrollX}px`;
  }

  createElement(): HTMLDivElement {
    const box = document.createElement('div');
    const phrase = (key: string) => this.hot.getTranslatedPhrase(key) as string;
    const iconButton = (className: string, label: string, text: string) => `<button type="button" ` +
      `class="fs-find__icon ${className}" title="${label}" aria-label="${label}">${text}</button>`;
    const option = (name: string, label: string) => `<label class="fs-find__option"><input type="checkbox" ` +
      `name="${name}"> ${label}</label>`;

    box.className = 'fs-find';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', phrase(C.FIND_TITLE));
    box.innerHTML = `${'<div class="fs-find__row">' +
      `<input class="fs-find__query" type="text" spellcheck="false" placeholder="${phrase(C.FIND_TITLE)}" ` +
      `aria-label="${phrase(C.FIND_TITLE)}">` +
      '<span class="fs-find__status" aria-live="polite"></span>'}${
      iconButton('fs-find__previous', phrase(C.FIND_PREVIOUS), '↑')}${
      iconButton('fs-find__next', phrase(C.FIND_NEXT), '↓')}${
      iconButton('fs-find__toggle', phrase(C.FIND_REPLACE), '⇄')}${
      iconButton('fs-find__close', phrase(C.FIND_CLOSE), '×')}</div>` +
      '<div class="fs-find__row fs-find__replace-row">' +
      `<input class="fs-find__replacement" type="text" spellcheck="false" placeholder="${phrase(C.FIND_REPLACE_WITH)}" ` +
      `aria-label="${phrase(C.FIND_REPLACE_WITH)}">` +
      `<button type="button" class="fs-find__button fs-find__replace">${phrase(C.FIND_REPLACE)}</button>` +
      `<button type="button" class="fs-find__button fs-find__replace-all">${phrase(C.FIND_REPLACE_ALL)}</button>` +
      `</div><div class="fs-find__row fs-find__options">${option('matchCase', phrase(C.FIND_MATCH_CASE))}${
        option('entireCell', phrase(C.FIND_ENTIRE_CELL))}${option('inFormulas', phrase(C.FIND_IN_FORMULAS))}</div>`;

    const query = box.querySelector<HTMLInputElement>('.fs-find__query')!;
    const replacement = box.querySelector<HTMLInputElement>('.fs-find__replacement')!;
    const on = (selector: string, callback: () => void) => box.querySelector(selector)!
      .addEventListener('click', callback);

    // A click in the box is not a click outside the grid, and the grid leaves the keyboard to the box.
    box.addEventListener('mousedown', event => event.stopPropagation());
    box.addEventListener('focusin', () => this.hot.unlisten());
    box.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        this.close();
      } else if (event.key === 'Enter' && event.target === replacement) {
        this.replaceCurrent();
      } else if (event.key === 'Enter') {
        this.next(event.shiftKey ? -1 : 1);
      } else if ((event.ctrlKey || event.metaKey) && (event.key === 'f' || event.key === 'h')) {
        event.preventDefault();
        this.open(event.key === 'h' ? 'replace' : 'find');
      }
    });
    query.addEventListener('input', () => this.search(true));
    box.querySelectorAll('.fs-find__options input').forEach(input => input.addEventListener('change',
      () => this.search(false)));
    on('.fs-find__previous', () => this.next(-1));
    on('.fs-find__next', () => this.next(1));
    on('.fs-find__close', () => this.close());
    on('.fs-find__toggle', () => {
      box.classList.toggle('fs-find--replace');
      (box.classList.contains('fs-find--replace') ? replacement : query).focus();
    });
    on('.fs-find__replace', () => this.replaceCurrent());
    on('.fs-find__replace-all', () => this.replaceAll());

    return box;
  }
}

registerPlugin('findAndReplace', FindAndReplace);

export default FindAndReplace;
