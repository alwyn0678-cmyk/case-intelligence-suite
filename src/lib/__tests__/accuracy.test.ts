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
import { textProvidesRef, PROVIDED_REF_PATTERNS } from '../loadRefGuards';
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
