import { useState, useCallback } from 'react';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { Button } from '../components/ui/Button';
import { uploadFile } from '../api';
import type { AnalysisResult } from '../types/analysis';
import { Zap } from 'lucide-react';

interface UploadPageProps {
  onAnalyze: (result: AnalysisResult) => void;
}

export function UploadPage({ onAnalyze }: UploadPageProps) {
  const [fileState, setFileState] = useState<{
    status: 'idle' | 'uploading' | 'ready' | 'error';
    filename?: string;
    rowCount?: number;
    error?: string;
    file: File | null;
  }>({ status: 'idle', file: null });

  const handleFile = useCallback((file: File) => {
    setFileState({ status: 'ready', filename: file.name, file });
  }, []);

  const handleClear = useCallback(() => {
    setFileState({ status: 'idle', file: null });
  }, []);

  const handleRun = useCallback(async () => {
    if (!fileState.file) return;
    setFileState(s => ({ ...s, status: 'uploading', error: undefined }));
    try {
      const result = await uploadFile(fileState.file);
      onAnalyze(result);
    } catch (err) {
      setFileState(s => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      }));
    }
  }, [fileState.file, onAnalyze]);

  const canRun = fileState.status === 'ready' && fileState.file !== null;
  const isLoading = fileState.status === 'uploading';

  return (
    <div className="min-h-full flex items-start justify-center pt-16 pb-16 px-8">
      <div className="w-full max-w-2xl">

        {/* Heading */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#8b7cff]/10 border border-[#8b7cff]/20 text-[#8b7cff] text-xs font-medium mb-5">
            <Zap size={11} />
            Operational Intelligence Suite
          </div>
          <h1 className="text-2xl font-semibold text-[#eceff7] mb-2">Upload your case data</h1>
          <p className="text-sm text-[#a6aec4] leading-relaxed max-w-md">
            Upload a weekly case management export. The engine analyses Subject, Description,
            and ISR Details in full to surface issue patterns, customer burden, and predictive risks.
          </p>
        </div>

        {/* File upload */}
        <div className="space-y-4 mb-8">
          <FileUploadZone
            label="Case Data File"
            description="Accepts .xlsx, .xls, .csv — first sheet is used"
            accept=".xlsx,.xls,.csv"
            required
            status={isLoading ? 'parsing' : fileState.status === 'uploading' ? 'parsing' : fileState.status}
            filename={fileState.filename}
            rowCount={fileState.rowCount}
            error={fileState.error}
            onFile={handleFile}
            onClear={handleClear}
          />
        </div>

        {/* Run analysis */}
        <Button
          variant="primary"
          size="md"
          disabled={!canRun || isLoading}
          onClick={handleRun}
          className="w-full justify-center py-3 text-sm"
        >
          <Zap size={14} />
          {isLoading ? 'Analysing…' : 'Run Intelligence Analysis'}
        </Button>

        {!canRun && !isLoading && fileState.status === 'idle' && (
          <p className="text-xs text-[#a6aec4] text-center mt-3">
            Upload a case data file to continue
          </p>
        )}

        {isLoading && (
          <p className="text-xs text-[#a6aec4] text-center mt-3">
            Sending file to backend — this may take a few seconds…
          </p>
        )}
      </div>
    </div>
  );
}
