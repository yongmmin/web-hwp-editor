import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText } from 'lucide-react';
import { useFileUpload } from '../../hooks/useFileUpload';
import { useDocumentStore } from '../../stores/documentStore';

export function FileUploader() {
  const { handleFile } = useFileUpload();
  const { isLoading, error } = useDocumentStore();

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        handleFile(acceptedFiles[0]);
      }
    },
    [handleFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/x-hwp': ['.hwp'],
      'application/hwp+zip': ['.hwpx'],
    },
    multiple: false,
    disabled: isLoading,
  });

  return (
    <div className="flex flex-col items-center justify-center">
      {/* A4 용지 모양 업로드 영역 */}
      <div
        {...getRootProps()}
        className={`
          w-[210mm] max-w-[90vw] aspect-[210/297] max-h-[70vh]
          bg-white shadow-lg cursor-pointer
          flex flex-col items-center justify-center
          transition-all
          ${isDragActive
            ? 'ring-4 ring-blue-400 ring-opacity-50 scale-[1.01]'
            : 'hover:shadow-xl'
          }
          ${isLoading ? 'opacity-60 cursor-wait' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center gap-5 text-center px-8">
          {isLoading ? (
            <div className="animate-spin rounded-full h-14 w-14 border-[3px] border-gray-200 border-t-[#2b579a]" />
          ) : isDragActive ? (
            <Upload className="w-14 h-14 text-[#2b579a]" />
          ) : (
            <FileText className="w-14 h-14 text-gray-300" />
          )}

          <div>
            <p className="text-base font-medium text-gray-800">
              {isLoading
                ? '문서를 불러오는 중...'
                : isDragActive
                  ? '여기에 놓으세요'
                  : '한글 문서를 여기에 놓거나 클릭하세요'}
            </p>
            <p className="mt-2 text-sm text-gray-400">
              HWP, HWPX 파일 지원
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm max-w-lg w-full text-center">
          {error}
        </div>
      )}
    </div>
  );
}
