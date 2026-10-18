describe('Core side panel', () => {
  const id = 'testContainer';

  beforeEach(function() {
    this.$container = $(`<div id="${id}" style="width: 900px; height: 300px"></div>`).appendTo('body');
  });

  afterEach(function() {
    if (this.$container) {
      destroy();
      this.$container.remove();
    }
    // Context menu containers stay in <body> and the next grid's menu reuses them: they go with these specs.
    $('.fs-sheet-tabs, .fs-side-panel, .fs-context-menu').remove();
  });

  const panel = () => document.querySelector('.fs-side-panel');
  const data = () => [['North', 120, 'Ada'], ['South', 90, 'Linus'], ['East', 1300, 'Ada'], ['West', -80, 'Grace']];
  const red = { background: '#ffc7ce', color: '#9c0006' };

  describe('the panel', () => {
    it('shows only the active sheet\'s formula bar in a document of several sheets', () => {
      handsontable({
        data: data(),
        formulaBar: true,
        sidePanel: true,
        sheets: [{ id: 'two', name: 'Two', data: [[1]] }, { id: 'three', name: 'Three', data: [[2]] }],
      });
      const visibleBars = () => Array.from(document.querySelectorAll('.fs-formula-bar'))
        .filter(bar => bar.offsetParent !== null).length;

      expect(document.querySelectorAll('.fs-formula-bar').length).toBe(3);
      expect(visibleBars()).toBe(1);

      getInstance().activateSheet('three');

      expect(visibleBars()).toBe(1);

      // New settings for a hidden sheet make its bar again: it stays hidden.
      getInstance().getSheet('two').updateSettings({ colHeaders: true });

      expect(visibleBars()).toBe(1);

      getInstance().activateSheet('two');

      expect(visibleBars()).toBe(1);
    });

    it('opens at the right of the frame, and the sheet makes room for it', () => {
      const afterOpen = jasmine.createSpy('afterPanelOpen');
      const afterClose = jasmine.createSpy('afterPanelClose');
      const hot = handsontable({ data: data(), sidePanel: true, stretchH: 'all', afterPanelOpen: afterOpen,
        afterPanelClose: afterClose });
      const width = hot.rootElement.offsetWidth;

      hot.openPanel('comments');

      expect(panel()).not.toBeNull();
      expect(hot.getOpenPanel()).toBe('comments');
      expect(Math.round(panel().getBoundingClientRect().right)).toBe(Math.round(spec().$container[0]
        .getBoundingClientRect().right));
      expect(hot.rootElement.offsetWidth).toBe(width - 300);
      expect(afterOpen.calls.argsFor(0)[0]).toBe('comments');

      hot.closePanel();

      expect(panel()).toBeNull();
      expect(hot.getOpenPanel()).toBeNull();
      expect(hot.rootElement.offsetWidth).toBe(width);
      expect(afterClose.calls.argsFor(0)[0]).toBe('comments');
    });

    it('opens over a grid without a frame', () => {
      const hot = handsontable({ data: data() });
      const width = hot.rootElement.offsetWidth;

      hot.openPanel('comments');

      expect(hot.rootElement.classList.contains('fs-panel-host--over')).toBe(true);
      expect(hot.rootElement.offsetWidth).toBe(width);
    });

    it('opens a panel at start with sidePanel: "comments", closes on Escape, and goes with the grid', () => {
      const hot = handsontable({ data: data(), sidePanel: 'comments' });

      expect(hot.getOpenPanel()).toBe('comments');

      panel().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(hot.getOpenPanel()).toBeNull();

      hot.openPanel('comments');
      expect(() => hot.openPanel('nothing')).toThrowError(/No side panel/);
    });
  });

  describe('Comments', () => {
    const cards = () => Array.from(panel().querySelectorAll('.fs-comments-panel__comment'));

    it('lists every comment of every sheet with its cell, author and date', () => {
      const hot = handsontable({ data: data(), comments: true, sidePanel: true,
        cell: [{ row: 1, col: 2, comment: { value: 'Check', author: 'Ada', date: '2026-10-16T18:23:00Z' } }] });

      hot.addSheet('costs', { name: 'Costs', data: [['Rent', 1200]], comments: true,
        cell: [{ row: 0, col: 1, comment: { value: 'Too high' } }] });
      hot.openPanel('comments');

      expect(cards().map(card => card.querySelector('.fs-comments-panel__cell').textContent))
        .toEqual(['Sheet1!C2', 'Costs!B1']);
      expect(cards()[0].querySelector('.fs-comments-panel__author').textContent).toBe('Ada');
      expect(cards()[0].querySelector('.fs-comments-panel__text').textContent).toBe('Check');
    });

    it('selects a comment\'s cell after a click, switching the sheet', () => {
      const hot = handsontable({ data: data(), comments: true, sidePanel: true });

      hot.addSheet('costs', { name: 'Costs', data: [['Rent', 1200]], comments: true,
        cell: [{ row: 0, col: 1, comment: { value: 'Too high' } }] });
      hot.openPanel('comments');
      cards()[0].click();

      expect(hot.getActiveSheet().getSheetId()).toBe('costs');
      expect(hot.getActiveSheet().getSelectedLast()).toEqual([0, 1, 0, 1]);
    });

    it('edits, deletes and adds comments', () => {
      const hot = handsontable({ data: data(), comments: true, sidePanel: true,
        cell: [{ row: 0, col: 0, comment: { value: 'First' } }] });

      hot.openPanel('comments');
      cards()[0].querySelector('.fs-comments-panel__edit').click();
      panel().querySelector('textarea').value = 'Changed';
      panel().querySelector('.fs-side-panel__button--primary').click();

      expect(hot.getCellMeta(0, 0).comment.value).toBe('Changed');

      hot.selectCell(2, 1);
      panel().querySelector('.fs-comments-panel__new').click();
      panel().querySelector('textarea').value = 'New one';
      panel().querySelector('.fs-side-panel__button--primary').click();

      expect(hot.getCellMeta(2, 1).comment.value).toBe('New one');
      expect(cards().length).toBe(2);

      cards()[0].querySelector('.fs-comments-panel__delete').click();

      expect(hot.getCellMeta(0, 0).comment).toBeUndefined();
      expect(cards().length).toBe(1);
    });

    it('shows comments set with the API while the panel is open', () => {
      const hot = handsontable({ data: data(), comments: true, sidePanel: 'comments' });

      hot.getPlugin('comments').setCommentAtCell(1, 1, 'From the API');

      expect(cards().map(card => card.querySelector('.fs-comments-panel__text').textContent)).toEqual(['From the API']);
    });
  });

  describe('Conditional formatting', () => {
    const rules = () => Array.from(panel().querySelectorAll('.fs-cf-panel__rule'));
    const plugin = () => getPlugin('conditionalFormatting');

    it('lists the rules of the sheet or of the selection, and changes their priority or deletes them', () => {
      const hot = handsontable({ data: data(), sidePanel: true, conditionalFormatting: [
        { range: 'B1:B4', when: 'gt', value: 100, style: red },
        { range: 'C1:C4', when: 'duplicate', style: red },
      ] });

      hot.openPanel('conditionalFormatting');

      expect(rules().map(rule => rule.querySelector('.fs-cf-panel__description').textContent))
        .toEqual(['Greater than 100', 'Duplicate values']);
      expect(rules()[0].querySelector('.fs-side-panel__muted').textContent).toBe('Apply to: B1:B4');

      hot.selectCell(0, 2);
      const scope = panel().querySelector('.fs-cf-panel__scope');

      scope.value = 'selection';
      scope.dispatchEvent(new Event('change'));
      expect(rules().length).toBe(1);

      scope.value = 'sheet';
      scope.dispatchEvent(new Event('change'));
      rules()[1].querySelector('.fs-cf-panel__up').click();
      expect(plugin().getRules().map(rule => rule.when)).toEqual(['duplicate', 'gt']);

      rules()[0].querySelector('.fs-cf-panel__delete').click();
      expect(plugin().getRules().map(rule => rule.when)).toEqual(['gt']);
    });

    it('edits a new rule with a live preview: Done keeps it, Cancel drops it', () => {
      const hot = handsontable({ data: data(), sidePanel: true, conditionalFormatting: true });

      hot.selectCell(0, 1, 3, 1);
      hot.openPanel('conditionalFormattingRule', { preset: { when: 'gt', value: '' } });

      expect(panel().querySelector('.fs-cf-panel__range').value).toBe('B1:B4');

      const value = panel().querySelector('.fs-cf-panel__value');

      value.value = '100';
      value.dispatchEvent(new Event('input'));

      // Shown while editing.
      expect(getCell(2, 1).style.color).toBe('rgb(156, 0, 6)');

      panel().querySelector('.fs-cf-panel__cancel').click();
      expect(plugin().getRules()).toEqual([]);
      expect(getCell(2, 1).style.color).toBe('');
      expect(hot.getOpenPanel()).toBe('conditionalFormatting');

      hot.openPanel('conditionalFormattingRule', { preset: { when: 'lt', value: '0' } });
      panel().querySelector('.fs-cf-panel__done').click();

      expect(plugin().getRules().map(rule => [rule.when, rule.value, rule.range])).toEqual([['lt', '0', 'B1:B4']]);
    });

    it('drops the changes of an existing rule on Cancel, and closing the panel cancels too', () => {
      const hot = handsontable({ data: data(), sidePanel: true,
        conditionalFormatting: [{ range: 'B1:B4', when: 'gt', value: 100, style: red }] });
      const [rule] = plugin().getRules();

      hot.openPanel('conditionalFormattingRule', { id: rule.id });
      panel().querySelector('.fs-cf-panel__kind--colorScale').click();

      expect(plugin().getRules()[0].colorScale).toBeDefined();

      panel().querySelector('.fs-cf-panel__cancel').click();
      expect(plugin().getRules()[0].when).toBe('gt');

      hot.openPanel('conditionalFormattingRule', { id: rule.id });
      panel().querySelector('.fs-cf-panel__kind--dataBar').click();
      hot.closePanel();

      expect(plugin().getRules()[0].dataBar).toBeUndefined();
    });

    it('checks the range, and takes the selection', () => {
      const hot = handsontable({ data: data(), sidePanel: true, conditionalFormatting: true });

      hot.selectCell(0, 0);
      hot.openPanel('conditionalFormattingRule', {});

      const range = panel().querySelector('.fs-cf-panel__range');

      range.value = 'nonsense';
      range.dispatchEvent(new Event('input'));
      expect(range.getAttribute('aria-invalid')).toBe('true');
      expect(panel().querySelector('.fs-cf-panel__error').textContent).toContain('Not a range');

      hot.selectCell(1, 1, 2, 2);
      panel().querySelector('.fs-cf-panel__use-selection').click();

      expect(panel().querySelector('.fs-cf-panel__range').value).toBe('B2:C3');
    });

    it('runs the commands of submenus inside submenus (Conditional formatting ▸ Data Bars ▸ a color)', () => {
      const hot = handsontable({ data: data(), contextMenu: true, conditionalFormatting: true });

      hot.selectCell(0, 1, 3, 1);
      contextMenu();
      // The commands are known once the menu has opened; the menu closes again (it is a grid in <body>).
      closeContextMenu();
      hot.getPlugin('contextMenu').executeCommand('conditional_formatting:data_bars:data_bar_0');

      expect(plugin().getRules().map(rule => [rule.range, rule.dataBar])).toEqual([['B1:B4', '#638ec6']]);

      hot.getPlugin('contextMenu').executeCommand('conditional_formatting:clear:clear_sheet');
      expect(plugin().getRules()).toEqual([]);

      hot.getPlugin('contextMenu').executeCommand('conditional_formatting:manage');
      expect(hot.getOpenPanel()).toBe('conditionalFormatting');

      // A submenu with one level still works.
      hot.getPlugin('contextMenu').executeCommand('alignment:right');
      expect(hot.getCellMeta(0, 1).className).toContain('fs-right');
    });

    it('adds data bars, color scales and icon sets to the selection, and clears rules, from the context menu', () => {
      const hot = handsontable({ data: data(), contextMenu: true, conditionalFormatting: true });
      const options = { items: [] };

      plugin().addMenuItems(options);
      const menu = options.items[1].submenu.items;
      const run = (group, index) => menu.find(item => item.key === `conditional_formatting:${group}`)
        .submenu.items[index].callback();

      hot.selectCell(0, 1, 3, 1);
      run('data_bars', 0);
      run('color_scales', 0);
      run('icon_sets', 0);

      expect(plugin().getRules().map(rule => Object.keys(rule).filter(key => key !== 'id' && key !== 'range')))
        .toEqual([['dataBar'], ['colorScale'], ['iconSet']]);

      run('clear', 1);
      expect(plugin().getRules()).toEqual([]);

      menu.find(item => item.key === 'conditional_formatting:highlight').submenu.items[0].callback();
      expect(hot.getOpenPanel()).toBe('conditionalFormattingRule');
    });
  });
});
