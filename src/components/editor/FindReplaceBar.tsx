import { useEffect, useRef, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { Search, Replace, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useFindReplaceStore } from '../../stores/findReplaceStore';
import { findHighlightKey } from './extensions/FindHighlight';

interface FindReplaceBarProps {
  editor: Editor | null;
}

export function FindReplaceBar({ editor }: FindReplaceBarProps) {
  const {
    isOpen,
    mode,
    query,
    replacement,
    matchCount,
    activeIndex,
    close,
    setQuery,
    setReplacement,
    setMatches,
    nextMatch,
    prevMatch,
    setMode,
  } = useFindReplaceStore();

  const queryRef = useRef<HTMLInputElement>(null);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => queryRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Sync query to TipTap find plugin
  useEffect(() => {
    if (!editor) return;
    const { tr } = editor.state;
    tr.setMeta(findHighlightKey, { query, activeIndex: 0 });
    editor.view.dispatch(tr);
  }, [editor, query]);

  // Sync activeIndex to TipTap find plugin
  useEffect(() => {
    if (!editor || !query) return;
    const pluginState = findHighlightKey.getState(editor.state);
    if (!pluginState) return;

    const { tr } = editor.state;
    tr.setMeta(findHighlightKey, { query, activeIndex });
    editor.view.dispatch(tr);

    // Scroll active match into view
    const matches = pluginState.matches;
    if (matches.length > 0 && matches[activeIndex]) {
      const [from] = matches[activeIndex];
      editor.commands.setTextSelection(from);
      const domNode = editor.view.domAtPos(from).node as HTMLElement;
      domNode?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' });
    }
  }, [editor, activeIndex, query]);

  // Update match count when editor content or query changes
  useEffect(() => {
    if (!editor || !query) {
      setMatches(0, 0);
      return;
    }
    const pluginState = findHighlightKey.getState(editor.state);
    if (pluginState) {
      setMatches(pluginState.matches.length, pluginState.activeIndex);
    }
  }, [editor, query, setMatches]);

  // Clear highlights on close
  const handleClose = useCallback(() => {
    if (editor) {
      const { tr } = editor.state;
      tr.setMeta(findHighlightKey, { query: '', activeIndex: 0 });
      editor.view.dispatch(tr);
    }
    close();
  }, [editor, close]);

  const handleReplaceOne = useCallback(() => {
    if (!editor || !query) return;
    const pluginState = findHighlightKey.getState(editor.state);
    if (!pluginState || pluginState.matches.length === 0) return;

    const match = pluginState.matches[activeIndex];
    if (!match) return;

    editor
      .chain()
      .focus()
      .setTextSelection({ from: match[0], to: match[1] })
      .insertContent(replacement)
      .run();
  }, [editor, query, replacement, activeIndex]);

  const handleReplaceAll = useCallback(() => {
    if (!editor || !query) return;
    const pluginState = findHighlightKey.getState(editor.state);
    if (!pluginState || pluginState.matches.length === 0) return;

    // Replace from end to start to preserve positions
    const matches = [...pluginState.matches].reverse();
    const chain = editor.chain().focus();
    for (const [from, to] of matches) {
      chain.setTextSelection({ from, to }).insertContent(replacement);
    }
    chain.run();
  }, [editor, query, replacement]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
      if (e.key === 'Enter') {
        if (e.shiftKey) prevMatch();
        else nextMatch();
      }
    },
    [handleClose, nextMatch, prevMatch]
  );

  if (!isOpen) return null;

  const inputCls =
    'flex-1 min-w-0 px-2.5 py-1.5 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200';
  const iconBtnCls =
    'p-1.5 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-transparent transition-colors';

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-[#f3f3f3] border-b border-gray-300 shrink-0">
      {/* Mode toggle */}
      <div className="flex flex-col gap-1 shrink-0">
        <button
          onClick={() => setMode('find')}
          className={`p-1.5 rounded transition-colors ${mode === 'find' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
          title="찾기"
        >
          <Search className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setMode('replace')}
          className={`p-1.5 rounded transition-colors ${mode === 'replace' ? 'bg-blue-100 text-blue-600' : 'text-gray-500 hover:bg-gray-200'}`}
          title="바꾸기"
        >
          <Replace className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex flex-col gap-1.5 flex-1 min-w-0">
        {/* Find row */}
        <div className="flex items-center gap-1.5">
          <input
            ref={queryRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="찾기..."
            className={inputCls}
          />
          {/* Match count */}
          <span className="text-xs text-gray-500 shrink-0 w-16 text-center">
            {query
              ? matchCount > 0
                ? `${activeIndex + 1} / ${matchCount}`
                : '없음'
              : ''}
          </span>
          <button
            onClick={prevMatch}
            disabled={matchCount === 0}
            className={iconBtnCls}
            title="이전 (Shift+Enter)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={nextMatch}
            disabled={matchCount === 0}
            className={iconBtnCls}
            title="다음 (Enter)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button onClick={handleClose} className={iconBtnCls} title="닫기 (Esc)">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Replace row */}
        {mode === 'replace' && (
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={replacement}
              onChange={(e) => setReplacement(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="바꿀 텍스트..."
              className={inputCls}
            />
            <button
              onClick={handleReplaceOne}
              disabled={matchCount === 0}
              className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 disabled:hover:bg-blue-600 transition-colors shrink-0"
            >
              바꾸기
            </button>
            <button
              onClick={handleReplaceAll}
              disabled={matchCount === 0}
              className="px-2.5 py-1.5 text-xs font-medium bg-gray-600 text-white rounded hover:bg-gray-700 disabled:opacity-40 disabled:hover:bg-gray-600 transition-colors shrink-0"
            >
              모두
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
