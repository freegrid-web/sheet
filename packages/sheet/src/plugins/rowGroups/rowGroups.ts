import './rowGroups.css';
import Outline, { LEVEL_SIZE, GUTTER_PADDING, type OutlineGroup } from './outline';
import { registerPlugin } from './../../plugins';
import { stopImmediatePropagation } from './../../helpers/dom/event';
import * as C from './../../i18n/constants';
import type { MenuItem } from './../contextMenu/menuItem';

/** A group as the API gives it: data rows, its level (1 for the outermost) and whether it is collapsed. */
export type RowGroup = OutlineGroup;

/**
 * Row groups, as a spreadsheet's outline (Data ▸ Group): any adjacent rows can be grouped, groups can hold groups (up
 * to 7 levels), and a group collapses to hide its rows. The data stays flat.
 *
 * - The row headers get a gutter: a bracket along each group's rows and a −/+ button on the row after the group (the
 *   row before it, when the group ends the sheet). The corner has a button for each level: 1 shows only the
 *   outermost rows, 2 one level more, and so on.
 * - The context menu gets Group rows and Ungroup rows; Alt+Shift+→ groups the selected rows, Alt+Shift+← ungroups
 *   them.
 * - `getDocument()` and Excel files keep the groups.
 *
 * ```js
 * const grid = new FreeSheet(container, { data, rowHeaders: true, colHeaders: true, rowGroups: true });
 * grid.getPlugin('rowGroups').groupRows(1, 4);
 * ```
 */
class RowGroups extends Outline {
  get axis(): 'row' {
    return 'row';
  }

  get settingName(): string {
    return 'rowGroups';
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.addHook('afterGetRowHeader', (row: number, TH: HTMLTableCellElement) => this.decorateRowHeader(row, TH));
    this.addHook('afterGetColHeader', (column: number, TH: HTMLTableCellElement) => this.decorateCorner(column, TH));
    this.addHook('modifyRowHeaderWidth', (width: number) => this.onModifyRowHeaderWidth(width));
    this.addHook('beforeKeyDown', (event: KeyboardEvent) => this.onBeforeKeyDown(event));
    this.addHook('afterContextMenuDefaultOptions', (options: { items: MenuItem[] }) => this.addMenuItems(options));
    this.hot.rootElement.addEventListener('mousedown', this.onMouseDown, true);
    this.hot.rootElement.classList.add('fs-row-groups');
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.hot.rootElement.removeEventListener('mousedown', this.onMouseDown, true);
    this.hot.rootElement.classList.remove('fs-row-groups');
    super.disablePlugin();
  }

  destroy(): void {
    this.hot.rootElement?.removeEventListener('mousedown', this.onMouseDown, true);
    super.destroy();
  }

  /**
   * Groups rows (visual indexes, as many as from `from` to `to`). A group like an existing one is not added twice;
   * more than 7 levels are not made.
   *
   * @param from The first row.
   * @param to The last row.
   */
  groupRows(from: number, to: number = from): void {
    this.group(from, to);
  }

  /**
   * Ungroups rows: removes the groups inside the rows from `from` to `to`, or else the innermost group that holds
   * them.
   *
   * @param from The first row.
   * @param to The last row.
   */
  ungroupRows(from: number, to: number = from): void {
    this.ungroup(from, to);
  }

  onModifyRowHeaderWidth(width: number): number {
    return this.maxLevel() ? Math.max(width || 50, 50) + this.gutterSize() : width;
  }

  /**
   * The gutter of a row header: the groups' brackets and −/+ buttons, one column per level.
   *
   * @private
   */
  decorateRowHeader(row: number, TH: HTMLTableCellElement): void {
    const container = (TH.querySelector(':scope > .relative') || TH) as HTMLElement;

    TH.querySelector('.fs-row-groups__gutter')?.remove();
    TH.classList.remove('fs-row-groups__header');
    container.style.paddingLeft = row >= 0 && this.groups.length ? `${this.gutterSize()}px` : '';
    if (row < 0 || !this.groups.length) {
      return;
    }
    const physical = this.toPhysical(row);
    const gutter = document.createElement('span');
    const place = (element: HTMLElement, level: number) => {
      element.style.left = `${GUTTER_PADDING + (level - 1) * LEVEL_SIZE}px`;
      gutter.appendChild(element);

      return element;
    };
    const part = (className: string, level: number) => {
      const element = document.createElement('span');

      element.className = className;

      return place(element, level);
    };

    gutter.className = 'fs-row-groups__gutter';
    gutter.style.width = `${this.gutterSize()}px`;
    this.groups.forEach((group, index) => {
      const level = this.levelOf(group);
      const toggleRow = this.toggleIndexOf(group);
      const below = toggleRow !== null && toggleRow > group.end;

      // A bracket along the rows: from a tick at the first row to the button (or from the button, above the group).
      if (!group.collapsed && physical >= group.start && physical <= group.end) {
        const first = below ? physical === group.start : false;
        const last = !below && physical === group.end;

        part(`fs-row-groups__line${first ? ' fs-row-groups__line--first' : ''}${last ? ' fs-row-groups__line--last' :
          ''}`, level);
      }
      if (toggleRow === physical) {
        if (!group.collapsed) {
          part(`fs-row-groups__line fs-row-groups__line--${below ? 'to-button' : 'from-button'}`, level);
        }
        place(this.toggleButton(group, index, String(this.hot.getTranslatedPhrase(group.collapsed ?
          C.ROW_GROUPS_EXPAND : C.ROW_GROUPS_COLLAPSE))), level);
      }
    });
    TH.classList.add('fs-row-groups__header');
    TH.style.setProperty('--fs-row-groups-gutter', `${this.gutterSize()}px`);
    TH.insertBefore(gutter, TH.firstChild);
  }

  /**
   * The corner's level buttons (1, 2, …: show the outline down to that level), over the gutter's columns.
   *
   * @private
   */
  decorateCorner(column: number, TH: HTMLTableCellElement): void {
    TH.querySelector('.fs-row-groups__levels')?.remove();
    TH.classList.remove('fs-row-groups__corner');
    if (column !== -1 || !this.groups.length) {
      return;
    }
    const levels = this.levelButtons('fs-row-groups__levels', (button, level) => {
      button.style.left = `${GUTTER_PADDING + (level - 1) * LEVEL_SIZE}px`;
    }, String(this.hot.getTranslatedPhrase(C.ROW_GROUPS_LEVEL)));

    levels.style.width = `${this.gutterSize()}px`;
    TH.classList.add('fs-row-groups__corner');
    TH.style.setProperty('--fs-row-groups-gutter', `${this.gutterSize()}px`);
    TH.insertBefore(levels, TH.firstChild);
  }

  /** Alt+Shift+→ groups the selected rows, Alt+Shift+← ungroups them (as in Excel). */
  onBeforeKeyDown(event: KeyboardEvent): void {
    const selected = this.hot.getSelectedLast();
    const left = event.key === 'ArrowLeft' || event.keyCode === 37;
    const right = event.key === 'ArrowRight' || event.keyCode === 39;

    if (!selected || !event.altKey || !event.shiftKey || (!left && !right)) {
      return;
    }
    event.preventDefault();
    stopImmediatePropagation(event);
    if (right) {
      this.groupRows(Math.max(0, selected[0]), Math.max(0, selected[2]));
    } else {
      this.ungroupRows(Math.max(0, selected[0]), Math.max(0, selected[2]));
    }
  }

  addMenuItems(options: { items: MenuItem[] }): void {
    const rows = () => {
      const [r1, , r2] = this.hot.getSelectedLast() || [0, 0, 0];

      return [Math.max(0, Math.min(r1, r2)), Math.max(0, Math.max(r1, r2))] as const;
    };

    options.items.push({ name: '---------' } as MenuItem, {
      key: 'row_groups_group',
      name: () => String(this.hot.getTranslatedPhrase(C.ROW_GROUPS_GROUP)),
      callback: () => this.groupRows(...rows()),
      disabled: () => !this.hot.getSelectedLast(),
    } as MenuItem, {
      key: 'row_groups_ungroup',
      name: () => String(this.hot.getTranslatedPhrase(C.ROW_GROUPS_UNGROUP)),
      callback: () => this.ungroupRows(...rows()),
      disabled: () => !this.hasGroupAround(...rows()),
    } as MenuItem);
  }
}

registerPlugin('rowGroups', RowGroups);

export default RowGroups;
