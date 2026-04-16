import { useEffect, useId, useRef } from 'react';

interface ConfirmReplaceModalProps {
  fileName: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmReplaceModal({
  fileName,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmReplaceModalProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!loading) cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (loading) return;
      if (e.key === 'Escape') {
        e.stopImmediatePropagation();
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const cancel = cancelRef.current;
        const confirm = confirmRef.current;
        if (!cancel || !confirm) return;
        if (e.shiftKey) {
          if (document.activeElement === cancel) {
            e.preventDefault();
            confirm.focus();
          }
        } else {
          if (document.activeElement === confirm) {
            e.preventDefault();
            cancel.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [onCancel, loading]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => !loading && e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-white rounded-lg shadow-xl w-80 p-6 flex flex-col gap-4"
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-8 h-8 border-3 border-gray-200 border-t-[#2b579a] rounded-full animate-spin" />
            <p className="text-sm text-gray-600">파일을 불러오는 중...</p>
            <p className="text-sm text-[#2b579a] font-medium truncate max-w-full" title={fileName}>
              {fileName}
            </p>
          </div>
        ) : (
          <>
            <div>
              <p id={titleId} className="text-base font-semibold text-gray-900">새로 업로드하시겠습니까?</p>
              <p id={descId} className="mt-1 text-sm text-gray-500">기존의 편집중인 파일은 삭제됩니다.</p>
              <p className="mt-2 text-sm text-[#2b579a] font-medium truncate" title={fileName}>
                {fileName}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                ref={cancelRef}
                onClick={onCancel}
                className="px-4 py-2 text-sm rounded border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                아니오
              </button>
              <button
                ref={confirmRef}
                onClick={onConfirm}
                className="px-4 py-2 text-sm rounded bg-red-600 text-white hover:bg-red-700 transition-colors"
              >
                예, 교체합니다
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
