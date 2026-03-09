import React, { useCallback, useRef, useState } from 'react';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, X } from 'lucide-react';

interface FileUploadZoneProps {
  label: string;
  description: string;
  accept: string;
  required?: boolean;
  status?: 'idle' | 'parsing' | 'ready' | 'error';
  filename?: string;
  rowCount?: number;
  error?: string;
  onFile: (file: File) => void;
  onClear?: () => void;
}

export function FileUploadZone({
  label,
  description,
  accept,
  required = false,
  status = 'idle',
  filename,
  rowCount,
  error,
  onFile,
  onClear,
}: FileUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) onFile(file);
    },
    [onFile],
  );

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFile(file);
      e.target.value = '';
    },
    [onFile],
  );

  const isReady = status === 'ready';
  const isParsing = status === 'parsing';
  const isError = status === 'error';

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-medium text-[#eceff7]">{label}</span>
        {required ? (
          <span className="text-xs text-[#dc6d7d] font-medium">Required</span>
        ) : (
          <span className="text-xs text-[#a6aec4]">Optional</span>
        )}
      </div>

      {!isReady ? (
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={[
            'relative border-2 border-dashed rounded-xl px-8 py-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all',
            dragging
              ? 'border-[#8b7cff] bg-[#8b7cff]/5'
              : isError
                ? 'border-[#dc6d7d]/40 bg-[#dc6d7d]/3 hover:border-[#dc6d7d]/70'
                : 'border-[#2a2f3f] bg-[#171922] hover:border-[#8b7cff]/50 hover:bg-[#8b7cff]/3',
          ].join(' ')}
        >
          {isParsing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-6 h-6 border-2 border-[#8b7cff]/30 border-t-[#8b7cff] rounded-full animate-spin" />
              <span className="text-sm text-[#a6aec4]">Parsing file…</span>
            </div>
          ) : isError ? (
            <>
              <AlertCircle size={28} className="text-[#dc6d7d]" />
              <div className="text-center">
                <p className="text-sm text-[#dc6d7d] font-medium">Failed to parse file</p>
                <p className="text-xs text-[#a6aec4] mt-1">{error}</p>
                <p className="text-xs text-[#a6aec4] mt-2">Click to try another file</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-11 h-11 rounded-xl bg-[#8b7cff]/10 border border-[#8b7cff]/20 flex items-center justify-center">
                <Upload size={20} className="text-[#8b7cff]" />
              </div>
              <div className="text-center">
                <p className="text-sm text-[#eceff7]">Drop file here or <span className="text-[#8b7cff]">browse</span></p>
                <p className="text-xs text-[#a6aec4] mt-1">{description}</p>
              </div>
            </>
          )}
          <input ref={inputRef} type="file" accept={accept} className="sr-only" onChange={handleChange} />
        </div>
      ) : (
        /* Ready state */
        <div className="border border-[#2a2f3f] rounded-xl px-5 py-4 bg-[#171922] flex items-center gap-4">
          <div className="w-9 h-9 rounded-lg bg-[#52c7c7]/10 border border-[#52c7c7]/20 flex items-center justify-center shrink-0">
            <FileSpreadsheet size={18} className="text-[#52c7c7]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-[#eceff7] font-medium truncate">{filename}</p>
            <p className="text-xs text-[#a6aec4] mt-0.5">
              <CheckCircle size={10} className="inline mr-1 text-[#52c7c7]" />
              {rowCount?.toLocaleString()} rows parsed
            </p>
          </div>
          {onClear && (
            <button
              onClick={onClear}
              className="text-[#a6aec4] hover:text-[#eceff7] transition-colors p-1 cursor-pointer"
              title="Remove file"
            >
              <X size={15} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
