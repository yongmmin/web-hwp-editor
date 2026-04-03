# Design System

## Styling
- **Tailwind CSS v4** via `@tailwindcss/vite` (no `tailwind.config.js`)
- Page/document tokens as CSS custom properties on `.document-page` in `src/index.css`

## Page Layout Tokens
```css
.document-page {
  --page-width: 210mm;
  --page-height: 297mm;
  --page-padding-top: 20mm;
  --page-padding-right: 25mm;
  --page-padding-bottom: 20mm;
  --page-padding-left: 25mm;
}
```

## Typography
- **UI**: `'Pretendard', 'Noto Sans KR', system-ui, sans-serif`
- **Document**: `'함초롬바탕', 'Batang', 'Pretendard', serif`
- **Base editor size**: `10pt`, **line-height**: `1.5` (overridden per-paragraph by parsed styles)

## Colors
- Canvas: `#e8e8e8`
- Page: `white`
- Text: `#1a1a1a`
- Page shadow: `0 1px 3px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)`

## Icons
- `lucide-react` v1.7
