import { create } from 'zustand';
import type { ParsedDocument, AppView } from '../types';

interface DocumentState {
  view: AppView;
  document: ParsedDocument | null;
  fileName: string | null;
  isLoading: boolean;
  error: string | null;
  originalHtml: string | null;

  setView: (view: AppView) => void;
  setDocument: (doc: ParsedDocument, fileName: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useDocumentStore = create<DocumentState>((set) => ({
  view: 'upload',
  document: null,
  fileName: null,
  isLoading: false,
  error: null,
  originalHtml: null,

  setView: (view) => set({ view }),
  setDocument: (doc, fileName) =>
    set({
      document: doc,
      fileName,
      view: 'editor',
      error: null,
      originalHtml: doc.html,
    }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  reset: () =>
    set({
      view: 'upload',
      document: null,
      fileName: null,
      isLoading: false,
      error: null,
      originalHtml: null,
    }),
}));
