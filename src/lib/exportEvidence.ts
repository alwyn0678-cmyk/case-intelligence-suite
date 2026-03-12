// ─────────────────────────────────────────────────────────────────
// Evidence Export Utility
//
// Exports evidence drilldown data to Excel (.xlsx) using SheetJS.
// Supports exporting ALL matching case records — not just the
// top-10 preview shown in the ExampleCasesPanel.
//
// Exported columns:
//   Case Number | Booking Ref | Primary Issue | Issue State | Subject |
//   Date | Customer | Transporter | Load Ref | Container | Confidence %
//
// Case Number is always preserved as the primary evidence key.
// ─────────────────────────────────────────────────────────────────

import * as XLSX from 'xlsx';
import type { ExampleCase } from '../types/analysis';

/** Column headers in export output order */
const EXPORT_HEADERS = [
  'Case Number',
  'Booking Ref',
  'Primary Issue',
  'Issue State',
  'Subject',
  'Date',
  'Customer',
  'Transporter',
  'Load Ref',
  'Container',
  'Confidence %',
];

/**
 * Converts an ExampleCase to a plain row array matching EXPORT_HEADERS order.
 */
function caseToRow(c: ExampleCase): (string | number)[] {
  return [
    c.caseNumber    ?? '',
    c.bookingRef    ?? '',
    c.issueLabel    ?? '',
    c.issueState    ?? '',
    c.subject       ?? '',
    c.date          ?? '',
    c.customer      ?? '',
    c.transporter   ?? '',
    c.loadRef       ?? '',
    c.containerNumber ?? '',
    parseFloat((c.confidence * 100).toFixed(1)),
  ];
}

/**
 * Triggers a browser download of an Excel file containing all evidence
 * cases for a given drilldown selection.
 *
 * @param title    Used as the worksheet name and filename prefix.
 *                 E.g. "Missing Load Reference" or "Customer — BASF SE"
 * @param cases    All ExampleCase records for this selection (no cap).
 *                 Pass the full list, not the top-10 preview slice.
 */
export function exportCasesToXlsx(title: string, cases: ExampleCase[]): void {
  if (cases.length === 0) return;

  const rows: (string | number)[][] = [
    EXPORT_HEADERS,
    ...cases.map(caseToRow),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths (approximate)
  worksheet['!cols'] = [
    { wch: 18 }, // Case Number
    { wch: 14 }, // Booking Ref
    { wch: 30 }, // Primary Issue
    { wch: 12 }, // Issue State
    { wch: 60 }, // Subject
    { wch: 12 }, // Date
    { wch: 28 }, // Customer
    { wch: 24 }, // Transporter
    { wch: 14 }, // Load Ref
    { wch: 14 }, // Container
    { wch: 12 }, // Confidence %
  ];

  // Style header row bold (SheetJS CE supports basic cell properties)
  for (let col = 0; col < EXPORT_HEADERS.length; col++) {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
    if (worksheet[cellRef]) {
      worksheet[cellRef].s = { font: { bold: true } };
    }
  }

  const workbook = XLSX.utils.book_new();
  // Worksheet name: truncate to 31 chars (Excel limit)
  const sheetName = title.slice(0, 31).replace(/[/\\?*[\]]/g, '-');
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Filename: sanitise title for use in filenames
  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '-').replace(/\s+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `CIS_Evidence_${safeTitle}_${timestamp}.xlsx`);
}
