// ─────────────────────────────────────────────────────────────────
// Entity Extraction
//
// Extracts and classifies entities (transporter, depot, deepsea
// terminal, customer) from all available row fields.
//
// Priority: deepsea_terminal > depot > transporter > customer
// Every extraction stores the evidence trail required by CLAUDE.md.
// ─────────────────────────────────────────────────────────────────

import { lookupEntity, type EntityType } from '../config/referenceData';

export interface ExtractedEntity {
  rawValue: string;
  normalizedValue: string;
  entityType: EntityType;
  canonicalName: string;
  matchedAlias: string;
  sourceField: string;
  confidence: number;      // 0–1
  snippet: string;         // excerpt of the text where entity was found
}

export interface EntityExtractionResult {
  transporter: ExtractedEntity | null;
  depot: ExtractedEntity | null;
  deepseaTerminal: ExtractedEntity | null;
  customer: ExtractedEntity | null;
  allEntities: ExtractedEntity[];
  unknownEntities: string[];   // account/company names that didn't match any dictionary
}

// Fields to scan, in search-priority order
type FieldName = 'transporter_col' | 'customer_col' | 'subject' | 'isr_details' | 'description';

interface FieldEntry {
  name: FieldName;
  text: string;
}

/**
 * Build a snippet from the text centred on the matched alias.
 */
function buildSnippet(text: string, alias: string, windowChars = 60): string {
  const idx = text.toLowerCase().indexOf(alias.toLowerCase());
  if (idx === -1) return text.substring(0, 80);
  const start = Math.max(0, idx - Math.floor(windowChars / 2));
  const end = Math.min(text.length, idx + alias.length + Math.floor(windowChars / 2));
  return (start > 0 ? '…' : '') + text.substring(start, end) + (end < text.length ? '…' : '');
}

/**
 * Attempt to find a known entity in a piece of text.
 * Returns the best match (highest priority entity type).
 */
function findEntityInText(
  text: string,
  sourceField: FieldName,
  baseConfidence: number,
): ExtractedEntity | null {
  if (!text.trim()) return null;
  const result = lookupEntity(text);
  if (!result) return null;

  return {
    rawValue: text,
    normalizedValue: result.entry.canonicalName,
    entityType: result.entry.entityType,
    canonicalName: result.entry.canonicalName,
    matchedAlias: result.matchedAlias,
    sourceField,
    confidence: baseConfidence,
    snippet: buildSnippet(text, result.matchedAlias),
  };
}

/**
 * Main entity extraction function.
 *
 * @param transporterCol  Value of the dedicated "Transporter / Haulier" column (if present)
 * @param customerCol     Value of the "Customer / Account" column
 * @param subject         Email/case subject line
 * @param description     Email body / case description
 * @param isrDetails      ISR details field
 */
export function extractEntities(
  transporterCol: string | undefined,
  customerCol: string | undefined,
  subject: string | undefined,
  description: string | undefined,
  isrDetails: string | undefined,
): EntityExtractionResult {

  const fields: FieldEntry[] = [
    { name: 'transporter_col', text: transporterCol ?? '' },
    { name: 'customer_col',    text: customerCol ?? '' },
    { name: 'subject',         text: subject ?? '' },
    { name: 'isr_details',     text: isrDetails ?? '' },
    { name: 'description',     text: description ?? '' },
  ];

  const allEntities: ExtractedEntity[] = [];

  // Confidence weights per source field
  const confidenceByField: Record<FieldName, number> = {
    transporter_col: 0.95,
    customer_col: 0.85,
    isr_details: 0.80,
    subject: 0.75,
    description: 0.60,
  };

  // Extract from each field
  for (const field of fields) {
    if (!field.text) continue;
    const hit = findEntityInText(field.text, field.name, confidenceByField[field.name]);
    if (hit) {
      // Avoid duplicate canonical names across fields
      const alreadyFound = allEntities.find(e => e.canonicalName === hit.canonicalName);
      if (!alreadyFound) allEntities.push(hit);
    }
  }

  // ── Determine best entity per type ───────────────────────────
  const byType = (t: EntityType) =>
    allEntities
      .filter(e => e.entityType === t)
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  const deepseaTerminal = byType('deepsea_terminal');
  const depot           = byType('depot');
  const transporter     = byType('transporter');

  // ── Customer inference ────────────────────────────────────────
  // Only use the customerCol value as customer if it didn't resolve to
  // a known transporter / depot / terminal.
  let customer: ExtractedEntity | null = null;
  const custText = customerCol?.trim() ?? '';

  if (custText) {
    const knownMatch = lookupEntity(custText);
    if (!knownMatch) {
      // It's an actual customer name — not in any known dictionary
      customer = {
        rawValue: custText,
        normalizedValue: custText,
        entityType: 'customer',
        canonicalName: custText,
        matchedAlias: '',
        sourceField: 'customer_col',
        confidence: 0.85,
        snippet: custText,
      };
    } else if (knownMatch.entry.entityType === 'transporter' && !transporter) {
      // Customer col contained a transporter name — promote it
      const promoted: ExtractedEntity = {
        rawValue: custText,
        normalizedValue: knownMatch.entry.canonicalName,
        entityType: 'transporter',
        canonicalName: knownMatch.entry.canonicalName,
        matchedAlias: knownMatch.matchedAlias,
        sourceField: 'customer_col',
        confidence: 0.85,
        snippet: custText,
      };
      allEntities.push(promoted);
    }
  }

  // ── Unknown entity detection ──────────────────────────────────
  // Flag names in the customer column that look like company names
  // but don't resolve to any known entity.
  const unknownEntities: string[] = [];
  if (custText && !lookupEntity(custText) && custText.length > 3) {
    // Nothing to flag — this is the expected customer case
    // We only flag if it LOOKS like it could be a logistics entity
    const logisticsHint = /\b(transport|logistics|freight|cargo|barge|shipping|spedition|spediteur|haulage|container|terminal|depot|express|forwarding)\b/i.test(custText);
    if (logisticsHint) {
      unknownEntities.push(custText);
    }
  }

  return {
    transporter,
    depot,
    deepseaTerminal,
    customer,
    allEntities,
    unknownEntities,
  };
}

/**
 * Derive the "primary" entity to display in the transporter column,
 * taking into account what's resolved at the record level.
 * Returns a canonical name or null.
 */
export function resolveEntityName(entity: ExtractedEntity | null): string | null {
  return entity?.canonicalName ?? null;
}

/**
 * Quick helper: given an extraction result, return the most specific entity
 * type that was found (used for routing/area interpretation).
 */
export function dominantEntityType(result: EntityExtractionResult): EntityType | null {
  if (result.deepseaTerminal) return 'deepsea_terminal';
  if (result.depot) return 'depot';
  if (result.transporter) return 'transporter';
  if (result.customer) return 'customer';
  return null;
}
