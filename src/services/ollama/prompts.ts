export function buildRefinementPrompt(selectedText: string, surroundingText: string): string {
  return `당신은 한국어 문서 편집 전문가입니다.

문맥: "${surroundingText}"

위 문맥에서 다음 문장/구절을 더 자연스럽고 명확하게 다듬어 주세요:
"${selectedText}"

3가지 개선된 버전을 제안해 주세요. 원문의 의미를 유지하면서 표현을 개선해야 합니다.

반드시 아래 JSON 형식으로만 답변하세요:
[
  {"text": "개선된 버전1", "note": "개선 포인트 설명1"},
  {"text": "개선된 버전2", "note": "개선 포인트 설명2"},
  {"text": "개선된 버전3", "note": "개선 포인트 설명3"}
]`;
}

export function buildSuggestionPrompt(selectedWord: string, surroundingText: string): string {
  return `당신은 한국어 문서 편집 도우미입니다.

문맥: "${surroundingText}"

위 문맥에서 "${selectedWord}"의 대체 표현을 5개 제안하세요.
각 대체어에 대해 간략한 의미 설명도 함께 제공하세요.

반드시 아래 JSON 형식으로만 답변하세요:
[
  {"word": "대체어1", "meaning": "의미 설명1"},
  {"word": "대체어2", "meaning": "의미 설명2"},
  {"word": "대체어3", "meaning": "의미 설명3"},
  {"word": "대체어4", "meaning": "의미 설명4"},
  {"word": "대체어5", "meaning": "의미 설명5"}
]`;
}
