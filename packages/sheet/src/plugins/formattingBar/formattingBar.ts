import './formattingBar.css';
import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { applyTheme } from './../../helpers/dom/theme';
import { selectionHasToggle, setCellStyle, toggleCellStyle, previewCellStyle, setCellBorders, setNumberFormat,
  copyCellFormats, pasteCellFormats, NUMBER_FORMATS, type StyleToggle, type BorderKind } from './../../formatting/formatting';
import { paletteFor } from './../contextMenu/predefinedItems/formatting';
import { align, getAlignmentClasses } from './../contextMenu/utils';
import { classNameIncludes } from './../../helpers/classNames';
import * as C from './../../i18n/constants';

/** The buttons of the bar, in order. */
export const FORMATTING_BAR_ITEMS = ['font_family', 'font_size', 'bold', 'italic', 'underline', 'strikethrough',
  'fill_color', 'text_color',
  'borders', 'alignment', 'number_format', 'format_painter', 'clear'] as const;

export type FormattingBarItem = typeof FORMATTING_BAR_ITEMS[number];

const DEFAULT_ITEMS: FormattingBarItem[] = ['font_family', 'font_size', 'bold', 'italic', 'underline', 'strikethrough',
  'fill_color', 'text_color', 'borders', 'alignment', 'number_format', 'format_painter', 'clear'];

/** The fonts of the font list (each shown in itself); `''` is the grid's own font. */
export const FONT_FAMILIES = ['', 'Arial', 'Calibri', 'Cambria', 'Courier New', 'Georgia', 'Roboto', 'Segoe UI',
  'Tahoma', 'Times New Roman', 'Verdana'];

/** The sizes of the font size list, in points. */
export const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 36, 48, 72];

/** The commands of the Borders list. */
const BORDER_KINDS: [BorderKind, string][] = [['bottom', C.FORMAT_BORDER_BOTTOM], ['top', C.FORMAT_BORDER_TOP],
  ['left', C.FORMAT_BORDER_LEFT], ['right', C.FORMAT_BORDER_RIGHT], ['all', C.FORMAT_BORDER_ALL],
  ['outside', C.FORMAT_BORDER_OUTSIDE], ['thick_outside', C.FORMAT_BORDER_THICK_OUTSIDE], ['none', C.FORMAT_BORDER_NONE]];

/** The lines each border kind draws, in a 16 × 16 icon (a faint grid under them shows the cells). */
const BORDER_LINES: Record<BorderKind, string> = {
  bottom: 'M2 13.5h12',
  top: 'M2 2.5h12',
  left: 'M2.5 2v12',
  right: 'M13.5 2v12',
  all: 'M2.5 2.5h11v11h-11zM8 2.5v11M2.5 8h11',
  outside: 'M2.5 2.5h11v11h-11z',
  thick_outside: 'M3 3h10v10H3z',
  none: '',
};

/** The font size field is as wide as its value (`8`, `10.5`, `100`). */
const fitSizeField = (field: HTMLInputElement): void => {
  field.style.width = `calc(${Math.max(2, field.value.length)}ch + 12px)`;
};

/** A border kind's icon. */
export const borderIcon = (kind: BorderKind): string => '<svg viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M2.5 2.5h11v11h-11zM8 2.5v11M2.5 8h11" fill="none" stroke="currentColor" stroke-opacity="0.35" ' +
  'stroke-dasharray="1.5 1.5"/>' + (BORDER_LINES[kind] ? `<path d="${BORDER_LINES[kind]}" fill="none" ` +
  `stroke="currentColor" stroke-width="${kind === 'thick_outside' ? 2 : 1.4}"/>` : '') + '</svg>';

/** The number formats of the Number format list. */
const NUMBER_FORMAT_LABELS: Record<string, string> = { general: C.FORMAT_NUMBER_GENERAL,
  number: C.FORMAT_NUMBER_NUMBER, currency: C.FORMAT_NUMBER_CURRENCY, percent: C.FORMAT_NUMBER_PERCENT };

const ICONS: Record<string, string> = {
  bold: '<b>B</b>',
  italic: '<i>I</i>',
  underline: '<u>U</u>',
  strikethrough: '<s>S</s>',
  fill_color: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5 8 3.5l4.5 4.5L8 12.5z" fill="none" ' +
    'stroke="currentColor" stroke-width="1.3"/><path d="M13.5 10.5c0 1-.6 1.6-1.2 1.6s-1.2-.6-1.2-1.6l1.2-1.9z" ' +
    'fill="currentColor"/></svg>',
  text_color: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 12 8 3l3.5 9M5.8 9h4.4" fill="none" ' +
    'stroke="currentColor" stroke-width="1.4"/></svg>',
  left: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M2 7h8M2 10h12M2 13h8" stroke="currentColor"/></svg>',
  center: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M4 7h8M2 10h12M4 13h8" stroke="currentColor"/></svg>',
  right: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 4h12M6 7h8M2 10h12M6 13h8" stroke="currentColor"/></svg>',
  clear: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 13h8M3.5 9.5 9 4l3.5 3.5L7 13H5z" fill="none" ' +
    'stroke="currentColor" stroke-width="1.3"/></svg>',
  borders: borderIcon('bottom'),
  number_format: '<span class="fs-formatting-bar__text">123</span>',
  format_painter: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h9v3.5H3zM12 4h1.5v3.5H8v2M7 9.5h2v5H7z" ' +
    'fill="none" stroke="currentColor" stroke-width="1.2"/></svg>',
};

const LABELS: Record<string, string> = {
  bold: C.CONTEXTMENU_ITEMS_FORMAT_BOLD,
  italic: C.CONTEXTMENU_ITEMS_FORMAT_ITALIC,
  underline: C.CONTEXTMENU_ITEMS_FORMAT_UNDERLINE,
  strikethrough: C.CONTEXTMENU_ITEMS_FORMAT_STRIKETHROUGH,
  fill_color: C.CONTEXTMENU_ITEMS_FORMAT_FILL_COLOR,
  text_color: C.CONTEXTMENU_ITEMS_FORMAT_TEXT_COLOR,
  left: C.CONTEXTMENU_ITEMS_ALIGNMENT_LEFT,
  center: C.CONTEXTMENU_ITEMS_ALIGNMENT_CENTER,
  right: C.CONTEXTMENU_ITEMS_ALIGNMENT_RIGHT,
  clear: C.CONTEXTMENU_ITEMS_FORMAT_CLEAR,
  borders: C.FORMAT_BORDERS,
  font_family: C.FORMAT_FONT,
  font_size: C.FORMAT_FONT_SIZE,
  number_format: C.FORMAT_NUMBER,
  format_painter: C.FORMAT_PAINTER,
};

type FormattingGrid = Parameters<typeof setCellStyle>[0];

/**
 * The formatting bar: a small toolbar that opens above the context menu, as in Excel, with bold, italic, underline,
 * fill and text colors (a palette that shows a color on the cells while the pointer is on it), alignment and clear
 * formatting. It closes with the menu.
 *
 * ```js
 * new FreeSheet(container, { data, contextMenu: true, formattingBar: true });
 * // or choose the buttons:
 * new FreeSheet(container, { data, contextMenu: true, formattingBar: { items: ['bold', 'italic', 'fill_color'] } });
 * ```
 */
class FormattingBar extends BasePlugin {
  /** The bar's element, while it is open. */
  element: HTMLDivElement | null = null;
  /** The color the fill and text color buttons set (the last one chosen). */
  #colors = { fill_color: '#ffff00', text_color: '#ff0000' };
  /** The border the Borders button draws (the last one chosen). */
  #border: BorderKind = 'bottom';
  #palette: HTMLElement | null = null;
  /** The formats the format painter copied, until it gives them to the next selection. */
  painterFormats: Record<string, unknown>[][] | null = null;
  /** Escape closes the palette, then the menu. */
  #onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.#palette) {
      event.stopPropagation();
      event.preventDefault();
      this.closePalette();
    }
  };
  /** Escape puts the format painter away. */
  #onPainterKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape' && this.painterFormats) {
      this.stopPainter();
    }
  };

  isEnabled(): boolean {
    return !!this.hot.getSettings().formattingBar;
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    // The menu takes its place after it opens.
    this.addHook('afterContextMenuShow', () => Promise.resolve().then(() => this.open()));
    this.addHook('afterContextMenuHide', () => this.close());
    // The format painter gives its formats to the next cells the user selects.
    this.addHook('afterSelectionEnd', () => {
      if (this.painterFormats && !this.element) {
        pasteCellFormats(this.hot as unknown as Parameters<typeof pasteCellFormats>[0], this.painterFormats);
        this.stopPainter();
      }
    });
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.close();
    this.stopPainter();
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

  /** The buttons the `formattingBar` setting asks for. */
  getItems(): FormattingBarItem[] {
    const setting = this.hot.getSettings().formattingBar as boolean | { items?: FormattingBarItem[] };
    const items = typeof setting === 'object' && Array.isArray(setting.items) ? setting.items : DEFAULT_ITEMS;

    return items.filter(item => FORMATTING_BAR_ITEMS.includes(item));
  }

  /** Opens the bar above the open context menu (below it when there is no room above). */
  open(): void {
    const menu = this.hot.getPlugin('contextMenu')?.menu as { container?: HTMLElement; isOpened(): boolean } | undefined;

    if (!this.enabled || !menu?.container || !menu.isOpened()) {
      return;
    }
    this.close();
    const bar = this.createElement();
    const menuBox = menu.container.getBoundingClientRect();

    document.body.appendChild(bar);
    applyTheme(bar, this.hot.rootElement);
    const above = menuBox.top - bar.offsetHeight - 6;

    bar.style.top = `${(above >= 0 ? above : menuBox.bottom + 6) + window.scrollY}px`;
    // Inside the window, as the menu is.
    const left = Math.max(0, Math.min(menuBox.left, document.documentElement.clientWidth - bar.offsetWidth - 4));

    bar.style.left = `${left + window.scrollX}px`;
    this.element = bar;
    this.showBorder();
    document.addEventListener('keydown', this.#onKeyDown, true);
    this.refresh();
  }

  /** Closes the bar (and its palette, putting back the cells a palette was showing a color on). */
  close(): void {
    this.closePalette();
    this.element?.remove();
    this.element = null;
    document.removeEventListener('keydown', this.#onKeyDown, true);
  }

  /** Marks the buttons whose formatting every selected cell has. */
  refresh(): void {
    const grid = this.hot as unknown as FormattingGrid;
    const [row, col] = this.hot.getSelectedLast() || [0, 0];
    const className = String(this.hot.getCellMeta(row, col).className || '');

    this.element?.querySelectorAll<HTMLButtonElement>('[data-action]').forEach((button) => {
      const action = button.dataset.action!;
      let pressed: boolean | null = null;

      if (['bold', 'italic', 'underline', 'strikethrough'].includes(action)) {
        pressed = selectionHasToggle(grid, action as StyleToggle);
      } else if (['left', 'center', 'right'].includes(action)) {
        pressed = classNameIncludes(className, `fs-${action}`);
      } else if (action === 'format_painter') {
        pressed = !!this.painterFormats;
      }
      if (pressed !== null) {
        button.setAttribute('aria-pressed', String(pressed));
      }
    });
    const style = (this.hot.getCellMeta(row, col).style || {}) as { fontFamily?: string; fontSize?: string };
    const label = this.element?.querySelector<HTMLElement>('[data-font-label]');
    const size = this.element?.querySelector<HTMLInputElement>('[data-font-size]');

    if (label) {
      label.textContent = style.fontFamily || String(this.hot.getTranslatedPhrase(C.FORMAT_FONT_DEFAULT));
    }
    if (size && document.activeElement !== size) {
      const cell = this.hot.getCell(row, col, true) as HTMLElement | null;
      const pixels = cell ? parseFloat(getComputedStyle(cell).fontSize) : NaN;

      size.value = /pt$/.test(style.fontSize || '') ? String(parseFloat(style.fontSize!)) :
        Number.isFinite(pixels) ? String(Math.round(pixels * 0.75 * 2) / 2) : '';
      fitSizeField(size);
    }
    this.element?.querySelectorAll<HTMLElement>('[data-color-of]').forEach((line) => {
      line.style.background = this.#colors[line.dataset.colorOf as 'fill_color' | 'text_color'];
    });
  }

  createElement(): HTMLDivElement {
    const bar = document.createElement('div');
    const phrase = (key: string) => this.hot.getTranslatedPhrase(key) as string;
    const button = (action: string, extra = '') => `<button type="button" class="fs-formatting-bar__button" ` +
      `data-action="${action}" title="${phrase(LABELS[action])}" aria-label="${phrase(LABELS[action])}">` +
      `${ICONS[action]}${extra}</button>`;

    bar.className = 'fs-formatting-bar';
    bar.setAttribute('role', 'toolbar');
    bar.setAttribute('aria-label', phrase(C.FORMATTING_BAR));
    bar.innerHTML = this.getItems().map((item) => {
      if (item === 'fill_color' || item === 'text_color') {
        return `<span class="fs-formatting-bar__split">${button(item,
          `<span class="fs-formatting-bar__color" data-color-of="${item}"></span>`)}` +
          `<button type="button" class="fs-formatting-bar__arrow" data-palette="${item}" aria-haspopup="true" ` +
          `aria-label="${phrase(LABELS[item])}…"></button></span>`;
      }
      if (item === 'font_family') {
        return `<span class="fs-formatting-bar__group"><button type="button" class="fs-formatting-bar__button ` +
          `fs-formatting-bar__dropdown fs-formatting-bar__font" data-palette="font_family" aria-haspopup="true" ` +
          `title="${phrase(LABELS[item])}" aria-label="${phrase(LABELS[item])}"><span data-font-label></span></button>`;
      }
      if (item === 'font_size') {
        return `<span class="fs-formatting-bar__size"><input type="text" inputmode="decimal" data-font-size ` +
          `aria-label="${phrase(LABELS[item])}" title="${phrase(LABELS[item])}"><button type="button" ` +
          `class="fs-formatting-bar__arrow" data-palette="font_size" aria-haspopup="true" aria-label="${
            phrase(LABELS[item])}…"></button></span>`;
      }
      if (item === 'borders') {
        return `<span class="fs-formatting-bar__split">${button(item)}<button type="button" ` +
          `class="fs-formatting-bar__arrow" data-palette="borders" aria-haspopup="true" ` +
          `aria-label="${phrase(LABELS[item])}…"></button></span>`;
      }
      if (item === 'number_format') {
        return `<span class="fs-formatting-bar__group"><button type="button" class="fs-formatting-bar__button ` +
          `fs-formatting-bar__dropdown" data-palette="number_format" aria-haspopup="true" title="${
            phrase(LABELS[item])}" aria-label="${phrase(LABELS[item])}">${ICONS[item]}</button></span>`;
      }
      if (item === 'alignment') {
        return `<span class="fs-formatting-bar__group">${['left', 'center', 'right'].map(a => button(a)).join('')}</span>`;
      }

      return button(item);
    }).join('');

    // Mouse down, so the menu (which closes on mouse down outside it) and the grid's selection stay.
    bar.addEventListener('mousedown', (event) => {
      event.stopPropagation();
      // The size field takes the focus and the caret; nothing else does.
      if ((event.target as HTMLElement).matches('input')) {
        return;
      }
      event.preventDefault();
      const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action], [data-palette]');

      if (['borders', 'number_format', 'font_family', 'font_size'].includes(target?.dataset.palette || '')) {
        this.toggleList(target!.dataset.palette as Parameters<FormattingBar['toggleList']>[0], target!);
      } else if (target?.dataset.palette) {
        this.togglePalette(target.dataset.palette as 'fill_color' | 'text_color', target);
      } else if (target?.dataset.action) {
        this.closePalette();
        this.run(target.dataset.action);
      }
    });

    const size = bar.querySelector<HTMLInputElement>('[data-font-size]');

    size?.addEventListener('keydown', (event) => {
      event.stopPropagation();
      if (event.key === 'Enter') {
        event.preventDefault();
        this.setFontSize(size.value);
      } else if (event.key === 'Escape') {
        this.refresh();
        size.blur();
      }
    });
    size?.addEventListener('focus', () => this.hot.unlisten());
    size?.addEventListener('input', () => fitSizeField(size));

    return bar;
  }

  /**
   * The borders button draws the border kind it applies: the last one chosen.
   *
   * @private
   */
  showBorder(): void {
    const button = this.element?.querySelector<HTMLElement>('[data-action="borders"]');

    if (button) {
      button.innerHTML = borderIcon(this.#border);
      button.dataset.border = this.#border;
    }
  }

  /**
   * Gives the selected cells a font size in points (an empty field: the grid's own size).
   *
   * @private
   */
  setFontSize(text: string): void {
    const points = Number(String(text).replace(',', '.'));

    if (String(text).trim() === '') {
      setCellStyle(this.hot as unknown as FormattingGrid, { fontSize: null });
    } else if (Number.isFinite(points) && points >= 1 && points <= 409) {
      setCellStyle(this.hot as unknown as FormattingGrid, { fontSize: `${points}pt` });
    }
    this.refresh();
  }

  /**
   * Runs a button's command on the selected cells.
   *
   * @private
   */
  run(action: string): void {
    const grid = this.hot as unknown as FormattingGrid;

    if (['bold', 'italic', 'underline', 'strikethrough'].includes(action)) {
      toggleCellStyle(grid, action as StyleToggle);
    } else if (action === 'fill_color') {
      setCellStyle(grid, { background: this.#colors.fill_color });
    } else if (action === 'text_color') {
      setCellStyle(grid, { color: this.#colors.text_color });
    } else if (action === 'clear') {
      setCellStyle(grid, null);
    } else if (action === 'borders') {
      setCellBorders(grid, this.#border);
    } else if (action === 'format_painter') {
      this.startPainter();
    } else if (['left', 'center', 'right'].includes(action)) {
      const ranges = this.hot.getSelectedRange();

      if (ranges) {
        const stateBefore = getAlignmentClasses(ranges, (row: number, col: number) => this.hot.getCellMeta(row, col)
          .className);

        this.hot.runHooks('beforeCellAlignment', stateBefore, ranges, 'horizontal', `fs-${action}`);
        align(ranges, 'horizontal', `fs-${action}`, (row: number, col: number) => this.hot.getCellMeta(row, col),
          (row: number, col: number, key: string, value: unknown) => this.hot.setCellMeta(row, col, key, value));
        this.hot.render();
      }
    }
    this.refresh();
  }

  /**
   * Opens (or closes) the palette of the fill or text color button under it.
   *
   * @private
   */
  togglePalette(item: 'fill_color' | 'text_color', anchor: HTMLElement): void {
    const wasOpen = this.#palette?.dataset.item === item;

    this.closePalette();
    if (wasOpen || !this.element) {
      return;
    }
    const property = item === 'fill_color' ? 'background' : 'color';
    const palette = paletteFor(this.hot, property, () => {
      this.closePalette();
      this.refresh();
    });

    // The chosen color becomes the button's color.
    palette.addEventListener('mousedown', (event) => {
      const color = (event.target as HTMLElement).closest<HTMLElement>('[data-color]')?.dataset.color;

      if (color) {
        this.#colors[item] = color;
      }
    }, true);
    palette.dataset.item = item;
    palette.classList.add('fs-formatting-bar__palette');
    this.element.appendChild(palette);
    this.placePopup(palette, anchor.offsetLeft - 24);
    anchor.setAttribute('aria-expanded', 'true');
    this.#palette = palette;
  }

  /**
   * Places a palette or a list under its button, inside the window.
   *
   * @private
   */
  placePopup(popup: HTMLElement, left: number): void {
    popup.style.left = `${left}px`;
    const overflow = popup.getBoundingClientRect().right - document.documentElement.clientWidth + 4;

    if (overflow > 0) {
      popup.style.left = `${left - overflow}px`;
    }
  }

  /**
   * Opens (or closes) the list of the Borders arrow or of the Number format button.
   *
   * @private
   */
  toggleList(item: 'borders' | 'number_format' | 'font_family' | 'font_size', anchor: HTMLElement): void {
    const wasOpen = this.#palette?.dataset.item === item;

    this.closePalette();
    if (wasOpen || !this.element) {
      return;
    }
    const list = document.createElement('div');
    const phrase = (key: string) => this.hot.getTranslatedPhrase(key) as string;
    let entries: [string, string][];

    if (item === 'borders') {
      entries = BORDER_KINDS;
    } else if (item === 'number_format') {
      entries = Object.keys(NUMBER_FORMATS).map(name => [name, NUMBER_FORMAT_LABELS[name]]);
    } else if (item === 'font_family') {
      entries = FONT_FAMILIES.map(font => [font, font || C.FORMAT_FONT_DEFAULT]);
    } else {
      entries = FONT_SIZES.map(points => [String(points), String(points)]);
    }

    list.className = 'fs-formatting-bar__palette fs-formatting-bar__list';
    list.dataset.item = item;
    list.setAttribute('role', 'menu');
    entries.forEach(([value, label]) => {
      const entry = document.createElement('button');

      entry.type = 'button';
      entry.setAttribute('role', 'menuitem');
      entry.dataset.value = value;
      entry.textContent = item === 'font_size' || (item === 'font_family' && value) ? label : phrase(label);
      // Each border kind shows the lines it draws.
      if (item === 'borders') {
        entry.insertAdjacentHTML('afterbegin', borderIcon(value as BorderKind));
      }
      // Each font is shown in itself.
      if (item === 'font_family' && value) {
        entry.style.fontFamily = value;
      }
      list.appendChild(entry);
    });
    list.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const value = (event.target as HTMLElement).closest<HTMLElement>('[data-value]')?.dataset.value;

      // '' is a value (the grid's own font).

      if (value === void 0) {
        return;
      }
      if (item === 'font_family') {
        setCellStyle(this.hot as unknown as FormattingGrid, { fontFamily: value || null });
      } else if (item === 'font_size') {
        this.setFontSize(value);
      } else if (item === 'borders') {
        this.#border = value as BorderKind;
        setCellBorders(this.hot as unknown as FormattingGrid, this.#border);
        this.showBorder();
      } else {
        setNumberFormat(this.hot as unknown as Parameters<typeof setNumberFormat>[0], NUMBER_FORMATS[value]);
      }
      this.closePalette();
      this.refresh();
    });
    this.element.appendChild(list);
    this.placePopup(list, anchor.offsetLeft);
    anchor.setAttribute('aria-expanded', 'true');
    this.#palette = list;
  }

  /**
   * The format painter: copies the formats of the selected cells (style, alignment, number format), closes the menu,
   * and gives them to the next cells the user selects. Escape puts it away.
   *
   * @private
   */
  startPainter(): void {
    this.painterFormats = copyCellFormats(this.hot as unknown as FormattingGrid);
    this.hot.rootElement.classList.add('fs-format-painting');
    document.addEventListener('keydown', this.#onPainterKeyDown, true);
    this.hot.getPlugin('contextMenu')?.close();
  }

  stopPainter(): void {
    this.painterFormats = null;
    this.hot.rootElement?.classList.remove('fs-format-painting');
    document.removeEventListener('keydown', this.#onPainterKeyDown, true);
  }

  closePalette(): void {
    if (this.#palette) {
      this.#palette.remove();
      this.#palette = null;
      this.element?.querySelectorAll('[aria-expanded]').forEach(arrow => arrow.removeAttribute('aria-expanded'));
      previewCellStyle(this.hot as unknown as FormattingGrid, void 0);
    }
  }
}

registerPlugin('formattingBar', FormattingBar);

export default FormattingBar;
