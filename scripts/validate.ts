/**
 * validate.ts — Post-fix accuracy validation
 * Run: npx tsx scripts/validate.ts "<path-to-input.xlsx>"
 *
 * Reads the input Excel file, runs the TypeScript classifier against every row,
 * and prints hard metrics to stdout. No browser APIs used.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';
import { classifyCase } from '../src/lib/classifyCase.js';
import { TAXONOMY_MAP } from '../src/lib/taxonomy.js';
import type { NormalisedRecord } from '../src/types/index.js';

// ─── Column alias map (mirrors parseFile.ts) ────────────────────
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
  case_number: ['case number', 'case no', 'case no.', 'case #', 'case id', 'ticket number', 'ticket id', 'incident number', 'case ref', 'case_number', 'casenumber', 'case nr', 'case_nr'],
  booking_ref: ['booking', 'booking ref', 'booking reference', 'booking no', 'booking number', 'bkg', 'bkg ref', 'booking_ref', 'reservation', 'res no'],
};

function normaliseHeader(h: string): string | null {
  const lower = h.toLowerCase().trim();
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(a => lower === a)) return key;
  }
  for (const [key, aliases] of Object.entries(COLUMN_ALIASES)) {
    if (aliases.some(a => lower.includes(a))) return key;
  }
  return null;
}

function parseFlexDate(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === 'number' && val > 1000) {
    const epoch = new Date(Date.UTC(1899, 11, 30));
    const d = new Date(epoch.getTime() + val * 86400000);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

// ─── Read and parse the Excel file ──────────────────────────────
const inputPath = process.argv[2] ?? '/Users/carlybiancashartin/Desktop/Weekly Trend  Report X Border-2026-03-13-08-42-06.xlsx';
if (!fs.existsSync(inputPath)) {
  console.error(`ERROR: File not found: ${inputPath}`);
  process.exit(1);
}
console.log(`Reading: ${path.basename(inputPath)}`);

const buf  = fs.readFileSync(inputPath);
const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });
const ws   = wb.Sheets[wb.SheetNames[0]];
const rawArrays: unknown[][] = XLSX.utils.sheet_to_json(ws, { defval: '', header: 1 });

// Find header row (best score in first 30 rows)
let headerIdx = 0;
let bestScore = 0;
for (let i = 0; i < Math.min(rawArrays.length, 30); i++) {
  const score = (rawArrays[i] as string[]).filter(c => normaliseHeader(String(c ?? ''))).length;
  if (score > bestScore) { bestScore = score; headerIdx = i; }
}

const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws, { defval: '', range: headerIdx });
const headers = Object.keys(raw[0] ?? {});
console.log(`Headers detected: ${headers.slice(0, 10).join(', ')}${headers.length > 10 ? '…' : ''}`);

const columnMap: Partial<Record<string, string>> = {};
for (const h of headers) {
  const mapped = normaliseHeader(h);
  if (mapped && !columnMap[mapped]) columnMap[mapped] = h;
}
console.log(`Mapped columns: ${JSON.stringify(columnMap)}\n`);

// Normalise records
const records: NormalisedRecord[] = raw.map(row => {
  const norm: NormalisedRecord = { _raw: row as Record<string, string | number | Date | null> };
  for (const [stdKey, origHeader] of Object.entries(columnMap)) {
    const val = row[origHeader as string];
    if (stdKey === 'date') {
      (norm as Record<string, unknown>).date = parseFlexDate(val);
    } else if (stdKey === 'hours') {
      (norm as Record<string, unknown>).hours = val ? parseFloat(String(val)) || undefined : undefined;
    } else {
      (norm as Record<string, unknown>)[stdKey] = val ? String(val).trim() : undefined;
    }
  }
  return norm;
});

console.log(`Total rows: ${records.length}\n`);
console.log('Running classifier (this may take a moment)...\n');

// ─── Classify every row ──────────────────────────────────────────
interface ClassifiedRow {
  case_number: string;
  subject: string;
  description: string;
  primaryIssue: string;
  confidence: number;
  issueState: string;
  resolvedTransporter: string | null;
  resolvedCustomer: string | null;
  bookingRef: string | null;
  loadRefExtracted: string | null;
  containerExtracted: string | null;
  mrnRefExtracted: string | null;
  extractedZip: string | null;
  reviewFlag: boolean;
  evidence: string[];
}

const classified: ClassifiedRow[] = [];
let progress = 0;

for (const r of records) {
  const cls = classifyCase(r);
  classified.push({
    case_number:         r.case_number ?? '',
    subject:             r.subject ?? '',
    description:         (r.description ?? '').slice(0, 200),
    primaryIssue:        cls.primaryIssue,
    confidence:          cls.confidence,
    issueState:          cls.issueState,
    resolvedTransporter: cls.resolvedTransporter,
    resolvedCustomer:    cls.resolvedCustomer,
    bookingRef:          cls.bookingRef,
    loadRefExtracted:    cls.loadRefExtracted,
    containerExtracted:  cls.containerExtracted,
    mrnRefExtracted:     cls.mrnRefExtracted,
    extractedZip:        cls.extractedZip,
    reviewFlag:          cls.reviewFlag,
    evidence:            cls.evidence,
  });
  progress++;
  if (progress % 500 === 0) process.stdout.write(`  ${progress}/${records.length}\r`);
}
console.log(`  ${records.length}/${records.length} done\n`);

// ─── Compute metrics ─────────────────────────────────────────────
const total = classified.length;

// 2. Distinct primary issue categories
const distinctCategories = new Set(classified.map(r => r.primaryIssue));

// 3. Other / Unclassified
const otherRows = classified.filter(r => r.primaryIssue === 'other');
const otherPct  = (otherRows.length / total) * 100;

// 4. Average confidence
const avgConf = classified.reduce((s, r) => s + r.confidence, 0) / total;

// 5. Median confidence
const sortedConf = [...classified].map(r => r.confidence).sort((a, b) => a - b);
const medianConf = sortedConf[Math.floor(sortedConf.length / 2)] ?? 0;

// 6. Low-confidence rows (<0.60)
const lowConf    = classified.filter(r => r.confidence < 0.60);
const lowConfPct = (lowConf.length / total) * 100;

// 7. Extraction coverage
const withTransporter = classified.filter(r => r.resolvedTransporter).length;
const withBooking     = classified.filter(r => r.bookingRef).length;
const withLoadRef     = classified.filter(r => r.loadRefExtracted).length;
const withContainer   = classified.filter(r => r.containerExtracted).length;
const withMRN         = classified.filter(r => r.mrnRefExtracted).length;
const withZip         = classified.filter(r => r.extractedZip).length;
const withCustomer    = classified.filter(r => r.resolvedCustomer).length;

// 8. Category totals
const catCounts: Record<string, number> = {};
for (const r of classified) {
  catCounts[r.primaryIssue] = (catCounts[r.primaryIssue] ?? 0) + 1;
}
const catSorted = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

// ─── Print report ────────────────────────────────────────────────

console.log('═══════════════════════════════════════════════════════');
console.log('  POST-FIX VALIDATION REPORT');
console.log('═══════════════════════════════════════════════════════\n');

console.log('── CORE METRICS ────────────────────────────────────────');
console.log(`  1. Total rows:                ${total}`);
console.log(`  2. Distinct categories:       ${distinctCategories.size}`);
console.log(`     Categories:                ${[...distinctCategories].sort().join(', ')}`);
console.log(`  3. Other / Unclassified:      ${otherRows.length}  (${otherPct.toFixed(1)}%)`);
console.log(`  4. Average confidence:        ${(avgConf * 100).toFixed(1)}%`);
console.log(`  5. Median confidence:         ${(medianConf * 100).toFixed(1)}%`);
console.log(`  6. Low-confidence (<60%):     ${lowConf.length}  (${lowConfPct.toFixed(1)}%)`);
console.log();

console.log('── EXTRACTION COVERAGE ─────────────────────────────────');
console.log(`  Resolved Customer:            ${withCustomer} / ${total}  (${(withCustomer/total*100).toFixed(1)}%)`);
console.log(`  Resolved Transporter:         ${withTransporter} / ${total}  (${(withTransporter/total*100).toFixed(1)}%)`);
console.log(`  Booking Ref populated:        ${withBooking} / ${total}  (${(withBooking/total*100).toFixed(1)}%)`);
console.log(`  Load Ref populated:           ${withLoadRef} / ${total}  (${(withLoadRef/total*100).toFixed(1)}%)`);
console.log(`  Container / Equipment:        ${withContainer} / ${total}  (${(withContainer/total*100).toFixed(1)}%)`);
console.log(`  MRN / T1 Ref populated:       ${withMRN} / ${total}  (${(withMRN/total*100).toFixed(1)}%)`);
console.log(`  ZIP populated:                ${withZip} / ${total}  (${(withZip/total*100).toFixed(1)}%)`);
console.log();

console.log('── CATEGORY TOTALS (dashboard = export = drilldown) ────');
for (const [id, count] of catSorted) {
  const label = TAXONOMY_MAP[id]?.label ?? id;
  const pct   = (count / total * 100).toFixed(1);
  console.log(`  ${label.padEnd(35)} ${String(count).padStart(5)}  (${pct}%)`);
}
console.log(`  ${'TOTAL'.padEnd(35)} ${String(total).padStart(5)}`);
console.log();

console.log('── CONSISTENCY CHECK ───────────────────────────────────');
const catTotal = Object.values(catCounts).reduce((s, v) => s + v, 0);
const consistent = catTotal === total;
console.log(`  Sum of category counts:       ${catTotal}`);
console.log(`  Total rows:                   ${total}`);
console.log(`  Consistent:                   ${consistent ? 'YES ✓' : 'NO ✗ — MISMATCH'}`);
console.log();

// ─── 30-row samples for each requested category ──────────────────

const SAMPLE_CATEGORIES = [
  { id: 'other',         label: 'Other / Unclassified' },
  { id: 'delay',         label: 'Delay / Not On Time' },
  { id: 'customs',       label: 'Customs / Documentation' },
  { id: 'ref_provided',  label: 'Reference Update / Info Provided' },
  { id: 'rate',          label: 'Rate / Pricing / Invoice' },
];

console.log('═══════════════════════════════════════════════════════');
console.log('  30-ROW VALIDATION SAMPLES');
console.log('═══════════════════════════════════════════════════════');

for (const cat of SAMPLE_CATEGORIES) {
  const rows = classified.filter(r => r.primaryIssue === cat.id);
  const sample = rows.slice(0, 30);
  const label  = TAXONOMY_MAP[cat.id]?.label ?? cat.label;

  console.log(`\n── ${cat.label.toUpperCase()} — ${rows.length} total rows ─────────────`);
  if (sample.length === 0) {
    console.log('  (no rows in this category)');
    continue;
  }

  for (let i = 0; i < sample.length; i++) {
    const r = sample[i];
    const descSnip = r.description.replace(/\s+/g, ' ').slice(0, 100);
    const topEv    = r.evidence.filter(e => !e.startsWith('ref[')).slice(0, 2).join(' | ');
    console.log(`\n  [${i + 1}] Case: ${r.case_number || '(none)'}`);
    console.log(`      Subject:    ${r.subject.slice(0, 90)}`);
    console.log(`      Desc:       ${descSnip}…`);
    console.log(`      Category:   ${label}  |  Confidence: ${(r.confidence * 100).toFixed(0)}%  |  State: ${r.issueState}`);
    console.log(`      Booking Ref:  ${r.bookingRef ?? '—'}`);
    console.log(`      Load Ref:     ${r.loadRefExtracted ?? '—'}`);
    console.log(`      Container:    ${r.containerExtracted ?? '—'}`);
    console.log(`      MRN/T1:       ${r.mrnRefExtracted ?? '—'}`);
    console.log(`      Why:          ${topEv || r.evidence[0] || '(no evidence)'}`);
  }
}

// ─── Health check thresholds ─────────────────────────────────────
console.log('\n\n═══════════════════════════════════════════════════════');
console.log('  HEALTH CHECK GATES');
console.log('═══════════════════════════════════════════════════════');
const gates: Array<{ label: string; value: string; target: string; pass: boolean }> = [
  { label: 'Other < 15%',           value: `${otherPct.toFixed(1)}%`,         target: '<15%',   pass: otherPct < 15 },
  { label: 'Avg confidence > 70%',  value: `${(avgConf*100).toFixed(1)}%`,    target: '>70%',   pass: avgConf > 0.70 },
  { label: 'Low-conf rows < 35%',   value: `${lowConfPct.toFixed(1)}%`,       target: '<35%',   pass: lowConfPct < 35 },
  { label: 'Category totals match', value: consistent ? 'YES' : 'NO',         target: 'YES',    pass: consistent },
];
for (const g of gates) {
  const status = g.pass ? '  PASS ✓' : '  FAIL ✗';
  console.log(`${status}  ${g.label.padEnd(30)} ${g.value.padEnd(10)} (target ${g.target})`);
}
console.log();

// ─── Phase 1: Export qa_validation_samples.xlsx ───────────────────
console.log('Exporting qa_validation_samples.xlsx...');

const VALIDATION_SHEETS: Array<{ sheetName: string; issueId: string; label: string }> = [
  { sheetName: 'validation_delay',             issueId: 'delay',           label: 'Delay / Not On Time' },
  { sheetName: 'validation_reference_update',  issueId: 'ref_provided',    label: 'Reference Update' },
  { sheetName: 'validation_transport_order',   issueId: 'transport_order', label: 'Transport Order' },
  { sheetName: 'validation_container_equipment', issueId: 'equipment',     label: 'Container / Equipment' },
  { sheetName: 'validation_rate_invoice',      issueId: 'rate',            label: 'Rate / Invoice' },
  { sheetName: 'validation_customs',           issueId: 'customs',         label: 'Customs / Documentation' },
  { sheetName: 'validation_other',             issueId: 'other',           label: 'Other / Unclassified' },
];

const SAMPLE_SIZE = 50;

/** Seeded shuffle to get a reproducible random sample */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr];
  let s = seed;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    const j = Math.abs(s) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const qaWb = XLSX.utils.book_new();

for (const sheet of VALIDATION_SHEETS) {
  const rows = classified.filter(r => r.primaryIssue === sheet.issueId);
  const sample = seededShuffle(rows, 42).slice(0, SAMPLE_SIZE);

  const wsData = [
    // Header row
    [
      'Case Number',
      'Subject',
      'Description Snippet',
      'Assigned Primary Issue',
      'Confidence %',
      'Issue State',
      'Booking Ref',
      'Container',
      'Load Ref',
      'MRN / T1',
      'Resolved Transporter',
      'Trigger Evidence',
    ],
    // Data rows
    ...sample.map(r => {
      const label = TAXONOMY_MAP[r.primaryIssue]?.label ?? r.primaryIssue;
      const topEvidence = r.evidence.slice(0, 3).join(' | ');
      return [
        r.case_number,
        r.subject.slice(0, 120),
        r.description.replace(/\s+/g, ' ').slice(0, 180),
        label,
        `${(r.confidence * 100).toFixed(0)}%`,
        r.issueState,
        r.bookingRef ?? '',
        r.containerExtracted ?? '',
        r.loadRefExtracted ?? '',
        r.mrnRefExtracted ?? '',
        r.resolvedTransporter ?? '',
        topEvidence,
      ];
    }),
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Column widths
  ws['!cols'] = [
    { wch: 18 }, // Case Number
    { wch: 55 }, // Subject
    { wch: 70 }, // Description
    { wch: 30 }, // Category
    { wch: 12 }, // Confidence
    { wch: 14 }, // State
    { wch: 18 }, // Booking Ref
    { wch: 14 }, // Container
    { wch: 18 }, // Load Ref
    { wch: 22 }, // MRN
    { wch: 25 }, // Transporter
    { wch: 60 }, // Evidence
  ];

  XLSX.utils.book_append_sheet(qaWb, ws, sheet.sheetName);
  console.log(`  ${sheet.sheetName}: ${sample.length} rows (${rows.length} total in category)`);
}

const outputPath = path.join(path.dirname(inputPath), 'qa_validation_samples.xlsx');
XLSX.writeFile(qaWb, outputPath);
console.log(`\nExported: ${outputPath}\n`);
