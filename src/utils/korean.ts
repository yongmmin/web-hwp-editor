/**
 * Extract surrounding text context around a position in text.
 */
export function getSurroundingText(
  fullText: string,
  selectedWord: string,
  maxContext: number = 100
): string {
  const index = fullText.indexOf(selectedWord);
  if (index === -1) return fullText.slice(0, maxContext * 2);

  const start = Math.max(0, index - maxContext);
  const end = Math.min(fullText.length, index + selectedWord.length + maxContext);

  let result = fullText.slice(start, end);
  if (start > 0) result = '...' + result;
  if (end < fullText.length) result = result + '...';

  return result;
}

/**
 * Check if a string contains Korean characters.
 */
export function containsKorean(text: string): boolean {
  return /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/.test(text);
}
