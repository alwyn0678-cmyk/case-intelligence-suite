// ─────────────────────────────────────────────────────────────────
// Classifier Precision Regression Tests
//
// Focused tests for the specific failure patterns that were causing
// incorrect classifications in production.
//
// Run:  npm test -- classifyPrecision
// ─────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { classifyByRules } from '../issueRules';
import { classifyCase } from '../classifyCase';
import type { NormalisedRecord } from '../../types';
import {
  validateFinancialFalseNegative,
  validatePlanningDocFalsePositive,
  validateEquipmentFalseReference,
  validateTransportOrderFalseLoadRef,
  validateRefCategoryOveruse,
  validateWeekRangeInData,
} from '../validators';

// ── Pipeline helper ───────────────────────────────────────────────
function pipeline(
  description: string,
  subject = '',
  isr_details = '',
  customer = '',
) {
  const record: NormalisedRecord = {
    subject,
    description,
    isr_details,
    customer,
    _raw: {},
  };
  return classifyCase(record);
}

// ── Rule-level helper ─────────────────────────────────────────────
function classify(text: string) {
  const matches = classifyByRules(text);
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.confidence - a.confidence)[0];
}

// ─── 1. Price correction under transport-order subject ────────────
describe('Precision — Rate overrides transport-order subject', () => {
  it('price correction email with transport order subject → rate', () => {
    const result = pipeline(
      'Please see the corrected invoice attached. There is a price correction required for the additional charge of €450. The wrong rate was applied to this shipment.',
      'Transport Order - Price Correction Required',
    );
    expect(result.primaryIssue).toBe('rate');
    expect(result.primaryIssue).not.toBe('transport_order');
    expect(result.primaryIssue).not.toBe('load_ref');
  });
});

// ─── 2. Work order missing → Transport Order Request ─────────────
describe('Precision — Work order must classify as transport_order', () => {
  it('workorder still missing, please send order → transport_order', () => {
    const result = pipeline(
      'The work order is still missing. Please send the work order to the driver as soon as possible. The haulier cannot proceed without it.',
      'Work Order Missing',
    );
    expect(result.primaryIssue).toBe('transport_order');
    expect(result.primaryIssue).not.toBe('load_ref');
  });

  it('workorder (single word) missing → transport_order', () => {
    const result = classify('workorder not received — driver needs this before departure');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('transport_order');
    expect(result!.issueId).not.toBe('load_ref');
  });

  it('work order request with explicit send language → transport_order', () => {
    const result = classify('Please send the work order for this shipment to XPO Logistics');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('transport_order');
  });
});

// ─── 3. "Do we need load ref?" — question form must NOT be load_ref
describe('Precision — Inquiry about load ref must NOT be load_ref (missing)', () => {
  it('"do we need load ref for this" → NOT load_ref (missing)', () => {
    const result = pipeline(
      'Do we need load ref for this shipment? Please advise if a load reference number is required for booking.',
      'Load ref required?',
    );
    // Should NOT be load_ref (missing) — this is a question, not a missing-ref case
    expect(result.primaryIssue).not.toBe('load_ref');
  });
});

// ─── 4. Load ref genuinely missing → load_ref ────────────────────
describe('Precision — Genuine missing load ref must classify correctly', () => {
  it('"missing load ref, please provide" → load_ref (missing)', () => {
    const result = pipeline(
      'The load ref is missing. Please provide the load reference for this booking.',
      'Missing Load Reference',
    );
    expect(result.primaryIssue).toBe('load_ref');
    expect(result.issueState).toBe('missing');
  });

  it('"load ref not provided by customer" → load_ref (missing)', () => {
    const result = pipeline(
      'Load ref has not been provided by the customer. We need the load reference to proceed with this shipment.',
      'Load Ref Missing',
    );
    expect(result.primaryIssue).toBe('load_ref');
    expect(result.issueState).toBe('missing');
  });
});

// ─── 5. "Load ref: ABC12345" → ref_provided, NOT missing ─────────
describe('Precision — Load ref value present must not be load_ref (missing)', () => {
  it('"Load ref: BKG12345" → ref_provided', () => {
    const result = pipeline(
      'Please use the following load reference: BKG12345. The load ref: BKG12345 is confirmed.',
      'Load Ref: BKG12345',
    );
    expect(result.primaryIssue).toBe('ref_provided');
    expect(result.primaryIssue).not.toBe('load_ref');
  });

  it('"see below load ref BKG99001" → ref_provided', () => {
    const result = classify('please see below load ref BKG99001');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('ref_provided');
  });
});

// ─── 6. T1/customs documents forwarded by CX → NOT missing doc ───
describe('Precision — CX-provided docs must NOT be missing-doc classification', () => {
  it('"please find attached T1" → NOT t1 (missing)', () => {
    const result = pipeline(
      'Please find attached the T1 document for this shipment. The transit document is enclosed as requested.',
      'T1 Document Attached',
    );
    // Should be ref_provided (document was provided), NOT t1
    expect(result.primaryIssue).toBe('ref_provided');
    expect(result.primaryIssue).not.toBe('t1');
  });

  it('"herewith customs docs" → ref_provided, NOT customs', () => {
    const result = pipeline(
      'Herewith the customs documents for this shipment. Please find the customs paperwork attached.',
      'Customs Documents Attached',
    );
    expect(result.primaryIssue).toBe('ref_provided');
    expect(result.primaryIssue).not.toBe('customs');
  });
});

// ─── 7. "Please send T1/MRN" → compliance missing (NOT ref_provided)
describe('Precision — Requesting missing docs → compliance category', () => {
  it('"please send T1 document" → t1 (missing)', () => {
    const result = pipeline(
      'The T1 document is still missing. Please send the transit document to the haulier. T1 not received.',
      'T1 Missing',
    );
    expect(result.primaryIssue).toBe('t1');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('"customs docs missing" → customs (missing)', () => {
    const result = pipeline(
      'Customs documents are missing. The driver needs customs clearance documents. MRN not provided.',
      'Customs Docs Missing',
    );
    expect(result.primaryIssue).toBe('customs');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });
});

// ─── 8. Equipment issue must NOT be ref_provided ──────────────────
describe('Precision — Equipment issue must classify as equipment', () => {
  it('"portable not ok" → equipment, NOT ref_provided', () => {
    const result = pipeline(
      'The container is portable not ok. Driver has reported that the portable is not ok and the unit is not in order for transport.',
      'Portable Not OK',
    );
    expect(result.primaryIssue).toBe('equipment');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('"container not ok, damage reported" → equipment', () => {
    const result = classify('container not ok — damage reported by depot, equipment not acceptable');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('equipment');
    expect(result!.issueId).not.toBe('ref_provided');
  });
});

// ─── 9. Planning/capacity email with booking ref → NOT load_ref ───
describe('Precision — Planning email with booking ref → planning category', () => {
  it('capacity query with booking reference → capacity, NOT load_ref', () => {
    const result = pipeline(
      'Is there capacity for this shipment? We have booking reference BKG12345 and need to know if you can accommodate this load on the planned date.',
      'Capacity Query - Booking Ref BKG12345',
    );
    expect(result.primaryIssue).not.toBe('load_ref');
    // At minimum it should NOT be load_ref or ref_provided
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('scheduling slot request with "booking ref" in subject → NOT load_ref', () => {
    const result = pipeline(
      'We would like to request a terminal slot for the following shipment. Please advise on slot availability. Booking reference BKG99001.',
      'Slot Request Booking Ref BKG99001',
    );
    expect(result.primaryIssue).not.toBe('load_ref');
  });
});

// ─── 10. Selfbilling / invoice emails → rate ──────────────────────
describe('Precision — Financial emails → rate (not delay/customs/other)', () => {
  it('selfbilling email with operational chatter → rate', () => {
    const result = pipeline(
      'Please see the selfbilling report for the week. The billing has been processed and we have included all additional charges for demurrage. The invoice covers the delay period.',
      'Selfbilling Report Week 12',
    );
    expect(result.primaryIssue).toBe('rate');
    expect(result.primaryIssue).not.toBe('delay');
    expect(result.primaryIssue).not.toBe('customs');
  });

  it('extra cost invoice must not classify as delay', () => {
    const result = pipeline(
      'Please see the attached extra cost invoice for this shipment. Additional charges have been applied and we dispute the billing amounts.',
      'Extra Cost Invoice',
    );
    expect(result.primaryIssue).toBe('rate');
    expect(result.primaryIssue).not.toBe('delay');
  });
});

// ─── 11. Validators — unit tests ─────────────────────────────────
describe('Validators — financial false-negative detection', () => {
  it('selfbilling classified as delay → isFalseNegative=true', () => {
    const result = validateFinancialFalseNegative('delay', 'selfbilling report attached for review');
    expect(result.isFalseNegative).toBe(true);
    expect(result.financialTrigger).toBe('selfbilling');
  });

  it('rate classified correctly → isFalseNegative=false', () => {
    const result = validateFinancialFalseNegative('rate', 'invoice query regarding overcharge');
    expect(result.isFalseNegative).toBe(false);
  });

  it('credit note classified as amendment → isFalseNegative=true', () => {
    const result = validateFinancialFalseNegative('amendment', 'please issue credit note for this incorrect invoice');
    expect(result.isFalseNegative).toBe(true);
    expect(result.financialTrigger).toBe('credit note');
  });
});

describe('Validators — planning/doc false-positive detection', () => {
  it('customs classified with capacity language and no doc-missing → isFalsePositive=true', () => {
    const result = validatePlanningDocFalsePositive(
      'customs',
      'Is there capacity for this load? We also need to arrange customs clearance for the container.',
    );
    expect(result.isFalsePositive).toBe(true);
    expect(result.planningTrigger).toBeTruthy();
  });

  it('customs classified with explicit missing-doc language → isFalsePositive=false', () => {
    const result = validatePlanningDocFalsePositive(
      'customs',
      'Customs documents are missing. The driver requires MRN from customs. Please send the required documentation.',
    );
    expect(result.isFalsePositive).toBe(false);
  });

  it('non-compliance topic → isFalsePositive=false', () => {
    const result = validatePlanningDocFalsePositive('delay', 'driver is late');
    expect(result.isFalsePositive).toBe(false);
  });
});

describe('Validators — equipment false reference detection', () => {
  it('portable not ok classified as ref_provided → isFalseReference=true', () => {
    const result = validateEquipmentFalseReference('ref_provided', 'portable not ok reported by driver');
    expect(result.isFalseReference).toBe(true);
    expect(result.equipmentTrigger).toBe('portable not ok');
  });

  it('equipment classified correctly → isFalseReference=false', () => {
    const result = validateEquipmentFalseReference('equipment', 'portable not ok');
    expect(result.isFalseReference).toBe(false);
  });
});

describe('Validators — transport order / load ref conflation', () => {
  it('work order classified as load_ref without missing phrase → isConflated=true', () => {
    const result = validateTransportOrderFalseLoadRef(
      'load_ref',
      'work order is still missing please send order',
    );
    expect(result.isConflated).toBe(true);
    expect(result.transportOrderTrigger).toBe('work order');
  });

  it('transport_order classified correctly → isConflated=false', () => {
    const result = validateTransportOrderFalseLoadRef(
      'transport_order',
      'work order missing',
    );
    expect(result.isConflated).toBe(false);
  });
});

describe('Validators — ref_provided overuse detection', () => {
  it('50 ref_provided out of 1000 total → isOverused=true', () => {
    const result = validateRefCategoryOveruse(50, 1000);
    expect(result.isOverused).toBe(true);
    expect(result.percentage).toBe(5.0);
  });

  it('30 ref_provided out of 1000 total → isOverused=false', () => {
    const result = validateRefCategoryOveruse(30, 1000);
    expect(result.isOverused).toBe(false);
    expect(result.percentage).toBe(3.0);
  });

  it('0 records → isOverused=false', () => {
    const result = validateRefCategoryOveruse(0, 0);
    expect(result.isOverused).toBe(false);
  });
});

describe('Validators — week range validation', () => {
  it('all dense weeks → valid=true', () => {
    const result = validateWeekRangeInData(
      { '2025-W01': 10, '2025-W02': 15, '2025-W03': 12 },
      '2025 W01 – 2025 W03',
    );
    expect(result.valid).toBe(true);
    expect(result.denseWeekCount).toBe(3);
    expect(result.outlierWeekCount).toBe(0);
  });

  it('outlier week outside dense range → valid=false', () => {
    const result = validateWeekRangeInData(
      { '2024-W01': 1, '2025-W01': 10, '2025-W02': 15, '2025-W03': 12 },
      '2025 W01 – 2025 W03',
    );
    expect(result.valid).toBe(false);
    expect(result.outlierWeekCount).toBe(1);
    expect(result.outlierWeeks).toContain('2024-W01');
  });
});
