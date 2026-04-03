import { create } from 'zustand';

interface FindReplaceState {
  isOpen: boolean;
  mode: 'find' | 'replace';
  query: string;
  replacement: string;
  matchCount: number;
  activeIndex: number;

  open: (mode?: 'find' | 'replace') => void;
  close: () => void;
  setQuery: (q: string) => void;
  setReplacement: (r: string) => void;
  setMatches: (count: number, activeIndex?: number) => void;
  nextMatch: () => void;
  prevMatch: () => void;
  setMode: (mode: 'find' | 'replace') => void;
}

export const useFindReplaceStore = create<FindReplaceState>((set, get) => ({
  isOpen: false,
  mode: 'find',
  query: '',
  replacement: '',
  matchCount: 0,
  activeIndex: 0,

  open: (mode = 'find') => set({ isOpen: true, mode }),
  close: () => set({ isOpen: false, query: '', replacement: '', matchCount: 0, activeIndex: 0 }),
  setQuery: (query) => set({ query, activeIndex: 0, matchCount: 0 }),
  setReplacement: (replacement) => set({ replacement }),
  setMatches: (matchCount, activeIndex = 0) => set({ matchCount, activeIndex }),
  nextMatch: () => {
    const { matchCount, activeIndex } = get();
    if (matchCount === 0) return;
    set({ activeIndex: (activeIndex + 1) % matchCount });
  },
  prevMatch: () => {
    const { matchCount, activeIndex } = get();
    if (matchCount === 0) return;
    set({ activeIndex: (activeIndex - 1 + matchCount) % matchCount });
  },
  setMode: (mode) => set({ mode }),
}));
