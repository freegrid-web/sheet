describe('Theme', () => {
  const id = 'testContainer';
  const PROPERTIES = ['color', 'background-color', 'border-top-color', 'border-right-color', 'border-bottom-color',
    'border-left-color', 'font-family', 'font-size', 'box-shadow'];

  // One representative element per styled part (a pseudo-element where the part is drawn with ::after).
  const PARTS = {
    cell: ['.fs-master tbody td:not(.area):not(.current)'],
    colHeader: ['.fs-master thead th:not(.fs-highlight)'],
    activeColHeader: ['.fs-master thead th.fs-highlight'],
    selectionArea: ['.fs-master td.area', '::before'],
    currentBorder: ['.fs-master .fs-selection-border.current'],
    fillHandle: ['.fs-master .fs-selection-border.corner'],
    invalidCell: ['.fs-master td.fs-invalid'],
    readOnlyCell: ['.fs-master td.fs-dimmed'],
    commentIndicator: ['.fs-master td.fs-comment-cell', '::after'],
    mergedCell: ['.fs-master td[rowspan="2"]'],
    menu: ['.fs-context-menu .fs-master table'],
    menuItem: ['.fs-context-menu .fs-master td:not(.fs-separator):not(.fs-disabled):not(.current)'],
    menuItemHover: ['.fs-context-menu .fs-master td.current'],
    menuSeparator: ['.fs-context-menu .fs-master td.fs-separator'],
    menuDisabledItem: ['.fs-context-menu .fs-master td.fs-disabled'],
  };

  // Computed with today's CSS (before theming); identical in Chromium, Firefox and WebKit.
  const EXPECTED_LIGHT = {
    cell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    colHeader: {
      'color': 'rgb(34, 34, 34)',
      'background-color': 'rgb(240, 240, 240)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    activeColHeader: {
      'color': 'rgb(34, 34, 34)',
      'background-color': 'rgb(220, 220, 220)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(34, 34, 34)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    selectionArea: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(0, 94, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    currentBorder: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(75, 137, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '0px',
      'box-shadow': 'none',
    },
    fillHandle: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(75, 137, 255)',
      'border-top-color': 'rgb(255, 255, 255)',
      'border-right-color': 'rgb(255, 255, 255)',
      'border-bottom-color': 'rgb(255, 255, 255)',
      'border-left-color': 'rgb(255, 255, 255)',
      'font-family': 'sans-serif',
      'font-size': '0px',
      'box-shadow': 'none',
    },
    invalidCell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 76, 66)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    readOnlyCell: {
      'color': 'rgb(110, 110, 110)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(110, 110, 110)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(110, 110, 110)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    commentIndicator: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgba(0, 0, 0, 0)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgba(0, 0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    mergedCell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menu: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgba(0, 0, 0, 0)',
      'border-top-color': 'rgb(204, 204, 204)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuItem: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuItemHover: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(243, 243, 243)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuSeparator: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(230, 230, 230)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    menuDisabledItem: {
      'color': 'rgb(153, 153, 153)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(153, 153, 153)',
      'border-right-color': 'rgb(153, 153, 153)',
      'border-bottom-color': 'rgb(153, 153, 153)',
      'border-left-color': 'rgb(153, 153, 153)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
  };

  function collectThemeStyles(parts = PARTS) {
    const result = {};

    Object.keys(parts).forEach((part) => {
      const [selector, pseudo] = parts[part];
      const element = document.querySelector(selector);

      if (!element) {
        result[part] = null;

        return;
      }
      const style = getComputedStyle(element, pseudo || null);

      result[part] = {};
      PROPERTIES.forEach((property) => {
        result[part][property] = style.getPropertyValue(property);
      });
    });

    return result;
  }

  // A grid that shows every styled part at once: headers, a selection, an invalid and a read-only cell, a comment,
  // a merged cell, and an open context menu with a hovered, a disabled and a separator item. (Pikaday's CSS is not
  // loaded on the E2E page, so the date picker is checked by the dist tests instead.)
  async function createThemeFixture() {
    const hot = handsontable({
      data: Handsontable.helper.createSpreadsheetData(10, 5),
      colHeaders: true,
      rowHeaders: true,
      contextMenu: {
        items: {
          first: { name: 'First' },
          separator: '---------',
          disabledItem: { name: 'Disabled', disabled: true },
          last: { name: 'Last' },
        },
      },
      comments: true,
      mergeCells: [{ row: 3, col: 0, rowspan: 2, colspan: 2 }],
      cell: [
        { row: 2, col: 2, readOnly: true },
        { row: 1, col: 1, comment: { value: 'Note' } },
      ],
      columns: [{}, {}, {}, { validator: (value, callback) => callback(false) }, { type: 'date', dateFormat: 'MM/DD/YYYY' }],
    });

    await new Promise(resolve => hot.validateCells(resolve));
    hot.setDataAtCell(0, 4, '10/12/2026');

    selectCell(5, 1, 6, 3);
    contextMenu();
    // Hovering a menu item selects it in the menu's own grid (td.current).
    hot.getPlugin('contextMenu').menu.hotMenu.selectCell(0, 0);
    await sleep(50);

    return hot;
  }

  // Parts that only exist while editing or searching.
  const EDITING_PARTS = {
    searchResult: ['.fs-master td.fs-search-result'],
    editorInput: ['.fs-editor-input'],
    listboxCell: ['.fs-editor-grid .fs-master td'],
    commentTextArea: ['.fs-comment-text-area'],
  };

  // Recorded on main before theming (8466fc10); identical in Chromium, Firefox and WebKit.
  const EXPECTED_LIGHT_EDITING = {
    searchResult: {
      'color': 'rgb(88, 55, 7)',
      'background-color': 'rgb(252, 237, 217)',
      'border-top-color': 'rgb(88, 55, 7)',
      'border-right-color': 'rgb(204, 204, 204)',
      'border-bottom-color': 'rgb(204, 204, 204)',
      'border-left-color': 'rgb(88, 55, 7)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    editorInput: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'rgb(82, 146, 247) 0px 0px 0px 2px inset',
    },
    listboxCell: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgba(0, 0, 0, 0)',
      'border-right-color': 'rgba(0, 0, 0, 0)',
      'border-bottom-color': 'rgba(0, 0, 0, 0)',
      'border-left-color': 'rgba(0, 0, 0, 0)',
      'font-family': 'sans-serif',
      'font-size': '16px',
      'box-shadow': 'none',
    },
    commentTextArea: {
      'color': 'rgb(0, 0, 0)',
      'background-color': 'rgb(255, 255, 255)',
      'border-top-color': 'rgb(0, 0, 0)',
      'border-right-color': 'rgb(0, 0, 0)',
      'border-bottom-color': 'rgb(0, 0, 0)',
      'border-left-color': 'rgb(204, 204, 204)',
      'font-family': 'sans-serif',
      'font-size': '12px',
      'box-shadow': 'rgba(0, 0, 0, 0.118) 0px 1px 3px 0px, rgba(0, 0, 0, 0.24) 0px 1px 2px 0px',
    },
  };

  async function collectEditingStyles() {
    const hot = handsontable({
      data: [['A1', 'Apple', 'C1'], ['A2', 'B2', 'C2'], ['A3', 'B3', 'C3']],
      colHeaders: true,
      rowHeaders: true,
      comments: true,
      search: true,
      columns: [{}, { type: 'autocomplete', source: ['Apple', 'Banana'], strict: false }, {}],
      cell: [{ row: 2, col: 2, comment: { value: 'Note' } }],
    });
    const pick = part => collectThemeStyles({ [part]: EDITING_PARTS[part] })[part];
    const result = {};

    hot.getPlugin('search').query('C2');
    hot.render();
    result.searchResult = pick('searchResult');

    selectCell(1, 0);
    keyDownUp('enter');
    result.editorInput = pick('editorInput');
    keyDownUp('esc');

    selectCell(0, 1);
    keyDownUp('enter');
    await sleep(100);
    result.listboxCell = pick('listboxCell');
    keyDownUp('esc');

    hot.getPlugin('comments').showAtCell(2, 2);
    result.commentTextArea = pick('commentTextArea');
    hot.getPlugin('comments').hide();

    return result;
  }

  beforeEach(function() {
    this.$container = $(`<div id="${id}"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
  });

  it('keeps today\'s light styles when no theme is set', async() => {
    await createThemeFixture();

    expect(collectThemeStyles()).toEqual(EXPECTED_LIGHT);
  });

  it('keeps today\'s light styles of editors, lists, comments and search results', async() => {
    expect(await collectEditingStyles()).toEqual(EXPECTED_LIGHT_EDITING);
  });

  describe('on floating elements', () => {
    async function openFloatingParts(hot) {
      contextMenu();
      await sleep(50);
      // This grid's own elements: earlier specs may leave other floating elements in <body>.
      const menu = hot.getPlugin('contextMenu').menu.container;

      closeContextMenu();
      hot.getPlugin('comments').showAtCell(1, 1);
      const comments = hot.getPlugin('comments').editor.editor.parentNode;

      hot.getPlugin('comments').hide();
      selectCell(0, 4);
      keyDownUp('enter');
      await sleep(100);
      const datePicker = hot.getActiveEditor().datePicker;

      return { menu, comments, datePicker };
    }

    afterEach(function() {
      // unwrap() keeps the container's data, so the outer afterEach still finds and destroys the grid.
      this.$container.unwrap('.theme-wrapper');
      document.body.removeAttribute('data-fs-theme');
    });

    it('gives the context menu, comment editor and date picker the dark theme of an ancestor', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"></div>');
      const hot = await createThemeFixture();

      expect(getComputedStyle(document.querySelector('.fs-master tbody td:not(.area):not(.current)'))['background-color'])
        .toBe('rgb(30, 30, 30)');

      closeContextMenu();
      const { menu, comments, datePicker } = await openFloatingParts(hot);

      expect(menu.classList.contains('fs-theme-dark')).toBe(true);
      expect(comments.classList.contains('fs-theme-dark')).toBe(true);
      expect(datePicker.classList.contains('fs-theme-dark')).toBe(true);
    });

    it('reads data-fs-theme on <body> too', async() => {
      document.body.setAttribute('data-fs-theme', 'dark');
      const hot = await createThemeFixture();

      closeContextMenu();
      const { menu } = await openFloatingParts(hot);

      expect(menu.classList.contains('fs-theme-dark')).toBe(true);
    });

    it('follows a theme change between two openings of the menu', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"></div>');
      const hot = await createThemeFixture();

      expect(hot.getPlugin('contextMenu').menu.container.classList.contains('fs-theme-dark')).toBe(true);
      closeContextMenu();

      $('.theme-wrapper').removeClass('fs-theme-dark');
      contextMenu();
      await sleep(50);

      expect(hot.getPlugin('contextMenu').menu.container.classList.contains('fs-theme-dark')).toBe(false);
    });
  });

  describe('dark theme', () => {
    afterEach(function() {
      // Up to two nested wrappers.
      this.$container.unwrap('.theme-wrapper');
      this.$container.unwrap('.theme-wrapper');
    });

    it('keeps a grid light with fs-theme-light inside a dark page', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"><div class="theme-wrapper fs-theme-light"></div></div>');
      const hot = await createThemeFixture();
      const cell = getComputedStyle(document.querySelector('.fs-master tbody td:not(.area):not(.current)'));

      expect(cell.backgroundColor).toBe('rgb(255, 255, 255)');
      expect(cell.color).toBe('rgb(0, 0, 0)');
      // A component color with its own value (not derived from a base variable) must be the light one too.
      expect(getComputedStyle(document.querySelector('.fs-master thead th.fs-highlight')).backgroundColor).toBe('rgb(220, 220, 220)');
      expect(hot.getPlugin('contextMenu').menu.container.classList.contains('fs-theme-light')).toBe(true);
    });

    it('re-themes the comment editor when it is shown again while open', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"></div>');
      const hot = await createThemeFixture();
      const comments = hot.getPlugin('comments');

      closeContextMenu();
      comments.showAtCell(1, 1);
      expect(comments.editor.editor.parentNode.classList.contains('fs-theme-dark')).toBe(true);

      $('.theme-wrapper').removeClass('fs-theme-dark');
      comments.showAtCell(1, 1);
      expect(comments.editor.editor.parentNode.classList.contains('fs-theme-dark')).toBe(false);
    });

    // The E2E page has no text color of its own (black), like most pages: the dark theme must set it.
    it('makes text light on the dark cells, menus, editors and comments', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"></div>');
      const hot = await createThemeFixture();
      const light = 'rgb(230, 230, 230)';

      expect(getComputedStyle(document.querySelector('.fs-master tbody td:not(.area):not(.current)')).color).toBe(light);
      expect(getComputedStyle(document.querySelector(PARTS.menuItem[0])).color).toBe(light);
      closeContextMenu();

      hot.getPlugin('comments').showAtCell(1, 1);
      expect(getComputedStyle(document.querySelector('.fs-comment-text-area')).color).toBe(light);
      hot.getPlugin('comments').hide();

      selectCell(0, 0);
      keyDownUp('enter');
      expect(getComputedStyle(document.querySelector('.fs-editor-input')).color).toBe(light);
      expect(getComputedStyle(document.querySelector('.fs-editor-input')).boxShadow).toContain('inset');
      keyDownUp('esc');
    });

    it('draws a border added from the context menu in a light color', function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"></div>');
      handsontable({ data: Handsontable.helper.createSpreadsheetData(4, 4), customBorders: true });
      // What the context menu's Borders > Top item does for cell (1, 1).
      getPlugin('customBorders').prepareBorder([{ start: { row: 1, col: 1 }, end: { row: 1, col: 1 } }], 'top', false);
      render();

      const drawn = Array.from(document.querySelectorAll('.fs-master .fs-selection-border'))
        .filter(element => element.offsetWidth > 0 && element.offsetHeight > 0)
        .map(element => getComputedStyle(element).backgroundColor);

      expect(drawn.length).toBeGreaterThan(0);
      expect(drawn).not.toContain('rgb(0, 0, 0)');
    });
  });

  describe('size variables', () => {
    it('uses --fs-row-height for the rows, in the CSS and in the layout', async function() {
      this.$container[0].style.setProperty('--fs-row-height', '40px');
      const hot = handsontable({ data: Handsontable.helper.createSpreadsheetData(50, 3), height: 300 });

      expect(document.querySelector('.fs-master tbody tr:nth-child(2) td').offsetHeight).toBe(40);
      expect(hot.view.wt.wtSettings.settings.defaultRowHeight).toBe(40);

      hot.scrollViewportTo(49, 0);
      await sleep(100);
      const lastRow = Array.from(document.querySelectorAll('.fs-master tbody tr')).pop();

      expect(lastRow.querySelector('td').textContent).toBe('A50');
      expect(lastRow.getBoundingClientRect().bottom).toBeLessThanOrEqual(this.$container[0].getBoundingClientRect().bottom + 1);
    });
  });

  describe('Modern style', () => {
    afterEach(function() {
      this.$container.unwrap('.theme-wrapper');
    });

    it('makes rows 32px with 8px cell padding, on the grid and in its popups', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-style-modern"></div>');
      const hot = await createThemeFixture();
      // The second row: the first one also has the table's top border.
      const cell = this.$container[0].querySelector('.fs-master tbody tr:nth-child(2) td:not(.area):not(.current)');

      expect(cell.offsetHeight).toBe(32);
      expect(getComputedStyle(cell).paddingLeft).toBe('8px');
      expect(hot.view.wt.wtSettings.settings.defaultRowHeight).toBe(32);
      expect(hot.getPlugin('contextMenu').menu.container.classList.contains('fs-style-modern')).toBe(true);
      // The third item (the second one is a separator). Menu cells add a 4px top padding, as in Classic (26px there).
      expect(document.querySelector('.fs-context-menu .fs-master tbody tr:nth-child(3) td').offsetHeight).toBeGreaterThanOrEqual(32);

      closeContextMenu();
      selectCell(1, 0);
      keyDownUp('enter');
      await sleep(50);
      // The editor overlaps the cell's bottom border, so it is at most 1px taller.
      expect(Math.abs(getActiveEditor().TEXTAREA.offsetHeight - getCell(1, 0).offsetHeight)).toBeLessThanOrEqual(1);
      keyDownUp('esc');
    });

    it('works with the dark theme: headers keep the theme\'s header colors', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-style-modern fs-theme-dark"></div>');
      await createThemeFixture();
      const header = getComputedStyle(this.$container[0].querySelector('.fs-master thead th:not(.fs-highlight)'));

      expect(getComputedStyle(this.$container[0].querySelector('.fs-master tbody tr:nth-child(2) td')).backgroundColor)
        .toBe('rgb(30, 30, 30)');
      expect(header.backgroundColor).toBe('rgb(42, 42, 42)');
      expect(header.color).toBe('rgb(208, 208, 208)');
    });

    it('has its own palette: light lines, soft text, light headers, a blue accent and a round fill handle', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-style-modern"></div>');
      await createThemeFixture();
      const root = this.$container[0];
      const cell = getComputedStyle(root.querySelector('.fs-master tbody tr:nth-child(2) td:not(.area):not(.current)'));
      const header = getComputedStyle(root.querySelector('.fs-master thead th:not(.fs-highlight)'));

      expect(cell.color).toBe('rgba(0, 0, 0, 0.7)');
      expect(cell.borderBottomColor).toBe('rgb(228, 228, 228)');
      expect(header.backgroundColor).toBe('rgb(247, 247, 247)');
      expect(header.color).toBe('rgba(0, 0, 0, 0.7)');
      expect(header.fontWeight).toBe('500');
      expect(getComputedStyle(root.querySelector('.fs-master thead th.fs-highlight')).backgroundColor).toBe('rgb(230, 230, 230)');
      expect(getComputedStyle(root.querySelector(PARTS.currentBorder[0])).backgroundColor).toBe('rgb(2, 135, 202)');
      expect(getComputedStyle(root.querySelector(PARTS.fillHandle[0])).borderRadius).toBe('50%');
      expect(getComputedStyle(root.querySelector(PARTS.fillHandle[0])).backgroundColor).toBe('rgb(2, 135, 202)');
    });

    it('lets base colors the user sets on :root win over its palette', async function() {
      document.documentElement.style.setProperty('--fs-color-border', '#123456');
      document.documentElement.style.setProperty('--fs-color-header-background', '#abcdef');
      this.$container.wrap('<div class="theme-wrapper fs-style-modern"></div>');
      await createThemeFixture();
      const root = this.$container[0];
      // Read before cleaning up: computed styles are live.
      const { borderBottomColor } = getComputedStyle(root.querySelector('.fs-master tbody tr:nth-child(2) td:not(.area):not(.current)'));
      const { backgroundColor } = getComputedStyle(root.querySelector('.fs-master thead th:not(.fs-highlight)'));

      document.documentElement.style.removeProperty('--fs-color-border');
      document.documentElement.style.removeProperty('--fs-color-header-background');
      expect(borderBottomColor).toBe('rgb(18, 52, 86)');
      expect(backgroundColor).toBe('rgb(171, 205, 239)');
    });

    it('keeps its palette in a light grid inside a dark page', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-theme-dark"><div class="theme-wrapper fs-theme-light fs-style-modern"></div></div>');
      await createThemeFixture();
      const { backgroundColor, color } = getComputedStyle(this.$container[0].querySelector('.fs-master thead th:not(.fs-highlight)'));

      this.$container.unwrap('.theme-wrapper'); // the inner wrapper; afterEach removes the outer one
      expect(backgroundColor).toBe('rgb(247, 247, 247)');
      expect(color).toBe('rgba(0, 0, 0, 0.7)');
    });

    it('can be switched back to Classic inside a Modern page with fs-style-classic', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-style-modern"><div class="theme-wrapper" data-fs-style="classic"></div></div>');
      const hot = await createThemeFixture();
      const root = this.$container[0];
      const cell = root.querySelector('.fs-master tbody tr:nth-child(2) td:not(.area):not(.current)');
      const { backgroundColor, fontWeight } = getComputedStyle(root.querySelector('.fs-master thead th:not(.fs-highlight)'));
      const { color, borderBottomColor, fontSize } = getComputedStyle(cell);
      const height = cell.offsetHeight;
      const menuClassic = hot.getPlugin('contextMenu').menu.container.classList.contains('fs-style-classic');

      this.$container.unwrap('.theme-wrapper'); // the inner wrapper; afterEach removes the outer one
      expect(height).toBe(23);
      expect(hot.view.wt.wtSettings.settings.defaultRowHeight).toBe(23);
      expect(backgroundColor).toBe('rgb(240, 240, 240)');
      expect(fontWeight).toBe('400');
      expect(color).toBe('rgb(0, 0, 0)');
      expect(borderBottomColor).toBe('rgb(204, 204, 204)');
      expect(fontSize).toBe('16px');
      expect(menuClassic).toBe(true);
    });

    it('uses the base colors set by the user (as the playground presets do)', async function() {
      this.$container.wrap('<div class="theme-wrapper fs-style-modern" style="--fs-color-header-background: #e8f2f8; --fs-color-border: #cfe0ea; --fs-color-header-text: #0b3a53"></div>');
      await createThemeFixture();
      const header = getComputedStyle(this.$container[0].querySelector('.fs-master thead th:not(.fs-highlight)'));
      const cell = getComputedStyle(this.$container[0].querySelector('.fs-master tbody tr:nth-child(2) td'));

      expect(header.backgroundColor).toBe('rgb(232, 242, 248)');
      expect(header.color).toBe('rgb(11, 58, 83)');
      expect(cell.borderBottomColor).toBe('rgb(207, 224, 234)');
    });
  });
});
