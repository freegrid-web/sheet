import './columnOutline.css';
import Outline, { LEVEL_SIZE, GUTTER_PADDING } from './outline';
import { registerPlugin } from './../../plugins';
import * as C from './../../i18n/constants';
import type { MenuItem } from './../contextMenu/menuItem';

/**
 * Column groups as a spreadsheet's outline (Data ▸ Group, for columns): any adjacent columns can be grouped, groups
 * can hold groups (up to 7 levels), and a group collapses to hide its columns. (Not the header groups that
 * `columns` with `columns` of their own make.)
 *
 * - The column headers get a gutter above them: a bracket along each group's columns and a −/+ button on the column
 *   after the group. The corner has a button for each level, one under another.
 * - The context menu gets Group columns and Ungroup columns.
 * - `getDocument()` and Excel files keep the groups.
 *
 * ```js
 * const grid = new FreeSheet(container, { data, colHeaders: true, columnOutline: true });
 * grid.getPlugin('columnOutline').groupColumns(1, 3);
 * ```
 */
class ColumnOutline extends Outline {
  get axis(): 'column' {
    return 'column';
  }

  get settingName(): string {
    return 'columnOutline';
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.decorateHeader(column, TH));
    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addMenuItems(options));
    this.hot.rootElement.addEventListener('mousedown', this.onMouseDown, true);
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.hot.rootElement.removeEventListener('mousedown', this.onMouseDown, true);
    super.disablePlugin();
  }

  destroy(): void {
    this.hot.rootElement?.removeEventListener('mousedown', this.onMouseDown, true);
    super.destroy();
  }

  /** Groups columns (visual indexes, from `from` to `to`). */
  groupColumns(from: number, to: number = from): void {
    this.group(from, to);
  }

  /** Removes the groups inside the columns from `from` to `to`, or else the innermost group that holds them. */
  ungroupColumns(from: number, to: number = from): void {
    this.ungroup(from, to);
  }

  /**
   * The gutter above a column header (the first header row), or the corner's level buttons.
   *
   * @private
   */
  decorateHeader(column: number, TH: HTMLTableCellElement): void {
    const container = (TH.querySelector(':scope > .relative') || TH) as HTMLElement;
    const firstRow = TH.parentElement === TH.parentElement?.parentElement?.firstElementChild;

    TH.querySelector('.fs-column-outline__gutter, .fs-column-outline__levels')?.remove();
    TH.classList.remove('fs-column-outline__header');
    TH.style.removeProperty('--fs-column-outline-gutter');
    if (!firstRow) {
      return;
    }
    container.style.paddingTop = this.groups.length ? `${this.gutterSize()}px` : '';
    if (!this.groups.length) {
      return;
    }
    TH.classList.add('fs-column-outline__header');
    TH.style.setProperty('--fs-column-outline-gutter', `${this.gutterSize()}px`);
    if (column < 0) {
      TH.insertBefore(this.levelButtons('fs-column-outline__levels', (button, level) => {
        button.style.top = `${GUTTER_PADDING + (level - 1) * LEVEL_SIZE}px`;
      }, String(this.hot.getTranslatedPhrase(C.COLUMN_OUTLINE_LEVEL))), TH.firstChild);

      return;
    }
    const physical = this.toPhysical(column);
    const gutter = document.createElement('span');
    const place = (element: HTMLElement, level: number) => {
      element.style.top = `${GUTTER_PADDING + (level - 1) * LEVEL_SIZE}px`;
      gutter.appendChild(element);

      return element;
    };
    const part = (className: string, level: number) => {
      const element = document.createElement('span');

      element.className = className;

      return place(element, level);
    };

    gutter.className = 'fs-column-outline__gutter';
    gutter.style.height = `${this.gutterSize()}px`;
    this.groups.forEach((group, index) => {
      const level = this.levelOf(group);
      const toggleColumn = this.toggleIndexOf(group);
      const after = toggleColumn !== null && toggleColumn > group.end;

      // A bracket along the columns: from a tick at the first column to the button (or from the button before them).
      if (!group.collapsed && physical >= group.start && physical <= group.end) {
        const first = after && physical === group.start;
        const last = !after && physical === group.end;

        part(`fs-column-outline__line${first ? ' fs-column-outline__line--first' : ''}${last ?
          ' fs-column-outline__line--last' : ''}`, level);
      }
      if (toggleColumn === physical) {
        if (!group.collapsed) {
          part(`fs-column-outline__line fs-column-outline__line--${after ? 'to-button' : 'from-button'}`, level);
        }
        place(this.toggleButton(group, index, String(this.hot.getTranslatedPhrase(group.collapsed ?
          C.ROW_GROUPS_EXPAND : C.ROW_GROUPS_COLLAPSE))), level);
      }
    });
    TH.insertBefore(gutter, TH.firstChild);
  }

  addMenuItems(options: { items: MenuItem[] }): void {
    const columns = () => {
      const [, c1, , c2] = this.hot.getSelectedLast() || [0, 0, 0, 0];

      return [Math.max(0, Math.min(c1, c2)), Math.max(0, Math.max(c1, c2))] as const;
    };

    options.items.push({ name: '---------' } as MenuItem, {
      key: 'column_outline_group',
      name: () => String(this.hot.getTranslatedPhrase(C.COLUMN_OUTLINE_GROUP)),
      callback: () => this.groupColumns(...columns()),
      disabled: () => !this.hot.getSelectedLast(),
    } as MenuItem, {
      key: 'column_outline_ungroup',
      name: () => String(this.hot.getTranslatedPhrase(C.COLUMN_OUTLINE_UNGROUP)),
      callback: () => this.ungroupColumns(...columns()),
      disabled: () => !this.hasGroupAround(...columns()),
    } as MenuItem);
  }
}

registerPlugin('columnOutline', ColumnOutline);

export default ColumnOutline;
