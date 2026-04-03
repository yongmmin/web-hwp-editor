# OLLAMA 연동 가이드

## 개요

로컬에서 실행되는 OLLAMA 서버의 REST API를 통해 한국어 유의어/동의어 추천 기능을 제공한다.

---

## API 엔드포인트

| 메서드 | 경로 | 용도 | 사용 위치 |
|--------|------|------|----------|
| GET | `/api/tags` | 연결 확인 + 모델 목록 | `useOllama` 훅 초기화 |
| POST | `/api/generate` | 텍스트 생성 (유의어 추천) | `ollamaClient.getSuggestions()` |

Base URL: `http://localhost:11434`

---

## 연결 흐름

```
앱 로드
  → useOllama() 훅 마운트
  → GET /api/tags (3초 타임아웃)
  → 성공: connected=true, 모델 목록 저장
  → 실패: connected=false, Header에 "OLLAMA 미연결" 표시
```

### CORS 설정

- OLLAMA 0.1.29+ 는 localhost 요청에 대해 CORS 기본 허용
- 이전 버전 또는 커스텀 설정 시: `OLLAMA_ORIGINS=* ollama serve`

---

## 유의어 추천 요청

### Request

```typescript
POST /api/generate
{
  "model": "사용자 선택 모델",
  "prompt": "프롬프트 (아래 참조)",
  "stream": false,
  "options": {
    "temperature": 0.7
  }
}
```

### 프롬프트 구조 (`prompts.ts`)

```
당신은 한국어 문서 편집 도우미입니다.

문맥: "${surroundingText}"

위 문맥에서 "${selectedWord}"의 대체 표현을 5개 제안하세요.
각 대체어에 대해 간략한 의미 설명도 함께 제공하세요.

반드시 아래 JSON 형식으로만 답변하세요:
[
  {"word": "대체어1", "meaning": "의미 설명1"},
  ...
]
```

### 문맥 추출

`getSurroundingText()` (`utils/korean.ts`):
- 선택된 단어를 중심으로 앞뒤 100자 추출
- 앞뒤 잘린 경우 `...` 접두/접미사 추가
- LLM이 문맥을 이해하고 적절한 대체어를 제안하도록 유도

### Response 파싱

```typescript
// 응답에서 JSON 배열 추출
const jsonMatch = text.match(/\[[\s\S]*\]/);
const parsed = JSON.parse(jsonMatch[0]);
// → WordSuggestion[] 타입으로 변환
```

LLM 응답이 불완전한 JSON이거나 추가 텍스트를 포함할 수 있으므로, 정규식으로 배열 부분만 추출.

---

## 모델 선택

- 앱 로드 시 `/api/tags`로 설치된 모델 목록 조회
- Header 드롭다운에서 사용자가 선택
- 선택한 모델은 `localStorage`에 저장 (`docs-editor-ollama-model`)
- 다음 세션에서 자동 복원
- 모델이 없으면 자동으로 첫 번째 모델 선택

### 추천 모델

한국어 지원이 좋은 모델:
- `llama3` — 다국어 지원, 균형 잡힌 성능
- `gemma2` — 한국어 이해력 양호
- `qwen2` — 중/한/일 지원 강점
- `mistral` — 가벼운 모델, 빠른 응답

---

## 에러 처리

| 상황 | 동작 |
|------|------|
| OLLAMA 미실행 | Header에 빨간 아이콘 + "OLLAMA 미연결" |
| 모델 없음 | Header에 "모델 없음" |
| 추천 요청 실패 | SuggestionPanel에 에러 메시지 표시 |
| 빈 응답 / 파싱 실패 | "추천 결과가 없습니다" 안내 |
| 요청 중 | SuggestionPanel에 스피너 표시 |

---

## 시퀀스 다이어그램

```
사용자          에디터           useWordSuggestion    ollamaClient      OLLAMA
  │               │                    │                  │               │
  │─ 단어 선택 ──→│                    │                  │               │
  │─ Ctrl+Space ─→│                    │                  │               │
  │               │── requestSuggest ─→│                  │               │
  │               │                    │── openPanel() ──→│               │
  │               │                    │                  │               │
  │               │                    │── getSuggestions ───────────────→│
  │               │                    │                  │  POST /api/   │
  │               │                    │                  │  generate     │
  │               │                    │◀── WordSuggestion[] ────────────│
  │               │                    │── setSuggestions()│               │
  │               │                    │                  │               │
  │◀── SuggestionPanel 표시 ──────────│                  │               │
  │               │                    │                  │               │
  │─ 항목 hover ─→│                    │                  │               │
  │◀── 미리보기 ──│                    │                  │               │
  │               │                    │                  │               │
  │─ [적용] ─────→│                    │                  │               │
  │               │── applySuggestion ─→│                 │               │
  │               │◀── insertContent ──│                  │               │
  │◀── 에디터 업데이트 ──────────────────────────────────│               │
```
