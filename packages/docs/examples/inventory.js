import FreeSheet from '@freegrid/sheet';
import '@freegrid/sheet/dist/freesheet.full.css';

const CATEGORIES = ['Office', 'Kitchen', 'Cleaning', 'Tech'];
const NAMES = {
  Office: ['Paper A4', 'Pens, blue', 'Stapler', 'Folders', 'Sticky notes', 'Envelopes'],
  Kitchen: ['Coffee beans', 'Tea', 'Sugar', 'Paper cups', 'Milk'],
  Cleaning: ['Soap', 'Paper towels', 'Bin bags', 'Sponges'],
  Tech: ['USB-C cables', 'Mice', 'Keyboards', 'Monitors', 'Headsets'],
};

// The same numbers on every visit: a small seeded random.
let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;

  return seed / 2147483647;
};

export default function createGrid(container) {
  const data = CATEGORIES.flatMap(category => NAMES[category].map((name) => {
    const minimum = Math.round(5 + random() * 20);

    return {
      sku: `${category.slice(0, 3).toUpperCase()}-${Math.round(100 + random() * 899)}`,
      name,
      category,
      stock: Math.round(random() * 60),
      minimum,
      price: Math.round((1 + random() * (category === 'Tech' ? 180 : 15)) * 100) / 100,
      supplier: random() > 0.5 ? 'Nordic Supply' : 'Baltic Goods',
    };
  }));

  return new FreeSheet(container, {
    data,
    columns: [
      { data: 'sku', title: 'SKU', readOnly: true },
      { data: 'name', title: 'Item' },
      { data: 'category', title: 'Category', validation: { type: 'list', source: CATEGORIES } },
      {
        data: 'stock',
        title: 'In stock',
        type: 'numeric',
        validation: { type: 'integer', operator: 'greaterOrEqual', value: 0, message: 'A whole number, 0 or more' },
      },
      { data: 'minimum', title: 'Minimum', type: 'numeric' },
      { data: 'price', title: 'Price', type: 'numeric', numericFormat: { pattern: '0,0.00 $', culture: 'de-DE' } },
      { data: 'supplier', title: 'Supplier' },
    ],
    rowHeaders: true,
    colWidths: [90, 140, 100, 80, 80, 100, 130],
    height: 380,
    fixedColumnsLeft: 2,
    // Items under their minimum: red; out of stock: bold too.
    conditionalFormatting: [
      { range: 'D:D', when: 'eq', value: 0, style: { fontWeight: 'bold', color: '#c00000' }, stopIfTrue: true },
      { range: 'D:D', iconSet: 'trafficLights' },
    ],
    columnSorting: { initialConfig: { column: 3, sortOrder: 'asc' } },
    filters: true,
    dropdownMenu: true,
    findAndReplace: true,
    contextMenu: true,
    statusBar: { items: ['sum', 'average', { item: 'count', label: 'Items' }], format: { maximumFractionDigits: 2 } },
  });
}
