import { useCallback } from 'react';
import { X, Loader2, WandSparkles, ArrowRight, Check } from 'lucide-react';
import { useRefinementStore } from '../../stores/refinementStore';

interface RefinementPanelProps {
  onApply: (text: string) => void;
}

export function RefinementPanel({ onApply }: RefinementPanelProps) {
  const {
    isOpen,
    isLoading,
    originalText,
    refinements,
    previewText,
    error,
    setPreviewText,
    closePanel,
  } = useRefinementStore();

  const handleApply = useCallback(
    (text: string) => {
      onApply(text);
    },
    [onApply]
  );

  if (!isOpen) return null;

  return (
    <div className="w-80 border-l border-gray-200 bg-white flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <WandSparkles className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-semibold text-gray-900">문장 다듬기</h3>
        </div>
        <button
          onClick={closePanel}
          className="p-1 rounded hover:bg-gray-100 text-gray-400"
          title="닫기 (Esc)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Original text */}
      {originalText && (
        <div className="px-3 pt-3 pb-2">
          <p className="text-xs font-medium text-gray-500 mb-1">원본</p>
          <div className="p-2 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-700 leading-relaxed">
            {originalText}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto px-3 pb-3">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mb-2" />
            <p className="text-sm">문장을 다듬는 중...</p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mt-2">
            {error}
          </div>
        )}

        {!isLoading && !error && refinements.length > 0 && (
          <div className="space-y-2 mt-1">
            <p className="text-xs font-medium text-gray-500">개선 제안</p>
            {refinements.map((r, i) => {
              const isSelected = previewText === r.text;
              return (
                <div
                  key={i}
                  onClick={() => setPreviewText(isSelected ? null : r.text)}
                  className={`
                    p-2.5 rounded-lg border cursor-pointer transition-all
                    ${isSelected
                      ? 'border-emerald-300 bg-emerald-50 ring-1 ring-emerald-200'
                      : 'border-gray-200 hover:border-emerald-200 hover:bg-gray-50'
                    }
                  `}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-gray-800 leading-relaxed flex-1">{r.text}</p>
                    {isSelected && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
                  </div>
                  {r.note && (
                    <p className="text-xs text-gray-400 mt-1.5 border-t border-gray-100 pt-1.5">
                      {r.note}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview diff */}
      {previewText && originalText && (
        <div className="px-3 pb-2 border-t border-gray-200 pt-2">
          <p className="text-xs font-medium text-gray-500 mb-1.5">미리보기</p>
          <div className="flex items-start gap-2 text-xs">
            <div className="flex-1 p-2 bg-red-50 rounded border border-red-100 text-red-700 line-through leading-relaxed">
              {originalText}
            </div>
            <ArrowRight className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-2" />
            <div className="flex-1 p-2 bg-emerald-50 rounded border border-emerald-100 text-emerald-800 leading-relaxed">
              {previewText}
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {previewText && (
        <div className="flex gap-2 p-3 border-t border-gray-200">
          <button
            onClick={() => handleApply(previewText)}
            className="flex-1 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
          >
            적용
          </button>
          <button
            onClick={closePanel}
            className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            취소
          </button>
        </div>
      )}
    </div>
  );
}
