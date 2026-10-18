describe('Core formatting', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    $('.fs-context-menu').remove();
  });

  it('merges a style into the selected cells, removes null properties, and clears with null', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], cell: [{ row: 0, col: 0, style: { color: '#ff0000' } }] });

    selectCell(0, 0, 0, 1);
    hot.setCellStyle({ fontWeight: 'bold' });

    expect(hot.getCellMeta(0, 0).style).toEqual({ color: '#ff0000', fontWeight: 'bold' });
    expect(hot.getCellMeta(0, 1).style).toEqual({ fontWeight: 'bold' });
    expect(getCell(0, 1).style.fontWeight).toBe('bold');
    expect(hot.getCellMeta(1, 0).style).toBeUndefined();

    hot.setCellStyle({ color: null });
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold' });

    hot.setCellStyle(null);
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(getCell(0, 0).style.fontWeight).toBe('');
  });

  it('styles given ranges, and runs afterSetCellStyle with the changes', () => {
    const changed = jasmine.createSpy('afterSetCellStyle');
    const hot = handsontable({ data: [[1, 2], [3, 4]], afterSetCellStyle: changed });

    selectCell(1, 1);
    const ranges = hot.getSelectedRange();

    selectCell(0, 0);
    hot.setCellStyle({ background: '#ffff00' }, ranges);

    expect(hot.getCellMeta(1, 1).style).toEqual({ background: '#ffff00' });
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(changed.calls.argsFor(0)[0]).toEqual([[1, 1, undefined, { background: '#ffff00' }]]);
  });

  it('toggles bold, italic, underline and strikethrough with Ctrl+B, Ctrl+I and Ctrl+U, and undoes them', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }] });

    selectCell(0, 0, 0, 1);
    keyDownUp(66, { ctrlKey: true });
    // Not every cell was bold, so all of them become bold; again, and none is.
    expect(hot.getCellMeta(0, 1).style).toEqual({ fontWeight: 'bold' });
    keyDownUp(66, { ctrlKey: true });
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();

    keyDownUp(73, { ctrlKey: true });
    keyDownUp(85, { ctrlKey: true });
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });

    hot.undo();
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontStyle: 'italic' });
    hot.redo();
    expect(hot.getCellMeta(0, 0).style).toEqual({ fontStyle: 'italic', textDecoration: 'underline' });
  });

  it('formats from the context menu: toggles, colors and clear formatting', () => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: ['alignment', 'formatting'] });
    const menu = hot.getPlugin('contextMenu');

    selectCell(0, 0, 1, 0);
    contextMenu();
    expect($('.fs-context-menu td').filter((i, td) => $(td).text() === 'Format').length).toBe(1);

    menu.executeCommand('formatting:strikethrough');
    expect(hot.getCellMeta(1, 0).style).toEqual({ textDecoration: 'line-through' });

    hot.setCellStyle({ background: '#ffff00' });
    menu.executeCommand('formatting:clear');
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(hot.getCellMeta(1, 0).style).toBeUndefined();
  });

  const itemOf = (menu, text) => $(menu).find('.fs-core tbody td').filter((i, td) => $(td).text().endsWith(text));

  /** Opens Format ▸ Fill color in the context menu; returns the palette. */
  const openFillPalette = async() => {
    contextMenu();
    itemOf('.fs-context-menu', 'Format').simulate('mouseover');
    await sleep(350);
    itemOf('.fs-context-menu-sub_Format', 'Fill color').simulate('mouseover');
    await sleep(350);

    return $('.fs-context-menu-sub_Fill_color .fs-palette');
  };

  it('shows a color while the pointer is on it, sets it on a click, and closes every menu', async() => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: ['alignment', 'formatting'] });

    selectCell(0, 0, 0, 1);
    const palette = await openFillPalette();

    expect(palette.find('[data-color]').length).toBe(70);
    palette.find('[data-color="#ffff00"]').simulate('mouseover');
    expect(hot.getCellMeta(0, 1).style).toEqual({ background: '#ffff00' });
    expect(getCell(0, 1).style.background).toContain('rgb(255, 255, 0)');
    palette.simulate('mouseleave');
    expect(hot.getCellMeta(0, 1).style).toBeUndefined();

    palette.find('[data-color="#ffff00"]').simulate('mouseover').simulate('mousedown');
    await sleep(50);

    expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#ffff00' });
    expect($('.fs-context-menu:visible').length).toBe(0);
    hot.undo();
    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
  });

  it('puts the cells back when the menu closes while a color is shown', async() => {
    const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: ['alignment', 'formatting'] });

    selectCell(0, 0);
    const palette = await openFillPalette();

    palette.find('[data-color="#ff0000"]').simulate('mouseover');
    expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#ff0000' });
    hot.getPlugin('contextMenu').close();

    expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    expect(getCell(0, 0).style.background).toBe('');
    expect(hot.isUndoAvailable()).toBe(false);
  });

  describe('text on a fill', () => {
    const contrast = (cell) => {
      const luminance = color => color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number)
        .map(c => c / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
        .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
      const [lighter, darker] = [luminance(getComputedStyle(cell).color), luminance(getComputedStyle(cell).backgroundColor)]
        .sort((a, b) => b - a);

      return (lighter + 0.05) / (darker + 0.05);
    };

    it('is readable on a light fill in the dark theme and on a dark fill in the light theme', () => {
      spec().$container.addClass('fs-theme-dark');
      handsontable({
        data: [['light fill', 'dark fill', 'own color']],
        cell: [
          { row: 0, col: 0, style: { background: '#ffeb84' } },
          { row: 0, col: 1, style: { background: 'rgb(31, 78, 121)' } },
          { row: 0, col: 2, style: { background: '#ffeb84', color: '#c00000' } },
        ],
      });

      expect(contrast(getCell(0, 0))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(getCell(0, 1))).toBeGreaterThanOrEqual(4.5);
      expect(getComputedStyle(getCell(0, 2)).color).toBe('rgb(192, 0, 0)'); // a cell's own color stays

      spec().$container.removeClass('fs-theme-dark');
      render();

      expect(contrast(getCell(0, 0))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(getCell(0, 1))).toBeGreaterThanOrEqual(4.5);
    });

    it('is readable on a conditional formatting fill in the dark theme', () => {
      spec().$container.addClass('fs-theme-dark');
      handsontable({
        data: [[1], [2], [3]],
        conditionalFormatting: [{ range: 'A1:A3', colorScale: ['#f8696b', '#ffeb84', '#63be7b'] }],
      });

      [0, 1, 2].forEach(row => expect(contrast(getCell(row, 0))).toBeGreaterThanOrEqual(4.5));
    });
  });

  describe('formatting bar', () => {
    afterEach(() => {
      $('.fs-formatting-bar').remove();
    });

    it('draws each border kind as an icon, and the borders button as the last one chosen', async() => {
      handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);
      $('.fs-formatting-bar [data-palette="borders"]').simulate('mousedown');

      const entries = $('.fs-formatting-bar__list[data-item="borders"] [data-value]');

      expect(entries.length).toBe(8);
      expect(entries.filter((i, entry) => entry.querySelector('svg')).length).toBe(8);

      entries.filter('[data-value="top"]').simulate('mousedown');

      expect($('.fs-formatting-bar [data-action="borders"]').attr('data-border')).toBe('top');
    });

    it('fits the font size field to its value', async() => {
      handsontable({ data: [[1, 2]], contextMenu: true, formattingBar: true,
        cell: [{ row: 0, col: 0, style: { fontSize: '100.5pt' } }] });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);
      const size = $('.fs-formatting-bar [data-font-size]').get(0);

      expect(size.value).toBe('100.5');
      expect(size.scrollWidth).toBeLessThanOrEqual(size.clientWidth);
    });

    it('opens above the context menu and closes with it', async() => {
      handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(1, 1);
      contextMenu();
      await sleep(0);

      const bar = $('.fs-formatting-bar');
      const menu = $('.fs-context-menu').get(0).getBoundingClientRect();

      expect(bar.length).toBe(1);
      expect(bar.attr('role')).toBe('toolbar');
      expect(bar.get(0).getBoundingClientRect().bottom).toBeLessThanOrEqual(menu.top);
      expect(bar.find('[data-action]').map((i, b) => b.dataset.action).get())
        .toEqual(['bold', 'italic', 'underline', 'strikethrough', 'fill_color', 'text_color', 'borders', 'left',
          'center', 'right', 'format_painter', 'clear']);
      expect(bar.find('[data-palette="number_format"]').length).toBe(1);

      $('body').simulate('mousedown');
      expect($('.fs-formatting-bar').length).toBe(0);
    });

    it('formats the selected cells and keeps the menu open', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0, 1, 0);
      contextMenu();
      await sleep(0);
      const button = action => $(`.fs-formatting-bar [data-action="${action}"]`);

      button('bold').simulate('mousedown');
      expect(hot.getCellMeta(1, 0).style).toEqual({ fontWeight: 'bold' });
      expect(button('bold').attr('aria-pressed')).toBe('true');
      expect($('.fs-context-menu:visible').length).toBe(1);

      button('center').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).className).toContain('fs-center');
      expect(button('center').attr('aria-pressed')).toBe('true');

      // The color buttons set the last chosen color; the arrow opens the palette.
      button('fill_color').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style.background).toBe('#ffff00');
      $('.fs-formatting-bar [data-palette="fill_color"]').simulate('mousedown');
      $('.fs-formatting-bar .fs-palette [data-color="#00b050"]').simulate('mouseover').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style.background).toBe('#00b050');
      expect($('.fs-formatting-bar .fs-palette').length).toBe(0);
      expect($('.fs-formatting-bar [data-color-of="fill_color"]').get(0).style.background).toContain('rgb(0, 176, 80)');

      button('clear').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      hot.undo();
      expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold', background: '#00b050' });
    });

    it('previews palette colors and puts the cells back when it closes without a choice', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);
      $('.fs-formatting-bar [data-palette="text_color"]').simulate('mousedown');
      $('.fs-formatting-bar .fs-palette [data-color="#c00000"]').simulate('mouseover');
      expect(getCell(0, 0).style.color).toBe('rgb(192, 0, 0)');

      $('body').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      expect(getCell(0, 0).style.color).toBe('');
      expect(hot.isUndoAvailable()).toBe(false);
    });

    /** Opens the bar's fill palette and its "More colors"; returns the color area. */
    const openMoreColors = async() => {
      contextMenu();
      await sleep(0);
      $('.fs-formatting-bar [data-palette="fill_color"]').simulate('mousedown');
      $('.fs-formatting-bar .fs-palette__more').simulate('mousedown');

      return $('.fs-formatting-bar .fs-palette__area').get(0);
    };
    const pointAt = (area, x, y) => {
      const box = area.getBoundingClientRect();

      area.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1,
        clientX: box.left + box.width * x, clientY: box.top + box.height * y }));
      area.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 }));
    };

    it('previews the "More colors" color, and puts the cells back when a click elsewhere closes it', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      const area = await openMoreColors();

      pointAt(area, 1, 0);
      expect(hot.getCellMeta(0, 0).style.background).toMatch(/^#/);
      // Leaving the palette keeps showing it: the color is not chosen yet.
      $('.fs-formatting-bar .fs-palette').simulate('mouseleave');
      expect(hot.getCellMeta(0, 0).style).toBeDefined();

      $('body').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      expect(getCell(0, 0).style.background).toBe('');
      expect(hot.isUndoAvailable()).toBe(false);
    });

    it('sets the "More colors" color with OK, and puts the cells back with Cancel', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      const area = await openMoreColors();

      pointAt(area, 1, 0);
      $('.fs-formatting-bar .fs-palette__cancel').simulate('click');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      expect($('.fs-formatting-bar .fs-palette__swatch').length).toBe(70);

      $('.fs-formatting-bar .fs-palette__more').simulate('mousedown');
      const hex = $('.fs-formatting-bar .fs-palette__hex').val('#123456').get(0);

      hex.dispatchEvent(new Event('input', { bubbles: true }));
      expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#123456' });
      $('.fs-formatting-bar .fs-palette__ok').simulate('click');

      expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#123456' });
      expect($('.fs-formatting-bar .fs-palette').length).toBe(0);
      hot.undo();
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
    });

    it('closes the palette with Escape and puts the cells back', async() => {
      const hot = handsontable({ data: [[1, 2], [3, 4]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);
      $('.fs-formatting-bar [data-palette="fill_color"]').simulate('mousedown');
      $('.fs-formatting-bar .fs-palette [data-color="#c00000"]').simulate('mouseover');
      expect(hot.getCellMeta(0, 0).style).toEqual({ background: '#c00000' });

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      expect($('.fs-formatting-bar .fs-palette').length).toBe(0);
      expect($('.fs-formatting-bar').length).toBe(1);
    });

    it('shows the buttons of its items setting', async() => {
      handsontable({ data: [[1]], contextMenu: true, formattingBar: { items: ['italic', 'strikethrough'] } });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);

      expect($('.fs-formatting-bar [data-action]').map((i, b) => b.dataset.action).get())
        .toEqual(['italic', 'strikethrough']);
    });
  });

  describe('borders, number formats and the format painter', () => {
    afterEach(() => {
      $('.fs-formatting-bar').remove();
    });

    const openBar = async() => {
      contextMenu();
      await sleep(0);
    };
    const pick = (list, value) => {
      $(`.fs-formatting-bar [data-palette="${list}"]`).simulate('mousedown');
      $(`.fs-formatting-bar__list [data-value="${value}"]`).simulate('mousedown');
    };

    it('draws borders around, on every side, on one side, or none, as shadows that keep the cell size', async() => {
      const hot = handsontable({ data: createSpreadsheetData(3, 3), contextMenu: true, formattingBar: true });
      const height = getCell(0, 0).offsetHeight;

      selectCell(0, 0, 1, 1);
      await openBar();
      pick('borders', 'outside');

      expect(hot.getCellMeta(0, 0).style).toEqual({ borderTop: '1px solid #000000', borderLeft: '1px solid #000000' });
      expect(hot.getCellMeta(1, 1).style).toEqual({ borderBottom: '1px solid #000000',
        borderRight: '1px solid #000000' });
      expect(hot.getCellMeta(0, 1).style).toEqual({ borderTop: '1px solid #000000', borderRight: '1px solid #000000' });
      expect(getCell(0, 0).style.boxShadow).toContain('inset');
      expect(getCell(0, 0).offsetHeight).toBe(height);

      // The Borders button draws the last chosen border again.
      $('.fs-formatting-bar [data-action="borders"]').simulate('mousedown');
      pick('borders', 'none');
      expect(hot.getCellMeta(0, 0).style).toBeUndefined();
      expect(getCell(0, 0).style.boxShadow).toBe('');

      pick('borders', 'all');
      expect(hot.getCellMeta(1, 0).style.borderTop).toBe('1px solid #000000');
      pick('borders', 'bottom');
      hot.undo();
      expect(hot.getCellMeta(1, 0).style.borderBottom).toBe('1px solid #000000');
      hot.undo();
      expect(hot.getCellMeta(1, 0).style).toBeUndefined();
    });

    it('gives the selected cells a number format, and General back', async() => {
      const hot = handsontable({ data: [[1234.5, 0.25]], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      await openBar();
      pick('number_format', 'currency');
      expect(getCell(0, 0).textContent).toBe('$1,234.50');
      expect(hot.getCellMeta(0, 0).type).toBe('numeric');

      selectCell(0, 1);
      pick('number_format', 'percent');
      expect(getCell(0, 1).textContent).toBe('25.00%');

      selectCell(0, 0);
      pick('number_format', 'general');
      expect(getCell(0, 0).textContent).toBe('1234.5');

      hot.undo();
      expect(getCell(0, 0).textContent).toBe('$1,234.50');
    });

    it('copies formats with the format painter to the next selected cells, in one undo step', async() => {
      const hot = handsontable({
        data: [[1234.5, 2], [3, 4]],
        contextMenu: true,
        formattingBar: true,
        cell: [{ row: 0, col: 0, style: { fontWeight: 'bold', background: '#ffff00' }, className: 'fs-center',
          type: 'numeric', numericFormat: { pattern: '0,0.0' } }],
      });

      selectCell(0, 0);
      await openBar();
      $('.fs-formatting-bar [data-action="format_painter"]').simulate('mousedown');

      expect($('.fs-context-menu:visible').length).toBe(0);
      expect(hot.rootElement.classList.contains('fs-format-painting')).toBe(true);
      expect(hot.getCellMeta(0, 0).style).toEqual({ fontWeight: 'bold', background: '#ffff00' });

      selectCell(1, 0, 1, 1);
      expect(hot.getCellMeta(1, 1).style).toEqual({ fontWeight: 'bold', background: '#ffff00' });
      expect(hot.getCellMeta(1, 1).className).toContain('fs-center');
      expect(getCell(1, 0).textContent).toBe('3.0');
      expect(hot.rootElement.classList.contains('fs-format-painting')).toBe(false);

      // Once: the next selection keeps its format.
      selectCell(0, 1);
      expect(hot.getCellMeta(0, 1).style).toBeUndefined();

      hot.undo();
      expect(hot.getCellMeta(1, 1).style).toBeUndefined();
      expect(getCell(1, 0).textContent).toBe('3');
    });

    it('puts the format painter away with Escape', async() => {
      const hot = handsontable({ data: [[1, 2]], contextMenu: true, formattingBar: true,
        cell: [{ row: 0, col: 0, style: { fontWeight: 'bold' } }] });

      selectCell(0, 0);
      await openBar();
      $('.fs-formatting-bar [data-action="format_painter"]').simulate('mousedown');
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      selectCell(0, 1);

      expect(hot.getCellMeta(0, 1).style).toBeUndefined();
    });
  });

  describe('font and font size', () => {
    afterEach(() => {
      $('.fs-formatting-bar').remove();
    });

    it('makes rows tall enough for the font sizes of their cells, also from the settings', () => {
      handsontable({ data: [['Title', 1], ['b', 2]], rowHeaders: true,
        cell: [{ row: 0, col: 0, style: { fontSize: '18pt' } }] });

      expect(getCell(0, 0).offsetHeight).toBeGreaterThan(30);
      expect(getCell(1, 0).offsetHeight).toBeLessThan(30);
      // The row header grows with it.
      expect(getCell(0, -1).offsetHeight).toBe(getCell(0, 0).offsetHeight);
    });

    it('sets the font from its list and the size from its field or list, in one undo step each', async() => {
      const hot = handsontable({ data: [['a', 'b']], contextMenu: true, formattingBar: true });

      selectCell(0, 0);
      contextMenu();
      await sleep(0);
      const bar = $('.fs-formatting-bar');

      expect(bar.find('[data-font-label]').text()).toBe('Default');

      bar.find('[data-palette="font_family"]').simulate('mousedown');
      const georgia = $('.fs-formatting-bar__list [data-value="Georgia"]');

      expect(georgia.get(0).style.fontFamily).toBe('Georgia');
      georgia.simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toEqual({ fontFamily: 'Georgia' });
      expect(getCell(0, 0).style.fontFamily).toBe('Georgia');
      expect(bar.find('[data-font-label]').text()).toBe('Georgia');

      const size = bar.find('[data-font-size]');

      size.val('14');
      size.get(0).dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      expect(hot.getCellMeta(0, 0).style).toEqual({ fontFamily: 'Georgia', fontSize: '14pt' });
      expect(getCell(0, 0).style.fontSize).toBe('14pt');

      bar.find('[data-palette="font_size"]').simulate('mousedown');
      $('.fs-formatting-bar__list [data-value="20"]').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style.fontSize).toBe('20pt');
      // A bigger font makes the row taller (20pt is about 27px of text).
      expect(getCell(0, 0).offsetHeight).toBeGreaterThan(30);

      hot.undo();
      expect(hot.getCellMeta(0, 0).style.fontSize).toBe('14pt');

      bar.find('[data-palette="font_family"]').simulate('mousedown');
      $('.fs-formatting-bar__list [data-value=""]').simulate('mousedown');
      expect(hot.getCellMeta(0, 0).style).toEqual({ fontSize: '14pt' });
    });
  });
});

