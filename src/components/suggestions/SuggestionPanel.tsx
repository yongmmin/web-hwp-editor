import { useCallback } from 'react';
import { X, Loader2, RefreshCw } from 'lucide-react';
import { useSuggestionStore } from '../../stores/suggestionStore';
import { SuggestionItem } from './SuggestionItem';
import { PreviewHighlight } from './PreviewHighlight';

interface SuggestionPanelProps {
  fullText: string;
  onApply: (word: string) => void;
}

export function SuggestionPanel({ fullText, onApply }: SuggestionPanelProps) {
  const {
    isOpen,
    isLoading,
    selectedWord,
    suggestions,
    lockedWord,
    previewWord,
    error,
    lockWord,
    setPreviewWord,
    closePanel,
  } = useSuggestionStore();

  const handleApply = useCallback(() => {
    if (lockedWord) onApply(lockedWord);
  }, [lockedWord, onApply]);

  // hover: 미리보기만. hover-out: locked word로 복귀 (없으면 null)
  const handleHover = useCallback(
    (word: string) => setPreviewWord(word),
    [setPreviewWord]
  );
  const handleLeave = useCallback(
    () => setPreviewWord(lockedWord),
    [setPreviewWord, lockedWord]
  );

  if (!isOpen) return null;

  const activeWord = previewWord ?? lockedWord;

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">단어 추천</h3>
          {selectedWord && (
            <p className="text-xs text-gray-500 mt-0.5">
              선택: <span className="font-medium text-violet-600">{selectedWord}</span>
            </p>
          )}
        </div>
        <button
          onClick={closePanel}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
          title="닫기 (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-3">
        {isLoading && suggestions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">추천 단어를 가져오는 중...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-1">
            <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              유의어
              {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-1 text-violet-400" />}
            </div>
            {suggestions.map((s, i) => (
              <SuggestionItem
                key={i}
                suggestion={s}
                isLocked={lockedWord === s.word}
                isHovered={previewWord === s.word}
                onHover={handleHover}
                onLeave={handleLeave}
                onClick={lockWord}
              />
            ))}
          </div>
        )}
      </div>

      {/* Preview */}
      {activeWord && (
        <div className="p-3 border-t border-gray-200">
          <PreviewHighlight fullText={fullText} />
        </div>
      )}

      {/* Actions — lockedWord가 있을 때만 표시, hover-out해도 유지 */}
      {lockedWord && (
        <div className="flex gap-2 p-3 border-t border-gray-200">
          <button
            onClick={handleApply}
            className="flex-1 px-3 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors"
          >
            적용
          </button>
          <button
            onClick={() => lockWord(null)}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
