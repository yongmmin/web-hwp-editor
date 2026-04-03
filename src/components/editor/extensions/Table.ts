import { Node, mergeAttributes } from '@tiptap/core';

export const Table = Node.create({
  name: 'table',
  group: 'block',
  content: 'tableRow+',
  isolating: true,

  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
      cellspacing: { default: null },
      'data-hwp-col-widths': {
        default: null,
        parseHTML: (element) => element.getAttribute('data-hwp-col-widths'),
        renderHTML: (attributes) => {
          const value = attributes['data-hwp-col-widths'];
          return value ? { 'data-hwp-col-widths': value } : {};
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'table',
        contentElement: 'tbody',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const colgroup = buildColgroupSpec(HTMLAttributes['data-hwp-col-widths']);
    const attrs = mergeAttributes(HTMLAttributes);
    if (colgroup) {
      return ['table', attrs, colgroup, ['tbody', 0]];
    }
    return ['table', attrs, ['tbody', 0]];
  },
});

export const TableRow = Node.create({
  name: 'tableRow',
  content: '(tableCell | tableHeader)+',

  addAttributes() {
    return {
      class: { default: null },
      style: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'tr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['tr', mergeAttributes(HTMLAttributes), 0];
  },
});

export const TableHeader = Node.create({
  name: 'tableHeader',
  content: 'block*',
  isolating: true,

  addAttributes() {
    return {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      class: { default: null },
      style: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'th',
        getAttrs: (element) => {
          const th = element as HTMLTableCellElement;
          return {
            colspan: th.colSpan || 1,
            rowspan: th.rowSpan || 1,
            class: th.getAttribute('class'),
            style: th.getAttribute('style'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { colspan, rowspan, ...rest } = HTMLAttributes;
    const attrs = {
      ...rest,
      ...(colspan > 1 ? { colspan } : {}),
      ...(rowspan > 1 ? { rowspan } : {}),
    };

    return ['th', mergeAttributes(attrs), 0];
  },
});

export const TableCell = Node.create({
  name: 'tableCell',
  content: 'block*',
  isolating: true,

  addAttributes() {
    return {
      colspan: { default: 1 },
      rowspan: { default: 1 },
      class: { default: null },
      style: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'td',
        getAttrs: (element) => {
          const td = element as HTMLTableCellElement;
          return {
            colspan: td.colSpan || 1,
            rowspan: td.rowSpan || 1,
            class: td.getAttribute('class'),
            style: td.getAttribute('style'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { colspan, rowspan, ...rest } = HTMLAttributes;
    const attrs = {
      ...rest,
      ...(colspan > 1 ? { colspan } : {}),
      ...(rowspan > 1 ? { rowspan } : {}),
    };

    return ['td', mergeAttributes(attrs), 0];
  },
});

function buildColgroupSpec(rawWidths: unknown) {
  if (typeof rawWidths !== 'string' || rawWidths.trim().length === 0) return null;

  const widths = rawWidths
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (widths.length === 0) return null;

  return [
    'colgroup',
    ...widths.map((width) => ['col', { style: `width:${Number(width.toFixed(2))}pt` }]),
  ];
}
