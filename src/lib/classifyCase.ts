// ─────────────────────────────────────────────────────────────────
// classifyCase — main per-row classification entry point
//
// Processing order (per CLAUDE.md §"Mandatory analysis order"):
//  1. Read all usable fields
//  2. Normalize raw text
//  3. Extract candidate entities (entityExtraction.ts)
//  4. Match against built-in dictionaries
//  5. Infer customer
//  6. Extract references (load ref, booking, container, customs, ZIP)
//  7. Map ZIP to routing / area
//  8. Score issue family + state (issueRules.ts)
//  9. Assign primary + secondary issue
// 10. Score confidence
// 11. Recovery pass (fallbackIssueRules.ts)
// 12. Flag low-confidence cases
// 13. Return structured result
// ─────────────────────────────────────────────────────────────────

import { extractEntities }              from './entityExtraction';
import { lookupEntity, isInternalISRLabel, isCustomerJunkLabel } from '../config/referenceData';
import { classifyByRules }              from './issueRules';
import { fallbackClassify, operationalClueScan } from './fallbackIssueRules';
import { resolveZipToArea, extractZipsFromText } from '../config/zipAreaRules';
import type { IssueState }              from './issueRules';
import type { ExtractedEntity }         from './entityExtraction';
import type { RoutingAlignment }        from '../config/zipAreaRules';
import type { NormalisedRecord }        from '../types';

export interface CaseClassification {
  // ── Issues ────────────────────────────────────────────────────
  issues: string[];          // all matched taxonomy ids
  primaryIssue: string;      // highest-confidence match
  secondaryIssue: string | null;
  issueState: IssueState;
  confidence: number;        // 0–1

  // ── Entities ──────────────────────────────────────────────────
  resolvedTransporter: string | null;
  resolvedDepot: string | null;
  resolvedDeepseaTerminal: string | null;
  resolvedCustomer: string | null;
  allEntities: ExtractedEntity[];
  unknownEntities: string[];

  // ── Area / routing ────────────────────────────────────────────
  extractedZip: string | null;
  resolvedArea: string | null;
  routingHint: string | null;
  routingAlignment: RoutingAlignment;

  // ── Debug ─────────────────────────────────────────────────────
  reviewFlag: boolean;
  unresolvedReason: string | null;
  evidence: string[];
  sourceFieldsUsed: string[];
}

// ─── Reference extraction helpers ───────────────────────────────

const REF_PATTERNS: Record<string, RegExp> = {
  container:  /\b([A-Z]{4}\d{7})\b/,
  mrn:        /\b(MRN|mrn)[:\s]?([A-Z0-9]{14,18})\b/i,
  t1_mrn:     /\bT[12]\s*(?:MRN|mrn)?[:\s]?([A-Z0-9]{14,18})\b/i,
  booking:    /\bBKG[:\s]?([A-Z0-9]{5,15})\b/i,
  load_ref:   /\b(?:load ref|loadref|booking ref)[:\s]?([A-Z0-9]{4,20})\b/i,
};

function extractReferences(text: string): Record<string, string> {
  const refs: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(REF_PATTERNS)) {
    const m = text.match(pattern);
    if (m) refs[key] = m[1] ?? m[0];
  }
  return refs;
}

// ─── Main classify function ──────────────────────────────────────

export function classifyCase(record: NormalisedRecord): CaseClassification {
  // ── 1 + 2. Collect and normalize all text fields ──────────────
  const fields: Record<string, string> = {
    subject:      record.subject ?? '',
    description:  record.description ?? '',
    isr_details:  record.isr_details ?? '',
    category:     record.category ?? '',
    status:       record.status ?? '',
  };

  const sourceFieldsUsed: string[] = Object.entries(fields)
    .filter(([, v]) => v.trim().length > 0)
    .map(([k]) => k);

  const combinedText = Object.values(fields).filter(Boolean).join(' ');
  const normalizedText = combinedText.replace(/\s+/g, ' ').trim();

  // ── 3 + 4 + 5. Entity extraction ─────────────────────────────
  // Build extra raw text from any unmapped columns in _raw that aren't
  // already covered by the standard normalised fields. This ensures
  // fields like "External Details", "Account Name", "Notes", etc.
  // are scanned even if not formally mapped during file parsing.
  const standardRawKeys = new Set([
    'subject','title','case subject','case title','onderwerp','email subject',
    'description','desc','case description','body','email body','message body','comments','details',
    'isr details','isr_details','isr','isr detail','sr details','internal details',
    'customer','account','client','company','klant','account name','customer name','debtor',
    'transporter','haulier','carrier','hauler','transport company','vervoerder',
    'zip','postcode','post code','zip code','zipcode','postal code','postal_code',
    'area','region','zone','terminal','location','hub','site',
    'date','created date','creation date','created at','created_at','closed date','datum','opened',
    'status','case status','state','resolution',
    'priority','urgency','severity',
    'category','type','case type','issue type','categorie',
    'hours','time spent','duration','effort','uren',
  ]);
  const extraRaw = Object.entries(record._raw)
    .filter(([k]) => !standardRawKeys.has(k.toLowerCase().trim()))
    .map(([, v]) => (v != null ? String(v) : ''))
    .filter(s => s.trim().length > 2)
    .join(' ');

  const entityResult = extractEntities(
    record.transporter,
    record.customer,
    record.subject,
    record.description,
    record.isr_details,
    extraRaw || undefined,
  );

  const resolvedTransporter    = entityResult.transporter?.canonicalName ?? null;
  const resolvedDepot          = entityResult.depot?.canonicalName ?? null;
  const resolvedDeepseaTerminal= entityResult.deepseaTerminal?.canonicalName ?? null;
  // Only use the raw record.customer value as customer if it is NOT a hard-blocked
  // operational entity (deepsea_terminal, depot, approved transporter).
  // KNOWN_CARRIERS have entityType='carrier' and are allowed as customers.
  let resolvedCustomer: string | null = entityResult.customer?.canonicalName ?? null;
  if (!resolvedCustomer && record.customer?.trim()) {
    const rawCustLookup = lookupEntity(record.customer.trim());
    const isOperationalBlock =
      rawCustLookup !== null &&
      (rawCustLookup.entry.entityType === 'deepsea_terminal' ||
       rawCustLookup.entry.entityType === 'depot' ||
       rawCustLookup.entry.entityType === 'transporter');
    if (!isOperationalBlock) {
      resolvedCustomer = rawCustLookup ? rawCustLookup.entry.canonicalName : record.customer.trim();
    }
    // If operational block: it is a depot/terminal/approved haulier. Leave resolvedCustomer null.
  }

  // ── ISR / junk null-out: last-resort guard before record is stored ──────
  // Even if entity extraction or the raw-value fallback set a customer name,
  // discard it if it is an internal ISR address-book entry or a junk placeholder.
  // These cases are counted as unresolved (unknownCustomerCaseCount in analyzeData).
  if (resolvedCustomer && (isInternalISRLabel(resolvedCustomer) || isCustomerJunkLabel(resolvedCustomer))) {
    resolvedCustomer = null;
  }

  // ── 6. Extract references ─────────────────────────────────────
  const refs = extractReferences(normalizedText);

  // ── 7. ZIP → area mapping ─────────────────────────────────────
  let extractedZip: string | null = record.zip ?? null;

  if (!extractedZip) {
    const zipsInText = extractZipsFromText(normalizedText);
    extractedZip = zipsInText[0] ?? null;
  }

  let resolvedArea: string | null = record.area ?? null;
  let routingHint: string | null = null;

  if (!resolvedArea && extractedZip) {
    const zipResult = resolveZipToArea(extractedZip, normalizedText);
    if (zipResult) {
      resolvedArea = zipResult.area;
      routingHint  = zipResult.typicalRouting ?? null;
    } else {
      resolvedArea = `ZIP ${extractedZip}`;
    }
  }

  // No area fallback: leave as null — do NOT default to "Switzerland area".
  // Unresolved areas are omitted from area hotspot charts rather than
  // being incorrectly assigned to a geography.

  // Routing alignment: compare expected depot from ZIP vs. actual depot found
  let routingAlignment: RoutingAlignment = 'no_zip';
  if (extractedZip) {
    const zipResult = resolveZipToArea(extractedZip, normalizedText);
    if (zipResult) {
      routingAlignment = 'aligned'; // default — no conflict data to compare against
    }
  }

  // ── 8. Issue classification (primary pass) ────────────────────
  const ruleMatches = classifyByRules(normalizedText);

  // Sort by confidence descending
  ruleMatches.sort((a, b) => b.confidence - a.confidence);

  // ── 9 + 10. Assign primary and secondary ─────────────────────
  let issues: string[] = [];
  let issueState: IssueState = 'unknown';
  let confidence = 0;
  let evidence: string[] = [];
  let reviewFlag = false;
  let unresolvedReason: string | null = null;

  if (ruleMatches.length > 0) {
    const primary = ruleMatches[0];
    issues       = [...new Set(ruleMatches.map(m => m.issueId))];
    issueState   = primary.state;
    confidence   = primary.confidence;
    evidence     = primary.evidence;
  }

  // ── 11. Recovery pass if confidence is weak ───────────────────
  if (confidence < 0.50) {
    const fallback = fallbackClassify(normalizedText);
    if (fallback && fallback.confidence > confidence) {
      if (!issues.includes(fallback.issueId)) issues.push(fallback.issueId);
      if (confidence === 0) {
        issueState = fallback.state;
        confidence = fallback.confidence;
        evidence   = fallback.evidence;
      }
    }
  }

  // ── Operational clue scan: very last resort ───────────────────
  if (issues.length === 0) {
    const clue = operationalClueScan(normalizedText);
    if (clue) {
      issues     = [clue.issueId];
      issueState = clue.state;
      confidence = clue.confidence;
      evidence   = clue.evidence;
      reviewFlag = true;
      unresolvedReason = 'Classified by operational clue only — manual review recommended.';
    }
  }

  // ── Final fallback: assign "other" ────────────────────────────
  if (issues.length === 0) {
    issues           = ['other'];
    issueState       = 'unknown';
    confidence       = 0.10;
    reviewFlag       = true;
    unresolvedReason = 'No matching rules or patterns found. Manual review required.';
  }

  // ── Load-ref ambiguity resolution ────────────────────────────
  // Problem: "ref no 1234" contains "no " which matches MISSING_SIGNALS.
  //          But "ref no" means "reference number" — the ref WAS provided.
  // Fix: when state=unknown AND a reference number immediately follows a
  //      ref/loadref/booking keyword, reclassify as ref_provided.
  // We only do this for state='unknown' — if 'missing' was explicitly
  // detected (strong signal like "please provide"), we leave it alone.
  if (issues.includes('load_ref') && issueState === 'unknown') {
    // Pattern: ref/loadref/booking ref + optional "no." + alphanumeric ref (4+ chars)
    const refNumPresent = /(?:(?:load\s*)?ref(?:erence)?|loadref|booking\s*ref(?:erence)?)\s*(?:no\.?\s*|#\s*)?[A-Z0-9]{4,}/i.test(normalizedText);
    if (refNumPresent) {
      issues = issues.map(i => i === 'load_ref' ? 'ref_provided' : i);
      issueState = 'provided';
      evidence.push('load-ref number present → ref_provided');
    }
  }

  // ── Flag low confidence ───────────────────────────────────────
  if (confidence < 0.50 && !reviewFlag) {
    reviewFlag = true;
    unresolvedReason = unresolvedReason ?? `Low confidence (${(confidence * 100).toFixed(0)}%) — classified by weak signal.`;
  }

  // Enrich evidence with reference context
  for (const [key, val] of Object.entries(refs)) {
    evidence.push(`ref[${key}]=${val}`);
  }

  const primaryIssue   = issues[0];
  const secondaryIssue = issues.length > 1 ? issues[1] : null;

  return {
    issues,
    primaryIssue,
    secondaryIssue,
    issueState,
    confidence,
    resolvedTransporter,
    resolvedDepot,
    resolvedDeepseaTerminal,
    resolvedCustomer,
    allEntities:      entityResult.allEntities,
    unknownEntities:  entityResult.unknownEntities,
    extractedZip,
    resolvedArea,
    routingHint,
    routingAlignment,
    reviewFlag,
    unresolvedReason,
    evidence,
    sourceFieldsUsed,
  };
}
