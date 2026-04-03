# Components Catalog

## Editor (`src/components/editor/`)
| Component | Description |
|---|---|
| DocumentEditor | Main TipTap editor wrapper; renders A4 page canvas |
| EditorToolbar | Formatting toolbar (bold, italic, align, etc.) |
| FindReplaceBar | Find & replace UI bar |
| HwpReadonlyViewer | Read-only viewer for HWP files |
| SelectionBubbleMenu | Floating menu on text selection |

## Editor Extensions (`src/components/editor/extensions/`)
| Extension | Description |
|---|---|
| DocumentRegion | Custom node for header/footer regions |
| FindHighlight | Mark for find/replace highlights |
| ImageBlock | Custom image block node |
| Paragraph | Extended paragraph (line-height, spacing) |
| Table | Extended table node (ODT support) |
| WordSuggestion | Mark for word suggestion decorations |

## Layout (`src/components/layout/`)
| Component | Description |
|---|---|
| AppShell | Top-level layout shell |
| Header | Top header bar |
| ModelPicker | Ollama model selection dropdown |
| Sidebar | Left sidebar (file info / outline) |

## Feature Panels
| Component | Description |
|---|---|
| RefinementPanel | AI text refinement panel |
| SuggestionPanel | Word suggestion list |
| SuggestionItem | Individual suggestion row |
| PreviewHighlight | Inline preview for a suggestion |
| FileUploader | Drag-and-drop upload zone (upload view) |
| ConfirmReplaceModal | Confirm before replacing open document on drop |

## ConfirmReplaceModal
- **Props**: `{ fileName: string; onConfirm: () => void; onCancel: () => void }`
- **Accessibility**: `role="dialog"`, `aria-modal`, focus trap, ESC capture phase
- **Backdrop click**: closes on `e.target === e.currentTarget`
