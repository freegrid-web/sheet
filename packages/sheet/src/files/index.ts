import { readXlsx, writeXlsx } from './xlsx';
import { parseCsv, toCsv } from './csv';
import { trimEmptyEnd } from './../utils/emptyEnd';
import {
  dateFormatToExcel, dateToSerial, excelToDateFormat, excelToNumberPattern, isDateCode, numberPatternToExcel,
  serialToDate,
} from './formats';
import { formatDate, parseDate } from './../helpers/dateFormat';
import { getTranslator } from './../utils/recordTranslator';
import { insertRows, parseRange, formatRange, removeRows } from './../plugins/conditionalFormatting/ranges';
import { documentGrids, documentRoot, activeGrid } from './../sidePanel/sidePanel';
import type Core from './../core';
import type { Book, BookCell, BookSheet } from './xlsx';
import type { ConditionalRule } from './../plugins/conditionalFormatting/conditionalFormatting';

export type FileFormat = 'xlsx' | 'csv';
export type FileOptions = {
  /** Export: write the column headers as a first row; import: the first row becomes the column headers. */
  headers?: boolean;
  /** CSV: the delimiter (export: `,`; import: guessed). */
  delimiter?: string;
  /** Import: the format, when the source does not say (`'csv'` for text). */
  format?: FileFormat;
};

type Meta = Record<string, unknown> & { comment?: { value?: string; author?: string }; className?: string };

const ALIGN_CLASSES: Record<string, [string, string]> = {
  'fs-left': ['horizontal', 'left'], 'fs-center': ['horizontal', 'center'], 'fs-right': ['horizontal', 'right'],
  'fs-justify': ['horizontal', 'justify'], 'fs-top': ['vertical', 'top'], 'fs-middle': ['vertical', 'middle'],
  'fs-bottom': ['vertical', 'bottom'],
};

/**
 * Runs `read` with every row and column visible (hidden ones too), giving it the ordered row and column of physical
 * ones, so values and meta of hidden cells can be read.
 */
const readAll = <T>(grid: Core, read: (ordered: (row: number, column: number) => [number, number]) => T): T => {
  const translator = getTranslator(grid);
  const { rows, columns } = translator;

  translator.rows = null;
  translator.columns = null;
  try {
    return read((row, column) => [grid.hasHook('unmodifyRow') ? grid.runHooks('unmodifyRow', row) : row,
      grid.hasHook('unmodifyCol') ? grid.runHooks('unmodifyCol', column) : column]);
  } finally {
    translator.rows = rows;
    translator.columns = columns;
  }
};

const plugin = (grid: Core, name: string): Record<string, unknown> | null => {
  const instance = grid.getPlugin(name as 'search') as unknown as Record<string, unknown> | undefined;

  return instance && instance.enabled ? instance : null;
};

/** A cell of a grid as a cell of the workbook. */
const bookCell = (source: unknown, shown: unknown, meta: Meta): BookCell | null => {
  const cell: BookCell = {};
  const type = meta.type as string | undefined;

  if (typeof source === 'string' && source.charAt(0) === '=') {
    cell.formula = source;
    // Without a formula engine the cell shows its formula: no result to write.
    if (shown === source) {
      // Nothing.
    } else if (typeof shown === 'string' && /^#[A-Z/0!?]+[!?A-Z]*$/.test(shown)) {
      cell.error = shown;
    } else {
      cell.value = shown as BookCell['value'];
    }
  } else if ((type === 'date' || type === 'time') && typeof source === 'string' && source !== '') {
    const format = String((type === 'date' ? meta.dateFormat : meta.timeFormat) || (type === 'date' ? 'DD/MM/YYYY' :
      'h:mm:ss a'));
    const date = parseDate(source, format);

    if (date) {
      cell.value = type === 'time' ? dateToSerial(date) % 1 : dateToSerial(date);
      cell.numFmt = dateFormatToExcel(format);
    } else {
      cell.value = source;
    }
  } else if (typeof source === 'number' || typeof source === 'boolean') {
    cell.value = source;
  } else if (source !== null && source !== void 0 && source !== '') {
    cell.value = type === 'numeric' && Number.isFinite(Number(source)) && String(source).trim() !== '' ?
      Number(source) : String(source);
  }
  const pattern = (meta.numericFormat as { pattern?: string } | undefined)?.pattern;

  if (type === 'numeric' && pattern && !cell.numFmt) {
    cell.numFmt = numberPatternToExcel(pattern);
  }
  if (meta.style && typeof meta.style === 'object' && Object.keys(meta.style).length) {
    cell.style = { ...(meta.style as object) };
  }
  if (meta.validation && typeof meta.validation === 'object') {
    cell.validation = meta.validation as BookCell['validation'];
  }
  if (typeof meta.link === 'string' && meta.link) {
    cell.link = meta.link;
  }
  const align: Record<string, string> = {};

  String(meta.className || '').split(/\s+/).forEach((name) => {
    if (ALIGN_CLASSES[name]) {
      align[ALIGN_CLASSES[name][0]] = ALIGN_CLASSES[name][1];
    }
  });
  if (Object.keys(align).length) {
    cell.align = align;
  }

  return Object.keys(cell).length ? cell : null;
};

/** The rules of the grid's columns' `format`, over their whole column. */
const columnRules = (grid: Core): ConditionalRule[] => {
  const columns = grid.getSettings().columns;

  return Array.isArray(columns) ? columns.flatMap((column: { format?: ConditionalRule[] } | null, index: number) =>
    (column && Array.isArray(column.format) ? column.format.map(rule => ({ ...rule,
      range: formatRange({ r1: 0, c1: index, r2: Infinity, c2: index }) })) : [])) : [];
};

/** A grid as a sheet of the workbook. */
const gridToSheet = (grid: Core, name: string, headers: boolean): BookSheet => {
  const translator = getTranslator(grid);
  const rows = translator.rows!.total();
  const columns = translator.columns!.total();
  const sheet: BookSheet = { name, cells: [], columnWidths: [], rowHeights: [], hiddenRows: [], hiddenColumns: [],
    merges: [], frozenRows: Number(grid.getSettings().fixedRowsTop) || 0,
    frozenColumns: Number(grid.getSettings().fixedColumnsLeft) || 0, comments: [], conditionalFormatting: [] };

  readAll(grid, (ordered) => {
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const [orderedRow, orderedColumn] = ordered(row, column);
        const meta = grid.getCellMeta(orderedRow, orderedColumn) as Meta;
        const source = grid.getSourceDataAtCell(row, orderedColumn);
        const cell = bookCell(source, typeof source === 'string' && source.charAt(0) === '=' ?
          grid.getDataAtCell(orderedRow, orderedColumn) : source, meta);

        if (cell) {
          (sheet.cells[row] = sheet.cells[row] || [])[column] = cell;
        }
        if (meta.comment && meta.comment.value) {
          sheet.comments.push({ row, column, text: meta.comment.value,
            ...(meta.comment.author ? { author: meta.comment.author } : {}) });
        }
      }
    }
    for (let column = 0; column < columns; column += 1) {
      sheet.columnWidths[column] = grid.getColWidth(ordered(0, column)[1]) || null;
    }
    for (let row = 0; row < rows; row += 1) {
      const height = grid.getRowHeight(ordered(row, 0)[0]);

      if (height && height !== 23) {
        sheet.rowHeights[row] = height;
      }
    }
  });
  const hiddenRows = plugin(grid, 'hiddenRows');
  const hiddenColumns = plugin(grid, 'hiddenColumns');

  sheet.hiddenRows = hiddenRows ? (hiddenRows.getHidden as () => number[])() : [];
  const rowGroups = plugin(grid, 'rowGroups');
  const groups = rowGroups ? (rowGroups.getSavedGroups as () => NonNullable<BookSheet['rowGroups']>)() : [];

  if (groups.length) {
    sheet.rowGroups = groups;
  }
  const columnOutline = plugin(grid, 'columnOutline');
  const columnGroups = columnOutline ? (columnOutline.getSavedGroups as () => NonNullable<BookSheet['columnGroups']>)() :
    [];

  if (columnGroups.length) {
    sheet.columnGroups = columnGroups;
  }
  sheet.hiddenColumns = hiddenColumns ? (hiddenColumns.getHidden as () => number[])() : [];
  const merge = plugin(grid, 'mergeCells');

  ((merge?.mergedCellsCollection as { mergedCells?: { row: number; col: number; rowspan: number; colspan: number }[] })
    ?.mergedCells || []).forEach(({ row, col, rowspan, colspan }) => {
    const r1 = grid.toPhysicalRow(row);
    const c1 = grid.toPhysicalColumn(col);

    sheet.merges.push({ r1, c1, r2: r1 + rowspan - 1, c2: c1 + colspan - 1 });
  });
  const formatting = plugin(grid, 'conditionalFormatting');

  sheet.conditionalFormatting = [
    ...(formatting ? (formatting.getRules as () => (ConditionalRule & { id?: string })[])() : [])
      .map(({ id: _id, ...rule }) => rule),
    ...columnRules(grid),
  ];
  if (headers) {
    readAll(grid, (ordered) => {
      sheet.cells.unshift(Array.from({ length: columns }, (_, column) => ({
        value: String(grid.getColHeader(ordered(0, column)[1]) ?? ''), style: { fontWeight: 'bold' } })));
    });
    sheet.rowHeights.unshift(void 0);
    sheet.hiddenRows = sheet.hiddenRows.map(row => row + 1);
    sheet.rowGroups = sheet.rowGroups?.map(group => ({ ...group, from: group.from + 1, to: group.to + 1 }));
    sheet.merges = sheet.merges.map(rect => ({ ...rect, r1: rect.r1 + 1, r2: rect.r2 + 1 }));
    sheet.comments = sheet.comments.map(comment => ({ ...comment, row: comment.row + 1 }));
    sheet.conditionalFormatting = sheet.conditionalFormatting.map(rule => ({ ...rule,
      range: (Array.isArray(rule.range) ? rule.range : [rule.range || '']).map((range) => {
        const rect = parseRange(String(range));

        return rect ? formatRange(insertRows(rect, 0, 1)) : String(range);
      }) }));
    sheet.frozenRows = Math.max(1, sheet.frozenRows + 1);
  }

  return sheet;
};

/** The document as a workbook. */
export const documentToBook = (hot: Core, options: FileOptions = {}): Book => {
  const grids = documentGrids(hot);
  const active = activeGrid(hot);

  return {
    sheets: grids.map(({ instance, name }, index) => gridToSheet(instance, name || `Sheet${index + 1}`,
      !!options.headers)),
    active: Math.max(0, grids.findIndex(({ instance }) => instance === active)),
  };
};

/** A workbook as a saved document (`loadDocument` takes it). */
export const bookToDocument = (book: Book, options: FileOptions = {}): Record<string, unknown> => {
  const sheets = book.sheets.map((sheet, index) => {
    let cells = sheet.cells;
    let { rowHeights, hiddenRows, comments, merges, frozenRows, conditionalFormatting, rowGroups = [] } = sheet;
    let colHeaders: string[] | undefined;

    if (options.headers) {
      colHeaders = (cells[0] || []).map(cell => (cell && cell.value !== null && cell.value !== void 0 ?
        String(cell.value) : ''));
      cells = cells.slice(1);
      rowHeights = rowHeights.slice(1);
      hiddenRows = hiddenRows.filter(row => row > 0).map(row => row - 1);
      rowGroups = rowGroups.filter(group => group.from > 0).map(group => ({ ...group, from: group.from - 1,
        to: group.to - 1 }));
      comments = comments.filter(comment => comment.row > 0).map(comment => ({ ...comment, row: comment.row - 1 }));
      merges = merges.filter(rect => rect.r1 > 0).map(rect => ({ ...rect, r1: rect.r1 - 1, r2: rect.r2 - 1 }));
      frozenRows = Math.max(0, frozenRows - 1);
      conditionalFormatting = conditionalFormatting.map(rule => ({ ...rule,
        range: (Array.isArray(rule.range) ? rule.range : [rule.range || '']).map((range) => {
          const rect = parseRange(String(range));
          const moved = rect && removeRows(rect, [0]);

          return moved ? formatRange(moved) : '';
        }).filter(Boolean) })).filter(rule => (rule.range as string[]).length);
    }
    const width = Math.max(0, ...cells.map(row => (row ? row.length : 0)), colHeaders?.length || 0);
    const data: unknown[][] = [];
    const cellMeta: Record<string, unknown>[] = [];

    for (let row = 0; row < cells.length; row += 1) {
      data[row] = [];
      for (let column = 0; column < width; column += 1) {
        const cell = cells[row]?.[column];
        let value: unknown = null;
        const meta: Record<string, unknown> = {};

        if (cell) {
          value = cell.formula || cell.error || cell.value;
          if (cell.numFmt && typeof cell.value === 'number' && !cell.formula && isDateCode(cell.numFmt)) {
            const { kind, format } = excelToDateFormat(cell.numFmt);

            value = formatDate(serialToDate(cell.value), format);
            if (kind === 'date') {
              Object.assign(meta, { type: 'date', dateFormat: format });
            } else if (kind === 'time') {
              Object.assign(meta, { type: 'time', timeFormat: format });
            }
          } else if (cell.numFmt) {
            const pattern = excelToNumberPattern(cell.numFmt);

            if (pattern) {
              Object.assign(meta, { type: 'numeric', numericFormat: { pattern } });
            }
          }
          if (cell.style) {
            meta.style = cell.style;
          }
          if (cell.validation) {
            meta.validation = cell.validation;
          }
          if (cell.link) {
            meta.link = cell.link;
          }
          const classes = [cell.align?.horizontal && `fs-${cell.align.horizontal}`,
            cell.align?.vertical && `fs-${cell.align.vertical}`].filter(Boolean);

          if (classes.length) {
            meta.className = classes.join(' ');
          }
        }
        data[row][column] = value ?? null;
        if (Object.keys(meta).length) {
          cellMeta.push({ row, col: column, ...meta });
        }
      }
    }
    comments.forEach((comment) => {
      const existing = cellMeta.find(item => item.row === comment.row && item.col === comment.column);
      const value = { value: comment.text, ...(comment.author ? { author: comment.author } : {}) };

      if (existing) {
        existing.comment = value;
      } else {
        cellMeta.push({ row: comment.row, col: comment.column, comment: value });
      }
    });

    return {
      id: `sheet${index + 1}`,
      name: sheet.name,
      data: data.length ? data : [[null]],
      ...(sheet.columnWidths.some(Boolean) ? { colWidths: Array.from({ length: width }, (_, column) =>
        sheet.columnWidths[column] || null) } : {}),
      ...(rowHeights.some(Boolean) ? { rowHeights: Array.from({ length: data.length }, (_, row) =>
        rowHeights[row] || null) } : {}),
      ...(merges.length ? { mergeCells: merges.map(rect => ({ row: rect.r1, col: rect.c1,
        rowspan: rect.r2 - rect.r1 + 1, colspan: rect.c2 - rect.c1 + 1 })) } : {}),
      ...(hiddenRows.length ? { hiddenRows } : {}),
      ...(rowGroups.length ? { rowGroups } : {}),
      ...(sheet.columnGroups?.length ? { columnOutline: sheet.columnGroups } : {}),
      ...(sheet.hiddenColumns.length ? { hiddenColumns: sheet.hiddenColumns } : {}),
      ...(conditionalFormatting.length ? { conditionalFormatting } : {}),
      ...(frozenRows ? { fixedRowsTop: frozenRows } : {}),
      ...(sheet.frozenColumns ? { fixedColumnsLeft: sheet.frozenColumns } : {}),
      ...(colHeaders ? { colHeaders } : {}),
      ...(cellMeta.length ? { cell: cellMeta } : {}),
    };
  });

  return { version: 1, activeSheet: `sheet${book.active + 1}`, sheets };
};

/** The active sheet's values (formula results) as rows, for CSV. */
const csvRows = (grid: Core, headers: boolean): unknown[][] => {
  // fillContainer's empty rows and columns at the end are not written.
  const rows = grid.getSettings().fillContainer ? trimEmptyEnd(grid.getData() as unknown[][]) :
    grid.getData() as unknown[][];

  return headers ? [Array.from({ length: grid.countCols() }, (_, column) => grid.getColHeader(column)), ...rows] : rows;
};

/** The document (xlsx) or the active sheet (csv) as a file. */
export const exportFile = async(hot: Core, format: FileFormat = 'xlsx', options: FileOptions = {}): Promise<Blob> => {
  const root = documentRoot(hot);
  let blob: Blob;

  if (format === 'csv') {
    blob = new Blob([`\ufeff${toCsv(csvRows(activeGrid(root), !!options.headers), options.delimiter || ',')}`],
      { type: 'text/csv;charset=utf-8' });
  } else if (format === 'xlsx') {
    blob = new Blob([await writeXlsx(documentToBook(root, options)) as BlobPart],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  } else {
    throw new Error(`Unknown file format: ${String(format)}. Use 'xlsx' or 'csv'.`);
  }
  root.runHooks('afterExportFile', format, blob);

  return blob;
};

/** Saves the document (xlsx) or the active sheet (csv) as a file in the browser. */
export const downloadFile = async(hot: Core, format: FileFormat = 'xlsx', filename?: string,
  options: FileOptions = {}): Promise<void> => {
  const blob = await exportFile(hot, format, options);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename || `${documentGrids(hot)[0]?.name || 'sheet'}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const toBytes = async(source: Blob | ArrayBuffer | Uint8Array): Promise<Uint8Array> => {
  if (source instanceof Uint8Array) {
    return source;
  }
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  }

  return new Uint8Array(await new Response(source).arrayBuffer());
};

/** Opens a file: an .xlsx replaces the document; CSV text replaces the active sheet's data. */
export const importFile = async(hot: Core, source: Blob | ArrayBuffer | Uint8Array | string,
  options: FileOptions = {}): Promise<void> => {
  const root = documentRoot(hot);
  const name = typeof source === 'object' && source && 'name' in source ? String((source as File).name) : '';
  const format: FileFormat = options.format || (typeof source === 'string' || /\.(csv|txt)$/i.test(name) ||
    (source instanceof Blob && /csv|text/.test(source.type)) ? 'csv' : 'xlsx');

  if (root.runHooks('beforeImportFile', format, source) === false) {
    return;
  }
  // The loading state while the file is read (unless one is shown already).
  const showsLoading = !root.isLoading();

  if (showsLoading) {
    root.setLoading(true);
  }
  try {
    await readInto(root, source, format, options);
  } finally {
    if (showsLoading) {
      root.setLoading(false);
    }
  }
  root.runHooks('afterImportFile', format);
};

/** Reads a file into the document (xlsx) or the active sheet (csv). */
const readInto = async(root: Core, source: Blob | ArrayBuffer | Uint8Array | string, format: FileFormat,
  options: FileOptions): Promise<void> => {
  if (format === 'csv') {
    const text = typeof source === 'string' ? source : new TextDecoder().decode(await toBytes(source));
    const rows: unknown[][] = parseCsv(text, options.delimiter).map(row => row.map(value =>
      (value.trim() !== '' && Number.isFinite(Number(value)) && !/^0\d/.test(value.trim()) ? Number(value) : value)));
    const grid = activeGrid(root);

    if (options.headers) {
      const [first = [], ...rest] = rows;

      grid.updateSettings({ colHeaders: first.map(String), data: rest });
    } else {
      grid.loadData(rows);
    }
  } else {
    const book = await readXlsx(await toBytes(source as Blob | ArrayBuffer | Uint8Array));

    root.loadDocument(bookToDocument(book, options));
  }
};
