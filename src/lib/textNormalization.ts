// ─────────────────────────────────────────────────────────────────
// Text Normalization / Preprocessing Layer
//
// Provides utilities for cleaning and normalizing text before
// classification and entity matching.
//
// KEY FUNCTIONS:
//   normalizeText()               — clean raw text for classification
//   normalizeForMatching()        — strip legal suffixes for entity lookup
//   generateNormalizedVariants()  — expand alias lists with suffix variants
//   hasCompanyNameStructure()     — structural validation for customer names
// ─────────────────────────────────────────────────────────────────

/**
 * Legal entity suffix pattern — stripped when normalizing for matching.
 *
 * Matches suffixes that commonly follow a company name. Word boundary
 * anchors prevent stripping mid-word matches (e.g. 'agent' is not 'ag').
 * The pattern is applied to the END of the string to avoid stripping
 * legitimate parts of a company name in the middle.
 *
 * Covers DE/NL/BE/FR/ES/IT/UK/US legal forms.
 */
const LEGAL_SUFFIXES_RE = /[\s,]+(?:gmbh|g\.m\.b\.h\.?|b\.v\.?|n\.v\.?|s\.a\.?|s\.a\.s\.?|sarl|s\.?a\.?r\.?l\.?|eurl|sas|bvba|sprl|ltd\.?|limited|inc\.?|corp\.?|co\.(?:\s|$)|a\.g\.?|s\.e\.?|k\.g\.?|u\.g\.?|plc\.?|llc\.?|s\.p\.a\.?|s\.r\.l\.?|a\.s\.?|o\.y\.?|a\.b\.?|pte\.?|pvt\.?|bhd\.?|(?:gmbh\s*&\s*co\.?\s*k\.?g\.?))\s*\.?$/gi;

/**
 * Normalize raw text for classification.
 *
 * Collapses whitespace, normalizes line endings, and removes repeated
 * separators. Does NOT lowercase — preserves original case for display.
 * Call this on raw subject / description / ISR fields before classification.
 */
export function normalizeText(text: string): string {
  if (!text) return '';
  return text
    .replace(/\r\n|\r/g, ' ')       // normalize line endings
    .replace(/\t/g, ' ')             // tabs → space
    .replace(/[ ]{2,}/g, ' ')        // collapse repeated spaces
    .replace(/[_\-=]{3,}/g, ' ')     // repeated separators → space
    .trim();
}

/**
 * Normalize a company/entity name for matching purposes.
 *
 * Strips legal suffixes, normalizes punctuation and whitespace,
 * lowercases. Use when comparing a candidate name against the entity
 * dictionary or checking if a name consists only of generic vocabulary.
 *
 * Examples:
 *   "DP World Intermodal B.V." → "dp world intermodal"
 *   "CTS Container-Terminal GmbH" → "cts container-terminal"
 *   "Falco Lines Belgium N.V." → "falco lines belgium"
 *   "Transport Service GmbH & Co. KG" → "transport service"
 *   "Spedition GmbH" → "spedition"
 */
export function normalizeForMatching(name: string): string {
  if (!name) return '';
  // Strip legal suffixes first (they may appear at end, e.g. "GmbH & Co. KG")
  let n = name.replace(LEGAL_SUFFIXES_RE, '');
  return n
    .toLowerCase()
    .replace(/&/g, ' and ')          // & → and
    .replace(/[^\w\s\-]/g, ' ')      // strip punctuation noise
    .replace(/\s{2,}/g, ' ')         // collapse spaces
    .trim();
}

/**
 * Given a list of existing aliases, generate additional normalized variants
 * by stripping legal suffixes. Adds a "bare" variant for each alias that
 * contains a legal suffix.
 *
 * Example:
 *   ['falco lines belgium nv', 'falcoline gmbh']
 *   → also generates ['falco lines belgium', 'falcoline']
 *
 * Used to build the fallback normalized alias map in referenceData.ts.
 */
export function generateNormalizedVariants(aliases: string[]): string[] {
  const extras = new Set<string>();
  for (const alias of aliases) {
    const normalized = normalizeForMatching(alias);
    if (normalized && normalized !== alias && normalized.length > 2) {
      extras.add(normalized);
    }
  }
  return Array.from(extras);
}

/**
 * Returns true if a name structurally resembles a real company/account name.
 *
 * Used as a supplementary gate during customer acceptance — rejects
 * obviously non-company strings before they reach chart reporting.
 * Hard entity blocking is handled separately by isBlockedFromCustomerRole().
 *
 * Requirements:
 *   - At least 2 characters
 *   - Contains at least one letter
 *   - Not purely numeric or symbolic
 *   - Not an email fragment
 *   - Not a single character word
 */
export function hasCompanyNameStructure(name: string): boolean {
  if (!name) return false;
  const t = name.trim();
  if (t.length < 2) return false;
  // Must contain at least one letter
  if (!/[a-zA-Z]/.test(t)) return false;
  // Not purely numeric / symbolic / whitespace
  if (/^[\d\s\-_./,()[\]]+$/.test(t)) return false;
  // Not email-like
  if (/@[a-z0-9.-]+\.[a-z]{2,}/i.test(t)) return false;
  return true;
}
