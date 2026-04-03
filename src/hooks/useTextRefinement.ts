import { useCallback, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { useRefinementStore } from '../stores/refinementStore';
import { refineTextStream } from '../services/ollama/ollamaClient';
import { getSurroundingText } from '../utils/korean';

export function useTextRefinement(editor: Editor | null, model: string | null) {
  const { openPanel, addRefinement, setError, closePanel } = useRefinementStore();
  const abortRef = useRef<AbortController | null>(null);

  const requestRefinement = useCallback(async () => {
    if (!editor || !model) return;

    const { from, to } = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(from, to, ' ');
    if (!selectedText.trim()) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    openPanel(selectedText.trim(), from, to);

    try {
      const fullText = editor.state.doc.textContent;
      const surrounding = getSurroundingText(fullText, selectedText.trim());
      let count = 0;

      await refineTextStream(
        model,
        selectedText.trim(),
        surrounding,
        (refinement) => {
          addRefinement(refinement);
          count++;
        },
        controller.signal
      );

      if (count === 0) {
        setError('개선 결과가 없습니다. 다른 문장을 선택해보세요.');
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      const message = err instanceof Error ? err.message : 'OLLAMA 요청에 실패했습니다.';
      setError(message);
    }
  }, [editor, model, openPanel, addRefinement, setError]);

  const applyRefinement = useCallback(
    (text: string) => {
      if (!editor) return;
      const { selectionFrom, selectionTo } = useRefinementStore.getState();
      if (selectionFrom === null || selectionTo === null) return;

      editor
        .chain()
        .focus()
        .setTextSelection({ from: selectionFrom, to: selectionTo })
        .insertContent(text)
        .run();

      closePanel();
    },
    [editor, closePanel]
  );

  return { requestRefinement, applyRefinement };
}
