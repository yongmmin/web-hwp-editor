import { useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useSuggestionStore } from '../stores/suggestionStore';
import { getSuggestionsStream } from '../services/ollama/ollamaClient';
import { getSurroundingText } from '../utils/korean';

export function useWordSuggestion(editor: Editor | null, model: string | null) {
  const { openPanel, addSuggestion, setError, closePanel } = useSuggestionStore();
  const abortRef = useRef<AbortController | null>(null);

  const requestSuggestions = useCallback(async () => {
    if (!editor || !model) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    openPanel(selectedText.trim(), from, to);

    try {
      const fullText = editor.state.doc.textContent;
      const surrounding = getSurroundingText(fullText, selectedText.trim());
      let count = 0;

      await getSuggestionsStream(
        model,
        selectedText.trim(),
        surrounding,
        (suggestion) => {
          addSuggestion(suggestion);
          count++;
        },
        controller.signal
      );

      if (count === 0) {
        setError('추천 결과가 없습니다. 다른 단어를 선택해보세요.');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'OLLAMA 요청에 실패했습니다.';
      setError(message);
    }
  }, [editor, model, openPanel, addSuggestion, setError]);

  const applySuggestion = useCallback(
    (word: string) => {
      if (!editor) return;

      const { selectionFrom, selectionTo } = useSuggestionStore.getState();
      if (selectionFrom === null || selectionTo === null) return;

      editor
        .chain()
        .focus()
        .setTextSelection({ from: selectionFrom, to: selectionTo })
        .insertContent(word)
        .run();

      closePanel();
    },
    [editor, closePanel]
  );

  return { requestSuggestions, applySuggestion };
}
