import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';

/**
 * TipTap extension for word suggestion functionality.
 * Highlights the currently selected word and provides
 * integration points for the suggestion system.
 */
export const WordSuggestion = Extension.create({
  name: 'wordSuggestion',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('wordSuggestion'),
        props: {
          decorations() {
            // Decorations for highlighting can be added here
            // when suggestion preview is active
            return null;
          },
        },
      }),
    ];
  },
});
