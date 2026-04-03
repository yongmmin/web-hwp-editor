import { useState, useEffect, useCallback } from 'react';
import type { OllamaModel } from '../types';
import { checkConnection, getModels } from '../services/ollama/ollamaClient';

const STORAGE_KEY = 'docs-editor-ollama-model';

export function useOllama() {
  const [connected, setConnected] = useState(false);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY)
  );
  const [checking, setChecking] = useState(true);

  const check = useCallback(async () => {
    setChecking(true);
    const ok = await checkConnection();
    setConnected(ok);

    if (ok) {
      try {
        const modelList = await getModels();
        setModels(modelList);

        const stored = localStorage.getItem(STORAGE_KEY);
        const isValid = stored && modelList.some((m) => m.name === stored);

        if (isValid) {
          // 저장된 모델이 목록에 있으면 그대로 유지
          setSelectedModel(stored);
        } else if (modelList.length > 0) {
          // 저장된 모델이 없거나 목록에 없으면 첫 번째 모델로 자동 선택
          const name = modelList[0].name;
          setSelectedModel(name);
          localStorage.setItem(STORAGE_KEY, name);
        }
      } catch {
        setModels([]);
      }
    } else {
      setModels([]);
    }

    setChecking(false);
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  const selectModel = useCallback((name: string) => {
    setSelectedModel(name);
    localStorage.setItem(STORAGE_KEY, name);
  }, []);

  return {
    connected,
    models,
    selectedModel,
    checking,
    selectModel,
    refresh: check,
  };
}
