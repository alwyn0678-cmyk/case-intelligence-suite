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
import { filterByIntentPriority, TOPIC_INTENT, INTENT_PRIORITY, DETECTED_OBJECT_MAP, extractTriggerInfo, hasStrongFinancialContext } from './intentDetection';
import { resolveZipToArea, extractZipsFromText } from '../config/zipAreaRules';
import { normalizeText }                from './textNormalization';
import { textProvidesRef, validateLoadRefMissing, detectBodyIntent } from './loadRefGuards';

// ─── Document-provision patterns (CHANGE G) ──────────────────────
// When any of these patterns appear in combined text, classify document state
// as 'provided' and route to ref_provided rather than customs/t1/customs-missing.
const PROVIDED_DOC_PATTERNS: string[] = [
  'attached t1', 'please find attached t1', 'mrn attached',
  'see attached customs', 'forwarding t1', 'sending customs',
  'customs documents attached', 'hereby attach', 'bijgevoegd',
  'hierbij de t1', 'hierbij de douane', 'im anhang', 'anbei',
  't1 in bijlage', 'douane in bijlage', 't1 beigefuegt',
  'zolldokumente beigefuegt', 'i have attached', 'we have attached',
  'please find the t1', 'please find the mrn', 'mrn below',
  't1 number below', 'mrn number', 'mrn:', 'the mrn is',
  'find attached mrn',
  // Additional provision patterns (FIX C)
  'mrn attached', 'see attached customs', 'forwarding customs',
  'customs documents attached', 'hierbij de t1', 'hierbij de douane',
  'im anhang', 'anbei t1', 'anbei die zolldokumente',
  'zolldokumente beigefuegt', 't1 number:', 'our t1',
  'the mrn is', 'mrn number is', 't1 is ',
  'please find the t1', 'please find attached mrn',
];

// ─── Financial subject patterns — absolute early-exit override ────
// When the SUBJECT LINE contains any of these patterns, the case must
// classify as 'rate' regardless of body content. These are unambiguous
// financial identifiers that appear in email subjects only for financial emails.
const FINANCIAL_SUBJECT_PATTERNS: string[] = [
  'extra costs report', 'extra cost report',
  'extra costs invoice', 'extra cost invoice',
  'extrakostenrechnung',
  'extra kosten rapport', 'extra kosten report',
  'meerkosten rapport', 'meerkosten report',
];
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

/**
 * Reduced confidence weight applied to load_ref (Missing Load Reference)
 * matches derived from the subject field only.
 *
 * Subject lines frequently contain incidental "load ref" / "booking ref"
 * phrases in billing, routing, and demurrage emails. Reducing this weight
 * ensures that the description + ISR fields must corroborate the topic
 * before load_ref reaches meaningful confidence.
 *
 * Strong load_ref from subject: 0.95 × 0.30 = 0.285 — below review threshold.
 * Strong load_ref from description: 0.95 × 1.00 = 0.95 — wins decisively.
 *
 * ref_provided from subject is intentionally NOT reduced — a subject that
 * explicitly states a reference value (e.g. "Load Ref BKG12345") is a
 * reliable provided-ref signal.
 */
export const LOAD_REF_SUBJECT_WEIGHT = 0.30;
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

  // ── Classifier transparency (diagnostic) ──────────────────────
  /** Intent group detected (financial, operational, documentation, …) */
  detectedIntent: string;
  /** Human-readable object the classifier found (Invoice, Load Reference, …) */
  detectedObject: string;
  /** The exact phrase or signal that triggered the primary classification */
  triggerPhrase: string;
  /** Which field the trigger phrase came from (description, subject, …) */
  triggerSourceField: string;
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

  // ── FINANCIAL SUBJECT EARLY-EXIT (FIX A/D) ───────────────────
  // When the subject line contains an unambiguous financial pattern (e.g.
  // "Extra Costs Report"), force rate classification immediately — skip all
  // other scoring. These subjects only appear on financial emails; body content
  // (which may contain reference numbers or customs terms) is irrelevant.
  const subjectLower = (fields.subject ?? '').toLowerCase();
  if (FINANCIAL_SUBJECT_PATTERNS.some(p => subjectLower.includes(p))) {
    const entityResultFin = extractEntities(
      record.transporter, record.customer, record.subject, record.description, record.isr_details,
    );
    const extractedZipFin = record.zip ?? extractZipsFromText(fields.subject)[0] ?? extractZipsFromText(fields.description)[0] ?? null;
    let resolvedAreaFin: string | null = record.area ?? null;
    let routingHintFin: string | null = null;
    if (!resolvedAreaFin && extractedZipFin) {
      const zr = resolveZipToArea(extractedZipFin, normalizedText);
      if (zr) { resolvedAreaFin = zr.area; routingHintFin = zr.typicalRouting ?? null; }
      else     { resolvedAreaFin = `ZIP ${extractedZipFin}`; }
    }
    let resolvedCustomerFin: string | null = entityResultFin.customer?.canonicalName ?? null;
    if (!resolvedCustomerFin && record.customer?.trim()) {
      const rawLookup = lookupEntity(record.customer.trim());
      const isOp = rawLookup !== null && (rawLookup.entry.entityType === 'deepsea_terminal' || rawLookup.entry.entityType === 'depot' || rawLookup.entry.entityType === 'transporter' || rawLookup.entry.entityType === 'carrier');
      if (!isOp) resolvedCustomerFin = rawLookup ? rawLookup.entry.canonicalName : record.customer.trim();
    }
    if (resolvedCustomerFin && (isInternalISRLabel(resolvedCustomerFin) || isCustomerJunkLabel(resolvedCustomerFin))) resolvedCustomerFin = null;
    return {
      issues: ['rate'], primaryIssue: 'rate', secondaryIssue: null,
      issueState: 'unknown', confidence: 0.92,
      resolvedTransporter: entityResultFin.transporter?.canonicalName ?? null,
      resolvedDepot: entityResultFin.depot?.canonicalName ?? null,
      resolvedDeepseaTerminal: entityResultFin.deepseaTerminal?.canonicalName ?? null,
      resolvedCustomer: resolvedCustomerFin,
      allEntities: entityResultFin.allEntities, unknownEntities: entityResultFin.unknownEntities,
      extractedZip: extractedZipFin, resolvedArea: resolvedAreaFin, routingHint: routingHintFin,
      routingAlignment: extractedZipFin ? 'aligned' : 'no_zip',
      reviewFlag: false, unresolvedReason: null,
      evidence: [`[financial-subject-override] Subject contains financial pattern — forced to rate`],
      sourceFieldsUsed,
      detectedIntent: 'financial', detectedObject: 'Invoice / Rate / Charge',
      triggerPhrase: FINANCIAL_SUBJECT_PATTERNS.find(p => subjectLower.includes(p)) ?? 'financial subject',
      triggerSourceField: 'subject',
    };
  }

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
      // load_ref (Missing Load Reference) from the subject line is severely
      // down-weighted. Subject lines frequently contain incidental "load ref"
      // phrases in billing, routing, and demurrage emails. The description
      // and ISR must corroborate the topic for load_ref to reach meaningful
      // confidence. ref_provided from subject is NOT reduced — an explicit
      // reference value in the subject is a reliable provided-ref signal.
      const effectiveWeight =
        key === 'subject' && m.issueId === 'load_ref'
          ? LOAD_REF_SUBJECT_WEIGHT
          : weight;
      const weightedConf = Math.min(m.confidence * effectiveWeight, 0.98);
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

  // Apply intent-priority filter: suppress lower-priority intent categories
  // when a higher-priority intent has a strong match (≥0.75).
  // ruleMatches is preserved unchanged for the load_ref gate's next-best lookup.
  const filteredMatches = filterByIntentPriority(ruleMatches);

  // ── 9 + 10. Assign primary and secondary ─────────────────────
  let issues: string[] = [];
  let issueState: IssueState = 'unknown';
  let confidence = 0;
  let evidence: string[] = [];
  let reviewFlag = false;
  let unresolvedReason: string | null = null;

  if (filteredMatches.length > 0) {
    const primary = filteredMatches[0];
    issues       = [...new Set(filteredMatches.map(m => m.issueId))];
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
      // Case A: no description-level evidence, but a ref code immediately follows keyword.
      // Guard: only convert to ref_provided if the load_ref gate would NOT reject this as
      // a planning/billing context. A capacity query that mentions "booking reference BKG12345"
      // in passing should NOT become ref_provided — the ref code is incidental.
      // PRECISION FIX: require at least one digit in the reference code segment.
      // This prevents matching Dutch/German words like "sturen", "zending", "order"
      // (which are 4+ chars but contain no digit) as reference codes.
      // Real reference codes like BKG12345, ABC123, MAEU1234567 always contain digits.
      const refNumPresent = /(?:(?:load\s*)?ref(?:erence)?|loadref|booking\s*ref(?:erence)?)\s*(?:no\.?\s*|#\s*)?[A-Z0-9]*[0-9][A-Z0-9]{3,}/i.test(normalizedText);
      if (refNumPresent) {
        // Pre-check: if the load_ref gate would reject this case, don't convert to ref_provided.
        const caseAGate = validateLoadRefMissing(
          fields.subject    ?? '',
          fields.description ?? '',
          fields.isr_details ?? '',
        );
        // Only convert to ref_provided when the gate doesn't have a planning-context rejection
        // OR when it accepts (the ref code is meaningful in context, not incidental).
        const gatePlanningBlock = !caseAGate.valid && caseAGate.rejectReason?.includes('Planning/operational context');
        if (!gatePlanningBlock) {
          issues = issues.map(i => i === 'load_ref' ? 'ref_provided' : i);
          issueState = 'provided';
          evidence.push('load-ref number present in text → ref_provided');
        }
      }
    }
  }

  // ── Document direction guard (CHANGE G) ──────────────────────────────────
  // When customs/t1 topic is in issues AND the combined text has explicit
  // document-provision language, reclassify as ref_provided.
  // This prevents "please find attached T1" from being classified as t1 (missing).
  const DOC_PROVISION_TOPICS = new Set(['customs', 't1', 'portbase', 'bl']);
  if (issues.some(i => DOC_PROVISION_TOPICS.has(i))) {
    const lowerNorm = normalizedText.toLowerCase();
    const providedDocMatch = PROVIDED_DOC_PATTERNS.find(p => lowerNorm.includes(p));
    if (providedDocMatch) {
      issues = issues.map(i => DOC_PROVISION_TOPICS.has(i) ? 'ref_provided' : i);
      // Ensure ref_provided is unique — deduplicate
      issues = [...new Set(issues)];
      issueState = 'provided';
      evidence.push(`[doc-provision-guard] Provided-doc signal "${providedDocMatch}" detected — reclassified doc topic to ref_provided`);
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

  // ── Strict load_ref missing gate ─────────────────────────────────
  //
  // HIGH-PRECISION RULE: a case may classify as load_ref (Missing Load Reference)
  // ONLY when there is explicit evidence that a load reference is absent or
  // being requested. Planning/feasibility/booking-inquiry language does NOT qualify.
  //
  // If load_ref is still present after the disambiguation steps above, it means
  // the state is missing/unknown (provided would have resolved to ref_provided).
  // Validate against three layers:
  //   1. Explicit missing phrase in description/ISR → accept
  //   2. Planning/operational context in description/ISR → reject
  //   3. Proximity: load-ref keyword + strict missing indicator → accept
  //   4. Subject-level checks (lower trust) → accept or reject
  //   5. No signal → reject
  //
  // On rejection: remove load_ref from issues. If it was primary, promote the
  // next-best classification and store the rejection reason in evidence for audit.
  // If no alternatives exist, reset confidence to trigger the recovery pass.
  //
  // Audit trail: on both accept and reject, the exact trigger phrase and source
  // field are stored in evidence for inspection in the full classified export.
  let loadRefGateRejected = false;

  if (issues.includes('load_ref')) {
    const gateResult = validateLoadRefMissing(
      fields.subject    ?? '',
      fields.description ?? '',
      fields.isr_details ?? '',
    );

    if (!gateResult.valid) {
      loadRefGateRejected = true;
      const wasPrimary = issues[0] === 'load_ref';
      issues = issues.filter(i => i !== 'load_ref');
      evidence.push(`[load_ref-gate] REJECTED: ${gateResult.rejectReason}`);

      if (wasPrimary) {
        // Find the next-best match from the already-ranked ruleMatches list
        const nextBest = ruleMatches.find(
          m => m.issueId !== 'load_ref' && issues.includes(m.issueId),
        );
        if (nextBest) {
          issueState = nextBest.state;
          confidence = nextBest.confidence;
          // Replace evidence: rejection note + new primary's evidence
          evidence = [
            `[load_ref-gate] REJECTED: ${gateResult.rejectReason}`,
            ...nextBest.evidence.map(e => `[promoted-primary] ${e}`),
          ];
        } else if (issues.length === 0) {
          // No alternatives — reset to trigger recovery pass below
          confidence = 0;
          issueState = 'unknown';
        }
      }
    } else {
      // Accepted — store trigger phrase, source field, and body intent for audit.
      // Every accepted Missing Load Reference case must carry a full audit trail:
      // trigger phrase, source field, and detected body intent class.
      const bodyIntentResult = detectBodyIntent(
        fields.description ?? '',
        fields.isr_details  ?? '',
      );
      evidence.push(
        `[load_ref-gate] ACCEPTED: trigger="${gateResult.triggerPhrase}" source=${gateResult.sourceField}` +
        ` body_intent=${bodyIntentResult.intent}` +
        (bodyIntentResult.trigger ? ` ("${bodyIntentResult.trigger}")` : ''),
      );
    }
  }

  // ── Recovery pass re-check after gate rejection ───────────────────
  // If the load_ref gate left issues empty, re-run the recovery pass.
  // HARD ENFORCEMENT: if gate rejected load_ref, neither fallback nor clue
  // scan may reintroduce it — filter it out before adopting any result.
  if (issues.length === 0 && confidence < 0.50) {
    const fallback = fallbackClassify(normalizedText);
    if (fallback && (!loadRefGateRejected || fallback.issueId !== 'load_ref')) {
      issues     = [fallback.issueId];
      issueState = fallback.state;
      confidence = fallback.confidence;
      evidence   = [...evidence, ...fallback.evidence];
    }
    if (issues.length === 0) {
      const clue = operationalClueScan(normalizedText);
      if (clue && (!loadRefGateRejected || clue.issueId !== 'load_ref')) {
        issues     = [clue.issueId];
        issueState = clue.state;
        confidence = clue.confidence;
        evidence   = [...evidence, ...clue.evidence];
        reviewFlag = true;
        unresolvedReason = 'Classified by operational clue after load_ref gate rejection.';
      }
    }
    if (issues.length === 0) {
      issues           = ['other'];
      issueState       = 'unknown';
      confidence       = 0.10;
      reviewFlag       = true;
      unresolvedReason = 'load_ref gate rejected primary; no recovery match found.';
    }
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
    const rawDescMatches = classifyByRules(fields.description);
    // HARD ENFORCEMENT: gate-rejected load_ref may never re-enter via description override
    const descOnlyMatches = loadRefGateRejected
      ? rawDescMatches.filter(m => m.issueId !== 'load_ref')
      : rawDescMatches;
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
      // Intent priority guard: don't let a lower-priority-intent description topic
      // override a higher-priority-intent overall primary.
      // e.g. financial (priority 1) must not be overridden by documentation (4) or
      // operational (5) even when the description's top match is a doc/delay topic.
      const currentIntentPriority = INTENT_PRIORITY[TOPIC_INTENT[overallPrimary] ?? 'unknown'] ?? 9;
      const descIntentPriority    = INTENT_PRIORITY[TOPIC_INTENT[descPrimary.issueId] ?? 'unknown'] ?? 9;
      const intentAllowsOverride  = descIntentPriority <= currentIntentPriority;

      if (topicsDiffer && descConfidentEnough && intentAllowsOverride) {
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

  // ── Final safety net: gate-rejected load_ref must not survive ─────
  if (loadRefGateRejected) {
    issues = issues.filter(i => i !== 'load_ref');
    if (issues.length === 0) {
      issues           = ['other'];
      issueState       = 'unknown';
      confidence       = 0.10;
      reviewFlag       = true;
      unresolvedReason = unresolvedReason ?? 'load_ref gate rejected; safety net applied — no remaining classification.';
    }
  }

  // ── Planning context guard for compliance topics ──────────────────────
  //
  // Customs / T1 / Portbase / BL should only classify as compliance issues when
  // there is explicit document-missing or document-request language. Planning /
  // feasibility / scheduling emails that mention a compliance term incidentally
  // (e.g. "Is there capacity? We also need to arrange customs clearance") should
  // NOT classify as compliance — the compliance term is contextual, not the core issue.
  //
  // This guard fires when:
  //   1. Primary is a compliance topic
  //   2. Text contains strong planning / feasibility / scheduling language
  //   3. Text does NOT contain explicit doc-missing / doc-request language
  //
  // Effect: reduce confidence by 0.25 (min 0.30) so the planning category can win
  // if it has meaningful confidence, and flag for review.
  const PLANNING_COMPLIANCE_TOPICS = new Set(['customs', 't1', 'portbase', 'bl']);
  const PLANNING_CONTEXT_KEYWORDS_FOR_DOC = [
    'feasibility', 'capacity', 'slot', 'scheduling', 'loading date', 'load date',
    'rail cut', 'barge schedule', 'loading window', 'intermodal',
    'can we load', 'please advise if', 'is it possible', 'is there capacity',
    'no capacity', 'fully booked',
  ];
  const EXPLICIT_DOC_MISSING_SIGNALS = [
    'missing', 'not received', 'not provided', 'required', 'needed',
    'please send', 'please provide', 'please forward', 'not available',
    'not found', 'outstanding', 'still waiting for', 'request',
  ];

  if (PLANNING_COMPLIANCE_TOPICS.has(issues[0])) {
    const lowerNorm = normalizedText.toLowerCase();
    const hasPlanning = PLANNING_CONTEXT_KEYWORDS_FOR_DOC.some(kw => lowerNorm.includes(kw));
    const hasDocMissing = EXPLICIT_DOC_MISSING_SIGNALS.some(kw => lowerNorm.includes(kw));
    if (hasPlanning && !hasDocMissing) {
      confidence = Math.max(confidence - 0.25, 0.30);
      evidence.push(
        `[planning-compliance-guard] Planning context detected for ${issues[0]} without explicit doc-missing language — confidence reduced`,
      );
      if (!reviewFlag) {
        reviewFlag = true;
        unresolvedReason = `Planning/feasibility context detected for compliance topic (${issues[0]}) without explicit missing-document evidence. Verify manually.`;
      }
    }
  }

  // ── Section 3: Customs / Compliance operational context check ────
  //
  // Customs / T1 / Portbase / BL cases should represent operational delays
  // caused by transporters requesting missing documents for physical movements.
  // Internal-only CX conversations that have no transporter, driver, container,
  // or operational movement context should NOT be counted as compliance issues —
  // they are likely informational emails or internal process discussions.
  //
  // Gate: soft confidence penalty only (not a hard block).
  // If NO transporter is resolved AND the combined text contains NONE of the
  // operational context keywords below, reduce confidence and set review flag.
  // This avoids over-blocking legitimate cases where the transporter name is
  // unknown but operational context is clearly present.
  const CUSTOMS_COMPLIANCE_TOPICS = new Set(['customs', 't1', 'portbase', 'bl']);
  const OPERATIONAL_CONTEXT_KEYWORDS: string[] = [
    // Transport actors
    'haulier', 'hauler', 'driver', 'truck', 'lorry', 'transporter', 'carrier',
    'forwarder', 'freight forwarder', 'customs agent', 'customs broker',
    // Physical movement
    'container', 'cntr', 'pickup', 'pick up', 'pick-up', 'delivery',
    'collect', 'collection', 'loading', 'unloading', 'discharge',
    // Locations / gates
    'terminal', 'depot', 'warehouse', 'gate out', 'gate in',
    // Status signals
    'blocked', 'held', 'on hold', 'clearance', 'release', 'cargo',
    'shipment', 'freight', 'transport order', 'movement',
  ];
  if (CUSTOMS_COMPLIANCE_TOPICS.has(issues[0])) {
    const hasTransporterEntity = resolvedTransporter !== null;
    const normalizedLower = normalizedText.toLowerCase();
    const hasOperationalContext = OPERATIONAL_CONTEXT_KEYWORDS.some(kw =>
      normalizedLower.includes(kw),
    );
    if (!hasTransporterEntity && !hasOperationalContext) {
      const penalty = 0.15;
      confidence = Math.max(confidence - penalty, 0.30);
      if (!reviewFlag) {
        reviewFlag = true;
        unresolvedReason = (
          `Customs/compliance topic (${issues[0]}) but no transporter entity or ` +
          `operational movement context found — may be internal/CX only. Manual review recommended.`
        );
      }
      evidence.push(
        `[customs-context-check] No transporter entity or operational context found ` +
        `— confidence reduced by ${(penalty * 100).toFixed(0)}%`,
      );
    }
  }

  // ── POST-CLASSIFICATION SANITY CHECK (FIX E) ─────────────────
  // ref_provided must not override financial, equipment, or explicit-missing-doc intent.
  // These overrides run after all other guards to catch any remaining misrouting.
  if (issues[0] === 'ref_provided') {
    const lowerNormCheck = normalizedText.toLowerCase();

    // If strong financial signal exists → override to rate
    if (hasStrongFinancialContext(lowerNormCheck)) {
      issues = ['rate', ...issues.filter(i => i !== 'ref_provided')];
      confidence = Math.max(confidence, 0.80);
      evidence.push('[sanity-check] ref_provided overridden to rate — strong financial signal detected');
    }

    // If strong equipment signal exists → override to equipment
    const EQUIPMENT_OVERRIDE_SIGNALS = [
      'portable not ok', 'container damaged', 'damaged container',
      'equipment issue', 'reefer issue', 'seal broken', 'container not ok',
      'container defect', 'container beschadigd', 'container defekt',
      'unit not ok', 'equipment not ok', 'trailer not ok',
    ];
    if (issues[0] === 'ref_provided' && EQUIPMENT_OVERRIDE_SIGNALS.some(s => lowerNormCheck.includes(s))) {
      issues = ['equipment', ...issues.filter(i => i !== 'ref_provided')];
      confidence = Math.max(confidence, 0.80);
      evidence.push('[sanity-check] ref_provided overridden to equipment — strong equipment signal detected');
    }

    // If explicit missing-doc signal exists → override to customs/t1
    const MISSING_DOC_OVERRIDE = [
      'missing customs docs portbase', 'customs documents in portbase missing',
      'portbase customs missing', 'portbase customs docs missing',
      'missing customs docs', 'customs documents missing',
      't1 missing', 'missing t1', 'mrn missing', 'missing mrn',
    ];
    if (issues[0] === 'ref_provided' && MISSING_DOC_OVERRIDE.some(s => lowerNormCheck.includes(s))) {
      // Determine if this is portbase/customs context
      const isPortbase = lowerNormCheck.includes('portbase') && lowerNormCheck.includes('customs');
      const newIssue = isPortbase ? 'customs' : (lowerNormCheck.includes('t1') ? 't1' : 'customs');
      issues = [newIssue, ...issues.filter(i => i !== 'ref_provided')];
      issueState = 'missing';
      confidence = Math.max(confidence, 0.80);
      evidence.push(`[sanity-check] ref_provided overridden to ${newIssue} — explicit missing-doc signal detected`);
    }
  }

  // ── Customs/portbase + "missing" guard (FIX B) ─────────────────
  // When primary is closing_time but text contains customs + missing,
  // override to customs (or portbase if portbase keyword is present).
  if (issues[0] === 'closing_time') {
    const lowerNormB = normalizedText.toLowerCase();
    const hasCustoms = lowerNormB.includes('customs') || lowerNormB.includes('douane') || lowerNormB.includes('zoll');
    const hasMissing = lowerNormB.includes('missing') || lowerNormB.includes('ontbreekt') || lowerNormB.includes('fehlt');
    if (hasCustoms && hasMissing) {
      const hasPortbase = lowerNormB.includes('portbase');
      const overrideIssue = hasPortbase ? 'customs' : 'customs';
      issues = [overrideIssue, ...issues.filter(i => i !== 'closing_time')];
      issueState = 'missing';
      confidence = Math.max(confidence, 0.80);
      evidence.push(`[customs-missing-guard] closing_time overridden to ${overrideIssue} — customs + missing signals detected`);
    }
  }

  const primaryIssue   = issues[0];
  const secondaryIssue = issues.length > 1 ? issues[1] : null;

  // ── Diagnostic transparency fields ───────────────────────────
  const detectedIntent      = TOPIC_INTENT[primaryIssue] ?? 'unknown';
  const detectedObject      = DETECTED_OBJECT_MAP[primaryIssue] ?? primaryIssue;
  const triggerInfo         = extractTriggerInfo(evidence);

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
    detectedIntent,
    detectedObject,
    triggerPhrase:       triggerInfo.triggerPhrase,
    triggerSourceField:  triggerInfo.sourceField,
  };
}
