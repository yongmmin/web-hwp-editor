import { create } from 'zustand';
import type { RefinedText } from '../types';

interface RefinementState {
  isOpen: boolean;
  isLoading: boolean;
  originalText: string | null;
  refinements: RefinedText[];
  previewText: string | null;
  error: string | null;
  selectionFrom: number | null;
  selectionTo: number | null;

  openPanel: (text: string, from: number, to: number) => void;
  setRefinements: (refinements: RefinedText[]) => void;
  addRefinement: (refinement: RefinedText) => void;
  setPreviewText: (text: string | null) => void;
  setError: (error: string | null) => void;
  closePanel: () => void;
}

export const useRefinementStore = create<RefinementState>((set) => ({
  isOpen: false,
  isLoading: false,
  originalText: null,
  refinements: [],
  previewText: null,
  error: null,
  selectionFrom: null,
  selectionTo: null,

  openPanel: (text, from, to) =>
    set({
      isOpen: true,
      originalText: text,
      selectionFrom: from,
      selectionTo: to,
      refinements: [],
      previewText: null,
      error: null,
      isLoading: true,
    }),
  setRefinements: (refinements) => set({ refinements, isLoading: false }),
  addRefinement: (refinement) =>
    set((s) => ({
      refinements: [...s.refinements, refinement],
      isLoading: false,
    })),
  setPreviewText: (previewText) => set({ previewText }),
  setError: (error) => set({ error, isLoading: false }),
  closePanel: () =>
    set({
      isOpen: false,
      originalText: null,
      refinements: [],
      previewText: null,
      error: null,
      isLoading: false,
      selectionFrom: null,
      selectionTo: null,
    }),
}));
