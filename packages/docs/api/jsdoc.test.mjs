import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlocks, readPlugin, readSettings } from './jsdoc.mjs';

const SOURCE = `
  /**
   * @description
   * Set new value to a cell. To change many cells at once, pass an array of \`changes\`.
   *
   * @memberof Core#
   * @function setDataAtCell
   * @param {Number|Array} row Visual row index or array of changes.
   * @param {Number} [column] Visual column index.
   * @param {Number} [amount=1] How many.
   * @param {String} [source] String that identifies how this change will be described.
   *                          It continues here.
   * @returns {Boolean} Whether it worked, see {@link Core#getData} and {@link Hooks#afterChange}.
   * @example
   * \`\`\`js
   * hot.setDataAtCell(0, 0, 'A1');
   * \`\`\`
   */
  this.setDataAtCell = function() {};

  /**
   * Hidden one.
   *
   * @memberof Core#
   * @function hidden
   * @private
   */

  /**
   * Fired after one or more cells has been changed in Handsontable.
   *
   * @event Hooks#afterChange
   * @param {Array} changes 2D array.
   * @deprecated Use something else.
   * @since 0.35.0
   */
`;

test('reads a method: description, parameters with optional and default values, returns, example, links', () => {
  const [method] = parseBlocks(SOURCE).filter(block => block.kind === 'method' && !block.private);

  assert.equal(method.name, 'setDataAtCell');
  assert.equal(method.owner, 'Core');
  assert.equal(method.description, 'Set new value to a cell. To change many cells at once, pass an array of `changes`.');
  assert.deepEqual(method.params, [
    { name: 'row', type: 'Number|Array', optional: false, default: undefined, description: 'Visual row index or array of changes.' },
    { name: 'column', type: 'Number', optional: true, default: undefined, description: 'Visual column index.' },
    { name: 'amount', type: 'Number', optional: true, default: '1', description: 'How many.' },
    { name: 'source', type: 'String', optional: true, default: undefined,
      description: 'String that identifies how this change will be described. It continues here.' },
  ]);
  assert.deepEqual(method.returns, {
    type: 'Boolean',
    description: 'Whether it worked, see [getData()](./methods#getdata) and [afterChange](./events#afterchange).',
  });
  assert.equal(method.examples[0], "```js\nhot.setDataAtCell(0, 0, 'A1');\n```");
});

test('marks private entries', () => {
  const hidden = parseBlocks(SOURCE).find(block => block.name === 'hidden');

  assert.equal(hidden.private, true);
});

test('reads an event, says FreeSheet instead of the upstream name, keeps deprecation and version', () => {
  const event = parseBlocks(SOURCE).find(block => block.kind === 'event');

  assert.equal(event.name, 'afterChange');
  assert.equal(event.description, 'Fired after one or more cells has been changed in FreeSheet.');
  assert.equal(event.params[0].name, 'changes');
  assert.equal(event.deprecated, 'Use something else.');
  assert.equal(event.since, '0.35.0');
});

test('reads settings written as methods, and does not let a method body run into the next setting', () => {
  const settings = readSettings(`
  DefaultSettings.prototype = {
    /**
     * Checks if a row is empty.
     *
     * @type {Function}
     * @param {Number} row Visual row index.
     * @returns {Boolean}
     */
    isEmptyRow(row) {
      /* a comment in the body */
      return row === 0;
    },

    /**
     * Re-renders the table when it becomes visible.
     *
     * @type {Boolean}
     * @default true
     */
    observeDOMVisibility: true,
  };`);

  assert.deepEqual(settings.map(({ name, type, default: value }) => [name, type, value]), [
    ['isEmptyRow', 'Function', 'function'],
    ['observeDOMVisibility', 'Boolean', 'true'],
  ]);
  assert.equal(settings[0].description, 'Checks if a row is empty.');
  assert.equal(settings[1].description, 'Re-renders the table when it becomes visible.');
  assert.deepEqual(settings[1].examples, []);
});

test('reads settings with their default value from the line after the comment', () => {
  const settings = readSettings(`
  const DefaultSettings = function() {};
  DefaultSettings.prototype = {
    /**
     * Initial data source. See {@link Options#columns}.
     *
     * @type {Array[]|Object[]}
     * @default undefined
     */
    data: void 0,

    /**
     * Height of the grid.
     *
     * @type {Number|Function}
     * @example
     * \`\`\`js
     * height: 500,
     * \`\`\`
     */
    height: void 0,

    /**
     * @type {Boolean}
     * @private
     */
    internal: true,
  };`);

  assert.deepEqual(settings.map(({ name, type, default: value }) => [name, type, value]), [
    ['data', 'Array[]|Object[]', 'undefined'],
    ['height', 'Number|Function', 'undefined'],
  ]);
  assert.equal(settings[0].description, 'Initial data source. See [columns](./settings#columns).');
  assert.equal(settings[1].examples.length, 1);
});

test('drops links to other sites in {@link …} and keeps their text', () => {
  const [block] = parseBlocks(`
  /**
   * See the [list of sources]{@link https://example.com/sources}.
   * @event Hooks#x
   */`);

  assert.equal(block.description, 'See the list of sources.');
});

test('reads a plugin: its description and its public class methods', () => {
  const plugin = readPlugin(`
/**
 * @plugin ColumnSorting
 *
 * @description
 * This plugin sorts the view by columns. Set {@link Options#columnSorting}.
 *
 * @example
 * \`\`\`js
 * columnSorting: true
 * \`\`\`
 */
class ColumnSorting extends BasePlugin {
  constructor(hotInstance) {
    super(hotInstance);
  }

  /**
   * Sorts the table.
   *
   * @param {Object|Array} sortConfig Sort configuration.
   */
  sort(sortConfig) {
  }

  /**
   * Inner helper.
   *
   * @private
   */
  rebuild() {
  }
}`);

  assert.equal(plugin.name, 'ColumnSorting');
  assert.equal(plugin.description, 'This plugin sorts the view by columns. Set [columnSorting](./settings#columnsorting).');
  assert.equal(plugin.examples.length, 1);
  assert.deepEqual(plugin.methods.map(({ name, params }) => [name, params.length]), [['sort', 1]]);
});

test('keeps paragraphs and lists of a description, and does not turn indented lines into code', () => {
  const [block] = parseBlocks(`
  /**
   * First paragraph
   * continues here.
   *
   * It exposes:
   * - __save__ (key: String)
   *   Saves a value.
   * - __load__ (key: String)
   *
   *     Deeply indented text.
   * @event Hooks#x
   */`);

  assert.equal(block.description, [
    'First paragraph',
    'continues here.',
    '',
    'It exposes:',
    '- __save__ (key: String)',
    '  Saves a value.',
    '- __load__ (key: String)',
    '',
    'Deeply indented text.',
  ].join('\n'));
});

test('drops "see the docs" sentences and placeholder links to the repository, and resolves Options#name links', () => {
  const [block] = parseBlocks(`
  /**
   * Makes cell [read only](https://github.com/freegrid-web/sheet). See [data-schema](https://github.com/freegrid-web/sheet) for more options.
   * You can read more about renderers [in the documentation](https://github.com/freegrid-web/sheet). Uses the [Options#type](https://github.com/freegrid-web/sheet) key.
   * @event Hooks#x
   */`);

  assert.equal(block.description, 'Makes cell read only.\nUses the [type](./settings#type) key.');
});

test('takes parameter and return types of a TypeScript plugin from the signature', () => {
  const plugin = readPlugin(`
/**
 * @plugin Search
 */
class Search extends BasePlugin {
  /**
   * Finds cells.
   *
   * @param queryStr The text to find.
   * @param [callback] Called for each cell.
   * @param [queryMethod=defaultQuery] Compares a cell with the text.
   * @returns The found cells.
   */
  query(queryStr: string, callback?: (row: number, col: number, data: unknown, result: boolean) => void,
    queryMethod: QueryMethod = defaultQuery): Array<{ row: number; col: number; data: unknown }> {
  }

  /**
   * Whether the plugin is on.
   *
   * @returns {Boolean} JSDoc types still win.
   */
  isEnabled(): boolean {
  }

  /**
   * Enables it.
   */
  enablePlugin(): void {
  }
}`);

  const [query, isEnabled, enablePlugin] = plugin.methods;

  assert.deepEqual(query.params.map(({ name, type, optional, default: value }) => [name, type, optional, value]), [
    ['queryStr', 'string', false, undefined],
    ['callback', '(row: number, col: number, data: unknown, result: boolean) => void', true, undefined],
    ['queryMethod', 'QueryMethod', true, 'defaultQuery'],
  ]);
  assert.equal(query.params[0].description, 'The text to find.');
  assert.deepEqual(query.returns, { type: 'Array<{ row: number; col: number; data: unknown }>', description: 'The found cells.' });
  assert.equal(isEnabled.returns.type, 'Boolean');
  assert.equal(enablePlugin.returns, undefined);
});

test('a TypeScript method without @returns gets its return type from the signature (but not void)', () => {
  const plugin = readPlugin(`
/**
 * @plugin Search
 */
class Search extends BasePlugin {
  /**
   * Whether the plugin is on.
   */
  isEnabled(): boolean {
  }

  /**
   * Enables it.
   */
  enablePlugin(): void {
  }
}`);

  const [isEnabled, enablePlugin] = plugin.methods;

  assert.deepEqual(isEnabled.returns, { type: 'boolean', description: '' });
  assert.equal(enablePlugin.returns, undefined);
});

test('a line comment between a JSDoc comment and its method does not join it with the next method', () => {
  const plugin = readPlugin(`
/**
 * @plugin Search
 */
class Search extends BasePlugin {
  /**
   * Hook callback.
   *
   * @private
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onBeforeRenderer(TD: HTMLTableCellElement): void {
  }

  /**
   * Destroys the plugin instance.
   */
  destroy(): void {
  }
}`);

  assert.deepEqual(plugin.methods.map(({ name, description }) => [name, description]),
    [['destroy', 'Destroys the plugin instance.']]);
});

test('the JSDoc of a field set in the constructor does not take the next method', () => {
  const plugin = readPlugin(`
/**
 * @plugin DragToScroll
 */
class DragToScroll extends BasePlugin {
  constructor(hotInstance) {
    super(hotInstance);
    /**
     * Callback function.
     *
     * @private
     * @type {Function}
     */
    this.callback = null;
  }

  /**
   * Checks if the plugin is enabled.
   *
   * @returns {Boolean}
   */
  isEnabled() {
  }
}`);

  assert.deepEqual(plugin.methods.map(({ name, description }) => [name, description]),
    [['isEnabled', 'Checks if the plugin is enabled.']]);
});

test('a TypeScript parameter without a type gets it from a literal default value', () => {
  const plugin = readPlugin(`
/**
 * @plugin AutoColumnSize
 */
class AutoColumnSize extends BasePlugin {
  /**
   * Gets a width.
   *
   * @param column Column index.
   * @param [keepMinimum=true] Keeps the minimum.
   * @param [step=50] A step.
   * @param [unit='px'] A unit.
   * @param [range] A range.
   */
  getColumnWidth(column: number, keepMinimum = true, step = 50, unit = 'px', range = this.defaultRange()): number {
  }
}`);

  assert.deepEqual(plugin.methods[0].params.map(({ name, type }) => [name, type]), [
    ['column', 'number'],
    ['keepMinimum', 'boolean'],
    ['step', 'number'],
    ['unit', 'string'],
    ['range', ''],
  ]);
});

test('a plugin without @plugin is the documented class registered under its name', () => {
  const source = `
/** A group as the API gives it. */
type Group = { from: number };

/**
 * Row groups, as a spreadsheet's outline.
 */
class RowGroups extends Outline {
  /** Groups rows (visual indexes). */
  groupRows(from: number, to = from): void {
  }

  /**
   * Draws the gutter.
   *
   * @private
   */
  decorate(): void {
  }
}

registerPlugin('rowGroups', RowGroups);`;
  const plugin = readPlugin(source, 'RowGroups');

  assert.equal(plugin.name, 'RowGroups');
  assert.equal(plugin.description, 'Row groups, as a spreadsheet\'s outline.');
  // Without @param, the parameters come from the signature.
  assert.deepEqual(plugin.methods.map(({ name, params }) => [name, params.map(({ name: param, optional }) => [param, optional])]),
    [['groupRows', [['from', false], ['to', true]]]]);
  assert.equal(readPlugin('class Other extends BasePlugin {}'), null);
});
