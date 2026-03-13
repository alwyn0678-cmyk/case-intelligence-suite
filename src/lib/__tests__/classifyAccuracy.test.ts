// ─────────────────────────────────────────────────────────────────
// Classifier Accuracy Regression Tests
//
// Tests for the specific improvements added in the accuracy correction pass:
//   - Multilingual missing load ref (EN/NL/DE)
//   - Multilingual customs/T1/MRN (EN/NL/DE)
//   - Financial word-boundary (rate substring)
//   - Equipment multilingual
//   - Planning multilingual
//   - Document direction (provided vs missing)
//
// Run:  npm test -- classifyAccuracy
// ─────────────────────────────────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { classifyByRules } from '../issueRules';
import { classifyCase } from '../classifyCase';
import type { NormalisedRecord } from '../../types';
import {
  validateMissingLoadRefUndercount,
  isMissingLoadRefUndercount,
  validateFinancialSubstringFalsePositive,
  validateProvidedDocMisclassified,
  validateEquipmentAsRefProvided,
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

// ─── 1. Missing Load Reference — English strong signals ───────────
describe('Accuracy — Missing Load Ref (English)', () => {
  it('"please send the loadref for this order" → load_ref', () => {
    const result = pipeline(
      'please send the loadref for this order',
      'Loadref Required',
    );
    expect(result.primaryIssue).toBe('load_ref');
  });

  it('"please send the loadrefs" → load_ref', () => {
    const result = classify('please send the loadrefs for these shipments');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('load_ref');
  });

  it('"loadref missing for shipment" → load_ref', () => {
    const result = pipeline(
      'loadref missing for shipment ABC123',
      'Loadref Missing',
    );
    expect(result.primaryIssue).toBe('load_ref');
  });

  it('"load ref still missing" → load_ref', () => {
    const result = classify('load ref still missing please provide asap');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('load_ref');
  });

  it('"no load reference" → load_ref', () => {
    const result = pipeline(
      'no load reference received for this booking — please add',
      'No Load Reference',
    );
    expect(result.primaryIssue).toBe('load_ref');
  });
});

// ─── 2. Missing Load Reference — Dutch ───────────────────────────
describe('Accuracy — Missing Load Ref (Dutch)', () => {
  it('"laadreferentie ontbreekt" → load_ref', () => {
    const result = pipeline(
      'laadreferentie ontbreekt voor deze zending',
      'Laadreferentie ontbreekt',
    );
    expect(result.primaryIssue).toBe('load_ref');
  });

  it('"graag loadref sturen" → load_ref', () => {
    const result = pipeline(
      'graag loadref sturen voor deze order',
      'Graag Loadref Sturen',
    );
    expect(result.primaryIssue).toBe('load_ref');
  });

  it('"loadref ontbreekt" rule-level match → load_ref', () => {
    const result = classify('loadref ontbreekt — graag toesturen');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('load_ref');
  });
});

// ─── 3. Missing Load Reference — German ──────────────────────────
describe('Accuracy — Missing Load Ref (German)', () => {
  it('"ladereferenz fehlt" → load_ref', () => {
    const result = pipeline(
      'ladereferenz fehlt fuer diese sendung',
      'Ladereferenz fehlt',
    );
    expect(result.primaryIssue).toBe('load_ref');
  });

  it('"fehlende ladereferenz" → load_ref', () => {
    const result = classify('fehlende ladereferenz bitte senden');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('load_ref');
  });
});

// ─── 4. NOT missing load ref ──────────────────────────────────────
describe('Accuracy — NOT missing load ref (disambiguation)', () => {
  it('"load ref: ABC123" → NOT load_ref', () => {
    const result = pipeline(
      'load ref: ABC123 is confirmed for this shipment',
      'Load Ref: ABC123',
    );
    expect(result.primaryIssue).not.toBe('load_ref');
  });

  it('"do we need a load ref?" → NOT load_ref', () => {
    const result = pipeline(
      'Do we need a load ref for this shipment? Please advise.',
      'Load ref required?',
    );
    expect(result.primaryIssue).not.toBe('load_ref');
  });

  it('"here is the load ref: BKG99" → NOT load_ref', () => {
    const result = pipeline(
      'here is the load ref: BKG9912345 as requested',
      'Load Ref BKG9912345',
    );
    expect(result.primaryIssue).not.toBe('load_ref');
  });
});

// ─── 5. Customs/T1 — English ──────────────────────────────────────
describe('Accuracy — T1 missing (English)', () => {
  it('"please send T1 for this shipment" → t1', () => {
    const result = pipeline(
      'please send T1 for this shipment — driver cannot proceed without it',
      'T1 Missing',
    );
    expect(result.primaryIssue).toBe('t1');
  });

  it('"t1 still missing" → t1', () => {
    const result = classify('t1 still missing please send immediately');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('t1');
  });

  it('"mrn missing for customs clearance" → customs', () => {
    const result = pipeline(
      'mrn missing for customs clearance. Driver is waiting at the border.',
      'MRN Missing',
    );
    expect(result.primaryIssue).toBe('customs');
  });
});

// ─── 6. Customs/T1 — Dutch ────────────────────────────────────────
describe('Accuracy — T1/customs missing (Dutch)', () => {
  it('"t1 ontbreekt" → t1', () => {
    const result = pipeline(
      't1 ontbreekt — chauffeur kan niet verder zonder t1 document',
      'T1 ontbreekt',
    );
    expect(result.primaryIssue).toBe('t1');
  });

  it('"douane documenten ontbreken" → customs', () => {
    const result = pipeline(
      'douane documenten ontbreken voor deze zending',
      'Douane Documenten Ontbreken',
    );
    expect(result.primaryIssue).toBe('customs');
  });

  it('"mrn ontbreekt" → customs', () => {
    const result = classify('mrn ontbreekt — graag de mrn sturen voor douane');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('customs');
  });
});

// ─── 7. Customs/T1 — German ───────────────────────────────────────
describe('Accuracy — T1/customs missing (German)', () => {
  it('"t1 fehlt" → t1', () => {
    const result = pipeline(
      't1 fehlt fuer diese sendung — fahrer kann nicht weiterfahren',
      'T1 fehlt',
    );
    expect(result.primaryIssue).toBe('t1');
  });

  it('"zolldokumente fehlen" → customs', () => {
    const result = pipeline(
      'zolldokumente fehlen fuer diese sendung bitte senden',
      'Zolldokumente fehlen',
    );
    expect(result.primaryIssue).toBe('customs');
  });
});

// ─── 8. NOT missing doc (provided) ────────────────────────────────
describe('Accuracy — NOT missing doc (document provided)', () => {
  it('"please find attached the T1 document" → NOT t1', () => {
    const result = pipeline(
      'please find attached the T1 document for this shipment',
      'T1 Document Attached',
    );
    expect(result.primaryIssue).not.toBe('t1');
  });

  it('"mrn: DE123456789012345 attached" → NOT customs', () => {
    const result = pipeline(
      'mrn: DE123456789012345 is attached to this email as requested',
      'MRN Attached',
    );
    expect(result.primaryIssue).not.toBe('customs');
  });
});

// ─── 9. Financial — word boundary (rate substring) ────────────────
describe('Accuracy — Financial word boundary (rate substring)', () => {
  it('"auto-generated report" → NOT rate (false positive guard)', () => {
    const result = pipeline(
      'please send auto-generated report for this booking',
      'Auto-generated Report',
    );
    expect(result.primaryIssue).not.toBe('rate');
  });

  it('"the email was auto-generated" → NOT rate', () => {
    const result = classify('the email was auto-generated please do not reply');
    // If it matches anything, it should not be rate
    if (result) {
      expect(result.issueId).not.toBe('rate');
    }
  });

  it('"price correction needed on invoice" → rate', () => {
    const result = pipeline(
      'price correction needed on invoice — wrong rate was applied to this shipment',
      'Price Correction Required',
    );
    expect(result.primaryIssue).toBe('rate');
  });

  it('"extra costs invoice attached" → rate', () => {
    const result = pipeline(
      'extra costs invoice is attached for the additional charges on this shipment',
      'Extra Costs Invoice',
    );
    expect(result.primaryIssue).toBe('rate');
  });
});

// ─── 10. Equipment — multilingual ─────────────────────────────────
describe('Accuracy — Equipment (multilingual)', () => {
  it('"portable not ok, cannot load" → equipment', () => {
    const result = pipeline(
      'portable not ok — driver cannot load. Unit reported as not in order.',
      'Portable Not OK',
    );
    expect(result.primaryIssue).toBe('equipment');
  });

  it('"container beschadigd" (Dutch) → equipment', () => {
    const result = pipeline(
      'container beschadigd bij aankomst depot — schade gerapporteerd door chauffeur',
      'Container Beschadigd',
    );
    expect(result.primaryIssue).toBe('equipment');
  });

  it('"container defekt" (German) → equipment', () => {
    const result = pipeline(
      'container defekt — schaden am container festgestellt fahrer wartet',
      'Container Defekt',
    );
    expect(result.primaryIssue).toBe('equipment');
  });

  it('"container damaged, ref: XYZ" → equipment (not ref_provided)', () => {
    const result = pipeline(
      'container damaged at depot — damage reported. ref: XYZ123456 for this case.',
      'Container Damaged',
    );
    expect(result.primaryIssue).toBe('equipment');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });
});

// ─── 11. Planning multilingual ────────────────────────────────────
describe('Accuracy — Planning multilingual', () => {
  it('"afhaal planning voor morgen" → pickup_delivery or scheduling', () => {
    const result = pipeline(
      'afhaal planning voor morgen nog niet bevestigd',
      'Afhaal Planning',
    );
    expect(['pickup_delivery', 'scheduling']).toContain(result.primaryIssue);
  });

  it('"Transportauftrag fehlt" → transport_order', () => {
    const result = pipeline(
      'Transportauftrag fehlt fuer diese sendung — bitte transportauftrag senden',
      'Transportauftrag fehlt',
    );
    expect(result.primaryIssue).toBe('transport_order');
  });
});

// ─── 12. Validators — new additions ──────────────────────────────
describe('Validators — isMissingLoadRefUndercount', () => {
  it('explicit missing but classified as ref_provided → undercount=true', () => {
    expect(isMissingLoadRefUndercount('ref_provided', 'laadreferentie ontbreekt voor deze zending')).toBe(true);
  });

  it('correct load_ref classification → undercount=false', () => {
    expect(isMissingLoadRefUndercount('load_ref', 'load ref missing please provide')).toBe(false);
  });

  it('no explicit missing language → undercount=false', () => {
    expect(isMissingLoadRefUndercount('customs', 'customs documents required for clearance')).toBe(false);
  });
});

describe('Validators — validateMissingLoadRefUndercount', () => {
  it('returns indices of misclassified records', () => {
    const records = [
      { primaryIssue: 'ref_provided', description: 'laadreferentie ontbreekt' },
      { primaryIssue: 'load_ref', description: 'load ref missing' },
      { primaryIssue: 'customs', description: 'customs docs missing' },
    ];
    const misclassified = validateMissingLoadRefUndercount(records);
    expect(misclassified).toEqual([0]);
  });
});

describe('Validators — validateFinancialSubstringFalsePositive', () => {
  it('"generated" containing "rate" substring → true', () => {
    expect(validateFinancialSubstringFalsePositive('rate', 'this is an auto-generated notification')).toBe(true);
  });

  it('legitimate financial text → false', () => {
    expect(validateFinancialSubstringFalsePositive('rate', 'price correction on invoice — wrong rate applied')).toBe(false);
  });

  it('non-rate issue → false', () => {
    expect(validateFinancialSubstringFalsePositive('delay', 'driver is late')).toBe(false);
  });
});

describe('Validators — validateProvidedDocMisclassified', () => {
  it('please find attached T1 classified as t1 → contaminated=true', () => {
    expect(validateProvidedDocMisclassified('t1', 'please find attached T1 document for this shipment')).toBe(true);
  });

  it('t1 missing please send → not contaminated', () => {
    expect(validateProvidedDocMisclassified('t1', 't1 missing please send urgently')).toBe(false);
  });

  it('non-compliance topic → not contaminated', () => {
    expect(validateProvidedDocMisclassified('delay', 'driver is late')).toBe(false);
  });
});

describe('Validators — validateEquipmentAsRefProvided', () => {
  it('container damaged classified as ref_provided → equipment false ref', () => {
    expect(validateEquipmentAsRefProvided('ref_provided', 'container damaged ref: XYZ123')).toBe(true);
  });

  it('container damaged classified as equipment → ok', () => {
    expect(validateEquipmentAsRefProvided('equipment', 'container damaged')).toBe(false);
  });

  it('ref_provided with no equipment signals → ok', () => {
    expect(validateEquipmentAsRefProvided('ref_provided', 'please find below the load ref BKG123')).toBe(false);
  });
});

// ─── 13. Extra Costs Report — must ALWAYS be rate ─────────────────
describe('Accuracy — Extra Costs Report always classifies as rate', () => {
  it('"Extra Costs Report 680110 / 67008423959 266668610" as subject → rate', () => {
    const result = pipeline(
      'Please find attached the extra costs report for this shipment.',
      'Extra Costs Report 680110 / 67008423959 266668610',
    );
    expect(result.primaryIssue).toBe('rate');
    expect(result.primaryIssue).not.toBe('customs');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('"Extra Costs Report 684315 / 67008580914 / 266785399" as subject → rate', () => {
    const result = pipeline(
      'Please review the attached extra costs report for the additional charges.',
      'Extra Costs Report 684315 / 67008580914 / 266785399',
    );
    expect(result.primaryIssue).toBe('rate');
  });

  it('"extra costs report for shipment" → rate', () => {
    const result = pipeline(
      'This is an extra costs report for your shipment with customs reference.',
      'extra costs report for shipment',
    );
    expect(result.primaryIssue).toBe('rate');
  });

  it('"meerkosten rapport voor zending" as subject → rate', () => {
    const result = pipeline(
      'Bijgaand het meerkosten rapport voor deze zending.',
      'meerkosten rapport voor zending',
    );
    expect(result.primaryIssue).toBe('rate');
  });

  it('financial subject overrides customs/reference body content → rate', () => {
    // Body mentions customs reference numbers which would normally trigger customs
    const result = pipeline(
      'Customs reference 12345. MRN DE123456789012345. Please see attached invoice.',
      'Extra Costs Report 999',
    );
    expect(result.primaryIssue).toBe('rate');
    expect(result.primaryIssue).not.toBe('customs');
  });

  it('"extra cost report" rule-level match → rate', () => {
    const result = classify('extra cost report for shipment ABCD1234567 attached');
    expect(result).not.toBeNull();
    expect(result!.issueId).toBe('rate');
  });
});

// ─── 14. Missing customs docs portbase — must NOT be closing_time ──
describe('Accuracy — Missing customs docs portbase must classify as customs/portbase', () => {
  it('"MISSING CUSTOMS DOCS PORTBASE" as subject → customs or portbase', () => {
    const result = pipeline(
      'Customs documents are missing in portbase. Driver cannot proceed.',
      'MISSING CUSTOMS DOCS PORTBASE',
    );
    expect(['customs', 'portbase']).toContain(result.primaryIssue);
    expect(result.primaryIssue).not.toBe('closing_time');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('"customs documents in Portbase missing" as subject → customs or portbase', () => {
    const result = pipeline(
      'Please upload the missing customs documents in Portbase. Container cannot be released.',
      'customs documents in Portbase missing',
    );
    expect(['customs', 'portbase']).toContain(result.primaryIssue);
    expect(result.primaryIssue).not.toBe('closing_time');
  });

  it('"1st portbase check / customs documents missing" as subject → customs or portbase', () => {
    const result = pipeline(
      'First portbase check failed. Customs documents are missing. Please upload urgently.',
      '1st portbase check / customs documents missing',
    );
    expect(['customs', 'portbase']).toContain(result.primaryIssue);
    expect(result.primaryIssue).not.toBe('closing_time');
  });

  it('"missing customs docs portbase" rule-level → customs or portbase', () => {
    const result = classify('missing customs docs portbase — please upload immediately');
    expect(result).not.toBeNull();
    expect(['customs', 'portbase']).toContain(result!.issueId);
  });
});

// ─── 15. ref_provided must not absorb financial or equipment ──────
describe('Accuracy — ref_provided must not override financial or equipment intent', () => {
  it('subject "extra costs report", body mentions "customs ref" → rate, not ref_provided', () => {
    const result = pipeline(
      'Please review the customs reference number for this extra costs report. The reference is attached.',
      'extra costs report 12345',
    );
    expect(result.primaryIssue).toBe('rate');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('"portable not ok, please advise" → equipment, not ref_provided', () => {
    const result = pipeline(
      'portable not ok — please advise on next steps. Driver is waiting.',
      'Portable Not OK',
    );
    expect(result.primaryIssue).toBe('equipment');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });

  it('"container damaged, ref ABC" → equipment, not ref_provided', () => {
    const result = pipeline(
      'container damaged at depot. ref: ABC1234567 for damage report. Please advise.',
      'Container Damaged',
    );
    expect(result.primaryIssue).toBe('equipment');
    expect(result.primaryIssue).not.toBe('ref_provided');
  });
});

// ─── 16. Provided document patterns — must NOT be missing-doc ────
describe('Accuracy — Provided doc signals must route to ref_provided, not missing', () => {
  it('"attached T1" in combined text → NOT t1 (should be ref_provided)', () => {
    const result = pipeline(
      'attached T1 document for this shipment — please find it enclosed.',
      'T1 Attached',
    );
    expect(result.primaryIssue).not.toBe('t1');
  });

  it('"please find attached T1" → NOT t1', () => {
    const result = pipeline(
      'please find attached T1 for this transit.',
      'T1 Attached',
    );
    expect(result.primaryIssue).not.toBe('t1');
  });

  it('"forwarding customs documents" → NOT customs (missing)', () => {
    const result = pipeline(
      'forwarding customs documents for this shipment as requested.',
      'Customs Documents Forwarded',
    );
    expect(result.primaryIssue).not.toBe('customs');
  });
});
