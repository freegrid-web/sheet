describe('Core renderer query compatibility', () => {
  beforeEach(function() {
    this.$container = $('<div id="testContainer"></div>').appendTo('body');
  });

  afterEach(function() {
    destroy();
    this.$container.remove();
  });

  it('returns real overlay cells and coordinates of their children after scrolling', () => {
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(100, 20),
      width: 400, height: 200, rowHeaders: true, colHeaders: true,
      fixedRowsTop: 2, fixedRowsBottom: 1, fixedColumnsLeft: 2,
      autoRowSize: false, autoColumnSize: false, rowHeights: 23, colWidths: 80 });

    hot.scrollViewportTo(90, 15);
    hot.render();
    [[0, 0], [1, 1], [90, 15]].forEach(([row, col]) => {
      const cell = hot.getCell(row, col, true);

      expect(cell instanceof HTMLTableCellElement).toBe(true);
      expect(cell.isConnected).toBe(true);
      expect(cell.textContent).toBe(`${Handsontable.helper.spreadsheetColumnLabel(col)}${row + 1}`);
      const child = document.createElement('span');

      cell.append(child);
      const coords = hot.getCoords(child);

      expect([coords.row, coords.col]).toEqual([row, col]);
    });
    expect(hot.getCell(99, 0, true).textContent).toBe('A100');
    expect(hot.getCell(50, 10)).toBeNull();
    expect(hot.getCoords(document.createElement('div'))).toBeNull();
  });

  it('preserves detached method calls, render buffers and the unrendered sentinel', () => {
    // Keep full-cell counts equal with either overlay or classic native scrollbars.
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(50, 10),
      width: 290, height: 110, viewportRowRenderingOffset: 20,
      rowHeights: 23, colWidths: 50, autoRowSize: false, autoColumnSize: false });
    const { countVisibleRows, countRenderedRows, countRenderedCols, countVisibleCols, rowOffset, colOffset } = hot;

    expect(countVisibleRows()).toBe(4);
    expect(countRenderedRows()).toBe(25);
    expect(countRenderedCols()).toBe(10);
    expect(countVisibleCols()).toBe(5);
    expect(rowOffset()).toBe(0);
    expect(colOffset()).toBe(0);
    hot.view.wt.drawn = false;
    expect(countVisibleRows()).toBe(-1);
    expect(countRenderedRows()).toBe(-1);
    expect(countVisibleCols()).toBe(-1);
    expect(countRenderedCols()).toBe(-1);
  });

  it('keeps sorting, render hooks and custom TD output working through public queries', () => {
    const render = jasmine.createSpy('renderer').and.callFake((hot, td, row, col, prop, value, properties) => {
      Handsontable.renderers.getRenderer('text')(hot, td, row, col, prop, value, properties);
      td.dataset.record = value;
    });
    const hooks = [];
    const hot = handsontable({ data: [[3], [1], [2]], columnSorting: true, observeChanges: false,
      renderer: render, beforeRender: () => hooks.push('before'), afterRender: () => hooks.push('after') });

    hooks.length = 0;
    hot.getPlugin('columnSorting').sort({ column: 0, sortOrder: 'asc' });
    expect(hot.getDataAtCell(0, 0)).toBe(1);
    const cell = hot.getCell(0, 0);

    expect(cell.dataset.record).toBe('1');
    expect(hot.getCoords(cell).row).toBe(0);
    expect(hooks).toEqual(['before', 'after']);
    expect(render.calls.mostRecent().args[1] instanceof HTMLTableCellElement).toBe(true);
    hot.loadData([[8], [9]]);
    expect(hot.getCell(0, 0).dataset.record).toBe('8');
  });
});
