// ─────────────────────────────────────────────────────────────────
// Classification Validators
//
// Pure, side-effect-free helper functions that validate key
// classification invariants.
//
// These functions are designed to be testable in isolation — they
// depend only on their arguments, not on module-level state.
//
// Used by:
//   - analyzeData.ts DEV validation block
//   - Future automated tests
// ─────────────────────────────────────────────────────────────────

import { PROVIDED_REF_PATTERNS } from './loadRefGuards';
import {
  isBlockedFromCustomerRole,
  isPositiveCustomerCandidate,
} from '../config/referenceData';

// ─── Transport Order Detection ────────────────────────────────────

/**
 * Transport order phrase patterns.
 * A case containing any of these should classify as transport_order,
 * NOT as load_ref (Missing Load Reference).
 *
 * Use detectsTransportOrder() to check any free-text field.
 */
export const TRANSPORT_ORDER_PATTERNS: RegExp[] = [
  /\btransport\s+order\b/i,
  /\btransport\s+instruction\b/i,
  /\bhaulier\s+order\b/i,
  /\bhaulier\s+instruction\b/i,
  /\bdriver\s+order\b/i,
  /\bdriver\s+instruction\b/i,
  /\bmovement\s+order\b/i,
  /\btransport\s+booking\s+order\b/i,
  /\bmissing\s+transport\s+order\b/i,
  /\btransport\s+order\s+(?:missing|not\s+received|required|not\s+issued|not\s+sent)\b/i,
  /\b(?:please\s+send|send\s+us|send\s+the)\s+(?:the\s+)?transport\s+order\b/i,
];

/**
 * Returns true if the text contains transport order phrasing.
 *
 * Use this to verify that a case about a transport order is correctly
 * classified as transport_order rather than load_ref.
 *
 * @example
 * detectsTransportOrder("Please send us the transport order for BL MAEU262065895")
 * // → true
 *
 * detectsTransportOrder("Please provide load ref for BL MAEU262065895")
 * // → false
 */
export function detectsTransportOrder(text: string): boolean {
  return TRANSPORT_ORDER_PATTERNS.some(p => p.test(text));
}

// ─── Load Reference False-Positive Detection ─────────────────────

/**
 * Returns true if a case has all three conditions that define a
 * load-reference false positive:
 *   1. classified as load_ref (Missing Load Reference)
 *   2. issue state is NOT 'provided'
 *   3. description contains a provided-reference pattern
 *
 * A case matching all three conditions was misclassified — the
 * description body shows the reference was provided, not missing.
 *
 * @example
 * isLoadRefFalsePositive('load_ref', 'missing', 'Please find below load ref BKG12345')
 * // → true  (body provides ref, state should be 'provided')
 *
 * isLoadRefFalsePositive('load_ref', 'provided', 'Load ref BKG12345 see below')
 * // → false  (state is already correct)
 *
 * isLoadRefFalsePositive('delay', 'delayed', 'Driver not yet arrived')
 * // → false  (not a load_ref case at all)
 */
export function isLoadRefFalsePositive(
  primaryIssue: string,
  issueState: string,
  description: string,
): boolean {
  if (primaryIssue !== 'load_ref') return false;
  if (issueState === 'provided') return false;
  if (!description || description.trim().length <= 10) return false;
  return PROVIDED_REF_PATTERNS.some(p => p.test(description));
}

// ─── Drilldown Integrity ──────────────────────────────────────────

export interface DrilldownIntegrityResult {
  /** True only if every record in the set matches the expected category. */
  valid: boolean;
  /** Number of records whose primaryIssue does NOT match expectedCategory. */
  violations: number;
  /** Total records in the set. */
  total: number;
  /** Proportion of correctly-matched records (0–1). */
  matchRate: number;
}

/**
 * Validates that all records in an issue drilldown set share the same
 * primary issue as the selected category.
 *
 * A valid drilldown has violations === 0.
 * A non-empty violations count means the drilldown is contaminated with
 * records whose primary classification is a different issue.
 *
 * @param records   Records returned by the drilldown
 * @param expectedCategory  The taxonomy id the user clicked (e.g. 'load_ref')
 *
 * @example
 * validateDrilldownIntegrity(
 *   [{primaryIssue: 'load_ref'}, {primaryIssue: 'delay'}],
 *   'load_ref'
 * )
 * // → { valid: false, violations: 1, total: 2, matchRate: 0.5 }
 */
export function validateDrilldownIntegrity(
  records: Array<{ primaryIssue: string }>,
  expectedCategory: string,
): DrilldownIntegrityResult {
  const total = records.length;
  if (total === 0) return { valid: true, violations: 0, total: 0, matchRate: 1 };
  const violations = records.filter(r => r.primaryIssue !== expectedCategory).length;
  return {
    valid: violations === 0,
    violations,
    total,
    matchRate: (total - violations) / total,
  };
}

// ─── Case Number Preservation ─────────────────────────────────────

export interface CaseNumberReport {
  /** Records that have a non-empty case_number value. */
  preserved: number;
  /** Total records in the dataset. */
  total: number;
  /** Fraction with case numbers (0–1). */
  pct: number;
  /** True when at least one case number is present. */
  hasAny: boolean;
}

/**
 * Reports how many records in the dataset have a Case Number value.
 *
 * A low preservation rate means the evidence drilldown will show "—"
 * instead of clickable case links for most rows.
 *
 * @example
 * validateCaseNumberPreservation([
 *   {case_number: '2602-351667093'},
 *   {case_number: null},
 *   {case_number: '2602-351667094'},
 * ])
 * // → { preserved: 2, total: 3, pct: 0.667, hasAny: true }
 */
export function validateCaseNumberPreservation(
  records: Array<{ case_number?: string | null }>,
): CaseNumberReport {
  const total = records.length;
  const preserved = records.filter(r => r.case_number && r.case_number.trim().length > 0).length;
  return {
    preserved,
    total,
    pct: total > 0 ? preserved / total : 0,
    hasAny: preserved > 0,
  };
}

// ─── Customer Acceptance Audit ────────────────────────────────────

export interface CustomerAcceptanceResult {
  /** True if isBlockedFromCustomerRole() fired. */
  blocked: boolean;
  /** True if isPositiveCustomerCandidate() passed (only meaningful when not blocked). */
  positiveGate: boolean;
  /** True only when not blocked AND positive gate passes. */
  accepted: boolean;
  /** Human-readable reason for rejection, or 'accepted' if accepted. */
  reason: string;
}

/**
 * Audits a customer name through both acceptance gates and returns a
 * structured explanation of why it was accepted or rejected.
 *
 * Useful for investigating unexpected inclusions or exclusions in the
 * Customer Burden chart without having to trace the code manually.
 *
 * @example
 * auditCustomerAcceptance('BASF SE')
 * // → { blocked: false, positiveGate: true, accepted: true, reason: 'accepted' }
 *
 * auditCustomerAcceptance('NL57ABNA0421705191')
 * // → { blocked: false, positiveGate: false, accepted: false,
 * //     reason: 'failed positive gate (not a company name structure)' }
 *
 * auditCustomerAcceptance('Optimodal Nederland B.V.')
 * // → { blocked: true, positiveGate: false, accepted: false,
 * //     reason: 'blocked — operational entity / carrier / ISR label' }
 */
export function auditCustomerAcceptance(name: string): CustomerAcceptanceResult {
  if (!name || !name.trim()) {
    return { blocked: false, positiveGate: false, accepted: false, reason: 'empty or null name' };
  }
  if (isBlockedFromCustomerRole(name)) {
    return { blocked: true, positiveGate: false, accepted: false, reason: 'blocked — operational entity / carrier / ISR label' };
  }
  const pos = isPositiveCustomerCandidate(name);
  if (!pos) {
    return { blocked: false, positiveGate: false, accepted: false, reason: 'failed positive gate (not a company name structure)' };
  }
  return { blocked: false, positiveGate: true, accepted: true, reason: 'accepted' };
}

// ─── Sentence Fragment Detection ─────────────────────────────────

/**
 * Returns true if the string is clearly a sentence fragment or email prose
 * rather than a company/account name.
 *
 * Checks for:
 *  - Negated verb phrases ("did not", "has not", etc.)
 *  - Auto-generated email phrases
 *  - Sentence-opener patterns
 *  - Fragment ending with a bare preposition
 *  - 6+ word strings without a legal suffix
 *
 * @example
 * isSentenceFragment('did not forward the customs documents to')
 * // → true
 *
 * isSentenceFragment('This is an automatically generated E-mail')
 * // → true
 *
 * isSentenceFragment('BASF SE')
 * // → false
 */
export const SENTENCE_FRAGMENT_PATTERNS: RegExp[] = [
  // Finite English verb phrases — sentences, not company names
  /\b(did\s+not|has\s+not|have\s+not|was\s+not|were\s+not|had\s+not|is\s+not|are\s+not|could\s+not|would\s+not|will\s+not|shall\s+not|does\s+not|do\s+not)\b/i,
  // Auto-generated / system notification phrases
  /\bautomatically\s+generated\b/i,
  /\bdo\s+not\s+reply\b/i,
  /\bno[\s\-]?reply\b/i,
  // Sentence-opener patterns (demonstratives/articles — never a company name)
  /^(this\s+(is|was|are|will)|there\s+(is|are|was|were)|it\s+(is|was)|the\s+(above|below|following|attached|enclosed))\b/i,
  // Fragment ending with a bare preposition (sentence tail, not a company name)
  /\s+(to|from|for|with|of|by|at|in|on)\s*\.?\s*$/i,
  // Single-word portal / system / interface labels (not company names)
  // Mirrors the CUSTOMER_JUNK_PATTERNS entry in referenceData.ts — keep in sync.
  /^(portal|system|platform|application|app|software|database|server|interface|module|dashboard|tool|solution|service\s+portal|customer\s+portal|web\s+portal)\.?\s*$/i,
];

export function isSentenceFragment(text: string): boolean {
  if (!text || !text.trim()) return false;
  if (SENTENCE_FRAGMENT_PATTERNS.some(p => p.test(text))) return true;
  // Word-count ceiling: 6+ tokens without a legal suffix
  const tokens = text.trim().split(/\s+/);
  const hasLegalSuffix = /\b(gmbh|b\.?v\.?|n\.?v\.?|s\.?a\.?|ltd\.?|limited|inc\.?|corp\.?|llc\.?|plc\.?|a\.?g\.?|s\.?e\.?|k\.?g\.?|u\.?g\.?|s\.?r\.?l\.?|s\.?p\.?a\.?)\b/i.test(text);
  if (tokens.length >= 6 && !hasLegalSuffix) return true;
  return false;
}

// ─── Customs / Compliance Provided-State Validation ───────────────

/**
 * Document-provision patterns: phrases that indicate a customs/T1/Portbase/BL
 * document IS BEING PROVIDED — not requested.
 *
 * If any of these appear in the description of a case whose primaryIssue is
 * 'customs', 't1', 'portbase', or 'bl', the classification is wrong — the
 * resolveIssueId fork in issueRules.ts should have mapped it to 'ref_provided'.
 */
export const CUSTOMS_PROVIDED_PATTERNS: RegExp[] = [
  /\bplease\s+find\s+attached\b/i,
  /\bherewith\b/i,
  /\bhereby\b/i,
  /\bcustoms\s+docs?\s+(attached|enclosed|herewith|sent|forwarded|below)\b/i,
  /\b(attached|enclosed)\s+(mrn|t1|customs|b\/l|bl)\b/i,
  /\b(mrn|t1|bl|b\/l|customs\s+docs?)\s+(attached|enclosed|sent|forwarded)\b/i,
  /\bplease\s+see\s+attached\s+(mrn|t1|customs|bl)\b/i,
  /\bfind\s+(below|attached)\s+(the\s+)?(mrn|t1|customs|bl)\b/i,
];

export interface CustomsProvidedResult {
  /** True if the record shows a document-provision event but is classified as a compliance issue. */
  isContaminated: boolean;
  /** The pattern that triggered this, if any. */
  trigger: string | null;
}

/**
 * Returns true when a case classified as customs/t1/portbase/bl has a body
 * that shows the document was PROVIDED — meaning resolveIssueId should have
 * forked it to ref_provided.
 *
 * @example
 * validateCustomsProvided('customs', 'missing', 'Please find attached customs documents')
 * // → { isContaminated: true, trigger: 'please find attached' }
 *
 * validateCustomsProvided('customs', 'missing', 'MRN not received — please send')
 * // → { isContaminated: false, trigger: null }
 */
export function validateCustomsProvided(
  primaryIssue: string,
  issueState: string,
  description: string,
): CustomsProvidedResult {
  const COMPLIANCE_TOPICS = new Set(['customs', 't1', 'portbase', 'bl']);
  if (!COMPLIANCE_TOPICS.has(primaryIssue)) return { isContaminated: false, trigger: null };
  if (issueState === 'provided') return { isContaminated: false, trigger: null }; // already correct
  if (!description || description.trim().length <= 10) return { isContaminated: false, trigger: null };

  for (const p of CUSTOMS_PROVIDED_PATTERNS) {
    if (p.test(description)) {
      return { isContaminated: true, trigger: p.source };
    }
  }
  return { isContaminated: false, trigger: null };
}

// ─── Hotspot Label Validation ─────────────────────────────────────

import { isAllowedAreaLabel } from '../config/referenceData';

export interface HotspotLabelReport {
  allowed: string[];
  suppressed: string[];
  suppressedCount: number;
}

/**
 * Audits a list of area labels against the hotspot allowlist.
 * Returns which labels would appear in the chart and which would be suppressed.
 *
 * @example
 * auditHotspotLabels(['Rotterdam', 'Hamburg', 'Mainz / Germersheim'])
 * // → { allowed: ['Rotterdam', 'Mainz / Germersheim'], suppressed: ['Hamburg'], suppressedCount: 1 }
 */
export function auditHotspotLabels(labels: string[]): HotspotLabelReport {
  const allowed: string[] = [];
  const suppressed: string[] = [];
  for (const label of labels) {
    if (isAllowedAreaLabel(label)) {
      allowed.push(label);
    } else {
      suppressed.push(label);
    }
  }
  return { allowed, suppressed, suppressedCount: suppressed.length };
}

// ─── Financial False-Negative Detection ──────────────────────────

/**
 * Flags cases where financial language is present but the primary classification
 * is NOT a financial topic (rate, waiting_time, damage).
 *
 * A financial false-negative means the classifier missed financial intent and
 * assigned a lower-priority category instead.
 *
 * @example
 * validateFinancialFalseNegative('delay', 'selfbilling report for week 12 attached')
 * // → { isFalseNegative: true, financialTrigger: 'selfbilling' }
 *
 * validateFinancialFalseNegative('rate', 'invoice query regarding overcharge')
 * // → { isFalseNegative: false, financialTrigger: null }
 */
const FINANCIAL_TOPICS = new Set(['rate', 'waiting_time', 'damage']);

const FINANCIAL_TRIGGER_KEYWORDS: string[] = [
  'selfbilling', 'self billing', 'self-billing',
  'dch invoice', 'dch billing', 'dch report',
  'extra cost invoice', 'extra costs invoice',
  'invoice query', 'invoice dispute', 'invoice incorrect', 'invoice missing',
  'billing dispute', 'billing query', 'billing error',
  'credit note', 'debit note', 'credit memo', 'debit memo',
  'overcharged', 'overcharge', 'charge dispute',
  'wrong invoice', 'incorrect invoice',
  'demurrage invoice', 'detention invoice', 'storage invoice',
  'price correction', 'rate dispute', 'rate discrepancy',
];

export interface FinancialFalseNegativeResult {
  isFalseNegative: boolean;
  financialTrigger: string | null;
}

export function validateFinancialFalseNegative(
  primaryIssue: string,
  combinedText: string,
): FinancialFalseNegativeResult {
  if (FINANCIAL_TOPICS.has(primaryIssue)) {
    return { isFalseNegative: false, financialTrigger: null };
  }
  if (!combinedText) return { isFalseNegative: false, financialTrigger: null };
  const lower = combinedText.toLowerCase();
  for (const kw of FINANCIAL_TRIGGER_KEYWORDS) {
    if (lower.includes(kw)) {
      return { isFalseNegative: true, financialTrigger: kw };
    }
  }
  return { isFalseNegative: false, financialTrigger: null };
}

// ─── Planning / Documentation False Positive Detection ───────────

/**
 * Flags cases where strong planning/feasibility/scheduling language is present
 * but the classification is a compliance documentation topic (customs/t1/portbase/bl)
 * WITHOUT any explicit document-missing language.
 *
 * A planning-doc false positive means a planning email got classified as a
 * compliance issue because it mentioned a compliance term incidentally.
 *
 * @example
 * validatePlanningDocFalsePositive('customs', 'Is there capacity for this load? We need to arrange customs clearance.')
 * // → { isFalsePositive: true, planningTrigger: 'capacity', docMissingTrigger: null }
 *
 * validatePlanningDocFalsePositive('customs', 'Customs documents missing — please send MRN')
 * // → { isFalsePositive: false, planningTrigger: null, docMissingTrigger: null }
 */
const COMPLIANCE_DOC_TOPICS = new Set(['customs', 't1', 'portbase', 'bl']);

const PLANNING_TRIGGER_KEYWORDS: string[] = [
  'feasibility', 'capacity', 'slot', 'scheduling', 'loading date', 'load date',
  'rail cut', 'barge schedule', 'loading window', 'intermodal',
  'can we load', 'is it possible', 'is there capacity',
  'no capacity', 'fully booked',
];

const DOC_MISSING_KEYWORDS: string[] = [
  'missing', 'not received', 'not provided', 'required', 'needed',
  'please send', 'please provide', 'please forward',
  'not available', 'not found', 'outstanding',
];

export interface PlanningDocFalsePositiveResult {
  isFalsePositive: boolean;
  planningTrigger: string | null;
  docMissingTrigger: string | null;
}

export function validatePlanningDocFalsePositive(
  primaryIssue: string,
  combinedText: string,
): PlanningDocFalsePositiveResult {
  if (!COMPLIANCE_DOC_TOPICS.has(primaryIssue)) {
    return { isFalsePositive: false, planningTrigger: null, docMissingTrigger: null };
  }
  if (!combinedText) return { isFalsePositive: false, planningTrigger: null, docMissingTrigger: null };
  const lower = combinedText.toLowerCase();

  const planningTrigger = PLANNING_TRIGGER_KEYWORDS.find(kw => lower.includes(kw)) ?? null;
  const docMissingTrigger = DOC_MISSING_KEYWORDS.find(kw => lower.includes(kw)) ?? null;

  if (planningTrigger && !docMissingTrigger) {
    return { isFalsePositive: true, planningTrigger, docMissingTrigger: null };
  }
  return { isFalsePositive: false, planningTrigger, docMissingTrigger };
}

// ─── Equipment False Reference Detection ─────────────────────────

/**
 * Flags cases where equipment/container issue language is present but the
 * primary classification is ref_provided.
 *
 * Equipment condition failures (portable not ok, container damage, etc.) must
 * classify as equipment/equipment_release, not as Reference Update / Info Provided.
 *
 * @example
 * validateEquipmentFalseReference('ref_provided', 'portable not ok reported by driver')
 * // → { isFalseReference: true, equipmentTrigger: 'portable not ok' }
 */
const EQUIPMENT_TRIGGER_KEYWORDS: string[] = [
  'portable not ok', 'not portable', 'container damaged', 'equipment issue',
  'container issue', 'container not ok', 'reefer issue', 'seal broken',
  'damaged box', 'door issue', 'chassis issue', 'defective unit',
  'damage reported', 'technical issue with container', 'equipment not ok',
  'unit not ok', 'trailer not ok', 'not roadworthy', 'unit defective',
  'equipment defect', 'container defect', 'trailer defect',
  'equipment failure', 'equipment fault', 'container fault',
];

export interface EquipmentFalseReferenceResult {
  isFalseReference: boolean;
  equipmentTrigger: string | null;
}

export function validateEquipmentFalseReference(
  primaryIssue: string,
  combinedText: string,
): EquipmentFalseReferenceResult {
  if (primaryIssue !== 'ref_provided') {
    return { isFalseReference: false, equipmentTrigger: null };
  }
  if (!combinedText) return { isFalseReference: false, equipmentTrigger: null };
  const lower = combinedText.toLowerCase();
  const trigger = EQUIPMENT_TRIGGER_KEYWORDS.find(kw => lower.includes(kw)) ?? null;
  return { isFalseReference: trigger !== null, equipmentTrigger: trigger };
}

// ─── Transport Order / Load Reference Conflation Detection ────────

/**
 * Flags cases where transport order / work order language is present but the
 * classification is load_ref (Missing Load Reference) without any explicit
 * load-ref-missing phrase.
 *
 * Transport orders and work orders are distinct from load references.
 * They must not be conflated.
 *
 * @example
 * validateTransportOrderFalseLoadRef('load_ref', 'work order missing please send order')
 * // → { isConflated: true, transportOrderTrigger: 'work order', hasLoadRefMissing: false }
 */
const TRANSPORT_ORDER_KEYWORDS_FOR_VALIDATOR: string[] = [
  'transport order', 'work order', 'workorder', 'haulier order',
  'driver instruction', 'driver order', 'movement order',
];

const LOAD_REF_EXPLICIT_MISSING_SHORT: string[] = [
  'missing load ref', 'no load ref', 'load ref missing', 'load reference missing',
  'please provide load ref', 'load ref not provided', 'load ref required',
  'missing booking ref', 'no booking ref', 'booking ref missing',
];

export interface TransportOrderFalseLoadRefResult {
  isConflated: boolean;
  transportOrderTrigger: string | null;
  hasLoadRefMissing: boolean;
}

export function validateTransportOrderFalseLoadRef(
  primaryIssue: string,
  combinedText: string,
): TransportOrderFalseLoadRefResult {
  if (primaryIssue !== 'load_ref') {
    return { isConflated: false, transportOrderTrigger: null, hasLoadRefMissing: false };
  }
  if (!combinedText) return { isConflated: false, transportOrderTrigger: null, hasLoadRefMissing: false };
  const lower = combinedText.toLowerCase();

  const transportOrderTrigger = TRANSPORT_ORDER_KEYWORDS_FOR_VALIDATOR.find(kw => lower.includes(kw)) ?? null;
  const hasLoadRefMissing = LOAD_REF_EXPLICIT_MISSING_SHORT.some(kw => lower.includes(kw));

  if (transportOrderTrigger && !hasLoadRefMissing) {
    return { isConflated: true, transportOrderTrigger, hasLoadRefMissing: false };
  }
  return { isConflated: false, transportOrderTrigger, hasLoadRefMissing };
}

// ─── Reference Category Overuse Detection ────────────────────────

/**
 * Flags when the ref_provided category exceeds 5% of the total dataset.
 *
 * ref_provided (Reference Update / Info Provided) should be a residual bucket.
 * If it exceeds 5% of all classified records, it indicates the classifier is
 * over-applying the document-provision fork or has weak negative guards.
 *
 * @example
 * validateRefCategoryOveruse(50, 1000)
 * // → { isOverused: true, percentage: 5.0, threshold: 5.0 }
 *
 * validateRefCategoryOveruse(30, 1000)
 * // → { isOverused: false, percentage: 3.0, threshold: 5.0 }
 */
export interface RefCategoryOveruseResult {
  isOverused: boolean;
  percentage: number;
  threshold: number;
  refProvidedCount: number;
  totalCount: number;
}

/** Target maximum percentage for ref_provided. */
export const REF_PROVIDED_OVERUSE_THRESHOLD = 5.0;

export function validateRefCategoryOveruse(
  refProvidedCount: number,
  totalCount: number,
  threshold = REF_PROVIDED_OVERUSE_THRESHOLD,
): RefCategoryOveruseResult {
  if (totalCount === 0) {
    return { isOverused: false, percentage: 0, threshold, refProvidedCount: 0, totalCount: 0 };
  }
  const percentage = (refProvidedCount / totalCount) * 100;
  return {
    isOverused: percentage >= threshold,
    percentage: parseFloat(percentage.toFixed(1)),
    threshold,
    refProvidedCount,
    totalCount,
  };
}

// ─── Week Range In Data Validation ────────────────────────────────

/**
 * Validates that the displayed dashboard week range is supported by the
 * actual uploaded data — not extended by outlier/parse-error weeks.
 *
 * A valid week range:
 *   - Has at least minDensity records per week for all boundary weeks
 *   - Has no outlier weeks (weeks with fewer than minDensity records)
 *     that are more than 4 weeks outside the dense range
 *
 * @param weeklyTotals   Map of weekKey → record count for that week
 * @param displayedRange The human-readable range string the dashboard shows
 * @param minDensity     Minimum records per week to be considered "dense" (default: 2)
 */
export interface WeekRangeValidationResult {
  valid: boolean;
  denseWeekCount: number;
  outlierWeekCount: number;
  outlierWeeks: string[];
  displayedRange: string;
}

export function validateWeekRangeInData(
  weeklyTotals: Record<string, number>,
  displayedRange: string,
  minDensity = 2,
): WeekRangeValidationResult {
  const allWeeks = Object.keys(weeklyTotals).sort();
  const denseWeeks = allWeeks.filter(w => (weeklyTotals[w] ?? 0) >= minDensity);
  const outlierWeeks = allWeeks.filter(w => (weeklyTotals[w] ?? 0) < minDensity);

  // Check if any outlier week falls far outside the dense range
  let valid = true;
  if (denseWeeks.length > 0 && outlierWeeks.length > 0) {
    const denseFirst = denseWeeks[0];
    const denseLast  = denseWeeks[denseWeeks.length - 1];
    for (const w of outlierWeeks) {
      // If an outlier week is more than 4 positions away from the dense range edges, flag
      const isBefore = w < denseFirst;
      const isAfter  = w > denseLast;
      if (isBefore || isAfter) {
        valid = false;
        break;
      }
    }
  }

  return {
    valid,
    denseWeekCount:   denseWeeks.length,
    outlierWeekCount: outlierWeeks.length,
    outlierWeeks,
    displayedRange,
  };
}
