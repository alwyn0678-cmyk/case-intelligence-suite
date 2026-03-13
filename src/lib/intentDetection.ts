// ─────────────────────────────────────────────────────────────────
// Intent Detection — Two-Stage Classification Layer
//
// STAGE 1 maps each case to a primary INTENT before final category
// assignment (STAGE 2). Once an intent is detected at strong-signal
// confidence, all categories from lower-priority intents are suppressed.
//
// Priority order (1 = highest):
//   1. financial     — invoices, billing, demurrage, costs, selfbilling
//   2. equipment     — container/equipment defects, portable not ok
//   3. planning      — scheduling, feasibility, transport orders, cutoffs
//   4. documentation — customs, T1, Portbase, B/L (requests, not provisions)
//   5. operational   — delay, amendment
//   6. tracking      — visibility, status, ETA
//   7. communication — escalation, complaints
//   8. reference     — missing / provided load reference
//   9. unknown       — fallback, no suppression applied
//
// This prevents:
//   - financial emails (selfbilling, extra costs) classifying as Delay
//   - extra-cost invoices classifying as Customs / Documentation
//   - equipment issues (portable not ok) classifying as Reference Update
//   - ref_provided acting as a catch-all for informational language
// ─────────────────────────────────────────────────────────────────

import type { IssueMatch } from './issueRules';

export type IntentType =
  | 'financial'
  | 'equipment'
  | 'planning'
  | 'documentation'
  | 'operational'
  | 'tracking'
  | 'communication'
  | 'reference'
  | 'unknown';

// Lower number = higher priority.
// A strong-confidence match in intent N suppresses all matches from intent > N.
export const INTENT_PRIORITY: Record<IntentType, number> = {
  financial:     1,
  equipment:     2,
  planning:      3,
  documentation: 4,
  operational:   5,
  tracking:      6,
  communication: 7,
  reference:     8,
  unknown:       9,
};

// Maps each topic id → its intent group.
export const TOPIC_INTENT: Record<string, IntentType> = {
  // Financial
  rate:              'financial',
  waiting_time:      'financial',
  damage:            'financial',
  // Equipment
  equipment:         'equipment',
  equipment_release: 'equipment',
  // Planning
  scheduling:        'planning',
  pickup_delivery:   'planning',
  capacity:          'planning',
  closing_time:      'planning',
  transport_order:   'planning',
  // Documentation
  customs:           'documentation',
  t1:                'documentation',
  portbase:          'documentation',
  bl:                'documentation',
  // Operational
  delay:             'operational',
  amendment:         'operational',
  // Tracking
  tracking:          'tracking',
  // Communication
  communication:     'communication',
  // Reference
  load_ref:          'reference',
  ref_provided:      'reference',
  // Fallback
  other:             'unknown',
};

// ─── Priority filter ──────────────────────────────────────────────

/**
 * Confidence threshold above which a match is considered "strong" and
 * triggers intent-priority suppression of lower-priority categories.
 *
 * 0.75 = strong-signal confidence (0.85) after a 0.88 field-weight
 * reduction. Weak-signal matches (0.55 × 0.88 = 0.48) never trigger
 * suppression — they are insufficient to dominate by themselves.
 */
const STRONG_INTENT_THRESHOLD = 0.75;

/**
 * Filters a ranked list of IssueMatch results by intent priority.
 *
 * Algorithm:
 *   1. Find the highest-priority intent that has at least one match
 *      at or above STRONG_INTENT_THRESHOLD ("winning intent").
 *   2. Suppress (remove) all matches whose intent priority is strictly
 *      lower (higher number) than the winning intent's priority.
 *   3. If no match exceeds the threshold, return the list unchanged.
 *
 * @example
 * // selfbilling email — rate fires at 0.85, delay fires at 0.60
 * filterByIntentPriority([
 *   { issueId: 'rate',  confidence: 0.85 },   // financial priority 1
 *   { issueId: 'delay', confidence: 0.60 },   // operational priority 5
 * ])
 * // → [{ issueId: 'rate', confidence: 0.85 }]  (delay suppressed)
 *
 * // Ambiguous email — rate fires at 0.55 (weak), delay fires at 0.60 (weak)
 * filterByIntentPriority([
 *   { issueId: 'delay', confidence: 0.60 },
 *   { issueId: 'rate',  confidence: 0.55 },
 * ])
 * // → both returned unchanged (neither exceeds STRONG_INTENT_THRESHOLD)
 */
export function filterByIntentPriority(matches: IssueMatch[]): IssueMatch[] {
  if (matches.length <= 1) return matches;

  // Find winning intent: highest-priority intent with a strong match
  let winningPriority = Infinity;

  for (const m of matches) {
    if (m.confidence < STRONG_INTENT_THRESHOLD) continue;
    const intent = TOPIC_INTENT[m.issueId] ?? 'unknown';
    const priority = INTENT_PRIORITY[intent];
    if (priority < winningPriority) {
      winningPriority = priority;
    }
  }

  // No strong match found — no suppression
  if (!isFinite(winningPriority)) return matches;

  // Keep only matches at or above the winning intent priority.
  // Exception: load_ref and ref_provided are never suppressed here — they
  // are handled by the dedicated load-ref gate and ref disambiguation in
  // classifyCase.ts, which have precise per-case logic.
  const filtered = matches.filter(m => {
    if (m.issueId === 'load_ref' || m.issueId === 'ref_provided') return true;
    const intent = TOPIC_INTENT[m.issueId] ?? 'unknown';
    return INTENT_PRIORITY[intent] <= winningPriority;
  });

  // Safety: always return at least one match
  return filtered.length > 0 ? filtered : [matches[0]];
}

// ─── Financial context guard ──────────────────────────────────────

/**
 * Returns true if the text contains strong financial signals that should
 * prevent a non-financial category from being assigned.
 *
 * Used in the fallback pass to stop financial emails from falling through
 * to delay/customs/etc. when the primary classifier doesn't produce a
 * confident financial match.
 */
export const FINANCIAL_GUARD_KEYWORDS: string[] = [
  'selfbilling', 'self billing', 'self-billing', 'selfbill', 'self bill',
  'dch invoice', 'dch billing', 'dch report',
  'extra cost invoice', 'extra costs invoice',
  // Extra costs report — must always be financial, never customs/reference
  'extra costs report', 'extra cost report',
  'extrakostenrechnung', 'extra kosten rapport', 'extra kosten report',
  'meerkosten rapport', 'meerkosten report',
  'billing report', 'billing dispute', 'billing issue', 'billing error',
  'cost invoice', 'waiting cost invoice', 'waiting costs invoice',
  'demurrage invoice', 'detention invoice', 'storage invoice',
  'credit note', 'credit memo', 'debit note', 'debit memo',
  'invoice query', 'invoice dispute', 'invoice incorrect', 'invoice error',
  'overcharged', 'overcharge', 'billing query', 'charge dispute',
];

export function hasStrongFinancialContext(text: string): boolean {
  const lower = text.toLowerCase();
  return FINANCIAL_GUARD_KEYWORDS.some(kw => lower.includes(kw));
}

// Financial intent topics — used to skip non-financial fallbacks
export const FINANCIAL_INTENT_TOPICS = new Set(['rate', 'waiting_time', 'damage']);

// ─── Detected object labels ────────────────────────────────────────
// Maps each issueId → a human-readable description of the operational
// object the classifier detected. Shown in the diagnostic export so
// reviewers understand *what* the classifier found, not just which
// category it assigned.
export const DETECTED_OBJECT_MAP: Record<string, string> = {
  load_ref:          'Load / Booking Reference',
  ref_provided:      'Load / Booking Reference',
  transport_order:   'Transport Order / TRO',
  customs:           'Customs / Compliance Document',
  portbase:          'Portbase / Port Notification',
  bl:                'Bill of Lading (B/L)',
  t1:                'T1 / Transit Document',
  delay:             'Shipment / Delivery',
  closing_time:      'Terminal / Vessel Cutoff',
  amendment:         'Booking / Order Details',
  waiting_time:      'Waiting Time / Demurrage Charge',
  rate:              'Invoice / Rate / Charge',
  damage:            'Cargo / Goods',
  equipment:         'Container / Equipment',
  tracking:          'Shipment Status / Visibility',
  communication:     'Service / Escalation',
  equipment_release: 'Release Pin / Delivery Order',
  scheduling:        'Slot / Appointment',
  pickup_delivery:   'Pickup / Delivery Planning',
  capacity:          'Capacity / Availability',
  other:             'Unclassified',
};

// ─── Trigger phrase extraction ────────────────────────────────────

export interface TriggerInfo {
  /** Which field produced the classification-winning phrase. */
  sourceField: string;
  /** The exact phrase or signal that triggered the classification. */
  triggerPhrase: string;
}

const CONTENT_FIELDS = new Set(['description', 'subject', 'isr_details', 'category']);
const FIELD_PREFIX_RE = /^\[([a-z_]+)\]\s+(.*)/s;
const SIGNAL_PHRASE_RE = /(?:strong|weak)\s+signal:\s+"([^"]+)"/i;

/**
 * Parses the evidence array produced by classifyCase and extracts the
 * most informative trigger phrase and its source field.
 *
 * Priority:
 *   1. First content-field evidence entry with a quoted signal phrase
 *   2. First content-field evidence entry (phrase = first 80 chars of rest)
 *   3. load_ref-gate ACCEPTED entry (uses trigger= attribute)
 *   4. Fallback: empty strings
 */
export function extractTriggerInfo(evidence: string[]): TriggerInfo {
  for (const e of evidence) {
    const fieldMatch = e.match(FIELD_PREFIX_RE);
    if (!fieldMatch) continue;
    const field = fieldMatch[1];
    if (!CONTENT_FIELDS.has(field)) continue;

    const rest = fieldMatch[2] ?? '';
    const phraseMatch = rest.match(SIGNAL_PHRASE_RE);
    return {
      sourceField:   field,
      triggerPhrase: phraseMatch ? phraseMatch[1] : rest.replace(/\s+/g, ' ').trim().slice(0, 80),
    };
  }

  // load_ref gate accepted — trigger phrase stored as attribute
  const gateEntry = evidence.find(e => e.includes('[load_ref-gate] ACCEPTED:'));
  if (gateEntry) {
    const triggerMatch = gateEntry.match(/trigger="([^"]+)"/);
    const sourceMatch  = gateEntry.match(/source=(\w+)/);
    return {
      sourceField:   sourceMatch?.[1]  ?? 'unknown',
      triggerPhrase: triggerMatch?.[1] ?? 'load ref gate',
    };
  }

  return { sourceField: '', triggerPhrase: '' };
}
