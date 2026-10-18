import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const PEOPLE = ['Ana', 'Ben', 'Cleo', 'Dan'];
const STATUSES = ['Not started', 'In progress', 'Blocked', 'Done'];

// [task, owner, status, start, due, progress, issue number]; a row with only a task is a phase.
const ROWS = [
  ['Planning'],
  ['Collect the requirements', 'Ana', 'Done', '2026-02-02', '2026-02-06', 1, 101],
  ['Write the plan', 'Ben', 'Done', '2026-02-09', '2026-02-13', 1, 102],
  ['Build'],
  ['Data model', 'Cleo', 'In progress', '2026-02-16', '2026-03-06', 0.6, 103],
  ['Screens', 'Dan', 'In progress', '2026-02-23', '2026-03-13', 0.35, 104],
  ['Import from Excel', 'Cleo', 'Blocked', '2026-03-02', '2026-03-20', 0.1, 105],
  ['Launch'],
  ['Testing', 'Ben', 'Not started', '2026-03-23', '2026-04-03', 0, 106],
  ['Release', 'Ana', 'Not started', '2026-04-06', '2026-04-07', 0, 107],
];

export default function createGrid(container) {
  const phases = ROWS.flatMap((row, index) => (row.length === 1 ? [index] : []));

  return new FreeSheet(container, {
    data: ROWS.map(([task, owner = '', status = '', start = '', due = '', progress = '', issue]) =>
      [task, owner, status, start, due, progress, issue ? `#${issue}` : '']),
    colHeaders: ['Task', 'Owner', 'Status', 'Start', 'Due', 'Progress', 'Issue'],
    rowHeaders: true,
    colWidths: [190, 80, 110, 100, 100, 90, 70],
    columns: [
      {},
      { validation: { type: 'list', source: PEOPLE } },
      { validation: { type: 'list', source: STATUSES } },
      { type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
      { type: 'date', dateFormat: 'YYYY-MM-DD', correctFormat: true },
      {
        type: 'numeric',
        numericFormat: { pattern: '0%' },
        validation: { type: 'number', operator: 'between', value: 0, value2: 1, message: 'From 0 % to 100 %' },
      },
      {},
    ],
    cell: [
      // Phase rows: bold, and only their name can change.
      ...phases.flatMap(row => [0, 1, 2, 3, 4, 5, 6].map(col => ({
        row, col, style: { fontWeight: 'bold' }, readOnly: col > 0, validation: null,
      }))),
      // Each task links to its issue.
      ...ROWS.flatMap((row, index) => (row[6] ? [{ row: index, col: 6, link: `https://example.com/issues/${row[6]}` }] : [])),
    ],
    // Each phase's tasks are a group: collapse a phase with its − button.
    rowGroups: { groups: phases.map((row, index) => ({ from: row + 1, to: (phases[index + 1] ?? ROWS.length) - 1 })) },
    conditionalFormatting: [
      { range: 'C1:C10', when: 'eq', value: 'Blocked', style: { background: '#f8d7da', color: '#842029' } },
      { range: 'C1:C10', when: 'eq', value: 'Done', style: { color: '#1a7f37' } },
      { range: 'F1:F10', dataBar: '#63be7b' },
    ],
    contextMenu: ['row_above', 'row_below', 'remove_row', '---------', 'undo', 'redo', '---------', 'link',
      'show_changes', 'data_validation'],
    formattingBar: true,
    changeHistory: { user: 'You' },
    sidePanel: true,
    filters: true,
    dropdownMenu: true,
    findAndReplace: true,
    statusBar: true,
  });
}
