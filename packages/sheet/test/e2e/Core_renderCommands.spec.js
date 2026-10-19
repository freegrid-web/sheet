describe('Core renderer command compatibility', () => {
  beforeEach(function() {
    this.$container = $('<div id="testContainer"></div>').appendTo('body');
  });

  afterEach(function() {
    destroy();
    this.$container.remove();
  });

  it('preserves snap edges, independent axes, fixed cells and scroll return values', () => {
    const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(100, 30),
      width: 400, height: 220, rowHeaders: true, colHeaders: true,
      fixedRowsTop: 2, fixedColumnsLeft: 2, autoRowSize: false, autoColumnSize: false,
      rowHeights: 23, colWidths: 80 });

    expect(hot.scrollViewportTo(40, 15)).toBe(true);
    hot.render();
    const topLeft = hot.getCell(40, 15).getBoundingClientRect();

    expect(hot.scrollViewportTo(40, 15, true, true)).toBe(true);
    hot.render();
    const bottomRight = hot.getCell(40, 15).getBoundingClientRect();

    expect(bottomRight.top).toBeGreaterThan(topLeft.top + 40);
    expect(bottomRight.left).toBeGreaterThan(topLeft.left + 40);
    const holder = hot.view.wt.wtTable.holder;
    const left = holder.scrollLeft;

    expect(hot.scrollViewportTo(60)).toBe(true);
    hot.render();
    expect(holder.scrollLeft).toBe(left);
    const top = holder.scrollTop;

    expect(hot.scrollViewportTo(void 0, 25)).toBe(true);
    hot.render();
    expect(holder.scrollTop).toBe(top);
    expect(hot.getCell(0, 0, true).textContent).toBe('A1');
    expect(hot.scrollViewportTo(0, 0)).toBe(false);
    expect(hot.scrollViewportTo(-1, -1)).toBe(false);
    expect(hot.scrollViewportTo()).toBe(false);
    hot.view.wt.drawn = false;
    expect(hot.scrollViewportTo(80, 28)).toBe(false);
  });

  it('keeps render hooks synchronous and clears flags after the draw', () => {
    const events = [];
    const hot = handsontable({ data: [[1, 2]], autoRowSize: false, autoColumnSize: false,
      beforeRender(force) { events.push(['before', force, this.forceFullRender, this.renderCall]); },
      afterRender(force) { events.push(['after', force, this.forceFullRender, this.renderCall]); } });

    events.length = 0;
    hot.render();
    expect(events).toEqual([['before', true, true, true], ['after', true, true, true]]);
    expect(hot.forceFullRender).toBe(false);
    expect(hot.renderCall).toBe(false);
    events.length = 0;
    hot.view.render();
    expect(events).toEqual([]);
    expect(hot.getCell(0, 1).textContent).toBe('2');
  });

  it('keeps interrupted draws and later visible rendering working', function() {
    const afterRender = jasmine.createSpy('afterRender');
    const hot = handsontable({ data: [[1]], autoRowSize: false, autoColumnSize: false, afterRender });

    afterRender.calls.reset();
    this.$container.hide();
    hot.render();
    expect(afterRender).not.toHaveBeenCalled();
    expect(hot.view.wt.drawInterrupted).toBe(true);
    expect(hot.forceFullRender).toBe(false);
    expect(hot.renderCall).toBe(false);
    this.$container.show();
    hot.render();
    expect(afterRender.calls.count()).toBe(1);
    expect(hot.getCell(0, 0).textContent).toBe('1');
  });

  it('disposes listeners and DOM before afterDestroy and leaves other grids usable', function() {
    const events = [];
    const hot = handsontable({ data: [[1]], afterDestroy() {
      events.push([this.rootElement.childElementCount, this.eventListeners.length]);
    } });
    const view = hot.view;
    const otherHost = document.createElement('div');

    document.body.append(otherHost);
    const other = new Handsontable(otherHost, { data: [[2]] });

    try {
      destroy();
      expect(events).toEqual([[0, 0]]);
      expect(view.eventManager.context).toBeNull();
      expect(hot.isDestroyed).toBe(true);
      other.setDataAtCell(0, 0, 3);
      expect(other.getCell(0, 0).textContent).toBe('3');
      expect(() => hot.render()).toThrowError(
        'The "render" method cannot be called because this FreeSheet instance has been destroyed');
    } finally {
      other.destroy();
      otherHost.remove();
    }
  });
});
