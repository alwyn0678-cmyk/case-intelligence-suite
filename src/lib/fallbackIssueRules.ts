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
import { hasStrongFinancialContext, FINANCIAL_INTENT_TOPICS } from './intentDetection';

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
    pattern: /\b(selfbilling|self.billing|selfbill|self.bill)\b/i,
    evidence: 'selfbilling pattern', confidence: 0.85 },
  { issueId: 'rate', state: 'missing',
    pattern: /\bdch\s*(invoice|billing|report|cost)\b/i,
    evidence: 'DCH invoice/billing pattern', confidence: 0.85 },
  { issueId: 'rate', state: 'missing',
    pattern: /\bextra\s*costs?\s*invoice\b/i,
    evidence: 'extra cost invoice pattern', confidence: 0.85 },
  { issueId: 'rate', state: 'missing',
    pattern: /\b(demurrage|detention|storage)\s*invoice\b/i,
    evidence: 'demurrage/detention invoice pattern', confidence: 0.80 },
  { issueId: 'rate', state: 'missing',
    pattern: /\b(credit|debit)\s*(note|memo)\b/i,
    evidence: 'credit/debit note pattern', confidence: 0.80 },
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
    evidence: 'delivery planning pattern', confidence: 0.63 },

  // ── Scheduling / allocation ───────────────────────────────────────
  { issueId: 'scheduling', state: 'missing',
    pattern: /\b(slot|time.slot|appointment).{0,25}(needed|required|missing|not confirmed|not allocated)\b/i,
    evidence: 'slot/appointment needed pattern', confidence: 0.63 },

  // ── Booking / scheduling query (broad catch) ──────────────────
  { issueId: 'scheduling', state: 'informational',
    pattern: /\b(booking|reserve|book).{0,30}(confirm|confirmation|request|query|question|inquiry)\b/i,
    evidence: 'booking query pattern', confidence: 0.63 },
  { issueId: 'scheduling', state: 'informational',
    pattern: /\b(can\s+(?:we|you|i)|please).{0,30}(book|reserve|schedule|arrange|organise)\b/i,
    evidence: 'scheduling request pattern', confidence: 0.63 },

  // ── Status / informational queries ────────────────────────────
  { issueId: 'tracking', state: 'informational',
    pattern: /\b(status|update|progress|eta|expected).{0,30}(of|on|for).{0,30}(shipment|delivery|container|cargo|order)\b/i,
    evidence: 'status inquiry pattern', confidence: 0.63 },
  { issueId: 'tracking', state: 'informational',
    pattern: /\b(please|kindly)\s+(advise|confirm|update|inform).{0,40}(status|whereabouts|location|eta)\b/i,
    evidence: 'please advise status pattern', confidence: 0.63 },

  // ── Documentation / reference provision ─────────────────────
  { issueId: 'ref_provided', state: 'provided',
    pattern: /\b(reference|ref|booking)\s*(?:number|no)?\s*(?:is|:|=)\s*[A-Z0-9]{4,}/i,
    evidence: 'reference value given pattern', confidence: 0.65 },
  { issueId: 'ref_provided', state: 'provided',
    pattern: /\b(please find|see|as per|with reference to).{0,20}(booking|ref|order|po)\b/i,
    evidence: 'reference cross-reference pattern', confidence: 0.63 },

  // ── General logistics / transport queries ────────────────────
  { issueId: 'pickup_delivery', state: 'informational',
    pattern: /\b(collect|collection|pick.?up|deliver|delivery).{0,50}(date|time|window|slot|appointment|planned|scheduled)\b/i,
    evidence: 'collection/delivery appointment pattern', confidence: 0.63 },
  { issueId: 'pickup_delivery', state: 'missing',
    pattern: /\b(collect|delivery|pickup).{0,30}(not|no|without).{0,20}(date|time|window|slot|appointment|instruction|address)\b/i,
    evidence: 'missing collection appointment pattern', confidence: 0.60 },

  // ── Cargo / shipment general ─────────────────────────────────
  { issueId: 'tracking', state: 'informational',
    pattern: /\b(goods|cargo|shipment|consignment|load)\b.{0,60}\b(arrived|received|cleared|released|available)\b/i,
    evidence: 'cargo arrived/available notification', confidence: 0.63 },

  // ── Missing information general ───────────────────────────────
  { issueId: 'amendment', state: 'missing',
    pattern: /\b(information|details?|data)\b.{0,30}\b(missing|required|needed|not provided|incomplete|outstanding)\b/i,
    evidence: 'missing information pattern', confidence: 0.63 },

  // ── VGM / weight ─────────────────────────────────────────────
  { issueId: 'vgm', state: 'missing',
    pattern: /\b(vgm|verified gross mass|gross weight)\b.{0,30}\b(missing|not|required|needed|not received)\b/i,
    evidence: 'VGM missing pattern', confidence: 0.65 },

  // ── Shipping advice ───────────────────────────────────────────
  { issueId: 'shipping_advice', state: 'missing',
    pattern: /\b(shipping advice|arrival notice|pre.?advice)\b.{0,30}\b(missing|not|required|needed)\b/i,
    evidence: 'shipping advice missing pattern', confidence: 0.65 },
  { issueId: 'shipping_advice', state: 'provided',
    pattern: /\b(shipping advice|arrival notice)\b.{0,30}\b(attached|sent|provided|below|herewith)\b/i,
    evidence: 'shipping advice provided pattern', confidence: 0.65 },
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

  // Financial guard: if the text has strong financial context but the best match
  // is a non-financial topic, override with a rate match to prevent financial
  // emails (selfbilling, extra costs) from falling through to delay/customs/etc.
  if (best && !FINANCIAL_INTENT_TOPICS.has(best.issueId) && hasStrongFinancialContext(text)) {
    return {
      issueId: 'rate',
      state: 'missing',
      confidence: 0.70,
      evidence: ['financial guard: strong financial context overrides non-financial fallback'],
    };
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
    { keyword: 'booking',        issueId: 'scheduling',       state: 'informational' },
    { keyword: 'reference',      issueId: 'ref_provided',     state: 'informational' },
    { keyword: 'pickup',         issueId: 'pickup_delivery',  state: 'unknown' },
    { keyword: 'collect',        issueId: 'pickup_delivery',  state: 'unknown' },
    { keyword: 'cargo',          issueId: 'tracking',         state: 'unknown' },
    { keyword: 'goods',          issueId: 'tracking',         state: 'unknown' },
    { keyword: 'vessel',         issueId: 'closing_time',     state: 'unknown' },
    { keyword: 'port',           issueId: 'customs',          state: 'unknown' },
    { keyword: 'weight',         issueId: 'vgm',              state: 'unknown' },
    { keyword: 'address',        issueId: 'amendment',        state: 'unknown' },
    { keyword: 'status',         issueId: 'tracking',         state: 'informational' },
    { keyword: 'missing',        issueId: 'amendment',        state: 'missing' },
    { keyword: 'update',         issueId: 'amendment',        state: 'amended' },
    { keyword: 'incorrect',      issueId: 'amendment',        state: 'amended' },
    { keyword: 'wrong',          issueId: 'amendment',        state: 'amended' },
    { keyword: 'question',       issueId: 'communication',    state: 'informational' },
    { keyword: 'query',          issueId: 'communication',    state: 'informational' },
    { keyword: 'confirm',        issueId: 'communication',    state: 'informational' },
  ];

  for (const clue of clues) {
    if (t.includes(clue.keyword)) {
      return {
        issueId: clue.issueId,
        state: clue.state,
        confidence: 0.62,
        evidence: [`operational clue: "${clue.keyword}"`],
      };
    }
  }

  return null;
}
