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
