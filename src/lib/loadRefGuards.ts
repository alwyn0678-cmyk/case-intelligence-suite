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
