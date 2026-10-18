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
});
