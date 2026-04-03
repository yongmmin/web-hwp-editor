# docs-editor — Project Knowledge Base

## Stack
- **Framework**: React 18 (Vite, no Next.js)
- **Language**: TypeScript 5.6
- **Styling**: Tailwind CSS v4 + custom CSS (`src/index.css`)
- **Editor**: TipTap v3 (ProseMirror-based)
- **State**: Zustand
- **File formats**: HWP, HWPX, ODT
- **AI**: Ollama (local LLM)

## Directory Structure
```
src/
  components/
    editor/       # TipTap editor + custom extensions
    layout/       # AppShell, Header, Sidebar, ModelPicker
    refinement/   # RefinementPanel (AI text refinement)
    suggestions/  # SuggestionPanel, SuggestionItem, PreviewHighlight
    upload/       # FileUploader, ConfirmReplaceModal
  hooks/          # useFileUpload, useOllama, useTextRefinement, useWordSuggestion
  services/
    hwp/          # HWP/HWPX/ODT parsers, exporter, types
    ollama/       # Ollama client, prompts, types
  stores/         # Zustand stores
  types/index.ts
  utils/          # file.ts, korean.ts
scripts/          # Node.js HWP bridge & quality scripts
```

## Git
- **Design**: Figma (MCP connected)
