// ─────────────────────────────────────────────────────────────────
// Load-Reference Guard Patterns
//
// Shared, testable patterns for detecting when a reference value
// has been PROVIDED (as opposed to requested/missing).
//
// Used by:
//   - classifyCase.ts  — description-override and contradiction guard
//   - analyzeData.ts   — DEV-mode false-positive scan
// ─────────────────────────────────────────────────────────────────

/**
 * Patterns that indicate a load/booking reference value has been
 * explicitly provided in the text — not requested or missing.
 *
 * Match any one of these → issueState should be 'provided', not 'missing'.
 *
 * Examples matched:
 *   "ref is BKG12345"
 *   "load ref: BKG12345"
 *   "see below ... ref"
 *   "attached herewith ... reference"
 *   "reference no BKG1234"
 *   "ref no. 1234ABC"
 */
export const PROVIDED_REF_PATTERNS: RegExp[] = [
  // "ref is BKG12345", "load ref: BKG12345", "reference: BKG12345"
  /(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|ref(?:erence)?)\s*(?:is|:)\s*[A-Z0-9]{4,}/i,
  // "see below ... ref", "find below ... load"
  /(?:see|find)\s+below.{0,60}(?:ref(?:erence)?|load|booking)/i,
  // "ref ... see below"
  /(?:ref(?:erence)?|load|booking).{0,40}(?:see|find)\s+below/i,
  // "attached / herewith ... ref"
  /(?:attached|herewith|find\s+enclosed).{0,60}(?:ref(?:erence)?|load|booking|reference)/i,
  // "reference no BKG1234", "ref # BKG1234"
  /(?:reference|load\s*ref|booking\s*ref)\s*(?:no\.?\s*|#\s*|:\s*)[A-Z0-9]{4,}/i,
  // "ref no. ABC123", "reference no 12345"
  /\bref(?:erence)?\s+no\.?\s*[A-Z0-9]{4,}/i,
];

/**
 * Returns true if the given text contains an explicit provided-reference signal.
 * A minimum text length check (>10 chars) prevents matching trivially short strings.
 */
export function textProvidesRef(text: string): boolean {
  if (text.trim().length <= 10) return false;
  return PROVIDED_REF_PATTERNS.some(p => p.test(text));
}
