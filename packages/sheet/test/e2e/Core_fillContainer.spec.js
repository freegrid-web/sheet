describe('Core fillContainer', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 600px; height: 300px; overflow: hidden"></div>`)
      .appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  const holder = () => spec().$container.find('.fs-master .wtHolder').get(0) ||
    spec().$container.find('.wtHolder').get(0);
  const hider = () => holder().querySelector('.wtHider');

  it('fills the element with empty rows and columns', () => {
    const hot = handsontable({ data: [['A1', 'B1'], ['A2', 'B2']], rowHeaders: true, colHeaders: true,
      fillContainer: true });

    expect(hot.countRows()).toBeGreaterThan(2);
    expect(hot.countCols()).toBeGreaterThan(2);
    expect(hider().offsetHeight).toBeGreaterThanOrEqual(holder().clientHeight);
    expect(hider().offsetWidth).toBeGreaterThanOrEqual(holder().clientWidth);
    expect(hot.getDataAtCell(0, 0)).toBe('A1');
    expect(hot.getDataAtCell(2, 0)).toBeNull();
  });

  it('adds more when the element grows', async() => {
    const hot = handsontable({ data: [['A1']], colHeaders: true, fillContainer: true });
    const rows = hot.countRows();
    const cols = hot.countCols();

    spec().$container.css({ width: '900px', height: '500px' });
    window.dispatchEvent(new Event('resize'));
    await sleep(100);
    hot.render();

    expect(hot.countRows()).toBeGreaterThan(rows);
    expect(hot.countCols()).toBeGreaterThan(cols);
  });

  it('is off by default', () => {
    const hot = handsontable({ data: [['A1', 'B1'], ['A2', 'B2']], colHeaders: true });

    expect(hot.countRows()).toBe(2);
    expect(hot.countCols()).toBe(2);
  });

  it('adds no columns when `columns` sets them', () => {
    const hot = handsontable({ data: [['A1', 'B1']], columns: [{}, {}], fillContainer: true });

    expect(hot.countCols()).toBe(2);
    expect(hot.countRows()).toBeGreaterThan(1);
  });

  it('adds rows and columns when it is scrolled to the end', async() => {
    const hot = handsontable({ data: [['A1']], colHeaders: true, rowHeaders: true, fillContainer: true });
    const rows = hot.countRows();
    const cols = hot.countCols();

    holder().scrollTop = holder().scrollHeight;
    holder().scrollLeft = holder().scrollWidth;
    await sleep(200);

    expect(hot.countRows()).toBeGreaterThan(rows);
    expect(hot.countCols()).toBeGreaterThan(cols);
  });

  it('does not save the empty rows and columns at the end', async() => {
    const hot = handsontable({
      data: [['A1', 'B1'], ['A2', '']],
      fillContainer: true,
      cell: [{ row: 4, col: 0, style: { fontWeight: 'bold' } }],
    });

    expect(hot.countRows()).toBeGreaterThan(5);

    const [sheet] = hot.getDocument().sheets;

    // Up to the last value or cell with settings of its own: the bold empty cell in row 5.
    expect(sheet.data).toEqual([['A1', 'B1'], ['A2', ''], [null, null], [null, null], [null, null]]);

    hot.setCellMeta(4, 0, 'style', void 0);
    const csv = await (await hot.exportFile('csv')).text();

    expect(csv.replace(/^\ufeff/, '').trim().split(/\r?\n/)).toEqual(['A1,B1', 'A2,']);
  });
});
