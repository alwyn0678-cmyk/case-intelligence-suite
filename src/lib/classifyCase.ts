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
import { normalizeText }                from './textNormalization';
import { textProvidesRef }              from './loadRefGuards';
import type { IssueState, IssueMatch }  from './issueRules';

// ─── Confidence scoring constants ────────────────────────────────
// Imported-by-name constants keep the scoring model readable and testable.
// The base signal confidence tiers (STRONG/WEAK) live in issueRules.ts
// because that is where the per-topic confidence is first assigned.
// Post-classification adjustments are defined here.

/** Confidence threshold below which a case is flagged for manual review. */
export const REVIEW_FLAG_THRESHOLD = 0.60;

/**
 * Penalty subtracted from confidence when the description field is substantive
 * (>30 chars) but contributed NO matching evidence to the classification.
 * This means the primary classification was driven entirely by the subject
 * or category fields — which are less operationally reliable than the body.
 */
export const SUBJECT_ONLY_PENALTY = 0.18;

/** Minimum confidence after the subject-only penalty is applied. */
export const SUBJECT_ONLY_FLOOR = 0.48;

/**
 * Minimum description length (chars, trimmed) that qualifies as "substantive".
 * Below this threshold the description is considered too sparse to penalise
 * subject-only classifications.
 */
export const SUBSTANTIVE_DESC_MIN_LENGTH = 30;
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
  // normalizeText() cleans whitespace, line endings, and repeated separators.
  // Applied per-field before combining so that separators between fields don't
  // create spurious matches across field boundaries.
  const fields: Record<string, string> = {
    subject:      normalizeText(record.subject ?? ''),
    description:  normalizeText(record.description ?? ''),
    isr_details:  normalizeText(record.isr_details ?? ''),
    category:     normalizeText(record.category ?? ''),
    status:       normalizeText(record.status ?? ''),
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
  // operational entity (any of: deepsea_terminal, depot, transporter, carrier).
  // All logistics entities are blocked from the customer slot regardless of which
  // column they appear in — they must never surface in Customer Burden reporting.
  let resolvedCustomer: string | null = entityResult.customer?.canonicalName ?? null;
  if (!resolvedCustomer && record.customer?.trim()) {
    const rawCustLookup = lookupEntity(record.customer.trim());
    const isOperationalBlock =
      rawCustLookup !== null &&
      (rawCustLookup.entry.entityType === 'deepsea_terminal' ||
       rawCustLookup.entry.entityType === 'depot' ||
       rawCustLookup.entry.entityType === 'transporter' ||
       rawCustLookup.entry.entityType === 'carrier');  // all logistics entities blocked
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

  // ── 7. ZIP → area mapping (field-priority: subject → description → isr) ──
  // ZIPs in Subject are operationally most reliable (entered by case author).
  // Fall through to Description then ISR Details if not found in Subject.
  let extractedZip: string | null = record.zip ?? null;

  if (!extractedZip) {
    extractedZip =
      extractZipsFromText(fields.subject)[0] ??
      extractZipsFromText(fields.description)[0] ??
      extractZipsFromText(fields.isr_details)[0] ??
      null;
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

  // Routing alignment: compare ZIP-expected routing area vs. resolved depot/area
  // - aligned:   ZIP routing and resolved area agree (or no conflict detectable)
  // - unusual:   ZIP implies a different depot than the one mentioned
  // - no_zip:    no ZIP was found in the record
  let routingAlignment: RoutingAlignment = 'no_zip';
  if (extractedZip) {
    const zipResult = resolveZipToArea(extractedZip, normalizedText);
    if (zipResult) {
      // Check for routing conflict: if ZIP implies one depot cluster but the
      // resolved area (from the record) is a different operational cluster,
      // flag as unusual routing for review.
      const zipArea = zipResult.area?.toLowerCase() ?? '';
      const resolvedAreaLower = resolvedArea?.toLowerCase() ?? '';
      if (resolvedAreaLower && zipArea && resolvedAreaLower !== zipArea) {
        // Only flag as unusual if both are known operational areas (not generic)
        const isMainzZone = zipArea.includes('mainz') || zipArea.includes('germersheim');
        const isDuisburgZone = zipArea.includes('duisburg') || zipArea.includes('rhine-ruhr');
        const resolvedInMainz = resolvedAreaLower.includes('mainz') || resolvedAreaLower.includes('germersheim');
        const resolvedInDuisburg = resolvedAreaLower.includes('duisburg') || resolvedAreaLower.includes('rhine-ruhr');
        if ((isMainzZone && resolvedInDuisburg) || (isDuisburgZone && resolvedInMainz)) {
          routingAlignment = 'unusual';
        } else {
          routingAlignment = 'aligned';
        }
      } else {
        routingAlignment = 'aligned';
      }
    }
  }

  // ── 8. Issue classification — per-field weighted pass ─────────
  // Each field is classified independently with a confidence multiplier
  // reflecting its operational reliability for issue detection.
  // description is primary (most detailed), subject is secondary (structured
  // and authored), isr_details and category carry lower weight.
  const FIELD_WEIGHTS: Array<{ key: string; weight: number }> = [
    { key: 'description', weight: 1.00 },
    { key: 'subject',     weight: 0.88 },
    { key: 'isr_details', weight: 0.78 },
    { key: 'category',    weight: 0.70 },
  ];

  // Accumulate matches keyed by issueId; keep highest weighted confidence per issue.
  const matchMap = new Map<string, IssueMatch>();

  for (const { key, weight } of FIELD_WEIGHTS) {
    const fieldText = fields[key];
    if (!fieldText?.trim()) continue;
    const fieldMatches = classifyByRules(fieldText);
    for (const m of fieldMatches) {
      const weightedConf = Math.min(m.confidence * weight, 0.98);
      const existing = matchMap.get(m.issueId);
      if (!existing || weightedConf > existing.confidence) {
        matchMap.set(m.issueId, {
          ...m,
          confidence: weightedConf,
          evidence: m.evidence.map(e => `[${key}] ${e}`),
        });
      }
    }
  }

  // Fall back to combined text if no field-level matches (e.g. very short rows)
  if (matchMap.size === 0) {
    for (const m of classifyByRules(normalizedText)) {
      matchMap.set(m.issueId, m);
    }
  }

  const ruleMatches = Array.from(matchMap.values());

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

  // ── Load-ref accuracy: missing vs provided disambiguation ─────
  //
  // The load_ref topic fires on keywords like "load ref", "booking ref",
  // "ref no", etc. Whether the case is MISSING or PROVIDED depends on intent.
  //
  // DESCRIPTION IS SOURCE OF TRUTH: the description/email body is checked first.
  // If it contains an explicit provided-reference pattern, that overrides any
  // "missing" signal from the subject line.
  //
  // Case A (state=unknown): a reference number follows the keyword immediately.
  //   "ref no BKG1234" — "no" is "number" not negation → provided.
  //
  // Case B (any state): description body explicitly provides the actual reference
  //   value or contains a "see below / ref is XXXX / correct ref" pattern.
  //   Body wins over any subject-derived missing signal.
  if (issues.includes('load_ref')) {
    const descText = fields.description ?? '';
    if (textProvidesRef(descText)) {
      // Description explicitly provides the reference — override any state.
      // This covers: state=missing (subject says "Missing Load Ref" but body
      // provides it), state=unknown (ambiguous subject, body is clear), etc.
      issues = issues.map(i => i === 'load_ref' ? 'ref_provided' : i);
      issueState = 'provided';
      evidence.push('[description] body provides explicit ref — overrides subject signal → ref_provided');
    } else if (issueState === 'unknown') {
      // Case A: no description-level evidence, but a ref code immediately follows keyword
      const refNumPresent = /(?:(?:load\s*)?ref(?:erence)?|loadref|booking\s*ref(?:erence)?)\s*(?:no\.?\s*|#\s*)?[A-Z0-9]{4,}/i.test(normalizedText);
      if (refNumPresent) {
        issues = issues.map(i => i === 'load_ref' ? 'ref_provided' : i);
        issueState = 'provided';
        evidence.push('load-ref number present in text → ref_provided');
      }
    }
  }

  // ── Contradiction guard: ref_provided and load_ref are mutually exclusive ──
  // Context-window detection can produce both if subject and description disagree.
  // Keep only ref_provided — a reference cannot be simultaneously missing and provided.
  // Also fix issueState: when load_ref is removed in favour of ref_provided, ensure
  // issueState reflects the provided intent (prevents stale 'missing' state leaking
  // through when the primary match was load_ref and secondary was ref_provided).
  if (issues.includes('ref_provided') && issues.includes('load_ref')) {
    issues = issues.filter(i => i !== 'load_ref');
    // Lock state to 'provided' — ref_provided always means the ref was given
    issueState = 'provided';
  }

  // ── Description-first override: general topic contradiction guard ──
  //
  // When the primary classification came from the Subject field (higher weight
  // than any description match), but the Description field independently
  // classifies as a DIFFERENT topic at meaningful confidence, Description wins.
  //
  // This implements the "body is source of truth" principle without breaking
  // the weighted accumulation that already favours description (weight=1.00
  // vs subject=0.88) for same-topic matches. This guard only fires when the
  // topics CONFLICT — i.e. the description is saying something different from
  // what the subject shorthand implies.
  //
  // Mechanism: re-classify ONLY the description field and compare its primary
  // topic against the overall primary topic. If they differ and the description
  // match is at least WEAK_SIGNAL confidence, promote the description's result.
  if ((fields.description ?? '').trim().length > SUBSTANTIVE_DESC_MIN_LENGTH) {
    const descOnlyMatches = classifyByRules(fields.description);
    if (descOnlyMatches.length > 0) {
      const descPrimary = descOnlyMatches[0];
      const overallPrimary = issues[0];
      // Conflict: description says something clearly different from the overall winner
      const topicsDiffer = descPrimary.issueId !== overallPrimary &&
        // Don't override if they are in the same logical family (e.g. load_ref vs ref_provided)
        !(descPrimary.issueId === 'ref_provided' && overallPrimary === 'load_ref') &&
        !(descPrimary.issueId === 'load_ref' && overallPrimary === 'ref_provided');
      // Only promote if description has a meaningful signal (not just operational clue)
      const descConfidentEnough = descPrimary.confidence >= 0.55;
      if (topicsDiffer && descConfidentEnough) {
        // Description classification takes precedence — prepend to issues list
        // and replace issueState with description's state.
        if (!issues.includes(descPrimary.issueId)) {
          issues = [descPrimary.issueId, ...issues];
        } else {
          // Already in list — move to front
          issues = [descPrimary.issueId, ...issues.filter(i => i !== descPrimary.issueId)];
        }
        issueState = descPrimary.state;
        confidence = Math.min(descPrimary.confidence, confidence + 0.05); // slight confidence boost for agreement
        evidence.push(`[description-override] description classifies as ${descPrimary.issueId} (${descPrimary.evidence.join(', ')}) — overrides subject-derived ${overallPrimary}`);
      }
    }
  }

  // ── Subject-only classification penalty ───────────────────────
  // When description is substantive but contributed no classification evidence,
  // the classification was driven only by subject/category fields.
  // Subject is less operationally reliable than body text — apply a confidence
  // penalty and flag for review. Constants defined at top of this file.
  const hasSubstantiveDesc = (fields.description ?? '').trim().length > SUBSTANTIVE_DESC_MIN_LENGTH;
  const descHasEvidence    = evidence.some(e => e.startsWith('[description]'));
  if (hasSubstantiveDesc && !descHasEvidence && confidence > REVIEW_FLAG_THRESHOLD) {
    confidence = Math.max(confidence - SUBJECT_ONLY_PENALTY, SUBJECT_ONLY_FLOOR);
    if (!reviewFlag) {
      reviewFlag = true;
      unresolvedReason = 'Subject-only classification — description present but provided no matching evidence. Verify manually.';
    }
  }

  // ── Flag low confidence ───────────────────────────────────────
  // REVIEW_FLAG_THRESHOLD catches weak-signal-only classifications.
  // (weak signal 0.55 + state bonus 0.10 = 0.65 × field weight 0.88 = 0.57 → below threshold)
  if (confidence < REVIEW_FLAG_THRESHOLD && !reviewFlag) {
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
