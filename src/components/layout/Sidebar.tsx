import { useMemo } from 'react';
import { FileText, Info } from 'lucide-react';
import { useDocumentStore } from '../../stores/documentStore';

interface SidebarProps {
  editorText: string;
}

interface Heading {
  level: number;
  text: string;
}

export function Sidebar({ editorText }: SidebarProps) {
  const { document: doc, fileName } = useDocumentStore();

  const headings = useMemo<Heading[]>(() => {
    if (!editorText) return [];

    // Simple heading extraction from text
    const lines = editorText.split('\n');
    return lines
      .filter((line) => line.trim().length > 0)
      .slice(0, 20)
      .map((line) => ({
        level: 3,
        text: line.trim().slice(0, 50),
      }));
  }, [editorText]);

  return (
    <aside className="w-56 border-r border-gray-200 bg-gray-50 flex flex-col h-full overflow-hidden shrink-0">
      {/* Document Info */}
      <div className="p-3 border-b border-gray-200">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
          <Info className="w-3 h-3" />
          문서 정보
        </div>
        {doc?.metadata && (
          <div className="space-y-1 text-xs text-gray-600">
            {fileName && <div className="truncate">{fileName}</div>}
            {doc.metadata.author && <div>작성자: {doc.metadata.author}</div>}
            {doc.metadata.date && <div>날짜: {doc.metadata.date}</div>}
            <div>형식: {doc.originalFormat.toUpperCase()}</div>
          </div>
        )}
      </div>

      {/* Document Outline */}
      <div className="flex-1 overflow-auto p-3">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 mb-2">
          <FileText className="w-3 h-3" />
          문서 개요
        </div>
        {headings.length > 0 ? (
          <nav className="space-y-0.5">
            {headings.map((h, i) => (
              <div
                key={i}
                className="text-xs text-gray-600 truncate py-0.5 hover:text-gray-900 cursor-default"
                style={{ paddingLeft: `${(h.level - 1) * 8}px` }}
              >
                {h.text}
              </div>
            ))}
          </nav>
        ) : (
          <p className="text-xs text-gray-400">내용 없음</p>
        )}
      </div>
    </aside>
  );
}
