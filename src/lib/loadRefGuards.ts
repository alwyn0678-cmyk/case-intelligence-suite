// ─────────────────────────────────────────────────────────────────
// Load-Reference Guard Patterns
//
// Shared, testable patterns for detecting when a reference value
// has been PROVIDED (as opposed to requested/missing).
//
// Used by:
//   - classifyCase.ts  — description-override and contradiction guard
//   - analyzeData.ts   — DEV-mode false-positive scan
//   - validators.ts    — isLoadRefFalsePositive helper
// ─────────────────────────────────────────────────────────────────

/**
 * Patterns that indicate a load/booking reference value has been
 * explicitly provided in the text — not requested or missing.
 *
 * Match any one of these → issueState should be 'provided', not 'missing'.
 *
 * Design principle: prefer false-negative (misses a provided ref) over
 * false-positive (calls a missing ref "provided"). Better to flag for
 * review than to silently misclassify a genuine missing-ref case.
 *
 * Examples matched:
 *   "ref is BKG12345"
 *   "load ref: BKG12345"
 *   "the load ref is ABC123"
 *   "see below load ref"
 *   "please find below the reference"
 *   "attached herewith reference"
 *   "reference no BKG1234"
 *   "correct ref is BKG123"
 *   "updated ref BKG456"
 *   "load ref confirmed"
 *   "booking ref attached"
 *   "below is the load ref"
 */
export const PROVIDED_REF_PATTERNS: RegExp[] = [
  // ── Explicit value follows keyword ──────────────────────────────
  // "ref is BKG12345", "load ref: BKG12345", "reference: BKG12345"
  /(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|ref(?:erence)?)\s*(?:is|are|was|:)\s*[A-Z0-9]{4,}/i,
  // "reference no BKG1234", "ref # BKG1234", "load ref no. 12345"
  /(?:reference|load\s*ref|booking\s*ref)\s*(?:no\.?\s*|#\s*|:\s*)[A-Z0-9]{4,}/i,
  // "ref no. ABC123", "reference no 12345"
  /\bref(?:erence)?\s+no\.?\s*[A-Z0-9]{4,}/i,

  // ── "See below / find below" patterns ───────────────────────────
  // "see below load ref", "find below the reference", "please find below ref"
  /(?:see|find)\s+below.{0,80}(?:ref(?:erence)?|load|booking)/i,
  // "ref ... see below", "load ref see below"
  /(?:ref(?:erence)?|load|booking).{0,60}(?:see|find)\s+below/i,
  // "below is the load ref", "below is the reference", "below is the booking ref"
  /\bbelow\s+is\s+the\s+(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)/i,
  // "please find the load ref below", "you will find the ref below"
  /\b(?:find|see)\s+the\s+(?:load\s*)?ref(?:erence)?\s+below\b/i,

  // ── Attached / enclosed / herewith ──────────────────────────────
  // "attached herewith ref", "please find attached reference"
  /(?:attached|herewith|find\s+enclosed|please\s+find\s+attached).{0,80}(?:ref(?:erence)?|load|booking)/i,
  // "load ref attached", "booking ref attached", "reference is attached"
  /(?:ref(?:erence)?|load\s*ref|booking\s*ref).{0,60}(?:attached|enclosed|herewith|sent|forwarded|provided)/i,

  // ── Correct / updated / confirmed ────────────────────────────────
  // "correct ref is BKG123", "corrected load ref", "correct booking ref"
  /\bcorrect(?:ed)?\s+(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)/i,
  // "updated ref BKG456", "update the ref to BKG456", "updated load ref"
  /\bupdat(?:ed?|ing)\s+(?:the\s+)?(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)/i,
  // "load ref confirmed", "reference confirmed", "booking ref confirmed"
  /(?:load\s*ref|booking\s*ref|ref(?:erence)?)\s+confirmed/i,
  // "please use the following ref", "the correct ref is", "the correct reference"
  /\bthe\s+correct\s+(?:load\s*)?(?:ref(?:erence)?|booking\s*ref)/i,
  // "ref has been updated", "reference has been provided", "ref was sent"
  /(?:ref(?:erence)?|load\s*ref|booking\s*ref)\s+(?:has\s+been|was|have\s+been)\s+(?:updated|provided|sent|forwarded|attached|confirmed|shared)/i,

  // ── Explicit statement: "the load ref is..." without a code ──────
  // Catches "the load ref is as follows" / "the load ref is shown below"
  /\bthe\s+(?:load\s*)?ref(?:erence)?\s+is\b/i,
  // "load ref below", "booking ref below" (bare "below" after keyword)
  /(?:load\s*ref|booking\s*ref|ref(?:erence)?)\s+below\b/i,
];

// ─── Strict Missing Load Reference Validation ────────────────────
//
// A case may classify as load_ref (Missing Load Reference) ONLY when:
//  1. An explicit missing-load-ref phrase is found in description or ISR, OR
//  2. A load-ref keyword appears within proximity of a strict missing indicator
//     AND no planning/operational context dominates the body fields.
//
// Description and ISR Details are authoritative (weight 1.0). Subject is
// lower-trust (weight 0.5) and is checked only after body fields pass.
//
// "Please advise", "could you please", "kindly advise" and similar generic
// planning phrases are intentionally EXCLUDED from the strict missing check —
// they appear in feasibility/capacity/scheduling emails and must NOT trigger
// Missing Load Reference.
// ─────────────────────────────────────────────────────────────────

/**
 * Exact phrases that unambiguously indicate a load reference is absent/requested.
 * Any match in description or ISR → accept immediately as load_ref (missing).
 */
export const LOAD_REF_EXPLICIT_MISSING: string[] = [
  'missing load ref',
  'missing load reference',
  'no load ref',
  'no load reference',
  'load ref missing',
  'load reference missing',
  'please provide load ref',
  'please provide load reference',
  'please add load ref',
  'please add load reference',
  'please add the load ref',
  'please add the load reference',
  'load reference not provided',
  'load ref not provided',
  'load ref required',
  'load reference required',
  'load ref needed',
  'load reference needed',
  'load ref absent',
  'load ref not received',
  'load reference not received',
  'load ref not visible',
  'load ref not in system',
  'booking ref missing',
  'booking reference missing',
  'booking ref not provided',
  'booking reference not provided',
  'booking ref required',
  'booking reference required',
  'missing booking ref',
  'missing booking reference',
  'please provide booking ref',
  'please provide booking reference',
  'please add booking ref',
  'please add booking reference',
];

/**
 * Operational/planning context phrases.
 * If any of these appear in description or ISR AND no explicit missing-ref phrase
 * was found first, the case must NOT classify as load_ref (missing).
 * These represent feasibility, capacity, scheduling or booking-planning inquiries.
 */
export const LOAD_REF_PLANNING_BLOCKLIST: string[] = [
  // ── Planning / feasibility ─────────────────────────────────────
  'feasibility',
  'intermodal feasibility',
  'loading feasibility',
  'booking feasibility',
  'capacity request',
  'capacity',        // general capacity-availability queries
  'rail cut',        // covers "rail cut off", "rail cutoff", "rail cut-off"
  'barge schedule',
  'preferred load date',
  'preferred loaddate',
  'advise load date',
  'advise loaddate',
  'advise intermodal',
  'advise rail',
  'loading window',
  'operational planning',
  // ── Billing / cost contexts ────────────────────────────────────
  'demurrage',
  'detention',           // detention charges
  'extra cost',          // "extra costs report"
  'extra costs',
  'additional charge',   // "additional charges"
  'surcharge',
  'cost report',
  'rate discussion',     // rate-discussion emails
  'rate query',
  'rate inquiry',
  // ── Routing / transport planning ───────────────────────────────
  'routing',             // routing check / route planning
];

// ─── Body intent detection ────────────────────────────────────────
//
// A lightweight pre-classifier that identifies the dominant intent of the
// description + ISR fields BEFORE the proximity check runs.
//
// Purpose: prevent Missing Load Reference from being assigned when the case
// body is clearly about billing (demurrage, rates, invoices), operational
// planning (feasibility, capacity), or routing — even if a loose "load ref"
// keyword appears somewhere in the text.
//
// Only called when at least one of description or ISR is substantive (> 30 chars).
// Subject is intentionally NOT checked here — subject overrides are handled
// at lower priority (steps 4-6 in validateLoadRefMissing).
// ─────────────────────────────────────────────────────────────────

export type BodyIntent = 'billing' | 'planning' | 'routing' | 'documentation' | 'unknown';

export interface BodyIntentResult {
  intent: BodyIntent;
  trigger: string | null;
}

/** Billing-context signals — demurrage, charges, costs, rate discussions. */
const BILLING_INTENT_SIGNALS: string[] = [
  'demurrage', 'detention', 'extra cost', 'extra costs', 'additional charge',
  'surcharge', 'cost report', 'rate discussion', 'rate query', 'rate inquiry',
  'invoice', 'waiting costs', 'charges report',
  // 'rate' alone is included because freight-rate discussion emails almost always
  // mention 'rate' in the body, and the explicit-missing check (step 1) still
  // catches genuine "please provide load ref" phrases before this check runs.
  'rate',
];

/** Planning/feasibility signals — mirrors a subset of LOAD_REF_PLANNING_BLOCKLIST. */
const PLANNING_INTENT_SIGNALS: string[] = [
  'feasibility', 'capacity request', 'rail cut', 'barge schedule',
  'preferred load date', 'advise load date', 'loading window', 'operational planning',
];

/** Routing / re-routing signals. */
const ROUTING_INTENT_SIGNALS: string[] = [
  'routing', 'route planning', 'route change', 'routing check',
];

/**
 * Detects the dominant intent class of the case body (description + ISR).
 *
 * Returns 'billing' for demurrage/rate/cost contexts,
 *         'planning' for feasibility/capacity/scheduling contexts,
 *         'routing' for routing/re-routing contexts,
 *         'unknown' when no dominant signal is found.
 *
 * Used by validateLoadRefMissing (step 2a) to block Missing Load Reference
 * when the description context clearly belongs to a different operational class.
 *
 * @example
 * detectBodyIntent('Demurrage charges are pending.', '')
 * // → { intent: 'billing', trigger: 'demurrage' }
 *
 * detectBodyIntent('Please advise on loading feasibility.', '')
 * // → { intent: 'planning', trigger: 'feasibility' }
 */
export function detectBodyIntent(description: string, isr: string): BodyIntentResult {
  const lower = (description + ' ' + isr).toLowerCase();
  for (const s of BILLING_INTENT_SIGNALS) {
    if (lower.includes(s)) return { intent: 'billing', trigger: s };
  }
  for (const s of PLANNING_INTENT_SIGNALS) {
    if (lower.includes(s)) return { intent: 'planning', trigger: s };
  }
  for (const s of ROUTING_INTENT_SIGNALS) {
    if (lower.includes(s)) return { intent: 'routing', trigger: s };
  }
  return { intent: 'unknown', trigger: null };
}

// ─── Proximity check helpers ─────────────────────────────────────

/** Load-reference object keywords for proximity detection. */
const LOAD_REF_OBJECT_KEYWORDS: string[] = [
  'load ref', 'loadref', 'load reference', 'booking ref', 'booking reference',
];

/**
 * Strict missing indicators used for proximity check.
 * Intentionally narrower than the general MISSING_SIGNALS list —
 * excludes "please advise", "could you please", "kindly advise" etc.
 * which are too generic and appear in planning/feasibility emails.
 */
const LOAD_REF_NEARBY_MISSING: string[] = [
  'missing',
  'not provided',
  'not received',
  'not yet received',
  'please provide',
  'please add',
  'please send the ref',
  'please share the ref',
  'required',
  'needed',
  'absent',
  'not visible',
  'not found',
  'not in system',
  'we need',
  'we require',
  'have not received',
  "haven't received",
  'did not receive',
  'not been provided',
  'not been sent',
  'not been added',
  'still waiting for the ref',
  'still waiting for load',
  'still missing',
];

/** Characters around each load-ref keyword scanned for strict missing indicators. */
const LOAD_REF_PROXIMITY_WINDOW = 100;

function findProximityMissingSignal(
  text: string,
): { found: boolean; triggerPhrase: string | null } {
  const lower = text.toLowerCase();
  for (const keyword of LOAD_REF_OBJECT_KEYWORDS) {
    let searchFrom = 0;
    let pos: number;
    while ((pos = lower.indexOf(keyword, searchFrom)) !== -1) {
      const wStart = Math.max(0, pos - LOAD_REF_PROXIMITY_WINDOW);
      const wEnd   = Math.min(lower.length, pos + keyword.length + LOAD_REF_PROXIMITY_WINDOW);
      const window = lower.slice(wStart, wEnd);
      for (const indicator of LOAD_REF_NEARBY_MISSING) {
        if (window.includes(indicator)) {
          return { found: true, triggerPhrase: `"${keyword}" + "${indicator}"` };
        }
      }
      searchFrom = pos + 1;
    }
  }
  return { found: false, triggerPhrase: null };
}

// ─── Validation result type ──────────────────────────────────────

export interface LoadRefMissingValidation {
  /** true  → accept as load_ref (missing); false → reject */
  valid: boolean;
  /** Exact phrase / pattern that confirmed the classification (for audit trail). */
  triggerPhrase: string | null;
  /** Source field containing the trigger ('description' | 'isr_details' | 'subject' | 'description/isr'). */
  sourceField: string | null;
  /** Why it was rejected — stored in evidence for audit. Null when valid. */
  rejectReason: string | null;
}

/**
 * Strict gate for Missing Load Reference classification.
 *
 * Returns valid=true ONLY when there is explicit evidence that a load reference
 * is absent or being requested. Generic planning language ("please advise",
 * "could you please", "kindly advise") does NOT qualify.
 *
 * Checking priority:
 *  1. Explicit missing phrase in description or ISR (highest trust) → accept
 *  2. Planning/operational context in description or ISR → reject
 *  3. Proximity: load-ref keyword + strict missing indicator in description/ISR → accept
 *  4. Explicit missing phrase in subject (lower trust) → accept
 *  5. Planning context in subject → reject
 *  6. Proximity check in subject → accept
 *  7. No signal found → reject
 *
 * @param subject     Subject field text (normalized)
 * @param description Description / email body field text (normalized)
 * @param isr         ISR Details field text (normalized)
 */
export function validateLoadRefMissing(
  subject: string,
  description: string,
  isr: string,
): LoadRefMissingValidation {
  const descLower    = description.toLowerCase();
  const isrLower     = isr.toLowerCase();
  const subjectLower = subject.toLowerCase();

  // ── 1. Explicit phrase in description or ISR ─────────────────────
  for (const phrase of LOAD_REF_EXPLICIT_MISSING) {
    if (descLower.includes(phrase)) {
      return { valid: true, triggerPhrase: phrase, sourceField: 'description', rejectReason: null };
    }
    if (isrLower.includes(phrase)) {
      return { valid: true, triggerPhrase: phrase, sourceField: 'isr_details', rejectReason: null };
    }
  }

  // ── 2a. Body intent detection ─────────────────────────────────────
  // When description or ISR is substantive (> 30 chars), detect the dominant
  // intent class. If the body is about billing, planning, or routing, reject
  // Missing Load Reference — the explicit missing check (step 1) already
  // accepted genuine cases before we reach this point.
  //
  // This is the "Description overrides Subject" rule: even if the subject
  // says "Load Reference Required", a description about demurrage or rate
  // discussion overrides the subject-based trigger.
  const bodySubstantive = description.trim().length > 30 || isr.trim().length > 30;
  if (bodySubstantive) {
    const bodyIntent = detectBodyIntent(description, isr);
    if (
      bodyIntent.intent === 'billing' ||
      bodyIntent.intent === 'planning' ||
      bodyIntent.intent === 'routing'
    ) {
      return {
        valid: false,
        triggerPhrase: null,
        sourceField: null,
        rejectReason: `Body intent is ${bodyIntent.intent} ("${bodyIntent.trigger}") — description context overrides subject-based load-ref trigger`,
      };
    }
  }

  // ── 2. Planning/operational context in description or ISR ─────────
  const bodyPlanningTrigger =
    LOAD_REF_PLANNING_BLOCKLIST.find(p => descLower.includes(p)) ??
    LOAD_REF_PLANNING_BLOCKLIST.find(p => isrLower.includes(p)) ??
    null;
  if (bodyPlanningTrigger) {
    return {
      valid: false,
      triggerPhrase: null,
      sourceField: null,
      rejectReason: `Planning/operational context in body ("${bodyPlanningTrigger}") — not a missing load ref case`,
    };
  }

  // ── 3. Proximity check in description + ISR ───────────────────────
  const bodyProximity = findProximityMissingSignal(`${description} ${isr}`);
  if (bodyProximity.found) {
    return {
      valid: true,
      triggerPhrase: bodyProximity.triggerPhrase,
      sourceField: 'description/isr',
      rejectReason: null,
    };
  }

  // ── 4. Explicit phrase in subject (lower trust) ───────────────────
  for (const phrase of LOAD_REF_EXPLICIT_MISSING) {
    if (subjectLower.includes(phrase)) {
      return { valid: true, triggerPhrase: phrase, sourceField: 'subject', rejectReason: null };
    }
  }

  // ── 5. Planning/operational context in subject ────────────────────
  const subjectPlanningTrigger = LOAD_REF_PLANNING_BLOCKLIST.find(p => subjectLower.includes(p));
  if (subjectPlanningTrigger) {
    return {
      valid: false,
      triggerPhrase: null,
      sourceField: null,
      rejectReason: `Planning/operational context in subject ("${subjectPlanningTrigger}") — not a missing load ref case`,
    };
  }

  // ── 6. Proximity check in subject ─────────────────────────────────
  const subjectProximity = findProximityMissingSignal(subject);
  if (subjectProximity.found) {
    return {
      valid: true,
      triggerPhrase: subjectProximity.triggerPhrase,
      sourceField: 'subject',
      rejectReason: null,
    };
  }

  // ── 7. No explicit missing signal found ───────────────────────────
  return {
    valid: false,
    triggerPhrase: null,
    sourceField: null,
    rejectReason: 'No explicit load-reference missing phrase or proximity signal found — generic reference mention only',
  };
}

// ─── Provided-reference detection ─────────────────────────────────

/**
 * Returns true if the given text contains an explicit provided-reference signal.
 * A minimum text length check (>10 chars) prevents matching trivially short strings.
 *
 * Used to determine whether a case classified as "load_ref missing" is actually
 * a provided-reference case where the body overrides the subject shorthand.
 *
 * @example
 * textProvidesRef("Please see below load ref BKG12345") // → true
 * textProvidesRef("Please provide load ref")            // → false
 * textProvidesRef("correct ref is BKG123")              // → true
 * textProvidesRef("updated ref BKG456")                 // → true
 */
export function textProvidesRef(text: string): boolean {
  if (text.trim().length <= 10) return false;
  return PROVIDED_REF_PATTERNS.some(p => p.test(text));
}
