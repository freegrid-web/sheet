import BasePlugin from './../_base';
import { getTranslator } from './../../utils/recordTranslator';
import type { IndexVisibility } from './../../utils/indexVisibility';

/** A group (physical indexes, inclusive). */
export type Group = { start: number; end: number; collapsed: boolean };

/** A group as the API gives it: data indexes, its level (1 for the outermost) and whether it is collapsed. */
export type OutlineGroup = { from: number; to: number; level: number; collapsed: boolean };

/** The saved form of the groups (`getDocument`, Excel files): indexes of the data. */
export type OutlineSettings = { groups?: { from: number; to: number; collapsed?: boolean }[] };

/** Excel's limit. */
export const MAX_LEVELS = 7;
/** The size of one level in the gutter. */
export const LEVEL_SIZE = 16;
/** The space before the first level. */
export const GUTTER_PADDING = 4;

/**
 * A spreadsheet's outline of rows or of columns (Data ▸ Group): groups of adjacent indexes, groups inside groups (up
 * to 7 levels), collapsed groups hidden. What the rows' and the columns' outlines share; each draws its own gutter.
 */
export default abstract class Outline extends BasePlugin {
  #groups: Group[] = [];

  /** `'row'` or `'column'`. */
  abstract get axis(): 'row' | 'column';

  /** The setting that turns the outline on (and holds its saved groups). */
  abstract get settingName(): string;

  get visibility(): IndexVisibility {
    const translator = getTranslator(this.hot);

    return (this.axis === 'row' ? translator.rows : translator.columns)!;
  }

  get groups(): Group[] {
    return this.#groups;
  }

  isEnabled(): boolean {
    return !!this.hot.getSettings()[this.settingName];
  }

  enablePlugin(): void {
    if (this.enabled) {
      return;
    }
    const name = this.axis === 'row' ? 'Row' : 'Col';

    this.addHook(`afterCreate${name}`, (index: number, amount: number) => this.onAfterCreate(index, amount));
    this.addHook(`beforeRemove${name}`, (_index: number, _amount: number, physical: number[] = []) =>
      this.onBeforeRemove(physical));
    this.addHook(`afterRemove${name}`, () => this.update(false));
    // New data has the groups of the setting (none for `true`; a document's saved groups).
    this.addHook('afterLoadData', (_data: unknown, initialLoad: boolean) => {
      if (!initialLoad) {
        this.readSetting();
      }
    });
    super.enablePlugin();
    this.readSetting();
  }

  disablePlugin(): void {
    this.#groups = [];
    this.visibility.setHidden(this.settingName, null);
    super.disablePlugin();
  }

  updatePlugin(): void {
    if (typeof this.hot.getSettings()[this.settingName] === 'object') {
      this.readSetting();
    }
    super.updatePlugin();
  }

  /**
   * The groups of the saved form (`{ groups }`).
   *
   * @private
   */
  readSetting(): void {
    const setting = this.hot.getSettings()[this.settingName] as boolean | OutlineSettings;
    const groups = setting && typeof setting === 'object' && Array.isArray(setting.groups) ? setting.groups : [];

    this.#groups = groups.filter(({ from, to }) => Number.isInteger(from) && Number.isInteger(to) && from <= to)
      .map(({ from, to, collapsed }) => ({ start: from, end: to, collapsed: !!collapsed }));
    this.sortGroups();
    this.update(false);
  }

  /**
   * Outer groups first, then by their first index.
   *
   * @private
   */
  sortGroups(): void {
    this.#groups.sort((a, b) => a.start - b.start || b.end - a.end);
  }

  /**
   * How many groups hold the group (itself included): 1 for an outermost group.
   *
   * @private
   */
  levelOf(group: Group): number {
    return this.#groups.filter(other => other.start <= group.start && other.end >= group.end).length;
  }

  /**
   * The deepest level.
   *
   * @private
   */
  maxLevel(): number {
    return this.#groups.reduce((deepest, group) => Math.max(deepest, this.levelOf(group)), 0);
  }

  total(): number {
    return this.axis === 'row' ? this.hot.countSourceRows() : this.hot.countSourceCols();
  }

  toPhysical(visual: number): number {
    return (this.axis === 'row' ? this.hot.toPhysicalRow(visual) : this.hot.toPhysicalColumn(visual)) ?? visual;
  }

  /**
   * Where the group's −/+ button is: the index after it, or the index before it at the end of the data.
   *
   * @private
   */
  toggleIndexOf(group: Group): number | null {
    if (group.end + 1 < this.total()) {
      return group.end + 1;
    }

    return group.start > 0 ? group.start - 1 : null;
  }

  /**
   * The groups, outermost first: their first and last index in the data (a collapsed group's hidden rows or columns
   * have no visual index), their level and whether they are collapsed.
   */
  getGroups(): OutlineGroup[] {
    return this.#groups.map(group => ({ from: group.start, to: group.end, level: this.levelOf(group),
      collapsed: group.collapsed }));
  }

  /**
   * The groups in their saved form (data indexes), for `getDocument`.
   *
   * @private
   */
  getSavedGroups(): { from: number; to: number; collapsed?: boolean }[] {
    return this.#groups.map(({ start, end, collapsed }) => ({ from: start, to: end, ...(collapsed ? { collapsed } :
      {}) }));
  }

  /**
   * Groups visual indexes from `from` to `to` (not twice the same group, not deeper than 7 levels).
   *
   * @private
   */
  group(from: number, to: number = from): void {
    const start = this.toPhysical(Math.min(from, to));
    const end = this.toPhysical(Math.max(from, to));
    const group = { start, end, collapsed: false };

    if (this.#groups.some(other => other.start === start && other.end === end) ||
      this.levelOf(group) + 1 > MAX_LEVELS) {
      return;
    }
    this.#groups.push(group);
    this.sortGroups();
    this.update();
  }

  /**
   * Removes the groups inside the visual indexes from `from` to `to`, or else the innermost group that holds them.
   *
   * @private
   */
  ungroup(from: number, to: number = from): void {
    const start = this.toPhysical(Math.min(from, to));
    const end = this.toPhysical(Math.max(from, to));
    const inside = this.#groups.filter(group => group.start >= start && group.end <= end);
    const holding = this.#groups.filter(group => group.start <= start && group.end >= end)
      .sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
    const removed = inside.length ? inside : holding ? [holding] : [];

    this.#groups = this.#groups.filter(group => !removed.includes(group));
    this.update();
  }

  /**
   * Whether the visual indexes from `from` to `to` hold a group or are inside one (something to ungroup).
   *
   * @private
   */
  hasGroupAround(from: number, to: number): boolean {
    const start = this.toPhysical(Math.min(from, to));
    const end = this.toPhysical(Math.max(from, to));

    return this.#groups.some(group => (group.start >= start && group.end <= end) ||
      (group.start <= start && group.end >= end));
  }

  /**
   * The innermost group whose indexes or whose −/+ is the visual index.
   *
   * @private
   */
  groupAt(index: number): Group | undefined {
    const physical = this.toPhysical(index);

    return this.#groups.filter(group => (group.start <= physical && group.end >= physical) ||
      this.toggleIndexOf(group) === physical).sort((a, b) => (a.end - a.start) - (b.end - b.start))[0];
  }

  /** Collapses the group of a visual index (its rows or columns are hidden). */
  collapseGroup(index: number): void {
    this.setCollapsed(this.groupAt(index), true);
  }

  /** Expands the group of a visual index. */
  expandGroup(index: number): void {
    this.setCollapsed(this.groupAt(index), false);
  }

  setCollapsed(group: Group | undefined, collapsed: boolean): void {
    if (group && group.collapsed !== collapsed) {
      group.collapsed = collapsed;
      this.update();
    }
  }

  /** Shows the outline down to a level: the groups deeper than it collapse, the others expand (1: the outermost). */
  showLevel(level: number): void {
    this.#groups.forEach((group) => {
      group.collapsed = this.levelOf(group) >= level;
    });
    this.update();
  }

  /** Expands every group. */
  expandAll(): void {
    this.#groups.forEach((group) => {
      group.collapsed = false;
    });
    this.update();
  }

  /**
   * Hides the indexes of collapsed groups and draws the grid again.
   *
   * @private
   */
  update(render = true): void {
    const hidden = new Set<number>();

    this.#groups.filter(group => group.collapsed).forEach((group) => {
      for (let index = group.start; index <= group.end; index += 1) {
        hidden.add(index);
      }
    });
    this.visibility.setHidden(this.settingName, hidden.size ? hidden : null);
    if (render && this.hot.view) {
      this.hot.forceFullRender = true;
      this.hot.render();
      this.hot.view.wt.wtOverlays.adjustElementsSize(true);
      this.hot.render();
    }
  }

  onAfterCreate(index: number, amount: number): void {
    const physical = this.toPhysical(index);

    this.#groups.forEach((group) => {
      if (group.start >= physical) {
        group.start += amount;
        group.end += amount;
      } else if (group.end >= physical) {
        group.end += amount;
      }
    });
    this.update(false);
  }

  onBeforeRemove(physicalIndexes: number[]): void {
    const removed = [...physicalIndexes].sort((a, b) => a - b);
    const before = (index: number) => removed.filter(other => other < index).length;

    this.#groups = this.#groups.map((group) => {
      const inside = removed.filter(index => index >= group.start && index <= group.end).length;

      return { ...group, start: group.start - before(group.start), end: group.end - before(group.start) - inside };
    }).filter(group => group.end >= group.start);
  }

  /**
   * The gutter's size: a column (or row) per level, and one more for the last level button.
   *
   * @private
   */
  gutterSize(): number {
    return (this.maxLevel() + 1) * LEVEL_SIZE + GUTTER_PADDING;
  }

  /**
   * A level's buttons: 1, 2, … (show the outline down to that level).
   *
   * @private
   */
  levelButtons(className: string, place: (button: HTMLElement, level: number) => void, label: string): HTMLElement {
    const levels = document.createElement('span');

    levels.className = className;
    for (let level = 1; level <= this.maxLevel() + 1; level += 1) {
      const button = document.createElement('span');

      button.className = 'fs-row-groups__level';
      button.setAttribute('role', 'button');
      button.setAttribute('aria-label', label.replace('{level}', String(level)));
      button.dataset.level = String(level);
      button.dataset.outline = this.axis;
      button.textContent = String(level);
      place(button, level);
      levels.appendChild(button);
    }

    return levels;
  }

  /**
   * A group's −/+ button.
   *
   * @private
   */
  toggleButton(group: Group, index: number, label: string): HTMLElement {
    const toggle = document.createElement('span');

    toggle.className = `fs-row-groups__toggle${group.collapsed ? ' fs-row-groups__toggle--collapsed' : ''}`;
    toggle.setAttribute('role', 'button');
    toggle.setAttribute('aria-expanded', String(!group.collapsed));
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.dataset.group = String(index);
    toggle.dataset.outline = this.axis;
    toggle.textContent = group.collapsed ? '+' : '−';

    return toggle;
  }

  /** Clicks on this outline's −/+ and level buttons (another outline's are its own). */
  onMouseDown = (event: MouseEvent): void => {
    const target = event.button === 0 ?
      (event.target as HTMLElement).closest<HTMLElement>('.fs-row-groups__toggle, .fs-row-groups__level') : null;

    if (!target || target.dataset.outline !== this.axis || !this.hot.rootElement.contains(target)) {
      return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    if (target.dataset.level) {
      this.showLevel(Number(target.dataset.level));
    } else {
      const group = this.#groups[Number(target.dataset.group)];

      this.setCollapsed(group, !!group && !group.collapsed);
    }
  };
}
