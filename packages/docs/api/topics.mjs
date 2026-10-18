// Topics of the API reference. Every method, event and setting belongs to the first topic whose `methods`, `events`
// or `settings` list names it, or whose `match` pattern fits its name. Guide pages name topics in their frontmatter
// (`api: [Data]`) to list them in the right-hand column.

// Settings and events of features FreeSheet does not have (yet): the code still knows their names, the reference does
// not list them. See the roadmap.
export const UNAVAILABLE = new Set([
  'licenseKey', 'columnSummary', 'ganttChart', 'headerTooltips', 'trimRows', 'multiColumnSorting',
  'afterDropdownMenuDefaultOptions', 'hiddenRow', 'hiddenColumn', 'afterTrimRow', 'afterUntrimRow', 'skipLengthCache',
]);

export const TOPICS = [
  {
    name: 'Lifecycle',
    description: 'Creating, configuring and destroying a grid.',
    methods: ['updateSettings', 'getSettings', 'destroy', 'getInstance', 'getPlugin'],
    events: ['construct', 'init', 'beforeInit', 'afterInit', 'afterDestroy', 'afterUpdateSettings',
      'afterPluginsInitialized'],
    settings: ['debug'],
  },
  {
    name: 'Data',
    description: 'Reading, writing and loading data.',
    methods: ['populateFromArray', 'spliceCol', 'spliceRow', 'loadData', 'getCopyableText', 'getCopyableData',
      'getSchema', 'getValue', 'clear', 'colToProp', 'propToCol', 'isEmptyRow', 'isEmptyCol', 'countEmptyRows',
      'countEmptyCols', 'emptySelectedCells'],
    events: ['afterChange', 'beforeChange', 'afterLoadData', 'afterSetDataAtCell', 'afterSetDataAtRowProp',
      'modifyData', 'modifyRowData', 'afterChangesObserved'],
    settings: ['data', 'dataSchema', 'startRows', 'startCols', 'minRows', 'minCols', 'maxRows', 'maxCols',
      'minSpareRows', 'minSpareCols', 'observeChanges', 'trimWhitespace', 'isEmptyRow', 'isEmptyCol',
      'formulas', 'formulaBar'],
    match: /^(set|get)(Source)?Data|^getDataAt|^getDataType/,
  },
  {
    name: 'Selection',
    description: 'Selecting cells, rows and columns, and moving the selection with the keyboard.',
    methods: ['listen', 'unlisten', 'isListening'],
    events: ['afterListen', 'afterUnlisten', 'afterDeselect', 'afterDrawSelection', 'beforeDrawBorders'],
    settings: ['selectionMode', 'outsideClickDeselects', 'fragmentSelection', 'disableVisualSelection',
      'currentRowClassName', 'currentColClassName', 'currentHeaderClassName', 'activeHeaderClassName', 'enterMoves',
      'tabMoves', 'autoWrapRow', 'autoWrapCol'],
    match: /select|Selection|SetRange|Transform/i,
  },
  {
    name: 'Editing and validation',
    description: 'Cell editors and validators.',
    methods: ['getActiveEditor', 'destroyEditor', 'getCellEditor', 'getCellValidator'],
    events: ['beforeValidate', 'afterValidate', 'afterBeginEditing'],
    settings: ['editor', 'validator', 'allowInvalid', 'allowEmpty', 'invalidCellClassName', 'readOnly',
      'enterBeginsEditing'],
    match: /^validate/,
  },
  {
    name: 'Cell types and meta',
    description: 'Cell types, renderers, formats and per-cell settings (cell meta).',
    methods: ['getCellRenderer'],
    events: ['beforeRenderer', 'afterRenderer', 'beforeValueRender', 'beforeChangeRender', 'beforeCellAlignment',
      'beforeRemoveCellClassNames'],
    settings: ['type', 'renderer', 'cells', 'cell', 'columns', 'source', 'strict', 'filter', 'sortByRelevance',
      'filteringCaseSensitive', 'trimDropdown', 'visibleRows', 'allowHtml', 'checkedTemplate', 'uncheckedTemplate',
      'label', 'numericFormat', 'dateFormat', 'defaultDate', 'correctFormat', 'selectOptions', 'className',
      'readOnlyCellClassName', 'placeholder', 'placeholderCellClassName', 'noWordWrapClassName', 'wordWrap'],
    match: /CellMeta|CellsMeta|ColumnMeta/,
  },
  {
    name: 'Sheets',
    description: 'Several sheets in one document, with tabs, as in an Excel file.',
    methods: ['addSheet', 'getSheet', 'getSheets', 'getActiveSheet', 'activateSheet', 'renameSheet', 'removeSheet',
      'moveSheet', 'getSheetId', 'getSheetName', 'getDocument', 'loadDocument'],
    events: ['beforeSheetAdd', 'afterSheetAdd', 'beforeSheetActivate', 'afterSheetActivate', 'beforeSheetRename',
      'afterSheetRename', 'beforeSheetRemove', 'afterSheetRemove', 'afterSheetMove'],
    settings: ['sheetId', 'sheetName', 'sheets', 'sheetTabs', 'sheetTabsPosition'],
  },
  {
    name: 'Rows and columns',
    description: 'Counting, inserting, removing and sizing rows and columns; headers; visual and physical indexes.',
    methods: ['alter', 'rowOffset', 'colOffset', 'isColumnModificationAllowed', 'getColWidth', 'getRowHeight'],
    events: ['beforeStretchingColumnWidth', 'afterGetColumnHeaderRenderers', 'afterGetRowHeaderRenderers',
      'beforeHideRows', 'afterHideRows', 'beforeUnhideRows', 'afterUnhideRows', 'beforeHideColumns',
      'afterHideColumns', 'beforeUnhideColumns', 'afterUnhideColumns', 'hiddenRow', 'hiddenColumn'],
    settings: ['rowHeaders', 'colHeaders', 'colWidths', 'rowHeights', 'stretchH', 'fillContainer', 'allowInsertRow',
      'allowInsertColumn', 'allowRemoveRow', 'allowRemoveColumn', 'fixedRowsTop', 'fixedRowsBottom',
      'fixedColumnsLeft', 'rowHeaderWidth', 'columnHeaderHeight', 'bindRowsWithHeaders', 'title', 'hiddenRows',
      'hiddenColumns'],
    match: /^count|Header|^to(Visual|Physical)|^(un)?modify(Row|Col)|(Create|Remove)(Row|Col)$/,
  },
  {
    name: 'Filters and the column menu',
    description: 'Filtering rows by condition and by values, and the column menu in the headers.',
    methods: [],
    events: ['beforeFilter', 'afterFilter', 'beforeDropdownMenuShow', 'afterDropdownMenuShow', 'afterDropdownMenuHide',
      'beforeDropdownMenuSetItems', 'afterDropdownMenuDefaultOptions'],
    settings: ['filters', 'dropdownMenu'],
  },
  {
    name: 'Nested rows',
    description: 'Rows with children (a tree grid): expanding, collapsing, outline numbers.',
    methods: [],
    events: ['beforeRowExpand', 'afterRowExpand', 'beforeRowCollapse', 'afterRowCollapse', 'beforeAddChild',
      'afterAddChild', 'beforeDetachChild', 'afterDetachChild', 'beforeLoadData'],
    settings: ['nestedRows'],
  },
  {
    name: 'Column groups',
    description: 'Header rows with headers over several columns, and groups that collapse.',
    methods: [],
    events: ['beforeColumnCollapse', 'afterColumnCollapse', 'beforeColumnExpand', 'afterColumnExpand'],
    settings: ['nestedHeaders', 'collapsibleColumns'],
  },
  {
    name: 'Row groups',
    description: 'An outline of rows: groups in levels that collapse, as Excel\'s Group.',
    methods: [],
    events: [],
    settings: ['rowGroups'],
  },
  {
    name: 'Column outline',
    description: 'An outline of columns: groups in levels that collapse, as Excel\'s Group for columns.',
    methods: [],
    events: [],
    settings: ['columnOutline'],
  },
  {
    name: 'Conditional formatting',
    description: 'Cells that format themselves from their values: highlights, color scales, data bars, icons.',
    methods: [],
    events: ['afterConditionalFormattingChange'],
    settings: ['conditionalFormatting'],
  },
  {
    name: 'Formatting',
    description: 'Cell styles: fonts, bold, italic, underline, colors, borders and number formats; the formatting bar '
      + 'and Ctrl+B, Ctrl+I, Ctrl+U.',
    methods: ['setCellStyle'],
    events: ['afterSetCellStyle', 'afterSetCellFormat'],
    settings: ['formattingBar', 'customBorders'],
  },
  {
    name: 'Sorting',
    description: 'Sorting by a column: a click on its header, the column menu or the API.',
    methods: [],
    events: [],
    settings: ['columnSorting'],
    match: /Sort/,
  },
  {
    name: 'Comments and merged cells',
    description: 'Notes on cells and cells merged into one.',
    methods: [],
    events: [],
    settings: ['comments', 'commentedCellClassName', 'mergeCells'],
    match: /[Mm]erge|Comment/,
  },
  {
    name: 'Copy, paste and fill',
    description: 'The clipboard (Ctrl+C, Ctrl+X, Ctrl+V and Paste Special) and the fill handle.',
    methods: [],
    events: [],
    settings: ['copyPaste', 'copyable', 'skipColumnOnPaste', 'fillHandle'],
    match: /Cop(y|ied)|Cut|Paste|Autofill/,
  },
  {
    name: 'Status bar',
    description: 'The average, count and sum of the selected cells, below the grid.',
    methods: [],
    events: [],
    settings: ['statusBar'],
  },
  {
    name: 'Find and replace',
    description: 'Ctrl+F and Ctrl+H: a find box that highlights matches and replaces them.',
    methods: [],
    events: [],
    settings: ['findAndReplace'],
  },
  {
    name: 'Data validation',
    description: 'Rules for the values of cells: lists (dropdowns), numbers, dates, text lengths, with messages.',
    methods: [],
    events: [],
    settings: ['dataValidation'],
  },
  {
    name: 'Hyperlinks',
    description: 'Links in cells: the card under a selected link, Ctrl+K to edit, Ctrl+click to open.',
    methods: [],
    events: [],
    settings: ['hyperlinks'],
  },
  {
    name: 'Files',
    description: 'Excel (.xlsx) and CSV files: export, download and import.',
    methods: ['exportFile', 'downloadFile', 'importFile', 'setLoading', 'isLoading'],
    events: ['beforeImportFile', 'afterImportFile', 'afterExportFile'],
    settings: [],
  },
  {
    name: 'Context menu',
    description: 'The right-click menu: built-in entries, entries of your own with icons and shortcuts.',
    methods: [],
    events: ['beforeContextMenuShow', 'afterContextMenuShow', 'afterContextMenuHide'],
    settings: ['contextMenu'],
  },
  {
    name: 'Change history',
    description: 'Show Changes: every edit with its user, time and old and new values, in the Changes panel.',
    methods: [],
    events: ['afterChangeRecorded'],
    settings: ['changeHistory'],
  },
  {
    name: 'Side panel',
    description: 'The panel at the right of the document: comments, conditional formatting rules.',
    methods: ['openPanel', 'closePanel', 'getOpenPanel'],
    events: ['afterPanelOpen', 'afterPanelClose'],
    settings: ['sidePanel'],
  },
  {
    name: 'Rendering and scrolling',
    description: 'Size, rendering, scrolling and DOM access.',
    methods: ['render', 'getCell', 'getCoords', 'scrollViewportTo'],
    events: ['afterRender', 'beforeRender', 'afterScrollHorizontally', 'afterScrollVertically', 'afterMomentumScroll',
      'beforeTouchScroll', 'beforeInitWalkontable', 'modifyGetCellCoords'],
    settings: ['width', 'height', 'renderAllRows', 'viewportRowRenderingOffset', 'viewportColumnRenderingOffset',
      'observeDOMVisibility', 'preventOverflow', 'tableClassName'],
    match: /Viewport/,
  },
  {
    name: 'Mouse and keyboard',
    description: 'Mouse and keyboard events on cells and the document.',
    events: ['beforeKeyDown', 'afterDocumentKeyDown'],
    match: /OnCell/,
  },
  {
    name: 'Hooks API',
    description: 'Adding and removing event listeners (hooks).',
    methods: ['addHook', 'hasHook', 'addHookOnce', 'removeHook', 'runHooks'],
  },
  {
    name: 'Localization',
    description: 'Language of the grid\'s texts.',
    methods: ['getTranslatedPhrase'],
    events: ['beforeLanguageChange', 'afterLanguageChange'],
    settings: ['language'],
  },
  {
    name: 'Plugins',
    description: 'Built-in features you switch on with a setting: context menu, copy and paste, sorting, moving and '
      + 'resizing, merged cells, comments, search, undo and more.',
    settings: ['contextMenu', 'copyPaste', 'copyable', 'skipColumnOnPaste', 'undo', 'columnSorting',
      'manualColumnMove', 'manualColumnResize', 'manualRowMove', 'manualRowResize', 'mergeCells', 'manualColumnFreeze',
      'autoColumnSize', 'autoRowSize', 'search', 'comments', 'commentedCellClassName', 'customBorders',
      'persistentState', 'dragToScroll', 'fillHandle'],
    match: /ContextMenu|Cop(y|ied)|Cut|Paste|Sort|Move|Resize|Undo|Redo|[Mm]erge|Autofill|persistentState/,
  },
];

/**
 * The topic of an entry (`kind` is 'method', 'event' or 'setting'); `Other` when none fits.
 */
export const topicOf = (kind, name) => {
  const list = `${kind === 'method' ? 'methods' : kind === 'event' ? 'events' : 'settings'}`;
  const listed = TOPICS.find(topic => topic[list]?.includes(name));

  return (listed ?? TOPICS.find(topic => topic.match?.test(name)))?.name ?? 'Other';
};
