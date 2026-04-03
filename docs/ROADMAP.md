# Roadmap

## 제품 방향(고정)

- [x] 레이아웃 보존 개선은 **현재 웹 에디터 파서 고도화** 방식으로 진행
- [x] 외부 변환기 기반 원본 뷰어 분리 방식은 채택하지 않음
- [x] 세부 기준 문서: [LAYOUT_PRESERVATION_STRATEGY.md](./LAYOUT_PRESERVATION_STRATEGY.md)

## 현재 상태: MVP+

기본 워크플로우 완성:
- [x] HWP/HWPX 파일 업로드 및 파싱
- [x] TipTap 에디터 (기본 서식)
- [x] OLLAMA 연동 유의어 추천
- [x] 추천 패널 (hover 미리보기, 적용)
- [x] HWPX 내보내기
- [x] HWPX 표 가져오기 및 렌더링
- [x] HWPX 이미지 가져오기 및 렌더링
- [x] HWPX 머리글/바닥글 가져오기 및 표시

MVP 이후 추가 완료:
- [x] 찾기/바꾸기 (`FindReplaceBar`, `findReplaceStore`)
- [x] 문장 다듬기 AI 패널 (`RefinementPanel`, `refinementStore`)
- [x] HWP 원본 읽기 전용 뷰 (`HwpReadonlyViewer`, `sourceMode: 'hwp-original-readonly'`)
- [x] HWP → ODT 브리지 파이프라인 (`odtParser.ts`, `scripts/hwp-render-bridge.mjs`)

---

## Phase 1: 파싱 고도화

- [ ] HWP 레이아웃 보존율 개선 (표/이미지/페이지 분리)
- [ ] HWPX 인라인 서식 파싱 (볼드, 이탤릭, 밑줄 → TipTap Mark)
- [ ] HWPX 차트 / OLE / 수식 / 도형 렌더링
- [ ] HWP 바이너리 머리글/바닥글 파싱
- [ ] HWP 서식 정보 추출 개선
- [ ] HWP 이미지 / 표의 예외 케이스 보강

## Phase 2: 내보내기 고도화

- [ ] 인라인 서식 내보내기 (hp:charPr 매핑)
- [x] 표 내보내기 (hp:tbl 구조 생성)
- [ ] 이미지 내보내기 (BinData 재패키징)
- [ ] 머리글/바닥글 내보내기
- [ ] 페이지 설정 보존 (용지 크기, 여백)

## Phase 3: 편집 기능 강화

- [ ] 표 삽입/편집 UI 보강
- [ ] 이미지 삽입 / 교체
- [ ] 찾기/바꾸기
- [ ] 글머리 기호/번호 매기기 스타일 확장
- [ ] 페이지 나누기 시각화

## Phase 4: 한국어 처리 고도화

- [ ] 형태소 분석기 연동 (단어 단위 정확한 선택)
- [ ] 맞춤법 검사 연동
- [ ] 문장 단위 다듬기 (OLLAMA)
- [ ] 존댓말/반말 변환

## Phase 5: UX 개선

- [ ] 다크 모드
- [ ] 반응형 모바일 대응
- [ ] 드래그앤드롭 파일 목록 (다중 문서)
- [ ] 최근 파일 기록 (IndexedDB)
- [ ] 키보드 단축키 커스텀
- [ ] 에디터 확대/축소

## Phase 6: 성능 및 안정성

- [ ] 대용량 문서 처리 최적화 (가상 스크롤)
- [ ] OLLAMA 스트리밍 응답 지원
- [ ] 오프라인 캐싱 (Service Worker)
- [ ] 에러 바운더리 세분화
- [ ] 레이아웃 회귀 테스트 자동화 (대표 샘플 문서 스냅샷)
