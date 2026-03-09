import * as XLSX from 'xlsx';
import type { RawRecord, NormalisedRecord, ParsedFile } from '../types';

// Maps known column name variants to a standard key
const COLUMN_ALIASES: Record<string, string[]> = {
  subject:     ['subject', 'title', 'case subject', 'case title', 'onderwerp', 'email subject'],
  description: ['description', 'desc', 'case description', 'body', 'email body', 'message body', 'comments', 'details'],
  isr_details: ['isr details', 'isr_details', 'isr', 'isr detail', 'sr details', 'internal details'],
  customer:    ['customer', 'account', 'client', 'company', 'klant', 'account name', 'customer name', 'debtor'],
  transporter: ['transporter', 'haulier', 'carrier', 'hauler', 'transport company', 'vervoerder'],
  zip:         ['zip', 'postcode', 'post code', 'zip code', 'zipcode', 'postal code', 'postal_code'],
  area:        ['area', 'region', 'zone', 'terminal', 'location', 'hub', 'site'],
  date:        ['date', 'created date', 'creation date', 'created at', 'created_at', 'closed date', 'datum', 'opened'],
  status:      ['status', 'case status', 'state', 'resolution'],
  priority:    ['priority', 'urgency', 'severity'],
  category:    ['category', 'type', 'case type', 'issue type', 'categorie'],
  hours:       ['hours', 'time spent', 'duration', 'effort', 'uren'],
};

function normaliseHeaderName(header: string): string | null {
  const h = header.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(a => h === a || h.includes(a))) return key;
  }
  return null;
}

function parseFlexDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' && val > 1000) {
    // Excel serial number — XLSX with cellDates:true usually handles this,
    // but as a fallback:
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function scoreHeaderRow(row: unknown[]): number {
  let score = 0;
  for (const cell of row) {
    if (normaliseHeaderName(String(cell ?? ''))) score++;
  }
  return score;
}

export async function parseUploadedFile(file: File): Promise<ParsedFile> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Read raw arrays first to detect header row (some exports have metadata rows above)
  const rawArrays: unknown[][] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });
  if (!rawArrays.length) throw new Error('File is empty or has no readable rows.');

  // Find the row with the most recognisable column names (search first 30 rows)
  let headerRowIndex = 0;
  let bestScore = scoreHeaderRow(rawArrays[0]);
  for (let i = 1; i < Math.min(rawArrays.length, 30); i++) {
    const s = scoreHeaderRow(rawArrays[i]);
    if (s > bestScore) { bestScore = s; headerRowIndex = i; }
  }

  // Re-parse from that header row
  const ws2 = wb.Sheets[sheetName];
  const raw: RawRecord[] = XLSX.utils.sheet_to_json(ws2, { defval: '', range: headerRowIndex });

  if (!raw.length) throw new Error('File is empty or has no readable rows.');

  const headers = Object.keys(raw[0]);

  // Build column map: standardKey → original header name
  const columnMap: Partial<Record<string, string>> = {};
  for (const h of headers) {
    const mapped = normaliseHeaderName(h);
    if (mapped && !columnMap[mapped]) columnMap[mapped] = h;
  }

  // Normalise each row
  const records: NormalisedRecord[] = raw.map(row => {
    const norm: NormalisedRecord = { _raw: row };
    for (const [stdKey, origHeader] of Object.entries(columnMap)) {
      const val = row[origHeader as string];
      if (stdKey === 'date') {
        norm.date = parseFlexDate(val);
      } else if (stdKey === 'hours') {
        norm.hours = val ? parseFloat(String(val)) || undefined : undefined;
      } else {
        (norm as unknown as Record<string, unknown>)[stdKey] = val ? String(val).trim() : undefined;
      }
    }
    return norm;
  });

  return {
    filename: file.name,
    rowCount: records.length,
    headers,
    columnMap: columnMap as ParsedFile['columnMap'],
    records,
  };
}

export async function parseZipMapping(file: File): Promise<Record<string, string>> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: RawRecord[] = XLSX.utils.sheet_to_json(ws, { defval: '' });

  const map: Record<string, string> = {};
  for (const row of rows) {
    const zip  = Object.values(row)[0];
    const area = Object.values(row)[1];
    if (zip && area) map[String(zip).trim()] = String(area).trim();
  }
  return map;
}
