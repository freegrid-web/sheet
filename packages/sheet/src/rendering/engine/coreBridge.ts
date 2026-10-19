import type Core from '../../core';
import { stringify } from '../../helpers/mixed';
import { GridEngine } from './gridEngine';
import type { EngineOptions } from './gridEngine';
import type { CellAddress, EngineSource } from './scene';

type CorePort = Pick<Core, 'getDataAtCell' | 'setDataAtCell' | 'getSelectedRangeLast' | 'selectCell' |
  'getCellMeta' | 'countRows' | 'countCols' | 'addHook' | 'removeHook' | 'unlisten'>;
export interface CoreBridgeOptions extends Omit<EngineOptions, 'rows' | 'columns'> {
  onEditCancelled?: (reason: string) => void;
}

/**
 * Private diagnostic mirror of a live Core. Core retains its DOM backend and owns all data/selection/hooks.
 * Plain string display only: this does not execute renderers or certify plugin/backend compatibility.
 */
export class CoreEngineBridge {
  readonly source: EngineSource;
  private current: GridEngine;
  private readonly hooks = new Map<string, () => void>();
  private readonly listeners = new AbortController();
  private destroyed = false;

  constructor(private readonly core: CorePort, private readonly host: HTMLElement,
    private readonly options: CoreBridgeOptions = {}) {
    this.source = {
      readCell: ({ row, col }) => stringify(core.getDataAtCell(row, col)),
      canEdit: address => this.canEdit(address),
      writeCell: (address, value) => {
        if (!this.destroyed && this.canEdit(address)) {
          core.setDataAtCell(address.row, address.col, value, 'engine.edit');
        }
      },
      getSelection: () => {
        const highlight = core.getSelectedRangeLast()?.highlight;
        return highlight ? { row: highlight.row, col: highlight.col } : null;
      },
      select: ({ row, col }) => {
        core.selectCell(row, col, row, col, false, false);
        // Preparing Core's legacy editor can move focus even without taking its keyboard listener.
        this.current.element.focus({ preventScroll: true });
      },
    };
    this.current = this.createEngine();
    // Only input inside the mirror transfers keyboard ownership away from the original DOM view.
    const releaseCoreKeyboard = () => core.unlisten();
    host.addEventListener('focusin', releaseCoreKeyboard, { signal: this.listeners.signal });
    host.addEventListener('keydown', releaseCoreKeyboard, { signal: this.listeners.signal, capture: true });

    for (const name of ['beforeChange', 'beforeLoadData', 'beforeColumnSort', 'beforeRowMove',
      'beforeColumnMove', 'beforeCreateRow', 'beforeRemoveRow', 'beforeCreateCol', 'beforeRemoveCol',
      'beforeHideRows', 'beforeUnhideRows', 'beforeHideColumns', 'beforeUnhideColumns', 'beforeFilter',
      'beforeUndo', 'beforeRedo']) {
      this.bind(name, () => this.cancelEdit(name));
    }
    for (const name of ['afterChange', 'afterLoadData', 'afterColumnSort', 'afterRowMove', 'afterColumnMove',
      'afterCreateRow', 'afterRemoveRow', 'afterCreateCol', 'afterRemoveCol', 'afterHideRows',
      'afterUnhideRows', 'afterHideColumns', 'afterUnhideColumns', 'afterFilter', 'afterUndo', 'afterRedo',
      'afterUpdateSettings', 'afterSetCellMeta', 'afterRemoveCellMeta', 'afterRender']) {
      this.bind(name, () => this.refresh(name));
    }
    this.bind('afterSelection', () => { this.cancelEdit('selection changed'); this.current.draw(false); });
    this.bind('afterDeselect', () => { this.cancelEdit('selection cleared'); this.current.draw(false); });
    this.bind('afterDestroy', () => this.destroy());
  }

  get engine(): GridEngine { return this.current; }

  private canEdit({ row, col }: CellAddress): boolean {
    if (!Number.isInteger(row) || !Number.isInteger(col) || row < 0 || col < 0 || row >= this.core.countRows() || col >= this.core.countCols()) return false;
    const meta = this.core.getCellMeta(row, col);
    return !meta.readOnly && meta.editor !== false && (meta.type === undefined || meta.type === 'text');
  }

  private createEngine(): GridEngine {
    return new GridEngine(this.host, this.source, { ...this.options,
      rows: this.core.countRows(), columns: this.core.countCols() });
  }

  private bind(name: string, callback: () => void): void {
    this.hooks.set(name, callback); this.core.addHook(name, callback);
  }

  private cancelEdit(reason: string): void {
    if (this.current.cancelEdit()) this.options.onEditCancelled?.(reason);
  }

  private refresh(reason: string): void {
    if (this.destroyed) return;
    // A delayed validation/render can complete after the user has opened a new editor.
    if (reason !== 'afterChange' && reason !== 'afterRender') this.cancelEdit(reason);
    if (this.current.rows.count !== this.core.countRows() || this.current.columns.count !== this.core.countCols()) {
      const { left, top } = this.current.getScroll();
      this.current.destroy(); this.current = this.createEngine(); this.current.scroll(left, top);
    } else {
      this.current.invalidate();
    }
  }

  /** Does not destroy Core. Core destruction also invokes this cleanup before its methods are retired. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true; this.listeners.abort();
    for (const [name, callback] of this.hooks) this.core.removeHook(name, callback);
    this.hooks.clear(); this.current.destroy();
  }
}
