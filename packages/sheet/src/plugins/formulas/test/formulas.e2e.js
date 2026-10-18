describe('Formulas', () => {
  const id = 'testContainer';
  let Model;

  beforeAll(async() => {
    // The engine is a test dependency (FreeSheet itself has none): load IronCalc's web build as the page would.
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

  const grid = (data, settings = {}) => handsontable({ data, formulas: { engine: Model }, ...settings });

  it('shows the result of a formula, and its formula in the source data', () => {
    grid([[1, 2, '=A1+B1'], [3, 4, '=SUM(A1:B2)']]);

    expect(getDataAtCell(0, 2)).toBe(3);
    expect(getDataAtCell(1, 2)).toBe(10);
    expect(getCell(0, 2).textContent).toBe('3');
    expect(getSourceDataAtCell(0, 2)).toBe('=A1+B1');
    expect(getPlugin('formulas').getFormula(1, 2)).toBe('=SUM(A1:B2)');
    expect(getPlugin('formulas').getFormula(0, 0)).toBeNull();
  });

  it('recalculates when a referenced cell changes', () => {
    grid([[1, '=A1*10']]);

    setDataAtCell(0, 0, 5);

    expect(getDataAtCell(0, 1)).toBe(50);
    expect(getCell(0, 1).textContent).toBe('50');
  });

  it('opens the editor with the formula, not the result', () => {
    grid([[2, '=A1*3']]);
    selectCell(0, 1);
    keyDownUp('enter');

    expect(getActiveEditor().TEXTAREA.value).toBe('=A1*3');
  });

  it('keeps cells without a formula as they are', () => {
    grid([['text', 12.5, true, null]]);

    expect(getDataAtRow(0)).toEqual(['text', 12.5, true, null]);
  });

  it('shows errors with the error class', () => {
    grid([[1, '=A1/0', '=NOSUCHFUNCTION()']]);

    expect(getDataAtCell(0, 1)).toBe('#DIV/0!');
    expect(getCell(0, 1).classList.contains('fs-formula-error')).toBe(true);
    expect(getDataAtCell(0, 2)).toBe('#NAME?');
    expect(getCell(0, 0).classList.contains('fs-formula-error')).toBe(false);
  });

  it('moves references when rows are inserted above, and updates the formulas in the data', () => {
    grid([[1], [2], ['=A1+A2']]);

    alter('insert_row', 0, 1);
    setDataAtCell(0, 0, 100);

    expect(getSourceDataAtCell(3, 0)).toBe('=A2+A3');
    expect(getDataAtCell(3, 0)).toBe(3);
  });

  it('moves references when columns are removed', () => {
    grid([[1, 2, 3, '=C1*2']]);

    alter('remove_col', 0, 1);

    expect(getSourceDataAtCell(0, 2)).toBe('=B1*2');
    expect(getDataAtCell(0, 2)).toBe(6);
  });

  it('turns a reference to a removed row into #REF!', () => {
    grid([[1], ['=A1+1']]);

    alter('remove_row', 0, 1);

    expect(getDataAtCell(0, 0)).toBe('#REF!');
  });

  it('recalculates after loadData', () => {
    grid([[1, '=A1']]);

    loadData([[7, '=A1*2']]);

    expect(getDataAtCell(0, 1)).toBe(14);
  });

  it('undoes and redoes a change to a referenced cell', () => {
    const hot = grid([[1, '=A1+1']]);

    setDataAtCell(0, 0, 10);
    expect(getDataAtCell(0, 1)).toBe(11);

    hot.undo();
    expect(getDataAtCell(0, 1)).toBe(2);
    expect(getCell(0, 1).textContent).toBe('2');

    hot.redo();
    expect(getDataAtCell(0, 1)).toBe(11);
  });

  it('sorts by results, and the references keep following the data rows', () => {
    grid([[3, '=A1*10'], [1, '=A2*10'], [2, '=A3*10']], { columnSorting: true });

    getPlugin('columnSorting').sort({ column: 1, sortOrder: 'asc' });

    expect(getDataAtCol(1)).toEqual([10, 20, 30]);
    expect(getDataAtCol(0)).toEqual([1, 2, 3]);
  });

  it('works with object data and `columns`', () => {
    grid([{ a: 2, b: '=A1*A1' }], { columns: [{ data: 'a' }, { data: 'b' }] });

    expect(getDataAtCell(0, 1)).toBe(4);
  });

  it('is off without an engine, and turns on with updateSettings', () => {
    handsontable({ data: [[1, '=A1+1']] });

    expect(getDataAtCell(0, 1)).toBe('=A1+1');

    updateSettings({ formulas: { engine: Model } });

    expect(getDataAtCell(0, 1)).toBe(2);
  });

  describe('with sheets', () => {
    afterEach(() => $('.fs-sheet-tabs').remove());

    it('refers to other sheets by name', () => {
      const hot = grid([['=Costs!B1*2']]);
      const costs = hot.addSheet('costs', { name: 'Costs', data: [['Rent', 600]] });

      expect(hot.getDataAtCell(0, 0)).toBe(1200);

      costs.setDataAtCell(0, 1, 700);
      expect(hot.getDataAtCell(0, 0)).toBe(1400);
    });

    it('sums another sheet in a sheet created by the `sheets` setting', () => {
      const hot = grid([[10], [20]], {
        sheetName: 'Sales',
        sheets: [{ id: 'summary', name: 'Summary', data: [['=SUM(Sales!A1:A2)']] }],
      });

      expect(hot.getSheet('summary').getDataAtCell(0, 0)).toBe(30);
    });

    it('creates a sheet with spare rows in a document with formulas', () => {
      const hot = grid([[10], [20]], {
        sheetName: 'Sales',
        sheets: [{ id: 'summary', name: 'Summary', data: [['=SUM(Sales!A1:A2)']], minSpareRows: 2 }],
      });
      const summary = hot.getSheet('summary');

      expect(summary.getDataAtCell(0, 0)).toBe(30);
      expect(summary.countRows()).toBe(3);
    });

    it('follows a renamed sheet in the formulas of the other sheets', () => {
      const hot = grid([['=Costs!A1+1']]);

      hot.addSheet('costs', { name: 'Costs', data: [[5]] });
      hot.renameSheet('costs', 'Expenses');

      expect(hot.getSourceDataAtCell(0, 0)).toBe('=Expenses!A1+1');
      expect(hot.getDataAtCell(0, 0)).toBe(6);
    });

    it('shows #REF! for references to a removed sheet', () => {
      const hot = grid([['=Costs!A1']]);

      hot.addSheet('costs', { name: 'Costs', data: [[5]] });
      hot.removeSheet('costs');

      expect(hot.getDataAtCell(0, 0)).toBe('#REF!');
    });

    it('moves references in other sheets when rows are inserted', () => {
      const hot = grid([['=Costs!A2']]);
      const costs = hot.addSheet('costs', { name: 'Costs', data: [[1], [2]] });

      costs.alter('insert_row', 0, 1);

      expect(hot.getSourceDataAtCell(0, 0)).toBe('=Costs!A3');
      expect(hot.getDataAtCell(0, 0)).toBe(2);
    });

    it('keeps each sheet\'s cells when one sheet loads new data', () => {
      const hot = grid([[1, '=Costs!A1']]);
      const costs = hot.addSheet('costs', { name: 'Costs', data: [[5]] });

      costs.loadData([[9]]);
      expect(hot.getDataAtCell(0, 1)).toBe(9);

      hot.loadData([[2, '=Costs!A1*A1']]);
      expect(hot.getDataAtCell(0, 1)).toBe(18);
    });
  });
});

