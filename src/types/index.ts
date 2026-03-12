// Raw record as parsed from the uploaded file
export interface RawRecord {
  [key: string]: string | number | Date | null;
}

// Normalised record after header mapping
export interface NormalisedRecord {
  subject?: string;
  description?: string;
  isr_details?: string;
  customer?: string;
  transporter?: string;
  zip?: string;
  area?: string;
  date?: Date | null;
  status?: string;
  priority?: string;
  category?: string;
  hours?: number;
  // Keep all original fields too
  _raw: RawRecord;
}

// Result of parsing an uploaded file
export interface ParsedFile {
  filename: string;
  rowCount: number;
  headers: string[];
  columnMap: Partial<Record<keyof Omit<NormalisedRecord, '_raw'>, string>>;
  records: NormalisedRecord[];
}

// Upload state for the UI
export interface UploadState {
  status: 'idle' | 'parsing' | 'ready' | 'error';
  file: ParsedFile | null;
  zipMap: Record<string, string>;
  error: string | null;
}

// Navigation sections
export type ViewId =
  | 'upload'
  | 'summary'
  | 'issues'
  | 'customers'
  | 'transporters'
  | 'customs'
  | 'areas'
  | 'predictive'
  | 'actions'
  | 'drilldown'
  | 'explorer';
