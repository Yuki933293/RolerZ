import { create } from 'zustand';
import type { Candidate } from '../api/client';
import { cancelGeneration as cancelGenerationAPI } from '../api/client';

export interface GenerationRun {
  id: string;
  concept: string;
  candidates: Candidate[];
  timestamp: number;
}

interface GenerateSessionStore {
  runs: GenerationRun[];
  isGenerating: boolean;
  currentConcept: string;
  error: string;
  abortController: AbortController | null;

  startGeneration: (concept: string, controller: AbortController) => void;
  finishGeneration: (candidates: Candidate[]) => void;
  failGeneration: (error: string) => void;
  cancelGeneration: () => void;
  clearSession: () => void;
}

export const useGenerateSession = create<GenerateSessionStore>((set, get) => ({
  runs: [],
  isGenerating: false,
  currentConcept: '',
  error: '',
  abortController: null,

  startGeneration: (concept, controller) => set({
    isGenerating: true,
    currentConcept: concept,
    error: '',
    abortController: controller,
  }),

  finishGeneration: (candidates) => set(state => ({
    isGenerating: false,
    abortController: null,
    error: '',
    runs: [{
      id: `run_${Date.now()}`,
      concept: state.currentConcept,
      candidates,
      timestamp: Date.now(),
    }, ...state.runs],
  })),

  failGeneration: (error) => set({
    isGenerating: false,
    error,
    abortController: null,
  }),

  cancelGeneration: () => {
    const { abortController } = get();
    // 1. Abort the frontend HTTP request
    if (abortController) abortController.abort();
    // 2. Tell the backend to stop generating (saves LLM tokens)
    cancelGenerationAPI().catch(() => {});
    set({ isGenerating: false, error: '', abortController: null });
  },

  clearSession: () => set({
    runs: [],
    isGenerating: false,
    currentConcept: '',
    error: '',
    abortController: null,
  }),
}));
