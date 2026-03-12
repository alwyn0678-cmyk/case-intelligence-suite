// ─────────────────────────────────────────────────────────────────
// Full Classified Case Export
//
// Exports ALL enriched/classified records to Excel (.xlsx).
// Includes every original and derived field — Subject and Description
// are included in full (no truncation) so that the output can be
// reviewed externally for accuracy checking.
//
// Use this export (not exportEvidence.ts) when you need the raw
// classifier output for an accuracy audit.
// ─────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import type { EnrichedRecord } from '../types/analysis';
import { TAXONOMY_MAP } from './taxonomy';

// ── Column headers ───────────────────────────────────────────────

const EXPORT_HEADERS = [
  'Case Number',
  'Week',
  'Account Name',
  'Subject',
  'Description',
  'ISR Details',
  'Date',
  'Status',
  'Priority',
  'Category',
  'Hours',
  'Resolved Customer',
  'Resolved Transporter',
  'Resolved Depot / Terminal',
  'Resolved Deepsea Terminal',
  'Resolved Area',
  'Primary Issue',
  'Secondary Issue',
  'Issue State',
  'Confidence %',
  'Review Flag',
  'Unresolved Reason',
  'Booking Ref',
  'Load Ref',
  'Container / Equipment',
  'MRN / T1 Ref',
  'ZIP',
  'Routing Hint',
  'Routing Alignment',
  'Source Type',
  'Source Fields Used',
  'Evidence',
];

// ── Column widths ────────────────────────────────────────────────

const COL_WIDTHS: { wch: number }[] = [
  { wch: 18 },  // Case Number
  { wch: 12 },  // Week
  { wch: 28 },  // Account Name
  { wch: 80 },  // Subject (full — not truncated)
  { wch: 120 }, // Description (full — not truncated)
  { wch: 60 },  // ISR Details
  { wch: 14 },  // Date
  { wch: 12 },  // Status
  { wch: 10 },  // Priority
  { wch: 20 },  // Category
  { wch: 8 },   // Hours
  { wch: 28 },  // Resolved Customer
  { wch: 24 },  // Resolved Transporter
  { wch: 24 },  // Resolved Depot / Terminal
  { wch: 28 },  // Resolved Deepsea Terminal
  { wch: 24 },  // Resolved Area
  { wch: 32 },  // Primary Issue
  { wch: 32 },  // Secondary Issue
  { wch: 16 },  // Issue State
  { wch: 12 },  // Confidence %
  { wch: 12 },  // Review Flag
  { wch: 40 },  // Unresolved Reason
  { wch: 16 },  // Booking Ref
  { wch: 16 },  // Load Ref
  { wch: 16 },  // Container / Equipment
  { wch: 20 },  // MRN / T1 Ref
  { wch: 12 },  // ZIP
  { wch: 28 },  // Routing Hint
  { wch: 18 },  // Routing Alignment
  { wch: 16 },  // Source Type
  { wch: 40 },  // Source Fields Used
  { wch: 80 },  // Evidence
];

// ── Issue label lookup ───────────────────────────────────────────

function issueLabel(id: string | null | undefined): string {
  if (!id) return '';
  return TAXONOMY_MAP[id]?.label ?? id;
}

// ── Row converter ────────────────────────────────────────────────

function enrichedToRow(r: EnrichedRecord): (string | number)[] {
  // Extract specific references from evidence array
  const loadRef = r.evidence.find(e => e.startsWith('ref[load_ref]='))?.slice('ref[load_ref]='.length) ?? '';
  const container = r.evidence.find(e => e.startsWith('ref[container]='))?.slice('ref[container]='.length)
                 ?? r.evidence.find(e => e.startsWith('ref[equipment]='))?.slice('ref[equipment]='.length)
                 ?? '';
  const mrnRef = r.evidence.find(e => e.startsWith('ref[mrn]='))?.slice('ref[mrn]='.length)
              ?? r.evidence.find(e => e.startsWith('ref[t1_mrn]='))?.slice('ref[t1_mrn]='.length)
              ?? '';

  // Source type: Internal ISR if isr_details field has substantive content
  const sourceType = (r.isr_details?.trim().length ?? 0) > 5 ? 'Internal ISR' : 'External';

  // Format date
  const dateStr = r.date instanceof Date && !isNaN(r.date.getTime())
    ? r.date.toISOString().slice(0, 10)
    : (typeof r.date === 'string' ? r.date : '');

  return [
    r.case_number              ?? '',
    r.weekKey                  ?? '',
    r.customer                 ?? '',
    r.subject                  ?? '',
    r.description              ?? '',
    r.isr_details              ?? '',
    dateStr,
    r.status                   ?? '',
    r.priority                 ?? '',
    r.category                 ?? '',
    r.hours != null ? r.hours : '',
    r.resolvedCustomer         ?? '',
    r.resolvedTransporter      ?? '',
    r.resolvedDepot            ?? '',
    r.resolvedDeepseaTerminal  ?? '',
    r.resolvedArea             ?? '',
    issueLabel(r.primaryIssue),
    issueLabel(r.secondaryIssue ?? ''),
    r.issueState               ?? '',
    parseFloat((r.confidence * 100).toFixed(1)),
    r.reviewFlag ? 'Yes' : 'No',
    r.unresolvedReason         ?? '',
    r.booking_ref              ?? '',
    loadRef,
    container,
    mrnRef,
    r.extractedZip             ?? '',
    r.routingHint              ?? '',
    r.routingAlignment         ?? '',
    sourceType,
    r.sourceFieldsUsed?.join(', ') ?? '',
    r.evidence?.join(' | ')    ?? '',
  ];
}

// ── Public export function ───────────────────────────────────────

/**
 * Triggers a browser download of an Excel file containing ALL classified
 * records with every original and derived field.
 *
 * Subject and Description are included in full — no truncation.
 *
 * @param title    Used as the worksheet name and filename prefix.
 * @param records  All EnrichedRecord rows to export (no cap).
 *                 Pass a filtered subset for a per-issue/customer/etc. export.
 */
export function exportEnrichedToXlsx(title: string, records: EnrichedRecord[]): void {
  if (records.length === 0) return;

  const rows: (string | number)[][] = [
    EXPORT_HEADERS,
    ...records.map(enrichedToRow),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet['!cols'] = COL_WIDTHS;

  // Bold header row
  for (let col = 0; col < EXPORT_HEADERS.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = { font: { bold: true } };
    }
  }

  const workbook = XLSX.utils.book_new();
  const sheetName = title.slice(0, 31).replace(/[/\\?*[\]]/g, '-');
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `CIS_Classified_${safeTitle}_${timestamp}.xlsx`);
}
