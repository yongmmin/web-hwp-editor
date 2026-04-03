# Architecture Overview

## 시스템 구조

```
┌─────────────────────────────────────────────────────┐
│                    AppShell                          │
│  ┌───────────┐ ┌─────────────────┐ ┌──────────────┐│
│  │  Header    │ │                 │ │  Suggestion  ││
│  │  - 파일명  │ │                 │ │  Panel       ││
│  │  - OLLAMA  │ │                 │ │  - 유의어    ││
│  │  - 내보내기│ │                 │ │  - 미리보기  ││
│  └───────────┘ │                 │ │  - 적용/취소 ││
│  ┌────┐┌──────┐│   Editor /      │ │              ││
│  │Side││Editor││   Preview       │ │              ││
│  │bar ││Tool  ││   Split View    │ │              ││
│  │    ││bar   ││                 │ │              ││
│  │문서││서식  ││                 │ │              ││
│  │정보││버튼  ││                 │ │              ││
│  │개요││      ││                 │ │              ││
│  └────┘└──────┘│                 │ └──────────────┘│
│                └─────────────────┘                  │
└─────────────────────────────────────────────────────┘
```

## 레이어 구분

| 레이어 | 경로 | 역할 |
|--------|------|------|
| **UI** | `src/components/` | React 컴포넌트, 사용자 인터랙션 |
| **Hooks** | `src/hooks/` | 비즈니스 로직 캡슐화, 컴포넌트-서비스 연결 |
| **Stores** | `src/stores/` | Zustand 전역 상태 |
| **Services** | `src/services/` | 외부 시스템 통신 (HWP 파싱, OLLAMA API) |
| **Utils** | `src/utils/` | 순수 유틸리티 함수 |
| **Types** | `src/types/` | 공유 타입 정의 |

## 데이터 흐름

```
[파일 드롭]
    │
    ▼
useFileUpload ──→ hwpParser (포맷 감지)
    │                 ├── hwpxParser (ZIP + XML)
    │                 └── hwpLegacyParser (바이너리)
    ▼
documentStore.setDocument(parsedDoc)
    │
    ▼
TipTap Editor ← setContent(html)
    │            ├── table / tableRow / tableCell
    │            ├── imageBlock
    │            └── documentRegion(header/footer)
    │
    ├── [단어 선택 + Ctrl+Space]
    │       │
    │       ▼
    │   useWordSuggestion ──→ ollamaClient.getSuggestions()
    │       │
    │       ▼
    │   suggestionStore ──→ SuggestionPanel
    │       │
    │       ▼
    │   [적용] → editor.insertContent(word)
    │
    ├── [미리보기 토글]
    │       │
    │       ▼
    │   DocumentPreview ← editor.getHTML()
    │
    └── [내보내기]
            │
            ▼
        hwpxExporter ──→ Blob ──→ 다운로드
```

## 컴포넌트 트리

```
App
└── AppShell
    ├── Header
    │   ├── OLLAMA 상태 표시
    │   ├── 모델 선택 드롭다운
    │   ├── 미리보기 토글
    │   ├── 내보내기 버튼
    │   └── 새 파일 버튼
    │
    ├── [view === 'upload']
    │   └── FileUploader
    │
    └── [view === 'editor']
        ├── DocumentEditor
        │   ├── EditorToolbar
        │   ├── FindReplaceBar (조건부)
        │   └── EditorContent (TipTap + custom nodes)
        ├── SuggestionPanel (조건부)
        │   ├── SuggestionItem[]
        │   └── PreviewHighlight
        └── RefinementPanel (조건부)
```

## 상태 관리 구조

### documentStore
- `view`: 현재 화면 (`'upload'` | `'editor'`)
- `document`: 파싱된 문서 데이터 (`ParsedDocument` — `sourceMode` 포함)
- `fileName`: 원본 파일명
- `originalHtml`: 원본 HTML (편집 전 복원용)

> `document.sourceMode`: `'editable'` (기본) | `'hwp-original-readonly'` (HWP 원본 읽기 전용 뷰)

### 파싱 결과 HTML 규칙

- 본문 문단은 `<p>`
- 표는 `<table data-hwp-col-widths="..."><colgroup><col ... /></colgroup><tbody><tr><td>...</td></tr></tbody></table>`
- 이미지는 `<img src="data:...">`
- 머리글/바닥글은 `<section data-doc-region="header|footer">`

### 레이아웃 보존 메모

- `ParsedDocument.pageLayout`은 HWP `PAGE_DEF` 기반 실제 페이지 크기/여백을 담고, `DocumentEditor`가 이를 A4 캔버스 CSS 변수로 주입
- HWP 표는 `pt` 단위 폭과 `data-hwp-col-widths`를 함께 저장하고, 커스텀 TipTap `Table` 노드가 `colgroup`를 다시 렌더해 열 폭 힌트가 손실되지 않게 함
- 비정상 `LIST_HEADER` span/size 값은 파서에서 먼저 정규화하여 editor 단계로 전파되지 않게 함

### suggestionStore
- `isOpen`: 패널 표시 여부
- `selectedWord`: 선택된 단어
- `suggestions[]`: OLLAMA 추천 결과
- `previewWord`: hover/클릭된 미리보기 단어
- `selectionFrom/To`: 에디터 내 선택 범위 (대치용)

## 의존성 방향

```
components → hooks → services
    │          │        │
    └──────────┴────→ stores
                        │
                     types/utils
```

- 컴포넌트는 hooks를 통해 서비스에 접근
- 서비스는 다른 레이어에 의존하지 않음
- stores는 services를 직접 호출하지 않음 (hooks가 중재)
