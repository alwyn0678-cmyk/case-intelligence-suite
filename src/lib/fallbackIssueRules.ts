// ─────────────────────────────────────────────────────────────────
// Fallback / Recovery Pass
//
// This runs ONLY when the primary classifier returns no confident
// matches. Its job is to squeeze the maximum classification signal
// from ambiguous text before assigning "Other / Unclassified".
//
// Strategy: broader regex patterns, contextual word combinations,
// and entity-type context (e.g. a depot mention in a delay context).
// ─────────────────────────────────────────────────────────────────

import type { IssueMatch, IssueState } from './issueRules';

interface FallbackRule {
  issueId: string;
  state: IssueState;
  pattern: RegExp;
  evidence: string;
  confidence: number;
}

const FALLBACK_RULES: FallbackRule[] = [
  // ── Delay / timing ──────────────────────────────────────────────
  { issueId: 'delay', state: 'delayed',
    pattern: /\b(not yet|still not|hasn.t arrived|haven.t received|expected .{1,20} but|we are still)\b/i,
    evidence: 'delay phrase pattern', confidence: 0.60 },
  { issueId: 'delay', state: 'delayed',
    pattern: /\b(driver|truck|vehicle|courier|haulier)\b.{0,30}\b(not|late|missing|absent|didn.t|did not)\b/i,
    evidence: 'driver/vehicle absence pattern', confidence: 0.65 },
  { issueId: 'delay', state: 'delayed',
    pattern: /\b(collection|pickup|pick.up|delivery).{0,30}(not happened|didn.t happen|failed|missed|overdue)\b/i,
    evidence: 'collection/delivery failure pattern', confidence: 0.65 },

  // ── Missing document / customs ───────────────────────────────────
  { issueId: 'customs', state: 'missing',
    pattern: /\b(no|missing|without|not received|not provided).{0,25}(doc|cert|form|paper|letter|permit|licence|license)\b/i,
    evidence: 'missing document pattern', confidence: 0.60 },
  { issueId: 'customs', state: 'missing',
    pattern: /\b(document|paperwork|certificate|permit).{0,25}(missing|not|required|needed|wrong|incorrect|outstanding)\b/i,
    evidence: 'document issue pattern', confidence: 0.60 },

  // ── Amendment / data correction ──────────────────────────────────
  { issueId: 'amendment', state: 'amended',
    pattern: /\b(wrong|incorrect|error|mistake|invalid).{0,25}(name|address|city|country|zip|postcode|weight|volume|quantity|number|code|date|port|routing)\b/i,
    evidence: 'incorrect field pattern', confidence: 0.65 },
  { issueId: 'amendment', state: 'amended',
    pattern: /\b(please|kindly|need to).{0,25}(update|correct|change|amend|modify|fix|revise)\b/i,
    evidence: 'update request pattern', confidence: 0.60 },

  // ── Load / booking reference ─────────────────────────────────────
  { issueId: 'load_ref', state: 'missing',
    pattern: /\b(no|without|missing|not provided|not received).{0,20}(reference|ref|booking number|order number|po number|load number|job number)\b/i,
    evidence: 'missing reference pattern', confidence: 0.65 },
  { issueId: 'ref_provided', state: 'provided',
    pattern: /\b(here is|find below|see below|as requested).{0,40}(reference|ref|booking number|order number|load number)\b/i,
    evidence: 'reference provided — see below pattern', confidence: 0.65 },
  // Explicit ref value follows keyword: "load ref: BKG1234", "ref no 12345", "reference is ABC"
  { issueId: 'ref_provided', state: 'provided',
    pattern: /\b(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|ref(?:erence)?)\s*(?:is|:|no\.?|#)\s*[A-Z0-9]{4,}/i,
    evidence: 'explicit reference value pattern', confidence: 0.70 },
  // Ref sent / forwarded / attached
  { issueId: 'ref_provided', state: 'provided',
    pattern: /\b(?:load\s*ref(?:erence)?|booking\s*ref(?:erence)?|reference)\b.{0,40}\b(?:attached|sent|forwarded|provided|below|herewith)\b/i,
    evidence: 'reference attached/sent pattern', confidence: 0.65 },

  // ── T1 / transit ─────────────────────────────────────────────────
  { issueId: 't1', state: 'missing',
    pattern: /\bt[12]\b.{0,30}(missing|not received|not provided|not issued|outstanding|required)\b/i,
    evidence: 'T1 missing pattern', confidence: 0.65 },
  { issueId: 't1', state: 'delayed',
    pattern: /\btransit.{0,20}(not closed|still open|not discharged|outstanding)\b/i,
    evidence: 'transit not closed pattern', confidence: 0.65 },

  // ── Equipment release / pin code ─────────────────────────────────
  { issueId: 'equipment_release', state: 'missing',
    pattern: /\b(pin|release|acceptance).{0,25}(missing|not received|not working|expired|invalid|not issued)\b/i,
    evidence: 'release pin missing pattern', confidence: 0.65 },
  { issueId: 'equipment_release', state: 'provided',
    pattern: /\b(pin|release code|release order).{0,30}(find below|see below|here is|attached|sent)\b/i,
    evidence: 'release pin provided pattern', confidence: 0.65 },

  // ── Rate / billing ────────────────────────────────────────────────
  { issueId: 'rate', state: 'missing',
    pattern: /\b(invoice|billing|charge|cost|fee|price).{0,25}(query|wrong|issue|error|dispute|question|clarif)\b/i,
    evidence: 'invoice/rate query pattern', confidence: 0.60 },
  { issueId: 'rate', state: 'missing',
    pattern: /\b(charged|billed).{0,25}(too much|incorrectly|wrong amount|double)\b/i,
    evidence: 'overcharge pattern', confidence: 0.65 },

  // ── Tracking / visibility ─────────────────────────────────────────
  { issueId: 'tracking', state: 'missing',
    pattern: /\b(where|when).{0,35}(shipment|cargo|parcel|goods|container|delivery|truck|driver)\b/i,
    evidence: 'location query pattern', confidence: 0.60 },
  { issueId: 'tracking', state: 'missing',
    pattern: /\b(no|without).{0,20}(tracking|trace|update|visibility|information|status|news)\b/i,
    evidence: 'no tracking pattern', confidence: 0.60 },

  // ── Communication / escalation ────────────────────────────────────
  { issueId: 'communication', state: 'escalated',
    pattern: /\b(no.one|nobody|no response|no reply|no answer|not respond|not reply|ignored|being ignored)\b/i,
    evidence: 'no response pattern', confidence: 0.65 },
  { issueId: 'communication', state: 'escalated',
    pattern: /\b(complaint|dissatisfied|unhappy|frustrated|escalat|unacceptable)\b/i,
    evidence: 'complaint / escalation pattern', confidence: 0.60 },

  // ── Damage / loss ─────────────────────────────────────────────────
  { issueId: 'damage', state: 'missing',
    pattern: /\b(goods|cargo|parcel|items?|products?|packages?).{0,35}(broken|damaged|missing|lost|stolen|wet|short|shortage)\b/i,
    evidence: 'damage / loss pattern', confidence: 0.65 },

  // ── Equipment defect ─────────────────────────────────────────────
  { issueId: 'equipment', state: 'delayed',
    pattern: /\b(container|trailer|truck|vehicle|unit|reefer).{0,35}(broken|damaged|defective|unavailable|failure|fault|breakdown)\b/i,
    evidence: 'equipment defect pattern', confidence: 0.60 },

  // ── Waiting time / demurrage ──────────────────────────────────────
  { issueId: 'waiting_time', state: 'delayed',
    pattern: /\b(waiting|waited|standing|idle).{0,25}(hours?|days?|long time|since|for)\b/i,
    evidence: 'waiting time pattern', confidence: 0.60 },

  // ── Closing time / cutoff ─────────────────────────────────────────
  { issueId: 'closing_time', state: 'delayed',
    pattern: /\b(missed|after|past|beyond).{0,25}(cutoff|cut-off|deadline|closing|gate|vessel)\b/i,
    evidence: 'missed cutoff pattern', confidence: 0.65 },

  // ── Portbase / port notification ──────────────────────────────────
  { issueId: 'portbase', state: 'missing',
    pattern: /\b(pre.arriv|port notif|ata notif|pcs mess)\b/i,
    evidence: 'port notification pattern', confidence: 0.60 },

  // ── Pickup / delivery planning ────────────────────────────────────
  { issueId: 'pickup_delivery', state: 'informational',
    pattern: /\b(plan|confirm|arrange).{0,25}(pickup|pick.up|collection|delivery)\b/i,
    evidence: 'delivery planning pattern', confidence: 0.55 },

  // ── Scheduling / allocation ───────────────────────────────────────
  { issueId: 'scheduling', state: 'missing',
    pattern: /\b(slot|time.slot|appointment).{0,25}(needed|required|missing|not confirmed|not allocated)\b/i,
    evidence: 'slot/appointment needed pattern', confidence: 0.55 },
];

/**
 * Recovery pass: tries to classify text that the primary classifier
 * could not confidently classify.
 * Returns the best fallback match, or null if nothing applies.
 */
export function fallbackClassify(text: string): IssueMatch | null {
  let best: IssueMatch | null = null;

  for (const rule of FALLBACK_RULES) {
    if (rule.pattern.test(text)) {
      if (!best || rule.confidence > best.confidence) {
        best = {
          issueId: rule.issueId,
          state: rule.state,
          confidence: rule.confidence,
          evidence: [rule.evidence],
        };
      }
    }
  }

  return best;
}

/**
 * Operational clue scan: last resort before "Other / Unclassified".
 * Looks for any operationally meaningful single keywords.
 * Returns a low-confidence match or null.
 */
export function operationalClueScan(text: string): IssueMatch | null {
  const t = text.toLowerCase();

  const clues: Array<{ keyword: string; issueId: string; state: IssueState }> = [
    { keyword: 'shipment',       issueId: 'tracking',         state: 'unknown' },
    { keyword: 'container',      issueId: 'equipment',        state: 'unknown' },
    { keyword: 'transport',      issueId: 'delay',            state: 'unknown' },
    { keyword: 'transit',        issueId: 't1',               state: 'unknown' },
    { keyword: 'customs',        issueId: 'customs',          state: 'unknown' },
    { keyword: 'document',       issueId: 'customs',          state: 'unknown' },
    { keyword: 'certificate',    issueId: 'customs',          state: 'unknown' },
    { keyword: 'invoice',        issueId: 'rate',             state: 'unknown' },
    { keyword: 'driver',         issueId: 'delay',            state: 'unknown' },
    { keyword: 'delivery',       issueId: 'delay',            state: 'unknown' },
    { keyword: 'collection',     issueId: 'delay',            state: 'unknown' },
    // Note: 'booking' intentionally omitted — too broad, fires on booking amendments,
    // transport orders, and scheduling cases. Specific booking-ref patterns are
    // handled by the FALLBACK_RULES ref_provided/load_ref regex rules above.
    { keyword: 'amendment',      issueId: 'amendment',        state: 'amended' },
    { keyword: 'schedule',       issueId: 'scheduling',       state: 'unknown' },
    { keyword: 'slot',           issueId: 'scheduling',       state: 'unknown' },
    { keyword: 'release',        issueId: 'equipment_release',state: 'unknown' },
    { keyword: 'damage',         issueId: 'damage',           state: 'unknown' },
    { keyword: 'complaint',      issueId: 'communication',    state: 'escalated' },
  ];

  for (const clue of clues) {
    if (t.includes(clue.keyword)) {
      return {
        issueId: clue.issueId,
        state: clue.state,
        confidence: 0.35,
        evidence: [`operational clue: "${clue.keyword}"`],
      };
    }
  }

  return null;
}
