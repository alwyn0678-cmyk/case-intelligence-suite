// ─────────────────────────────────────────────────────────────────
// Classification Accuracy Test Suite
//
// Proves the classifier produces correct results on canonical
// real-world case text. Each test documents:
//   - input text (description or combined text)
//   - expected primaryIssue taxonomy id
//   - expected issueState
//   - the accuracy principle being validated
//
// Run:  npm test
// ─────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { classifyByRules } from '../issueRules';
import {
  textProvidesRef,
  PROVIDED_REF_PATTERNS,
  validateLoadRefMissing,
  LOAD_REF_EXPLICIT_MISSING,
} from '../loadRefGuards';
import { isSentenceFragment, detectsTransportOrder, isLoadRefFalsePositive } from '../validators';

// ─── Helper: classify text and return top match ───────────────────
function classify(text: string) {
  const matches = classifyByRules(text);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.confidence - a.confidence)[0];
}

// ─── 1. Object detection: Transport Order vs Load Reference ───────
describe('Transport Order — must NOT classify as load_ref', () => {
  const cases = [
    'please send us the transport order for BL MAEU262065895',
    'Missing transport order MAEU262065895',
    'transport order required for this shipment',
    'Please send the transport order to the haulier',
    'waiting for transport order from carrier',
    'transport order not received',
  ];

  for (const text of cases) {
    it(`classifies as transport_order: "${text.slice(0, 60)}"`, () => {
      const result = classify(text);
      expect(result, `No match for: ${text}`).not.toBeNull();
      expect(result!.issueId).toBe('transport_order');
      expect(result!.issueId).not.toBe('load_ref');
    });
  }
});

// ─── 2. Missing Load Reference ────────────────────────────────────
describe('Missing Load Reference — detected as load_ref / missing', () => {
  const cases = [
    { text: 'please provide load ref', expectedState: 'missing' },
    { text: 'load ref missing for this shipment', expectedState: 'missing' },
    { text: 'waiting for load ref — not received yet', expectedState: 'missing' },
    { text: 'we need the load reference number urgently', expectedState: 'missing' },
    { text: 'load ref not provided by customer', expectedState: 'missing' },
  ];

  for (const { text, expectedState } of cases) {
    it(`load_ref / ${expectedState}: "${text}"`, () => {
      const result = classify(text);
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe('load_ref');
      expect(result!.state).toBe(expectedState);
    });
  }
});

// ─── 3. Reference Provided — must NOT classify as load_ref missing ─
describe('Reference Provided — classifies as ref_provided / provided', () => {
  const cases = [
    'please see below load ref BKG12345',
    'load ref: BKG12345',
    'find below the reference number',
    'the load ref is BKG99001',
    'correct ref is BKG456',
    'updated ref BKG789',
    'load ref confirmed — BKG123',
    'ref no BKG1234',
    'reference no 12345ABC',
  ];

  for (const text of cases) {
    it(`textProvidesRef detects provided-ref pattern: "${text}"`, () => {
      expect(textProvidesRef(text)).toBe(true);
    });
  }
});

// ─── 4. Customs — provided vs missing ────────────────────────────
describe('Customs / Documentation', () => {
  it('customs docs not received → customs / missing', () => {
    const result = classify('customs documents not received');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('customs');
    expect(result!.state).toBe('missing');
  });

  it('attached customs docs → customs / provided', () => {
    const result = classify('please find attached the customs documents');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('customs');
    expect(result!.state).toBe('provided');
  });

  it('customs clearance required → customs', () => {
    const result = classify('customs clearance is required before release');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('customs');
  });
});

// ─── 5. T1 / Transit Document ─────────────────────────────────────
describe('T1 / Transit Document', () => {
  it('please share T1 → t1 / missing', () => {
    const result = classify('please share the T1 document');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('t1');
    expect(result!.state).toBe('missing');
  });

  it('T1 missing → t1 / missing', () => {
    const result = classify('T1 document missing — transit not closed');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('t1');
  });

  it('T1 document sent → t1 / provided', () => {
    const result = classify('T1 document has been sent — please confirm receipt');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('t1');
    expect(result!.state).toBe('provided');
  });
});

// ─── 6. Amendment / Correction ───────────────────────────────────
describe('Amendment / Correction', () => {
  it('booking cancelled → amendment / amended', () => {
    const result = classify('booking cancelled — please arrange alternative');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('amendment');
  });

  it('loading amended → amendment', () => {
    const result = classify('loading has been amended — new date 15 June');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('amendment');
  });

  it('wrong address → amendment / amended', () => {
    const result = classify('wrong address on booking — please correct consignee');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('amendment');
  });
});

// ─── 7. Planning / Schedule (load date / rail cutoff) ────────────
describe('Pickup/Delivery Planning & Scheduling', () => {
  it('please advise loaddate → pickup_delivery', () => {
    const result = classify('please advise load date for container TCKU1234567');
    expect(result).not.toBeNull();
    expect(['pickup_delivery', 'scheduling']).toContain(result!.issueId);
  });

  it('please advise loading date → pickup_delivery', () => {
    const result = classify('can you please advise the loading date for this shipment');
    expect(result).not.toBeNull();
    expect(['pickup_delivery', 'scheduling']).toContain(result!.issueId);
  });

  it('rail cut off → closing_time', () => {
    const result = classify('rail cut off is today at 14:00 — please confirm');
    expect(result).not.toBeNull();
    expect(['closing_time', 'scheduling']).toContain(result!.issueId);
  });

  it('missed vessel cutoff → closing_time', () => {
    const result = classify('we missed the vessel cutoff — sailed without our container');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('closing_time');
  });
});

// ─── 8. Capacity / Feasibility ───────────────────────────────────
describe('Capacity / Feasibility', () => {
  it('feasibility check → capacity', () => {
    const result = classify('please do a feasibility check for this shipment');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
  });

  it('no capacity available → capacity / missing', () => {
    const result = classify('no capacity available for this date — fully booked');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
    expect(result!.state).toBe('missing');
  });
});

// ─── 9. FALSE-POSITIVE regression checks ─────────────────────────
describe('False-positive regression: transport order must NOT land in load_ref', () => {
  it('detectsTransportOrder catches transport order phrasing', () => {
    expect(detectsTransportOrder('please send us the transport order for BL MAEU262065895')).toBe(true);
    expect(detectsTransportOrder('missing transport order MAEU262065895')).toBe(true);
    expect(detectsTransportOrder('transport order not received')).toBe(true);
  });

  it('detectsTransportOrder does NOT fire on plain load ref text', () => {
    expect(detectsTransportOrder('please provide load ref')).toBe(false);
    expect(detectsTransportOrder('load ref missing')).toBe(false);
    expect(detectsTransportOrder('ref no BKG1234')).toBe(false);
  });
});

describe('False-positive regression: provided-ref body must NOT classify as missing', () => {
  it('isLoadRefFalsePositive flags miss-classified provided refs', () => {
    // Body provides ref — state=missing is wrong
    expect(isLoadRefFalsePositive('load_ref', 'missing', 'Please find below load ref BKG12345')).toBe(true);
    expect(isLoadRefFalsePositive('load_ref', 'missing', 'Ref no BKG99001 — please use this')).toBe(true);
  });

  it('isLoadRefFalsePositive does NOT fire when state is already provided', () => {
    expect(isLoadRefFalsePositive('load_ref', 'provided', 'See below load ref BKG12345')).toBe(false);
  });

  it('isLoadRefFalsePositive does NOT fire on non-load_ref issues', () => {
    expect(isLoadRefFalsePositive('delay', 'delayed', 'driver not arrived')).toBe(false);
  });
});

// ─── 10. Customer hygiene: sentence fragments must be blocked ─────
describe('Customer hygiene: sentence fragments', () => {
  const fragments = [
    'did not forward the customs documents to',
    'This is an automatically generated E-mail',
    'Portal.',
    'please advise on the status of the shipment as soon as possible',
    'not be able to load due to capacity constraints at the terminal',
  ];

  for (const text of fragments) {
    it(`isSentenceFragment blocks: "${text.slice(0, 60)}"`, () => {
      expect(isSentenceFragment(text)).toBe(true);
    });
  }

  const realNames = [
    'BASF SE',
    'Maersk Line',
    'Rhenus Logistics GmbH',
    'Henkel AG & Co. KGaA',
  ];

  for (const name of realNames) {
    it(`isSentenceFragment allows real company: "${name}"`, () => {
      expect(isSentenceFragment(name)).toBe(false);
    });
  }
});

// ─── 11. PROVIDED_REF_PATTERNS completeness ───────────────────────
describe('PROVIDED_REF_PATTERNS coverage', () => {
  const shouldMatch = [
    'ref is BKG12345',
    'load ref: BKG12345',
    'see below load ref',
    'find below the reference',
    'please find below ref BKG99',
    'attached herewith reference BKG001',
    'reference no BKG1234',
    'ref no. ABC123',
    'correct ref is BKG456',
    'correct load ref BKG456',
    'updated ref BKG789',
    'load ref confirmed',
    'ref has been updated',
    'ref has been provided',
    'the load ref is BKG123',
    'load ref below',
    'below is the load ref',
  ];

  for (const text of shouldMatch) {
    it(`matches: "${text}"`, () => {
      const matched = PROVIDED_REF_PATTERNS.some(p => p.test(text));
      expect(matched).toBe(true);
    });
  }

  const shouldNotMatch = [
    'please provide load ref',
    'load ref missing',
    'waiting for load ref',
    'we need the load reference',
  ];

  for (const text of shouldNotMatch) {
    it(`does NOT match (ref is missing, not provided): "${text}"`, () => {
      const matched = PROVIDED_REF_PATTERNS.some(p => p.test(text));
      expect(matched).toBe(false);
    });
  }
});

// ─── 12. Delay detection ─────────────────────────────────────────
describe('Delay / Not On Time', () => {
  it('driver not arrived → delay / delayed', () => {
    const result = classify('driver has not arrived — still waiting for collection');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('delay');
  });

  it('not on time → delay', () => {
    const result = classify('delivery is not on time — expected yesterday');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('delay');
  });
});

// ─── 13. B/L detection ───────────────────────────────────────────
describe('Bill of Lading', () => {
  it('bl not received → bl / missing', () => {
    const result = classify('original bill of lading not received — urgent');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('bl');
    expect(result!.state).toBe('missing');
  });

  it('telex release → bl', () => {
    const result = classify('please arrange telex release for this shipment');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('bl');
  });
});

// ─── 14. Strict load_ref gate: validateLoadRefMissing ─────────────
//
// These tests validate the strict missing-load-reference gate directly.
// Every "positive" case must have an explicit missing-ref phrase or a
// load-ref keyword in proximity to a strict missing indicator.
// Every "negative" case must be rejected — planning/booking/feasibility
// context is not sufficient to trigger Missing Load Reference.
// ─────────────────────────────────────────────────────────────────

describe('validateLoadRefMissing — must accept explicit missing-ref cases', () => {
  const validCases: Array<{ desc: string; subject: string; description: string; isr: string }> = [
    {
      desc: 'please provide load ref in description',
      subject: '', description: 'please provide load ref for this shipment', isr: '',
    },
    {
      desc: 'load ref not provided in description',
      subject: '', description: 'load ref not provided by the customer', isr: '',
    },
    {
      desc: 'please add load reference in description',
      subject: '', description: 'please add load reference to the booking', isr: '',
    },
    {
      desc: 'load reference missing in description',
      subject: '', description: 'load reference missing — cannot process without it', isr: '',
    },
    {
      desc: 'missing load ref in subject only',
      subject: 'Missing Load Ref — BL MAEU123', description: '', isr: '',
    },
    {
      desc: 'please provide load ref in subject',
      subject: 'Please provide load ref', description: 'Kindly advise on the booking.', isr: '',
    },
    {
      desc: 'load ref not received in ISR',
      subject: '', description: '', isr: 'load ref not received from shipper',
    },
    {
      desc: 'proximity: load ref + we need in description',
      subject: '', description: 'We need the load ref for this container as soon as possible.', isr: '',
    },
    {
      desc: 'proximity: load reference + required in description',
      subject: '', description: 'The load reference is required before the booking can proceed.', isr: '',
    },
    {
      desc: 'proximity: booking ref + not provided in description',
      subject: '', description: 'The booking ref has not been provided for this shipment.', isr: '',
    },
  ];

  for (const { desc, subject, description, isr } of validCases) {
    it(`accepts: ${desc}`, () => {
      const result = validateLoadRefMissing(subject, description, isr);
      expect(result.valid, `Expected valid but got: ${result.rejectReason}`).toBe(true);
      expect(result.triggerPhrase).not.toBeNull();
    });
  }
});

describe('validateLoadRefMissing — must reject planning/feasibility/booking context', () => {
  const invalidCases: Array<{ desc: string; subject: string; description: string; isr: string }> = [
    {
      desc: 'rail cut off query with booking reference',
      subject: 'Could you please advise rail cut off',
      description: 'Could you please advise rail cut off for booking reference BKG12345',
      isr: '',
    },
    {
      desc: 'intermodal feasibility with booking reference',
      subject: 'Kindly advise intermodal feasibility',
      description: 'Kindly advise intermodal feasibility for booking reference BKG12345 on 15 March.',
      isr: '',
    },
    {
      desc: 'loading feasibility request',
      subject: 'Loading feasibility',
      description: 'We would like to request loading feasibility for booking reference ABC789.',
      isr: '',
    },
    {
      desc: 'capacity request with booking ref',
      subject: 'Capacity request',
      description: 'Could you advise on capacity for booking reference XYZ001?',
      isr: '',
    },
    {
      desc: 'advise load date — planning context',
      subject: 'Please advise load date',
      description: 'Please advise load date for booking reference BKG5678.',
      isr: '',
    },
    {
      desc: 'generic booking ref mention — no missing signal',
      subject: 'Booking reference update',
      description: 'Please find attached the booking confirmation. Booking reference: BKG9999.',
      isr: '',
    },
    {
      desc: 'generic reference mention — could you advise',
      subject: 'Could you please advise',
      description: 'Could you please advise on the reference number for this shipment?',
      isr: '',
    },
  ];

  for (const { desc, subject, description, isr } of invalidCases) {
    it(`rejects: ${desc}`, () => {
      const result = validateLoadRefMissing(subject, description, isr);
      expect(result.valid, `Expected invalid but got triggerPhrase: ${result.triggerPhrase}`).toBe(false);
      expect(result.rejectReason).not.toBeNull();
    });
  }
});

// ─── 15. Signal precision: planning emails must NOT top-rank as load_ref ─
//
// With the narrowed strongSignals, planning text with booking references
// must NOT have load_ref as the highest-confidence classifyByRules result.
// ─────────────────────────────────────────────────────────────────

// Signal precision at classifyByRules level:
// Tests in this block only cover cases where one topic is CLEARLY stronger
// (strong signal vs weak signal). For tie-breaker cases where both topics fire
// at equal weak-signal confidence (e.g. "feasibility" vs "booking reference"),
// the protection comes from validateLoadRefMissing in classifyCase.ts — those
// cases are covered by test block 14 (validateLoadRefMissing reject cases).
describe('Signal precision: planning/rail/feasibility text must not be top load_ref', () => {
  it('rail cut off query with booking ref: closing_time strong (0.95) beats load_ref weak (0.65)', () => {
    // closing_time strongSignal "cut off" fires at 0.95; load_ref weakSignal "booking reference"
    // fires at 0.65. Strong clearly beats weak → closing_time wins at classifyByRules level.
    const result = classify('Could you please advise rail cut off for booking reference BKG12345');
    expect(result).not.toBeNull();
    expect(result!.issueId).not.toBe('load_ref');
    expect(result!.issueId).toBe('closing_time');
  });

  it('no capacity available with booking ref: capacity strong beats load_ref weak', () => {
    // capacity strongSignal "no capacity" fires at 0.85+0.10=0.95;
    // load_ref weakSignal "booking reference" at 0.65 — capacity clearly wins.
    const result = classify('No capacity available for booking reference BKG12345 — fully booked');
    expect(result).not.toBeNull();
    expect(result!.issueId).not.toBe('load_ref');
    expect(result!.issueId).toBe('capacity');
  });

  it('not feasible with booking ref: capacity strong beats load_ref weak', () => {
    const result = classify('Not feasible to accommodate booking reference BKG789 — already fully booked');
    expect(result).not.toBeNull();
    expect(result!.issueId).not.toBe('load_ref');
    expect(result!.issueId).toBe('capacity');
  });

  it('load date advisory → top result is pickup_delivery, not load_ref', () => {
    // No "booking reference" keyword — only "load date" weakSignal fires for pickup_delivery.
    const result = classify('Please advise load date for this shipment');
    expect(result).not.toBeNull();
    expect(result!.issueId).not.toBe('load_ref');
  });

  it('intermodal feasibility alone (no booking ref) → capacity, not load_ref', () => {
    // No load_ref signals at all — capacity weakSignal "feasibility" alone.
    const result = classify('Kindly advise intermodal feasibility for this route');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
  });

  it('loading feasibility alone (no booking ref) → capacity, not load_ref', () => {
    const result = classify('Loading feasibility check required');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
  });
});

// ─── 16. LOAD_REF_EXPLICIT_MISSING coverage ───────────────────────
//
// Every phrase in LOAD_REF_EXPLICIT_MISSING must fire validateLoadRefMissing.
// ─────────────────────────────────────────────────────────────────

describe('LOAD_REF_EXPLICIT_MISSING — each phrase must validate as accepted', () => {
  for (const phrase of LOAD_REF_EXPLICIT_MISSING) {
    it(`accepts phrase: "${phrase}"`, () => {
      // Some phrases are substrings of others in the list (e.g. "missing booking ref"
      // is a prefix of "missing booking reference"). The trigger returned may be the
      // shorter matching phrase — what matters is valid=true and a non-null trigger.
      const result = validateLoadRefMissing('', phrase, '');
      expect(result.valid, `Phrase not accepted: "${phrase}"`).toBe(true);
      expect(result.triggerPhrase, `No trigger phrase for: "${phrase}"`).not.toBeNull();
    });
  }
});
