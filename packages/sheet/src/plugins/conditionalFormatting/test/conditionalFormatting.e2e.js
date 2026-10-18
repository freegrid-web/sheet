describe('ConditionalFormatting', () => {
  const id = 'testContainer';
  let Model;

  beforeAll(async() => {
    const engine = await import(/* @vite-ignore */ '/node_modules/@ironcalc/wasm/wasm.js');

    await engine.default({ module_or_path: '/node_modules/@ironcalc/wasm/wasm_bg.wasm' });
    Model = engine.Model;
  });

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  const data = () => [
    ['North', 120, 'Ada', '2026-01-10'],
    ['South', 90, 'Linus', '2026-02-10'],
    ['East', 1300, 'Ada', '2026-03-10'],
    ['West', -80, 'Grace', '2026-04-10'],
  ];
  const red = { background: 'rgb(248, 215, 218)', color: 'rgb(132, 32, 41)' };
  const style = { background: '#f8d7da', color: '#842029' };
  const background = (row, column) => getCell(row, column).style.background;
  const rgb = (row, column) => getComputedStyle(getCell(row, column)).backgroundColor;
  const highlighted = column => [0, 1, 2, 3].map(row => getCell(row, column).style.color === red.color);

  it('formats the cells of a range that meet a condition', () => {
    handsontable({ data: data(), conditionalFormatting: [{ range: 'B1:B4', when: 'gt', value: 100, style }] });

    expect(highlighted(1)).toEqual([true, false, true, false]);
    expect(getCell(0, 1).style.background).toContain(red.background);
    expect(getCell(0, 0).style.color).toBe('');
  });

  it('formats a cell by a formula\'s result', () => {
    handsontable({
      data: [[1, 2, '=A1+B1'], [500, 600, '=A2+B2']],
      formulas: { engine: Model },
      conditionalFormatting: [{ range: 'C1:C2', when: 'gt', value: 1000, style }],
    });

    expect(getCell(0, 2).style.color).toBe('');
    expect(getCell(1, 2).style.color).toBe(red.color);
  });

  it('uses a formula as the condition, moved for each cell', () => {
    handsontable({
      data: data(),
      formulas: { engine: Model },
      conditionalFormatting: [{ range: 'A1:C4', when: '=$B1<0', style }],
    });

    expect(highlighted(0)).toEqual([false, false, false, true]);
    expect(highlighted(2)).toEqual([false, false, false, true]);
  });

  it('finds duplicate and unique values, the top and bottom ones, and values above the average', () => {
    const hot = handsontable({ data: data(), conditionalFormatting: true });
    const plugin = hot.getPlugin('conditionalFormatting');
    const check = (rule, column) => {
      plugin.clearRules();
      plugin.addRule({ ...rule, style });

      return highlighted(column);
    };

    expect(check({ range: 'C1:C4', when: 'duplicate' }, 2)).toEqual([true, false, true, false]);
    expect(check({ range: 'C1:C4', when: 'unique' }, 2)).toEqual([false, true, false, true]);
    expect(check({ range: 'B1:B4', when: 'top', value: 2 }, 1)).toEqual([true, false, true, false]);
    expect(check({ range: 'B1:B4', when: 'bottom', value: 25, percent: true }, 1)).toEqual([false, false, false, true]);
    expect(check({ range: 'B1:B4', when: 'aboveAverage' }, 1)).toEqual([false, false, true, false]);
  });

  it('keeps the first rule\'s style where rules overlap, and stops after a stopIfTrue rule', () => {
    const hot = handsontable({ data: data(), conditionalFormatting: [
      { range: 'B1:B4', when: 'gt', value: 100, style: { color: '#ff0000' } },
      { range: 'B1:B4', when: 'gt', value: 0, style: { color: '#0000ff', fontWeight: 'bold' } },
    ] });

    expect(getCell(0, 1).style.color).toBe('rgb(255, 0, 0)');
    expect(getCell(0, 1).style.fontWeight).toBe('bold');
    expect(getCell(1, 1).style.color).toBe('rgb(0, 0, 255)');

    hot.getPlugin('conditionalFormatting').updateRule(hot.getPlugin('conditionalFormatting').getRules()[0].id,
      { range: 'B1:B4', when: 'gt', value: 100, style: { color: '#ff0000' }, stopIfTrue: true });

    expect(getCell(0, 1).style.fontWeight).toBe('');
  });

  it('draws color scales, data bars and icons', () => {
    handsontable({ data: [[0], [50], [100]], conditionalFormatting: [
      { range: 'A1:A3', colorScale: ['#ff0000', '#00ff00'] },
    ] });

    expect(rgb(0, 0)).toBe('rgb(255, 0, 0)');
    expect(rgb(1, 0)).toBe('rgb(128, 128, 0)');
    expect(rgb(2, 0)).toBe('rgb(0, 255, 0)');

    updateSettings({ conditionalFormatting: [{ range: 'A1:A3', dataBar: '#638ec6' }] });

    expect(getCell(1, 0).style.backgroundImage).toContain('50%');
    expect(background(1, 0)).not.toContain('rgb(128, 128, 0)');

    updateSettings({ conditionalFormatting: [{ range: 'A:A', iconSet: 'arrows' }] });

    expect(getCell(0, 0).querySelector('.fs-cf-icon--arrows-low')).not.toBeNull();
    expect(getCell(2, 0).querySelector('.fs-cf-icon--arrows-high')).not.toBeNull();
    expect(getCell(2, 0).textContent).toBe('100');
  });

  it('keeps an icon and its number on one line in a narrow column', () => {
    handsontable({
      data: [[0.12], [-0.04], [0.31]],
      colWidths: 40,
      conditionalFormatting: [{ range: 'A1:A3', iconSet: 'arrows' }],
    });
    const icon = getCell(0, 0).querySelector('.fs-cf-icon');
    const text = document.createRange();

    text.selectNodeContents(getCell(0, 0).lastChild);

    expect(icon).not.toBeNull();
    expect(Math.abs(text.getBoundingClientRect().top - icon.getBoundingClientRect().top)).toBeLessThan(8);
    expect(getCell(0, 0).offsetHeight).toBeLessThan(30); // one line: the default row is 23px
  });

  it('formats a column with its format', () => {
    handsontable({ data: data(), columns: [{}, { format: [{ when: 'lt', value: 0, style }] }, {}, {}] });

    expect(highlighted(1)).toEqual([false, false, false, true]);
  });

  it('moves the ranges with inserted and removed rows and columns', () => {
    const hot = handsontable({ data: data(), conditionalFormatting: [{ range: 'B2:B3', when: 'gt', value: 0, style }] });
    const plugin = hot.getPlugin('conditionalFormatting');

    alter('insert_row', 0);
    expect(plugin.getRules()[0].range).toBe('B3:B4');

    alter('insert_col', 0);
    expect(plugin.getRules()[0].range).toBe('C3:C4');

    alter('remove_row', 2, 2);
    expect(plugin.getRules()).toEqual([]);
  });

  it('formats the same data after sorting (ranges name data rows)', () => {
    const hot = handsontable({ data: data(), columnSorting: true,
      conditionalFormatting: [{ range: 'A3', when: 'not_empty', style }] });

    hot.getPlugin('columnSorting').sort({ column: 1, sortOrder: 'desc' });

    expect(getDataAtCell(0, 0)).toBe('East');
    expect(getCell(0, 0).style.color).toBe(red.color);
  });

  it('adds, moves, removes and clears rules with the API, running afterConditionalFormattingChange', () => {
    const afterChange = jasmine.createSpy('afterConditionalFormattingChange');
    const hot = handsontable({ data: data(), conditionalFormatting: true, afterConditionalFormattingChange: afterChange });
    const plugin = hot.getPlugin('conditionalFormatting');

    const first = plugin.addRule({ range: 'A1:B4', when: 'not_empty', style });
    const second = plugin.addRule({ range: 'C1', when: 'not_empty', style }, 0);

    expect(plugin.getRules().map(rule => rule.id)).toEqual([second, first]);
    expect(plugin.getRulesAt(0, 2).map(rule => rule.id)).toEqual([second]);
    expect(afterChange).toHaveBeenCalled();

    plugin.moveRule(first, 0);
    expect(plugin.getRules().map(rule => rule.id)).toEqual([first, second]);

    plugin.clearRules('B1:B4');
    expect(plugin.getRules()[0].range).toBe('A1:A4');

    plugin.removeRule(second);
    plugin.clearRules();
    expect(plugin.getRules()).toEqual([]);
  });

  it('keeps the rules added with the API when other settings change', () => {
    const hot = handsontable({ data: data(), conditionalFormatting: true });

    hot.getPlugin('conditionalFormatting').addRule({ range: 'B1:B4', when: 'gt', value: 100, style });
    updateSettings({ colWidths: 80 });

    expect(hot.getPlugin('conditionalFormatting').getRules().length).toBe(1);
  });

  it('saves and loads the rules with the document', () => {
    const hot = handsontable({ data: data(), conditionalFormatting: [{ range: 'B1:B4', when: 'gt', value: 100, style }] });
    const saved = hot.getDocument();

    expect(saved.sheets[0].conditionalFormatting).toEqual([{ range: 'B1:B4', when: 'gt', value: 100, style }]);

    hot.getPlugin('conditionalFormatting').clearRules();
    hot.loadDocument(saved);

    expect(highlighted(1)).toEqual([true, false, true, false]);
  });

  it('formats dates in a period', () => {
    const today = new Date();
    const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate())
      .padStart(2, '0')}`;
    const lastYear = new Date(today.getFullYear() - 1, 0, 15);

    handsontable({ data: [[iso(today)], [iso(lastYear)]], columns: [{ type: 'date', dateFormat: 'YYYY-MM-DD' }],
      conditionalFormatting: [{ range: 'A1:A2', when: 'date_this_month', style }] });

    expect(getCell(0, 0).style.color).toBe(red.color);
    expect(getCell(1, 0).style.color).toBe('');
  });
});
