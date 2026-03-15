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
  'Detected Intent',
  'Detected Object',
  'Trigger Phrase',
  'Trigger Source Field',
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
  { wch: 18 },  // Detected Intent
  { wch: 30 },  // Detected Object
  { wch: 60 },  // Trigger Phrase
  { wch: 20 },  // Trigger Source Field
  { wch: 80 },  // Evidence
];

// ── Issue label lookup ───────────────────────────────────────────

function issueLabel(id: string | null | undefined): string {
  if (!id) return '';
  return TAXONOMY_MAP[id]?.label ?? id;
}

// ── Row converter ────────────────────────────────────────────────

function enrichedToRow(r: EnrichedRecord): (string | number)[] {
  // Use dedicated extraction fields (populated by classifyCase); fall back to evidence parsing for legacy records
  const loadRef   = r.loadRefExtracted
                 ?? r.evidence.find(e => e.startsWith('ref[load_ref]='))?.slice('ref[load_ref]='.length)
                 ?? '';
  const container = r.containerExtracted
                 ?? r.evidence.find(e => e.startsWith('ref[container]='))?.slice('ref[container]='.length)
                 ?? r.evidence.find(e => e.startsWith('ref[equipment]='))?.slice('ref[equipment]='.length)
                 ?? '';
  const mrnRef   = r.mrnRefExtracted
                 ?? r.evidence.find(e => e.startsWith('ref[mrn]='))?.slice('ref[mrn]='.length)
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
    r.booking_ref ?? r.bookingRefExtracted ?? '',
    loadRef,
    container,
    mrnRef,
    r.extractedZip             ?? '',
    r.routingHint              ?? '',
    r.routingAlignment         ?? '',
    sourceType,
    r.sourceFieldsUsed?.join(', ') ?? '',
    r.detectedIntent        ?? '',
    r.detectedObject        ?? '',
    r.triggerPhrase         ?? '',
    r.triggerSourceField    ?? '',
    r.evidence?.join(' | ') ?? '',
  ];
}

// ── Shared worksheet builder ─────────────────────────────────────

function buildWorksheet(records: EnrichedRecord[]) {
  const rows: (string | number)[][] = [
    EXPORT_HEADERS,
    ...records.map(enrichedToRow),
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = COL_WIDTHS;
  for (let col = 0; col < EXPORT_HEADERS.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[cellRef]) ws[cellRef].s = { font: { bold: true } };
  }
  return ws;
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

  const workbook = XLSX.utils.book_new();
  const sheetName = title.slice(0, 31).replace(/[/\\?*[\]]/g, '-');
  XLSX.utils.book_append_sheet(workbook, buildWorksheet(records), sheetName);

  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `CIS_Classified_${safeTitle}_${timestamp}.xlsx`);
}

/**
 * Complete data extract — multi-tab Excel workbook.
 *
 * Sheet layout:
 *   "All Cases"         — every selected record, sorted by category then date
 *   "<Category label>"  — one sheet per category that has at least 1 record
 *
 * @param allRecords    Full classified dataset (analysis.records)
 * @param selectedIds   Issue IDs to include. Pass empty array to include all.
 * @param categoryLabels Map of issueId → human label (from issueBreakdown)
 */
export function exportAllCategoriesToXlsx(
  allRecords: EnrichedRecord[],
  selectedIds: string[],
  categoryLabels: Record<string, string>,
): void {
  // Filter to selected categories (empty = all)
  const filtered = selectedIds.length === 0
    ? [...allRecords]
    : allRecords.filter(r => selectedIds.includes(r.primaryIssue));

  if (filtered.length === 0) return;

  // Sort: by category label, then by date descending
  filtered.sort((a, b) => {
    const labelA = categoryLabels[a.primaryIssue] ?? a.primaryIssue;
    const labelB = categoryLabels[b.primaryIssue] ?? b.primaryIssue;
    if (labelA !== labelB) return labelA.localeCompare(labelB);
    const dA = a.date instanceof Date ? a.date.getTime() : 0;
    const dB = b.date instanceof Date ? b.date.getTime() : 0;
    return dB - dA;
  });

  const workbook = XLSX.utils.book_new();

  // Sheet 1: All selected records combined
  XLSX.utils.book_append_sheet(workbook, buildWorksheet(filtered), 'All Cases');

  // One sheet per category (max sheet name = 31 chars)
  const issueIds = selectedIds.length === 0
    ? [...new Set(filtered.map(r => r.primaryIssue))]
    : selectedIds;

  for (const id of issueIds) {
    const categoryRecords = filtered.filter(r => r.primaryIssue === id);
    if (categoryRecords.length === 0) continue;
    const label = categoryLabels[id] ?? id;
    const sheetName = label.slice(0, 31).replace(/[/\\?*[\]]/g, '-');
    XLSX.utils.book_append_sheet(workbook, buildWorksheet(categoryRecords), sheetName);
  }

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `CIS_Complete_Extract_${timestamp}.xlsx`);
}

// ── Health Check Export ──────────────────────────────────────────

/**
 * Generates a health check report and exports it to Excel.
 * Call after every analysis run to validate data quality.
 */
export function exportHealthCheck(records: EnrichedRecord[]): void {
  if (records.length === 0) return;

  const total = records.length;
  const otherCount = records.filter(r => r.primaryIssue === 'other').length;
  const otherPct = (otherCount / total * 100);
  const avgConf = records.reduce((s, r) => s + r.confidence, 0) / total;
  const sorted = [...records].map(r => r.confidence).sort((a, b) => a - b);
  const medianConf = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const lowConfCount = records.filter(r => r.confidence < 0.60).length;
  const lowConfPct = (lowConfCount / total * 100);

  // Extraction coverage
  const withTransporter = records.filter(r => r.resolvedTransporter).length;
  const withBooking     = records.filter(r => r.booking_ref || r.bookingRefExtracted).length;
  const withLoadRef     = records.filter(r => r.loadRefExtracted).length;
  const withContainer   = records.filter(r => r.containerExtracted).length;
  const withMRN         = records.filter(r => r.mrnRefExtracted).length;
  const withZip         = records.filter(r => r.extractedZip).length;
  const withCustomer    = records.filter(r => r.resolvedCustomer).length;

  // Distinct categories
  const distinctCategories = new Set(records.map(r => r.primaryIssue)).size;

  // State distribution
  const unknownState = records.filter(r => r.issueState === 'unknown').length;

  const healthRows: (string | number | boolean)[][] = [
    ['Health Check Metric', 'Value', 'Target', 'Status'],
    ['Total Rows', total, '—', '—'],
    ['Distinct Categories', distinctCategories, '≥5', distinctCategories >= 5 ? 'OK' : 'WARN'],
    ['Other / Unclassified Count', otherCount, '—', '—'],
    ['Other / Unclassified %', +otherPct.toFixed(1), '<15%', otherPct < 15 ? 'OK' : 'FAIL'],
    ['Average Confidence', +(avgConf * 100).toFixed(1) + '%', '>70%', avgConf > 0.70 ? 'OK' : 'FAIL'],
    ['Median Confidence', +(medianConf * 100).toFixed(1) + '%', '>60%', medianConf > 0.60 ? 'OK' : 'WARN'],
    ['Low Confidence Rows (<60%)', lowConfCount, '—', '—'],
    ['Low Confidence %', +lowConfPct.toFixed(1) + '%', '<35%', lowConfPct < 35 ? 'OK' : 'FAIL'],
    ['Unknown Issue State %', +((unknownState / total) * 100).toFixed(1) + '%', '<40%', (unknownState / total) < 0.40 ? 'OK' : 'WARN'],
    ['— Extraction Coverage —', '', '', ''],
    ['Resolved Customer', withCustomer, `/ ${total}`, +(withCustomer / total * 100).toFixed(1) + '%'],
    ['Resolved Transporter', withTransporter, `/ ${total}`, +(withTransporter / total * 100).toFixed(1) + '%'],
    ['Booking Ref Populated', withBooking, `/ ${total}`, +(withBooking / total * 100).toFixed(1) + '%'],
    ['Load Ref Populated', withLoadRef, `/ ${total}`, +(withLoadRef / total * 100).toFixed(1) + '%'],
    ['Container / Equipment Populated', withContainer, `/ ${total}`, +(withContainer / total * 100).toFixed(1) + '%'],
    ['MRN / T1 Ref Populated', withMRN, `/ ${total}`, +(withMRN / total * 100).toFixed(1) + '%'],
    ['ZIP Populated', withZip, `/ ${total}`, +(withZip / total * 100).toFixed(1) + '%'],
    ['— Thresholds —', '', '', ''],
    ['FAIL: Other > 15%', otherPct > 15, '', otherPct > 15 ? 'FAIL' : 'OK'],
    ['FAIL: Avg Conf < 70%', avgConf < 0.70, '', avgConf < 0.70 ? 'FAIL' : 'OK'],
    ['FAIL: Low Conf Rows > 35%', lowConfPct > 35, '', lowConfPct > 35 ? 'FAIL' : 'OK'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(healthRows);
  ws['!cols'] = [{ wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Health Check');
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `CIS_HealthCheck_${timestamp}.xlsx`);
}

// ── QA Debug Export ──────────────────────────────────────────────

const QA_HEADERS = [
  'Case Number', 'Primary Issue', 'Issue State', 'Confidence %', 'Review Flag',
  'Detected Intent', 'Trigger Phrase', 'Trigger Source Field', 'Unresolved Reason',
  'Booking Ref', 'Load Ref', 'Container', 'MRN', 'ZIP',
  'Resolved Customer', 'Resolved Transporter',
  'Subject', 'Evidence',
];

function buildQARow(r: EnrichedRecord): (string | number)[] {
  const loadRef   = r.loadRefExtracted
    ?? r.evidence.find(e => e.startsWith('ref[load_ref]='))?.slice('ref[load_ref]='.length) ?? '';
  const container = r.containerExtracted
    ?? r.evidence.find(e => e.startsWith('ref[container]='))?.slice('ref[container]='.length) ?? '';
  const mrnRef    = r.mrnRefExtracted
    ?? r.evidence.find(e => e.startsWith('ref[mrn]='))?.slice('ref[mrn]='.length) ?? '';
  return [
    r.case_number ?? '',
    issueLabel(r.primaryIssue),
    r.issueState ?? '',
    parseFloat((r.confidence * 100).toFixed(1)),
    r.reviewFlag ? 'Yes' : 'No',
    r.detectedIntent ?? '',
    r.triggerPhrase ?? '',
    r.triggerSourceField ?? '',
    r.unresolvedReason ?? '',
    r.booking_ref ?? r.bookingRefExtracted ?? '',
    loadRef,
    container,
    mrnRef,
    r.extractedZip ?? '',
    r.resolvedCustomer ?? '',
    r.resolvedTransporter ?? '',
    (r.subject ?? '').slice(0, 120),
    r.evidence?.join(' | ') ?? '',
  ];
}

/**
 * Exports QA diagnostic rows for:
 * - 200 lowest-confidence rows
 * - 200 Other / Unclassified rows
 * - 200 rows with blank extracted fields despite likely signals
 * - 200 suspected category mismatches (review-flagged)
 */
export function exportQADiagnostics(records: EnrichedRecord[]): void {
  if (records.length === 0) return;

  const wb = XLSX.utils.book_new();

  function addSheet(name: string, subset: EnrichedRecord[]) {
    if (subset.length === 0) return;
    const rows: (string | number)[][] = [QA_HEADERS, ...subset.slice(0, 200).map(buildQARow)];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols'] = QA_HEADERS.map(() => ({ wch: 24 }));
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  }

  // Sheet 1: 200 lowest-confidence rows
  const lowConf = [...records].sort((a, b) => a.confidence - b.confidence);
  addSheet('Low Confidence', lowConf);

  // Sheet 2: Other / Unclassified rows
  const otherRows = records.filter(r => r.primaryIssue === 'other');
  addSheet('Other Unclassified', otherRows);

  // Sheet 3: Rows with blank extraction fields despite likely signals in subject/description
  const blankExtraction = records.filter(r => {
    const combined = ((r.subject ?? '') + ' ' + (r.description ?? '')).toLowerCase();
    const hasBookingSignal   = /\bbook(?:ing)?\b|\bbkg\b/.test(combined);
    const hasContainerSignal = /\b[A-Z]{4}\d{7}\b/.test(combined);
    const hasMRNSignal       = /\bmrn\b/.test(combined);
    const hasTransporterCol  = !!r.transporter?.trim();
    const missingBooking     = !r.booking_ref && !r.bookingRefExtracted && hasBookingSignal;
    const missingContainer   = !r.containerExtracted && hasContainerSignal;
    const missingMRN         = !r.mrnRefExtracted && hasMRNSignal;
    const missingTransporter = !r.resolvedTransporter && hasTransporterCol;
    return missingBooking || missingContainer || missingMRN || missingTransporter;
  });
  addSheet('Blank Extraction', blankExtraction);

  // Sheet 4: Suspected mismatches (review-flagged, not Other, not low confidence clue)
  const mismatch = records.filter(r =>
    r.reviewFlag &&
    r.primaryIssue !== 'other' &&
    r.confidence > 0.35 &&
    r.confidence < 0.60
  );
  addSheet('Suspected Mismatches', mismatch);

  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `CIS_QA_Diagnostics_${timestamp}.xlsx`);
}
