export interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  stream: boolean;
  format?: 'json';
  options?: {
    temperature?: number;
    top_p?: number;
  };
}

export interface OllamaGenerateResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface OllamaTagsResponse {
  models: OllamaModelInfo[];
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  modified_at: string;
  digest: string;
}
