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

// ─── Intent phrase lists ──────────────────────────────────────────
// "MISSING" signals — the subject item is absent or being requested
const MISSING_SIGNALS = [
  'please provide', 'please send', 'please share', 'please forward',
  'please supply', 'kindly provide', 'kindly send',
  'can you send', 'can you provide', 'can you share',
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
  'providing', 'provided', 'supplied', 'sharing',
  'please see', 'see below for', 'details below',
  'confirmed', 'confirmation', 'done', 'completed',
  'updated', 'resolved',
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

function detectState(text: string): { state: IssueState; evidence: string[] } {
  const t = text.toLowerCase();
  const evidence: string[] = [];

  const checkSignals = (signals: string[], _state: IssueState): boolean => {
    for (const sig of signals) {
      if (t.includes(sig)) {
        evidence.push(`"${sig}"`);
        return true;
      }
    }
    return false;
  };

  if (checkSignals(ESCALATED_SIGNALS, 'escalated'))   return { state: 'escalated', evidence };
  if (checkSignals(AMENDED_SIGNALS, 'amended'))        return { state: 'amended', evidence };
  if (checkSignals(PROVIDED_SIGNALS, 'provided'))      return { state: 'provided', evidence };
  if (checkSignals(MISSING_SIGNALS, 'missing'))        return { state: 'missing', evidence };
  if (checkSignals(DELAYED_SIGNALS, 'delayed'))        return { state: 'delayed', evidence };
  if (checkSignals(INFORMATIONAL_SIGNALS, 'informational')) return { state: 'informational', evidence };

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
    strongSignals: [
      'load ref', 'loadref', 'load reference', 'booking ref', 'booking reference',
      'booking number', 'reference number', 'ref number', 'ref no',
      'order reference', 'order number', 'order no', 'po number', 'purchase order',
      'job reference', 'job number', 'shipment reference', 'shipment ref',
      'consignment number', 'consignment ref', 'load number', 'transport order',
    ],
    weakSignals: [
      'reference', 'booking', 'ref missing', 'no reference', 'without reference',
      'missing reference', 'ref not', 'number missing',
    ],
  },
  {
    topic: 'customs',
    strongSignals: [
      'customs', 'douane', 'zoll', 'declaration', 'customs clearance',
      'customs hold', 'customs delay', 'customs release', 'customs check',
      'customs inspection', 'customs exam', 'import declaration',
      'export declaration', 'mrn', 'customs entry', 'customs documents',
      'customs paperwork', 'customs broker', 'clearing agent', 'customs agent',
      'eur1', 'certificate of origin', 'phytosanitary', 'health cert',
      'import license', 'export license', 'commercial invoice',
      'hs code', 'tariff code', 'commodity code', 'eori', 'duty',
      'import duty', 'export duty', 'ata carnet', 'bonded warehouse',
    ],
    weakSignals: [
      'missing documents', 'documents missing', 'documentation missing',
      'documents not received', 'invoice missing', 'packing list missing',
      'certificate missing', 'compliance documents', 'regulatory documents',
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
      'rate query', 'rate dispute', 'invoice query', 'overcharge',
      'billing query', 'charge dispute', 'incorrect invoice',
      'rate discrepancy', 'invoice incorrect', 'wrong invoice',
      'invoice dispute', 'overcharged', 'undercharged', 'charge query',
    ],
    weakSignals: [
      'rate', 'pricing', 'surcharge', 'freight rate', 'quotation',
      'tariff', 'credit note', 'refund request', 'payment dispute',
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
    ],
    weakSignals: [
      'pickup', 'pick-up', 'pick up', 'delivery planning',
      'collection planning', 'route planning',
    ],
  },
];

// ─── Resolve final issueId based on topic + state ──────────────────
// The "ref_provided" category distinguishes "load ref was given" from "load ref is missing".
function resolveIssueId(topic: string, state: IssueState): string {
  if (topic === 'load_ref' && (state === 'provided' || state === 'informational' || state === 'amended')) {
    return 'ref_provided';
  }
  return topic;
}

// ─── Main classifier ──────────────────────────────────────────────

/**
 * Classify a piece of text using intent-aware rules.
 * Returns all matching issues with confidence and evidence.
 * Never returns 'other' — that is handled by fallbackIssueRules.ts.
 */
export function classifyByRules(text: string): IssueMatch[] {
  const t = text.toLowerCase();
  const matches: IssueMatch[] = [];

  const { state, evidence: stateEvidence } = detectState(text);

  for (const rule of TOPIC_RULES) {
    const topicEvidence: string[] = [];
    let baseConfidence = 0;

    for (const sig of rule.strongSignals) {
      if (t.includes(sig)) {
        topicEvidence.push(`"${sig}"`);
        baseConfidence = Math.max(baseConfidence, 0.85);
      }
    }
    if (baseConfidence < 0.85) {
      for (const sig of rule.weakSignals) {
        if (t.includes(sig)) {
          topicEvidence.push(`"${sig}" (weak)`);
          baseConfidence = Math.max(baseConfidence, 0.55);
        }
      }
    }

    if (topicEvidence.length === 0) continue;

    // State bonus: knowing the intent increases confidence
    const confidenceBonus = state !== 'unknown' ? 0.10 : 0;
    const finalConfidence = Math.min(baseConfidence + confidenceBonus, 0.98);

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
