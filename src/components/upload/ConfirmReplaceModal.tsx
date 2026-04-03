import { useEffect, useId, useRef } from 'react';

interface ConfirmReplaceModalProps {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmReplaceModal({ fileName, onConfirm, onCancel }: ConfirmReplaceModalProps) {
  const titleId = useId();
  const descId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
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
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => e.target === e.currentTarget && onCancel()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="bg-white rounded-lg shadow-xl w-80 p-6 flex flex-col gap-4"
      >
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
      </div>
    </div>
  );
}
