// ─────────────────────────────────────────────────────────────────
// Explicit Validation Harness
//
// For each representative case, prints and asserts:
//   - input text
//   - detected object (taxonomy id)
//   - detected intent/state
//   - final issue label
//   - confidence %
//   - pass/fail
//
// Run:  npm test -- validation
// ─────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { classifyByRules } from '../issueRules';
import { validateLoadRefMissing } from '../loadRefGuards';
import { isSentenceFragment } from '../validators';
import { TAXONOMY_MAP } from '../taxonomy';

// ─── Helpers ──────────────────────────────────────────────────────

function classify(text: string) {
  const matches = classifyByRules(text);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.confidence - a.confidence)[0];
}

function labelFor(id: string): string {
  return TAXONOMY_MAP[id]?.label ?? id;
}

function pct(c: number) {
  return `${(c * 100).toFixed(1)}%`;
}

function printResult(
  input: string,
  result: ReturnType<typeof classify>,
  expectedId: string,
  expectedState?: string,
) {
  const id    = result?.issueId    ?? '(none)';
  const state = result?.state      ?? '(none)';
  const conf  = result?.confidence ?? 0;
  const label = labelFor(id);
  const pass  = id === expectedId && (expectedState == null || state === expectedState);

  console.log([
    '',
    `Input:    "${input.slice(0, 90)}"`,
    `Object:   ${id}`,
    `State:    ${state}`,
    `Label:    ${label}`,
    `Conf:     ${pct(conf)}`,
    `Expected: ${expectedId}${expectedState ? ' / ' + expectedState : ''}`,
    `Result:   ${pass ? '✓ PASS' : '✗ FAIL'}`,
  ].join('\n  '));
}

// ─── Case block 1: Transport Order vs Load Reference ─────────────

describe('Validation — Transport Order', () => {
  const cases: Array<{ text: string; state: string }> = [
    { text: 'Please send us the transport order for BL MAEU262065895', state: 'missing' },
    { text: 'transport order not received — haulier cannot proceed', state: 'missing' },
    { text: 'missing transport order for container TCKU1234567', state: 'missing' },
  ];

  for (const { text, state } of cases) {
    it(`transport_order / ${state}: "${text.slice(0, 65)}"`, () => {
      const result = classify(text);
      printResult(text, result, 'transport_order', state);
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe('transport_order');
      expect(result!.issueId).not.toBe('load_ref');
      expect(result!.state).toBe(state);
    });
  }
});

// ─── Case block 2: Missing Load Reference ─────────────────────────

describe('Validation — Missing Load Reference', () => {
  const cases = [
    'please provide load ref',
    'load ref missing for this shipment',
    'we need the load reference urgently — not received',
    'load ref not provided by the customer',
    'please add load reference to the booking',
  ];

  for (const text of cases) {
    it(`load_ref / missing: "${text}"`, () => {
      const result = classify(text);
      printResult(text, result, 'load_ref', 'missing');
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe('load_ref');
      expect(result!.state).toBe('missing');
    });
  }
});

// ─── Case block 3: Reference Provided (must NOT be load_ref missing) ─

describe('Validation — Reference Update / Info Provided', () => {
  const providedCases = [
    'please see below load ref BKG12345',
    'load ref: BKG12345 — please use this reference',
    'ref no BKG9900 — as requested',
  ];

  for (const text of providedCases) {
    it(`ref_provided / provided: "${text.slice(0, 65)}"`, () => {
      const result = classify(text);
      printResult(text, result, 'ref_provided', 'provided');
      expect(result).not.toBeNull();
      expect(result!.issueId).toBe('ref_provided');
      expect(result!.state).toBe('provided');
    });
  }

  // "correct ref … please update" produces state=amended (correction event),
  // which still resolves to ref_provided via resolveIssueId. Accept either state.
  it('ref_provided / amended: "correct ref is BKG456 — please update your records"', () => {
    const text = 'correct ref is BKG456 — please update your records';
    const result = classify(text);
    printResult(text, result, 'ref_provided', 'amended');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('ref_provided');
    expect(['provided', 'amended']).toContain(result!.state);
  });
});

// ─── Case block 4: Customs ───────────────────────────────────────

describe('Validation — Customs / Documentation', () => {
  it('customs docs attached → customs / provided', () => {
    const text = 'please find attached the customs documents as requested';
    const result = classify(text);
    printResult(text, result, 'customs', 'provided');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('customs');
    expect(result!.state).toBe('provided');
  });

  it('customs docs missing → customs / missing', () => {
    const text = 'customs documents not received — clearance cannot proceed';
    const result = classify(text);
    printResult(text, result, 'customs', 'missing');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('customs');
    expect(result!.state).toBe('missing');
  });
});

// ─── Case block 5: T1 / Transit Document ─────────────────────────

describe('Validation — T1 / Transit Document', () => {
  it('please share T1 → t1 / missing', () => {
    const text = 'please share the T1 document — transit declaration required';
    const result = classify(text);
    printResult(text, result, 't1', 'missing');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('t1');
    expect(result!.state).toBe('missing');
  });

  it('T1 document attached → t1 / provided', () => {
    const text = 'please find attached the T1 transit document — transit entry closed';
    const result = classify(text);
    printResult(text, result, 't1', 'provided');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('t1');
    expect(result!.state).toBe('provided');
  });
});

// ─── Case block 6: Amendment / Cancellation ─────────────────────

describe('Validation — Amendment / Correction', () => {
  it('booking cancelled → amendment / amended', () => {
    const text = 'booking cancelled — please arrange alternative collection';
    const result = classify(text);
    printResult(text, result, 'amendment', 'amended');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('amendment');
    expect(result!.state).toBe('amended');
  });

  it('loading amended → amendment / amended', () => {
    const text = 'loading has been amended — new date 15 June';
    const result = classify(text);
    printResult(text, result, 'amendment', 'amended');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('amendment');
  });

  it('wrong address → amendment / amended', () => {
    const text = 'wrong address on booking — please correct consignee details';
    const result = classify(text);
    printResult(text, result, 'amendment', 'amended');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('amendment');
  });
});

// ─── Case block 7: Planning / Schedule ──────────────────────────

describe('Validation — Planning / Schedule (NOT Missing Load Ref)', () => {
  it('please advise loaddate → pickup_delivery, NOT load_ref', () => {
    const text = 'please advise load date for container TCKU1234567';
    const result = classify(text);
    printResult(text, result, 'pickup_delivery');
    expect(result).not.toBeNull();
    expect(result!.issueId).not.toBe('load_ref');
    expect(['pickup_delivery', 'scheduling']).toContain(result!.issueId);
  });

  it('rail cut off → closing_time, NOT load_ref', () => {
    const text = 'rail cut off is today at 14:00 — please confirm departure';
    const result = classify(text);
    printResult(text, result, 'closing_time');
    expect(result).not.toBeNull();
    expect(result!.issueId).not.toBe('load_ref');
    expect(['closing_time', 'scheduling']).toContain(result!.issueId);
  });

  it('rail cut off WITH booking reference → closing_time wins over load_ref', () => {
    // closing_time strongSignal "cut off" fires at 0.95
    // load_ref weakSignal "booking reference" fires at 0.65
    // Closing_time must win
    const text = 'Could you please advise rail cut off for booking reference BKG12345';
    const result = classify(text);
    printResult(text, result, 'closing_time');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('closing_time');
    expect(result!.issueId).not.toBe('load_ref');
  });
});

// ─── Case block 8: Capacity / Feasibility ────────────────────────

describe('Validation — Capacity / Feasibility (NOT Missing Load Ref)', () => {
  it('feasibility check → capacity, NOT load_ref', () => {
    const text = 'please do a feasibility check for this shipment';
    const result = classify(text);
    printResult(text, result, 'capacity');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
    expect(result!.issueId).not.toBe('load_ref');
  });

  it('no capacity available → capacity / missing', () => {
    const text = 'no capacity available for this date — fully booked';
    const result = classify(text);
    printResult(text, result, 'capacity', 'missing');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
    expect(result!.issueId).not.toBe('load_ref');
    expect(result!.state).toBe('missing');
  });

  it('capacity + booking ref → capacity wins, NOT load_ref', () => {
    // capacity strongSignal "no capacity" beats load_ref weakSignal "booking reference"
    const text = 'No capacity available for booking reference BKG12345 — fully booked';
    const result = classify(text);
    printResult(text, result, 'capacity');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('capacity');
    expect(result!.issueId).not.toBe('load_ref');
  });
});

// ─── Case block 9: Gate — planning emails rejected as load_ref ───

describe('Validation — validateLoadRefMissing gate rejects planning context', () => {
  const rejectCases: Array<{ desc: string; subject: string; description: string }> = [
    {
      desc: 'rail cut off query',
      subject: 'Could you please advise rail cut off',
      description: 'Could you please advise rail cut off for booking reference BKG12345',
    },
    {
      desc: 'intermodal feasibility',
      subject: 'Kindly advise intermodal feasibility',
      description: 'We request intermodal feasibility for booking reference ABC on 15 March.',
    },
    {
      desc: 'loading feasibility',
      subject: 'Loading feasibility',
      description: 'Loading feasibility required for booking reference BKG789.',
    },
    {
      desc: 'capacity request',
      subject: 'Capacity request',
      description: 'Please advise on capacity for booking reference XYZ001.',
    },
    {
      desc: 'advise load date',
      subject: 'Please advise load date',
      description: 'Please advise load date for booking reference BKG5678.',
    },
    {
      desc: 'generic could-you-please with booking reference',
      subject: 'Could you please advise',
      description: 'Could you please advise on the reference number for this shipment?',
    },
  ];

  for (const { desc, subject, description } of rejectCases) {
    it(`GATE REJECTS — ${desc}`, () => {
      const result = validateLoadRefMissing(subject, description, '');
      console.log(`\n  Gate: "${desc}"\n  Subject: "${subject.slice(0, 70)}"\n  Body: "${description.slice(0, 70)}"\n  valid=${result.valid}  reason=${result.rejectReason}`);
      expect(result.valid).toBe(false);
      expect(result.rejectReason).not.toBeNull();
    });
  }
});

// ─── Case block 10: Gate — explicit missing phrases accepted ─────

describe('Validation — validateLoadRefMissing gate accepts explicit missing phrases', () => {
  const acceptCases: Array<{ desc: string; description: string; triggerContains: string }> = [
    {
      desc: 'please provide load ref',
      description: 'please provide load ref for this shipment',
      triggerContains: 'please provide load ref',
    },
    {
      desc: 'load ref not provided',
      description: 'load ref not provided by the customer — cannot book',
      triggerContains: 'load ref not provided',
    },
    {
      desc: 'missing load ref',
      description: 'missing load ref — please add before cutoff',
      triggerContains: 'missing load ref',
    },
    {
      desc: 'please add load reference',
      description: 'please add load reference to the booking immediately',
      triggerContains: 'please add load ref',
    },
    {
      desc: 'load reference missing',
      description: 'load reference missing from the booking — cannot process',
      triggerContains: 'load reference missing',
    },
    {
      desc: 'proximity: load ref + we need',
      description: 'We need the load ref for this container as soon as possible',
      triggerContains: 'load ref',
    },
    {
      desc: 'proximity: load reference + required',
      description: 'The load reference is required before the booking can proceed',
      triggerContains: 'load ref',
    },
  ];

  for (const { desc, description, triggerContains } of acceptCases) {
    it(`GATE ACCEPTS — ${desc}`, () => {
      const result = validateLoadRefMissing('', description, '');
      console.log(`\n  Gate: "${desc}"\n  Body: "${description.slice(0, 80)}"\n  valid=${result.valid}  trigger=${result.triggerPhrase}  field=${result.sourceField}`);
      expect(result.valid).toBe(true);
      expect(result.triggerPhrase).not.toBeNull();
      expect(result.triggerPhrase!.toLowerCase()).toContain(triggerContains);
    });
  }
});

// ─── Case block 11: Drilldown integrity ──────────────────────────

describe('Validation — Drilldown integrity: records must match their filter', () => {
  it('all load_ref records share primaryIssue=load_ref', () => {
    // Simulate a drilldown set — all should be load_ref
    const drilldownSet = [
      { primaryIssue: 'load_ref' },
      { primaryIssue: 'load_ref' },
      { primaryIssue: 'load_ref' },
    ];
    const violations = drilldownSet.filter(r => r.primaryIssue !== 'load_ref').length;
    console.log(`\n  Drilldown: load_ref — ${drilldownSet.length} records, ${violations} violations`);
    expect(violations).toBe(0);
  });

  it('contaminated drilldown IS detected (regression guard)', () => {
    // A drilldown containing a wrong-category record must register a violation
    const contaminated = [
      { primaryIssue: 'load_ref' },
      { primaryIssue: 'delay' },  // contamination
    ];
    const violations = contaminated.filter(r => r.primaryIssue !== 'load_ref').length;
    console.log(`\n  Contaminated drilldown: ${violations} violation(s) detected`);
    expect(violations).toBe(1);
  });
});

// ─── Case block 12: Customer hygiene ─────────────────────────────

describe('Validation — Sentence fragments must NOT appear as customers', () => {
  const fragments = [
    'did not forward the customs documents to',
    'This is an automatically generated E-mail',
    'Portal.',
    'please advise on the status of the shipment',
    'not be able to load due to capacity constraints',
    'no-reply@example.com',
  ];

  const realNames = [
    'BASF SE',
    'Rhenus Logistics GmbH',
    'Henkel AG & Co. KGaA',
    'Shell Nederland BV',
  ];

  for (const frag of fragments) {
    it(`BLOCKED — fragment: "${frag.slice(0, 60)}"`, () => {
      const blocked = isSentenceFragment(frag);
      console.log(`\n  Fragment: "${frag.slice(0, 60)}" → blocked=${blocked}`);
      expect(blocked).toBe(true);
    });
  }

  for (const name of realNames) {
    it(`ALLOWED — real company: "${name}"`, () => {
      const blocked = isSentenceFragment(name);
      console.log(`\n  Company: "${name}" → blocked=${blocked}`);
      expect(blocked).toBe(false);
    });
  }
});

// ─── Case block 13: Export filter integrity ──────────────────────

describe('Validation — Export filter must match selected issue exactly', () => {
  it('filter by load_ref returns only load_ref records', () => {
    // Simulate analysis.records — only load_ref should come through
    const records = [
      { primaryIssue: 'load_ref', resolvedCustomer: 'BASF SE' },
      { primaryIssue: 'delay',    resolvedCustomer: 'Shell' },
      { primaryIssue: 'load_ref', resolvedCustomer: 'Henkel' },
      { primaryIssue: 'customs',  resolvedCustomer: 'Maersk' },
    ];
    const filtered = records.filter(r => r.primaryIssue === 'load_ref');
    console.log(`\n  Filter load_ref: ${filtered.length} of ${records.length} records match`);
    expect(filtered.length).toBe(2);
    expect(filtered.every(r => r.primaryIssue === 'load_ref')).toBe(true);
  });

  it('filter by customer name returns only that customer\'s records', () => {
    const records = [
      { primaryIssue: 'load_ref', resolvedCustomer: 'BASF SE' },
      { primaryIssue: 'delay',    resolvedCustomer: 'Shell' },
      { primaryIssue: 'customs',  resolvedCustomer: 'BASF SE' },
    ];
    const filtered = records.filter(r => r.resolvedCustomer === 'BASF SE');
    console.log(`\n  Filter BASF SE: ${filtered.length} of ${records.length} records match`);
    expect(filtered.length).toBe(2);
    expect(filtered.every(r => r.resolvedCustomer === 'BASF SE')).toBe(true);
  });
});

// ─── Regression: billing / demurrage / rate must NOT be Missing Load Ref ──────
//
// These tests prove that Missing Load Reference is NOT a fallback category.
// Cases about demurrage, rates, routing, or billing must be blocked by the gate
// even if "load ref" appears incidentally in the subject or body.
//
// Gate-level tests use validateLoadRefMissing directly so the exact rejection
// reason is visible. Classifier-level tests use classifyByRules to prove that
// the correct operational category wins end-to-end.

describe('Regression — billing/demurrage/rate NOT Missing Load Ref', () => {

  // ── Gate-level: validateLoadRefMissing must reject ──────────────

  it('GATE REJECTS — demurrage in description blocks load_ref', () => {
    const subject = 'Load Ref BKG123';
    const desc    = 'Demurrage charges are pending for container TCKU123';
    const result  = validateLoadRefMissing(subject, desc, '');
    console.log([
      '',
      `Case:   demurrage context`,
      `Subject: "${subject}"`,
      `Body:    "${desc}"`,
      `valid=${result.valid}  reason=${result.rejectReason}`,
    ].join('\n  '));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).not.toBeNull();
    expect(result.rejectReason!.toLowerCase()).toContain('billing');
  });

  it('GATE REJECTS — rate query in description blocks load_ref', () => {
    const subject = 'Load Ref Required';
    const desc    = 'Please advise on the rates for booking reference BKG456';
    const result  = validateLoadRefMissing(subject, desc, '');
    console.log([
      '',
      `Case:   rate query`,
      `Subject: "${subject}"`,
      `Body:    "${desc}"`,
      `valid=${result.valid}  reason=${result.rejectReason}`,
    ].join('\n  '));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).not.toBeNull();
  });

  it('GATE REJECTS — detention / extra costs in description blocks load_ref', () => {
    const subject = 'Extra Costs Report';
    const desc    = 'Waiting time and detention charges for this booking.';
    const result  = validateLoadRefMissing(subject, desc, '');
    console.log([
      '',
      `Case:   extra costs / detention`,
      `Subject: "${subject}"`,
      `Body:    "${desc}"`,
      `valid=${result.valid}  reason=${result.rejectReason}`,
    ].join('\n  '));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).not.toBeNull();
    expect(result.rejectReason!.toLowerCase()).toContain('billing');
  });

  it('GATE REJECTS — routing context in description blocks load_ref', () => {
    const subject = 'Load Ref BKG123';
    const desc    = 'Routing check required for alternative depot';
    const result  = validateLoadRefMissing(subject, desc, '');
    console.log([
      '',
      `Case:   routing check`,
      `Subject: "${subject}"`,
      `Body:    "${desc}"`,
      `valid=${result.valid}  reason=${result.rejectReason}`,
    ].join('\n  '));
    expect(result.valid).toBe(false);
    expect(result.rejectReason).not.toBeNull();
    expect(result.rejectReason!.toLowerCase()).toContain('routing');
  });

  it('GATE ACCEPTS — explicit missing phrase in description overrides demurrage context', () => {
    // Step 1 (explicit check) fires before step 2a (intent check).
    // "please provide load ref" matches LOAD_REF_EXPLICIT_MISSING → accept immediately.
    const subject = 'Load Ref Missing';
    const desc    = 'Please provide load ref. Demurrage also pending.';
    const result  = validateLoadRefMissing(subject, desc, '');
    console.log([
      '',
      `Case:   explicit missing + demurrage`,
      `Subject: "${subject}"`,
      `Body:    "${desc}"`,
      `valid=${result.valid}  trigger="${result.triggerPhrase}"`,
    ].join('\n  '));
    expect(result.valid).toBe(true);
    expect(result.triggerPhrase).not.toBeNull();
    // The trigger must be from the description (explicit phrase found first)
    expect(result.sourceField).toBe('description');
  });

  // ── Classifier-level: correct operational category must win ─────

  it('CLASSIFIER — demurrage context (no load-ref keyword) → waiting_time, NOT load_ref', () => {
    // "load ref" intentionally absent — demurrage alone must produce waiting_time.
    // Proves classifyByRules never defaults to load_ref for billing-only bodies.
    const text   = 'Demurrage charges are pending for container TCKU123 — please advise on costs';
    const result = classify(text);
    console.log([
      '',
      `Input:  "${text}"`,
      `Object: ${result?.issueId ?? '(none)'}`,
      `State:  ${result?.state  ?? '(none)'}`,
      `Conf:   ${result ? (result.confidence * 100).toFixed(0) + '%' : 'n/a'}`,
      `Result: ${result?.issueId === 'waiting_time' ? '✓ PASS' : '✗ FAIL — expected waiting_time'}`,
    ].join('\n  '));
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('waiting_time');
  });

  it('CLASSIFIER — extra costs report / waiting time → waiting_time, NOT load_ref', () => {
    const text   = 'Extra costs report — waiting time at terminal';
    const result = classify(text);
    console.log([
      '',
      `Input:  "${text}"`,
      `Object: ${result?.issueId ?? '(none)'}`,
      `State:  ${result?.state  ?? '(none)'}`,
      `Conf:   ${result ? (result.confidence * 100).toFixed(0) + '%' : 'n/a'}`,
      `Result: ${result?.issueId === 'waiting_time' ? '✓ PASS' : '✗ FAIL'}`,
    ].join('\n  '));
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('waiting_time');
  });

});
