# Patterns & Conventions

## State Management (Zustand stores in `src/stores/`)
- `documentStore` — document content, file metadata, view state
- `findReplaceStore` — find/replace state
- `refinementStore` — AI refinement results
- `suggestionStore` — word suggestion results

## Data Flow
1. User drops HWP/HWPX/ODT → `useFileUpload` selects parser
2. Parser → TipTap-compatible HTML → `documentStore`
3. `DocumentEditor` renders from store
4. AI features call Ollama via `ollamaClient`

## HWP Parsing Pipeline
- **HWP binary**: `scripts/hwp-render-bridge.mjs` (pyhwp) → ODT XML → `odtParser.ts` → HTML
- **HWPX**: `hwpxParser.ts` (JSZip + XML) → HTML directly

## Service Layer Rules
- Pure TypeScript, no React dependencies
- Shared types in `hwp/types.ts`, `ollama/types.ts`

## Drop-to-Replace Pattern (editor view)
When a file is dropped onto the open editor:
1. `AppShell` captures drop via `useDropzone({ noClick: true })`
2. Saves to `pendingFile` → renders `ConfirmReplaceModal`
3. Confirm → calls existing `handleFile(pendingFile)`
4. Cancel → clears `pendingFile`
5. Guards: blocks additional drops while `pendingFile !== null` or `isLoading`

**Ref**: `src/components/layout/AppShell.tsx`
