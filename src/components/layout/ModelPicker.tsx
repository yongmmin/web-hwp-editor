import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ChevronDown, Zap, Gauge, Brain, Check, RefreshCw,
  Download, Trash2, X, AlertCircle, List, PackagePlus,
} from 'lucide-react';
import type { OllamaModel } from '../../types';
import { pullModel, deleteModel } from '../../services/ollama/ollamaClient';

interface ModelPickerProps {
  models: OllamaModel[];
  selectedModel: string | null;
  onSelect: (name: string) => void;
  onRefresh: () => void;
}

// ─── 모델 특성 추론 ────────────────────────────────────────────────────────────

type SpeedTier = 'fast' | 'balanced' | 'powerful';

interface ModelMeta {
  tier: SpeedTier;
  label: string;
  desc: string;
}

function getModelMeta(model: OllamaModel): ModelMeta {
  const nameLower = model.name.toLowerCase();
  const paramMatch = nameLower.match(/:(\d+(?:\.\d+)?)\s*b/);
  const paramB = paramMatch ? parseFloat(paramMatch[1]) : null;
  const sizeGB = model.size / 1e9;
  const effectiveB = paramB ?? sizeGB / 0.65;

  if (effectiveB <= 2) return { tier: 'fast', label: '빠름', desc: '응답 빠름 · 유의어/단어 교체에 적합' };
  if (effectiveB <= 7) return { tier: 'balanced', label: '균형', desc: '속도·품질 균형 · 문장 다듬기에 적합' };
  return { tier: 'powerful', label: '강력', desc: '느리지만 정확 · 복잡한 문서 작업에 적합' };
}

function formatSize(bytes: number): string {
  const gb = bytes / 1e9;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1e6).toFixed(0)} MB`;
}

const tierStyle: Record<SpeedTier, { bg: string; text: string; icon: React.ReactNode }> = {
  fast:     { bg: 'bg-green-100 text-green-700',  text: 'text-green-600',  icon: <Zap className="w-3 h-3" /> },
  balanced: { bg: 'bg-blue-100 text-blue-700',    text: 'text-blue-600',   icon: <Gauge className="w-3 h-3" /> },
  powerful: { bg: 'bg-purple-100 text-purple-700', text: 'text-purple-600', icon: <Brain className="w-3 h-3" /> },
};

// ─── 추천 모델 목록 ────────────────────────────────────────────────────────────

interface RecommendedModel {
  name: string;
  tier: SpeedTier;
  sizeHint: string;
  desc: string;
}

const RECOMMENDED: RecommendedModel[] = [
  { name: 'qwen2.5:1.5b', tier: 'fast',     sizeHint: '~1 GB',  desc: '한국어 유의어 · 단어 교체에 최적' },
  { name: 'qwen2.5:3b',   tier: 'fast',     sizeHint: '~2 GB',  desc: '빠르고 한국어 품질 우수' },
  { name: 'qwen2.5:7b',   tier: 'balanced', sizeHint: '~5 GB',  desc: '문장 다듬기 · 균형 잡힌 선택' },
  { name: 'phi4-mini',    tier: 'fast',     sizeHint: '~2.5 GB', desc: '빠름 · 영한 혼용 문서에 적합' },
  { name: 'gemma3:4b',    tier: 'balanced', sizeHint: '~3 GB',  desc: '균형 · 자연스러운 한국어 생성' },
  { name: 'llama3.2:3b',  tier: 'fast',     sizeHint: '~2 GB',  desc: '빠른 Llama 계열' },
  { name: 'llama3.1:8b',  tier: 'balanced', sizeHint: '~5 GB',  desc: '안정적인 8B 모델' },
];

// ─── Pull progress state ──────────────────────────────────────────────────────

interface PullState {
  name: string;
  status: string;
  progress: number; // 0–100
  done: boolean;
  error: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Tab = 'installed' | 'install';

export function ModelPicker({ models, selectedModel, onSelect, onRefresh }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('installed');
  const [customName, setCustomName] = useState('');
  const [pulls, setPulls] = useState<PullState[]>([]);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const abortRefs = useRef<Map<string, AbortController>>(new Map());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isInstalled = useCallback((name: string) => models.some((m) => m.name === name), [models]);
  const isPulling = useCallback((name: string) => pulls.some((p) => p.name === name && !p.done && !p.error), [pulls]);

  const startPull = useCallback(async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed || isPulling(trimmed)) return;

    const controller = new AbortController();
    abortRefs.current.set(trimmed, controller);

    setPulls((prev) => [
      ...prev.filter((p) => p.name !== trimmed),
      { name: trimmed, status: '연결 중...', progress: 0, done: false, error: null },
    ]);

    try {
      for await (const chunk of pullModel(trimmed, controller.signal)) {
        const progress =
          chunk.total && chunk.completed
            ? Math.round((chunk.completed / chunk.total) * 100)
            : 0;

        setPulls((prev) =>
          prev.map((p) =>
            p.name === trimmed
              ? {
                  ...p,
                  status: chunk.status,
                  progress: chunk.status === 'success' ? 100 : progress || p.progress,
                  done: chunk.status === 'success',
                }
              : p
          )
        );

        if (chunk.status === 'success') {
          onRefresh();
        }
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        setPulls((prev) => prev.filter((p) => p.name !== trimmed));
      } else {
        setPulls((prev) =>
          prev.map((p) =>
            p.name === trimmed
              ? { ...p, error: (err as Error).message, done: false }
              : p
          )
        );
      }
    } finally {
      abortRefs.current.delete(trimmed);
    }
  }, [isPulling, onRefresh]);

  const cancelPull = useCallback((name: string) => {
    abortRefs.current.get(name)?.abort();
  }, []);

  const dismissPull = useCallback((name: string) => {
    setPulls((prev) => prev.filter((p) => p.name !== name));
  }, []);

  const handleDelete = useCallback(async (name: string) => {
    if (!confirm(`"${name}" 모델을 삭제하시겠습니까?`)) return;
    setDeletingModel(name);
    try {
      await deleteModel(name);
      if (selectedModel === name) onSelect('');
      onRefresh();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeletingModel(null);
    }
  }, [selectedModel, onSelect, onRefresh]);

  // ── Current model indicator ──
  const currentMeta = models.find((m) => m.name === selectedModel);
  const currentTier = currentMeta ? getModelMeta(currentMeta).tier : null;
  const tierInfo = currentTier ? tierStyle[currentTier] : null;

  return (
    <div className="relative" ref={ref}>
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs bg-white/10 border border-white/20 hover:bg-white/20 transition-colors text-white"
        title="모델 선택"
      >
        {tierInfo && <span className={tierInfo.text}>{tierInfo.icon}</span>}
        <span className="max-w-[120px] truncate">{selectedModel ?? '모델 선택'}</span>
        <ChevronDown className={`w-3 h-3 text-white/50 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-[340px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            {(['installed', 'install'] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium transition-colors ${
                  tab === t
                    ? 'text-blue-600 border-b-2 border-blue-500 bg-blue-50/50'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t === 'installed' ? <List className="w-3.5 h-3.5" /> : <PackagePlus className="w-3.5 h-3.5" />}
                {t === 'installed' ? '설치된 모델' : '모델 설치'}
              </button>
            ))}
            <button
              onClick={() => { onRefresh(); }}
              className="px-3 text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-l border-gray-200"
              title="새로고침"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ── Tab: 설치된 모델 ── */}
          {tab === 'installed' && (
            <>
              {/* Speed legend */}
              <div className="flex gap-1.5 px-3 py-2 border-b border-gray-100 bg-gray-50">
                {(['fast', 'balanced', 'powerful'] as SpeedTier[]).map((tier) => {
                  const s = tierStyle[tier];
                  const labels = { fast: '빠름', balanced: '균형', powerful: '강력' };
                  return (
                    <span key={tier} className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium ${s.bg}`}>
                      {s.icon}{labels[tier]}
                    </span>
                  );
                })}
              </div>

              <div className="max-h-64 overflow-y-auto">
                {models.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">설치된 모델이 없습니다.</p>
                    <button onClick={() => setTab('install')} className="mt-2 text-xs text-blue-500 hover:underline">
                      모델 설치하기 →
                    </button>
                  </div>
                ) : (
                  models.map((model) => {
                    const meta = getModelMeta(model);
                    const style = tierStyle[meta.tier];
                    const isSelected = model.name === selectedModel;
                    const isDeleting = deletingModel === model.name;

                    return (
                      <div
                        key={model.name}
                        className={`flex items-center gap-2 px-3 py-2.5 border-b border-gray-50 last:border-0 transition-colors ${
                          isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                        }`}
                      >
                        <button
                          onClick={() => { onSelect(model.name); setOpen(false); }}
                          className="flex-1 text-left min-w-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className={`shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${style.bg}`}>
                              {style.icon}{meta.label}
                            </span>
                            <span className="text-sm font-medium text-gray-900 truncate">{model.name}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 pl-[52px]">
                            {formatSize(model.size)} · {meta.desc}
                          </p>
                        </button>
                        <button
                          onClick={() => handleDelete(model.name)}
                          disabled={isDeleting}
                          className="p-1.5 rounded text-gray-300 hover:text-red-400 hover:bg-red-50 transition-colors shrink-0"
                          title="삭제"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </>
          )}

          {/* ── Tab: 모델 설치 ── */}
          {tab === 'install' && (
            <div className="flex flex-col">
              {/* Custom input */}
              <div className="flex gap-1.5 p-3 border-b border-gray-100">
                <input
                  type="text"
                  value={customName}
                  onChange={(e) => setCustomName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && startPull(customName)}
                  placeholder="모델 이름 (예: qwen2.5:1.5b)"
                  className="flex-1 text-xs px-2.5 py-1.5 border border-gray-300 rounded focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
                />
                <button
                  onClick={() => { startPull(customName); setCustomName(''); }}
                  disabled={!customName.trim()}
                  className="px-2.5 py-1.5 text-xs font-medium bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-40 transition-colors flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  설치
                </button>
              </div>

              {/* Active pulls */}
              {pulls.length > 0 && (
                <div className="border-b border-gray-100">
                  {pulls.map((p) => (
                    <div key={p.name} className="px-3 py-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-gray-700 truncate max-w-[200px]">{p.name}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {p.done && (
                            <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
                              <Check className="w-3 h-3" />완료
                            </span>
                          )}
                          {!p.done && !p.error && (
                            <button onClick={() => cancelPull(p.name)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {(p.done || p.error) && (
                            <button onClick={() => dismissPull(p.name)} className="p-0.5 rounded hover:bg-gray-100 text-gray-400">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {p.error ? (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="w-3 h-3 shrink-0" />
                          <span className="truncate">{p.error}</span>
                        </div>
                      ) : (
                        <>
                          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${p.done ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${p.done ? 100 : Math.max(p.progress, p.status !== '연결 중...' ? 5 : 0)}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">{p.status}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Recommended list */}
              <div className="max-h-56 overflow-y-auto">
                <p className="text-xs font-medium text-gray-400 px-3 py-2">추천 모델</p>
                {RECOMMENDED.map((rec) => {
                  const style = tierStyle[rec.tier];
                  const installed = isInstalled(rec.name);
                  const pulling = isPulling(rec.name);

                  return (
                    <div
                      key={rec.name}
                      className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 border-b border-gray-50 last:border-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`shrink-0 flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded-full font-medium ${style.bg}`}>
                            {style.icon}{rec.tier === 'fast' ? '빠름' : rec.tier === 'balanced' ? '균형' : '강력'}
                          </span>
                          <span className="text-sm font-medium text-gray-800 truncate">{rec.name}</span>
                          <span className="text-xs text-gray-400 shrink-0">{rec.sizeHint}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5 pl-[52px]">{rec.desc}</p>
                      </div>

                      {installed ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-0.5 shrink-0">
                          <Check className="w-3.5 h-3.5" />설치됨
                        </span>
                      ) : (
                        <button
                          onClick={() => startPull(rec.name)}
                          disabled={pulling}
                          className="shrink-0 flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50 transition-colors"
                        >
                          <Download className="w-3 h-3" />
                          {pulling ? '설치 중...' : '설치'}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
