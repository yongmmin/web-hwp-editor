import { Node, mergeAttributes } from '@tiptap/core';

function getRegionLabel(kind: string, title?: string | null): string {
  if (title) return title;
  if (kind === 'header') return '머리글';
  if (kind === 'footer') return '바닥글';
  return '문서 영역';
}

export const DocumentRegion = Node.create({
  name: 'documentRegion',
  group: 'block',
  content: 'block*',
  isolating: true,
  defining: true,

  addAttributes() {
    return {
      kind: { default: 'region' },
      title: { default: null },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'section[data-doc-region]',
        contentElement: '.document-region-body',
        getAttrs: (element) => {
          const section = element as HTMLElement;
          return {
            kind: section.getAttribute('data-doc-region') || 'region',
            title: section.getAttribute('data-title'),
          };
        },
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const { kind = 'region', title = null, ...rest } = HTMLAttributes;
    const label = getRegionLabel(String(kind), typeof title === 'string' ? title : null);

    return [
      'section',
      mergeAttributes(rest, {
        'data-doc-region': kind,
        'data-title': label,
        class: `document-region document-region-${kind}`,
      }),
      ['div', { class: 'document-region-label', contenteditable: 'false' }, label],
      ['div', { class: 'document-region-body' }, 0],
    ];
  },
});
