// ─────────────────────────────────────────────────────────────────
// Entity Extraction
//
// Extracts and classifies entities (transporter, depot, deepsea
// terminal, customer) from all available row fields.
//
// ROLE-BASED MODEL:
//   An entity may have multiple roles (e.g. 'depot' + 'transporter').
//   byRole() selects the best entity that has a given role.
//   This allows dual-role entities (Contargo, Germersheim DPW, etc.)
//   to populate BOTH resolvedTransporter AND resolvedDepot.
//
// Priority for customer-blocking: deepsea_terminal > depot > transporter > carrier
// ALL known operational entities (terminal / depot / transporter / carrier) are
// blocked from the customer slot. A carrier name in the customer column means the
// row relates to a logistics partner, not an end-customer account — send to unresolved.
// ─────────────────────────────────────────────────────────────────

import { lookupEntity, ENTITY_ALIAS_MAP, type EntityType, isInternalISRLabel, isCustomerJunkLabel } from '../config/referenceData';
import { hasCompanyNameStructure } from './textNormalization';

export interface ExtractedEntity {
  rawValue: string;
  normalizedValue: string;
  entityType: EntityType;
  roles: EntityType[];       // all functional roles for this entity
  canonicalName: string;
  matchedAlias: string;
  sourceField: string;
  confidence: number;        // 0–1
  snippet: string;           // excerpt of the text where entity was found
}

export interface EntityExtractionResult {
  transporter: ExtractedEntity | null;    // best entity with 'transporter' role
  depot: ExtractedEntity | null;          // best entity with 'depot' role
  deepseaTerminal: ExtractedEntity | null;
  customer: ExtractedEntity | null;
  allEntities: ExtractedEntity[];
  unknownEntities: string[];              // account/company names that didn't match any dictionary
}

// Fields to scan, in search-priority order
type FieldName = 'transporter_col' | 'customer_col' | 'subject' | 'isr_details' | 'description' | 'extra_raw';

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
 * Includes the full roles[] array from the EntityEntry.
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
          roles: entry.roles,
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

/**
 * Extract all entities from all available record fields.
 *
 * @param transporterCol  - dedicated transporter column value
 * @param customerCol     - dedicated customer/account column value
 * @param subject         - case subject / email subject
 * @param description     - case description / body
 * @param isrDetails      - ISR details field
 * @param extraRaw        - any additional raw field text (unmapped columns, external details, notes)
 */
export function extractEntities(
  transporterCol: string | undefined,
  customerCol: string | undefined,
  subject: string | undefined,
  description: string | undefined,
  isrDetails: string | undefined,
  extraRaw?: string,
): EntityExtractionResult {

  const confidenceByField: Record<FieldName, number> = {
    transporter_col: 0.95,
    customer_col:    0.85,
    isr_details:     0.80,
    subject:         0.75,
    description:     0.60,
    extra_raw:       0.55,
  };

  const fields: FieldEntry[] = [
    { name: 'transporter_col', text: transporterCol ?? '' },
    { name: 'customer_col',    text: customerCol ?? '' },
    { name: 'subject',         text: subject ?? '' },
    { name: 'isr_details',     text: isrDetails ?? '' },
    { name: 'description',     text: description ?? '' },
    { name: 'extra_raw',       text: extraRaw ?? '' },
  ];

  const allEntities: ExtractedEntity[] = [];

  // ── Extract ALL known entities from every field ───────────────
  for (const field of fields) {
    if (!field.text) continue;
    const hits = findAllEntitiesInText(field.text, field.name, confidenceByField[field.name]);
    for (const hit of hits) {
      const alreadyFound = allEntities.find(e => e.canonicalName === hit.canonicalName);
      if (!alreadyFound) allEntities.push(hit);
    }
  }

  // ── Role-based entity selection ───────────────────────────────
  // An entity with roles=['depot','transporter'] will appear in BOTH
  // the depot AND transporter slots. This is the core of the multi-role model.
  const byRole = (role: EntityType): ExtractedEntity | null =>
    allEntities
      .filter(e => e.roles.includes(role))
      .sort((a, b) => b.confidence - a.confidence)[0] ?? null;

  const deepseaTerminal = byRole('deepsea_terminal');
  const depot           = byRole('depot');
  const transporter     = byRole('transporter');

  // ── Customer inference ────────────────────────────────────────
  // Customer is inferred only AFTER all operational entities are identified.
  //
  // Blocking rules — the following are NEVER treated as customers:
  //   - deepsea_terminal, depot, approved transporter, carrier (logistics entities)
  //   - Internal ISR / Maersk address-book labels
  //   - Junk placeholder labels
  //   - Names that fail structural validation (no company-name structure)
  let customer: ExtractedEntity | null = null;
  const custText = customerCol?.trim() ?? '';

  // Skip customer inference for internal ISR labels and junk placeholders.
  // These must never reach the customer slot or customer-level reporting.
  if (custText && (isInternalISRLabel(custText) || isCustomerJunkLabel(custText))) {
    // Leave customer as null — treated as unresolved in aggregation.
  } else if (custText) {
    // Structural check: the value must at least look like a real name (has letters, etc.)
    if (!hasCompanyNameStructure(custText)) {
      // Leave as null — purely numeric, symbolic, or empty-ish values are not customers.
    } else {
      const knownMatch = lookupEntity(custText);
      const isOperationalBlock =
        knownMatch !== null &&
        (knownMatch.entry.entityType === 'deepsea_terminal' ||
         knownMatch.entry.entityType === 'depot' ||
         knownMatch.entry.entityType === 'transporter' ||
         knownMatch.entry.entityType === 'carrier');  // all logistics entities blocked from customer slot

      if (!isOperationalBlock) {
        // Not a known entity, OR an unrecognised name — safe to treat as customer.
        // Confidence is slightly lower for single-word names (could be abbreviations or codes).
        const canonicalName = knownMatch ? knownMatch.entry.canonicalName : custText;
        const wordCount = custText.trim().split(/\s+/).length;
        const baseConfidence = wordCount === 1 && custText.length <= 4 ? 0.65 : 0.85;
        customer = {
          rawValue: custText,
          normalizedValue: canonicalName,
          entityType: 'customer',
          roles: ['customer'],
          canonicalName,
          matchedAlias: knownMatch?.matchedAlias ?? '',
          sourceField: 'customer_col',
          confidence: baseConfidence,
          snippet: custText,
        };
      }
      // If operational block: entity is already in allEntities under its correct type.
      // Leave customer as null.
    }
  }

  // ── Deep entity recovery pass ────────────────────────────────
  // If customer is still null, scan all text fields for a company name
  // that looks like a customer (not a hard-blocked operational entity).
  // Candidates from this pass get lower confidence (0.55) as they are
  // inferred from text context rather than a dedicated customer column.
  if (!customer) {
    const allText = fields.map(f => f.text).join(' ');
    const accountPatterns = [
      /\baccount[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bcustomer[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bclient[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bkunde[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
      /\bopdrachtgever[:\s]+([A-Z][A-Za-z0-9 &\-\.]{2,40})/i,
    ];
    for (const pattern of accountPatterns) {
      const m = allText.match(pattern);
      if (m && m[1]) {
        const candidate = m[1].trim();

        // Apply the same guards as primary inference: structural + junk + entity block
        if (!hasCompanyNameStructure(candidate)) continue;
        if (isInternalISRLabel(candidate) || isCustomerJunkLabel(candidate)) continue;

        const knownMatch = lookupEntity(candidate);
        const isOperationalBlock =
          knownMatch !== null &&
          (knownMatch.entry.entityType === 'deepsea_terminal' ||
           knownMatch.entry.entityType === 'depot' ||
           knownMatch.entry.entityType === 'transporter' ||
           knownMatch.entry.entityType === 'carrier');  // all logistics entities blocked

        if (!isOperationalBlock) {
          customer = {
            rawValue: candidate,
            normalizedValue: knownMatch ? knownMatch.entry.canonicalName : candidate,
            entityType: 'customer',
            roles: ['customer'],
            canonicalName: knownMatch ? knownMatch.entry.canonicalName : candidate,
            matchedAlias: knownMatch?.matchedAlias ?? '',
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
    const logisticsHint = /\b(transport|logistics|freight|cargo|barge|shipping|spedition|spediteur|haulage|container|terminal|depot|express|forwarding|hafen|port)\b/i.test(custText);
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
