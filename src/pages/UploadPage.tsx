import { useState, useCallback } from 'react';
import { FileUploadZone } from '../components/upload/FileUploadZone';
import { ColumnMap } from '../components/upload/ColumnMap';
import { Button } from '../components/ui/Button';
import { parseUploadedFile, parseZipMapping } from '../lib/parseFile';
import type { ParsedFile, UploadState } from '../types';
import { Zap } from 'lucide-react';

interface UploadPageProps {
  onAnalyze: (file: ParsedFile, zipMap: Record<string, string>) => void;
}

export function UploadPage({ onAnalyze }: UploadPageProps) {
  const [mainFile, setMainFile] = useState<UploadState>({
    status: 'idle',
    file: null,
    zipMap: {},
    error: null,
  });

  const [zipState, setZipState] = useState<{
    status: 'idle' | 'parsing' | 'ready' | 'error';
    filename?: string;
    map: Record<string, string>;
    error?: string;
  }>({ status: 'idle', map: {} });

  const handleMainFile = useCallback(async (file: File) => {
    setMainFile(s => ({ ...s, status: 'parsing', error: null }));
    try {
      const parsed = await parseUploadedFile(file);
      setMainFile(s => ({ ...s, status: 'ready', file: parsed }));
    } catch (err) {
      setMainFile(s => ({
        ...s,
        status: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }));
    }
  }, []);

  const handleZipFile = useCallback(async (file: File) => {
    setZipState({ status: 'parsing', map: {}, filename: file.name });
    try {
      const map = await parseZipMapping(file);
      setZipState({ status: 'ready', map, filename: file.name });
    } catch {
      setZipState({ status: 'error', map: {}, error: 'Could not parse zip mapping file.' });
    }
  }, []);

  const handleClearMain = useCallback(() => {
    setMainFile({ status: 'idle', file: null, zipMap: {}, error: null });
  }, []);

  const handleClearZip = useCallback(() => {
    setZipState({ status: 'idle', map: {} });
  }, []);

  const canAnalyze = mainFile.status === 'ready' && mainFile.file !== null;

  const handleRun = useCallback(() => {
    if (!mainFile.file) return;
    onAnalyze(mainFile.file, zipState.map);
  }, [mainFile.file, zipState.map, onAnalyze]);

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

        {/* Main file upload */}
        <div className="space-y-4 mb-6">
          <FileUploadZone
            label="Case Data File"
            description="Accepts .xlsx, .xls, .csv — first sheet is used"
            accept=".xlsx,.xls,.csv"
            required
            status={mainFile.status}
            filename={mainFile.file?.filename}
            rowCount={mainFile.file?.rowCount}
            error={mainFile.error ?? undefined}
            onFile={handleMainFile}
            onClear={handleClearMain}
          />

          {/* Column detection */}
          {mainFile.status === 'ready' && mainFile.file && (
            <ColumnMap file={mainFile.file} />
          )}
        </div>

        {/* Zip mapping upload */}
        <div className="mb-8">
          <FileUploadZone
            label="ZIP Code → Area Mapping"
            description="Two-column file: ZIP/Postcode + Area/Region"
            accept=".xlsx,.xls,.csv"
            status={zipState.status}
            filename={zipState.filename}
            rowCount={Object.keys(zipState.map).length}
            error={zipState.error}
            onFile={handleZipFile}
            onClear={handleClearZip}
          />
          {zipState.status === 'ready' && (
            <p className="text-xs text-[#a6aec4] mt-2 pl-1">
              {Object.keys(zipState.map).length} zip codes mapped to areas
            </p>
          )}
        </div>

        {/* Run analysis */}
        <Button
          variant="primary"
          size="md"
          disabled={!canAnalyze}
          onClick={handleRun}
          className="w-full justify-center py-3 text-sm"
        >
          <Zap size={14} />
          Run Intelligence Analysis
        </Button>

        {!canAnalyze && mainFile.status === 'idle' && (
          <p className="text-xs text-[#a6aec4] text-center mt-3">
            Upload a case data file to continue
          </p>
        )}
      </div>
    </div>
  );
}
