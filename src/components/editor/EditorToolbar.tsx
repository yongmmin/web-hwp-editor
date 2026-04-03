import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Undo,
  Redo,
  Heading1,
  Heading2,
  Heading3,
  Sparkles,
} from 'lucide-react';

interface EditorToolbarProps {
  editor: Editor | null;
  onSuggest: () => void;
  ollamaConnected: boolean;
}

export function EditorToolbar({ editor, onSuggest, ollamaConnected }: EditorToolbarProps) {
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      hasSelection: ctx.editor ? !ctx.editor.state.selection.empty : false,
      isBold: ctx.editor?.isActive('bold') ?? false,
      isItalic: ctx.editor?.isActive('italic') ?? false,
      isUnderline: ctx.editor?.isActive('underline') ?? false,
      isStrike: ctx.editor?.isActive('strike') ?? false,
      isH1: ctx.editor?.isActive('heading', { level: 1 }) ?? false,
      isH2: ctx.editor?.isActive('heading', { level: 2 }) ?? false,
      isH3: ctx.editor?.isActive('heading', { level: 3 }) ?? false,
      isBulletList: ctx.editor?.isActive('bulletList') ?? false,
      isOrderedList: ctx.editor?.isActive('orderedList') ?? false,
      isAlignLeft: ctx.editor?.isActive({ textAlign: 'left' }) ?? false,
      isAlignCenter: ctx.editor?.isActive({ textAlign: 'center' }) ?? false,
      isAlignRight: ctx.editor?.isActive({ textAlign: 'right' }) ?? false,
      isAlignJustify: ctx.editor?.isActive({ textAlign: 'justify' }) ?? false,
      canUndo: ctx.editor?.can().undo() ?? false,
      canRedo: ctx.editor?.can().redo() ?? false,
    }),
  });

  if (!editor || !editorState) return null;

  const {
    hasSelection, isBold, isItalic, isUnderline, isStrike,
    isH1, isH2, isH3, isBulletList, isOrderedList,
    isAlignLeft, isAlignCenter, isAlignRight, isAlignJustify,
    canUndo, canRedo,
  } = editorState;

  const btn = (active: boolean) =>
    `p-1 rounded transition-colors ${
      active
        ? 'bg-[#2b579a] text-white'
        : 'text-gray-700 hover:bg-gray-200'
    }`;

  return (
    <div className="flex items-center gap-px px-2 py-1 bg-[#f3f3f3] border-b border-gray-300 flex-wrap shrink-0">
      {/* 실행취소 / 다시실행 */}
      <button
        onClick={() => editor.chain().focus().undo().run()}
        disabled={!canUndo}
        className="p-1 rounded text-gray-600 hover:bg-gray-200 disabled:opacity-25 disabled:hover:bg-transparent"
        title="실행취소 (Ctrl+Z)"
      >
        <Undo className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().redo().run()}
        disabled={!canRedo}
        className="p-1 rounded text-gray-600 hover:bg-gray-200 disabled:opacity-25 disabled:hover:bg-transparent"
        title="다시실행 (Ctrl+Y)"
      >
        <Redo className="w-4 h-4" />
      </button>

      <Divider />

      {/* 제목 스타일 */}
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        className={btn(isH1)}
        title="제목 1"
      >
        <Heading1 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        className={btn(isH2)}
        title="제목 2"
      >
        <Heading2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        className={btn(isH3)}
        title="제목 3"
      >
        <Heading3 className="w-4 h-4" />
      </button>

      <Divider />

      {/* 글자 서식 */}
      <button
        onClick={() => editor.chain().focus().toggleBold().run()}
        className={btn(isBold)}
        title="굵게 (Ctrl+B)"
      >
        <Bold className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleItalic().run()}
        className={btn(isItalic)}
        title="기울임 (Ctrl+I)"
      >
        <Italic className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleUnderline().run()}
        className={btn(isUnderline)}
        title="밑줄 (Ctrl+U)"
      >
        <Underline className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleStrike().run()}
        className={btn(isStrike)}
        title="취소선"
      >
        <Strikethrough className="w-4 h-4" />
      </button>

      <Divider />

      {/* 목록 */}
      <button
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        className={btn(isBulletList)}
        title="글머리 기호"
      >
        <List className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        className={btn(isOrderedList)}
        title="번호 매기기"
      >
        <ListOrdered className="w-4 h-4" />
      </button>

      <Divider />

      {/* 정렬 */}
      <button
        onClick={() => editor.chain().focus().setTextAlign('left').run()}
        className={btn(isAlignLeft)}
        title="왼쪽 정렬"
      >
        <AlignLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('center').run()}
        className={btn(isAlignCenter)}
        title="가운데 정렬"
      >
        <AlignCenter className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('right').run()}
        className={btn(isAlignRight)}
        title="오른쪽 정렬"
      >
        <AlignRight className="w-4 h-4" />
      </button>
      <button
        onClick={() => editor.chain().focus().setTextAlign('justify').run()}
        className={btn(isAlignJustify)}
        title="양쪽 정렬"
      >
        <AlignJustify className="w-4 h-4" />
      </button>

      <div className="flex-1" />

      {/* 단어 추천 */}
      <button
        onClick={onSuggest}
        disabled={!hasSelection || !ollamaConnected}
        className={`
          flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-colors
          ${hasSelection && ollamaConnected
            ? 'bg-[#2b579a] text-white hover:bg-[#1e3f73]'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }
        `}
        title="유의어 추천 (Ctrl+Space)"
      >
        <Sparkles className="w-3.5 h-3.5" />
        추천
      </button>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-300 mx-1" />;
}
