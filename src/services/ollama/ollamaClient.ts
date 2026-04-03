import type { OllamaGenerateRequest, OllamaTagsResponse } from './types';
import type { OllamaModel, WordSuggestion, RefinedText } from '../../types';
import { buildSuggestionPrompt, buildRefinementPrompt } from './prompts';

const BASE_URL = 'http://localhost:11434';

export async function checkConnection(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function getModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${BASE_URL}/api/tags`);
  if (!res.ok) throw new Error('OLLAMA 서버에 연결할 수 없습니다.');

  const data: OllamaTagsResponse = await res.json();
  return data.models.map((m) => ({
    name: m.name,
    size: m.size,
    modified_at: m.modified_at,
  }));
}

// ─── Model pull ─────────────────────────────────────────────────────────────

export interface PullProgress {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
}

export async function* pullModel(
  name: string,
  signal?: AbortSignal
): AsyncGenerator<PullProgress> {
  const res = await fetch(`${BASE_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: true }),
    signal,
  });

  if (!res.ok) throw new Error(`모델 설치 실패: ${res.status}`);
  if (!res.body) throw new Error('스트림을 읽을 수 없습니다.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          yield JSON.parse(trimmed) as PullProgress;
        } catch {
          // skip malformed line
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

export async function deleteModel(name: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/api/delete`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`모델 삭제 실패: ${res.status}`);
}

// ─── Streaming generator ────────────────────────────────────────────────────

async function* streamTokens(
  model: string,
  prompt: string,
  signal?: AbortSignal
): AsyncGenerator<string> {
  const body: OllamaGenerateRequest = {
    model,
    prompt,
    stream: true,
    options: { temperature: 0.7 },
  };

  const res = await fetch(`${BASE_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!res.ok) throw new Error(`OLLAMA 요청 실패: ${res.status}`);
  if (!res.body) throw new Error('스트림을 읽을 수 없습니다.');

  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const obj = JSON.parse(trimmed) as { response?: string; done?: boolean };
          if (obj.response) yield obj.response;
          if (obj.done) return;
        } catch {
          // incomplete JSON line — skip
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Extract complete flat JSON objects `{...}` from accumulated buffer.
 * Returns newly-found items beyond `alreadyEmitted` count.
 */
function extractNewItems<T>(
  buffer: string,
  alreadyEmitted: number,
  validate: (obj: unknown) => obj is T
): { items: T[]; newEmittedCount: number } {
  const items: T[] = [];
  const regex = /\{[^{}]*\}/g;
  let match: RegExpExecArray | null;
  let found = 0;

  while ((match = regex.exec(buffer)) !== null) {
    found++;
    if (found <= alreadyEmitted) continue;
    try {
      const parsed = JSON.parse(match[0]) as unknown;
      if (validate(parsed)) items.push(parsed);
    } catch {
      // malformed partial object — skip
    }
  }

  return { items, newEmittedCount: alreadyEmitted + items.length };
}

// ─── Streaming synonyms ──────────────────────────────────────────────────────

function isSuggestion(obj: unknown): obj is WordSuggestion {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'word' in obj &&
    typeof (obj as Record<string, unknown>).word === 'string'
  );
}

export async function getSuggestionsStream(
  model: string,
  selectedWord: string,
  surroundingText: string,
  onItem: (suggestion: WordSuggestion) => void,
  signal?: AbortSignal
): Promise<void> {
  const prompt = buildSuggestionPrompt(selectedWord, surroundingText);
  let buffer = '';
  let emitted = 0;

  for await (const token of streamTokens(model, prompt, signal)) {
    buffer += token;
    const { items, newEmittedCount } = extractNewItems(buffer, emitted, isSuggestion);
    emitted = newEmittedCount;
    for (const item of items) onItem(item);
  }
}

// ─── Streaming refinements ───────────────────────────────────────────────────

function isRefinedText(obj: unknown): obj is RefinedText {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'text' in obj &&
    typeof (obj as Record<string, unknown>).text === 'string'
  );
}

export async function refineTextStream(
  model: string,
  selectedText: string,
  surroundingText: string,
  onItem: (refinement: RefinedText) => void,
  signal?: AbortSignal
): Promise<void> {
  const prompt = buildRefinementPrompt(selectedText, surroundingText);
  let buffer = '';
  let emitted = 0;

  for await (const token of streamTokens(model, prompt, signal)) {
    buffer += token;
    const { items, newEmittedCount } = extractNewItems(buffer, emitted, isRefinedText);
    emitted = newEmittedCount;
    for (const item of items) onItem(item);
  }
}

// ─── Legacy non-streaming (kept for BubbleMenu inline use) ──────────────────

export async function getSuggestions(
  model: string,
  selectedWord: string,
  surroundingText: string
): Promise<WordSuggestion[]> {
  const results: WordSuggestion[] = [];
  await getSuggestionsStream(model, selectedWord, surroundingText, (s) => results.push(s));
  return results;
}
