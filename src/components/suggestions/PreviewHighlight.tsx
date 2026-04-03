import { useSuggestionStore } from '../../stores/suggestionStore';

interface PreviewHighlightProps {
  fullText: string;
}

export function PreviewHighlight({ fullText }: PreviewHighlightProps) {
  const { selectedWord, previewWord, lockedWord } = useSuggestionStore();
  const displayWord = previewWord ?? lockedWord;

  if (!selectedWord || !displayWord) return null;

  const index = fullText.indexOf(selectedWord);
  if (index === -1) return null;

  const contextStart = Math.max(0, index - 30);
  const contextEnd = Math.min(fullText.length, index + selectedWord.length + 30);

  const before = fullText.slice(contextStart, index);
  const after = fullText.slice(index + selectedWord.length, contextEnd);

  return (
    <div className="p-3 bg-gray-50 rounded-lg text-sm">
      <div className="text-xs font-medium text-gray-500 mb-1.5">미리보기</div>
      <p className="text-gray-700 leading-relaxed">
        {contextStart > 0 && '...'}
        {before}
        <span className="suggestion-highlight-preview font-medium">{displayWord}</span>
        {after}
        {contextEnd < fullText.length && '...'}
      </p>
    </div>
  );
}
