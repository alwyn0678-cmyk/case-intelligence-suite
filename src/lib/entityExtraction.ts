// ─────────────────────────────────────────────────────────────────
// Entity Extraction
//
// Extracts and classifies entities (transporter, depot, deepsea
// terminal, customer) from all available row fields.
//
// Priority: deepsea_terminal > depot > transporter > customer
// Every extraction stores the evidence trail required by CLAUDE.md.
// ─────────────────────────────────────────────────────────────────

import { lookupEntity, ENTITY_ALIAS_MAP, type EntityType } from '../config/referenceData';

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
 * Scan text for ALL entity matches (not just the first/highest-priority one).
 * Returns every distinct canonical match found, sorted by priority.
 */
function findAllEntitiesInText(
  text: string,
  sourceField: FieldName,
  baseConfidence: number,
): ExtractedEntity[] {
  if (!text.trim()) return [];
  const lower = text.toLowerCase();
  const results: ExtractedEntity[] = [];
  const seenCanonicals = new Set<string>();

  const sortedAliases = Array.from(ENTITY_ALIAS_MAP.keys()).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (lower.includes(alias)) {
      const entry = ENTITY_ALIAS_MAP.get(alias)!;
      if (!seenCanonicals.has(entry.canonicalName)) {
        seenCanonicals.add(entry.canonicalName);
        results.push({
          rawValue: text,
          normalizedValue: entry.canonicalName,
          entityType: entry.entityType,
          canonicalName: entry.canonicalName,
          matchedAlias: alias,
          sourceField,
          confidence: baseConfidence,
          snippet: buildSnippet(text, alias),
        });
      }
    }
  }
  return results;
}

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

  const confidenceByField: Record<FieldName, number> = {
    transporter_col: 0.95,
    customer_col: 0.85,
    isr_details: 0.80,
    subject: 0.75,
    description: 0.60,
  };

  // ── Extract ALL known entities from every field ───────────────
  for (const field of fields) {
    if (!field.text) continue;
    const hits = findAllEntitiesInText(field.text, field.name, confidenceByField[field.name]);
    for (const hit of hits) {
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
  // Customer is inferred only AFTER all operational entities are identified.
  // Customer col raw value is used ONLY if it does NOT resolve to any known entity.
  let customer: ExtractedEntity | null = null;
  const custText = customerCol?.trim() ?? '';

  if (custText) {
    const knownMatch = lookupEntity(custText);
    if (!knownMatch) {
      // Not a known entity — safe to treat as customer
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
    }
    // If knownMatch exists, the entity is already in allEntities under its correct type.
    // Do NOT add it as a customer. Leave customer as null.
  }

  // ── Deep entity recovery pass ────────────────────────────────
  // If customer is still null, scan all text fields for a company name
  // that looks like a customer (not an operational entity).
  // Strategy: extract company-like tokens from text that don't match any known entity.
  if (!customer) {
    const allText = fields.map(f => f.text).join(' ');
    // Match patterns: "Account: XYZ", "Customer: XYZ", "client: XYZ", or standalone company names
    const accountPatterns = [
      /\baccount[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bcustomer[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bclient[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bkunde[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
    ];
    for (const pattern of accountPatterns) {
      const m = allText.match(pattern);
      if (m && m[1]) {
        const candidate = m[1].trim();
        const knownMatch = lookupEntity(candidate);
        if (!knownMatch) {
          customer = {
            rawValue: candidate,
            normalizedValue: candidate,
            entityType: 'customer',
            canonicalName: candidate,
            matchedAlias: '',
            sourceField: 'description',
            confidence: 0.55,
            snippet: candidate,
          };
          break;
        }
      }
    }
  }

  // ── Unknown entity detection ──────────────────────────────────
  const unknownEntities: string[] = [];
  // Flag logistics-sounding names from the customer column that don't match any dictionary
  if (custText && !lookupEntity(custText) && custText.length > 3) {
    const logisticsHint = /\b(transport|logistics|freight|cargo|barge|shipping|spedition|spediteur|haulage|container|terminal|depot|express|forwarding|spedition|hafen|port)\b/i.test(custText);
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
