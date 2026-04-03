import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import type { Node } from '@tiptap/pm/model';

export const findHighlightKey = new PluginKey<FindHighlightState>('findHighlight');

interface FindHighlightState {
  query: string;
  activeIndex: number;
  matches: Array<[number, number]>;
  decorations: DecorationSet;
}

function findMatches(doc: Node, query: string): Array<[number, number]> {
  if (!query) return [];
  const matches: Array<[number, number]> = [];
  const lowerQuery = query.toLowerCase();

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return;
    const text = node.text.toLowerCase();
    let start = 0;
    while (start < text.length) {
      const idx = text.indexOf(lowerQuery, start);
      if (idx === -1) break;
      matches.push([pos + idx, pos + idx + query.length]);
      start = idx + 1;
    }
  });

  return matches;
}

function buildDecorations(
  doc: Node,
  matches: Array<[number, number]>,
  activeIndex: number
): DecorationSet {
  if (matches.length === 0) return DecorationSet.empty;

  const decorations = matches.map((match, i) =>
    Decoration.inline(match[0], match[1], {
      class: i === activeIndex ? 'find-match-active' : 'find-match',
    })
  );

  return DecorationSet.create(doc, decorations);
}

export const FindHighlight = Extension.create({
  name: 'findHighlight',

  addProseMirrorPlugins() {
    return [
      new Plugin<FindHighlightState>({
        key: findHighlightKey,

        state: {
          init() {
            return {
              query: '',
              activeIndex: 0,
              matches: [],
              decorations: DecorationSet.empty,
            };
          },

          apply(tr, prev, _oldState, newState) {
            const meta = tr.getMeta(findHighlightKey) as Partial<FindHighlightState> | undefined;

            if (meta !== undefined) {
              const query = meta.query ?? prev.query;
              const activeIndex = meta.activeIndex ?? prev.activeIndex;
              const matches = findMatches(newState.doc, query);
              const clampedActive = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : 0;
              const decorations = buildDecorations(newState.doc, matches, clampedActive);
              return { query, activeIndex: clampedActive, matches, decorations };
            }

            if (tr.docChanged) {
              const matches = findMatches(newState.doc, prev.query);
              const clampedActive = matches.length > 0 ? Math.min(prev.activeIndex, matches.length - 1) : 0;
              const decorations = buildDecorations(newState.doc, matches, clampedActive);
              return { ...prev, matches, activeIndex: clampedActive, decorations };
            }

            return prev;
          },
        },

        props: {
          decorations(state: EditorState) {
            return findHighlightKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
