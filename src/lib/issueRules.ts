// ─────────────────────────────────────────────────────────────────
// Intent-Aware Issue Classification Rules
//
// CORE PRINCIPLE: classify both issue TOPIC and issue STATE/INTENT.
//
// Example:
//   "please provide load ref"  → topic=load_ref,  state=missing
//   "please see below load ref"→ topic=ref_provided, state=provided
//   "load ref attached"        → topic=ref_provided, state=provided
//   "t1 not received"          → topic=t1,          state=missing
//   "t1 document sent"         → topic=t1,          state=provided
// ─────────────────────────────────────────────────────────────────

export type IssueState =
  | 'missing'       // item is absent / being requested
  | 'provided'      // item has been sent / confirmed
  | 'amended'       // a correction or update
  | 'delayed'       // time-based failure
  | 'escalated'     // escalation / complaint
  | 'informational' // status update / FYI
  | 'unknown';

export interface IssueMatch {
  issueId: string;    // taxonomy id
  state: IssueState;
  confidence: number; // 0–1
  evidence: string[]; // phrases that triggered this match
}

// ─── Classification confidence constants ─────────────────────────
// Named thresholds make the scoring model explicit and testable.
// All callers (classifyCase.ts, tests) should import these rather
// than hardcoding the same numbers independently.

/** Confidence assigned when a strongSignal fires (exact keyword match). */
export const STRONG_SIGNAL_CONFIDENCE = 0.85;

/** Confidence assigned when only weakSignals fire. */
export const WEAK_SIGNAL_CONFIDENCE = 0.55;

/** Added to confidence when issue intent/state can be determined. */
export const STATE_DETECTION_BONUS = 0.10;

/** Maximum confidence cap — keeps 1.0 reserved for "human verified". */
export const MAX_CONFIDENCE = 0.98;

/** Characters before the first matching keyword included in the per-topic context window. */
export const CONTEXT_WINDOW_BEFORE = 120;

/** Characters after the first matching keyword included in the per-topic context window. */
export const CONTEXT_WINDOW_AFTER = 160;

// ─── Intent phrase lists ──────────────────────────────────────────
// "MISSING" signals — the subject item is absent or being requested
const MISSING_SIGNALS = [
  'please provide', 'please send', 'please share', 'please forward',
  'please supply', 'kindly provide', 'kindly send',
  'please add', 'please include', 'kindly add',  // "please add load reference"
  'can you send', 'can you provide', 'can you share', 'can you advise',
  'please advise', 'please let us know', 'could you please', 'could you advise',
  'we need', 'we require', 'we are waiting', 'still waiting',
  'not received', 'not provided', 'not yet received', 'not yet sent',
  'not available', 'not found', 'not in', 'not attached',
  'missing', 'absent', 'no ', // "no load ref", "no document"
  'without ', 'lack of', 'lacking',
  'needed', 'required', 'request for', 'requesting',
  'haven\'t received', 'have not received', 'did not receive',
  'hasn\'t been', 'has not been',
  'urgent', 'asap', 'as soon as possible',
];

// "PROVIDED" signals — the item has been supplied / confirmed
const PROVIDED_SIGNALS = [
  'see below', 'find below', 'please find below',
  'find attached', 'please find attached', 'see attached',
  'as requested', 'as per your request', 'as per request',
  'herewith', 'hereby', 'please find herewith',
  'attached', 'enclosed', 'sending', 'sent', 'forwarded',
  'here is', 'here are', 'find enclosed',
  'providing', 'supplied', 'sharing',
  'please see', 'see below for', 'details below',
  'confirmed', 'confirmation', 'done', 'completed',
  // Specific "ref no X" patterns — "ref no" means "reference number" not negation
  'ref no ', 'ref no.', 'reference no ', 'reference no.',
  // Note: 'ref is ' and 'reference is ' removed — too broad, fire on
  // "load ref is missing", "the reference is required", etc. (missing-ref assertions).
  // Use 'ref: ', 'load ref: ', 'loadref: ' which require a colon (unambiguously provided).
  'ref: ', 'loadref: ', 'load ref: ',
  'ref #', 'reference #',
  // "has been provided" / "was provided" are unambiguous
  'has been provided', 'was provided', 'already provided',
  'has been sent', 'was sent', 'already sent',
  'resolved',
  // Completion/status signals — document/system has been updated or cleared.
  // Used to catch "Portbase updated", "portbase ok", "portbase cleared" etc.
  // Short-form but specific enough to be safe within a per-topic context window.
  'has been updated', 'was updated', 'is updated', 'now updated',
  'has been cleared', 'was cleared', 'is cleared', 'now cleared',
  'all ok', 'is ok', 'now ok',
  'is complete', 'has been completed', 'now complete',
  'is done', 'has been done',
];

// "AMENDED" signals — a correction or update is being made
const AMENDED_SIGNALS = [
  'please correct', 'please update', 'please amend', 'please change',
  'please revise', 'please modify',
  'correction', 'correction needed', 'needs to be corrected',
  'updated to', 'revised', 'amended', 'corrected', 'modified',
  'wrong', 'incorrect', 'error in', 'mistake in',
  'should be', 'instead of', 'replace with', 'change from',
  'update required', 'needs updating',
  // Booking cancellation — a cancellation is an amendment/correction event
  'cancelled', 'cancellation', 'cancel booking', 'cancelling',
];

// "DELAYED" signals — time-based failure
const DELAYED_SIGNALS = [
  'still waiting', 'still not', 'not yet', 'overdue',
  'late', 'delayed', 'behind schedule', 'passed eta',
  'expected yesterday', 'expected today', 'should have arrived',
  'should have been', 'was due', 'was expected',
  'not arrived', 'not collected', 'not delivered',
  'driver late', 'truck late', 'vehicle late',
  'running late', 'chasing', 'following up', 'follow up',
];

// "ESCALATED" signals
const ESCALATED_SIGNALS = [
  'escalate', 'escalating', 'escalation',
  'complaint', 'complaining', 'complain',
  'unhappy', 'dissatisfied', 'frustrated',
  'management', 'director', 'senior',
  'unacceptable', 'not acceptable', 'very urgent',
  'extremely urgent', 'highest priority',
];

// "INFORMATIONAL" signals — FYI / status update
const INFORMATIONAL_SIGNALS = [
  'for your information', 'fyi', 'for your records', 'for your reference',
  'please note', 'just to let you know', 'informing you',
  'confirming that', 'to confirm', 'update on', 'status update',
  'please be advised', 'advising', 'notifying',
  'no action required', 'no action needed', 'no further action',
];

// ─── Negation patterns ─────────────────────────────────────────────
// These phrases indicate something is ABSENT/MISSING even when
// a "provided" keyword also appears (e.g. "not provided", "not received").
// The negation guard prevents "not provided" from triggering PROVIDED state.
const NEGATION_GUARD_PHRASES = [
  'not provided', 'not received', 'not yet received', 'not yet sent',
  'not attached', 'not available', 'not found', 'not yet',
  'has not been', 'have not', 'hasn\'t been', 'did not receive',
  'cannot', 'not confirmed', 'not issued', 'not in system',
];

function detectState(text: string): { state: IssueState; evidence: string[] } {
  const t = text.toLowerCase();
  const evidence: string[] = [];

  // Check if negation phrases are present — if so, PROVIDED signals are suppressed
  // to prevent "not provided" → state='provided' false positives.
  const hasNegation = NEGATION_GUARD_PHRASES.some(p => t.includes(p));

  const checkSignals = (signals: string[]): boolean => {
    for (const sig of signals) {
      if (t.includes(sig)) {
        evidence.push(`"${sig}"`);
        return true;
      }
    }
    return false;
  };

  // Escalated: always highest priority regardless of negation
  if (checkSignals(ESCALATED_SIGNALS))   return { state: 'escalated', evidence };

  // Amended: checked before provided (corrections take precedence)
  if (checkSignals(AMENDED_SIGNALS))     return { state: 'amended', evidence };

  // Provided: SKIP if negation guard is active
  // This prevents "not provided" / "not received" from falsely → provided
  if (!hasNegation && checkSignals(PROVIDED_SIGNALS)) return { state: 'provided', evidence };

  // Missing: covers all "not X" / "no X" patterns
  if (checkSignals(MISSING_SIGNALS))     return { state: 'missing', evidence };

  // If negation was detected but no specific missing signal matched, treat as missing
  if (hasNegation) {
    evidence.push('(negation guard — item absent)');
    return { state: 'missing', evidence };
  }

  if (checkSignals(DELAYED_SIGNALS))     return { state: 'delayed', evidence };
  if (checkSignals(INFORMATIONAL_SIGNALS)) return { state: 'informational', evidence };

  return { state: 'unknown', evidence: [] };
}

// ─── Topic rules ──────────────────────────────────────────────────
// Each topic has strong signals (high confidence) and weak signals (lower confidence).
// The final issueId depends on topic + state (see resolveIssueId below).

interface TopicRule {
  topic: string;          // base taxonomy topic
  strongSignals: string[]; // any match → confidence ≥ 0.85
  weakSignals: string[];   // any match → confidence 0.55–0.70
}

const TOPIC_RULES: TopicRule[] = [
  {
    topic: 'load_ref',
    // PRECISION RULE: only explicitly load-reference-specific terms fire as strong signals.
    // These must be paired with explicit missing/provided intent (via the strict gate in
    // classifyCase.ts) to become Missing Load Reference. A generic planning email that
    // mentions "booking ref" in passing does NOT qualify — the gate will reject it.
    // All other reference terminology (booking number, reference number, order reference,
    // etc.) has been moved to weakSignals to prevent planning/feasibility emails from
    // receiving high-confidence (0.85) load_ref scores and winning over the correct topic.
    // PRECISION: Only the bare "load ref" / "load reference" family fires as strong.
    // 'booking ref' and 'booking reference' are moved to weakSignals — they appear
    // in planning/feasibility emails and must NOT override the correct topic (capacity,
    // closing_time, etc.) at equal confidence. The strict gate in classifyCase.ts
    // provides the final precision check via validateLoadRefMissing.
    strongSignals: [
      'load ref', 'loadref', 'load reference',
      // Note: 'order no' intentionally excluded — at only 8 chars it matches as a substring
      // inside "transport order not received" → causes transport_order to misclassify as load_ref.
      // Note: 'transport order' intentionally excluded — it is a document (see transport_order topic)
      // ── Multilingual explicit-missing patterns (EN/NL/DE) ───────────────
      // English
      'missing load ref', 'missing load reference', 'please provide load ref',
      'please send load ref', 'load ref still missing', 'no load ref received',
      'load reference not provided', 'please send the loadref', 'please send the loadrefs',
      'please send loadref', 'loadref missing', 'release ref missing',
      'missing release reference', 'please provide release ref',
      'loading reference missing', 'reference required for loading',
      'load ref not received', 'load ref not provided', 'load ref required',
      'loadref required', 'no loadref', 'no load reference',
      // Dutch
      'laadreferentie ontbreekt', 'loadref ontbreekt', 'graag loadref sturen',
      'graag laadreferentie sturen', 'loadref nog niet ontvangen',
      'laadreferentie niet ontvangen', 'laadreferentie ontbr',
      'graag de loadref', 'loadref nog niet', 'laadreferentie nog niet',
      'laadreferentie missen', 'ontbrekende laadreferentie',
      // German
      'ladereferenz fehlt', 'lade referenz fehlt', 'bitte ladereferenz senden',
      'referenz fehlt', 'ladung referenz fehlt', 'ladereferenz nicht erhalten',
      'ladereferenz wird benoetigt', 'ladereferenz benoetigt',
      'ladereferenz nicht vorhanden', 'fehlende ladereferenz',
    ],
    weakSignals: [
      // Explicit "correct/updated ref" phrases — indicate a reference is being supplied.
      // Note: for load_ref, state=amended stays as load_ref; ref_provided only triggers on provided/informational.
      'correct ref', 'corrected ref', 'updated ref', 'update ref',
      // Booking reference terminology — weak so planning emails with "booking reference"
      // don't beat a closing_time or capacity topic that fires at strong (0.85).
      'booking ref', 'booking reference',
      // Generic reference terminology — also weak for the same reason.
      'booking number', 'reference number', 'ref number', 'ref no',
      'order reference', 'order number', 'po number', 'purchase order',
      'job reference', 'job number', 'shipment reference', 'shipment ref',
      'consignment number', 'consignment ref', 'load number',
      // Explicit "missing X" patterns — meaningful for direct weak-signal detection.
      'ref missing', 'no reference provided', 'without load reference',
      'missing reference', 'ref not received', 'ref not provided',
      'load number missing',
    ],
  },
  {
    // Transport Order (TRO) — an instruction document sent to the haulier.
    // This is NOT a load reference number; it is a separate operational document.
    // Example: "Please send us the transport order for BL MAEU262065895"
    //          → object: transport order, intent: requested → transport_order (missing)
    topic: 'transport_order',
    strongSignals: [
      'transport order', 'transport instruction', 'haulier order', 'haulier instruction',
      'transport booking order', 'driver order', 'driver instruction',
      'missing transport order', 'transport order missing', 'transport order not received',
      'transport order required', 'please send transport order', 'send transport order',
      'send us the transport order', 'send the transport order',
      'no transport order', 'transport order not issued', 'transport order not sent',
      // Work order = same operational concept as transport order
      'work order', 'workorder', 'work-order',
      'work order missing', 'missing work order', 'work order not received',
      'work order required', 'please send work order', 'send work order',
      'no work order', 'work order not issued', 'work order not sent',
      // ── Multilingual (NL/DE) ─────────────────────────────────────────────
      // Dutch
      'transportorder', 'transport opdracht', 'transportopdracht',
      'graag transportopdracht sturen', 'transportorder ontbreekt',
      'transportopdracht ontbreekt', 'graag transportorder',
      // German
      'transportauftrag', 'transportauftrag fehlt',
      'bitte transportauftrag senden', 'auftrag fehlt',
      'fahrauftrag', 'fahrauftrag fehlt',
    ],
    weakSignals: [
      'tro', 'carrier instruction', 'carrier order', 'transport confirmation',
      'haulage instruction', 'movement order',
    ],
  },
  {
    topic: 'customs',
    strongSignals: [
      'customs', 'douane', 'zoll', 'customs clearance',
      // Note: bare 'declaration' removed — it matches substring of "transit declaration"
      // causing customs to incorrectly beat t1. Use specific forms ('import declaration',
      // 'export declaration') which do NOT appear in T1/transit contexts.
      'customs hold', 'customs delay', 'customs release', 'customs check',
      'customs inspection', 'customs exam', 'import declaration',
      'export declaration', 'mrn', 'customs entry', 'customs documents',
      // Short-form aliases used in operational emails
      'customs docs', 'customs doc', 'customs documentation',
      'customs paperwork', 'customs broker', 'clearing agent', 'customs agent',
      'eur1', 'certificate of origin', 'phytosanitary', 'health cert',
      'import license', 'export license',
      // NOTE: 'commercial invoice' intentionally removed — it is a financial document
      // identifier and causes financial emails (billing/extra cost) to misclassify
      // as Customs / Documentation. Financial intent takes priority (see intentDetection.ts).
      'hs code', 'tariff code', 'commodity code', 'eori',
      'import duty', 'export duty', 'ata carnet', 'bonded warehouse',
      // 'duty' alone is kept ONLY as a weak signal — it appears in many non-customs
      // contexts (e.g. "duty of care", "on duty"). Specific forms remain as strong.
      // ── Multilingual explicit-missing patterns (EN/NL/DE) ─────────────────
      // English
      'customs documents missing', 'no customs documents received',
      'please provide customs documents', 'please send customs documents',
      'missing customs documents', 'customs docs missing', 'mrn missing',
      'missing mrn', 'cannot proceed without mrn', 'mrn not received',
      'mrn not provided', 'mrn required', 'need mrn', 'require mrn',
      // Portbase-specific missing customs docs patterns
      'missing customs docs portbase', 'customs documents in portbase missing',
      'customs docs portbase', 'portbase customs missing',
      'portbase customs docs missing', 'missing customs docs',
      'customs docs missing', 'portbase check customs',
      'portbase check customs missing', '1st portbase check',
      'portbase customs documents missing',
      // Dutch
      'douane documenten ontbreken', 'douane documenten niet ontvangen',
      'graag douane documenten sturen', 'mrn ontbreekt',
      'douanedocumenten ontbreken', 'douanepapieren ontbreken',
      'graag de mrn', 'mrn niet ontvangen',
      // German
      'zolldokumente fehlen', 'zollpapiere fehlen',
      'bitte zollpapiere senden', 'mrn fehlt',
      'zolldokumente nicht erhalten', 'zollpapiere benoetigt',
      'bitte mrn senden',
    ],
    weakSignals: [
      'duty',   // general "duty" — keep weak; specific forms ('import duty') are strong
      'missing documents', 'documents missing', 'documentation missing',
      'documents not received', 'packing list missing',
      'certificate missing', 'compliance documents', 'regulatory documents',
      // NOTE: 'invoice missing' removed — invoice queries are financial (rate topic)
    ],
  },
  {
    topic: 't1',
    strongSignals: [
      't1 document', 'transit document', 'community transit',
      'transit declaration', 'transit entry', 't1 missing', 't1 error',
      'transit pass', 'ncts', 'transit guarantee', 'transit bond',
      'transit closure', 'transit rejection', 'procedure 7100',
      'transit not closed', 'transit open', 'customs transit',
      // ── Multilingual explicit-missing patterns (EN/NL/DE) ─────────────────
      // English
      'please send t1', 'missing t1', 't1 still missing', 't1 not received',
      't1 not provided', 'driver needs t1', 'cannot proceed without t1',
      't1 document missing', 'need t1', 'require t1',
      // Dutch
      't1 ontbreekt', 'graag t1 sturen', 't1 nog niet ontvangen',
      't1 niet ontvangen', 'graag de t1', 't1 document ontbreekt',
      // German
      't1 fehlt', 'bitte t1 senden', 't1 nicht erhalten',
      't1 dokument fehlt', 't1 benoetigt',
    ],
    weakSignals: [
      't1', 't2', 'transit procedure', 'transit mrn',
      'transit movement', 'transit status', 'in transit',
    ],
  },
  {
    topic: 'delay',
    strongSignals: [
      'delayed', 'not on time', 'late arrival', 'late delivery',
      'missed eta', 'overdue', 'behind schedule', 'no show',
      'not arrived', 'late collection', 'not collected', 'not delivered',
      'running late', 'past eta', 'missed appointment',
      'driver late', 'driver delayed', 'vehicle delayed', 'truck delayed',
      'not on-time', 'failed delivery', 'failed collection',
      'missed time slot', 'delivery window missed',
    ],
    weakSignals: [
      'delay', 'late', 'still waiting', 'expected today', 'expected yesterday',
      'where is my', 'not yet arrived', 'postponed', 'rescheduled',
      'held up', 'stuck', 'on hold',
    ],
  },
  {
    topic: 'closing_time',
    strongSignals: [
      'cutoff', 'cut-off', 'cut off', 'closing time', 'closing deadline',
      'missed cutoff', 'after cutoff', 'vgm deadline', 'vgm cutoff',
      'gate cutoff', 'gate cut off', 'terminal cutoff', 'missed closing',
      'missed vessel', 'missed ship', 'missed sailing', 'missed departure',
      'missed loading', 'sailed without', 'vessel already departed',
      'too late for vessel',
    ],
    weakSignals: [
      'deadline', 'closing', 'gate closed', 'terminal closed', 'vessel cutoff',
      'departure cutoff', 'submission deadline', 'filing deadline', 'vgm',
    ],
  },
  {
    topic: 'amendment',
    strongSignals: [
      'amendment', 'booking amendment', 'booking change',
      'address correction', 'wrong address', 'incorrect address',
      'consignee change', 'shipper change', 'wrong weight',
      'incorrect weight', 'wrong volume', 'wrong dimensions',
      'wrong description', 'incorrect description', 'wrong consignee',
      'wrong shipper', 'wrong port', 'wrong destination',
      'routing change', 'please correct', 'please amend',
      'please update the booking', 'rebook', 're-book',
      // Cancellations are amendment-class events
      'booking cancelled', 'booking cancellation', 'cancel booking',
      'order cancelled', 'shipment cancelled', 'transport cancelled',
      'loading cancelled', 'pickup cancelled', 'delivery cancelled',
    ],
    weakSignals: [
      'correction', 'amend', 'change request', 'modification',
      'update booking', 'rate correction', 'wrong details',
      'incorrect details', 'booking error', 'booking mistake',
      'please update', 'needs updating',
    ],
  },
  {
    topic: 'waiting_time',
    strongSignals: [
      'waiting time', 'demurrage', 'detention', 'wait time',
      'waiting costs', 'standing time', 'free time exceeded',
      'container detention', 'chassis detention', 'demurrage charge',
      'detention charge', 'free period exceeded', 'storage charge',
      'quay rent', 'extra storage days', 'storage days exceeded',
    ],
    weakSignals: [
      'waiting at terminal', 'waiting at port', 'waiting at depot',
      'long wait', 'extended wait', 'idle time', 'congestion',
      'port congestion', 'terminal congestion', 'queue', 'queuing',
      'waiting to load', 'waiting to unload',
    ],
  },
  {
    topic: 'equipment_release',
    strongSignals: [
      'release order', 'pin code', 'pickup authorisation',
      'release pin', 'delivery order', 'pin not received',
      'pin not working', 'pin expired', 'pin invalid',
      'acceptance', 'accepted at terminal', 'terminal acceptance',
      'terminal release', 'gate out', 'container release',
      'cargo release', 'release not received',
    ],
    weakSignals: [
      'release', 'acceptance', 'cannot pick up', 'cannot collect',
      'collection rejected', 'gate refused',
    ],
  },
  {
    topic: 'equipment',
    strongSignals: [
      'reefer failure', 'temperature deviation', 'temperature alarm',
      'temperature exceedance', 'cold chain failure', 'genset failure',
      'container damage', 'trailer damage', 'broken seal',
      'seal missing', 'seal discrepancy', 'faulty unit',
      'defective container', 'container unavailable', 'equipment shortage',
      'truck breakdown', 'vehicle breakdown', 'mechanical failure',
      // "Portable / unit not OK" — equipment condition failures reported by drivers/depots.
      // Must classify as EQUIPMENT, never as Reference Update / Info Provided.
      'portable not ok', 'portable not in order', 'portable not acceptable',
      'equipment not ok', 'equipment not in order', 'equipment not acceptable',
      'unit not ok', 'unit not in order', 'unit not acceptable',
      'container not ok', 'container not in order', 'container not acceptable',
      'trailer not ok', 'trailer not in order', 'trailer not acceptable',
      'not roadworthy', 'unroadworthy', 'unit defective', 'unit damaged',
      'equipment defect', 'equipment failure', 'equipment fault',
      'container defect', 'container fault', 'trailer defect', 'trailer fault',
      // ── Multilingual (NL/DE) ─────────────────────────────────────────────
      // Dutch
      'container beschadigd', 'container niet ok', 'apparatuur probleem',
      'container defect', 'reefer defect', 'zegel defect',
      'container beschadiging', 'equipment probleem',
      // German
      'container beschaedigt', 'container defekt', 'equipment problem',
      'container nicht ok', 'reefer defekt', 'siegel defekt',
      'schaden am container',
    ],
    weakSignals: [
      'equipment issue', 'container not available', 'no container',
      'reefer', 'seal broken', 'swap body', 'flat tyre', 'tyre issue',
      'wrong container type', 'wrong equipment type',
    ],
  },
  {
    topic: 'tracking',
    strongSignals: [
      'where is my', 'where are my', 'shipment status', 'track and trace',
      'proof of delivery', 'pod not received', 'pod missing',
      'delivery confirmation', 'delivery proof', 'signed delivery',
      'eta update', 'current eta', 'revised eta', 'expected arrival',
    ],
    weakSignals: [
      'tracking', 'where is', 'status update', 'no update',
      'visibility', 'no tracking', 'not visible', 'no information',
      'whereabouts', 'location query',
    ],
  },
  {
    topic: 'communication',
    strongSignals: [
      'no response', 'no reply', 'not answered', 'unanswered',
      'cannot reach', 'not reachable', 'unresponsive',
      'poor communication', 'no feedback', 'lack of response',
      'urgent escalation', 'service complaint', 'service failure',
    ],
    weakSignals: [
      'escalation', 'complaint', 'dissatisfied', 'follow-up', 'follow up',
      'no contact', 'not informed', 'not notified', 'no notification',
    ],
  },
  {
    topic: 'portbase',
    strongSignals: [
      'portbase', 'port notification', 'pre-notification', 'port clearance',
      'pcs message', 'ata notification', 'atd notification',
      'pre arrival notification', 'port entry rejected',
      'arrival notification', 'departure notification',
      // Missing customs docs in portbase context
      'missing customs docs portbase', 'portbase customs missing',
      'portbase customs docs missing', 'customs docs portbase',
      'portbase check customs missing', 'portbase customs documents missing',
    ],
    weakSignals: [
      'port system', 'terminal notification', 'port pre-arrival',
      'vessel notification', 'port admin', 'port documentation',
      'port registration', 'port permit', 'berth notification',
    ],
  },
  {
    topic: 'bl',
    strongSignals: [
      'bill of lading', 'b/l', 'sea waybill', 'original bl',
      'telex release', 'surrender bl', 'express bl',
      'bl correction', 'bl amendment', 'bl not received',
      'bl missing', 'hbl', 'mbl', 'house bl', 'master bl',
      'bl release', 'bl not available', 'bl draft',
    ],
    weakSignals: [
      'lading', 'bl error', 'bl incorrect', 'bl discrepancy',
      'waybill', 'cmr note', 'consignment note',
      'shipping document', 'cargo release', 'original documents',
      'original required',
    ],
  },
  {
    topic: 'rate',
    strongSignals: [
      // Rate / pricing disputes
      'rate query', 'rate dispute', 'invoice query', 'overcharge',
      'billing query', 'charge dispute', 'incorrect invoice',
      'rate discrepancy', 'invoice incorrect', 'wrong invoice',
      'invoice dispute', 'overcharged', 'undercharged', 'charge query',
      // Selfbilling / auto-billing systems — must classify as financial, never as Delay
      'selfbilling', 'self billing', 'self-billing', 'selfbill', 'self bill',
      // DCH (digital cost handling / document cost header) invoice formats
      'dch invoice', 'dch billing', 'dch report', 'dch cost',
      // Extra cost invoices — invoices for additional charges
      'extra cost invoice', 'extra costs invoice', 'extra costs report',
      'extra cost report', 'extrakostenrechnung',
      'extra kosten rapport', 'extra kosten report',
      'meerkosten rapport', 'meerkosten report',
      'additional cost invoice', 'additional costs invoice',
      // Billing reports and cost invoices
      'billing report', 'billing issue', 'billing error', 'billing dispute',
      'cost invoice', 'waiting cost invoice', 'waiting costs invoice',
      // Demurrage / detention invoices (financial, not operational demurrage events)
      'demurrage invoice', 'detention invoice', 'storage invoice',
      // Credit / debit notes
      'credit note', 'credit memo', 'debit note', 'debit memo',
      'credit note query', 'debit note query',
      // Invoice missing / not received (financial, not customs)
      'invoice not received', 'invoice missing', 'invoice outstanding',
      // Commercial invoice (financial document — NOT a customs clearance signal)
      'commercial invoice query', 'commercial invoice dispute', 'commercial invoice incorrect',
      // Price corrections — explicitly financial, must not be classified as transport_order
      // even when the subject mentions "transport order" alongside "price correction"
      'price correction', 'price adjustment', 'rate correction',
      'wrong rate applied', 'wrong rate was applied', 'incorrect rate applied',
      'corrected invoice', 'invoice correction',
      // Purchase Orders / PO references — financial procurement documents
      // NOTE: use specific forms only — bare 'po' too short (matches substrings)
      // English
      'purchase order', 'purchase orders', 'po number', 'po no', 'po#',
      // Dutch
      'inkooporder', 'bestelnummer', 'inkoopnummer',
      // German
      'bestellnummer', 'einkaufsauftrag', 'bestellauftrag',
      // Storage and waiting-time costs — financial charge language (not operational event)
      // "driver waited 4 hours" → waiting_time (operational)
      // "waiting time charges" / "storage costs invoice" → rate (financial)
      // English
      'storage cost', 'storage costs', 'waiting time charges',
      'waiting time invoice', 'waiting costs invoice', 'cost allocation',
      // Dutch
      'opslagkosten', 'wachttijd kosten', 'wachttijd factuur',
      'detentie kosten', 'demurrage factuur', 'kosten rapport',
      // German
      'lagerkosten', 'wartezeit kosten', 'wartezeit rechnung',
      'standgeld', 'demurrage rechnung', 'kostenbericht',
    ],
    weakSignals: [
      // NOTE: bare 'rate' removed — it matches as substring of 'generated', 'translated',
      // 'auto-generated', 'rated', 'rates' (non-financial) etc. causing false positives.
      // Use word-boundary safe forms: ' rate ', 'rate ', ' rate' — all handled by the
      // word-boundary helper applied to weakSignals for this topic.
      // Safe explicit weak forms:
      ' rate ', 'rate query', 'rate dispute', 'rate correction', 'rate discrepancy',
      'wrong rate', 'freight rate', 'rate inquiry',
      'pricing', 'surcharge', 'quotation',
      'tariff', 'refund request', 'payment dispute',
      // Generic billing/invoice language (weak — context window determines final state)
      'invoice', 'billing', 'extra cost', 'extra costs', 'additional charge',
      'cost report',
      // Note: bare 'charge' intentionally removed — too broad (fires on "in charge of",
      // "handling charge of", "fuel charge not relevant" etc.). Specific forms like
      // 'additional charge', 'charge dispute', 'charge query', 'wrong charge' remain
      // as either strong or appropriately scoped signals above.
    ],
  },
  {
    topic: 'damage',
    strongSignals: [
      'cargo loss', 'lost cargo', 'missing cargo', 'shortfall',
      'cargo claim', 'theft reported', 'goods stolen',
      'claim submitted', 'claim filed', 'insurance claim',
      'delivery shortage', 'wrong goods delivered', 'quantity short',
    ],
    weakSignals: [
      'damage', 'damaged', 'broken', 'contamination',
      'missing goods', 'shortage', 'goods missing', 'pilferage',
      'partial loss', 'total loss',
    ],
  },
  {
    topic: 'scheduling',
    strongSignals: [
      'planning slot', 'time slot request', 'booking slot',
      'terminal slot', 'depot slot', 'slot allocation',
      'arrival window', 'collection window', 'delivery window',
      'appointment request', 'appointment confirmation',
      'pre-gate appointment',
      // ── Multilingual (NL/DE) ─────────────────────────────────────────────
      // Dutch
      'laadslot', 'afhaaltijd', 'levertijd', 'afhaaldatum', 'leverdatum',
      // German
      'ladeslot', 'abholzeit', 'lieferzeit', 'abholtermin', 'liefertermin',
    ],
    weakSignals: [
      'schedule', 'scheduling', 'allocation', 'slot',
      'time window', 'appointment',
    ],
  },
  {
    topic: 'pickup_delivery',
    strongSignals: [
      'pickup planning', 'delivery planning', 'collection planning',
      'last-mile', 'last mile', 'home delivery', 'residential delivery',
      'delivery address', 'pickup address', 'collection address',
      'driver instruction', 'delivery instruction', 'access instruction',
      // ── Multilingual (NL/DE) ─────────────────────────────────────────────
      // Dutch
      'afhaal planning', 'lever planning', 'afhaaldatum', 'leverdatum',
      'ophaalplanning',
      // German
      'abholplanung', 'lieferplanung', 'abholtermin', 'liefertermin',
    ],
    weakSignals: [
      'pickup', 'pick-up', 'pick up', 'delivery planning',
      'collection planning', 'route planning',
      // Load/loading date queries are pickup/delivery planning
      'load date', 'loading date', 'loaddate', 'load day',
      'please advise load', 'advise loading',
    ],
  },
  {
    topic: 'capacity',
    strongSignals: [
      'no capacity', 'not feasible', 'no space available', 'fully booked',
      'cannot accept this shipment', 'capacity not available', 'no slots available',
      'capacity constraint', 'at capacity', 'overbooked',
      'unable to accommodate', 'capacity limitation', 'capacity problem',
      'maximum capacity', 'no room available', 'no slot available',
    ],
    weakSignals: [
      'capacity', 'feasibility', 'feasible', 'no slots', 'no availability',
      'cannot accommodate', 'overloaded', 'no space', 'overbooking',
    ],
  },
];

// ─── Resolve final issueId based on topic + state ──────────────────
//
// DOCUMENT-PROVISION FORK (critical for Customs / Compliance accuracy):
//
// For document/reference topics (load_ref, customs, t1, portbase, bl),
// if the email body shows that a document IS BEING PROVIDED (not requested),
// the case belongs in "Reference Update / Info Provided" — NOT in the
// compliance/missing section.
//
// Examples of state=provided that fork away from Customs/Compliance:
//   "please find attached customs documents"  → ref_provided ✓
//   "herewith customs docs"                   → ref_provided ✓
//   "attached MRN"                            → ref_provided ✓
//   "T1 document sent"                        → ref_provided ✓
//   "Portbase confirmed"                      → ref_provided ✓
//   "BL issued"                               → ref_provided ✓
//
// Examples of state=missing that stay in compliance:
//   "customs documents missing"               → customs ✓
//   "please send MRN"                         → customs ✓
//   "T1 not received"                         → t1 ✓
//   "Portbase release missing"                → portbase ✓
//   "BL not received"                         → bl ✓
//
// transport_order stays as transport_order regardless of state —
// the state (missing/provided) is captured in issueState only.
const DOC_TOPICS = new Set(['load_ref', 'customs', 't1', 'portbase', 'bl']);

function resolveIssueId(topic: string, state: IssueState): string {
  // All doc topics fork to ref_provided when state=provided (document explicitly supplied).
  if (state === 'provided') {
    if (DOC_TOPICS.has(topic)) return 'ref_provided';
  }
  // load_ref only: informational ("FYI the load ref is X") and amended ("corrected ref")
  // also fork to ref_provided.
  // Other doc topics (customs/t1/portbase/bl) do NOT fork on informational —
  // "please note that customs documents were sent" is a compliance/informational event,
  // not a ref_provided event. Keeping it as customs/t1/portbase/bl preserves compliance
  // tracking accuracy and prevents ref_provided from becoming a catch-all bucket.
  if (topic === 'load_ref' && (state === 'informational' || state === 'amended')) {
    return 'ref_provided';
  }
  return topic;
}

// ─── Main classifier ──────────────────────────────────────────────

/**
 * Classify a piece of text using intent-aware rules.
 * Returns all matching issues with confidence and evidence.
 * Never returns 'other' — that is handled by fallbackIssueRules.ts.
 *
 * ACCURACY DESIGN: per-topic context-window state detection.
 *
 * Each topic's intent/state is detected using a 280-character window
 * around the first matching keyword, NOT the full field text. This prevents
 * false positives when a single field contains mixed content — e.g. a
 * description that provides a load reference AND mentions missing customs
 * docs would previously conflate the two states via a shared detectState()
 * call, causing the load-ref to be misclassified as "missing".
 *
 * Example:
 *   "Load ref BKG12345 see below. Customs docs not yet received."
 *   load_ref topic: context = "Load ref BKG12345 see below" → state=provided → ref_provided ✅
 *   customs topic:  context = "Customs docs not yet received" → state=missing → customs ✅
 *
 * Without context windowing, detectState(fullText) would see "not yet received"
 * as a negation guard and suppress the "see below" provided signal for ALL topics.
 */
export function classifyByRules(text: string): IssueMatch[] {
  const t = text.toLowerCase();
  const matches: IssueMatch[] = [];

  for (const rule of TOPIC_RULES) {
    const topicEvidence: string[] = [];
    let baseConfidence = 0;
    // Track position of first matching signal — used to anchor the context window
    let firstMatchPos = -1;

    for (const sig of rule.strongSignals) {
      const pos = t.indexOf(sig);
      if (pos !== -1) {
        topicEvidence.push(`"${sig}"`);
        baseConfidence = Math.max(baseConfidence, STRONG_SIGNAL_CONFIDENCE);
        if (firstMatchPos === -1) firstMatchPos = pos;
      }
    }
    if (baseConfidence < STRONG_SIGNAL_CONFIDENCE) {
      for (const sig of rule.weakSignals) {
        const pos = t.indexOf(sig);
        if (pos !== -1) {
          topicEvidence.push(`"${sig}" (weak)`);
          baseConfidence = Math.max(baseConfidence, WEAK_SIGNAL_CONFIDENCE);
          if (firstMatchPos === -1) firstMatchPos = pos;
        }
      }
    }

    if (topicEvidence.length === 0) continue;

    // Per-topic context-window state detection:
    // Slice a window (CONTEXT_WINDOW_BEFORE + CONTEXT_WINDOW_AFTER chars around first keyword)
    // and run detectState only on that context. This isolates intent detection to the
    // relevant sentence — prevents mixed-content fields from conflating intent across topics.
    const winStart = Math.max(0, firstMatchPos - CONTEXT_WINDOW_BEFORE);
    const winEnd   = Math.min(text.length, firstMatchPos + CONTEXT_WINDOW_AFTER);
    const contextWindow = text.slice(winStart, winEnd);

    const { state, evidence: stateEvidence } = detectState(contextWindow);

    // State bonus: knowing the intent increases confidence
    const confidenceBonus = state !== 'unknown' ? STATE_DETECTION_BONUS : 0;
    const finalConfidence = Math.min(baseConfidence + confidenceBonus, MAX_CONFIDENCE);

    const issueId = resolveIssueId(rule.topic, state);

    matches.push({
      issueId,
      state,
      confidence: finalConfidence,
      evidence: [...topicEvidence, ...stateEvidence],
    });
  }

  return matches;
}
