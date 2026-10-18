describe('Core row groups', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu, .fs-sheet-tabs').remove();
  });

  const grid = (settings = {}) => handsontable({
    data: createSpreadsheetData(10, 3), rowHeaders: true, colHeaders: true, rowGroups: true, ...settings });
  const toggle = row => $(getCell(row, -1)).find('.fs-row-groups__toggle');

  it('groups rows, draws the gutter and collapses and expands a group with its button', () => {
    const hot = grid();
    const plugin = hot.getPlugin('rowGroups');

    plugin.groupRows(1, 3);
    expect(plugin.getGroups()).toEqual([{ from: 1, to: 3, level: 1, collapsed: false }]);
    expect($(getCell(2, -1)).find('.fs-row-groups__line').length).toBe(1);
    // The button is on the row after the group.
    expect(toggle(4).text()).toBe('−');

    toggle(4).simulate('mousedown');
    expect(hot.countRows()).toBe(7);
    expect(getDataAtCell(1, 0)).toBe('A5');
    expect(toggle(1).text()).toBe('+');
    expect(toggle(1).attr('aria-expanded')).toBe('false');

    toggle(1).simulate('mousedown');
    expect(hot.countRows()).toBe(10);
    expect(getDataAtCell(1, 0)).toBe('A2');
  });

  it('can click every −/+ and level button, also of inner groups (nothing covers them)', () => {
    const hot = grid();
    const plugin = hot.getPlugin('rowGroups');

    plugin.groupRows(1, 7);
    plugin.groupRows(2, 3);
    plugin.groupRows(5, 6);
    const buttons = $('.fs-row-groups__toggle, .fs-row-groups__level').filter((i, button) => {
      const box = button.getBoundingClientRect();

      return box.width > 0 && document.elementFromPoint(box.left + 1, box.top + 1) !== null;
    }).get();

    expect(buttons.length).toBeGreaterThan(0);
    // Each button, where it shows, is what a click there reaches.
    const topmost = buttons.map((button) => {
      const box = button.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + (box.width / 2), box.top + (box.height / 2));

      return hit && hit.closest('.fs-row-groups__toggle, .fs-row-groups__level') ? hit.textContent : hit?.className;
    });

    expect(topmost.filter(text => !['−', '+', '1', '2', '3'].includes(text))).toEqual([]);
  });

  it('nests groups in levels, and shows the outline down to a level from the corner', () => {
    const hot = grid();
    const plugin = hot.getPlugin('rowGroups');

    plugin.groupRows(1, 6);
    plugin.groupRows(2, 3);
    expect(plugin.getGroups().map(group => group.level)).toEqual([1, 2]);

    const levels = $('.fs-row-groups__levels').first().find('.fs-row-groups__level');

    expect(levels.map((i, level) => level.textContent).get()).toEqual(['1', '2', '3']);

    levels.eq(1).simulate('mousedown');
    // Level 2: the inner group collapses.
    expect(hot.countRows()).toBe(8);
    $('.fs-row-groups__levels').first().find('.fs-row-groups__level').eq(0).simulate('mousedown');
    expect(hot.countRows()).toBe(4);
    $('.fs-row-groups__levels').first().find('.fs-row-groups__level').eq(2).simulate('mousedown');
    expect(hot.countRows()).toBe(10);
  });

  it('groups and ungroups from the context menu and with Alt+Shift+arrows', () => {
    const hot = grid({ contextMenu: true });
    const plugin = hot.getPlugin('rowGroups');

    selectCell(2, 0, 4, 0);
    contextMenu();
    hot.getPlugin('contextMenu').executeCommand('row_groups_group');
    expect(plugin.getGroups()).toEqual([{ from: 2, to: 4, level: 1, collapsed: false }]);

    hot.getPlugin('contextMenu').executeCommand('row_groups_ungroup');
    expect(plugin.getGroups()).toEqual([]);

    selectCell(5, 0, 6, 0);
    keyDownUp(39, { altKey: true, shiftKey: true });
    expect(plugin.getGroups()).toEqual([{ from: 5, to: 6, level: 1, collapsed: false }]);
    keyDownUp(37, { altKey: true, shiftKey: true });
    expect(plugin.getGroups()).toEqual([]);
  });

  it('follows rows added and removed', () => {
    const hot = grid();
    const plugin = hot.getPlugin('rowGroups');

    plugin.groupRows(3, 5);
    hot.alter('insert_row', 0, 2);
    expect(plugin.getGroups()[0]).toEqual(jasmine.objectContaining({ from: 5, to: 7 }));
    hot.alter('insert_row', 6, 1);
    expect(plugin.getGroups()[0]).toEqual(jasmine.objectContaining({ from: 5, to: 8 }));
    hot.alter('remove_row', 0, 1);
    hot.alter('remove_row', 5, 1);
    expect(plugin.getGroups()[0]).toEqual(jasmine.objectContaining({ from: 4, to: 6 }));
  });

  it('is kept by getDocument and loadDocument', () => {
    const hot = grid();

    hot.getPlugin('rowGroups').groupRows(1, 2);
    hot.getPlugin('rowGroups').collapseGroup(1);
    const doc = hot.getDocument();

    expect(doc.sheets[0].rowGroups).toEqual([{ from: 1, to: 2, collapsed: true }]);

    hot.getPlugin('rowGroups').ungroupRows(0, 9);
    hot.loadDocument(doc);
    expect(hot.getActiveSheet().getPlugin('rowGroups').getGroups())
      .toEqual([{ from: 1, to: 2, level: 1, collapsed: true }]);
    expect(hot.getActiveSheet().countRows()).toBe(8);
  });

  it('is kept by Excel files', async() => {
    const hot = grid();

    hot.getPlugin('rowGroups').groupRows(2, 5);
    hot.getPlugin('rowGroups').groupRows(3, 4);
    hot.getPlugin('rowGroups').collapseGroup(3);
    const blob = await hot.exportFile('xlsx');

    destroy();
    $('.fs-sheet-tabs').remove();
    const next = handsontable({ data: [[null]], rowHeaders: true });

    await next.importFile(blob);
    const sheet = next.getActiveSheet();

    expect(sheet.getPlugin('rowGroups').getGroups()).toEqual([
      { from: 2, to: 5, level: 1, collapsed: false },
      { from: 3, to: 4, level: 2, collapsed: true },
    ]);
    expect(sheet.countRows()).toBe(8);
  });
});

describe('Core column outline', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu, .fs-sheet-tabs').remove();
  });

  const grid = (settings = {}) => handsontable({
    data: createSpreadsheetData(3, 8), rowHeaders: true, colHeaders: true, columnOutline: true, ...settings });
  /** The visible header of a column (in the top overlay, after the corner). */
  const header = column => spec().$container.find('.fs-clone-top thead tr:first-child th').eq(column + 1);
  const toggle = column => header(column).find('.fs-row-groups__toggle');

  it('keeps the column menu button next to the header\'s label, under the gutter', () => {
    const hot = grid({ dropdownMenu: true });

    hot.getPlugin('columnOutline').groupColumns(1, 3);
    const label = header(2).find('.colHeader').get(0).getBoundingClientRect();
    const gutter = header(2).find('.fs-column-outline__gutter').get(0).getBoundingClientRect();
    const button = header(2).find('.fs-dropdown-button').get(0).getBoundingClientRect();

    expect(button.top).toBeGreaterThanOrEqual(gutter.bottom);
    expect(Math.abs((button.top + button.bottom) / 2 - (label.top + label.bottom) / 2)).toBeLessThan(6);
  });

  it('groups columns, draws the gutter above the headers and collapses a group with its button', () => {
    const hot = grid();
    const plugin = hot.getPlugin('columnOutline');

    plugin.groupColumns(1, 3);
    expect(plugin.getGroups()).toEqual([{ from: 1, to: 3, level: 1, collapsed: false }]);
    expect(header(2).find('.fs-column-outline__line').length).toBe(1);
    expect(toggle(4).text()).toBe('−');

    // A click where the button shows reaches it.
    const box = toggle(4).get(0).getBoundingClientRect();
    const hit = document.elementFromPoint(box.left + (box.width / 2), box.top + (box.height / 2));

    expect(hit.closest('.fs-row-groups__toggle')).not.toBeNull();

    toggle(4).simulate('mousedown');
    expect(hot.countCols()).toBe(5);
    expect(getDataAtCell(0, 1)).toBe('E1');
    toggle(1).simulate('mousedown');
    expect(hot.countCols()).toBe(8);
  });

  it('nests groups in levels with the corner buttons, and groups from the context menu', () => {
    const hot = grid({ contextMenu: true });
    const plugin = hot.getPlugin('columnOutline');

    selectCell(0, 1, 0, 5);
    contextMenu();
    hot.getPlugin('contextMenu').executeCommand('column_outline_group');
    plugin.groupColumns(2, 3);
    expect(plugin.getGroups().map(group => group.level)).toEqual([1, 2]);

    const levels = $('.fs-column-outline__levels').first().find('.fs-row-groups__level');

    expect(levels.map((i, level) => level.textContent).get()).toEqual(['1', '2', '3']);
    levels.eq(0).simulate('mousedown');
    expect(hot.countCols()).toBe(3);

    selectCell(0, 0);
    hot.getPlugin('contextMenu').executeCommand('column_outline_ungroup');
    expect(plugin.getGroups().length).toBe(2);
  });

  it('is kept by getDocument, loadDocument and Excel files, next to row groups', async() => {
    const hot = grid({ rowGroups: true });

    hot.getPlugin('columnOutline').groupColumns(2, 4);
    hot.getPlugin('columnOutline').collapseGroup(2);
    hot.getPlugin('rowGroups').groupRows(1, 1);
    const doc = hot.getDocument();

    expect(doc.sheets[0].columnOutline).toEqual([{ from: 2, to: 4, collapsed: true }]);

    const blob = await hot.exportFile('xlsx');

    destroy();
    const next = handsontable({ data: [[null]], colHeaders: true });

    await next.importFile(blob);
    const sheet = next.getActiveSheet();

    expect(sheet.getPlugin('columnOutline').getGroups()).toEqual([{ from: 2, to: 4, level: 1, collapsed: true }]);
    expect(sheet.getPlugin('rowGroups').getGroups()).toEqual([{ from: 1, to: 1, level: 1, collapsed: false }]);
    expect(sheet.countCols()).toBe(5);
  });
});
