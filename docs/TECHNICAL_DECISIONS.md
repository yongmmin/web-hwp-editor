# Technical Decisions Record (ADR)

## ADR-001: 프레임워크 — React + TypeScript + Vite

**결정**: React 19 + TypeScript + Vite 5

**이유**:
- Vite의 빠른 HMR으로 개발 생산성 확보
- TypeScript로 HWP 파싱/OLLAMA 응답 등 복잡한 데이터 구조의 타입 안전성 보장
- React 생태계의 TipTap, react-dropzone 등 풍부한 라이브러리 활용

**대안 검토**:
- Next.js: SSR 불필요 (프론트엔드 전용 앱), 오버킬
- Svelte: TipTap 공식 지원이 React 중심

---

## ADR-002: 에디터 — TipTap v3

**결정**: TipTap (ProseMirror 기반 헤드리스 에디터)

**이유**:
- 헤드리스 → UI 완전 커스텀 가능
- Extension 시스템으로 단어 추천 기능 통합 용이
- ProseMirror의 Transaction 기반 편집 → 실행취소/다시실행 자동 지원
- 한국어 IME 조합 입력 처리 안정적

**주의사항**:
- `setContent()`는 편집 히스토리를 초기화함 → 문서 로드 시에만 사용
- Selection 범위(`from`, `to`)를 저장해 대치 시 정확한 위치에 삽입

---

## ADR-003: 스타일링 — TailwindCSS v4

**결정**: TailwindCSS v4 + `@tailwindcss/vite` 플러그인

**이유**:
- v4는 CSS-first 설정 (`@import "tailwindcss"`)으로 `tailwind.config` 불필요
- Vite 플러그인으로 빌드 파이프라인 단순화
- 유틸리티 기반으로 빠른 UI 프로토타이핑

**설정**:
- `src/index.css`에 `@import "tailwindcss"` + 커스텀 에디터 스타일
- TipTap 에디터 내부 스타일은 `.tiptap` 클래스로 직접 정의

---

## ADR-004: 상태관리 — Zustand

**결정**: Zustand

**이유**:
- 보일러플레이트 최소화 (Redux 대비)
- TypeScript 친화적 (`create<State>()`)
- 컴포넌트 외부에서 `getState()` 호출 가능 → hooks에서 store 상태 직접 읽기
- 번들 크기 ~1KB

**Store 분리 기준**:
- `documentStore`: 문서 생명주기 (업로드 → 편집 → 내보내기)
- `suggestionStore`: 추천 패널 UI 상태 (열림/닫힘, 로딩, 결과)

---

## ADR-005: HWP 파싱 전략

**결정**: HWPX는 JSZip + fast-xml-parser(`preserveOrder`) 직접 파싱, HWP는 `cfb` + `pako` 기반 직접 바이너리 파싱

**이유**:
- HWPX는 공개 표준(ZIP+XML) → 직접 파싱 가능하고 구조 보존이 쉬움
- `preserveOrder` 모드로 문단/표/이미지/머리글/바닥글의 순서를 유지 가능
- HWP 바이너리는 `cfb` + `pako`로 표/이미지/기본 서식을 직접 복원 가능
- 내보내기는 HWPX만 지원 (HWP 바이너리 쓰기는 비현실적)

**보완 결정**:
- 에디터 스키마에 커스텀 TipTap 노드(`table`, `imageBlock`, `documentRegion`)를 추가해 업로드된 구조가 `setContent()` 과정에서 손실되지 않게 함
- 특히 표는 `data-hwp-col-widths`를 별도 속성으로 보존하고 `colgroup`를 재생성하도록 하여, TipTap 파싱 과정에서 열 폭 힌트가 사라져 레이아웃이 무너지는 문제를 방지함

**상세**: [HWP_PARSING.md](./HWP_PARSING.md) 참조

---

## ADR-008: 레이아웃 보존 개선 방향

**결정**: 외부 렌더러(변환기)나 별도 원본 뷰어를 도입하지 않고, 현재 웹 에디터 아키텍처에서 파서를 고도화해 레이아웃 보존율을 개선한다.

**이유**:
- 사용자가 원하는 편집 흐름은 단일 에디터 내 즉시 편집
- 외부 변환 기반 접근은 편집 연속성과 구현 복잡도 측면에서 현재 목표와 불일치
- 현재 파서 개선만으로도 품질 개선 여지가 큼 (표/이미지/페이지 분리)

**범위**:
- 우선순위: `hwpLegacyParser.ts`의 표/이미지/페이지 레이아웃 보정
- 이후: `hwpxParser.ts`의 section/page/배치 속성 보강

**상세**: [LAYOUT_PRESERVATION_STRATEGY.md](./LAYOUT_PRESERVATION_STRATEGY.md) 참조

---

## ADR-006: OLLAMA 연동 방식

**결정**: `fetch`로 OLLAMA REST API 직접 호출 (별도 SDK 없음)

**이유**:
- OLLAMA API가 단순 (POST `/api/generate`, GET `/api/tags`)
- SDK 추가 의존성 불필요
- `stream: false`로 단일 응답 수신 → 파싱 단순화

**상세**: [OLLAMA_INTEGRATION.md](./OLLAMA_INTEGRATION.md) 참조

---

## ADR-007: 내보내기 — HWPX Only

**결정**: 편집 결과는 HWPX 형식으로만 내보내기

**이유**:
- HWP 바이너리 쓰기는 포맷이 비공개이고 구현 복잡도가 높음
- HWPX는 ZIP+XML이므로 JSZip으로 생성 가능
- 원본이 HWPX인 경우 원본 ZIP 구조를 보존하고 텍스트만 교체 → 호환성 극대화
- 한글 프로그램은 HWP/HWPX 모두 열 수 있으므로 사용자에게 불편 없음
