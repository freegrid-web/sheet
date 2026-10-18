import { toLegacyClassName } from './../../helpers/classNames';
import Core from './../../core';
import {
  addClass,
  empty,
  fastInnerHTML,
  getScrollbarWidth,
  isChildOf,
  removeClass,
} from './../../helpers/dom/element';
import Cursor from './cursor';
import type { CursorSource } from './cursor';
import EventManager from './../../eventManager';
import { applyTheme, getRowHeight } from './../../helpers/dom/theme';
import { formatShortcut } from './icons';
import { mixin, hasOwnProperty } from './../../helpers/object';
import { isUndefined, isDefined } from './../../helpers/mixed';
import { debounce, isFunction } from './../../helpers/function';
import { filterSeparators, hasSubMenu, isDisabled, isItemHidden, isSeparator, isSelectionDisabled, normalizeSelection } from './utils';
import { KEY_CODES } from './../../helpers/unicode';
import localHooks from './../../mixins/localHooks';
import type { LocalHooks } from './../../mixins/localHooks';
import type { MenuItem } from './menuItem';
import type { PluginHost } from './../_base';
import { SEPARATOR } from './predefinedItems';
import { stopImmediatePropagation } from './../../helpers/dom/event';

const MIN_WIDTH = 215;

/** A menu's options. */
export type MenuOptions = {
  parent?: Menu | null;
  name?: string | ((this: PluginHost) => unknown) | null;
  className?: string;
  keepInViewport?: boolean;
  standalone?: boolean;
  minWidth?: number;
};

/** The menu's own grid (the list of items). */
type MenuGrid = Core;

/**
 * @class Menu
 * @plugin ContextMenu
 */
class Menu {
  // From the localHooks mixin (on the prototype): `declare` keeps class fields from hiding them.
  declare addLocalHook: LocalHooks['addLocalHook'];

  declare runLocalHooks: LocalHooks['runLocalHooks'];

  declare clearLocalHooks: LocalHooks['clearLocalHooks'];

  /** The grid the menu belongs to. */
  hot: PluginHost;

  options: MenuOptions;

  eventManager: EventManager;

  /** The menu's element (in `<body>`). */
  container: HTMLElement;

  /** The menu's grid, while it is open. */
  hotMenu: MenuGrid | null = null;

  /** The open submenus, by item key. */
  hotSubMenus: Record<string, Menu> = {};

  parentMenu: Menu | null;

  menuItems: MenuItem[] | null = null;

  /** The grid's `outsideClickDeselects` while the menu is closed. */
  origOutsideClickDeselects: unknown = null;

  /** Whether a key press is being handled. */
  keyEvent = false;

  /** Offsets of the menu's position, per side. */
  offset: Record<'above' | 'below' | 'left' | 'right', number> = { above: 0, below: 0, left: 0, right: 0 };

  _afterScrollCallback: (() => void) | null = null;

  constructor(hotInstance: PluginHost, options?: MenuOptions) {
    this.hot = hotInstance;
    this.options = options || {
      parent: null,
      name: null,
      className: '',
      keepInViewport: true,
      standalone: false,
      minWidth: MIN_WIDTH,
    };
    this.eventManager = new EventManager(this);
    this.container = this.createContainer(this.options.name);
    this.parentMenu = this.options.parent || null;

    this.registerEvents();
  }

  /**
   * Register event listeners.
   *
   * @private
   */
  registerEvents(): void {
    this.eventManager.addEventListener(document.documentElement, 'mousedown', (event: MouseEvent) => this.onDocumentMouseDown(event));
  }

  /**
   * Set array of objects which defines menu items.
   *
   * @param menuItems Menu items to display.
   */
  setMenuItems(menuItems: MenuItem[]): void {
    this.menuItems = menuItems;
  }

  /**
   * Set offset menu position for specified area (`above`, `below`, `left` or `right`).
   *
   * @param area Specified area name (`above`, `below`, `left` or `right`).
   * @param offset Offset value.
   */
  setOffset(area: keyof Menu['offset'], offset = 0): void {
    this.offset[area] = offset;
  }

  /**
   * Check if menu is using as sub-menu.
   *
   */
  isSubMenu(): boolean {
    return this.parentMenu !== null;
  }

  /** The menu this menu opened from (through its submenus), or this menu. */
  getRootMenu(): Menu {
    return this.parentMenu ? this.parentMenu.getRootMenu() : this;
  }

  /**
   * Open menu.
   *
   * @fires Hooks#beforeContextMenuShow
   * @fires Hooks#afterContextMenuShow
   */
  open(): void {
    // Submenu `items` come straight from the settings and may be an object; such a submenu stays empty.
    const filteredItems = filterSeparators(Array.from(this.menuItems!).filter(item => isItemHidden(item, this.hot)),
      SEPARATOR);

    // Nothing to show (e.g. `contextMenu: []`): the menu stays closed instead of opening an empty box.
    if (filteredItems.length === 0) {
      return;
    }

    this.runLocalHooks('beforeOpen');

    this.container.removeAttribute('style');
    this.container.style.display = 'block';
    applyTheme(this.container, this.hot.rootElement);

    const delayedOpenSubMenu = debounce((row: number) => this.openSubMenu(row), 300);
    const minWidthOfMenu = this.options.minWidth || MIN_WIDTH;

    const settings = {
      data: filteredItems,
      colHeaders: false,
      autoColumnSize: true,
      modifyColWidth(width?: number) {
        if (isDefined(width) && width < minWidthOfMenu) {
          return minWidthOfMenu;
        }

        return width;
      },
      autoRowSize: false,
      readOnly: true,
      copyPaste: false,
      columns: [{
        data: 'name',
        renderer: (...args: Parameters<Menu['menuItemRenderer']>) => this.menuItemRenderer(...args),
      }],
      renderAllRows: true,
      fragmentSelection: 'cell',
      disableVisualSelection: 'area',
      beforeKeyDown: (event: KeyboardEvent) => this.onBeforeKeyDown(event),
      afterOnCellMouseOver: (event: MouseEvent, coords: { row: number }) => {
        if (this.isAllSubMenusClosed()) {
          delayedOpenSubMenu(coords.row);
        } else {
          this.openSubMenu(coords.row);
        }
      },
      rowHeights: (row: number) => (filteredItems[row].name === SEPARATOR ? 1 : getRowHeight(this.container)),
    };
    this.origOutsideClickDeselects = this.hot.getSettings().outsideClickDeselects;
    this.hot.getSettings().outsideClickDeselects = false;
    this.hotMenu = new Core(this.container, settings);
    this.hotMenu!.addHook('afterInit', () => this.onAfterInit());
    this.hotMenu!.addHook('afterSelection', (...args: Parameters<Menu['onAfterSelection']>) => this.onAfterSelection(...args));
    this.hotMenu!.init();
    this.hotMenu!.listen();
    this.blockMainTableCallbacks();
    this.runLocalHooks('afterOpen');
  }

  /**
   * Close menu.
   *
   * @param [closeParent=false] if `true` try to close parent menu if exists.
   */
  close(closeParent = false): void {
    if (!this.isOpened()) {
      return;
    }
    if (closeParent && this.parentMenu) {
      this.parentMenu.close(true);
    } else {
      this.closeAllSubMenus();
      this.container.style.display = 'none';
      this.releaseMainTableCallbacks();
      this.hotMenu!.destroy();
      this.hotMenu = null;
      this.hot.getSettings().outsideClickDeselects = this.origOutsideClickDeselects;
      this.runLocalHooks('afterClose');

      if (this.parentMenu) {
        this.parentMenu.hotMenu!.listen();
      }
    }
  }

  /**
   * Open sub menu at the provided row index.
   *
   * @param row Row index.
   * @returns Returns created menu or `false` if no one menu was created.
   */
  openSubMenu(row: number): Menu | false {
    if (!this.hotMenu) {
      return false;
    }
    const cell = this.hotMenu!.getCell(row, 0);

    this.closeAllSubMenus();

    if (!cell || !hasSubMenu(cell)) {
      return false;
    }
    const dataItem = this.hotMenu!.getSourceDataAtRow(row);
    const subMenu = new Menu(this.hot, {
      parent: this,
      name: dataItem.name,
      className: this.options.className,
      keepInViewport: true
    });
    subMenu.setMenuItems(dataItem.submenu.items);
    subMenu.open();
    subMenu.setPosition(cell.getBoundingClientRect());
    this.hotSubMenus[dataItem.key] = subMenu;

    return subMenu;
  }

  /**
   * Close sub menu at row index.
   *
   * @param row Row index.
   */
  closeSubMenu(row: number): void {
    const dataItem = this.hotMenu!.getSourceDataAtRow(row);
    const menus = this.hotSubMenus[dataItem.key];

    if (menus) {
      menus.destroy();
      delete this.hotSubMenus[dataItem.key];
    }
  }

  /**
   * Close all opened sub menus.
   */
  closeAllSubMenus(): void {
    this.hotMenu!.getData().forEach((value: unknown, row: number) => this.closeSubMenu(row));
  }

  /**
   * Checks if all created and opened sub menus are closed.
   *
   */
  isAllSubMenusClosed(): boolean {
    return Object.keys(this.hotSubMenus).length === 0;
  }

  /**
   * Destroy instance.
   */
  destroy(): void {
    this.clearLocalHooks();
    this.close();
    this.parentMenu = null;
    this.eventManager.destroy();
  }

  /**
   * Checks if menu was opened.
   *
   * @returns Returns `true` if menu was opened.
   */
  isOpened(): boolean {
    return this.hotMenu !== null;
  }

  /**
   * Execute menu command.
   *
   * @param [event]
   */
  executeCommand(event?: Event): void {
    if (!this.isOpened() || !this.hotMenu!.getSelectedLast()) {
      return;
    }
    const selectedItem: MenuItem = this.hotMenu!.getSourceDataAtRow(this.hotMenu!.getSelectedLast()![0]);

    this.runLocalHooks('select', selectedItem, event);

    if (selectedItem.isCommand === false || selectedItem.name === SEPARATOR) {
      return;
    }
    const selRanges = this.hot.getSelectedRange();
    const normalizedSelection = selRanges ? normalizeSelection(selRanges) : [];
    let autoClose = true;

    // Don't close context menu if item is disabled or it has submenu
    if (selectedItem.disabled === true ||
        (typeof selectedItem.disabled === 'function' && selectedItem.disabled.call(this.hot) === true) ||
        selectedItem.submenu) {
      autoClose = false;
    }

    this.runLocalHooks('executeCommand', selectedItem.key, normalizedSelection, event);

    // The root menu runs the command, also from a submenu inside a submenu.
    if (this.isSubMenu()) {
      this.getRootMenu().runLocalHooks('executeCommand', selectedItem.key, normalizedSelection, event);
    }

    if (autoClose) {
      this.close(true);
    }
  }

  /**
   * Set menu position based on dom event or based on literal object.
   *
   * @param coords Event or literal Object with coordinates.
   */
  setPosition(coords: CursorSource | DOMRect): void {
    const cursor = new Cursor(coords as CursorSource);

    this.container.style.maxHeight = '';
    this.container.style.overflowY = '';
    if (this.options.keepInViewport) {
      if (cursor.fitsBelow(this.container)) {
        this.setPositionBelowCursor(cursor);

      } else if (cursor.fitsAbove(this.container)) {
        this.setPositionAboveCursor(cursor);

      } else {
        this.setPositionInViewport(cursor);
      }
      if (cursor.fitsOnRight(this.container)) {
        this.setPositionOnRightOfCursor(cursor);
      } else {
        this.setPositionOnLeftOfCursor(cursor);
      }
    } else {
      this.setPositionBelowCursor(cursor);
      this.setPositionOnRightOfCursor(cursor);
    }
  }

  /**
   * Places a menu that fits neither below nor above the cursor as low as the window allows; a menu taller than the
   * window gets the window's height and scrolls inside.
   */
  setPositionInViewport(cursor: Cursor): void {
    const margin = 4;
    const available = window.innerHeight - 2 * margin;

    if (this.container.offsetHeight > available) {
      this.container.style.maxHeight = `${available}px`;
      this.container.style.overflowY = 'auto';
    }
    const scrollTop = cursor.top - cursor.topRelative;

    this.container.style.top = `${scrollTop + Math.max(margin, window.innerHeight - margin - this.container.offsetHeight)}px`;
  }

  /**
   * Set menu position above cursor object.
   *
   * @param cursor `Cursor` object.
   */
  setPositionAboveCursor(cursor: Cursor): void {
    let top = this.offset.above + cursor.top - this.container.offsetHeight;

    if (this.isSubMenu()) {
      top = cursor.top + cursor.cellHeight - this.container.offsetHeight + 3;
    }
    this.container.style.top = `${top}px`;
  }

  /**
   * Set menu position below cursor object.
   *
   * @param cursor `Cursor` object.
   */
  setPositionBelowCursor(cursor: Cursor): void {
    let top = this.offset.below + cursor.top;

    if (this.isSubMenu()) {
      top = cursor.top - 1;
    }
    this.container.style.top = `${top}px`;
  }

  /**
   * Set menu position on the right of cursor object.
   *
   * @param cursor `Cursor` object.
   */
  setPositionOnRightOfCursor(cursor: Cursor): void {
    let left: number;

    if (this.isSubMenu()) {
      left = 1 + cursor.left + cursor.cellWidth;
    } else {
      left = this.offset.right + 1 + cursor.left;
    }

    this.container.style.left = `${left}px`;
  }

  /**
   * Set menu position on the left of cursor object.
   *
   * @param cursor `Cursor` object.
   */
  setPositionOnLeftOfCursor(cursor: Cursor): void {
    const left = this.offset.left + cursor.left - this.container.offsetWidth + getScrollbarWidth() + 4;

    this.container.style.left = `${left}px`;
  }

  /**
   * Select first cell in opened menu.
   */
  selectFirstCell(): void {
    const cell = this.hotMenu!.getCell(0, 0)!;

    if (isSeparator(cell) || isDisabled(cell) || isSelectionDisabled(cell)) {
      this.selectNextCell(0, 0);
    } else {
      this.hotMenu!.selectCell(0, 0);
    }
  }

  /**
   * Select last cell in opened menu.
   */
  selectLastCell(): void {
    const lastRow = this.hotMenu!.countRows() - 1;
    const cell = this.hotMenu!.getCell(lastRow, 0)!;

    if (isSeparator(cell) || isDisabled(cell) || isSelectionDisabled(cell)) {
      this.selectPrevCell(lastRow, 0);
    } else {
      this.hotMenu!.selectCell(lastRow, 0);
    }
  }

  /**
   * Select next cell in opened menu.
   *
   * @param row Row index.
   * @param col Column index.
   */
  selectNextCell(row: number, col: number): void {
    const nextRow = row + 1;
    const cell = nextRow < this.hotMenu!.countRows() ? this.hotMenu!.getCell(nextRow, col) : null;

    if (!cell) {
      return;
    }
    if (isSeparator(cell) || isDisabled(cell) || isSelectionDisabled(cell)) {
      this.selectNextCell(nextRow, col);
    } else {
      this.hotMenu!.selectCell(nextRow, col);
    }
  }

  /**
   * Select previous cell in opened menu.
   *
   * @param row Row index.
   * @param col Column index.
   */
  selectPrevCell(row: number, col: number): void {
    const prevRow = row - 1;
    const cell = prevRow >= 0 ? this.hotMenu!.getCell(prevRow, col) : null;

    if (!cell) {
      return;
    }
    if (isSeparator(cell) || isDisabled(cell) || isSelectionDisabled(cell)) {
      this.selectPrevCell(prevRow, col);
    } else {
      this.hotMenu!.selectCell(prevRow, col);
    }
  }

  /**
   * Menu item renderer.
   *
   * @private
   */
  menuItemRenderer(hot: MenuGrid, TD: HTMLTableCellElement, row: number, col: number, prop: string | number,
    value: unknown): void {
    const item: MenuItem = hot.getSourceDataAtRow(row);
    const wrapper = document.createElement('div');

    const isSubMenu = (itemToTest: MenuItem) => hasOwnProperty(itemToTest, 'submenu');
    const itemIsSeparator = (itemToTest: MenuItem) => new RegExp(SEPARATOR, 'i').test(itemToTest.name as string);
    const itemIsDisabled = (itemToTest: MenuItem) => itemToTest.disabled === true ||
      (typeof itemToTest.disabled === 'function' && itemToTest.disabled.call(this.hot) === true);
    const itemIsSelectionDisabled = (itemToTest: MenuItem) => itemToTest.disableSelection;
    let itemValue = value;

    if (typeof itemValue === 'function') {
      itemValue = itemValue.call(this.hot);
    }
    empty(TD);
    TD.removeAttribute('aria-keyshortcuts');
    addClass(wrapper, 'fs-item-wrapper');
    TD.appendChild(wrapper);

    if (itemIsSeparator(item)) {
      addClass(TD, 'fs-separator');

    } else if (typeof item.renderer === 'function') {
      addClass(TD, 'fs-custom-menu-renderer');
      TD.appendChild(item.renderer.call(this.hot, hot, wrapper, row, col, prop, itemValue));

    } else {
      // [icon] label [shortcut]: the label is the entry's name (HTML, like the ✓ of a checked entry).
      const icon = document.createElement('span');
      const label = document.createElement('span');

      icon.className = 'fs-menu-item__icon';
      label.className = 'fs-menu-item__label';
      if (typeof item.icon === 'string') {
        fastInnerHTML(icon, item.icon);
      }
      fastInnerHTML(label, itemValue as string);
      wrapper.append(icon, label);
      if (typeof item.shortcut === 'string' && item.shortcut) {
        const shortcut = document.createElement('span');

        // Drawn by CSS from the attribute: the entry's text stays its name.
        shortcut.className = 'fs-menu-item__shortcut';
        shortcut.dataset.shortcut = formatShortcut(item.shortcut);
        wrapper.appendChild(shortcut);
        TD.setAttribute('aria-keyshortcuts', item.shortcut.replace(/Ctrl/g, 'Control'));
      }
    }
    if (itemIsDisabled(item)) {
      addClass(TD, 'fs-disabled');
      this.eventManager.addEventListener(TD, 'mouseenter', () => hot.deselectCell());

    } else if (itemIsSelectionDisabled(item)) {
      addClass(TD, 'fs-selection-disabled');
      this.eventManager.addEventListener(TD, 'mouseenter', () => hot.deselectCell());

    } else if (isSubMenu(item)) {
      addClass(TD, 'fs-submenu');

      if (itemIsSelectionDisabled(item)) {
        this.eventManager.addEventListener(TD, 'mouseenter', () => hot.deselectCell());
      } else {
        this.eventManager.addEventListener(TD, 'mouseenter', () => hot.selectCell(row, col, undefined, undefined, false, false));
      }
    } else {
      removeClass(TD, 'fs-submenu');
      removeClass(TD, 'fs-disabled');

      if (itemIsSelectionDisabled(item)) {
        this.eventManager.addEventListener(TD, 'mouseenter', () => hot.deselectCell());
      } else {
        this.eventManager.addEventListener(TD, 'mouseenter', () => hot.selectCell(row, col, undefined, undefined, false, false));
      }
    }
  }

  /**
   * Create container/wrapper for handsontable.
   *
   * @private
   * @param [name] Class name.
   */
  createContainer(name: MenuOptions['name'] = null): HTMLElement {
    let className: unknown = name;
    let container: HTMLElement | null;

    if (className) {
      if (isFunction(className)) {
        className = (className as (this: PluginHost) => unknown).call(this.hot);

        if (className === null || isUndefined(className)) {
          className = '';

        } else {
          className = (className as object).toString();
        }
      }

      const name = (className as string).replace(/[^A-Za-z0-9]/g, '_');
      const baseClassName = this.options.className!;
      const legacyBaseClassName = toLegacyClassName(baseClassName);

      // e.g. fs-context-menu-sub_Alignment, plus the legacy htContextMenuSub_Alignment during 0.x
      className = `${baseClassName}-sub_${name}`;
      if (legacyBaseClassName !== baseClassName) {
        className += ` ${legacyBaseClassName}Sub_${name}`;
      }

      container = document.querySelector(`.${baseClassName}.${(className as string).split(' ')[0]}`);

    } else {
      container = document.querySelector(`.${this.options.className}`);
    }

    if (!container) {
      container = document.createElement('div');

      addClass(container, `fs-menu ${this.options.className}`);

      if (className) {
        addClass(container, className as string);
      }
      document.getElementsByTagName('body')[0].appendChild(container);
    }

    return container;
  }

  /**
   * @private
   */
  blockMainTableCallbacks(): void {
    this._afterScrollCallback = () => {};
    this.hot.addHook('afterScrollVertically', this._afterScrollCallback);
    this.hot.addHook('afterScrollHorizontally', this._afterScrollCallback);
  }

  /**
   * @private
   */
  releaseMainTableCallbacks(): void {
    if (this._afterScrollCallback) {
      this.hot.removeHook('afterScrollVertically', this._afterScrollCallback);
      this.hot.removeHook('afterScrollHorizontally', this._afterScrollCallback);
      this._afterScrollCallback = null;
    }
  }

  /**
   * On before key down listener.
   *
   * @private
   * @param event
   */
  onBeforeKeyDown(event: KeyboardEvent): void {
    const selection = this.hotMenu!.getSelectedLast();
    let stopEvent = false;
    this.keyEvent = true;

    switch (event.keyCode) {
      case KEY_CODES.ESCAPE:
        this.close();
        stopEvent = true;
        break;

      case KEY_CODES.ENTER:
        if (selection) {
          if (this.hotMenu!.getSourceDataAtRow(selection[0]).submenu) {
            stopEvent = true;
          } else {
            this.executeCommand(event);
            this.close(true);
          }
        }
        break;

      case KEY_CODES.ARROW_DOWN:
        if (selection) {
          this.selectNextCell(selection[0], selection[1]);
        } else {
          this.selectFirstCell();
        }
        stopEvent = true;
        break;

      case KEY_CODES.ARROW_UP:
        if (selection) {
          this.selectPrevCell(selection[0], selection[1]);
        } else {
          this.selectLastCell();
        }
        stopEvent = true;
        break;

      case KEY_CODES.ARROW_RIGHT:
        if (selection) {
          const menu = this.openSubMenu(selection[0]);

          if (menu) {
            menu.selectFirstCell();
          }
        }
        stopEvent = true;

        break;

      case KEY_CODES.ARROW_LEFT:
        if (selection && this.isSubMenu()) {
          this.close();

          if (this.parentMenu) {
            this.parentMenu.hotMenu!.listen();
          }
          stopEvent = true;
        }
        break;
      default:
        break;
    }
    if (stopEvent) {
      event.preventDefault();
      stopImmediatePropagation(event);
    }

    this.keyEvent = false;
  }

  /**
   * On after init listener.
   *
   * @private
   */
  onAfterInit(): void {
    const data: MenuItem[] = this.hotMenu!.getSettings().data;
    const hiderStyle = this.hotMenu!.view.wt.wtTable.hider.style;
    const holderStyle = this.hotMenu!.view.wt.wtTable.holder.style;
    const currentHiderWidth = parseInt(hiderStyle.width, 10);

    // At least the drawn rows' height: the Modern style's rows are taller than the Classic one's.
    const drawn = (this.hotMenu!.view.wt.wtTable.TABLE as HTMLElement).offsetHeight;
    const realHeight = Math.max(drawn,
      data.reduce((accumulator, value) => accumulator + (value.name === SEPARATOR ? 1 : 26), 0));

    holderStyle.width = `${currentHiderWidth + 22}px`;
    holderStyle.height = `${realHeight + 4}px`;
    hiderStyle.height = holderStyle.height;
  }

  /**
   * On after selection listener.
   *
   * @param r Selection start row index.
   * @param c Selection start column index.
   * @param r2 Selection end row index.
   * @param c2 Selection end column index.
   * @param preventScrolling Object with `value` property where its value change will be observed.
   * @param selectionLayerLevel The number which indicates what selection layer is currently modified.
   */
  onAfterSelection(r: number, c: number, r2: number, c2: number, preventScrolling: { value: boolean }): void {
    if (this.keyEvent === false) {
      preventScrolling.value = true;

      return;
    }
    // A menu that scrolls inside (taller than the window) shows the item chosen with the keyboard.
    if (this.container.style.overflowY === 'auto') {
      (this.hotMenu!.getCell(r, c, true) as HTMLElement | null)?.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Document mouse down listener.
   *
   * @private
   * @param event
   */
  onDocumentMouseDown(event: MouseEvent): void {
    if (!this.isOpened()) {
      return;
    }
    if (this.container && isChildOf(event.target as Node, this.container)) {
      this.executeCommand(event);
    }
    // Close menu when clicked element is not belongs to menu itself
    if (this.options.standalone && this.hotMenu && !isChildOf(event.target as Node, this.hotMenu!.rootElement)) {
      this.close(true);

    // Automatically close menu when clicked element is not belongs to menu or submenu (not necessarily to itself)
    } else if ((this.isAllSubMenusClosed() || this.isSubMenu()) &&
        (!isChildOf(event.target as Node, '.fs-menu') && isChildOf(event.target as Node, document))) {
      this.close(true);
    }
  }
}

mixin(Menu, localHooks);

export default Menu;
