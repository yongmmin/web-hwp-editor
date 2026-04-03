import { useState, useCallback } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Sparkles,
  WandSparkles,
  Loader2,
  ArrowLeft,
  Check,
} from 'lucide-react';
import { getSuggestionsStream } from '../../services/ollama/ollamaClient';
import { getSurroundingText } from '../../utils/korean';
import type { WordSuggestion } from '../../types';

type BubbleMode = 'toolbar' | 'synonyms';

interface SelectionBubbleMenuProps {
  editor: Editor;
  ollamaConnected: boolean;
  ollamaModel: string | null;
  onRequestRefinement: () => void;
}

export function SelectionBubbleMenu({
  editor,
  ollamaConnected,
  ollamaModel,
  onRequestRefinement,
}: SelectionBubbleMenuProps) {
  const [mode, setMode] = useState<BubbleMode>('toolbar');
  const [isLoadingSynonyms, setIsLoadingSynonyms] = useState(false);
  const [synonyms, setSynonyms] = useState<WordSuggestion[]>([]);
  const [synonymError, setSynonymError] = useState<string | null>(null);
  const [appliedWord, setAppliedWord] = useState<string | null>(null);

  // Saved selection positions for applying synonym after bubble focus changes
  const [savedFrom, setSavedFrom] = useState<number>(0);
  const [savedTo, setSavedTo] = useState<number>(0);

  const selectedText = editor.state.doc.textBetween(
    editor.state.selection.from,
    editor.state.selection.to,
    ' '
  );
  const isShortSelection = selectedText.trim().split(/\s+/).length <= 3;

  const handleSynonymClick = useCallback(async () => {
    if (!ollamaModel) return;
    const { from, to } = editor.state.selection;
    const word = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!word) return;

    setSavedFrom(from);
    setSavedTo(to);
    setMode('synonyms');
    setIsLoadingSynonyms(true);
    setSynonyms([]);
    setSynonymError(null);
    setAppliedWord(null);

    try {
      const fullText = editor.state.doc.textContent;
      const surrounding = getSurroundingText(fullText, word);
      let count = 0;

      await getSuggestionsStream(ollamaModel, word, surrounding, (s) => {
        setSynonyms((prev) => [...prev, s]);
        count++;
      });

      if (count === 0) setSynonymError('추천 결과가 없습니다.');
    } catch {
      setSynonymError('OLLAMA 요청에 실패했습니다.');
    } finally {
      setIsLoadingSynonyms(false);
    }
  }, [editor, ollamaModel]);

  const handleApplySynonym = useCallback(
    (word: string) => {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: savedFrom, to: savedTo })
        .insertContent(word)
        .run();
      setAppliedWord(word);
      setTimeout(() => {
        setMode('toolbar');
        setSynonyms([]);
        setAppliedWord(null);
      }, 800);
    },
    [editor, savedFrom, savedTo]
  );

  const handleRefinement = useCallback(() => {
    onRequestRefinement();
  }, [onRequestRefinement]);

  const resetToToolbar = useCallback(() => {
    setMode('toolbar');
    setSynonyms([]);
    setSynonymError(null);
    setAppliedWord(null);
  }, []);

  const btnFmt = (active: boolean) =>
    `p-1.5 rounded transition-colors ${
      active ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ state }) => {
        const { from, to } = state.selection;
        return from !== to;
      }}
      className="bubble-menu"
    >
      {mode === 'toolbar' ? (
        <div className="flex items-center gap-0.5 p-1">
          {/* 서식 */}
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            className={btnFmt(editor.isActive('bold'))}
            title="굵게 (Ctrl+B)"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
            className={btnFmt(editor.isActive('italic'))}
            title="기울임 (Ctrl+I)"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleUnderline().run(); }}
            className={btnFmt(editor.isActive('underline'))}
            title="밑줄 (Ctrl+U)"
          >
            <Underline className="w-3.5 h-3.5" />
          </button>
          <button
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleStrike().run(); }}
            className={btnFmt(editor.isActive('strike'))}
            title="취소선"
          >
            <Strikethrough className="w-3.5 h-3.5" />
          </button>

          {ollamaConnected && (
            <>
              <div className="w-px h-4 bg-gray-200 mx-0.5" />

              {/* 유의어 - 짧은 선택에서만 */}
              {isShortSelection && (
                <button
                  onMouseDown={(e) => { e.preventDefault(); handleSynonymClick(); }}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-violet-700 hover:bg-violet-50 transition-colors"
                  title="유의어 추천"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  유의어
                </button>
              )}

              {/* 문장 다듬기 */}
              <button
                onMouseDown={(e) => { e.preventDefault(); handleRefinement(); }}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-emerald-700 hover:bg-emerald-50 transition-colors"
                title="문장 다듬기"
              >
                <WandSparkles className="w-3.5 h-3.5" />
                다듬기
              </button>
            </>
          )}
        </div>
      ) : (
        /* 유의어 모드 */
        <div className="p-2 min-w-[200px] max-w-[280px]">
          <div className="flex items-center gap-1 mb-2">
            <button
              onMouseDown={(e) => { e.preventDefault(); resetToToolbar(); }}
              className="p-0.5 rounded hover:bg-gray-100 text-gray-500"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-xs font-semibold text-gray-700">유의어 추천</span>
          </div>

          {isLoadingSynonyms && (
            <div className="flex items-center gap-2 py-2 text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">가져오는 중...</span>
            </div>
          )}

          {synonymError && (
            <p className="text-xs text-red-500 py-1">{synonymError}</p>
          )}

          {!isLoadingSynonyms && synonyms.length > 0 && (
            <div className="space-y-0.5">
              {synonyms.map((s, i) => (
                <button
                  key={i}
                  onMouseDown={(e) => { e.preventDefault(); handleApplySynonym(s.word); }}
                  className="w-full text-left px-2 py-1.5 rounded hover:bg-violet-50 transition-colors group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-900">{s.word}</span>
                    {appliedWord === s.word ? (
                      <Check className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <span className="text-xs text-gray-400 group-hover:text-violet-500">적용</span>
                    )}
                  </div>
                  {s.meaning && (
                    <div className="text-xs text-gray-400 mt-0.5 truncate">{s.meaning}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </BubbleMenu>
  );
}
