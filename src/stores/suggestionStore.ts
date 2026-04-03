import { create } from 'zustand';
import type { WordSuggestion } from '../types';

interface SuggestionState {
  isOpen: boolean;
  isLoading: boolean;
  selectedWord: string | null;   // 원본 선택 단어
  suggestions: WordSuggestion[];
  lockedWord: string | null;     // 클릭으로 고정된 단어 (Apply 버튼 표시 기준)
  previewWord: string | null;    // hover 미리보기 (editor highlight용)
  error: string | null;
  selectionFrom: number | null;
  selectionTo: number | null;

  openPanel: (word: string, from: number, to: number) => void;
  setSuggestions: (suggestions: WordSuggestion[]) => void;
  addSuggestion: (suggestion: WordSuggestion) => void;
  setLoading: (loading: boolean) => void;
  lockWord: (word: string | null) => void;
  setPreviewWord: (word: string | null) => void;
  setError: (error: string | null) => void;
  closePanel: () => void;
}

export const useSuggestionStore = create<SuggestionState>((set) => ({
  isOpen: false,
  isLoading: false,
  selectedWord: null,
  suggestions: [],
  lockedWord: null,
  previewWord: null,
  error: null,
  selectionFrom: null,
  selectionTo: null,

  openPanel: (word, from, to) =>
    set({
      isOpen: true,
      selectedWord: word,
      selectionFrom: from,
      selectionTo: to,
      suggestions: [],
      lockedWord: null,
      previewWord: null,
      error: null,
      isLoading: true,
    }),
  setSuggestions: (suggestions) => set({ suggestions, isLoading: false }),
  addSuggestion: (suggestion) =>
    set((s) => ({
      suggestions: [...s.suggestions, suggestion],
      isLoading: false,
    })),
  setLoading: (isLoading) => set({ isLoading }),
  lockWord: (lockedWord) => set({ lockedWord, previewWord: lockedWord }),
  setPreviewWord: (previewWord) => set({ previewWord }),
  setError: (error) => set({ error, isLoading: false }),
  closePanel: () =>
    set({
      isOpen: false,
      selectedWord: null,
      suggestions: [],
      lockedWord: null,
      previewWord: null,
      error: null,
      isLoading: false,
      selectionFrom: null,
      selectionTo: null,
    }),
}));
