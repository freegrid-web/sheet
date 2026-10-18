import './hyperlinks.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { applyTheme } from './../../helpers/dom/theme';
import { formatCells } from './../../formatting/formatting';
import * as C from './../../i18n/constants';
import { addItem } from './../contextMenu/predefinedItems';
import type { MenuItem } from './../contextMenu/menuItem';
import type { PluginHost } from './../_base';

/**
 * A link as it is kept: `http(s)://…` and `mailto:…` as they are, `example.com/page` as `https://example.com/page`.
 * Anything else (`javascript:`, …) is no link: `null`.
 */
export const normalizeLink = (text: unknown): string | null => {
  const link = String(text ?? '').trim();

  if (/^(https?:\/\/|mailto:)\S+$/i.test(link)) {
    return link;
  }
  if (/^[\w-]+(\.[\w-]+)+(:\d+)?([/?#]\S*)?$/i.test(link)) {
    return `https://${link}`;
  }

  return null;
};

type Grid = Parameters<typeof formatCells>[0] & {
  getSelectedLast(): number[] | undefined;
  getCell(row: number, col: number, topmost?: boolean): HTMLTableCellElement | null;
};

/**
 * Hyperlinks in cells, as in a spreadsheet. A cell's `link` setting makes its text a link:
 *
 * - Selecting the cell shows a card under it with the address (it opens in a new tab), Edit and Remove.
 * - Ctrl+click (⌘ on a Mac) opens the link.
 * - Ctrl+K, or the context menu's Insert link, edits the selected cell's text and link.
 * - Only web (`http`, `https`) and mail (`mailto`) links are kept; `getDocument()` and Excel files keep them.
 *
 * It is on unless `hyperlinks: false`.
 *
 * ```js
 * cell: [{ row: 0, col: 0, link: 'https://example.com' }]
 * grid.getPlugin('hyperlinks').setLink(0, 0, 'https://example.com', 'Example');
 * ```
 */
class Hyperlinks extends BasePlugin {
  /** The card (the address of the selected link) or the editor, while one shows. */
  element: HTMLDivElement | null = null;

  isEnabled(): boolean {
    return this.hot.getSettings().hyperlinks !== false;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    // The cell's settings come with the hook: no getCellMeta per drawn cell.
    this.addHook('afterRenderer', (TD: HTMLTableCellElement, _row: number, _col: number, _prop: unknown, _value: unknown,
      cellProperties: { link?: unknown }) => this.markCell(TD, normalizeLink(cellProperties?.link)));
    this.addHook('afterSelectionEnd', () => this.showCard());
    this.addHook('afterDeselect', () => this.close());
    this.addHook('afterBeginEditing', () => this.close());
    this.addHook('afterScrollVertically', () => this.close());
    this.addHook('afterScrollHorizontally', () => this.close());
    this.addHook('beforeKeyDown', (event: KeyboardEvent) => this.onBeforeKeyDown(event));
    this.addHook('beforeOnCellMouseDown', (event: MouseEvent, coords: { row: number; col: number }) =>
      this.onCellMouseDown(event, coords));
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.close();
    super.disablePlugin();
  }

  destroy(): void {
    this.close();
    super.destroy();
  }

  get grid(): Grid {
    return this.hot as unknown as Grid;
  }

  /** A cell's link, or `null`. */
  getLink(row: number, col: number): string | null {
    return normalizeLink(this.hot.getCellMeta(row, col).link);
  }

  /**
   * Gives a cell a link (and, with `text`, that text), or removes its link with `null`. One undo step. A link that is
   * no web or mail link is refused (returns `false`).
   *
   * @param row Visual row.
   * @param col Visual column.
   * @param link The address, or `null`.
   * @param text The cell's text (keeps its value when left out).
   */
  setLink(row: number, col: number, link: string | null, text?: string): boolean {
    const normalized = link === null ? null : normalizeLink(link);

    if (link !== null && !normalized) {
      return false;
    }
    const undoRedo = (this.hot as unknown as { undoRedo?: { beginGroup(): void; endGroup(): void } }).undoRedo;

    undoRedo?.beginGroup();
    if (text !== void 0 && text !== this.hot.getDataAtCell(row, col)) {
      this.hot.setDataAtCell(row, col, text, 'hyperlinks');
    }
    formatCells(this.grid, [{ row, col, values: { link: normalized ?? void 0 } }]);
    undoRedo?.endGroup();

    return true;
  }

  /** Removes the link of a cell (visual indexes); its text stays. One undo step. */
  removeLink(row: number, col: number): void {
    this.setLink(row, col, null);
  }

  markCell(TD: HTMLTableCellElement, link: string | null): void {
    TD.classList.toggle('fs-link', !!link);
    if (link) {
      TD.title = link;
    } else if (TD.title) {
      TD.removeAttribute('title');
    }
  }

  /** Ctrl+click (⌘+click) opens the link in a new tab. */
  onCellMouseDown(event: MouseEvent, { row, col }: { row: number; col: number }): void {
    const link = row >= 0 && col >= 0 ? this.getLink(row, col) : null;

    if (link && (event.ctrlKey || event.metaKey) && event.button === 0) {
      window.open(link, '_blank', 'noopener,noreferrer');
    }
  }

  /** Ctrl+K edits the selected cell's link. */
  onBeforeKeyDown(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && (event.key === 'k' ||
      event.keyCode === 75) && this.hot.getSelectedLast() && !this.hot.getActiveEditor()?.isOpened?.()) {
      event.preventDefault();
      (event as KeyboardEvent & { stopImmediatePropagation(): void }).stopImmediatePropagation();
      this.edit();
    }
  }

  /**
   * The selected cell (the active one): `[row, col]`.
   *
   * @private
   */
  selectedCell(): [number, number] | null {
    const selected = this.hot.getSelectedLast();

    return selected && selected[0] >= 0 && selected[1] >= 0 ? [selected[0], selected[1]] : null;
  }

  selectedLink(): string | null {
    const cell = this.selectedCell();

    return cell ? this.getLink(...cell) : null;
  }

  /**
   * The card under a selected link: its address, Edit and Remove.
   *
   * @private
   */
  showCard(): void {
    this.close();
    const selected = this.hot.getSelectedLast();
    const link = this.selectedLink();

    if (!link || !selected || selected[0] !== selected[2] || selected[1] !== selected[3]) {
      return;
    }
    const card = this.open('fs-link-card');
    const anchor = document.createElement('a');
    const phrase = (key: string) => String(this.hot.getTranslatedPhrase(key));

    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'fs-link-card__address';
    anchor.textContent = link;
    card.append(anchor, this.button(phrase(C.LINK_EDIT_BUTTON), () => this.edit()),
      this.button(phrase(C.LINK_REMOVE), () => {
        const [row, col] = this.selectedCell()!;

        this.removeLink(row, col);
        this.close();
      }));
    this.place(card);
  }

  /** The editor of the selected cell's text and link (Enter applies, Escape cancels). */
  edit(): void {
    const cell = this.selectedCell();

    if (!cell) {
      return;
    }
    this.close();
    const [row, col] = cell;
    const phrase = (key: string) => String(this.hot.getTranslatedPhrase(key));
    const editor = this.open('fs-link-editor');
    const field = (label: string, value: string, name: string) => {
      const wrapper = document.createElement('label');
      const input = document.createElement('input');

      wrapper.className = 'fs-link-editor__field';
      wrapper.textContent = label;
      input.type = 'text';
      input.name = name;
      input.value = value;
      input.spellcheck = false;
      wrapper.appendChild(input);
      editor.appendChild(wrapper);

      return input;
    };
    const value = this.hot.getDataAtCell(row, col);
    const text = field(phrase(C.LINK_TEXT), value === null || value === void 0 ? '' : String(value), 'text');
    const address = field(phrase(C.LINK_ADDRESS), this.getLink(row, col) || '', 'link');
    const actions = document.createElement('div');
    const apply = () => {
      if (!address.value.trim()) {
        this.setLink(row, col, null, text.value);
      } else if (!this.setLink(row, col, address.value, text.value || address.value.trim())) {
        address.setAttribute('aria-invalid', 'true');
        address.focus();

        return;
      }
      this.close();
      this.hot.listen();
    };

    address.placeholder = 'https://';
    actions.className = 'fs-link-editor__actions';
    actions.append(this.button(phrase(C.LINK_APPLY), apply, 'fs-link-editor__apply'), this.button(phrase(C.LINK_CANCEL),
      () => {
        this.close();
        this.hot.listen();
      }));
    editor.appendChild(actions);
    editor.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        apply();
      } else if (event.key === 'Escape') {
        this.close();
        this.hot.listen();
      }
    });
    address.addEventListener('input', () => address.removeAttribute('aria-invalid'));
    this.place(editor);
    (address.value ? text : address).focus();
    this.hot.unlisten();
  }

  open(className: string): HTMLDivElement {
    const element = document.createElement('div');

    element.className = className;
    // A click in it is not a click outside the grid: the selection stays.
    element.addEventListener('mousedown', event => event.stopPropagation());
    document.body.appendChild(element);
    applyTheme(element, this.hot.rootElement);
    this.element = element;

    return element;
  }

  button(label: string, onClick: () => void, className = ''): HTMLButtonElement {
    const button = document.createElement('button');

    button.type = 'button';
    button.className = `fs-link-button ${className}`.trim();
    button.textContent = label;
    button.addEventListener('click', onClick);

    return button;
  }

  /**
   * Under the selected cell (above it at the bottom of the window).
   *
   * @private
   */
  place(element: HTMLElement): void {
    const cell = this.selectedCell();
    const td = cell && this.grid.getCell(cell[0], cell[1], true);
    const box = td ? td.getBoundingClientRect() : this.hot.rootElement.getBoundingClientRect();
    const below = box.bottom + 4;
    const top = below + element.offsetHeight > window.innerHeight ? box.top - element.offsetHeight - 4 : below;

    element.style.top = `${Math.max(0, top) + window.scrollY}px`;
    element.style.left = `${Math.max(0, Math.min(box.left, document.documentElement.clientWidth - element.offsetWidth -
      4)) + window.scrollX}px`;
  }

  close(): void {
    this.element?.remove();
    this.element = null;
  }
}

// Not in the default menu: add the key 'link' to `contextMenu`.
addItem('link', (): MenuItem => ({
  key: 'link',
  name(this: PluginHost) {
    const plugin = this.getPlugin('hyperlinks') as unknown as Hyperlinks | undefined;

    return String(this.getTranslatedPhrase(plugin?.selectedLink() ? C.LINK_EDIT : C.LINK_INSERT));
  },
  shortcut: 'Ctrl+K',
  callback(this: PluginHost) {
    (this.getPlugin('hyperlinks') as unknown as Hyperlinks | undefined)?.edit();
  },
  disabled(this: PluginHost) {
    return !this.getSelectedLast() || !this.getPlugin('hyperlinks')?.enabled;
  },
}));

registerPlugin('hyperlinks', Hyperlinks);

export default Hyperlinks;
