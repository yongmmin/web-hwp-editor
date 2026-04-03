import type { WordSuggestion } from '../../types';

interface SuggestionItemProps {
  suggestion: WordSuggestion;
  isLocked: boolean;
  isHovered: boolean;
  onHover: (word: string) => void;
  onLeave: () => void;
  onClick: (word: string) => void;
}

export function SuggestionItem({
  suggestion,
  isLocked,
  isHovered,
  onHover,
  onLeave,
  onClick,
}: SuggestionItemProps) {
  return (
    <button
      className={`
        w-full text-left px-3 py-2.5 rounded-lg transition-colors border
        ${isLocked
          ? 'bg-violet-50 border-violet-200 ring-1 ring-violet-100'
          : isHovered
          ? 'bg-gray-50 border-gray-200'
          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
        }
      `}
      onMouseEnter={() => onHover(suggestion.word)}
      onMouseLeave={onLeave}
      onClick={() => onClick(suggestion.word)}
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{suggestion.word}</span>
        {isLocked && (
          <span className="text-xs text-violet-500 font-medium">선택됨</span>
        )}
      </div>
      {suggestion.meaning && (
        <div className="text-sm text-gray-500 mt-0.5">{suggestion.meaning}</div>
      )}
    </button>
  );
}
