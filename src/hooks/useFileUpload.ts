import { useCallback } from 'react';
import { useDocumentStore } from '../stores/documentStore';
import { parseDocument } from '../services/hwp/hwpParser';

export function useFileUpload() {
  const { setDocument, setLoading, setError } = useDocumentStore();

  const handleFile = useCallback(
    async (file: File) => {
      const validExtensions = ['.hwp', '.hwpx'];
      const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));

      if (!validExtensions.includes(ext)) {
        setError('HWP 또는 HWPX 파일만 업로드할 수 있습니다.');
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const buffer = await file.arrayBuffer();
        const doc = await parseDocument(buffer, file.name);
        setDocument(doc, file.name);
      } catch (err) {
        const message = err instanceof Error ? err.message : '파일을 읽는 중 오류가 발생했습니다.';
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [setDocument, setLoading, setError]
  );

  return { handleFile };
}
