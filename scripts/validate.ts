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
  date: Date | null;
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
  rootCause: string | null;
  preventableIssue: boolean;
}

const classified: ClassifiedRow[] = [];
let progress = 0;

for (const r of records) {
  const cls = classifyCase(r);
  classified.push({
    case_number:         r.case_number ?? '',
    subject:             r.subject ?? '',
    description:         (r.description ?? '').slice(0, 200),
    date:                r.date ?? null,
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
    rootCause:           cls.rootCause,
    preventableIssue:    cls.preventableIssue,
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

// ─── Phase 11: Trend signal detection ────────────────────────────

/** Returns ISO week key "YYYY-WXX" for a given date */
function isoWeekKey(d: Date): string {
  const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = tmp.getUTCDay() || 7; // Mon=1..Sun=7
  tmp.setUTCDate(tmp.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${tmp.getUTCFullYear()}-W${String(wk).padStart(2, '0')}`;
}

// Build weekly counts per category
const weekCounts: Record<string, Record<string, number>> = {};
for (const r of classified) {
  if (!r.date) continue;
  const wk = isoWeekKey(r.date);
  if (!weekCounts[wk]) weekCounts[wk] = {};
  weekCounts[wk][r.primaryIssue] = (weekCounts[wk][r.primaryIssue] ?? 0) + 1;
}

const allWeeks = Object.keys(weekCounts).sort();
const allCategories = [...new Set(classified.map(r => r.primaryIssue))].sort();

// For each category compute rolling 4-week average and spike detection
interface TrendResult {
  category: string;
  latestWeek: string;
  latestCount: number;
  rolling4wAvg: number;
  pctChange: number | null;
  direction: 'up' | 'down' | 'stable';
  spike: boolean;
}

const trendResults: TrendResult[] = [];

for (const cat of allCategories) {
  const lastWeeks = allWeeks.slice(-5); // need 5 to get 4-week avg + current
  if (lastWeeks.length < 2) continue;

  const latestWeek = lastWeeks[lastWeeks.length - 1];
  const latestCount = weekCounts[latestWeek]?.[cat] ?? 0;

  const priorWeeks = lastWeeks.slice(0, -1).slice(-4);
  const priorCounts = priorWeeks.map(w => weekCounts[w]?.[cat] ?? 0);
  const rolling4wAvg = priorCounts.reduce((s, v) => s + v, 0) / Math.max(priorCounts.length, 1);

  const pctChange = rolling4wAvg > 0 ? ((latestCount - rolling4wAvg) / rolling4wAvg) * 100 : null;
  const direction: 'up' | 'down' | 'stable' =
    pctChange === null ? 'stable' : pctChange > 5 ? 'up' : pctChange < -5 ? 'down' : 'stable';
  const spike = pctChange !== null && pctChange >= 30 && latestCount >= 3;

  trendResults.push({ category: cat, latestWeek, latestCount, rolling4wAvg, pctChange, direction, spike });
}

console.log('── TREND SIGNALS (Phase 11) ────────────────────────────');
console.log(`  Weeks with data: ${allWeeks.length} (${allWeeks[0] ?? 'n/a'} → ${allWeeks[allWeeks.length - 1] ?? 'n/a'})`);
for (const t of trendResults.sort((a, b) => (b.pctChange ?? 0) - (a.pctChange ?? 0))) {
  const label = TAXONOMY_MAP[t.category]?.label ?? t.category;
  const arrow  = t.direction === 'up' ? '↑' : t.direction === 'down' ? '↓' : '→';
  const spike  = t.spike ? '  ⚠ SPIKE' : '';
  console.log(`  ${arrow} ${label.padEnd(40)} latest: ${t.latestCount}  avg: ${t.rolling4wAvg.toFixed(1)}  ${t.pctChange !== null ? `${t.pctChange > 0 ? '+' : ''}${t.pctChange.toFixed(0)}%` : 'n/a'}${spike}`);
}
console.log();

// ─── Phase 12: QA operational signals export ─────────────────────
console.log('Exporting qa_operational_signals.xlsx...');

const opsWb = XLSX.utils.book_new();

// --- Sheet 1: preventable_cases ---
{
  const rows = classified.filter(r => r.preventableIssue);
  const wsData = [
    ['Case Number', 'Subject', 'Description Snippet', 'Category', 'Confidence %', 'Root Cause', 'Transporter', 'Booking Ref', 'Evidence'],
    ...rows.slice(0, 500).map(r => [
      r.case_number,
      r.subject.slice(0, 100),
      r.description.replace(/\s+/g, ' ').slice(0, 160),
      TAXONOMY_MAP[r.primaryIssue]?.label ?? r.primaryIssue,
      `${(r.confidence * 100).toFixed(0)}%`,
      r.rootCause ?? '',
      r.resolvedTransporter ?? '',
      r.bookingRef ?? '',
      r.evidence.slice(0, 2).join(' | '),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 18 },{ wch: 55 },{ wch: 70 },{ wch: 30 },{ wch: 12 },{ wch: 22 },{ wch: 25 },{ wch: 18 },{ wch: 60 }];
  XLSX.utils.book_append_sheet(opsWb, ws, 'preventable_cases');
  console.log(`  preventable_cases: ${rows.length} rows`);
}

// --- Sheet 2: delay_root_causes ---
{
  const rows = classified.filter(r => r.primaryIssue === 'delay');
  const wsData = [
    ['Case Number', 'Subject', 'Description Snippet', 'Confidence %', 'Issue State', 'Root Cause', 'Transporter', 'Evidence'],
    ...rows.map(r => [
      r.case_number,
      r.subject.slice(0, 100),
      r.description.replace(/\s+/g, ' ').slice(0, 160),
      `${(r.confidence * 100).toFixed(0)}%`,
      r.issueState,
      r.rootCause ?? '(undetected)',
      r.resolvedTransporter ?? '',
      r.evidence.slice(0, 2).join(' | '),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 18 },{ wch: 55 },{ wch: 70 },{ wch: 12 },{ wch: 14 },{ wch: 22 },{ wch: 25 },{ wch: 60 }];
  XLSX.utils.book_append_sheet(opsWb, ws, 'delay_root_causes');
  // Root cause breakdown
  const rootCauseCounts: Record<string, number> = {};
  for (const r of rows) { const k = r.rootCause ?? 'unknown'; rootCauseCounts[k] = (rootCauseCounts[k] ?? 0) + 1; }
  const top3 = Object.entries(rootCauseCounts).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => `${k}:${v}`).join(', ');
  console.log(`  delay_root_causes: ${rows.length} rows — top: ${top3}`);
}

// --- Sheet 3: invoice_disputes ---
{
  const rows = classified.filter(r => r.primaryIssue === 'rate');
  const wsData = [
    ['Case Number', 'Subject', 'Description Snippet', 'Confidence %', 'Root Cause', 'Customer', 'Transporter', 'Evidence'],
    ...rows.map(r => [
      r.case_number,
      r.subject.slice(0, 100),
      r.description.replace(/\s+/g, ' ').slice(0, 160),
      `${(r.confidence * 100).toFixed(0)}%`,
      r.rootCause ?? '(undetected)',
      r.resolvedCustomer ?? '',
      r.resolvedTransporter ?? '',
      r.evidence.slice(0, 2).join(' | '),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 18 },{ wch: 55 },{ wch: 70 },{ wch: 12 },{ wch: 22 },{ wch: 25 },{ wch: 25 },{ wch: 60 }];
  XLSX.utils.book_append_sheet(opsWb, ws, 'invoice_disputes');
  console.log(`  invoice_disputes: ${rows.length} rows`);
}

// --- Sheet 4: customs_issues ---
{
  const rows = classified.filter(r => ['customs','t1','portbase','bl'].includes(r.primaryIssue));
  const wsData = [
    ['Case Number', 'Subject', 'Description Snippet', 'Category', 'Confidence %', 'Issue State', 'Root Cause', 'MRN/T1', 'Container', 'Evidence'],
    ...rows.map(r => [
      r.case_number,
      r.subject.slice(0, 100),
      r.description.replace(/\s+/g, ' ').slice(0, 160),
      TAXONOMY_MAP[r.primaryIssue]?.label ?? r.primaryIssue,
      `${(r.confidence * 100).toFixed(0)}%`,
      r.issueState,
      r.rootCause ?? '(undetected)',
      r.mrnRefExtracted ?? '',
      r.containerExtracted ?? '',
      r.evidence.slice(0, 2).join(' | '),
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 18 },{ wch: 55 },{ wch: 70 },{ wch: 25 },{ wch: 12 },{ wch: 14 },{ wch: 22 },{ wch: 22 },{ wch: 14 },{ wch: 60 }];
  XLSX.utils.book_append_sheet(opsWb, ws, 'customs_issues');
  console.log(`  customs_issues: ${rows.length} rows`);
}

// --- Sheet 5: transporter_performance ---
{
  const tpCounts: Record<string, { total: number; delay: number; preventable: number }> = {};
  for (const r of classified) {
    const name = r.resolvedTransporter ?? '(Unknown)';
    if (!tpCounts[name]) tpCounts[name] = { total: 0, delay: 0, preventable: 0 };
    tpCounts[name].total++;
    if (r.primaryIssue === 'delay') tpCounts[name].delay++;
    if (r.preventableIssue) tpCounts[name].preventable++;
  }
  const sorted = Object.entries(tpCounts).sort((a, b) => b[1].total - a[1].total);
  const wsData = [
    ['Transporter', 'Total Cases', 'Delay Cases', 'Delay %', 'Preventable Cases', 'Preventable %'],
    ...sorted.map(([name, v]) => [
      name,
      v.total,
      v.delay,
      `${(v.delay / v.total * 100).toFixed(1)}%`,
      v.preventable,
      `${(v.preventable / v.total * 100).toFixed(1)}%`,
    ]),
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws['!cols'] = [{ wch: 30 },{ wch: 14 },{ wch: 14 },{ wch: 10 },{ wch: 18 },{ wch: 14 }];
  XLSX.utils.book_append_sheet(opsWb, ws, 'transporter_performance');
  console.log(`  transporter_performance: ${sorted.length} transporters`);
}

const opsOutputPath = path.join(path.dirname(inputPath), 'qa_operational_signals.xlsx');
XLSX.writeFile(opsWb, opsOutputPath);
console.log(`\nExported: ${opsOutputPath}\n`);

// ─── Phase 11: Operational summary ────────────────────────────────
const preventableCount   = classified.filter(r => r.preventableIssue).length;
const preventablePct     = (preventableCount / total * 100);
const withRootCause      = classified.filter(r => r.rootCause !== null).length;
const withRootCausePct   = (withRootCause / total * 100);
const spikes             = trendResults.filter(t => t.spike);

console.log('── OPERATIONAL METRICS (Phase 8–11) ──────────────────');
console.log(`  Transporter resolved:       ${classified.filter(r => r.resolvedTransporter).length} / ${total}  (${(classified.filter(r => r.resolvedTransporter).length/total*100).toFixed(1)}%)`);
console.log(`  Preventable issues:         ${preventableCount} / ${total}  (${preventablePct.toFixed(1)}%)`);
console.log(`  Root cause detected:        ${withRootCause} / ${total}  (${withRootCausePct.toFixed(1)}%)`);
console.log(`  Trend spikes (≥30%):        ${spikes.length}  — ${spikes.map(s => TAXONOMY_MAP[s.category]?.label ?? s.category).join(', ') || 'none'}`);
console.log();
