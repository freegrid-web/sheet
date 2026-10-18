import { getRowHeight } from './helpers/dom/theme';
import { addClass, empty, isChildOfWebComponentTable, removeClass } from './helpers/dom/element';
import { columnFactory } from './helpers/setting';
import type { SettingsConstructor } from './helpers/setting';
import { isFunction } from './helpers/function';
import { warn } from './helpers/console';
import { isDefined, isUndefined, isRegExp, isEmpty } from './helpers/mixed';
import { isMobileBrowser } from './helpers/browser';
import DataMap from './dataMap';
import type { Prop } from './dataMap';
import EditorManager from './editorManager';
import EventManager from './eventManager';
import {
  deepClone,
  duckSchema,
  extend, isObject,
  isObjectEqual,
  deepObjectSize,
  hasOwnProperty,
  createObjectPropListener,
  objectEach
} from './helpers/object';
import { arrayFlatten, arrayEach } from './helpers/array';
import { toSingleLine } from './helpers/templateLiteralTag';
import { getPlugin } from './plugins';
import type { PluginByName } from './plugins/byName';
import { getRenderer } from './renderers';
import { getValidator } from './validators';
import { randomString } from './helpers/string';
import { rangeEach, rangeEachReverse } from './helpers/number';
import TableView from './tableView';
import DataSource from './dataSource';
import { translateRowsToColumns, cellMethodLookupFactory, spreadsheetColumnLabel } from './helpers/data';
import { getTranslator } from './utils/recordTranslator';
import type { RecordTranslator } from './utils/recordTranslator';
import { IndexVisibility } from './utils/indexVisibility';
import { flattenColumns, isColumnTree, setColumnTree } from './utils/columnTree';
import { setImmediate, clearImmediate } from './helpers/immediate';
import { registerAsRootInstance, hasValidParameter } from './utils/rootInstance';
import { CellCoords, ViewportColumnsCalculator } from './3rdparty/walkontable/src';
import type CellRange from './3rdparty/walkontable/src/cell/range';
import Hooks from './pluginHooks';
import type { HookCallback } from './pluginHooks';
import DefaultSettings from './defaultSettings';
import { getCellType } from './cellTypes';
import { getTranslatedPhrase } from './i18n';
import { hasLanguageDictionary } from './i18n/dictionariesManager';
import { warnUserAboutLanguageRegistration, applyLanguageSetting, normalizeLanguageCode } from './i18n/utils';
import { startObserving as keyStateStartObserving, stopObserving as keyStateStopObserving } from './utils/keyStateObserver';
import { Selection } from './selection';
import type { getEditorInstance } from './editors';
import type { AnyFunction, AnyObject, GridSettings } from './types';
import { Workbook, getWorkbook } from './workbook/workbook';
import { findSidePanel, getSidePanel } from './sidePanel/sidePanel';
import { exportFile, downloadFile, importFile } from './files';
import { setLoading, isLoading } from './loading/loading';
import { setCellStyle } from './formatting/formatting';
import './formatting/fontRows';
import type { FileFormat, FileOptions } from './files';

/** A data change: `[row, prop, oldValue, newValue]` (`null` once a validator or hook cancelled it). */
type Change = [number, Prop, unknown, unknown];
/** A cell position (visual indexes). */
type Coords = { row: number; col: number };
/** `spliceCol` / `spliceRow` arguments: `[index, start, amount, ...elements]`. */
type SpliceArgs = [number, number, number, ...unknown[]];
/** `[index, amount]`: rows or columns to remove (`alter` with an array index). */
type IndexGroup = [number, number];

/** The constructor of the grid's settings chain (the defaults, then the grid's settings). */
export type GridSettingsConstructor = SettingsConstructor & { prototype: AnyObject };

/** The grid's private state, shared with DataMap and EditorManager. */
export type GridPrivate = {
  cellSettings: AnyObject[][];
  columnSettings: SettingsConstructor[];
  columnsSettingConflicts: string[];
  settings: GridSettings;
  selRange: CellRange | null;
  isPopulated: boolean | null;
  scrollable: unknown;
  /** `true` before the first `updateSettings`, then the first changes (for `afterChange`), then `false`. */
  firstRun: boolean | [Change[] | null, string];
  lastKeyCode?: number;
};

let activeGuid: string | null = null;


/** Counts the running cell validators and calls `onQueueEmpty(valid)` once all of them are done. */
class ValidatorsQueue {
  validatorsInQueue = 0;
  valid = true;
  #resolved = false;

  onQueueEmpty: (valid: boolean) => void = () => {};

  addValidatorToQueue(): void {
    this.validatorsInQueue += 1;
    this.#resolved = false;
  }

  removeValidatorFormQueue(): void {
    this.validatorsInQueue = this.validatorsInQueue - 1 < 0 ? 0 : this.validatorsInQueue - 1;
    this.checkIfQueueIsEmpty();
  }

  checkIfQueueIsEmpty(): void {
    if (this.validatorsInQueue === 0 && this.#resolved === false) {
      this.#resolved = true;
      this.onQueueEmpty(this.valid);
    }
  }
}

/**
 * FreeSheet constructor
 *
 * @core
 * @constructor Core
 * @description
 *
 * After FreeSheet is constructed, you can modify the grid behavior using the available public methods.
 *
 * ---
 * ## How to call methods
 *
 * These are 2 equal ways to call a FreeSheet method:
 *
 * ```js
 * // all following examples assume that you constructed FreeSheet like this
 * const hot = new FreeSheet(document.getElementById('example1'), options);
 *
 * // now, to use setDataAtCell method, you can either:
 * ht.setDataAtCell(0, 0, 'new value');
 * ```
 *
 * Alternatively, you can call the method using jQuery wrapper (__obsolete__, requires initialization using our jQuery guide
 * ```js
 *   $('#example1').freesheet('setDataAtCell', 0, 0, 'new value');
 * ```
 * ---
 */

/**
 * Get parsed number from numeric string.
 *
 * @private
 * @param {String} numericData Float (separated by a dot or a comma) or integer.
 * @returns {Number} Number if we get data in parsable format, not changed value otherwise.
 */
function getParsedNumber(numericData: string) {
  // Unifying "float like" string. Change from value with comma determiner to value with dot determiner,
  // for example from `450,65` to `450.65`.
  const unifiedNumericData = numericData.replace(',', '.');

  if (isNaN(parseFloat(unifiedNumericData)) === false) {
    return parseFloat(unifiedNumericData);
  }

  return numericData;
}


/** The changes `[[row, column or prop, value], ...]` of `setDataAtCell` / `setDataAtRowProp`'s arguments. */
function setDataInputToArray(row: number | unknown[][], propOrCol: unknown, value: unknown): any[][] { // eslint-disable-line @typescript-eslint/no-explicit-any -- user input
  if (typeof row === 'object') { // is it an array of changes
    return row;
  }
  return [
    [row, propOrCol, value]
  ];
}


/** The settings of `obj.type` (a cell type name or object) that `obj` does not set itself. */
function expandType(obj: AnyObject): AnyObject {
  if (!hasOwnProperty(obj, 'type')) {
    // ignore obj.prototype.type
    return {};
  }

  const expandedType: AnyObject = {};
  let type: AnyObject | undefined;

  if (typeof obj.type === 'object') {
    type = obj.type;
  } else if (typeof obj.type === 'string') {
    type = getCellType(obj.type);
  }

  for (const i in type) {
    if (hasOwnProperty(type, i) && !hasOwnProperty(obj, i)) {
      expandedType[i] = type[i];
    }
  }

  return expandedType;

}


const rendererLookup = cellMethodLookupFactory('renderer');

const editorLookup = cellMethodLookupFactory('editor');


const validatorLookup = cellMethodLookupFactory('validator');


/**
 * Replacement for all methods after Handsotnable was destroyed.
 *
 * @private
 */
function postMortem(method: string) {
  return () => {
    throw new Error(`The "${method}" method cannot be called because this FreeSheet instance has been destroyed`);
  };
}

class Core {
  // Set in the constructor or later (`declare`: no class field, so the instance keeps the same own properties).
  declare rootElement: HTMLElement;
  declare container: HTMLDivElement;
  declare guid: string;
  declare isDestroyed: boolean;
  /** Running inside a Web Component table (hot-table). */
  declare isHotTableEnv: boolean;
  declare selection: Selection;
  declare view: TableView;
  /** The data source shape: 'array', 'object' or 'function'. */
  declare dataType: string;
  /** Set when the data changed: the next render redraws all cells. */
  declare forceFullRender: boolean;
  declare renderCall: boolean;
  declare timeouts: number[];
  declare immediates: number[];
  /** The `<table>` element (set by TableView). */
  declare table: HTMLTableElement;

  /** The grid's private state (also passed to DataMap and EditorManager). */
  #priv!: GridPrivate;
  #datamap!: DataMap;
  #dataSource!: DataSource;
  /** Inserts or removes rows and columns, and populates data (`alter` and `populateFromArray` use it). */
  #grid!: AnyObject;
  #editorManager!: EditorManager;
  /** The grid's settings: a prototype chain of the defaults, the grid's settings, then each column's and cell's. */
  #GridSettings!: GridSettingsConstructor;
  #recordTranslator!: RecordTranslator;
  #eventManager!: EventManager;
  #preventScrollingToCell = false;
  /** The element given to the constructor when it is the frame of the bars and sheets (see the constructor). */
  #frame: HTMLElement | null = null;

  constructor(rootElement: HTMLElement, userSettings: AnyObject,
    rootInstanceSymbol: symbol | boolean = false) {
    // The methods were closures over the grid before: they work without `this` (Walkontable gets
    // `getRowHeight`, `getDataAtCell` etc. as callbacks, and `const { getData } = hot` works), and each grid has its own.
    Object.getOwnPropertyNames(Core.prototype).forEach((key) => {
      const value = (this as unknown as AnyObject)[key];

      if (key !== 'constructor' && typeof value === 'function') {
        (this as unknown as AnyObject)[key] = value.bind(this);
      }
    });

    // The grid's settings: a prototype chain of the defaults, the grid's settings, then each column's and cell's.
    this.#GridSettings = function() {} as unknown as GridSettingsConstructor;
    this.#eventManager = new EventManager(this);

    extend(this.#GridSettings.prototype, DefaultSettings.prototype); // create grid settings as a copy of default settings
    extend(this.#GridSettings.prototype, userSettings); // overwrite defaults with user settings
    // Column groups: plugins see the columns without children (and the tree) from the start.
    if (isColumnTree(userSettings.columns)) {
      setColumnTree(this, userSettings.columns);
      this.#GridSettings.prototype.columns = flattenColumns(userSettings.columns);
    }
    extend(this.#GridSettings.prototype, expandType(userSettings));

    applyLanguageSetting(this.#GridSettings.prototype, userSettings.language);

    if (hasValidParameter(rootInstanceSymbol)) {
      registerAsRootInstance(this);
    }

    keyStateStartObserving();

    this.isDestroyed = false;

    // With a formula bar, a status bar or sheets, the given element is the frame: the bars and every sheet go inside it, and the
    // grid takes the height that is left (when the element has a height; otherwise all are as tall as their content).
    // A sheet that addSheet creates is already inside a frame.
    if ((userSettings.formulaBar || userSettings.sheetTabs || userSettings.sidePanel || userSettings.statusBar ||
      (Array.isArray(userSettings.sheets) && userSettings.sheets.length)) &&
      !rootElement.classList.contains('fs-document__sheet')) {
      const gridElement = document.createElement('div');

      gridElement.className = `fs-document__sheet${rootElement.clientHeight > 0 ? ' fs-document__sheet--fill' : ''}`;
      rootElement.classList.add('fs-document');
      rootElement.appendChild(gridElement);
      this.#frame = rootElement;
      rootElement = gridElement;
    }
    this.rootElement = rootElement;
    this.isHotTableEnv = isChildOfWebComponentTable(this.rootElement);
    EventManager.isHotTableEnv = this.isHotTableEnv;

    this.container = document.createElement('div');
    this.renderCall = false;

    rootElement.insertBefore(this.container, rootElement.firstChild);

    this.guid = `ht_${randomString()}`; // this is the namespace for global events

    this.#recordTranslator = getTranslator(this);
    this.#initVisibility();
    this.addHook('afterRender', () => {
      this.#fillContainer();
    });
    this.addHook('afterScrollVertically', () => {
      this.#fillContainer();
    });
    this.addHook('afterScrollHorizontally', () => {
      this.#fillContainer();
    });

    this.#dataSource = new DataSource(this);

    if (!this.rootElement.id || this.rootElement.id.substring(0, 3) === 'ht_') {
      this.rootElement.id = this.guid; // if root element does not have an id, assign a random id
    }
    this.#priv = {
      cellSettings: [],
      columnSettings: [],
      columnsSettingConflicts: ['data', 'width', 'language'],
      settings: new this.#GridSettings() as AnyObject, // current settings instance
      selRange: null, // exposed by public method `getSelectedRange`
      isPopulated: null,
      scrollable: null,
      firstRun: true
    };

    this.selection = new Selection(this.#priv.settings, {
      countCols: () => this.countCols(),
      countRows: () => this.countRows(),
      propToCol: prop => this.#datamap.propToCol(prop),
      isEditorOpened: () => {
        const activeEditor = this.getActiveEditor();

        return activeEditor ? activeEditor.isOpened() : false;
      },
    });

    this.selection.addLocalHook('beforeSetRangeStart', (cellCoords) => {
      this.runHooks('beforeSetRangeStart', cellCoords);
    });

    this.selection.addLocalHook('beforeSetRangeStartOnly', (cellCoords) => {
      this.runHooks('beforeSetRangeStartOnly', cellCoords);
    });

    this.selection.addLocalHook('beforeSetRangeEnd', (cellCoords) => {
      this.runHooks('beforeSetRangeEnd', cellCoords);

      if (cellCoords.row < 0) {
        cellCoords.row = this.view.wt.wtTable.getFirstVisibleRow();
      }
      if (cellCoords.col < 0) {
        cellCoords.col = this.view.wt.wtTable.getFirstVisibleColumn();
      }
    });

    this.selection.addLocalHook('afterSetRangeEnd', (cellCoords) => {
      const preventScrolling = createObjectPropListener(false);
      const selectionRange = this.selection.getSelectedRange();
      const { from, to } = selectionRange.current() as NonNullable<ReturnType<typeof selectionRange.current>>;
      const selectionLayerLevel = selectionRange.size() - 1;

      this.runHooks('afterSelection',
        from.row, from.col, to.row, to.col, preventScrolling, selectionLayerLevel);
      this.runHooks('afterSelectionByProp',
        from.row, this.colToProp(from.col), to.row, this.colToProp(to.col), preventScrolling, selectionLayerLevel);

      const isSelectedByAnyHeader = this.selection.isSelectedByAnyHeader();
      const currentSelectedRange = this.selection.selectedRange.current();

      let scrollToCell = true;

      if (this.#preventScrollingToCell) {
        scrollToCell = false;
      }

      if (preventScrolling.isTouched()) {
        scrollToCell = !preventScrolling.value;
      }

      const isSelectedByRowHeader = this.selection.isSelectedByRowHeader();
      const isSelectedByColumnHeader = this.selection.isSelectedByColumnHeader();

      if (scrollToCell !== false) {
        if (!isSelectedByAnyHeader) {
          if (currentSelectedRange && !this.selection.isMultiple()) {
            this.view.scrollViewport(currentSelectedRange.from);
          } else {
            this.view.scrollViewport(cellCoords);
          }

        } else if (isSelectedByRowHeader) {
          this.view.scrollViewportVertically(cellCoords.row);

        } else if (isSelectedByColumnHeader) {
          this.view.scrollViewportHorizontally(cellCoords.col);
        }
      }

      // Only Walkontable's border.js uses these classes (selected rows/columns with merged cells); see #71.
      if (isSelectedByRowHeader && isSelectedByColumnHeader) {
        addClass(this.rootElement, ['fs-selection--rows', 'fs-selection--columns']);

      } else if (isSelectedByRowHeader) {
        removeClass(this.rootElement, 'fs-selection--columns');
        addClass(this.rootElement, 'fs-selection--rows');

      } else if (isSelectedByColumnHeader) {
        removeClass(this.rootElement, 'fs-selection--rows');
        addClass(this.rootElement, 'fs-selection--columns');

      } else {
        removeClass(this.rootElement, ['fs-selection--rows', 'fs-selection--columns']);
      }

      this._refreshBorders(null);
    });

    this.selection.addLocalHook('afterSelectionFinished', (cellRanges) => {
      const selectionLayerLevel = cellRanges.length - 1;
      const { from, to } = cellRanges[selectionLayerLevel];

      this.runHooks('afterSelectionEnd',
        from.row, from.col, to.row, to.col, selectionLayerLevel);
      this.runHooks('afterSelectionEndByProp',
        from.row, this.colToProp(from.col), to.row, this.colToProp(to.col), selectionLayerLevel);
    });

    this.selection.addLocalHook('afterIsMultipleSelection', (isMultiple) => {
      const changedIsMultiple = this.runHooks('afterIsMultipleSelection', isMultiple.value);

      if (isMultiple.value) {
        isMultiple.value = changedIsMultiple;
      }
    });

    this.selection.addLocalHook('beforeModifyTransformStart', (cellCoordsDelta) => {
      this.runHooks('modifyTransformStart', cellCoordsDelta);
    });
    this.selection.addLocalHook('afterModifyTransformStart', (coords, rowTransformDir, colTransformDir) => {
      this.runHooks('afterModifyTransformStart', coords, rowTransformDir, colTransformDir);
    });
    this.selection.addLocalHook('beforeModifyTransformEnd', (cellCoordsDelta) => {
      this.runHooks('modifyTransformEnd', cellCoordsDelta);
    });
    this.selection.addLocalHook('afterModifyTransformEnd', (coords, rowTransformDir, colTransformDir) => {
      this.runHooks('afterModifyTransformEnd', coords, rowTransformDir, colTransformDir);
    });
    this.selection.addLocalHook('afterDeselect', () => {
      this.#editorManager.destroyEditor();

      this._refreshBorders();
      removeClass(this.rootElement, ['fs-selection--rows', 'fs-selection--columns']);

      this.runHooks('afterDeselect');
    });
    this.selection.addLocalHook('insertRowRequire', (totalRows) => {
      this.alter('insert_row', totalRows, 1, 'auto');
    });
    this.selection.addLocalHook('insertColRequire', (totalCols) => {
      this.alter('insert_col', totalCols, 1, 'auto');
    });

    this.#grid = {
      /**
       * Inserts or removes rows and columns.
       *
       * @memberof Core#
       * @function alter
       * @private
       * @param {String} action Possible values: "insert_row", "insert_col", "remove_row", "remove_col".
       * @param {Number|Array} index Row or column visual index which from the alter action will be triggered.
       *                             Alter actions such as "remove_row" and "remove_col" support array indexes in the
       *                             format `[[index, amount], [index, amount]...]` this can be used to remove
       *                             non-consecutive columns or rows in one call.
       * @param {Number} [amount=1] Ammount rows or columns to remove.
       * @param {String} [source] Optional. Source of hook runner.
       * @param {Boolean} [keepEmptyRows] Optional. Flag for preventing deletion of empty rows.
       */
      alter: (action: string, index?: any, amount = 1, source?: string, keepEmptyRows?: boolean) => { // eslint-disable-line @typescript-eslint/no-explicit-any -- a number or IndexGroup[]
        let delta;

        function spliceWith(data: unknown[], startIndex: number, count: number, toInject?: string) {
          const valueFactory = () => {
            let result: unknown[] | AnyObject | undefined;

            if (toInject === 'array') {
              result = [];

            } else if (toInject === 'object') {
              result = {};
            }

            return result;
          };
          // `new Array(count)` (not `{ length: count }`) keeps how odd `amount` values behaved, e.g. a RangeError for 1.5.
          const spliceArgs = Array.from(new Array(count), () => valueFactory());

          data.splice(startIndex, 0, ...spliceArgs);
        }

        const normalizeIndexesGroup = (indexes: IndexGroup[]): IndexGroup[] => {
          if (indexes.length === 0) {
            return [];
          }

          const sortedIndexes = [...indexes];

          // Sort the indexes in ascending order.
          sortedIndexes.sort(([indexA], [indexB]) => {
            if (indexA === indexB) {
              return 0;
            }

            return indexA > indexB ? 1 : -1;
          });

          // Normalize the {index, amount} groups into bigger groups.
          const normalizedIndexes = sortedIndexes.reduce((acc, [groupIndex, groupAmount]) => {
            const previousItem = acc[acc.length - 1];
            const [prevIndex, prevAmount] = previousItem;
            const prevLastIndex = prevIndex + prevAmount;

            if (groupIndex <= prevLastIndex) {
              const amountToAdd = Math.max(groupAmount - (prevLastIndex - groupIndex), 0);

              previousItem[1] += amountToAdd;
            } else {
              acc.push([groupIndex, groupAmount]);
            }

            return acc;
          }, [sortedIndexes[0]]);

          return normalizedIndexes;
        };

        switch (action) {
          case 'insert_row': {
            const numberOfSourceRows = this.countSourceRows();

            if (this.getSettings().maxRows === numberOfSourceRows) {
              return;
            }
            index = (isDefined(index)) ? index : numberOfSourceRows;
            // Between visible rows, after any hidden rows above.
            const dataIndex = this.#recordTranslator.rows!.toOrdered(index);

            delta = this.#datamap.createRow(dataIndex, amount, source);
            spliceWith(this.#priv.cellSettings, dataIndex, amount, 'array');

            if (delta) {
              const currentRange = this.selection.selectedRange.current();

              if (this.selection.isSelected() && currentRange && currentRange.from.row >= index) {
                currentRange.from.row += delta;
                this.selection.transformEnd(delta, 0); // will call render() internally
              } else {
                this._refreshBorders(); // it will call render and prepare methods
              }
            }
            break;
          }

          case 'insert_col': {
            const dataIndex = isDefined(index) ? this.#recordTranslator.columns!.toOrdered(index) : index;

            delta = this.#datamap.createCol(dataIndex, amount, source);

            for (let row = 0, len = this.countSourceRows(); row < len; row++) {
              if (this.#priv.cellSettings[row]) {
                spliceWith(this.#priv.cellSettings[row], dataIndex, amount);
              }
            }

            if (delta) {
              if (Array.isArray(this.getSettings().colHeaders)) {
                // inserts empty (undefined) elements into the colHeader array
                this.getSettings().colHeaders.splice(dataIndex, 0, ...new Array(delta));
              }

              const currentRange = this.selection.selectedRange.current();

              if (this.selection.isSelected() && currentRange && currentRange.from.col >= index) {
                currentRange.from.col += delta;
                this.selection.transformEnd(0, delta); // will call render() internally
              } else {
                this._refreshBorders(); // it will call render and prepare methods
              }
            }
            break;
          }

          case 'remove_row': {
            const removeRow = (indexes: IndexGroup[]) => {
              let offset = 0;

              // Normalize the {index, amount} groups into bigger groups.
              arrayEach(indexes, ([groupIndex, groupAmount]) => {
                const calcIndex = isEmpty(groupIndex) ? this.countRows() - 1 : Math.max(groupIndex - offset, 0);

                // If the 'index' is an integer decrease it by 'offset' otherwise pass it through to make the value
                // compatible with datamap.removeCol method.
                if (Number.isInteger(groupIndex)) {
                  groupIndex = Math.max(groupIndex - offset, 0);
                }

                const rowsBefore = this.countSourceRows();

                // datamap.removeRow needs the index as it is, with undefined and null values.
                this.#datamap.removeRow(groupIndex, groupAmount, source);

                const removedRows = rowsBefore - this.countSourceRows();

                // beforeRemoveRow cancelled it: the cell meta and the frozen rows stay as they are.
                if (removedRows <= 0) {
                  return;
                }
                this.#priv.cellSettings.splice(calcIndex, removedRows);

                const totalRows = this.countRows();
                const fixedRowsTop = this.getSettings().fixedRowsTop;

                if (fixedRowsTop >= calcIndex + 1) {
                  this.getSettings().fixedRowsTop -= Math.min(groupAmount, fixedRowsTop - calcIndex);
                }

                const fixedRowsBottom = this.getSettings().fixedRowsBottom;

                if (fixedRowsBottom && calcIndex >= totalRows - fixedRowsBottom) {
                  this.getSettings().fixedRowsBottom -= Math.min(groupAmount, fixedRowsBottom);
                }

                offset += groupAmount;
              });
            };

            if (Array.isArray(index)) {
              removeRow(normalizeIndexesGroup(index));
            } else {
              removeRow([[index, amount]]);
            }

            this.#grid.adjustRowsAndCols();
            this._refreshBorders(); // it will call render and prepare methods
            break;
          }

          case 'remove_col': {
            const removeCol = (indexes: IndexGroup[]) => {
              let offset = 0;

              // Normalize the {index, amount} groups into bigger groups.
              arrayEach(indexes, ([groupIndex, groupAmount]) => {
                const calcIndex = isEmpty(groupIndex) ? this.countCols() - 1 : Math.max(groupIndex - offset, 0);

                let visualColumnIndex = this.#recordTranslator.toPhysicalColumn(calcIndex);

                // If the 'index' is an integer decrease it by 'offset' otherwise pass it through to make the value
                // compatible with datamap.removeCol method.
                if (Number.isInteger(groupIndex)) {
                  groupIndex = Math.max(groupIndex - offset, 0);
                }

                const columnsBefore = this.countCols();

                // datamap.removeCol needs the index as it is, with undefined and null values.
                this.#datamap.removeCol(groupIndex, groupAmount, source);

                // beforeRemoveCol cancelled it: the cell meta, frozen columns and headers stay as they are.
                if (this.countCols() === columnsBefore) {
                  return;
                }

                for (let row = 0, len = this.countSourceRows(); row < len; row++) {
                  if (this.#priv.cellSettings[row]) { // if row hasn't been rendered it wouldn't have cellSettings
                    this.#priv.cellSettings[row].splice(visualColumnIndex, groupAmount);
                  }
                }
                const fixedColumnsLeft = this.getSettings().fixedColumnsLeft;

                if (fixedColumnsLeft >= calcIndex + 1) {
                  this.getSettings().fixedColumnsLeft -= Math.min(groupAmount, fixedColumnsLeft - calcIndex);
                }

                if (Array.isArray(this.getSettings().colHeaders)) {
                  if (typeof visualColumnIndex === 'undefined') {
                    visualColumnIndex = -1;
                  }
                  this.getSettings().colHeaders.splice(visualColumnIndex, groupAmount);
                }

                offset += groupAmount;
              });
            };

            if (Array.isArray(index)) {
              removeCol(normalizeIndexesGroup(index));
            } else {
              removeCol([[index, amount]]);
            }

            this.#grid.adjustRowsAndCols();
            this._refreshBorders(); // it will call render and prepare methods

            break;
          }

          default: {
            throw new Error(`There is no such action "${action}"`);
          }
        }

        if (!keepEmptyRows) {
          this.#grid.adjustRowsAndCols(); // makes sure that we did not add rows that will be removed in next refresh
        }
      },

      /**
       * Makes sure there are empty rows at the bottom of the table
       */
      adjustRowsAndCols: () => {
        if (this.#priv.settings.minRows) {
          // should I add empty rows to data source to meet minRows?
          const rows = this.countRows();

          if (rows < this.#priv.settings.minRows) {
            for (let r = 0, minRows = this.#priv.settings.minRows; r < minRows - rows; r++) {
              this.#datamap.createRow(this.countSourceRows(), 1, 'auto');
            }
          }
        }
        if (this.#priv.settings.minSpareRows) {
          let emptyRows = this.countEmptyRows(true);

          // should I add empty rows to meet minSpareRows?
          if (emptyRows < this.#priv.settings.minSpareRows) {
            for (; emptyRows < this.#priv.settings.minSpareRows && this.countSourceRows() < this.#priv.settings.maxRows; emptyRows++) {
              this.#datamap.createRow(this.countSourceRows(), 1, 'auto');
            }
          }
        }
        {
          let emptyCols = 0;

          // count currently empty cols
          if (this.#priv.settings.minCols || this.#priv.settings.minSpareCols) {
            emptyCols = this.countEmptyCols(true);
          }

          // should I add empty cols to meet minCols?
          if (this.#priv.settings.minCols && !this.#priv.settings.columns && this.countCols() < this.#priv.settings.minCols) {
            for (; this.countCols() < this.#priv.settings.minCols; emptyCols++) {
              this.#datamap.createCol(this.#countAllCols(), 1, 'auto');
            }
          }
          // should I add empty cols to meet minSpareCols?
          if (this.#priv.settings.minSpareCols && !this.#priv.settings.columns && this.dataType === 'array' &&
              emptyCols < this.#priv.settings.minSpareCols) {
            for (; emptyCols < this.#priv.settings.minSpareCols && this.countCols() < this.#priv.settings.maxCols; emptyCols++) {
              this.#datamap.createCol(this.#countAllCols(), 1, 'auto');
            }
          }
        }
        const rowCount = this.countRows();
        const colCount = this.countCols();

        if (rowCount === 0 || colCount === 0) {
          this.selection.deselect();
        }

        if (this.selection.isSelected()) {
          arrayEach(this.selection.selectedRange, (range) => {
            let selectionChanged = false;
            let fromRow = range.from.row;
            let fromCol = range.from.col;
            let toRow = range.to.row;
            let toCol = range.to.col;

            // if selection is outside, move selection to last row
            if (fromRow > rowCount - 1) {
              fromRow = rowCount - 1;
              selectionChanged = true;

              if (toRow > fromRow) {
                toRow = fromRow;
              }
            } else if (toRow > rowCount - 1) {
              toRow = rowCount - 1;
              selectionChanged = true;

              if (fromRow > toRow) {
                fromRow = toRow;
              }
            }
            // if selection is outside, move selection to last row
            if (fromCol > colCount - 1) {
              fromCol = colCount - 1;
              selectionChanged = true;

              if (toCol > fromCol) {
                toCol = fromCol;
              }
            } else if (toCol > colCount - 1) {
              toCol = colCount - 1;
              selectionChanged = true;

              if (fromCol > toCol) {
                fromCol = toCol;
              }
            }

            if (selectionChanged) {
              this.selectCell(fromRow, fromCol, toRow, toCol);
            }
          });
        }
        if (this.view) {
          this.view.wt.wtOverlays.adjustElementsSize();
        }
      },

      /**
       * Populate the data from the provided 2d array from the given cell coordinates.
       *
       * @private
       * @param {Object} start Start selection position. Visual indexes.
       * @param {Array} input 2d data array.
       * @param {Object} [end] End selection position (only for drag-down mode). Visual indexes.
       * @param {String} [source="populateFromArray"] Source information string.
       * @param {String} [method="overwrite"] Populate method. Possible options: `shift_down`, `shift_right`, `overwrite`.
       * @param {String} [direction] Not used (see #68).
       * @param {Array} deltas The deltas array. A difference between values of adjacent cells.
       *                       Useful **only** when the type of handled cells is `numeric`.
       * @returns {Object|undefined} ending td in pasted area (only if any cell was changed).
       */
      populateFromArray: (start: Coords, input: any[][], end?: Coords, source?: string, method?: string, // eslint-disable-line @typescript-eslint/no-explicit-any -- any values
        direction?: string, deltas?: unknown[]) => {
        // The `direction` argument does nothing (see #68).
        let r;
        let rlen;
        let c;
        let clen;
        const setData: unknown[][] = [];
        const current = {} as Coords;

        rlen = input.length;

        if (rlen === 0) {
          return false;
        }

        let repeatCol;
        let repeatRow;
        let cmax;
        let rmax;

        // insert data with specified pasteMode method
        switch (method) {
          case 'shift_down': {
            repeatCol = end ? end.col - start.col + 1 : 0;
            repeatRow = end ? end.row - start.row + 1 : 0;
            input = translateRowsToColumns(input);
            for (c = 0, clen = input.length, cmax = Math.max(clen, repeatCol); c < cmax; c++) {
              if (c < clen) {
                for (r = 0, rlen = input[c].length; r < repeatRow - rlen; r++) {
                  input[c].push(input[c][r % rlen]);
                }
                input[c].unshift(start.col + c, start.row, 0);
                this.spliceCol(...(input[c] as SpliceArgs));
              } else {
                input[c % clen][0] = start.col + c;
                this.spliceCol(...(input[c % clen] as SpliceArgs));
              }
            }
            break;
          }

          case 'shift_right': {
            repeatCol = end ? end.col - start.col + 1 : 0;
            repeatRow = end ? end.row - start.row + 1 : 0;
            for (r = 0, rlen = input.length, rmax = Math.max(rlen, repeatRow); r < rmax; r++) {
              if (r < rlen) {
                for (c = 0, clen = input[r].length; c < repeatCol - clen; c++) {
                  input[r].push(input[r][c % clen]);
                }
                input[r].unshift(start.row + r, start.col, 0);
                this.spliceRow(...(input[r] as SpliceArgs));
              } else {
                input[r % rlen][0] = start.row + r;
                this.spliceRow(...(input[r % rlen] as SpliceArgs));
              }
            }
            break;
          }

          case 'overwrite':
          default: {
            // overwrite and other not specified options
            current.row = start.row;
            current.col = start.col;

            const selected = { // selected range
              row: (end && start) ? (end.row - start.row + 1) : 1,
              col: (end && start) ? (end.col - start.col + 1) : 1
            };
            let skippedRow = 0;
            let skippedColumn = 0;
            let cellMeta;

            const getInputValue = function getInputValue(row: number, col: number | null = null) {
              const rowValue = input[row % input.length];

              if (col !== null) {
                return rowValue[col % rowValue.length];
              }

              return rowValue;
            };
            const rowInputLength = input.length;
            const rowSelectionLength = end ? end.row - start.row + 1 : 0;

            if (end) {
              rlen = rowSelectionLength;
            } else {
              rlen = Math.max(rowInputLength, rowSelectionLength);
            }
            for (r = 0; r < rlen; r++) {
              if ((end && current.row > end.row && rowSelectionLength > rowInputLength) ||
                  (!this.#priv.settings.allowInsertRow && current.row > this.countRows() - 1) ||
                  (current.row >= this.#priv.settings.maxRows)) {
                break;
              }
              const visualRow = r - skippedRow;
              const colInputLength = getInputValue(visualRow).length;
              const colSelectionLength = end ? end.col - start.col + 1 : 0;

              if (end) {
                clen = colSelectionLength;
              } else {
                clen = Math.max(colInputLength, colSelectionLength);
              }
              current.col = start.col;
              cellMeta = this.getCellMeta(current.row, current.col);

              if ((source === 'CopyPaste.paste' || source === 'Autofill.autofill') && cellMeta.skipRowOnPaste) {
                skippedRow += 1;
                current.row += 1;
                rlen += 1;
                continue;
              }
              skippedColumn = 0;

              for (c = 0; c < clen; c++) {
                if ((end && current.col > end.col && colSelectionLength > colInputLength) ||
                    (!this.#priv.settings.allowInsertColumn && current.col > this.countCols() - 1) ||
                    (current.col >= this.#priv.settings.maxCols)) {
                  break;
                }
                cellMeta = this.getCellMeta(current.row, current.col);

                if ((source === 'CopyPaste.paste' || source === 'Autofill.fill') && cellMeta.skipColumnOnPaste) {
                  skippedColumn += 1;
                  current.col += 1;
                  clen += 1;
                  continue;
                }
                if (cellMeta.readOnly) {
                  current.col += 1;
                  continue;
                }
                const visualColumn = c - skippedColumn;
                let pushData = true;
                let value = getInputValue(visualRow, visualColumn);
                const orgValue = this.getDataAtCell(current.row, current.col);
                const index = {
                  row: visualRow,
                  col: visualColumn
                };

                if (source === 'Autofill.fill') {
                  const result = this.runHooks('beforeAutofillInsidePopulate', index, direction, input, deltas, {}, selected);

                  if (result) {
                    value = isUndefined(result.value) ? value : result.value;
                  }
                }
                if (value !== null && typeof value === 'object') {
                  if (orgValue === null || typeof orgValue !== 'object') {
                    pushData = false;

                  } else {
                    const orgValueSchema = duckSchema((orgValue as AnyObject)[0] || orgValue);
                    const valueSchema = duckSchema(value[0] || value);

                    if (isObjectEqual(orgValueSchema, valueSchema)) {
                      value = deepClone(value);
                    } else {
                      pushData = false;
                    }
                  }

                } else if (orgValue !== null && typeof orgValue === 'object') {
                  pushData = false;
                }
                if (pushData) {
                  setData.push([current.row, current.col, value]);
                }
                current.col += 1;
              }
              current.row += 1;
            }
            this.setDataAtCell(setData, null, null, source || 'populateFromArray');
            break;
          }
        }
      },
    };

    this.timeouts = [];

    this.immediates = [];

    Hooks.getSingleton().run(this, 'construct');
  }


  /**
   * Internal function to set `language` key of settings.
   *
   * @private
   * @param {String} languageCode Language code for specific language i.e. 'en-US', 'pt-BR', 'de-DE'
   * @fires Hooks#afterLanguageChange
   */
  #setLanguage(languageCode: string) {
    const normalizedLanguageCode = normalizeLanguageCode(languageCode);

    if (hasLanguageDictionary(normalizedLanguageCode)) {
      this.runHooks('beforeLanguageChange', normalizedLanguageCode);

      this.#GridSettings.prototype.language = normalizedLanguageCode;

      this.runHooks('afterLanguageChange', normalizedLanguageCode);

    } else {
      warnUserAboutLanguageRegistration(languageCode);
    }
  }


  init() {
    this.#dataSource.setData(this.#priv.settings.data);
    this.runHooks('beforeInit');

    if (isMobileBrowser()) {
      addClass(this.rootElement, 'mobile');
    }

    this.updateSettings(this.#priv.settings, true);

    this.view = new TableView(this);
    this.#editorManager = EditorManager.getInstance(this, this.#priv, this.selection);

    this.forceFullRender = true; // used when data was changed

    this.runHooks('init');
    this.view.render();

    if (typeof this.#priv.firstRun === 'object') {
      this.runHooks('afterChange', this.#priv.firstRun[0], this.#priv.firstRun[1]);
      this.#priv.firstRun = false;
    }
    this.runHooks('afterInit');

    // More sheets from the start (`sheets`), or the tab bar with one sheet (`sheetTabs: true`).
    const { sheets, sheetTabs } = this.#priv.settings;

    if (!getWorkbook(this) && (sheetTabs === true || (Array.isArray(sheets) && sheets.length))) {
      const workbook = this.#workbook();

      (Array.isArray(sheets) ? sheets : []).forEach((sheet: AnyObject) => workbook.add(sheet.id, sheet));
      workbook.renderTabs();
    }
    // `sidePanel: 'comments'` opens a panel from the start.
    const { sidePanel } = this.#priv.settings;

    // (Not for a sheet that addSheet creates: it is inside the document's frame.)
    if (typeof sidePanel === 'string' && (this.#frame || !this.rootElement.classList.contains('fs-document__sheet'))) {
      this.openPanel(sidePanel);
    }
  }

  /** The document this grid belongs to; created on the first call (a grid alone has none and pays nothing). */
  #workbook(): Workbook {
    return getWorkbook(this) || new Workbook(this, (rootElement, settings) => {
      const sheet = new Core(rootElement, settings);

      sheet.init();

      return sheet;
    });
  }


  #validateChanges(changes: (Change | null)[], source: string | undefined, callback: () => void) {
    const waitingForValidator = new ValidatorsQueue();
    // Trimmed first: `\s*` on both sides of the optional sign made the test quadratic on long runs of spaces.
    const isNumericData = (value: string) => value.length > 0 && /^[+-.]?\s*(?:(?:\d+(?:(\.|,)\d+)?(?:e[+-]?\d+)?)|(?:0x[a-f\d]+))$/.test(value.trim());

    // Numeric text becomes a number first (beforeChange gets the number).
    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i] === null) {
        changes.splice(i, 1);
      } else {
        const change = changes[i] as Change;
        const [row, prop, , newValue] = change;
        const cellProperties = this.getCellMeta(row, this.#datamap.propToCol(prop));

        if (cellProperties.type === 'numeric' && typeof newValue === 'string' && isNumericData(newValue)) {
          change[3] = getParsedNumber(newValue);
        }
      }
    }

    // beforeChange runs before the validators, so a change it cancels (set to null, or all with `false`) is not
    // validated.
    if (changes.length) {
      const beforeChangeResult = this.runHooks('beforeChange', changes, source || 'edit');

      if (isFunction(beforeChangeResult)) {
        warn('Your beforeChange callback returns a function. It\'s not supported (the returned function will not be executed).');
      } else if (beforeChangeResult === false) {
        changes.splice(0, changes.length); // invalidate all changes (remove everything from array)
      }
    }

    waitingForValidator.onQueueEmpty = () => callback(); // called when async validators are resolved

    for (let i = changes.length - 1; i >= 0; i--) {
      if (changes[i] === null) {
        changes.splice(i, 1);
      } else {
        const change = changes[i] as Change;
        const cellProperties = this.getCellMeta(change[0], this.#datamap.propToCol(change[1]));

        if (this.getCellValidator(cellProperties)) {
          waitingForValidator.addValidatorToQueue();
          this.validateCell(change[3], cellProperties, ((index: number, cellPropertiesReference: AnyObject) => {
            return (result: unknown) => {
              if (typeof result !== 'boolean') {
                throw new Error('Validation error: result is not boolean');
              }
              if (result === false && cellPropertiesReference.allowInvalid === false) {
                changes.splice(index, 1); // cancel the change
                cellPropertiesReference.valid = true; // we cancelled the change, so cell value is still valid
                const cell = this.getCell(cellPropertiesReference.visualRow, cellPropertiesReference.visualCol);
                if (cell !== null) {
                  removeClass(cell, this.getSettings().invalidCellClassName);
                }
              }
              waitingForValidator.removeValidatorFormQueue();
            };
          })(i, cellProperties), source);
        }
      }
    }
    waitingForValidator.checkIfQueueIsEmpty();
  }


  /**
   * Internal function to apply changes. Called after validateChanges
   *
   * @private
   * @param {Array} changes Array in form of [row, prop, oldValue, newValue]
   * @param {String} source String that identifies how this change will be described in changes array (useful in onChange callback)
   * @fires Hooks#beforeChangeRender
   * @fires Hooks#afterChange
   */
  #applyChanges(changes: (Change | null)[], source?: string) {
    let i = changes.length - 1;

    if (i < 0) {
      return;
    }

    for (; i >= 0; i--) {
      let skipThisChange = false;
      const change = changes[i];

      if (change === null) {
        changes.splice(i, 1);
        continue;
      }

      if ((change[2] === null || change[2] === void 0)
        && (change[3] === null || change[3] === void 0)) {
        continue;
      }

      if (this.#priv.settings.allowInsertRow) {
        while (change[0] > this.countRows() - 1) {
          const numberOfCreatedRows = this.#datamap.createRow(void 0, void 0, source);

          if (numberOfCreatedRows === 0) {
            skipThisChange = true;
            break;
          }
        }
      }

      if (skipThisChange) {
        continue;
      }

      if (this.dataType === 'array' && (!this.#priv.settings.columns || this.#priv.settings.columns.length === 0) && this.#priv.settings.allowInsertColumn) {
        while (this.#datamap.propToCol(change[1]) > this.countCols() - 1) {
          this.#datamap.createCol(void 0, void 0, source);
        }
      }

      this.#datamap.set(change[0], change[1], change[3]);
    }

    this.forceFullRender = true; // used when data was changed
    this.#grid.adjustRowsAndCols();
    this.runHooks('beforeChangeRender', changes, source);
    this.#editorManager.lockEditor();
    this._refreshBorders(null);
    this.#editorManager.unlockEditor();
    this.view.wt.wtOverlays.adjustElementsSize();
    this.runHooks('afterChange', changes, source || 'edit');

    const activeEditor = this.getActiveEditor();

    // Only some editors have refreshValue (none of the built-in ones; a custom editor may).
    const refreshable = activeEditor as (typeof activeEditor & { refreshValue?: () => void }) | undefined;

    if (refreshable && isDefined(refreshable.refreshValue)) {
      refreshable.refreshValue();
    }
  }


  /**
   * Validate a single cell.
   *
   * @param {String|Number} value
   * @param cellProperties
   * @param callback
   * @param source
   */
  validateCell(value: unknown, cellProperties: AnyObject, callback: (valid: boolean) => void, source?: string) {
    let validator = this.getCellValidator(cellProperties);

    // the `canBeValidated = false` argument suggests, that the cell passes validation by default.
    const done = (valid: boolean, canBeValidated = true) => {
      // Fixes GH#3903
      if (!canBeValidated || cellProperties.hidden === true) {
        callback(valid);
        return;
      }

      const col = cellProperties.visualCol;
      const row = cellProperties.visualRow;
      const td = this.getCell(row, col, true);

      if (td && td.nodeName !== 'TH') {
        this.view.wt.wtSettings.settings.cellRenderer(row, col, td);
      }
      callback(valid);
    };

    if (isRegExp(validator)) {
      validator = (function(expression: RegExp) {
        return function(cellValue: string, validatorCallback: (valid: boolean) => void) {
          validatorCallback(expression.test(cellValue));
        };
      }(validator));
    }

    if (isFunction(validator)) {
      value = this.runHooks('beforeValidate', value, cellProperties.visualRow, cellProperties.prop, source);

      // To provide consistent behaviour, validation should be always asynchronous
      this._registerTimeout(setTimeout(() => {
        validator.call(cellProperties, value, (valid: boolean) => {
          valid = this.runHooks('afterValidate', valid, value, cellProperties.visualRow, cellProperties.prop, source);
          cellProperties.valid = valid;

          done(valid);
          this.runHooks('postAfterValidate', valid, value, cellProperties.visualRow, cellProperties.prop, source);
        });
      }, 0));

    } else {
      // resolve callback even if validator function was not found
      this._registerTimeout(setTimeout(() => {
        cellProperties.valid = true;
        done(cellProperties.valid, false);
      }, 0));
    }
  }


  /**
   * @description
   * Set new value to a cell. To change many cells at once (recommended way), pass an array of `changes` in format
   * `[[row, col, value],...]` as the first argument.
   *
   * @memberof Core#
   * @function setDataAtCell
   * @param {Number|Array} row Visual row index or array of changes in format `[[row, col, value],...]`.
   * @param {Number} [column] Visual column index.
   * @param {String} [value] New value.
   * @param {String} [source] String that identifies how this change will be described in the changes array (useful in onAfterChange or onBeforeChange callback).
   */
  setDataAtCell(row: number | unknown[][], column?: number | string | null, value?: unknown, source?: string) {
    const input = setDataInputToArray(row, column, value);
    const changes: Change[] = [];
    let changeSource = source;
    let i;
    let ilen;
    let prop;

    for (i = 0, ilen = input.length; i < ilen; i++) {
      if (typeof input[i] !== 'object') {
        throw new Error('Method `setDataAtCell` accepts row number or changes array of arrays as its first parameter');
      }
      if (typeof input[i][1] !== 'number') {
        throw new Error('Method `setDataAtCell` accepts row and column number as its parameters. If you want to use object property name, use method `setDataAtRowProp`');
      }
      prop = this.#datamap.colToProp(input[i][1]);
      changes.push([
        input[i][0],
        prop,
        this.#dataSource.getAtCell(this.#recordTranslator.toPhysicalRow(input[i][0]), input[i][1]),
        input[i][2],
      ]);
    }

    if (!changeSource && typeof row === 'object') {
      changeSource = column as string;
    }

    this.runHooks('afterSetDataAtCell', changes, changeSource);

    this.#validateChanges(changes, changeSource, () => {
      this.#applyChanges(changes, changeSource);
    });
  }


  /**
   * @description
   * Set new value to a cell. To change many cells at once (recommended way), pass an array of `changes` in format
   * `[[row, prop, value],...]` as the first argument.
   *
   * @memberof Core#
   * @function setDataAtRowProp
   * @param {Number|Array} row Visual row index or array of changes in format `[[row, prop, value], ...]`.
   * @param {String} prop Property name or the source string (e.g. `'first.name'` or `'0'`).
   * @param {String} value Value to be set.
   * @param {String} [source] String that identifies how this change will be described in changes array (useful in onChange callback).
   */
  setDataAtRowProp(row: number | unknown[][], prop: Prop | null, value?: unknown, source?: string) {
    const input = setDataInputToArray(row, prop, value);
    const changes: Change[] = [];
    let changeSource = source;
    let i;
    let ilen;

    for (i = 0, ilen = input.length; i < ilen; i++) {
      changes.push([
        input[i][0],
        input[i][1],
        this.#dataSource.getAtCell(this.#recordTranslator.toPhysicalRow(input[i][0]), input[i][1]),
        input[i][2],
      ]);
    }

    if (!changeSource && typeof row === 'object') {
      changeSource = prop as string;
    }

    this.runHooks('afterSetDataAtRowProp', changes, changeSource);

    this.#validateChanges(changes, changeSource, () => {
      this.#applyChanges(changes, changeSource);
    });
  }


  /**
   * Listen to the keyboard input on document body. This allows FreeSheet to capture keyboard events and respond
   * in the right way.
   *
   * @memberof Core#
   * @function listen
   * @param {Boolean} [modifyDocumentFocus=true] If `true`, currently focused element will be blured (which returns focus
   *                                             to the document.body). Otherwise the active element does not lose its focus.
   * @fires Hooks#afterListen
   */
  listen(modifyDocumentFocus: boolean = true) {
    if (modifyDocumentFocus) {
      const invalidActiveElement = !document.activeElement || (document.activeElement && document.activeElement.nodeName === void 0);

      if (document.activeElement && document.activeElement !== document.body && !invalidActiveElement) {
        (document.activeElement as HTMLElement).blur();

      } else if (invalidActiveElement) { // IE
        document.body.focus();
      }
    }

    if (this && !this.isListening()) {
      activeGuid = this.guid;
      this.runHooks('afterListen');
    }
  }


  /**
   * Stop listening to keyboard input on the document body. Calling this method makes the FreeSheet inactive for
   * any keyboard events.
   *
   * @memberof Core#
   * @function unlisten
   */
  unlisten() {
    if (this.isListening()) {
      activeGuid = null;
      this.runHooks('afterUnlisten');
    }
  }


  /**
   * Returns `true` if the current FreeSheet instance is listening to keyboard input on document body.
   *
   * @memberof Core#
   * @function isListening
   * @returns {Boolean} `true` if the instance is listening, `false` otherwise.
   */
  isListening() {
    return activeGuid === this.guid;
  }


  /**
   * Destroys the current editor, render the table and prepares the editor of the newly selected cell.
   *
   * @memberof Core#
   * @function destroyEditor
   * @param {Boolean} [revertOriginal=false] If `true`, the previous value will be restored. Otherwise, the edited value will be saved.
   * @param {Boolean} [prepareEditorIfNeeded=true] If `true` the editor under the selected cell will be prepared to open.
   */
  destroyEditor(revertOriginal: boolean = false, prepareEditorIfNeeded: boolean = true) {
    this._refreshBorders(revertOriginal, prepareEditorIfNeeded);
  }


  /**
   * Populate cells at position with 2D input array (e.g. `[[1, 2], [3, 4]]`). Use `endRow`, `endCol` when you
   * want to cut input when a certain row is reached.
   *
   * Optional `method` argument has the same effect as pasteMode option (see {@link Options#pasteMode}).
   *
   * @memberof Core#
   * @function populateFromArray
   * @param {Number} row Start visual row index.
   * @param {Number} column Start visual column index.
   * @param {Array} input 2d array
   * @param {Number} [endRow] End visual row index (use when you want to cut input when certain row is reached).
   * @param {Number} [endCol] End visual column index (use when you want to cut input when certain column is reached).
   * @param {String} [source=populateFromArray] Used to identify this call in the resulting events (beforeChange, afterChange).
   * @param {String} [method=overwrite] Populate method, possible values: `'shift_down'`, `'shift_right'`, `'overwrite'`.
   * @param {String} [direction] Not used: it has no effect and will be removed in 1.0.
   * @param {Array} deltas The deltas array. A difference between values of adjacent cells.
   *                       Useful **only** when the type of handled cells is `numeric`.
   */
  populateFromArray(row: number, column: number, input: unknown[], endRow?: number | null, endCol?: number | null, source?: string, method?: string | null, direction?: string, deltas?: unknown[]) {
    if (!(typeof input === 'object' && typeof input[0] === 'object')) {
      throw new Error('populateFromArray parameter `input` must be an array of arrays'); // API changed in 0.9-beta2, let's check if you use it correctly
    }

    const c = typeof endRow === 'number' ? new CellCoords(endRow, endCol) : null;

    return this.#grid.populateFromArray(new CellCoords(row, column), input, c, source, method, direction, deltas);
  }


  /**
   * Adds/removes data from the column. This method works the same as Array.splice for arrays (see {@link DataMap#spliceCol}).
   *
   * @memberof Core#
   * @function spliceCol
   * @param {Number} column Index of the column in which do you want to do splice.
   * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end.
   * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed.
   * @param {...Number} [elements] The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array.
   */
  spliceCol(column: number, index: number, amount: number, ...elements: unknown[]) {
    return this.#datamap.spliceCol(column, index, amount, ...elements);
  }


  /**
   * Adds/removes data from the row. This method works the same as Array.splice for arrays (see {@link DataMap#spliceRow}).
   *
   * @memberof Core#
   * @function spliceRow
   * @param {Number} row Index of column in which do you want to do splice.
   * @param {Number} index Index at which to start changing the array. If negative, will begin that many elements from the end.
   * @param {Number} amount An integer indicating the number of old array elements to remove. If amount is 0, no elements are removed.
   * @param {...Number} [elements] The elements to add to the array. If you don't specify any elements, spliceCol simply removes elements from the array.
   */
  spliceRow(row: number, index: number, amount: number, ...elements: unknown[]) {
    return this.#datamap.spliceRow(row, index, amount, ...elements);
  }


  /**
   * Returns indexes of the currently selected cells as an array of arrays `[[startRow, startCol, endRow, endCol],...]`.
   *
   * Start row and start column are the coordinates of the active cell (where the selection was started).
   *
   * The version 0.36.0 adds a non-consecutive selection feature. Since this version, the method returns an array of arrays.
   * Additionally to collect the coordinates of the currently selected area (as it was previously done by the method)
   * you need to use `getSelectedLast` method.
   *
   * @memberof Core#
   * @function getSelected
   * @returns {Array[]|undefined} An array of arrays of the selection's coordinates.
   */
  getSelected() { // https://github.com/handsontable/handsontable/issues/44  //cjl
    if (this.selection.isSelected()) {
      // `getSelectedRange()` is an iterable SelectionRange, not an array.
      return Array.from(this.selection.getSelectedRange(),
        ({ from, to }): [number, number, number, number] => [from.row, from.col, to.row, to.col]);
    }
  }


  /**
   * Returns the last coordinates applied to the table as a an array `[startRow, startCol, endRow, endCol]`.
   *
   * @since 0.36.0
   * @memberof Core#
   * @function getSelectedLast
   * @returns {Array|undefined} An array of the selection's coordinates.
   */
  getSelectedLast() {
    const selected = this.getSelected();
    let result;

    if (selected && selected.length > 0) {
      result = selected[selected.length - 1];
    }

    return result;
  }


  /**
   * Returns the current selection as an array of CellRange objects.
   *
   * The version 0.36.0 adds a non-consecutive selection feature. Since this version, the method returns an array of arrays.
   * Additionally to collect the coordinates of the currently selected area (as it was previously done by the method)
   * you need to use `getSelectedRangeLast` method.
   *
   * @memberof Core#
   * @function getSelectedRange
   * @returns {CellRange[]|undefined} Selected range object or undefined if there is no selection.
   */
  getSelectedRange() { // https://github.com/handsontable/handsontable/issues/44  //cjl
    if (this.selection.isSelected()) {
      return Array.from(this.selection.getSelectedRange());
    }
  }


  /**
   * Returns the last coordinates applied to the table as a CellRange object.
   *
   * @memberof Core#
   * @function getSelectedRangeLast
   * @since 0.36.0
   * @returns {CellRange|undefined} Selected range object or undefined` if there is no selection.
   */
  getSelectedRangeLast() {
    const selectedRange = this.getSelectedRange();
    let result;

    if (selectedRange && selectedRange.length > 0) {
      result = selectedRange[selectedRange.length - 1];
    }

    return result;
  }


  /**
   * Erases content from cells that have been selected in the table.
   *
   * @memberof Core#
   * @function emptySelectedCells
   * @since 0.36.0
   */
  emptySelectedCells() {
    if (!this.selection.isSelected()) {
      return;
    }
    const changes: [number, number, string][] = [];

    arrayEach(this.selection.getSelectedRange(), (cellRange) => {
      const topLeft = cellRange.getTopLeftCorner();
      const bottomRight = cellRange.getBottomRightCorner();

      rangeEach(topLeft.row, bottomRight.row, (row) => {
        rangeEach(topLeft.col, bottomRight.col, (column) => {
          if (!this.getCellMeta(row, column).readOnly) {
            changes.push([row, column, '']);
          }
        });
      });
    });

    if (changes.length > 0) {
      this.setDataAtCell(changes);
    }
  }


  /**
   * Rerender the table. Calling this method starts the process of recalculating, redrawing and applying the changes
   * to the DOM. While rendering the table all cell renderers are recalled.
   *
   * Calling this method manually is not recommended. FreeSheet tries to render itself by choosing the most
   * optimal moments in its lifecycle.
   *
   * @memberof Core#
   * @function render
   */
  render() {
    if (this.view) {
      this.renderCall = true;
      this.forceFullRender = true; // used when data was changed
      this.#editorManager.lockEditor();
      this._refreshBorders(null);
      this.#editorManager.unlockEditor();
    }
  }


  /**
   * Loads new data to FreeSheet. Loading new data resets the cell meta.
   *
   * @memberof Core#
   * @function loadData
   * @param {Array} data Array of arrays or array of objects containing data.
   * @fires Hooks#afterLoadData
   * @fires Hooks#afterChange
   */
  loadData(data: any) { // eslint-disable-line @typescript-eslint/no-explicit-any -- an array, or a collection with push and splice
    // A plugin can give the rows the grid works with (nested rows: the tree's rows, parents before their children).
    data = this.runHooks('beforeLoadData', data, this.#priv.firstRun);
    if (Array.isArray(this.#priv.settings.dataSchema)) {
      this.dataType = 'array';
    } else if (isFunction(this.#priv.settings.dataSchema)) {
      this.dataType = 'function';
    } else {
      this.dataType = 'object';
    }

    if (this.#datamap) {
      this.#datamap.destroy();
    }
    this.#datamap = new DataMap(this, this.#priv, this.#GridSettings);

    if (typeof data === 'object' && data !== null) {
      if (!(data.push && data.splice)) { // check if data is array. Must use duck-type check so Backbone Collections also pass it
        // when data is not an array, attempt to make a single-row array of it
        data = [data];
      }

    } else if (data === null) {
      const dataSchema = this.#datamap.getSchema();
      data = [];
      let row;

      for (let r = 0, rlen = this.#priv.settings.startRows; r < rlen; r++) {
        if ((this.dataType === 'object' || this.dataType === 'function') && this.#priv.settings.dataSchema) {
          row = deepClone(dataSchema);
          data.push(row);

        } else if (this.dataType === 'array') {
          row = deepClone(dataSchema[0]);
          data.push(row);

        } else {
          row = [];

          for (let c = 0, clen = this.#priv.settings.startCols; c < clen; c++) {
            row.push(null);
          }

          data.push(row);
        }
      }

    } else {
      throw new Error(`loadData only accepts array of objects or array of arrays (${typeof data} given)`);
    }

    this.#priv.isPopulated = false;
    this.#GridSettings.prototype.data = data;

    if (Array.isArray(data[0])) {
      this.dataType = 'array';
    }

    this.#datamap.dataSource = data;
    this.#dataSource.data = data;
    this.#dataSource.dataType = this.dataType;
    this.#dataSource.colToProp = this.#datamap.colToProp.bind(this.#datamap);
    this.#dataSource.propToCol = this.#datamap.propToCol.bind(this.#datamap);

    this.#priv.cellSettings.length = 0; // clear the cell settings cache

    this.#grid.adjustRowsAndCols();
    this.runHooks('afterLoadData', this.#priv.firstRun);

    if (this.#priv.firstRun) {
      this.#priv.firstRun = [null, 'loadData'];
    } else {
      this.runHooks('afterChange', null, 'loadData');
      this.render();
    }
    this.#priv.isPopulated = true;
  }


  /**
   * Returns the current data object (the same one that was passed by `data` configuration option or `loadData` method,
   * unless the `modifyRow` hook was used to trim some of the rows. If that's the case - use the {@link Core#getSourceData} method.).
   *
   * Optionally you can provide cell range by defining `row`, `column`, `row2`, `column2` to get only a fragment of table data.
   *
   * @memberof Core#
   * @function getData
   * @param {Number} [row] From visual row index.
   * @param {Number} [column] From visual column index.
   * @param {Number} [row2] To visual row index.
   * @param {Number} [column2] To visual column index.
   * @returns {Array[]} Array with the data.
   * @example
   * ```js
   * // Get all data (in order how it is rendered in the table).
   * hot.getData();
   * // Get data fragment (from top-left 0, 0 to bottom-right 3, 3).
   * hot.getData(3, 3);
   * // Get data fragment (from top-left 2, 1 to bottom-right 3, 3).
   * hot.getData(2, 1, 3, 3);
   * ```
   */
  getData(row?: number, column?: number, row2?: number, column2?: number) {
    if (isUndefined(row)) {
      return this.#datamap.getAll();
    }

    return this.#datamap.getRange(new CellCoords(row, column), new CellCoords(row2, column2), this.#datamap.DESTINATION_RENDERER);
  }


  /**
   * Returns a string value of the selected range. Each column is separated by tab, each row is separated by a new
   * line character (see {@link DataMap#getCopyableText}).
   *
   * @memberof Core#
   * @function getCopyableText
   * @param {Number} startRow From visual row index.
   * @param {Number} startCol From visual column index.
   * @param {Number} endRow To visual row index.
   * @param {Number} endCol To visual column index.
   * @returns {String}
   */
  getCopyableText(startRow: number, startCol: number, endRow: number, endCol: number) {
    return this.#datamap.getCopyableText(new CellCoords(startRow, startCol), new CellCoords(endRow, endCol));
  }


  /**
   * Returns the data's copyable value at specified `row` and `column` index (see {@link DataMap#getCopyable}).
   *
   * @memberof Core#
   * @function getCopyableData
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @returns {String}
   */
  getCopyableData(row: number, column: number) {
    return this.#datamap.getCopyable(row, this.#datamap.colToProp(column));
  }


  /**
   * Returns schema provided by constructor settings. If it doesn't exist then it returns the schema based on the data
   * structure in the first row.
   *
   * @memberof Core#
   * @function getSchema
   * @returns {Object} Schema object.
   */
  getSchema() {
    return this.#datamap.getSchema();
  }


  /**
   * Use it if you need to change configuration after initialization. The `settings` argument is an object containing the new
   * settings, declared the same way as in the initial settings object.
   *
   * __Note__, that although the `updateSettings` method doesn't overwrite the previously declared settings, it might reset
   * the settings made post-initialization. (for example - ignore changes made using the columnResize feature).
   *
   * @memberof Core#
   * @function updateSettings
   * @param {Object} settings New settings object (see {@link Options}).
   * @param {Boolean} [init=false] Internally used for in initialization mode.
   * @example
   * ```js
   * hot.updateSettings({
   *    contextMenu: true,
   *    colHeaders: true,
   *    fixedRowsTop: 2
   * });
   * ```
   * @fires Hooks#afterCellMetaReset
   * @fires Hooks#afterUpdateSettings
   */
  updateSettings(newSettings: AnyObject, init: boolean = false) {
    let settings = newSettings;
    let columnsAsFunc = false;
    let i;
    let j;
    let clen;

    if (isDefined(settings.rows)) {
      throw new Error('"rows" setting is no longer supported. do you mean startRows, minRows or maxRows?');
    }
    if (isDefined(settings.cols)) {
      throw new Error('"cols" setting is no longer supported. do you mean startCols, minCols or maxCols?');
    }
    // Column groups (`columns` inside a column): the grid gets the columns without children; the groups are kept for
    // the header rows.
    if (Array.isArray(settings.columns)) {
      const tree = isColumnTree(settings.columns) ? settings.columns : null;

      setColumnTree(this, tree);
      if (tree) {
        settings = { ...settings, columns: flattenColumns(tree) };
      }
    }

    // The class names the grid has now (the loop below overwrites them).
    const previousClassName = this.#GridSettings.prototype.className;
    const previousTableClassName = this.#GridSettings.prototype.tableClassName;

    for (i in settings) {
      if (i === 'data') {
        continue; // loadData will be triggered later

      } else if (i === 'language') {
        this.#setLanguage(settings.language);

        continue;

      } else if (Hooks.getSingleton().getRegistered().indexOf(i) > -1) {
        if (isFunction(settings[i]) || Array.isArray(settings[i])) {
          settings[i].initialHook = true;
          this.addHook(i, settings[i]);
        }

      } else if (!init && hasOwnProperty(settings, i)) { // Update settings
        this.#GridSettings.prototype[i] = settings[i];
      }
    }

    // Load data or create data map
    if (settings.data === void 0 && this.#priv.settings.data === void 0) {
      this.loadData(null); // data source created just now

    } else if (settings.data !== void 0) {
      this.loadData(settings.data); // data source given as option

    } else if (settings.columns !== void 0) {
      this.#datamap.createMap();
    }

    // Hidden columns too.
    clen = this.#countAllCols();

    const columnSetting = settings.columns || this.#GridSettings.prototype.columns;

    // Init columns constructors configuration
    if (columnSetting && isFunction(columnSetting)) {
      clen = this.countSourceCols();
      columnsAsFunc = true;
    }

    // Clear cellSettings cache
    if (settings.cell !== void 0 || settings.cells !== void 0 || settings.columns !== void 0) {
      this.#priv.cellSettings.length = 0;
    }

    if (clen > 0) {
      let proto;
      let column;

      for (i = 0, j = 0; i < clen; i++) {
        if (columnsAsFunc && !columnSetting(i)) {
          continue;
        }
        this.#priv.columnSettings[j] = columnFactory(this.#GridSettings, this.#priv.columnsSettingConflicts);

        // shortcut for prototype
        proto = this.#priv.columnSettings[j].prototype;

        // Use settings provided by user
        if (columnSetting) {
          if (columnsAsFunc) {
            column = columnSetting(i);

          } else {
            column = columnSetting[j];
          }

          if (column) {
            extend(proto, column);
            extend(proto, expandType(column));
          }
        }

        j += 1;
      }
    }

    if (isDefined(settings.cell)) {
      objectEach(settings.cell, (cell) => {
        this.setCellMetaObject(cell.row, cell.col, cell);
      });
    }

    this.runHooks('afterCellMetaReset');

    if (isDefined(settings.className)) {
      if (previousClassName) {
        removeClass(this.rootElement, previousClassName);
      }
      if (settings.className) {
        addClass(this.rootElement, settings.className);
      }
    }
    if (!init && isDefined(settings.tableClassName) && this.table) {
      if (previousTableClassName) {
        removeClass(this.table, previousTableClassName);
      }
      if (settings.tableClassName) {
        addClass(this.table, settings.tableClassName);
      }
    }
    if (!init && ['currentHeaderClassName', 'activeHeaderClassName', 'currentRowClassName', 'currentColClassName']
      .some(name => hasOwnProperty(settings, name))) {
      this.selection.highlight.setClassNames({
        headerClassName: this.#priv.settings.currentHeaderClassName,
        activeHeaderClassName: this.#priv.settings.activeHeaderClassName,
        rowClassName: this.#priv.settings.currentRowClassName,
        columnClassName: this.#priv.settings.currentColClassName,
      });
    }

    let currentHeight: string | number = this.rootElement.style.height;
    if (currentHeight !== '') {
      currentHeight = parseInt(this.rootElement.style.height, 10);
    }

    let height = settings.height;
    if (isFunction(height)) {
      height = height();
    }

    if (init) {
      const initialStyle = this.rootElement.getAttribute('style');

      if (initialStyle) {
        this.rootElement.setAttribute('data-initialstyle', String(this.rootElement.getAttribute('style')));
      }
    }

    if (height === null) {
      const initialStyle = this.rootElement.getAttribute('data-initialstyle');

      if (initialStyle && (initialStyle.indexOf('height') > -1 || initialStyle.indexOf('overflow') > -1)) {
        this.rootElement.setAttribute('style', initialStyle);

      } else {
        this.rootElement.style.height = '';
        this.rootElement.style.overflow = '';
      }

    } else if (height !== void 0) {
      this.rootElement.style.height = `${height}px`;
      this.rootElement.style.overflow = 'hidden';
    }

    if (typeof settings.width !== 'undefined') {
      let width = settings.width;

      if (isFunction(width)) {
        width = width();
      }

      this.rootElement.style.width = `${width}px`;
    }

    if (!init) {
      this.#datamap.clearLengthCache(); // force clear cache length on updateSettings() #3416

      if (this.view) {
        this.view.wt.wtViewport.resetHasOversizedColumnHeadersMarked();
        // The style or the theme may have changed the row height (--fs-row-height).
        this.view.wt.wtSettings.update('defaultRowHeight', getRowHeight(this.rootElement));
      }

      this.runHooks('afterUpdateSettings', settings);

      if (settings.sheetTabs !== void 0 || settings.sheetTabsPosition !== void 0) {
        getWorkbook(this)?.renderTabs();
      }
    }

    this.#grid.adjustRowsAndCols();
    if (this.view && !this.#priv.firstRun) {
      this.forceFullRender = true; // used when data was changed
      this.#editorManager.lockEditor();
      this._refreshBorders(null);
      this.#editorManager.unlockEditor();
    }

    if (!init && this.view && (currentHeight === '' || height === '' || height === void 0) && currentHeight !== height) {
      this.view.wt.wtOverlays.updateMainScrollableElements();
    }
  }


  /**
   * Get value from the selected cell.
   *
   * @memberof Core#
   * @function getValue
   * @returns {*} Value of selected cell.
   */
  getValue() {
    const sel = this.getSelectedLast();

    if (this.#GridSettings.prototype.getValue) {
      if (isFunction(this.#GridSettings.prototype.getValue)) {
        return this.#GridSettings.prototype.getValue.call(this);
      } else if (sel) {
        // Upstream reads `sel[0][0]` (undefined: `sel[0]` is a number), so a string `getValue` setting throws.
        return this.getData()[(sel[0] as unknown as number[])[0]][this.#GridSettings.prototype.getValue];
      }
    } else if (sel) {
      return this.getDataAtCell(sel[0], sel[1]);
    }
  }


  /**
   * Returns the object settings.
   *
   * @memberof Core#
   * @function getSettings
   * @returns {Object} Object containing the current table settings.
   */
  getSettings() {
    return this.#priv.settings;
  }


  /**
   * Clears the data from the table (the table settings remain intact).
   *
   * @memberof Core#
   * @function clear
   */
  clear() {
    // Empties every cell that is not read-only, without changing the selection.
    const changes: [number, number, string][] = [];

    rangeEach(0, this.countRows() - 1, (row) => {
      rangeEach(0, this.countCols() - 1, (column) => {
        if (!this.getCellMeta(row, column).readOnly) {
          changes.push([row, column, '']);
        }
      });
    });

    if (changes.length > 0) {
      this.setDataAtCell(changes);
    }
  }


  /**
   * Allows altering the table structure by either inserting/removing rows or columns.
   *
   * @memberof Core#
   * @function alter
   * @param {String} action Possible alter operations:
   *  * `'insert_row'`
   *  * `'insert_col'`
   *  * `'remove_row'`
   *  * `'remove_col'`
   * @param {Number|Number[]} index Visual index of the row/column before which the new row/column will be
   *                                inserted/removed or an array of arrays in format `[[index, amount],...]`.
   * @param {Number} [amount=1] Amount of rows/columns to be inserted or removed.
   * @param {String} [source] Source indicator.
   * @param {Boolean} [keepEmptyRows] Flag for preventing deletion of empty rows.
   * @example
   * ```js
   * // Insert new row above the row at given visual index.
   * hot.alter('insert_row', 10);
   * // Insert 3 new columns before 10th column.
   * hot.alter('insert_col', 10, 3);
   * // Remove 2 rows starting from 10th row.
   * hot.alter('remove_row', 10, 2);
   * // Remove 5 non-contiquous rows (it removes 3 rows from visual index 1 and 2 rows from visual index 5).
   * hot.alter('remove_row', [[1, 3], [5, 2]]);
   * ```
   */
  alter(action: string, index?: number | number[] | [number, number][], amount?: number | null, source?: string, keepEmptyRows?: boolean) {
    this.#grid.alter(action, index, amount, source, keepEmptyRows);
  }


  /**
   * Returns a TD element for the given `row` and `column` arguments, if it is rendered on screen.
   * Returns `null` if the TD is not rendered on screen (probably because that part of the table is not visible).
   *
   * @memberof Core#
   * @function getCell
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @param {Boolean} [topmost=false] If set to `true`, it returns the TD element from the topmost overlay. For example,
   * if the wanted cell is in the range of fixed rows, it will return a TD element from the `top` overlay.
   * @returns {HTMLTableCellElement|null} The cell's TD element.
   */
  getCell(row: number, column: number, topmost: boolean = false) {
    return this.view.getCellAtCoords(new CellCoords(row, column), topmost);
  }


  /**
   * Returns the coordinates of the cell, provided as a HTML table cell element.
   *
   * @memberof Core#
   * @function getCoords
   * @param {HTMLTableCellElement} element The HTML Element representing the cell.
   * @returns {CellCoords} Visual coordinates object.
   * @example
   * ```js
   * hot.getCoords(hot.getCell(1, 1));
   * // it returns CellCoords object instance with props row: 1 and col: 1.
   * ```
   */
  getCoords(element: Element) {
    return this.view.wt.wtTable.getCoords.call(this.view.wt.wtTable, element);
  }


  /**
   * Returns the property name that corresponds with the given column index (see {@link DataMap#colToProp}).
   * If the data source is an array of arrays, it returns the columns index.
   *
   * @memberof Core#
   * @function colToProp
   * @param {Number} column Visual column index.
   * @returns {String|Number} Column property or physical column index.
   */
  colToProp(column: number) {
    return this.#datamap.colToProp(column);
  }


  /**
   * Returns column index that corresponds with the given property (see {@link DataMap#propToCol}).
   *
   * @memberof Core#
   * @function propToCol
   * @param {String|Number} prop Property name or physical column index.
   * @returns {Number} Visual column index.
   */
  propToCol(prop: string | number) {
    return this.#datamap.propToCol(prop);
  }


  /**
   * Translate physical row index into visual.
   *
   * This method is useful when you want to retrieve visual row index which can be reordered, moved or trimmed
   * based on a physical index
   *
   * @memberof Core#
   * @function toVisualRow
   * @param {Number} row Physical row index.
   * @returns {Number} Returns visual row index.
   */
  toVisualRow(row: number) {
    return this.#recordTranslator.toVisualRow(row);
  }


  /**
   * Translate physical column index into visual.
   *
   * This method is useful when you want to retrieve visual column index which can be reordered, moved or trimmed
   * based on a physical index
   *
   * @memberof Core#
   * @function toVisualColumn
   * @param {Number} column Physical column index.
   * @returns {Number} Returns visual column index.
   */
  toVisualColumn(column: number) {
    return this.#recordTranslator.toVisualColumn(column);
  }


  /**
   * Translate visual row index into physical.
   *
   * This method is useful when you want to retrieve physical row index based on a visual index which can be
   * reordered, moved or trimmed.
   *
   * @memberof Core#
   * @function toPhysicalRow
   * @param {Number} row Visual row index.
   * @returns {Number} Returns physical row index.
   */
  toPhysicalRow(row: number) {
    return this.#recordTranslator.toPhysicalRow(row);
  }


  /**
   * Translate visual column index into physical.
   *
   * This method is useful when you want to retrieve physical column index based on a visual index which can be
   * reordered, moved or trimmed.
   *
   * @memberof Core#
   * @function toPhysicalColumn
   * @param {Number} column Visual column index.
   * @returns {Number} Returns physical column index.
   */
  toPhysicalColumn(column: number) {
    return this.#recordTranslator.toPhysicalColumn(column);
  }


  /**
   * @description
   * Returns the cell value at `row`, `column`.
   *
   * __Note__: If data is reordered, sorted or trimmed, the currently visible order will be used.
   *
   * @memberof Core#
   * @function getDataAtCell
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @returns {*} Data at cell.
   */
  getDataAtCell(row: number, column: number) {
    return this.#datamap.get(row, this.#datamap.colToProp(column));
  }


  /**
   * Returns value at visual `row` and `prop` indexes (see {@link DataMap#get}).
   *
   * __Note__: If data is reordered, sorted or trimmed, the currently visible order will be used.
   *
   * @memberof Core#
   * @function getDataAtRowProp
   * @param {Number} row Visual row index.
   * @param {String} prop Property name.
   * @returns {*} Cell value.
   */
  getDataAtRowProp(row: number, prop: Prop) {
    return this.#datamap.get(row, prop);
  }


  /**
   * @description
   * Returns array of column values from the data source.
   *
   * __Note__: If columns were reordered or sorted, the currently visible order will be used.
   *
   * @memberof Core#
   * @function getDataAtCol
   * @param {Number} column Visual column index.
   * @returns {Array} Array of cell values.
   */
  getDataAtCol(column: number) {
    if (this.#lastRow() < 0) {
      return [];
    }

    return ([] as unknown[]).concat(...this.#datamap.getRange(new CellCoords(0, column), new CellCoords(this.#lastRow(), column), this.#datamap.DESTINATION_RENDERER));
  }


  /**
   * Given the object property name (e.g. `'first.name'` or `'0'`), returns an array of column's values from the table data.
   * You can also provide a column index as the first argument.
   *
   * @memberof Core#
   * @function getDataAtProp
   * @param {String|Number} prop Property name or physical column index.
   * @returns {Array} Array of cell values.
   */
  // The values in visual row order (as getDataAtCol), read through the column's property.
  getDataAtProp(prop: Prop) {
    if (this.#lastRow() < 0) {
      return [];
    }
    const range = this.#datamap.getRange(
      new CellCoords(0, this.#datamap.propToCol(prop)),
      new CellCoords(this.#lastRow(), this.#datamap.propToCol(prop)),
      this.#datamap.DESTINATION_RENDERER);

    return ([] as unknown[]).concat(...range);
  }


  /**
   * Returns the source data object (the same that was passed by `data` configuration option or `loadData` method).
   * Optionally you can provide a cell range by using the `row`, `column`, `row2`, `column2` arguments, to get only a
   * fragment of the table data.
   *
   * __Note__: This method does not participate in data transformation. If the visual data of the table is reordered,
   * sorted or trimmed only physical indexes are correct.
   *
   * @memberof Core#
   * @function getSourceData
   * @param {Number} [row] From physical row index.
   * @param {Number} [column] From physical column index (or visual index, if data type is an array of objects).
   * @param {Number} [row2] To physical row index.
   * @param {Number} [column2] To physical column index (or visual index, if data type is an array of objects).
   * @returns {Array[]|Object[]} The table data.
   */
  getSourceData(row?: number, column?: number, row2?: number, column2?: number) {
    let data;

    if (row === void 0) {
      data = this.#dataSource.getData();
    } else {
      data = this.#dataSource.getByRange(new CellCoords(row, column), new CellCoords(row2, column2));
    }

    return data;
  }


  /**
   * Returns the source data object as an arrays of arrays format even when source data was provided in another format.
   * Optionally you can provide a cell range by using the `row`, `column`, `row2`, `column2` arguments, to get only a
   * fragment of the table data.
   *
   * __Note__: This method does not participate in data transformation. If the visual data of the table is reordered,
   * sorted or trimmed only physical indexes are correct.
   *
   * @memberof Core#
   * @function getSourceDataArray
   * @param {Number} [row] From physical row index.
   * @param {Number} [column] From physical column index (or visual index, if data type is an array of objects).
   * @param {Number} [row2] To physical row index.
   * @param {Number} [column2] To physical column index (or visual index, if data type is an array of objects).
   * @returns {Array} An array of arrays.
   */
  getSourceDataArray(row?: number, column?: number, row2?: number, column2?: number) {
    let data;

    if (row === void 0) {
      data = this.#dataSource.getData(true);
    } else {
      data = this.#dataSource.getByRange(new CellCoords(row, column), new CellCoords(row2, column2), true);
    }

    return data;
  }


  /**
   * Returns an array of column values from the data source.
   *
   * @memberof Core#
   * @function getSourceDataAtCol
   * @param {Number} column Visual column index.
   * @returns {Array} Array of the column's cell values.
   */
  // Rows in source order; the column goes through `columns` and moved columns (a visual index).
  getSourceDataAtCol(column: number) {
    return this.#dataSource.getAtColumn(column);
  }


  /**
   * Returns a single row of the data (array or object, depending on what data format you use).
   *
   * __Note__: This method does not participate in data transformation. If the visual data of the table is reordered,
   * sorted or trimmed only physical indexes are correct.
   *
   * @memberof Core#
   * @function getSourceDataAtRow
   * @param {Number} row Physical row index.
   * @returns {Array|Object} Single row of data.
   */
  getSourceDataAtRow(row: number) {
    return this.#dataSource.getAtRow(row);
  }


  /**
   * Returns a single value from the data source.
   *
   * @memberof Core#
   * @function getSourceDataAtCell
   * @param {Number} row Physical row index.
   * @param {Number} column Visual column index.
   * @returns {*} Cell data.
   */
  // A physical row with a visual column, as the other getSourceData* methods.
  getSourceDataAtCell(row: number, column: number) {
    return this.#dataSource.getAtCell(row, column);
  }


  /**
   * @description
   * Returns a single row of the data.
   *
   * __Note__: If rows were reordered, sorted or trimmed, the currently visible order will be used.
   *
   * @memberof Core#
   * @function getDataAtRow
   * @param {Number} row Visual row index.
   * @returns {Array} Array of row's cell data.
   */
  getDataAtRow(row: number) {
    const data = this.#datamap.getRange(new CellCoords(row, 0), new CellCoords(row, this.countCols() - 1), this.#datamap.DESTINATION_RENDERER);

    return data[0] || [];
  }


  /**
   * @description
   * Returns a data type defined in the FreeSheet settings under the `type` key ([Options#type](https://github.com/freegrid-web/sheet)).
   * If there are cells with different types in the selected range, it returns `'mixed'`.
   *
   * __Note__: If data is reordered, sorted or trimmed, the currently visible order will be used.
   *
   * @memberof Core#
   * @function getDataType
   * @param {Number} rowFrom From visual row index.
   * @param {Number} columnFrom From visual column index.
   * @param {Number} rowTo To visual row index.
   * @param {Number} columnTo To visual column index.
   * @returns {String} Cell type (e.q: `'mixed'`, `'text'`, `'numeric'`, `'autocomplete'`).
   */
  getDataType(rowFrom: number, columnFrom: number, rowTo: number, columnTo: number) {
    const coords = rowFrom === void 0 ? [0, 0, this.countRows(), this.countCols()] : [rowFrom, columnFrom, rowTo, columnTo];
    const [rowStart, columnStart] = coords;
    let [,, rowEnd, columnEnd] = coords;
    let previousType: unknown = null;
    let currentType: unknown = null;

    if (rowEnd === void 0) {
      rowEnd = rowStart;
    }
    if (columnEnd === void 0) {
      columnEnd = columnStart;
    }
    let type: unknown = 'mixed';

    rangeEach(Math.min(rowStart, rowEnd), Math.max(rowStart, rowEnd), (row) => {
      let isTypeEqual = true;

      rangeEach(Math.min(columnStart, columnEnd), Math.max(columnStart, columnEnd), (column) => {
        const cellType = this.getCellMeta(row, column);

        currentType = cellType.type;

        if (previousType) {
          isTypeEqual = previousType === currentType;
        } else {
          previousType = currentType;
        }

        return isTypeEqual;
      });
      type = isTypeEqual ? currentType : 'mixed';

      return isTypeEqual;
    });

    return type;
  }


  /**
   * Remove a property defined by the `key` argument from the cell meta object for the provided `row` and `column` coordinates.
   *
   * @memberof Core#
   * @function removeCellMeta
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @param {String} key Property name.
   * @fires Hooks#beforeRemoveCellMeta
   * @fires Hooks#afterRemoveCellMeta
   */
  removeCellMeta(row: number, column: number, key: string) {
    const [physicalRow, physicalColumn] = this.#recordTranslator.toPhysical(row, column) as [number, number];
    const cachedValue = this.#priv.cellSettings[physicalRow][physicalColumn][key];

    const hookResult = this.runHooks('beforeRemoveCellMeta', row, column, key, cachedValue);

    if (hookResult !== false) {
      delete this.#priv.cellSettings[physicalRow][physicalColumn][key];

      this.runHooks('afterRemoveCellMeta', row, column, key, cachedValue);
    }
  }


  /**
   * Remove one or more rows from the cell meta object.
   *
   * @since 0.30.0
   * @param {Number} index An integer that specifies at what position to add/remove items, Use negative values to specify the position from the end of the array.
   * @param {Number} deleteAmount The number of items to be removed. If set to 0, no items will be removed.
   * @param {Array} items The new items to be added to the array.
   */
  spliceCellsMeta(index: number, deleteAmount: number, ...items: AnyObject[][]) {
    this.#priv.cellSettings.splice(index, deleteAmount, ...items);
  }


  /**
   * Set cell meta data object defined by `prop` to the corresponding params `row` and `column`.
   *
   * @memberof Core#
   * @function setCellMetaObject
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @param {Object} prop Meta object.
   */
  setCellMetaObject(row: number, column: number, prop: AnyObject) {
    if (typeof prop === 'object') {
      objectEach(prop, (value, key) => {
        this.setCellMeta(row, column, key, value);
      });
    }
  }


  /**
   * Sets a property defined by the `key` property to the meta object of a cell corresponding to params `row` and `column`.
   *
   * @memberof Core#
   * @function setCellMeta
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @param {String} key Property name.
   * @param {String} value Property value.
   * @fires Hooks#afterSetCellMeta
   */
  setCellMeta(row: number, column: number, key: string, value: unknown) {
    const [physicalRow, physicalColumn] = this.#recordTranslator.toPhysical(row, column) as [number, number];

    if (!this.#priv.columnSettings[physicalColumn]) {
      this.#priv.columnSettings[physicalColumn] = columnFactory(this.#GridSettings, this.#priv.columnsSettingConflicts);
    }

    if (!this.#priv.cellSettings[physicalRow]) {
      this.#priv.cellSettings[physicalRow] = [];
    }
    if (!this.#priv.cellSettings[physicalRow][physicalColumn]) {
      this.#priv.cellSettings[physicalRow][physicalColumn] = new this.#priv.columnSettings[physicalColumn]() as AnyObject;
    }
    this.#priv.cellSettings[physicalRow][physicalColumn][key] = value;
    this.runHooks('afterSetCellMeta', row, column, key, value);
  }


  /**
   * Get all the cells meta settings at least once generated in the table (in order of cell initialization).
   *
   * @memberof Core#
   * @function getCellsMeta
   * @returns {Array} Returns an array of ColumnSettings object instances.
   */
  getCellsMeta() {
    // Rows whose cells were never read (for example hidden ones) have no meta.
    return arrayFlatten(this.#priv.cellSettings).filter(Boolean);
  }

  /**
   * Returns the column meta: the grid settings together with the column's settings from `columns`. Every cell meta
   * of the column inherits from this object. Unlike {@link Core#getCellMeta}, it creates no cell meta and runs no
   * hooks.
   *
   * @memberof Core#
   * @function getColumnMeta
   * @param {Number} column Visual column index.
   * @returns {Object} The column meta object.
   * @example
   * ```js
   * // columns: [{ type: 'numeric' }]
   * hot.getColumnMeta(0).type; // 'numeric'
   * ```
   */
  getColumnMeta(column: number) {
    const physicalColumn = this.toPhysicalColumn(column);
    // The cache key is a number, so no index can name a prototype property.
    const columnKey = Number(physicalColumn === null ? column : physicalColumn);

    if (!this.#priv.columnSettings[columnKey]) {
      this.#priv.columnSettings[columnKey] = columnFactory(this.#GridSettings, this.#priv.columnsSettingConflicts);
    }

    return this.#priv.columnSettings[columnKey].prototype as AnyObject;
  }


  /**
   * Adds a sheet to the document this grid belongs to, after the last sheet, and returns its grid. Sheets work as
   * in an Excel file: the tab bar below the sheets switches between them, and formulas can refer to other sheets
   * (`=Costs!B2`). The new sheet takes `formulas`, `formulaBar`, the headers, the size and a few other settings from
   * the first sheet unless `settings` sets them. The sheet is not activated.
   *
   * @memberof Core#
   * @function addSheet
   * @param {String} [id] The sheet's id, for the other sheet methods (default `sheet2`, `sheet3`, …).
   * @param {Object} [settings] The sheet's settings (`data` and any grid setting), and `name`: the name shown on
   * its tab and used in formulas (default: the id, or `Sheet2`, `Sheet3`, …). Up to 31 characters, without
   * `[ ] : * ? / \`, unique in the document.
   * @returns {Core} The new sheet's grid.
   * @fires Hooks#beforeSheetAdd
   * @fires Hooks#afterSheetAdd
   * @example
   * ```js
   * const costs = hot.addSheet('costs', { name: 'Costs', data: [['Rent', 1200]] });
   *
   * hot.activateSheet('costs');
   * ```
   */
  addSheet(id?: string, settings: AnyObject = {}) {
    return this.#workbook().add(id, settings);
  }

  /**
   * Returns the grid of a sheet of this grid's document, or `null` when there is no sheet with this id.
   *
   * @memberof Core#
   * @function getSheet
   * @param {String} id The sheet's id.
   * @returns {Core|null}
   * @example
   * ```js
   * hot.getSheet('costs').setDataAtCell(0, 1, 1500);
   * ```
   */
  getSheet(id: string) {
    return this.#workbook().get(id)?.instance || null;
  }

  /**
   * Returns the sheets of this grid's document, in the order of their tabs.
   *
   * @memberof Core#
   * @function getSheets
   * @returns {Array} `[{ id, name }, …]`
   * @example
   * ```js
   * hot.getSheets(); // [{ id: 'sheet1', name: 'Sheet1' }, { id: 'costs', name: 'Costs' }]
   * ```
   */
  getSheets() {
    return this.#workbook().sheets.map(({ id, name }) => ({ id, name }));
  }

  /**
   * Returns the grid of the sheet the user sees (the active sheet).
   *
   * @memberof Core#
   * @function getActiveSheet
   * @returns {Core}
   * @example
   * ```js
   * hot.getActiveSheet().getSheetName(); // 'Costs'
   * ```
   */
  getActiveSheet() {
    const workbook = this.#workbook();

    return workbook.require(workbook.activeId).instance;
  }

  /**
   * Opens a side panel at the right of the document (in the frame, the sheets make room for it): `'comments'` lists
   * every comment, `'conditionalFormatting'` the conditional formatting rules. Another open panel is replaced.
   *
   * @memberof Core#
   * @function openPanel
   * @param {String} name The panel.
   * @param {Object} [options] The panel's options.
   * @fires Hooks#afterPanelOpen
   */
  openPanel(name: string, options?: AnyObject) {
    getSidePanel(this).open(name, options);
  }

  /**
   * The document as an Excel file (`'xlsx'`: every sheet with its values, formulas, formats, styles, sizes, merged,
   * hidden and frozen cells, conditional formatting and comments) or the active sheet as CSV (`'csv'`: the values).
   *
   * @memberof Core#
   * @function exportFile
   * @param {String} [format='xlsx'] `'xlsx'` or `'csv'`.
   * @param {Object} [options] `headers`: write the column headers as a first row; `delimiter` (CSV).
   * @returns {Promise<Blob>}
   * @fires Hooks#afterExportFile
   */
  exportFile(format?: FileFormat, options?: FileOptions) {
    return exportFile(this, format, options);
  }

  /**
   * Saves the document as an Excel file (or the active sheet as CSV) in the browser.
   *
   * @memberof Core#
   * @function downloadFile
   * @param {String} [format='xlsx'] `'xlsx'` or `'csv'`.
   * @param {String} [filename] The file's name (the first sheet's name by default).
   * @param {Object} [options] As for `exportFile`.
   * @returns {Promise}
   */
  downloadFile(format?: FileFormat, filename?: string, options?: FileOptions) {
    return downloadFile(this, format, filename, options);
  }

  /**
   * Opens a file: an Excel file (.xlsx) replaces the document (its sheets, values, formulas, formats, styles, sizes,
   * merged, hidden and frozen cells, conditional formatting and comments); CSV (a `.csv` file, or text) replaces the
   * active sheet's data.
   *
   * @memberof Core#
   * @function importFile
   * @param {File|Blob|ArrayBuffer|String} source The file (from `<input type="file">`), its bytes, or CSV text.
   * @param {Object} [options] `headers`: the first row becomes the column headers; `format`: `'xlsx'` or `'csv'`
   * when the source does not say; `delimiter` (CSV, guessed by default).
   * @returns {Promise}
   * @fires Hooks#beforeImportFile
   * @fires Hooks#afterImportFile
   */
  importFile(source: Blob | ArrayBuffer | Uint8Array | string, options?: FileOptions) {
    return importFile(this, source, options);
  }

  /**
   * Closes the side panel.
   *
   * @memberof Core#
   * @function closePanel
   * @fires Hooks#afterPanelClose
   */
  closePanel() {
    findSidePanel(this)?.close();
  }

  /**
   * Shows the loading state: a layer over the grid with a spinner and a text (`true`: "Loading…", or your text), which
   * takes the clicks while the grid ignores the keyboard; `false` hides it. `importFile` shows it while it reads a
   * file.
   *
   * @memberof Core#
   * @function setLoading
   * @param {Boolean|String} state `true`, a text, or `false`.
   */
  setLoading(state: boolean | string) {
    setLoading(this, state);
  }

  /**
   * Sets the style of cells (the selected ones by default): `style` (`fontFamily`, `fontSize`, `fontWeight`,
   * `fontStyle`, `textDecoration`, `color`, `background`, `border`, `borderTop`, `borderRight`, `borderBottom`,
   * `borderLeft`) is merged into each cell's `style` meta, where a `null` property removes that property; a `null`
   * style removes the whole style. Undo can take it back.
   *
   * @memberof Core#
   * @function setCellStyle
   * @param {Object|null} style The style properties to set (`null` removes one), or `null` to clear the style.
   * @param {CellRange[]} [ranges] The cells (visual indexes); the selected cells by default.
   * @fires Hooks#afterSetCellStyle
   */
  setCellStyle(style: Record<string, string | null> | null, ranges?: CellRange[]) {
    setCellStyle(this, style, ranges ?? this.getSelectedRange());
  }

  /**
   * Whether the grid shows its loading state.
   *
   * @memberof Core#
   * @function isLoading
   * @returns {Boolean}
   */
  isLoading() {
    return isLoading(this);
  }

  /**
   * The name of the open side panel, or `null`.
   *
   * @memberof Core#
   * @function getOpenPanel
   * @returns {String|null}
   */
  getOpenPanel() {
    return findSidePanel(this)?.name ?? null;
  }

  /**
   * Shows a sheet: its tab becomes active and its grid takes the keyboard.
   *
   * @memberof Core#
   * @function activateSheet
   * @param {String} id The sheet's id.
   * @fires Hooks#beforeSheetActivate
   * @fires Hooks#afterSheetActivate
   * @example
   * ```js
   * hot.activateSheet('costs');
   * ```
   */
  activateSheet(id: string) {
    this.#workbook().activate(id);
  }

  /**
   * Renames a sheet. Formulas that refer to it follow the new name.
   *
   * @memberof Core#
   * @function renameSheet
   * @param {String} id The sheet's id (it does not change).
   * @param {String} name The new name: up to 31 characters, without `[ ] : * ? / \`, unique in the document.
   * @fires Hooks#beforeSheetRename
   * @fires Hooks#afterSheetRename
   * @example
   * ```js
   * hot.renameSheet('costs', 'Expenses');
   * ```
   */
  renameSheet(id: string, name: string) {
    this.#workbook().rename(id, name);
  }

  /**
   * Removes a sheet and destroys its grid. Formulas that refer to it show `#REF!`. The first sheet (the grid
   * created with `new FreeSheet`) holds the document and cannot be removed.
   *
   * @memberof Core#
   * @function removeSheet
   * @param {String} id The sheet's id.
   * @fires Hooks#beforeSheetRemove
   * @fires Hooks#afterSheetRemove
   * @example
   * ```js
   * hot.removeSheet('costs');
   * ```
   */
  removeSheet(id: string) {
    this.#workbook().remove(id);
  }

  /**
   * Moves a sheet to another place in the tab order.
   *
   * @memberof Core#
   * @function moveSheet
   * @param {String} id The sheet's id.
   * @param {Number} index The new position (0 is the first tab).
   * @fires Hooks#afterSheetMove
   * @example
   * ```js
   * hot.moveSheet('costs', 0);
   * ```
   */
  moveSheet(id: string, index: number) {
    this.#workbook().move(id, index);
  }

  /**
   * Returns the whole document as JSON-safe data, to save it and load it later with `loadDocument`: every sheet (in
   * tab order) with its id, name, data (formulas as formulas), the column widths and row heights users changed, the
   * merged cells and the cell formats (comments, `className`, `readOnly`, `type`, number and date formats, …), and the
   * active sheet.
   *
   * @memberof Core#
   * @function getDocument
   * @returns {Object} `{ version: 1, activeSheet, sheets: [{ id, name, data, colWidths?, rowHeights?, mergeCells?,
   * cell? }] }`
   * @example
   * ```js
   * localStorage.setItem('book', JSON.stringify(hot.getDocument()));
   * ```
   */
  getDocument() {
    return this.#workbook().save();
  }

  /**
   * Replaces the document with one saved by `getDocument`: the sheets, their content and order, and the active
   * sheet. The grid that holds the document takes the first saved sheet; the other sheets are created again.
   *
   * @memberof Core#
   * @function loadDocument
   * @param {Object} document A document from `getDocument`.
   * @example
   * ```js
   * hot.loadDocument(JSON.parse(localStorage.getItem('book')));
   * ```
   */
  loadDocument(document: AnyObject) {
    this.#workbook().load(document as never);
  }

  /**
   * Returns this grid's sheet id (`sheet1` for a grid created with `new FreeSheet`, unless `sheetId` is set).
   *
   * @memberof Core#
   * @function getSheetId
   * @returns {String}
   * @example
   * ```js
   * hot.getActiveSheet().getSheetId(); // 'costs'
   * ```
   */
  getSheetId() {
    return this.#workbook().sheetOf(this)!.id;
  }

  /**
   * Returns this grid's sheet name, as shown on its tab and used in formulas.
   *
   * @memberof Core#
   * @function getSheetName
   * @returns {String}
   * @example
   * ```js
   * hot.getSheetName(); // 'Sheet1'
   * ```
   */
  getSheetName() {
    return this.#workbook().sheetOf(this)!.name;
  }

  /**
   * Returns the cell properties object for the given `row` and `column` coordinates.
   *
   * @memberof Core#
   * @function getCellMeta
   * @param {Number} row Visual row index.
   * @param {Number} column Visual column index.
   * @returns {Object} The cell properties object.
   * @fires Hooks#beforeGetCellMeta
   * @fires Hooks#afterGetCellMeta
   */
  getCellMeta(row: number, column: number) {
    const prop = this.#datamap.colToProp(column);
    const [potentialPhysicalRow, physicalColumn] = this.#recordTranslator.toPhysical(row, column) as [number, number];
    let physicalRow = potentialPhysicalRow;

    // A row that the modifyRow hook hides (null) keeps its meta under the visual index.
    if (physicalRow === null) {
      physicalRow = row;
    }
    // The meta is cached by index: a key like '__proto__' would reach Array.prototype or Object.prototype.
    if ((physicalRow as unknown) === '__proto__' || (physicalRow as unknown) === 'constructor' ||
      (physicalRow as unknown) === 'prototype' || (physicalColumn as unknown) === '__proto__' ||
      (physicalColumn as unknown) === 'constructor' || (physicalColumn as unknown) === 'prototype') {
      throw new Error(`Invalid cell index: ${String(physicalRow)}, ${String(physicalColumn)}`);
    }

    // The cache keys are numbers, so no index can name a prototype property.
    const rowKey = Number(physicalRow);
    const columnKey = Number(physicalColumn);

    if (!this.#priv.columnSettings[columnKey]) {
      this.#priv.columnSettings[columnKey] = columnFactory(this.#GridSettings, this.#priv.columnsSettingConflicts);
    }

    if (!this.#priv.cellSettings[rowKey]) {
      this.#priv.cellSettings[rowKey] = [];
    }
    if (!this.#priv.cellSettings[rowKey][columnKey]) {
      this.#priv.cellSettings[rowKey][columnKey] = new this.#priv.columnSettings[columnKey]() as AnyObject;
    }

    const cellProperties = this.#priv.cellSettings[rowKey][columnKey]; // retrieve cellProperties from cache

    cellProperties.row = physicalRow;
    cellProperties.col = physicalColumn;
    cellProperties.visualRow = row;
    cellProperties.visualCol = column;
    cellProperties.prop = prop;
    cellProperties.instance = this;

    this.runHooks('beforeGetCellMeta', row, column, cellProperties);
    extend(cellProperties, expandType(cellProperties)); // for `type` added in beforeGetCellMeta

    if (cellProperties.cells) {
      const settings = cellProperties.cells.call(cellProperties, physicalRow, physicalColumn, prop);

      if (settings) {
        extend(cellProperties, settings);
        extend(cellProperties, expandType(settings)); // for `type` added in cells
      }
    }

    this.runHooks('afterGetCellMeta', row, column, cellProperties);

    return cellProperties;
  }


  /**
   * Returns an array of cell meta objects for specyfied physical row index.
   *
   * @memberof Core#
   * @function getCellMetaAtRow
   * @param {Number} row Physical row index.
   * @returns {Array}
   */
  getCellMetaAtRow(row: number) {
    return this.#priv.cellSettings[row];
  }


  /**
   * Checks if the data format and config allows user to modify the column structure.
   *
   * @memberof Core#
   * @function isColumnModificationAllowed
   * @returns {Boolean}
   */
  isColumnModificationAllowed() {
    return !(this.dataType === 'object' || this.getSettings().columns);
  }


  /**
   * Returns the cell renderer function by given `row` and `column` arguments.
   *
   * @memberof Core#
   * @function getCellRenderer
   * @param {Number|Object} row Visual row index or cell meta object (see {@link Core#getCellMeta}).
   * @param {Number} column Visual column index.
   * @returns {Function} The renderer function.
   * @example
   * ```js
   * // Get cell renderer using `row` and `column` coordinates.
   * hot.getCellRenderer(1, 1);
   * // Get cell renderer using cell meta object.
   * hot.getCellRenderer(hot.getCellMeta(1, 1));
   * ```
   */
  getCellRenderer(row: number | AnyObject, column?: number) {
    return getRenderer(rendererLookup.call(this, row, column) as Parameters<typeof getRenderer>[0]);
  }


  /**
   * Returns the cell editor class by the provided `row` and `column` arguments.
   *
   * @memberof Core#
   * @function getCellEditor
   * @param {Number} row Visual row index or cell meta object (see {@link Core#getCellMeta}).
   * @param {Number} column Visual column index.
   * @returns {Function} The editor class.
   * @example
   * ```js
   * // Get cell editor class using `row` and `column` coordinates.
   * hot.getCellEditor(1, 1);
   * // Get cell editor class using cell meta object.
   * hot.getCellEditor(hot.getCellMeta(1, 1));
   * ```
   */
  getCellEditor(row: number | AnyObject, column?: number) {
    return editorLookup.call(this, row, column) as Parameters<typeof getEditorInstance>[0] | undefined;
  }


  /**
   * Returns the cell validator by `row` and `column`.
   *
   * @memberof Core#
   * @function getCellValidator
   * @param {Number|Object} row Visual row index or cell meta object (see {@link Core#getCellMeta}).
   * @param {Number} column Visual column index.
   * @returns {Function|RegExp|undefined} The validator function.
   * @example
   * ```js
   * // Get cell valiator using `row` and `column` coordinates.
   * hot.getCellValidator(1, 1);
   * // Get cell valiator using cell meta object.
   * hot.getCellValidator(hot.getCellMeta(1, 1));
   * ```
   */
  getCellValidator(row: number | AnyObject, column?: number) {
    let validator = validatorLookup.call(this, row, column);

    if (typeof validator === 'string') {
      validator = getValidator(validator);
    }

    return validator;
  }


  /**
   * Validates all cells using their validator functions and calls callback when finished.
   *
   * If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it
   * would equal `true`.
   *
   * @memberof Core#
   * @function validateCells
   * @param {Function} [callback] The callback function.
   * @example
   * ```js
   * hot.validateCells((valid) => {
   *   if (valid) {
   *     // ... code for validated cells
   *   }
   * })
   * ```
   */
  validateCells(callback?: AnyFunction) {
    this._validateCells(callback);
  }


  /**
   * Validates rows using their validator functions and calls callback when finished.
   *
   * If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it
   *  would equal `true`.
   *
   * @memberof Core#
   * @function validateRows
   * @param {Array} [rows] Array of validation target visual row indexes.
   * @param {Function} [callback] The callback function.
   * @example
   * ```js
   * hot.validateRows([3, 4, 5], (valid) => {
   *   if (valid) {
   *     // ... code for validated rows
   *   }
   * })
   * ```
   */
  validateRows(rows?: unknown[], callback?: AnyFunction) {
    if (!Array.isArray(rows)) {
      throw new Error('validateRows parameter `rows` must be an array');
    }
    this._validateCells(callback, rows);
  }


  /**
   * Validates columns using their validator functions and calls callback when finished.
   *
   * If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it
   *  would equal `true`.
   *
   * @memberof Core#
   * @function validateColumns
   * @param {Array} [columns] Array of validation target visual columns indexes.
   * @param {Function} [callback] The callback function.
   * @example
   * ```js
   * hot.validateColumns([3, 4, 5], (valid) => {
   *   if (valid) {
   *     // ... code for validated columns
   *   }
   * })
   * ```
   */
  validateColumns(columns?: unknown[], callback?: AnyFunction) {
    if (!Array.isArray(columns)) {
      throw new Error('validateColumns parameter `columns` must be an array');
    }
    this._validateCells(callback, undefined, columns);
  }


  /**
   * Validates all cells using their validator functions and calls callback when finished.
   *
   * If one of the cells is invalid, the callback will be fired with `'valid'` arguments as `false` - otherwise it would equal `true`.
   *
   * Private use intended.
   *
   * @private
   * @memberof Core#
   * @function _validateCells
   * @param {Function} [callback] The callback function.
   * @param {Array} [rows] An array of validation target visual row indexes.
   * @param {Array} [columns] An array of validation target visual column indexes.
   */
  _validateCells(callback?: AnyFunction, rows?: unknown[], columns?: unknown[]) {
    const waitingForValidator = new ValidatorsQueue();

    if (callback) {
      waitingForValidator.onQueueEmpty = callback;
    }

    let i = this.countRows() - 1;

    while (i >= 0) {
      if (rows !== undefined && rows.indexOf(i) === -1) {
        i -= 1;
        continue;
      }
      let j = this.countCols() - 1;

      while (j >= 0) {
        if (columns !== undefined && columns.indexOf(j) === -1) {
          j -= 1;
          continue;
        }
        waitingForValidator.addValidatorToQueue();

        this.validateCell(this.getDataAtCell(i, j), this.getCellMeta(i, j), (result: unknown) => {
          if (typeof result !== 'boolean') {
            throw new Error('Validation error: result is not boolean');
          }
          if (result === false) {
            waitingForValidator.valid = false;
          }
          waitingForValidator.removeValidatorFormQueue();
        }, 'validateCells');
        j -= 1;
      }
      i -= 1;
    }
    waitingForValidator.checkIfQueueIsEmpty();
  }


  /**
   * Returns an array of row headers' values (if they are enabled). If param `row` was given, it returns the header of the given row as a string.
   *
   * @memberof Core#
   * @function getRowHeader
   * @param {Number} [row] Visual row index.
   * @fires Hooks#modifyRowHeader
   * @returns {Array|String|Number} Array of header values / single header value.
   */
  getRowHeader(row?: number) {
    let rowHeader = this.#priv.settings.rowHeaders;
    let physicalRow = row;

    if (physicalRow !== void 0) {
      physicalRow = this.runHooks('modifyRowHeader', physicalRow);
    }
    if (physicalRow === void 0) {
      rowHeader = [];
      rangeEach(this.countRows() - 1, (i) => {
        rowHeader.push(this.getRowHeader(i));
      });

    } else if (Array.isArray(rowHeader) && rowHeader[physicalRow] !== void 0) {
      rowHeader = rowHeader[physicalRow];

    } else if (isFunction(rowHeader)) {
      rowHeader = rowHeader(physicalRow);

    } else if (rowHeader && typeof rowHeader !== 'string' && typeof rowHeader !== 'number') {
      // Hidden rows leave gaps in the numbers (1, 2, 5), as in Excel.
      rowHeader = this.#recordTranslator.rows!.toOrdered(physicalRow) + 1;
    }

    return rowHeader;
  }


  /**
   * Returns information about if this table is configured to display row headers.
   *
   * @memberof Core#
   * @function hasRowHeaders
   * @returns {Boolean} `true` if the instance has the row headers enabled, `false` otherwise.
   */
  hasRowHeaders() {
    return !!this.#priv.settings.rowHeaders;
  }


  /**
   * Returns information about if this table is configured to display column headers.
   *
   * @memberof Core#
   * @function hasColHeaders
   * @returns {Boolean} `true` if the instance has the column headers enabled, `false` otherwise.
   */
  hasColHeaders() {
    if (this.#priv.settings.colHeaders !== void 0 && this.#priv.settings.colHeaders !== null) { // Polymer has empty value = null
      return !!this.#priv.settings.colHeaders;
    }
    for (let i = 0, ilen = this.countCols(); i < ilen; i++) {
      if (this.getColHeader(i)) {
        return true;
      }
    }

    return false;
  }


  /**
   * Returns an array of column headers (in string format, if they are enabled). If param `column` is given, it
   * returns the header at the given column.
   *
   * @memberof Core#
   * @function getColHeader
   * @param {Number} [column] Visual column index.
   * @fires Hooks#modifyColHeader
   * @returns {Array|String|Number} The column header(s).
   */
  getColHeader(column?: number) {
    const columnsAsFunc = this.#priv.settings.columns && isFunction(this.#priv.settings.columns);
    const columnIndex = this.runHooks('modifyColHeader', column);
    let result = this.#priv.settings.colHeaders;

    if (columnIndex === void 0) {
      const out = [];
      const ilen = columnsAsFunc ? this.countSourceCols() : this.countCols();

      for (let i = 0; i < ilen; i++) {
        out.push(this.getColHeader(i));
      }

      result = out;

    } else {
      const translateVisualIndexToColumns = (visualColumnIndex: number) => {
        const arr = [];
        const columnsLen = this.countSourceCols();
        let index = 0;

        for (; index < columnsLen; index++) {
          if (isFunction(this.getSettings().columns) && this.getSettings().columns(index)) {
            arr.push(index);
          }
        }

        return arr[visualColumnIndex];
      };
      const baseCol = columnIndex;
      const physicalColumn = this.#recordTranslator.toPhysicalColumn(baseCol);

      const prop = isFunction(this.getSettings().columns)
        ? translateVisualIndexToColumns(physicalColumn)
        : undefined;

      if (this.#priv.settings.colHeaders === false) {
        result = null;

      } else if (this.#priv.settings.columns && isFunction(this.#priv.settings.columns) &&
        (this.#priv.settings.columns as AnyFunction)(prop) && (this.#priv.settings.columns as AnyFunction)(prop).title) {
        result = (this.#priv.settings.columns as AnyFunction)(prop).title;

      } else if (this.#priv.settings.columns && this.#priv.settings.columns[physicalColumn] && this.#priv.settings.columns[physicalColumn].title) {
        result = this.#priv.settings.columns[physicalColumn].title;

      } else if (Array.isArray(this.#priv.settings.colHeaders) && this.#priv.settings.colHeaders[physicalColumn] !== void 0) {
        result = this.#priv.settings.colHeaders[physicalColumn];

      } else if (isFunction(this.#priv.settings.colHeaders)) {
        result = this.#priv.settings.colHeaders(physicalColumn);

      } else if (this.#priv.settings.colHeaders && typeof this.#priv.settings.colHeaders !== 'string' && typeof this.#priv.settings.colHeaders !== 'number') {
        // Hidden columns leave gaps in the letters (A, B, E), as in Excel.
        result = spreadsheetColumnLabel(this.#recordTranslator.columns!.toOrdered(baseCol)); // see #1458
      }
    }

    return result;
  }


  /**
   * Return column width from settings (no guessing). Private use intended.
   *
   * @private
   * @memberof Core#
   * @function _getColWidthFromSettings
   * @param {Number} col Visual col index.
   * @returns {Number}
   */
  _getColWidthFromSettings(col: number) {
    const cellProperties = this.getCellMeta(0, col);
    let width = cellProperties.width;

    if (width === void 0 || width === this.#priv.settings.width) {
      width = cellProperties.colWidths;
    }
    if (width !== void 0 && width !== null) {
      switch (typeof width) {
        case 'object': // array
          width = width[col];
          break;

        case 'function':
          width = width(col);
          break;
        default:
          break;
      }
      if (typeof width === 'string') {
        width = parseInt(width, 10);
      }
    }

    return width;
  }


  /**
   * Returns the width of the requested column.
   *
   * @memberof Core#
   * @function getColWidth
   * @param {Number} column Visual column index.
   * @returns {Number} Column width.
   * @fires Hooks#modifyColWidth
   */
  getColWidth(column: number) {
    let width = this._getColWidthFromSettings(column);

    width = this.runHooks('modifyColWidth', width, column);

    if (width === void 0) {
      width = ViewportColumnsCalculator.DEFAULT_WIDTH;
    }

    return width;
  }


  /**
   * Return row height from settings (no guessing). Private use intended.
   *
   * @private
   * @memberof Core#
   * @function _getRowHeightFromSettings
   * @param {Number} row Visual row index.
   * @returns {Number}
   */
  _getRowHeightFromSettings(row: number) {
    // let cellProperties = instance.getCellMeta(row, 0);
    // let height = cellProperties.height;
    //
    // if (height === void 0 || height === priv.settings.height) {
    //  height = cellProperties.rowHeights;
    // }
    let height = this.#priv.settings.rowHeights;

    if (height !== void 0 && height !== null) {
      switch (typeof height) {
        case 'object': // array
          height = height[row];
          break;

        case 'function':
          height = height(row);
          break;
        default:
          break;
      }
      if (typeof height === 'string') {
        height = parseInt(height, 10);
      }
    }

    return height;
  }


  /**
   * Returns the row height.
   *
   * @memberof Core#
   * @function getRowHeight
   * @param {Number} row Visual row index.
   * @returns {Number} The given row's height.
   * @fires Hooks#modifyRowHeight
   */
  getRowHeight(row: number) {
    let height = this._getRowHeightFromSettings(row);

    height = this.runHooks('modifyRowHeight', height, row);

    return height;
  }


  /**
   * Returns the total number of rows in the data source.
   *
   * @memberof Core#
   * @function countSourceRows
   * @returns {Number} Total number of rows.
   */
  countSourceRows() {
    const sourceLength = this.runHooks('modifySourceLength');
    return sourceLength || (this.getSourceData() ? this.getSourceData().length : 0);
  }


  /**
   * Returns the total number of columns in the data source.
   *
   * @memberof Core#
   * @function countSourceCols
   * @returns {Number} Total number of columns.
   */
  countSourceCols() {
    const obj = this.getSourceData() && this.getSourceData()[0] ? this.getSourceData()[0] : [];

    return isObject(obj) ? deepObjectSize(obj) : obj.length || 0;
  }


  /**
   * Returns the total number of visual rows in the table.
   *
   * @memberof Core#
   * @function countRows
   * @returns {Number} Total number of rows.
   */
  countRows() {
    return this.#datamap.getLength();
  }

  /** The last visual row of the data (the data's last row while no row is hidden). */
  #lastRow(): number {
    return this.#recordTranslator.rows!.isActive() ? this.countRows() - 1 : this.#priv.settings.data.length - 1;
  }

  /**
   * The hidden rows and columns: plugins (hidden rows, filters, …) hide physical indexes, and visual indexes skip them.
   * Sorting and moving apply first; a change of order rebuilds the maps.
   */
  #initVisibility(): void {
    // Without sorting or moving, the ordered index is the physical one: no hooks to run for each row.
    const rows = new IndexVisibility(() => this.countSourceRows(), () => (this.hasHook('modifyRow') ?
      (ordered: number) => this.runHooks('modifyRow', ordered) : null));
    const columns = new IndexVisibility(() => this.#countAllCols(), () => (this.hasHook('modifyCol') ?
      (ordered: number) => this.runHooks('modifyCol', ordered) : null));

    this.#recordTranslator.rows = rows;
    this.#recordTranslator.columns = columns;

    this.addHook('afterColumnSort', () => rows.invalidate());
    this.addHook('afterRowMove', () => rows.invalidate());
    this.addHook('afterColumnMove', () => columns.invalidate());
    this.addHook('afterLoadData', () => {
      rows.invalidate();
      columns.invalidate();
    });
    this.addHook('afterCreateRow', (index: number, amount: number) => rows.onInsert(index, amount));
    this.addHook('afterRemoveRow', (_index: number, _amount: number, physicalRows: number[] = []) =>
      rows.onRemove(physicalRows));
    this.addHook('afterCreateCol', (index: number, amount: number) => columns.onInsert(index, amount));
    this.addHook('afterRemoveCol', (_index: number, _amount: number, physicalColumns: number[] = []) =>
      columns.onRemove(physicalColumns));
  }


  /** Whether `#fillContainer` is adding rows and columns (its render must not start it again). */
  #filling = false;

  /**
   * `fillContainer`: after a render, adds the empty rows and columns that the grid's view has room for (as `minRows`
   * and `minCols` do), so the element shows cells to its edges, and a screen more when the view is scrolled to the
   * end. Columns are added only to array data without `columns`.
   */
  #fillContainer(): void {
    const settings = this.#priv.settings;
    const wtTable = this.view?.wt?.wtTable;

    if (!settings.fillContainer || this.#filling || !wtTable) {
      return;
    }
    const holder = wtTable.holder as HTMLElement;
    const hider = wtTable.hider as HTMLElement;
    const rowHeight = getRowHeight(this.rootElement);
    const columnWidth = this.view.wt.getSetting('defaultColumnWidth') as number || 50;
    // What the view has room for, or a screen more when it is scrolled to the end.
    const atBottom = holder.scrollHeight > holder.clientHeight &&
      holder.scrollTop + holder.clientHeight >= holder.scrollHeight - 2 * rowHeight;
    const atRight = holder.scrollWidth > holder.clientWidth &&
      holder.scrollLeft + holder.clientWidth >= holder.scrollWidth - columnWidth;
    // While the cells do not overflow the view, one more row and column than it has room for, so it can scroll on.
    const missing = (room: number, used: number, size: number) => (used <= room ? Math.floor((room - used) / size) + 1 : 0);
    const rows = Math.min(atBottom ? Math.ceil(holder.clientHeight / rowHeight) :
      missing(holder.clientHeight, hider.offsetHeight, rowHeight), settings.maxRows - this.countSourceRows());
    const canAddColumns = !settings.columns && this.dataType === 'array';
    const columns = canAddColumns ? Math.min(atRight ? Math.ceil(holder.clientWidth / columnWidth) :
      missing(holder.clientWidth, hider.offsetWidth, columnWidth), settings.maxCols - this.countCols()) : 0;

    if (rows <= 0 && columns <= 0) {
      return;
    }
    this.#filling = true;
    try {
      if (rows > 0) {
        this.#datamap.createRow(this.countSourceRows(), rows, 'auto');
      }
      if (columns > 0) {
        this.#datamap.createCol(this.#countAllCols(), columns, 'auto');
      }
      this.render();
    } finally {
      this.#filling = false;
    }
  }

  /**
   * Returns the total number of visible columns in the table.
   *
   * @memberof Core#
   * @function countCols
   * @returns {Number} Total number of columns.
   */
  countCols() {
    const columns = this.#recordTranslator.columns;

    return columns && columns.isActive() ? columns.count() : this.#countAllCols();
  }

  /** The number of columns, hidden ones included. */
  #countAllCols(): number {
    const maxCols = this.getSettings().maxCols;
    let dataHasLength = false;
    let dataLen = 0;

    if (this.dataType === 'array') {
      dataHasLength = this.#priv.settings.data && this.#priv.settings.data[0] && this.#priv.settings.data[0].length;
    }

    if (dataHasLength) {
      dataLen = this.#priv.settings.data[0].length;
    }

    if (this.#priv.settings.columns) {
      const columnsIsFunction = isFunction(this.#priv.settings.columns);

      if (columnsIsFunction) {
        if (this.dataType === 'array') {
          let columnLen = 0;

          for (let i = 0; i < dataLen; i++) {
            if (this.#priv.settings.columns(i)) {
              columnLen += 1;
            }
          }

          dataLen = columnLen;
        } else if (this.dataType === 'object' || this.dataType === 'function') {
          dataLen = this.#datamap.colToPropCache.length;
        }

      } else {
        dataLen = this.#priv.settings.columns.length;
      }

    } else if (this.dataType === 'object' || this.dataType === 'function') {
      dataLen = this.#datamap.colToPropCache.length;
    }

    return Math.min(maxCols, dataLen);
  }


  /**
   * Returns an visual index of the first rendered row.
   *
   * @memberof Core#
   * @function rowOffset
   * @returns {Number} Visual index of first rendered row.
   */
  rowOffset() {
    return this.view.wt.wtTable.getFirstRenderedRow();
  }


  /**
   * Returns the visual index of the first rendered column.
   *
   * @memberof Core#
   * @function colOffset
   * @returns {Number} Visual index of the first visible column.
   */
  colOffset() {
    return this.view.wt.wtTable.getFirstRenderedColumn();
  }


  /**
   * Returns the number of rendered rows (including rows partially or fully rendered outside viewport).
   *
   * @memberof Core#
   * @function countRenderedRows
   * @returns {Number} Returns -1 if table is not visible.
   */
  countRenderedRows() {
    return this.view.wt.drawn ? this.view.wt.wtTable.getRenderedRowsCount() : -1;
  }


  /**
   * Returns the number of visible rows (rendered rows that fully fit inside viewport).
   *
   * @memberof Core#
   * @function countVisibleRows
   * @returns {Number} Number of visible rows or -1.
   */
  countVisibleRows() {
    return this.view.wt.drawn ? this.view.wt.wtTable.getVisibleRowsCount() : -1;
  }


  /**
   * Returns the number of rendered columns (including columns partially or fully rendered outside viewport).
   *
   * @memberof Core#
   * @function countRenderedCols
   * @returns {Number} Returns -1 if table is not visible.
   */
  countRenderedCols() {
    return this.view.wt.drawn ? this.view.wt.wtTable.getRenderedColumnsCount() : -1;
  }


  /**
   * Returns the number of visible columns. Returns -1 if table is not visible
   *
   * @memberof Core#
   * @function countVisibleCols
   * @return {Number} Number of visible columns or -1.
   */
  countVisibleCols() {
    return this.view.wt.drawn ? this.view.wt.wtTable.getVisibleColumnsCount() : -1;
  }


  /**
   * Returns the number of empty rows. If the optional ending parameter is `true`, returns the
   * number of empty rows at the bottom of the table.
   *
   * @memberof Core#
   * @function countEmptyRows
   * @param {Boolean} [ending=false] If `true`, will only count empty rows at the end of the data source.
   * @returns {Number} Count empty rows.
   */
  countEmptyRows(ending: boolean = false) {
    let emptyRows = 0;

    rangeEachReverse(this.countRows() - 1, (visualIndex) => {
      if (this.isEmptyRow(visualIndex)) {
        emptyRows += 1;

      } else if (ending === true) {
        return false;
      }
    });

    return emptyRows;
  }


  /**
   * Returns the number of empty columns. If the optional ending parameter is `true`, returns the number of empty
   * columns at right hand edge of the table.
   *
   * @memberof Core#
   * @function countEmptyCols
   * @param {Boolean} [ending=false] If `true`, will only count empty columns at the end of the data source row.
   * @returns {Number} Count empty cols.
   */
  countEmptyCols(ending: boolean = false) {
    if (this.countRows() < 1) {
      return 0;
    }

    let emptyColumns = 0;

    rangeEachReverse(this.countCols() - 1, (visualIndex) => {
      if (this.isEmptyCol(visualIndex)) {
        emptyColumns += 1;

      } else if (ending === true) {
        return false;
      }
    });

    return emptyColumns;
  }


  /**
   * Check if all cells in the row declared by the `row` argument are empty.
   *
   * @memberof Core#
   * @function isEmptyRow
   * @param {Number} row Visual row index.
   * @returns {Boolean} `true` if the row at the given `row` is empty, `false` otherwise.
   */
  isEmptyRow(row: number) {
    return this.#priv.settings.isEmptyRow.call(this, row);
  }


  /**
   * Check if all cells in the the column declared by the `column` argument are empty.
   *
   * @memberof Core#
   * @function isEmptyCol
   * @param {Number} column Column index.
   * @returns {Boolean} `true` if the column at the given `col` is empty, `false` otherwise.
   */
  isEmptyCol(column: number) {
    return this.#priv.settings.isEmptyCol.call(this, column);
  }


  /**
   * Select cell specified by `row` and `column` values or a range of cells finishing at `endRow`, `endCol`. If the table
   * was configured to support data column properties that properties can be used to making a selection.
   *
   * By default, viewport will be scrolled to the selection. After the `selectCell` method had finished, the instance
   * will be listening to keyboard input on the document.
   *
   * @example
   * ```js
   * // select a single cell
   * hot.selectCell(2, 4);
   * // select a single cell using column property
   * hot.selectCell(2, 'address');
   * // select a range of cells
   * hot.selectCell(2, 4, 3, 5);
   * // select a range of cells using column properties
   * hot.selectCell(2, 'address', 3, 'phone_number');
   * // select a range of cells without scrolling to them
   * hot.selectCell(2, 'address', 3, 'phone_number', false);
   * ```
   *
   * @memberof Core#
   * @function selectCell
   * @param {Number} row Visual row index.
   * @param {Number|String} column Visual column index or column property.
   * @param {Number} [endRow] Visual end row index (if selecting a range).
   * @param {Number|String} [endColumn] Visual end column index or column property (if selecting a range).
   * @param {Boolean} [scrollToCell=true] If `true`, the viewport will be scrolled to the selection.
   * @param {Boolean} [changeListener=true] If `false`, FreeSheet will not change keyboard events listener to himself.
   * @returns {Boolean} `true` if selection was successful, `false` otherwise.
   */
  selectCell(row: number, column: number | string, endRow?: number, endColumn?: number | string, scrollToCell: boolean = true, changeListener: boolean = true) {
    if (isUndefined(row) || isUndefined(column)) {
      return false;
    }

    return this.selectCells([[row, column, endRow, endColumn]], scrollToCell, changeListener);
  }


  /**
   * Make multiple, non-contiguous selection specified by `row` and `column` values or a range of cells
   * finishing at `endRow`, `endColumn`. The method supports two input formats which are the same as that
   * produces by `getSelected` and `getSelectedRange` methods.
   *
   * By default, viewport will be scrolled to selection. After the `selectCells` method had finished, the instance
   * will be listening to keyboard input on the document.
   *
   * @example
   * ```js
   * // Using an array of arrays.
   * hot.selectCells([[1, 1, 2, 2], [3, 3], [6, 2, 0, 2]]);
   * // Using an array of arrays with defined columns as props.
   * hot.selectCells([[1, 'id', 2, 'first_name'], [3, 'full_name'], [6, 'last_name', 0, 'first_name']]);
   * // Using an array of CellRange objects (produced by `.getSelectedRange()` method).
   * const selected = hot.getSelectedRange();
   *
   * selected[0].from.row = 0;
   * selected[0].from.col = 0;
   *
   * hot.selectCells(selected);
   * ```
   *
   * @memberof Core#
   * @since 0.38.0
   * @function selectCells
   * @param {Array[]|CellRange[]} coords Visual coords passed as an array of array (`[[rowStart, columnStart, rowEnd, columnEnd], ...]`)
   *                                     the same format as `getSelected` method returns or as an CellRange objects
   *                                     which is the same format what `getSelectedRange` method returns.
   * @param {Boolean} [scrollToCell=true] If `true`, the viewport will be scrolled to the selection.
   * @param {Boolean} [changeListener=true] If `false`, FreeSheet will not change keyboard events listener to himself.
   * @returns {Boolean} `true` if selection was successful, `false` otherwise.
   */
  selectCells(coords: Parameters<Selection['selectCells']>[0] = [[]] as never, scrollToCell: boolean = true, changeListener: boolean = true) {
    if (scrollToCell === false) {
      this.#preventScrollingToCell = true;
    }

    const wasSelected = this.selection.selectCells(coords as Parameters<typeof this.selection.selectCells>[0]);

    if (wasSelected && changeListener) {
      this.listen();
    }
    this.#preventScrollingToCell = false;

    return wasSelected;
  }


  /**
   * Select the cell specified by the `row` and `prop` arguments, or a range finishing at `endRow`, `endProp`.
   * By default, viewport will be scrolled to selection.
   *
   * @deprecated
   * @memberof Core#
   * @function selectCellByProp
   * @param {Number} row Visual row index.
   * @param {String} prop Property name.
   * @param {Number} [endRow] visual end row index (if selecting a range).
   * @param {String} [endProp] End property name (if selecting a range).
   * @param {Boolean} [scrollToCell=true] If `true`, viewport will be scrolled to the selection.
   * @param {Boolean} [changeListener=true] If `false`, FreeSheet will not change keyboard events listener to himself.
   * @returns {Boolean} `true` if selection was successful, `false` otherwise.
   */
  selectCellByProp(row: number, prop: string, endRow?: number, endProp?: string, scrollToCell: boolean = true, changeListener: boolean = true) {
    warn(toSingleLine`Deprecation warning: This method is going to be removed in the next release.
      If you want to select a cell using props, please use the \`selectCell\` method.`);

    return this.selectCells([[row, prop, endRow, endProp]], scrollToCell, changeListener);
  }


  /**
   * Select column specified by `startColumn` visual index, column property or a range of columns finishing at `endColumn`.
   *
   * @example
   * ```js
   * // Select column using visual index.
   * hot.selectColumns(1);
   * // Select column using column property.
   * hot.selectColumns('id');
   * // Select range of columns using visual indexes.
   * hot.selectColumns(1, 4);
   * // Select range of columns using column properties.
   * hot.selectColumns('id', 'last_name');
   * ```
   *
   * @memberof Core#
   * @since 0.38.0
   * @function selectColumns
   * @param {Number} startColumn The visual column index from which the selection starts.
   * @param {Number} [endColumn=startColumn] The visual column index to which the selection finishes. If `endColumn`
   *                                         is not defined the column defined by `startColumn` will be selected.
   * @returns {Boolean} `true` if selection was successful, `false` otherwise.
   */
  selectColumns(startColumn: number, endColumn: number = startColumn) {
    return this.selection.selectColumns(startColumn, endColumn);
  }


  /**
   * Select row specified by `startRow` visual index or a range of rows finishing at `endRow`.
   *
   * @example
   * ```js
   * // Select row using visual index.
   * hot.selectRows(1);
   * // Select range of rows using visual indexes.
   * hot.selectRows(1, 4);
   * ```
   *
   * @memberof Core#
   * @since 0.38.0
   * @function selectRows
   * @param {Number} startRow The visual row index from which the selection starts.
   * @param {Number} [endRow=startRow] The visual row index to which the selection finishes. If `endRow`
   *                                   is not defined the row defined by `startRow` will be selected.
   * @returns {Boolean} `true` if selection was successful, `false` otherwise.
   */
  selectRows(startRow: number, endRow: number = startRow) {
    return this.selection.selectRows(startRow, endRow);
  }


  /**
   * Deselects the current cell selection on the table.
   *
   * @memberof Core#
   * @function deselectCell
   */
  deselectCell() {
    this.selection.deselect();
  }


  /**
   * Select the whole table. The previous selection will be overwritten.
   *
   * @since 0.38.2
   * @memberof Core#
   * @function selectAll
   */
  selectAll() {
    this.#preventScrollingToCell = true;
    this.selection.selectAll();
    this.#preventScrollingToCell = false;
  }


  /**
   * Scroll viewport to coordinates specified by the `row` and `column` arguments.
   *
   * @memberof Core#
   * @function scrollViewportTo
   * @param {Number} [row] Visual row index.
   * @param {Number} [column] Visual column index.
   * @param {Boolean} [snapToBottom = false] If `true`, viewport is scrolled to show the cell on the bottom of the table.
   * @param {Boolean} [snapToRight = false] If `true`, viewport is scrolled to show the cell on the right side of the table.
   * @returns {Boolean} `true` if scroll was successful, `false` otherwise.
   */
  scrollViewportTo(row?: number, column?: number, snapToBottom: boolean = false, snapToRight: boolean = false) {
    const snapToTop = !snapToBottom;
    const snapToLeft = !snapToRight;
    let result = false;

    if (row !== void 0 && column !== void 0) {
      result = this.view.scrollViewport(new CellCoords(row, column), snapToTop, snapToRight, snapToBottom, snapToLeft);
    }
    if (typeof row === 'number' && typeof column !== 'number') {
      result = this.view.scrollViewportVertically(row, snapToTop, snapToBottom);
    }
    if (typeof column === 'number' && typeof row !== 'number') {
      result = this.view.scrollViewportHorizontally(column, snapToRight, snapToLeft);
    }

    return result;
  }


  /**
   * Removes the table from the DOM and destroys the instance of the FreeSheet.
   *
   * @memberof Core#
   * @function destroy
   * @fires Hooks#afterDestroy
   */
  destroy() {
    const workbook = getWorkbook(this);

    // The document's panel goes with the grid that holds it.
    if (!workbook || workbook.root === this) {
      findSidePanel(this)?.destroy();
    }
    // The grid created with new FreeSheet holds the document: the other sheets go with it.
    if (workbook && workbook.root === this) {
      workbook.destroy();
    }
    this._clearTimeouts();
    this._clearImmediates();

    if (this.view) { // in case HT is destroyed before initialization has finished
      this.view.destroy();
    }
    if (this.#dataSource) {
      this.#dataSource.destroy();
    }
    // The grid is dead after destroy: the references go (the methods above throw from now on).
    this.#dataSource = null as never;

    keyStateStopObserving();

    empty(this.rootElement);

    // The frame becomes the element it was: the grid's element inside it goes.
    if (this.#frame) {
      this.rootElement.remove();
      this.#frame.classList.remove('fs-document');
      this.#frame = null;
    }
    this.#eventManager.destroy();

    if (this.#editorManager) {
      this.#editorManager.destroy();
    }

    this.runHooks('afterDestroy');
    Hooks.getSingleton().destroy(this);

    const self = this as unknown as AnyObject;

    objectEach(self, (property, key) => {
      // replace instance methods with post mortem
      if (isFunction(property)) {
        self[key] = postMortem(key);

      } else if (key !== 'guid') {
        // replace instance properties with null (restores memory)
        // it should not be necessary but this prevents a memory leak side effects that show itself in Jasmine tests
        self[key] = null;
      }
    });
    // The class methods too (they are on the prototype, not on the instance).
    Object.getOwnPropertyNames(Core.prototype).forEach((key) => {
      if (key !== 'constructor' && !hasOwnProperty(self, key)) {
        self[key] = postMortem(key);
      }
    });

    this.isDestroyed = true;

    // replace private properties with null (restores memory)
    // it should not be necessary but this prevents a memory leak side effects that show itself in Jasmine tests
    if (this.#datamap) {
      this.#datamap.destroy();
    }
    this.#datamap = null as never;
    this.#priv = null as never;
    this.#grid = null as never;
    this.selection = null as never;
    this.#editorManager = null as never;
    this.#GridSettings = null as never;
  }


  /**
   * Returns the active editor class instance.
   *
   * @memberof Core#
   * @function getActiveEditor
   * @returns {EditorBase} The active editor instance.
   */
  getActiveEditor() {
    return this.#editorManager.getActiveEditor();
  }


  /**
   * Returns plugin instance by provided its name.
   *
   * @memberof Core#
   * @function getPlugin
   * @param {String} pluginName The plugin name.
   * @returns {BasePlugin} The plugin instance.
   */
  getPlugin<Name extends string>(pluginName: Name): PluginByName<Name> {
    return getPlugin(this, pluginName) as PluginByName<Name>;
  }


  /**
   * Returns the FreeSheet instance.
   *
   * @memberof Core#
   * @function getInstance
   * @returns {FreeSheet} The FreeSheet instance.
   */
  getInstance() {
    return this;
  }


  /**
   * Adds listener to the specified hook name (only for this FreeSheet instance).
   *
   * @memberof Core#
   * @function addHook
   * @see Hooks#add
   * @param {String} key Hook name (see {@link Hooks}).
   * @param {Function|Array} callback Function or array of functions.
   * @example
   * ```js
   * hot.addHook('beforeInit', myCallback);
   * ```
   */
  addHook(key: string, callback: HookCallback | HookCallback[]) {
    Hooks.getSingleton().add(key, callback, this);
  }


  /**
   * Check if for a specified hook name there are added listeners (only for this FreeSheet instance). All available
   * hooks you will find {@link Hooks}.
   *
   * @memberof Core#
   * @function hasHook
   * @see Hooks#has
   * @param {String} key Hook name
   * @return {Boolean}
   *
   * @example
   * ```js
   * const hasBeforeInitListeners = hot.hasHook('beforeInit');
   * ```
   */
  hasHook(key: string) {
    return Hooks.getSingleton().has(key, this);
  }


  /**
   * Adds listener to specified hook name (only for this FreeSheet instance). After the listener is triggered,
   * it will be automatically removed.
   *
   * @memberof Core#
   * @function addHookOnce
   * @see Hooks#once
   * @param {String} key Hook name (see {@link Hooks}).
   * @param {Function|Array} callback Function or array of functions.
   * @example
   * ```js
   * hot.addHookOnce('beforeInit', myCallback);
   * ```
   */
  addHookOnce(key: string, callback: HookCallback | HookCallback[]) {
    Hooks.getSingleton().once(key, callback, this);
  }


  /**
   * Removes the hook listener previously registered with {@link Core#addHook}.
   *
   * @memberof Core#
   * @function removeHook
   * @see Hooks#remove
   * @param {String} key Hook name.
   * @param {Function} callback Reference to the function which has been registered using {@link Core#addHook}.
   *
   * @example
   * ```js
   * hot.removeHook('beforeInit', myCallback);
   * ```
   */
  removeHook(key: string, callback: HookCallback) {
    Hooks.getSingleton().remove(key, callback, this);
  }


  /**
   * Run the callbacks for the hook provided in the `key` argument using the parameters given in the other arguments.
   *
   * @memberof Core#
   * @function runHooks
   * @see Hooks#run
   * @param {String} key Hook name.
   * @param {*} [p1] Argument passed to the callback.
   * @param {*} [p2] Argument passed to the callback.
   * @param {*} [p3] Argument passed to the callback.
   * @param {*} [p4] Argument passed to the callback.
   * @param {*} [p5] Argument passed to the callback.
   * @param {*} [p6] Argument passed to the callback.
   * @returns {*}
   *
   * @example
   * ```js
   * // Run built-in hook
   * hot.runHooks('beforeInit');
   * // Run custom hook
   * hot.runHooks('customAction', 10, 'foo');
   * ```
   */
  runHooks(key: string, p1?: unknown, p2?: unknown, p3?: unknown, p4?: unknown, p5?: unknown, p6?: unknown) {
    return Hooks.getSingleton().run(this, key, p1, p2, p3, p4, p5, p6);
  }


  /**
   * Get language phrase for specified dictionary key.
   *
   * @memberof Core#
   * @function getTranslatedPhrase
   * @since 0.35.0
   * @param {String} dictionaryKey Constant which is dictionary key.
   * @param {*} extraArguments Arguments which will be handled by formatters.
   * @returns {String}
   */
  getTranslatedPhrase(dictionaryKey: string, extraArguments?: unknown) {
    return getTranslatedPhrase(this.#priv.settings.language, dictionaryKey, extraArguments);
  }


  /**
   * Sets timeout. Purpose of this method is to clear all known timeouts when `destroy` method is called.
   *
   * @param {Number|Function} handle Handler returned from setTimeout or function to execute (it will be automatically wraped
   *                                 by setTimeout function).
   * @param {Number} [delay=0] If first argument is passed as a function this argument set delay of the execution of that function.
   * @private
   */
  _registerTimeout(handle: number | AnyFunction, delay: number = 0) {
    let handleFunc = handle;

    if (typeof handleFunc === 'function') {
      handleFunc = setTimeout(handleFunc, delay);
    }

    this.timeouts.push(handleFunc);
  }


  /**
   * Clears all known timeouts.
   *
   * @private
   */
  _clearTimeouts() {
    arrayEach(this.timeouts as number[], (handler) => {
      clearTimeout(handler);
    });
  }


  /**
   * Execute function execution to the next event loop cycle. Purpose of this method is to clear all known timeouts when `destroy` method is called.
   *
   * @param {Function} callback Function to be delayed in execution.
   * @private
   */
  _registerImmediate(callback: AnyFunction) {
    this.immediates.push(setImmediate(callback));
  }


  /**
   * Clears all known timeouts.
   *
   * @private
   */
  _clearImmediates() {
    arrayEach(this.immediates as number[], (handler) => {
      clearImmediate(handler);
    });
  }


  /**
   * Refresh selection borders. This is temporary method relic after selection rewrite.
   *
   * @private
   * @param {Boolean} [revertOriginal=false] If `true`, the previous value will be restored. Otherwise, the edited value will be saved.
   * @param {Boolean} [prepareEditorIfNeeded=true] If `true` the editor under the selected cell will be prepared to open.
   */
  _refreshBorders(revertOriginal: boolean | null = false, prepareEditorIfNeeded: boolean = true) {
    this.#editorManager.destroyEditor(revertOriginal ?? undefined); // callers pass null for false
    this.view.render();

    if (prepareEditorIfNeeded && this.selection.isSelected()) {
      this.#editorManager.prepareEditor();
    }
  }
}

// Also by name: plugins add their members to the grid's type with `declare module './core' { interface Core … }`.
export { Core };
export default Core;
