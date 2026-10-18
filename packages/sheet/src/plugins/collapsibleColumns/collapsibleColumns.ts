import BasePlugin from './../_base';
import { registerPlugin } from './../../plugins';
import { getTranslator } from './../../utils/recordTranslator';
import { columnTreeLevels, getColumnTree } from './../../utils/columnTree';
import * as C from './../../i18n/constants';
import type NestedHeaders from './../nestedHeaders/nestedHeaders';
import type { HeaderGroup } from './../nestedHeaders/nestedHeaders';
import type { IndexVisibility } from './../../utils/indexVisibility';

/** A collapsible group: its header row, its first physical column, and the column that stays when it is collapsed. */
export type CollapsibleGroup = { row: number; col: number; show?: 'first' | 'last' | number };

const SOURCE = 'collapsibleColumns';
const BUTTON_CLASS_NAME = 'fs-group-toggle';

const key = (group: HeaderGroup): string => `${group.level}:${group.start}:${group.end}`;

/**
 * Collapsible columns: groups of `nestedHeaders` get a −/+ button; a collapsed group hides its columns but one (the
 * first, the last, or the one `show` gives, for example a total column).
 *
 * ```js
 * new FreeSheet(container, {
 *   data,
 *   nestedHeaders: [['Region', { label: '2026', colspan: 5 }], ['', 'Q1', 'Q2', 'Q3', 'Q4', 'Total']],
 *   collapsibleColumns: [{ row: 0, col: 1, show: 'last' }],
 * });
 * ```
 *
 * `true` makes every group wider than one column collapsible.
 */
class CollapsibleColumns extends BasePlugin {
  /** The collapsed groups, by `level:start:end` (groups are read again when settings change). */
  #collapsed = new Set<string>();
  /** The column tree whose `collapsed` groups were applied. */
  #appliedTree: unknown = null;

  get nestedHeaders(): NestedHeaders | null {
    const plugin = this.hot.getPlugin('nestedHeaders' as 'search') as unknown as NestedHeaders | undefined;

    return plugin && plugin.enabled ? plugin : null;
  }

  get visibility(): IndexVisibility {
    return getTranslator(this.hot).columns!;
  }

  isEnabled(): boolean {
    // `collapsible` on a group in `columns`, or (kept for older configurations) the `collapsibleColumns` setting.
    const tree = getColumnTree(this.hot);

    return !!this.hot.getSettings().collapsibleColumns || (!!tree && columnTreeLevels(tree).some(level =>
      level.some(group => group?.collapsible)));
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    this.hot.rootElement.addEventListener('mousedown', this.onMouseDown, true);
    super.enablePlugin();
  }

  disablePlugin(): void {
    this.hot.rootElement.removeEventListener('mousedown', this.onMouseDown, true);
    this.#collapsed.clear();
    this.#appliedTree = null;
    this.visibility.setHidden(SOURCE, null);
    super.disablePlugin();
  }

  updatePlugin(): void {
    this.updateVisibility();
    super.updatePlugin();
  }

  destroy(): void {
    this.hot.rootElement?.removeEventListener('mousedown', this.onMouseDown, true);
    super.destroy();
  }

  /**
   * The setting of a group, or `null` when it is not collapsible.
   *
   * @private
   */
  settingFor(group: HeaderGroup): CollapsibleGroup | null {
    // A group from `columns` says it itself.
    if (group.collapsible !== void 0) {
      return group.collapsible ? { row: group.level, col: group.start } : null;
    }
    const setting = this.hot.getSettings().collapsibleColumns as boolean | CollapsibleGroup[];

    if (setting === true) {
      return group.end > group.start ? { row: group.level, col: group.start } : null;
    }

    return Array.isArray(setting) ?
      setting.find(item => item && item.row === group.level && item.col === group.start) || null : null;
  }

  /**
   * The physical column that stays visible when a group is collapsed.
   *
   * @private
   */
  keptColumn(group: HeaderGroup): number {
    if (group.kept !== void 0) {
      return group.kept;
    }
    const show = this.settingFor(group)?.show;

    if (show === 'last') {
      return group.end;
    }
    if (typeof show === 'number' && show >= 0 && group.start + show <= group.end) {
      return group.start + show;
    }

    return group.start;
  }

  /**
   * The button of a group's header (used by nested headers), or `null`.
   *
   * @private
   */
  button(group: HeaderGroup): HTMLElement | null {
    if (!this.settingFor(group)) {
      return null;
    }
    const collapsed = this.#collapsed.has(key(group));
    const button = document.createElement('span');
    const phrase = collapsed ? C.NESTED_ROWS_EXPAND : C.NESTED_ROWS_COLLAPSE;

    button.className = `${BUTTON_CLASS_NAME}${collapsed ? ` ${BUTTON_CLASS_NAME}--collapsed` : ''}`;
    button.setAttribute('role', 'button');
    button.setAttribute('aria-expanded', String(!collapsed));
    button.title = `${this.hot.getTranslatedPhrase(phrase, 0) as string}: ${group.label}`;
    button.setAttribute('aria-label', button.title);
    button.dataset.level = String(group.level);
    button.dataset.start = String(group.start);

    return button;
  }

  onMouseDown = (event: MouseEvent): void => {
    const button = event.button === 0 ? (event.target as HTMLElement).closest(`.${BUTTON_CLASS_NAME}`) : null;

    if (!button || !this.hot.rootElement.contains(button)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();

    const group = this.nestedHeaders?.groupAt(Number((button as HTMLElement).dataset.level),
      Number((button as HTMLElement).dataset.start));

    if (group) {
      this.setCollapsed(group, !this.#collapsed.has(key(group)));
    }
  };

  groupOf(level: number, column: number): HeaderGroup | undefined {
    return this.nestedHeaders?.groupAt(level, this.hot.toPhysicalColumn(column));
  }

  /**
   * Collapses a group.
   *
   * @param level The header row (0 = the top).
   * @param column Visual column index of any column in the group.
   */
  collapse(level: number, column: number): void {
    const group = this.groupOf(level, column);

    if (group) {
      this.setCollapsed(group, true);
    }
  }

  /**
   * Expands a group.
   *
   * @param level The header row (0 = the top).
   * @param column Visual column index of any column in the group.
   */
  expand(level: number, column: number): void {
    const group = this.groupOf(level, column);

    if (group) {
      this.setCollapsed(group, false);
    }
  }

  /**
   * Whether a group is collapsed.
   *
   * @param level The header row (0 = the top).
   * @param column Visual column index of any column in the group.
   */
  isCollapsed(level: number, column: number): boolean {
    const group = this.groupOf(level, column);

    return !!group && this.#collapsed.has(key(group));
  }

  /** Collapses every collapsible group. */
  collapseAll(): void {
    this.nestedHeaders?.groups().forEach(group => this.settingFor(group) && this.#collapsed.add(key(group)));
    this.updateVisibility();
    this.refresh();
  }

  /** Expands every group. */
  expandAll(): void {
    this.#collapsed.clear();
    this.updateVisibility();
    this.refresh();
  }

  setCollapsed(group: HeaderGroup, collapsed: boolean): void {
    if (!this.settingFor(group) || this.#collapsed.has(key(group)) === collapsed) {
      return;
    }
    const action = collapsed ? 'Collapse' : 'Expand';

    if (this.hot.runHooks(`beforeColumn${action}`, group.level, group.start) === false) {
      return;
    }
    if (collapsed) {
      this.#collapsed.add(key(group));
    } else {
      this.#collapsed.delete(key(group));
    }
    this.updateVisibility();
    this.refresh();
    this.hot.runHooks(`afterColumn${action}`, group.level, group.start);
  }

  /**
   * Hides the columns of the collapsed groups but the one each keeps.
   *
   * @private
   */
  updateVisibility(): void {
    const groups = (this.nestedHeaders?.groups() || []).filter(group => this.settingFor(group));
    const hidden: number[] = [];
    const current = new Set(groups.map(key));
    const tree = getColumnTree(this.hot) || null;

    // A new column tree: its groups marked `collapsed` start collapsed.
    // (Once the groups are read: nested headers may start after this plugin.)
    if (tree !== this.#appliedTree && groups.length) {
      this.#appliedTree = tree;
      groups.filter(group => group.collapsed).forEach(group => this.#collapsed.add(key(group)));
    }

    // Groups that are gone or no longer collapsible open.
    this.#collapsed.forEach(name => !current.has(name) && this.#collapsed.delete(name));
    groups.filter(group => this.#collapsed.has(key(group))).forEach((group) => {
      const kept = this.keptColumn(group);

      for (let column = group.start; column <= group.end; column += 1) {
        if (column !== kept) {
          hidden.push(column);
        }
      }
    });
    this.visibility.setHidden(SOURCE, hidden);
  }

  refresh(): void {
    this.hot.forceFullRender = true;
    this.hot.render();
    this.hot.view?.wt.wtOverlays.adjustElementsSize(true);
    this.hot.render();
  }
}

registerPlugin('collapsibleColumns', CollapsibleColumns);

export default CollapsibleColumns;
