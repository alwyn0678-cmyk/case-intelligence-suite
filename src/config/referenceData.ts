// ─────────────────────────────────────────────────────────────────
// Built-in entity reference dictionaries
//
// ROLE-BASED ENTITY MODEL
// Every entity has:
//   entityType  — primary type for priority resolution and customer-blocking
//   roles[]     — ALL functional roles this entity can fulfill
//
// An entity can be both a transporter AND a depot (e.g. Contargo,
// DP World Germersheim, HP Duisburg, CTV Vrede, EKB Transport).
// These dual-role entities appear in BOTH transporter and depot reporting.
//
// Priority for customer-blocking: deepsea_terminal > depot > transporter > carrier
// NO operational entity (terminal / depot / transporter / carrier) may appear in Customer Burden.
// ─────────────────────────────────────────────────────────────────

import { normalizeForMatching, generateNormalizedVariants } from '../lib/textNormalization';

export type EntityType = 'transporter' | 'depot' | 'deepsea_terminal' | 'customer' | 'carrier' | 'unknown_entity';

export interface EntityEntry {
  canonicalName: string;
  entityType: EntityType;   // primary type (priority resolution + customer-blocking)
  roles: EntityType[];      // ALL functional roles (transporter, depot, etc.)
  aliases: string[];        // all lowercase, used for matching
}

// ─────────────────────────────────────────────────────────────────
// APPROVED DEEP SEA TERMINALS
// Restricted to Rotterdam, Antwerp, and Bremen/Bremerhaven only.
// Hamburg, Felixstowe, Southampton are NOT part of this dashboard.
// ─────────────────────────────────────────────────────────────────
export const DEEPSEA_TERMINALS: EntityEntry[] = [
  // Rotterdam
  { canonicalName: 'ECT Delta Terminal',        entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['ect delta','ect','ect euromax','europe combined terminals'] },
  { canonicalName: 'APM Terminals Maasvlakte',  entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['apm terminals','apmt','apm maasvlakte','apmt maasvlakte','apm rotterdam'] },
  { canonicalName: 'RWG Terminal',              entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['rwg','rotterdam world gateway','world gateway'] },
  { canonicalName: 'EUROMAX Terminal',          entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['euromax terminal','euromax rotterdam','euromax'] },
  { canonicalName: 'Hutchison Ports Rotterdam', entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['hutchison ports rotterdam','hutchison rotterdam','hutchison ecth','ecth'] },
  { canonicalName: 'Uniport Multipurpose',      entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['uniport','uniport multipurpose','uniport rotterdam'] },
  { canonicalName: 'OVET Terminal',             entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['ovet','ovet terminal'] },
  // Antwerp
  { canonicalName: 'MSC PSA European Terminal', entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['msct','msc psa','psa antwerp','msc psa european terminal','deurganckdok'] },
  { canonicalName: 'DP World Antwerp Gateway',  entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['dp world antwerp','antwerp gateway','dpw antwerp'] },
  { canonicalName: 'PSA HNN Antwerp',           entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['psa hnn','hnn antwerp','hessenatie','north sea terminal antwerp'] },
  { canonicalName: 'Antwerp Terminal',          entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['antwerp terminal','at antwerp'] },
  // Bremen / Bremerhaven
  { canonicalName: 'Eurogate Bremerhaven',      entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['eurogate bremerhaven','bct','bremer container terminal'] },
  { canonicalName: 'NTB Bremerhaven',           entityType: 'deepsea_terminal', roles: ['deepsea_terminal'], aliases: ['ntb','north sea terminal bremerhaven','nst bremerhaven'] },
];

// ─────────────────────────────────────────────────────────────────
// INLAND DEPOTS / BARGE-RAIL TERMINALS
//
// Many inland operators act as BOTH the depot/terminal AND the
// transport/barge operator. These carry roles: ['depot','transporter']
// and appear in BOTH Depot reporting AND Transporter Performance.
// ─────────────────────────────────────────────────────────────────
export const INLAND_DEPOTS: EntityEntry[] = [
  // ── Dual-role: depot + transporter ───────────────────────────────
  // Germersheim: DP World operates both the inland terminal and Rhine barge transport
  { canonicalName: 'Germersheim DPW',       entityType: 'depot', roles: ['depot','transporter'], aliases: ['germersheim dpw','dpw germersheim','germersheim','dp world germersheim','degrh01','dp world intermodal b.v.','dp world intermodal bv','dp world intermodal','dpw intermodal','dp world'] },
  // HP Duisburg / Hutchison Ports Duisburg: Rhine barge company + inland depot
  { canonicalName: 'HP Duisburg',           entityType: 'depot', roles: ['depot','transporter'], aliases: ['hp duisburg','hutchison ports duisburg','hutchison duisburg','hutchison ports duisburg rhine'] },
  // Contargo variants: Rhine shipping + inland terminal operator
  { canonicalName: 'Contargo Rhine Ruhr',   entityType: 'depot', roles: ['depot','transporter'], aliases: ['contargo rhine ruhr','contargo ruhr','contargo dortmund','contargo duisburg'] },
  { canonicalName: 'Contargo Trimodal',     entityType: 'depot', roles: ['depot','transporter'], aliases: ['contargo trimodal','contargo köln','contargo cologne','contargo neuss'] },
  { canonicalName: 'Contargo',              entityType: 'depot', roles: ['depot','transporter'], aliases: ['contargo'] },
  // Frankenbach/Mainz: inland depot also acting as transport operator
  { canonicalName: 'Mainz Frankenbach',     entityType: 'depot', roles: ['depot','transporter'], aliases: ['mainz frankenbach','frankenbach','mainz depot'] },
  // Gustavsburg Contargo: Rhine terminal at Mainz junction
  { canonicalName: 'Gustavsburg Contargo',  entityType: 'depot', roles: ['depot','transporter'], aliases: ['gustavsburg contargo','gustavsburg','contargo gustavsburg'] },
  // HGK: Rhine barge shipping company + inland depot operations
  { canonicalName: 'HGK',                   entityType: 'depot', roles: ['depot','transporter'], aliases: ['hgk shipping','hgk','hgk transport','hgk barge'] },
  // European Gateway Services: inland barge/intermodal operator
  { canonicalName: 'European Gateway Services', entityType: 'depot', roles: ['depot','transporter'], aliases: ['european gateway services','european gateway','eur gateway services','eurgateway','eurogateways','european gateway services bv'] },
  // CTS Container-Terminal GmbH: inland container terminal operator
  { canonicalName: 'CTS Container-Terminal', entityType: 'depot', roles: ['depot','transporter'], aliases: ['cts container-terminal gmbh','cts container terminal gmbh','cts container terminal','cts container-terminal','cts terminal','cts gmbh','cts'] },
  // ── Depot-only ────────────────────────────────────────────────────
  { canonicalName: 'ZSK am Zehnhoff',       entityType: 'depot', roles: ['depot'], aliases: ['am zehnhoff','zehnhoff','zsk','andernach zehnhoff'] },
  { canonicalName: 'H&S Andernach',         entityType: 'depot', roles: ['depot','transporter'], aliases: ['h&s andernach','h s andernach','hs andernach','deajhra','h&s schiffahrts andernach','h+s andernach'] },
  { canonicalName: 'Bonn AZS',              entityType: 'depot', roles: ['depot','transporter'], aliases: ['bonn azs','azs bonn','debnx01','bon depot'] },
  { canonicalName: 'Trier AZS',             entityType: 'depot', roles: ['depot','transporter'], aliases: ['trier azs','azs trier','detreaz'] },
  { canonicalName: 'EGS Nuremberg',         entityType: 'depot', roles: ['depot','transporter'], aliases: ['egs nuremberg','egs nürnberg','egs','denue02'] },
  { canonicalName: 'Rheinhafen Andernach',  entityType: 'depot', roles: ['depot'], aliases: ['rheinhafen andernach','andernach depot'] },
  // Rhine South / Basel
  { canonicalName: 'Rhenus Basel',          entityType: 'depot', roles: ['depot'], aliases: ['rhenus basel','rhenus port basel','rheinport basel'] },
  { canonicalName: 'Häfen Basel',           entityType: 'depot', roles: ['depot'], aliases: ['häfen basel','hafen basel','rheinhafen basel'] },
  // Ruhr / NRW
  { canonicalName: 'DIT Depot',             entityType: 'depot', roles: ['depot'], aliases: ['dit depot','dit duisburg','duisburg intermodal'] },
  { canonicalName: 'RRT Depot',             entityType: 'depot', roles: ['depot'], aliases: ['rrt depot','rrt duisburg'] },
  { canonicalName: 'Duisburg Hafen',        entityType: 'depot', roles: ['depot'], aliases: ['duisport','duisburg hafen','duisburg port','dusiburg'] },
  // Bavaria / South Germany
  { canonicalName: 'Nürnberg CDN',          entityType: 'depot', roles: ['depot'], aliases: ['nuernberg cdn','nürnberg cdn','cdn nuremberg','cdn nürnberg'] },
  { canonicalName: 'München Container Terminal', entityType: 'depot', roles: ['depot'], aliases: ['münchen container','munich container','mct münchen','mct munich'] },
  // Netherlands inland
  { canonicalName: 'Moerdijk Container Terminal', entityType: 'depot', roles: ['depot'], aliases: ['moerdijk','mct moerdijk','container terminal moerdijk'] },
  { canonicalName: 'Nijmegen Inland Terminal', entityType: 'depot', roles: ['depot'], aliases: ['nijmegen terminal','barge nijmegen'] },
  { canonicalName: 'Venlo Container Terminal', entityType: 'depot', roles: ['depot'], aliases: ['venlo terminal','venlo container'] },
  // Belgium inland
  { canonicalName: 'Liège Container Terminal', entityType: 'depot', roles: ['depot'], aliases: ['liège terminal','liege terminal','trilogiport'] },
];

// ─────────────────────────────────────────────────────────────────
// APPROVED SPECIALIST INLAND HAULIERS
//
// These appear in Transporter Performance reporting.
// CTV Vrede and EKB Transport are also depot operators →
// roles: ['transporter','depot'] → appear in both Transporter AND Depot charts.
// ─────────────────────────────────────────────────────────────────
export const APPROVED_TRANSPORTERS: EntityEntry[] = [
  { canonicalName: 'Starmans',            entityType: 'transporter', roles: ['transporter'],         aliases: ['starmans'] },
  { canonicalName: 'Henk Dammes',         entityType: 'transporter', roles: ['transporter'],         aliases: ['henk dammes','dammes'] },
  { canonicalName: 'Falcoline',           entityType: 'transporter', roles: ['transporter'],         aliases: ['falcoline','falcoline gmbh','falcoline transport','falcoline spedition','falcoline belgium','falcoline belgie','falco lines belgium nv','falco lines belgium','falcolines belgium nv','falco lines nv'] },
  { canonicalName: 'GTS Coldchain',       entityType: 'transporter', roles: ['transporter'],         aliases: ['gts coldchain','gts cold','gts truck','gts logistics','gts duisburg','gts transport','gts'] },
  { canonicalName: 'CTV Vrede',           entityType: 'transporter', roles: ['transporter','depot'], aliases: ['ctv vrede','ctv transport','ctv','ctv spedition','ctv gmbh'] },
  { canonicalName: 'EKB Transport',       entityType: 'transporter', roles: ['transporter','depot'], aliases: ['ekb transport','ekb'] },
  { canonicalName: 'Optimodal Nederland', entityType: 'transporter', roles: ['transporter'],         aliases: ['optimodal nederland bv','optimodal nederland','optimodal'] },
  { canonicalName: 'Kiem Transport',      entityType: 'transporter', roles: ['transporter'],         aliases: ['kiem transport','kiem'] },
  { canonicalName: 'DCH Düsseldorf',      entityType: 'transporter', roles: ['transporter'],         aliases: ['dch duesseldorfer container-hafen','dch düsseldorfer container-hafen','dch duesseldorf','dch container hafen','dch container-hafen','dch duisburg','dch'] },
];

// ─────────────────────────────────────────────────────────────────
// KNOWN EXTERNAL CARRIERS
// Recognised for entity disambiguation only.
// entityType = 'carrier' — these are NOT operational entities:
//   - They do NOT appear in Transporter Performance
//   - They DO block customer inference via isBlockedFromCustomerRole()
//     (a logistics carrier in the customer column is a data-quality issue, not a real account)
// Note: HGK has been moved to INLAND_DEPOTS (dual-role depot+transporter).
// ─────────────────────────────────────────────────────────────────
export const KNOWN_CARRIERS: EntityEntry[] = [
  { canonicalName: 'DB Schenker',         entityType: 'carrier', roles: ['carrier'], aliases: ['db schenker','schenker','dbschenker'] },
  { canonicalName: 'DHL Freight',         entityType: 'carrier', roles: ['carrier'], aliases: ['dhl freight','dhl logistics','dhl'] },
  { canonicalName: 'DSV',                 entityType: 'carrier', roles: ['carrier'], aliases: ['dsv road','dsv air','dsv logistics','dsv'] },
  { canonicalName: 'Rhenus Logistics',    entityType: 'carrier', roles: ['carrier'], aliases: ['rhenus logistics','rhenus road','rhenus transport','rhenus'] },
  { canonicalName: 'Dachser',             entityType: 'carrier', roles: ['carrier'], aliases: ['dachser'] },
  { canonicalName: 'Kuehne+Nagel',        entityType: 'carrier', roles: ['carrier'], aliases: ['kuehne nagel','kühne nagel','kühnenegel','kuhne nagel','k+n','kuehne+nagel'] },
  { canonicalName: 'XPO Logistics',       entityType: 'carrier', roles: ['carrier'], aliases: ['xpo logistics','xpo transport','xpo'] },
  { canonicalName: 'Geodis',              entityType: 'carrier', roles: ['carrier'], aliases: ['geodis'] },
  { canonicalName: 'Ceva Logistics',      entityType: 'carrier', roles: ['carrier'], aliases: ['ceva logistics','ceva'] },
  { canonicalName: 'Raben Group',         entityType: 'carrier', roles: ['carrier'], aliases: ['raben group','raben transport','raben'] },
  { canonicalName: 'Gefco',               entityType: 'carrier', roles: ['carrier'], aliases: ['gefco','ceva gefco'] },
  { canonicalName: 'Fiege Logistics',     entityType: 'carrier', roles: ['carrier'], aliases: ['fiege logistics','fiege'] },
  { canonicalName: 'Samskip',             entityType: 'carrier', roles: ['carrier'], aliases: ['samskip'] },
  { canonicalName: 'Nedcargo',            entityType: 'carrier', roles: ['carrier'], aliases: ['nedcargo'] },
  { canonicalName: 'Van Dieren Transport',entityType: 'carrier', roles: ['carrier'], aliases: ['van dieren','vandieren'] },
  { canonicalName: 'Kloosterboer',        entityType: 'carrier', roles: ['carrier'], aliases: ['kloosterboer'] },
  { canonicalName: 'PostNL',              entityType: 'carrier', roles: ['carrier'], aliases: ['postnl','post nl'] },
  { canonicalName: 'TNT Express',         entityType: 'carrier', roles: ['carrier'], aliases: ['tnt express','tnt'] },
  { canonicalName: 'UPS',                 entityType: 'carrier', roles: ['carrier'], aliases: ['ups supply chain','ups freight','ups'] },
  { canonicalName: 'FedEx',               entityType: 'carrier', roles: ['carrier'], aliases: ['fedex freight','fedex'] },
  { canonicalName: 'Wincanton',           entityType: 'carrier', roles: ['carrier'], aliases: ['wincanton'] },
  { canonicalName: 'Broekman Logistics',  entityType: 'carrier', roles: ['carrier'], aliases: ['broekman logistics','broekman'] },
  { canonicalName: 'CTD Logistics',       entityType: 'carrier', roles: ['carrier'], aliases: ['ctd logistics','ctd'] },
  // Additional logistics counterparties — blocked from customer charts
  { canonicalName: 'Hellmann Worldwide',  entityType: 'carrier', roles: ['carrier'], aliases: ['hellmann worldwide logistics','hellmann worldwide','hellmann logistics','hellmann'] },
  { canonicalName: 'P&O Ferrymasters',    entityType: 'carrier', roles: ['carrier'], aliases: ['p&o ferrymasters','po ferrymasters','ferrymasters','p and o ferrymasters'] },
  { canonicalName: 'Bolloré Logistics',   entityType: 'carrier', roles: ['carrier'], aliases: ['bolloré logistics','bollore logistics','bollore','bolloré'] },
  { canonicalName: 'BLG Logistics',       entityType: 'carrier', roles: ['carrier'], aliases: ['blg logistics','blg'] },
  { canonicalName: 'Falco Lines',         entityType: 'carrier', roles: ['carrier'], aliases: ['falco lines belgium nv','falco lines belgium','falco lines','falcoline','falco'] },
  { canonicalName: 'Yusen Logistics',     entityType: 'carrier', roles: ['carrier'], aliases: ['yusen logistics','nyk logistics','yusen'] },
  { canonicalName: 'Agility Logistics',   entityType: 'carrier', roles: ['carrier'], aliases: ['agility logistics','agility'] },
  { canonicalName: 'Expeditors',          entityType: 'carrier', roles: ['carrier'], aliases: ['expeditors international','expeditors'] },
  { canonicalName: 'Logwin',              entityType: 'carrier', roles: ['carrier'], aliases: ['logwin','logwin ag','logwin logistics'] },
  { canonicalName: 'Nacco',               entityType: 'carrier', roles: ['carrier'], aliases: ['nacco','nacco logistics','naco'] },
];

// Combined export for backward compatibility
export const TRANSPORTERS: EntityEntry[] = [...APPROVED_TRANSPORTERS, ...KNOWN_CARRIERS];

// ─────────────────────────────────────────────────────────────────
// Combined lookup (priority order enforced in entityExtraction.ts)
// ─────────────────────────────────────────────────────────────────
export const ALL_ENTITIES: EntityEntry[] = [
  ...DEEPSEA_TERMINALS,
  ...INLAND_DEPOTS,
  ...APPROVED_TRANSPORTERS,
  ...KNOWN_CARRIERS,
];

/**
 * Build a flat lookup table: alias (lowercase) → EntityEntry
 * When two entries share an alias the higher-priority one wins.
 */
const PRIORITY: Record<EntityType, number> = {
  deepsea_terminal: 4,
  depot:            3,
  transporter:      2,  // APPROVED_TRANSPORTERS only
  carrier:          1,  // KNOWN_CARRIERS — lower than operational types
  customer:         0,
  unknown_entity:  -1,
};

export const ENTITY_ALIAS_MAP: Map<string, EntityEntry> = (() => {
  const map = new Map<string, EntityEntry>();
  for (const entry of ALL_ENTITIES) {
    for (const alias of entry.aliases) {
      const existing = map.get(alias);
      if (!existing || PRIORITY[entry.entityType] > PRIORITY[existing.entityType]) {
        map.set(alias, entry);
      }
    }
  }
  return map;
})();

/**
 * Fallback normalized alias map — keys are legal-suffix-stripped forms.
 * Used as a secondary lookup when the primary alias map has no match.
 *
 * Example: "dp world intermodal n.v." fails to match "dp world intermodal bv"
 * but matches "dp world intermodal" in the normalized map.
 */
export const ENTITY_NORMALIZED_ALIAS_MAP: Map<string, EntityEntry> = (() => {
  const map = new Map<string, EntityEntry>();
  for (const entry of ALL_ENTITIES) {
    const normalizedVariants = generateNormalizedVariants(entry.aliases);
    for (const variant of normalizedVariants) {
      const existing = map.get(variant);
      if (!existing || PRIORITY[entry.entityType] > PRIORITY[existing.entityType]) {
        map.set(variant, entry);
      }
    }
    // Also index the canonical name normalized
    const normalizedCanonical = normalizeForMatching(entry.canonicalName);
    if (normalizedCanonical && normalizedCanonical.length > 2) {
      const existing = map.get(normalizedCanonical);
      if (!existing || PRIORITY[entry.entityType] > PRIORITY[existing.entityType]) {
        map.set(normalizedCanonical, entry);
      }
    }
  }
  return map;
})();

/**
 * Look up a raw string against the entity alias map.
 * Returns the best matching EntityEntry and the alias that matched, or null.
 *
 * Two-pass lookup:
 *   1. Primary: exact alias substring match (current behavior)
 *   2. Fallback: normalized form match (strips legal suffixes like GmbH, B.V., etc.)
 *      to catch variants like "DP World Intermodal N.V." → "dp world intermodal"
 */
export function lookupEntity(text: string): { entry: EntityEntry; matchedAlias: string } | null {
  const lower = text.toLowerCase().trim();
  // Pass 1: longest alias first (greedy match to avoid 'dhl' swallowing 'dhl freight')
  const sortedAliases = Array.from(ENTITY_ALIAS_MAP.keys()).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (lower.includes(alias)) {
      return { entry: ENTITY_ALIAS_MAP.get(alias)!, matchedAlias: alias };
    }
  }
  // Pass 2: normalized form (strips legal suffixes before matching)
  const normalizedInput = normalizeForMatching(lower);
  if (normalizedInput.length > 2) {
    const sortedNormalized = Array.from(ENTITY_NORMALIZED_ALIAS_MAP.keys()).sort((a, b) => b.length - a.length);
    for (const alias of sortedNormalized) {
      if (normalizedInput.includes(alias) && alias.length >= 4) {
        return { entry: ENTITY_NORMALIZED_ALIAS_MAP.get(alias)!, matchedAlias: alias };
      }
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Hard-guard utility sets  (used by analyzeData.ts)
// OPERATIONAL = deepsea_terminal + depot + transporter (approved hauliers ONLY).
// KNOWN_CARRIERS ('carrier' type) are EXCLUDED from operational sets
// (they do NOT appear in Transporter Performance, as they are not approved hauliers).
// Carriers are blocked from customer inference — a known logistics company in the
// customer column is a data-quality issue, not a genuine customer account.
// Use isBlockedFromCustomerRole() for all customer-assignment guard points.
// ─────────────────────────────────────────────────────────────────

/** Canonical names of true operational entities (terminal / depot / approved haulier).
 *  Note: KNOWN_CARRIERS are excluded from this set (not operational) but are separately
 *  blocked from customer inference via isBlockedFromCustomerRole(). */
export const OPERATIONAL_CANONICAL_NAMES: Set<string> = new Set(
  [...DEEPSEA_TERMINALS, ...INLAND_DEPOTS, ...APPROVED_TRANSPORTERS].map(e => e.canonicalName.toLowerCase())
);

/** All aliases of true operational entities */
export const OPERATIONAL_ALIAS_SET: Set<string> = new Set(
  [...DEEPSEA_TERMINALS, ...INLAND_DEPOTS, ...APPROVED_TRANSPORTERS].flatMap(e => e.aliases)
);

// ─────────────────────────────────────────────────────────────────
// TRANSPORTER-CAPABLE sets
// Includes ALL entities with 'transporter' in their roles:
//   - The 6 approved specialist hauliers (entityType='transporter')
//   - Dual-role depot+transporter entities (Germersheim, HP Duisburg,
//     Contargo variants, Frankenbach, HGK, CTV, EKB)
// These are the ONLY entities that may appear in Transporter Performance.
// ─────────────────────────────────────────────────────────────────

/** Canonical names of all entities with 'transporter' in their roles */
export const TRANSPORTER_ROLE_CANONICAL: Set<string> = new Set(
  ALL_ENTITIES
    .filter(e => e.roles.includes('transporter'))
    .map(e => e.canonicalName.toLowerCase())
);

/** All aliases of transporter-capable entities */
export const TRANSPORTER_ROLE_ALIASES: Set<string> = new Set(
  ALL_ENTITIES
    .filter(e => e.roles.includes('transporter'))
    .flatMap(e => e.aliases)
);

/** All canonical names of entities with 'depot' in their roles */
export const DEPOT_ROLE_CANONICAL: Set<string> = new Set(
  ALL_ENTITIES
    .filter(e => e.roles.includes('depot'))
    .map(e => e.canonicalName.toLowerCase())
);

/**
 * Returns true if the name belongs to a true operational entity
 * (approved haulier, inland depot, or approved deep sea terminal).
 * These names must NEVER enter customer-level reporting.
 * KNOWN_CARRIERS ('carrier' type) are NOT considered operational here.
 */
export function isKnownOperationalEntity(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (OPERATIONAL_CANONICAL_NAMES.has(lower)) return true;
  if (OPERATIONAL_ALIAS_SET.has(lower)) return true;
  const hit = lookupEntity(name);
  return hit !== null && (
    hit.entry.entityType === 'deepsea_terminal' ||
    hit.entry.entityType === 'depot' ||
    hit.entry.entityType === 'transporter'
  );
}

/**
 * Returns true for ANY entity with 'transporter' in its roles.
 * This includes:
 *   - The 6 approved specialist inland hauliers
 *   - Dual-role depot+transporter entities (Germersheim, Contargo, HP Duisburg,
 *     Frankenbach, HGK, CTV Vrede, EKB Transport)
 * KNOWN_CARRIERS have roles=['carrier'] and will NOT pass this check.
 * Only transporter-capable entities may appear in Transporter Performance reporting.
 */
export function isApprovedTransporter(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (TRANSPORTER_ROLE_CANONICAL.has(lower)) return true;
  if (TRANSPORTER_ROLE_ALIASES.has(lower)) return true;
  // Partial match against transporter-capable aliases
  for (const alias of TRANSPORTER_ROLE_ALIASES) {
    if (lower.includes(alias)) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────
// OCEAN CARRIER NAME PATTERNS
//
// Ocean/deepsea carrier names that may appear in the Account Name column
// but are NOT in the KNOWN_CARRIERS entity dictionary (or need belt-and-
// suspenders protection). These are shipping line counterparties, not
// customer accounts, and must never appear in Customer Burden reporting.
// ─────────────────────────────────────────────────────────────────
const OCEAN_CARRIER_PATTERNS: RegExp[] = [
  /\bmaersk\s*(line|shipping|sealand|logistics|air|supply)?\b/i,
  /\bcma\s*cgm\b/i,
  /\bhapag[\s-]*lloyd\b/i,
  /\bmediterranean\s*shipping\s*(co|company)?\b/i,
  /^msc$/i,                          // MSC as standalone label only (not substring)
  /^msc\s+(mediterranean|shipping|line|transport)\b/i,  // MSC compound names
  /\bevergreen\s*(line|marine|shipping|container)?\b/i,
  /\bcosco\s*(shipping|container|logistics|line)?\b/i,
  /\byang\s*ming\b/i,
  /\bhanjin\s*(shipping|line)?\b/i,
  /\bone\s*ocean\s*network\b/i,      // Ocean Network Express (full name)
  /\bzim\s*(integrated|shipping|line)?\b/i,
  /\bpil\b/i,                        // Pacific International Lines
  /\bwanhai\s*(lines|shipping)?\b/i,
  /\bturkon\s*(line|container)?\b/i,
  /\bkmtc\b/i,
];

/**
 * Returns true if the name should be BLOCKED from appearing as a resolved customer.
 *
 * Blocked categories:
 *   - Operational entities: deepsea_terminal, depot, approved transporter
 *   - Recognised external carriers (KNOWN_CARRIERS) — logistics cos, not customers
 *   - Ocean carrier names (shipping lines — counterparties, not customers)
 *   - Internal ISR / Maersk address-book entries
 *   - Generic junk placeholder labels
 *
 * Use this function at every customer-assignment decision point.
 */
// Terminal/port operator names that may appear in customer fields but are NOT customers.
// These are port authorities and terminal operators — operational entities like depots.
const TERMINAL_OPERATOR_PATTERNS: RegExp[] = [
  /\bhutchison\s+ports?\b/i,        // Hutchison Ports [city] B.V., Hutchison Ports Venlo, etc.
  /\bapm\s+terminals?\b/i,          // APM Terminals [city] — should match entity dict but belt-and-suspenders
  /\bdp\s+world\b/i,                // DP World [city]
  /\beuroport\b/i,                  // Europort [terminal]
  /\bport\s+authority\b/i,          // Port Authority [of...]
  /\bhavenbedrijf\b/i,              // Dutch: port company (Havenbedrijf Rotterdam)
];

export function isBlockedFromCustomerRole(name: string): boolean {
  if (!name) return false;
  if (isKnownOperationalEntity(name)) return true;
  if (isInternalISRLabel(name)) return true;
  if (isCustomerJunkLabel(name)) return true;
  // Block recognized carrier entities from entity dictionary
  const hit = lookupEntity(name);
  if (hit && hit.entry.entityType === 'carrier') return true;
  // Block ocean carrier names not explicitly in the entity dictionary
  if (OCEAN_CARRIER_PATTERNS.some(p => p.test(name))) return true;
  // Block terminal/port operator names
  if (TERMINAL_OPERATOR_PATTERNS.some(p => p.test(name))) return true;
  return false;
}

// ─────────────────────────────────────────────────────────────────
// POSITIVE CUSTOMER CANDIDATE GATE
//
// isPositiveCustomerCandidate() implements the strict positive acceptance
// rule: a name must LOOK LIKE a real business/company to appear in
// Customer Burden reporting. "Not blocked" alone is insufficient.
//
// Acceptance criteria (any one of):
//   1. Contains a recognised company legal suffix (GmbH, B.V., Ltd, etc.)
//   2. After stripping legal suffixes, at least one remaining word is NOT
//      in the logistics junk vocabulary (JUNK_SINGLE_WORDS)
//
// This rejects values like:
//   - "Logistics"           → only junk words
//   - "Transport GmbH"      → "transport" is junk, but suffix → accepted
//     (this is slightly lenient; real company "Transport GmbH" is accepted)
//   - "Service"             → only junk words, no suffix → rejected
//   - "BASF"                → not in junk → accepted
//   - "Volkswagen AG"       → has suffix → accepted
// ─────────────────────────────────────────────────────────────────

// Company legal suffix regex — strong positive signal
const COMPANY_SUFFIX_RE = /\b(g\.?m\.?b\.?h\.?|b\.?v\.?|n\.?v\.?|ltd\.?|llc|inc\.?|s\.?a\.?|a\.?g\.?|plc|corp\.?|s\.?r\.?l\.?|sarl|bvba|aps|a\.?s\.?|s\.?e\.?|k\.?g\.?|u\.?g\.?|p\.?t\.?e\.?|pvt\.?|bhd\.?|o\.?y\.?|a\.?b\.?)\b/i;

/**
 * Returns true if the name passes the positive customer acceptance gate.
 *
 * A value may appear in Customer Burden only if:
 *   - It has a recognised company legal suffix, OR
 *   - After stripping suffixes, at least one word is not in the logistics
 *     junk vocabulary (meaning it has real company-name substance)
 *
 * This is always evaluated AFTER isBlockedFromCustomerRole() has passed.
 * "Not blocked" alone is not enough — this positive gate must also pass.
 */
export function isPositiveCustomerCandidate(name: string): boolean {
  if (!name || name.trim().length < 2) return false;
  const t = name.trim();

  // Strong positive: has a company legal suffix
  if (COMPANY_SUFFIX_RE.test(t)) return true;

  // Normalize: strip legal suffixes, lowercase, split into words
  const stripped = normalizeForMatching(t);
  const words = stripped.split(/\s+/).filter(w => w.length >= 2);
  if (words.length === 0) return false;

  // At least one word must NOT be in the logistics junk vocabulary
  return words.some(w => !JUNK_SINGLE_WORDS.has(w));
}

/**
 * Look up all roles for a given canonical name.
 * Returns empty array if entity not found.
 */
export function getEntityRoles(canonicalName: string): EntityType[] {
  const lower = canonicalName.toLowerCase().trim();
  for (const entry of ALL_ENTITIES) {
    if (entry.canonicalName.toLowerCase() === lower) return entry.roles;
  }
  return [];
}

// ─────────────────────────────────────────────────────────────────
// INTERNAL ISR LABEL DETECTION
//
// Patterns that identify internal Maersk/MSL mailbox or address-book
// entries rather than real customers.  These feed issue-state logic
// (reference updates, amendments, customs docs) but must NEVER appear
// in Customer Burden or other customer-facing charts.
// ─────────────────────────────────────────────────────────────────
const INTERNAL_ISR_PATTERNS: RegExp[] = [
  /internal global address book/i,
  /\bglobal\s+address\s+book\b/i,       // "Global Address Book Europe" etc.
  /\binternal\s*[-–]\s*global\b/i,      // "Internal - Global Address Book"
  /maersk\s+line.*do not use/i,
  /msl.*internal/i,
  /do not use/i,
  /\bmaersk\s+internal\b/i,
  /\bisr\s+mailbox\b/i,
  /address\s+book.*blank/i,
  /address\s+book.*germany/i,
  /address\s+book.*hamburg/i,
  /\bmsl\s*-\s*hamburg\b/i,
  /\bmaersk\s+line\s*-\s*do/i,
];

/**
 * Returns true if the name looks like an internal ISR / Maersk address-book
 * entry rather than a real external customer.
 * These must not appear in any customer-level reporting.
 */
export function isInternalISRLabel(name: string): boolean {
  if (!name) return false;
  return INTERNAL_ISR_PATTERNS.some(p => p.test(name));
}

// ─────────────────────────────────────────────────────────────────
// CUSTOMER JUNK BLACKLIST
//
// Generic, non-company placeholder labels that sometimes appear in
// the customer column but carry no meaningful account identity.
// Block these from customer charts and treat as unresolved.
//
// THREE-LAYER DETECTION:
//  1. CUSTOMER_JUNK_EXACT      — exact lowercase matches for known junk values
//  2. JUNK_SINGLE_WORDS        — comprehensive set of logistics/ops vocabulary words;
//                                any name consisting ONLY of words from this set is junk
//  3. CUSTOMER_JUNK_PATTERNS   — regex patterns for fragments and non-company text
// ─────────────────────────────────────────────────────────────────

// Layer 1 — exact-match junk values (lowercase, trimmed)
const CUSTOMER_JUNK_EXACT = new Set<string>([
  // Generic role/function labels masquerading as customer names
  'service',
  'service representative',
  'service intermodal',
  'service team',
  'reference',
  'intermodal',
  'delivery',
  'logistics',
  'forwarding',
  'transport',
  'shipping',
  'freight',
  'rail',
  'barge',
  'inland',
  'serve',
  // More single-word operational role labels
  'pickup',
  'collection',
  'export',
  'import',
  'booking',
  'amendment',
  'correction',
  'status',
  'tracking',
  'vessel',
  'shipment',
  'cargo',
  'loading',
  'unloading',
  'dispatch',
  'clearance',
  'inspection',
  'manifest',
  'release',
  'acceptance',
  'confirmation',
  'documentation',
  'document',
  'customs',
  'terminal',
  'handling',
  'storage',
  'warehouse',
  'distribution',
  'hub',
  'allocation',
  'reply',
  'response',
  'escalation',
  'query',
  'enquiry',
  'inquiry',
  'claim',
  'damage',
  'support',
  'advice',
  'instruction',
  'notification',
  'update',
  'information',
  'delay',
  'waiting',
  'carrier',
  'haulier',
  'hauler',
  'agent',
  'broker',
  'operator',
  'company',
  'customer',
  'account',
  'client',
  // Operational phrase fragments
  'rail-und barge',
  'serve - rail-und barge',
  'not be able to load',
  'unable to load',
  // German operational single words / short labels
  'spedition',
  'spediteur',
  'logistik',
  'verkehr',
  'hafen',
  'lager',
  'versand',
  'frachtfuehrer',
  // Dutch operational single words
  'vervoer',
  'vervoerder',
  'afzender',
  'ontvanger',
  'expediteur',
  'expeditie',
  'opslag',
  // French operational single words
  'logistique',
  'transitaire',
  'transporteur',
  // Service-type role labels (internal team/route labels, not customers)
  'service representative dry',
  'service representative wet',
  'service representative reefer',
  'service intermodal',
  'service intermodal rotterdam',
  'service neuss',
  'service duisburg',
  'service rotterdam',
  'service hamburg',
  'service dry',
  'service wet',
  'service reefer',
  'service bulk',
  // Single-word non-company values
  'manager',
  'management',
  'now',
  'dry',
  'wet',
  'reefer',
  // Generic non-value placeholders
  'unknown',
  'n/a',
  'na',
  'none',
  '-',
  '--',
  '---',
  '.',
  'null',
  'tbd',
  'tba',
  'blank',
  'not specified',
  'not provided',
  'no customer',
  'no account',
  'general',
  'general customer',
  'test',
  'test customer',
  'test account',
  'demo',
  'placeholder',
  'end customer',
  'shipper',
  'consignee',
  'receiver',
  'sender',
]);

// Layer 2 — single-word operational vocabulary set
// Any name whose words are ALL from this set is treated as junk.
// This catches: "Service Logistics", "Delivery Transport", "Freight Forwarding", etc.
// without blocking real names like "Maersk Logistics" (Maersk not in set).
//
// IMPORTANT: isCustomerJunkLabel() strips legal suffixes (GmbH, B.V., etc.) BEFORE
// running the Layer 2 check. This means "Logistik GmbH" → "logistik" → junk,
// while "BASF GmbH" → "basf" → NOT in this set → not junk.
const JUNK_SINGLE_WORDS = new Set<string>([
  // English operational vocabulary
  'service','representative','intermodal','reference','delivery','logistics',
  'forwarding','transport','transportation','shipping','freight','rail','barge',
  'inland','serve','pickup','collection','export','import','booking','amendment',
  'correction','status','tracking','vessel','shipment','cargo','loading',
  'unloading','dispatch','clearance','inspection','manifest','release',
  'acceptance','confirmation','documentation','document','customs','terminal',
  'handling','storage','warehouse','distribution','hub','allocation','reply',
  'response','escalation','query','enquiry','inquiry','claim','damage','support',
  'advice','instruction','notification','update','information','delay','waiting',
  'carrier','haulier','hauler','agent','broker','operator','company','customer',
  'account','client','shipper','consignee','receiver','sender','team',
  'general','unknown','test','demo','placeholder','blank','null','none',
  'fleet','drayage','multimodal','consolidation','repositioning','empties',
  'haulage','groupage','crossdock',
  // Person/role titles (not company names)
  'manager','management','director','supervisor','coordinator','operator',
  // Cargo type labels (used internally to classify service routes, not customers)
  'dry','wet','reefer','bulk','breakbulk',
  // Time/status placeholders
  'now','pending','open','closed','active','inactive',
  // German operational vocabulary (frequently appear as junk customer labels)
  'spedition',      // German: freight forwarding company
  'spediteur',      // German: freight forwarder (person/company)
  'logistik',       // German: logistics
  'verkehr',        // German: traffic/transport
  'hafen',          // German: port/harbour
  'lager',          // German: warehouse/storage
  'versand',        // German: dispatch/shipping
  'empfang',        // German: reception/receipt
  'absender',       // German: sender
  'empfaenger',     // German: receiver (alternate spelling)
  'frachtfuehrer',  // German: carrier
  'speicherung',    // German: storage
  // Dutch operational vocabulary
  'vervoer',        // Dutch: transport
  'vervoerder',     // Dutch: carrier
  'afzender',       // Dutch: sender/shipper
  'ontvanger',      // Dutch: receiver/consignee
  'expediteur',     // Dutch: freight forwarder
  'expeditie',      // Dutch: freight forwarding
  'opslag',         // Dutch: storage/warehousing
  'inklaring',      // Dutch: customs clearance
  'goederenvervoer',// Dutch: freight transport
  // French operational vocabulary
  'transitaire',    // French: freight forwarder
  'transporteur',   // French: carrier
  'expediteur',     // French: shipper/forwarder (overlaps Dutch)
  'logistique',     // French: logistics
]);

// Layer 3 — regex patterns for non-company text
const CUSTOMER_JUNK_PATTERNS: RegExp[] = [
  // "not be able to ..." / "unable to ..." — action phrases, not company names
  /^(not be able to|unable to|cannot|can't)\b/i,
  // "serve - " or "service - " prefix followed by operational words
  /^serv(e|ice)\s*[-–]\s*(rail|barge|inland|transport|logistics)/i,
  // Pure operational instructions or email-fragment-style strings
  /^(please|kindly|urgent|asap|re:|fw:|fwd:|attn:|attention:|see below|find below|as per|per your|as discussed)\b/i,
  // Strings that look like email addresses or partial mailbox names
  /@[a-z0-9.-]+\.[a-z]{2,}/i,
  // Purely numeric or very-short non-alphabetic strings
  /^[\d\s\-_./:]{1,10}$/,
  // Raw ZIP code area labels (e.g. "ZIP 55116") — should not reach customer
  /^ZIP\s+\d/i,
  // Parenthetical or bracket-only fragments
  /^\[.*\]$|^\(.*\)$/,
  // Strings that look like case reference IDs
  /^(case|ticket|ref|incident|issue)[:\s#]+[\w\-]+$/i,
  // Strings ending in operational suffixes with no company context
  /\b(team|group|department|dept|division|unit|desk|inbox|mailbox|queue)$/i,
  // IBAN / bank account numbers — e.g. "NL57ABNA0421705191", "DE89370400440532013000"
  /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/,
  // Shipping/container/booking reference codes — e.g. "MAEU262065895", "TCKU1234567"
  /^[A-Z]{3,4}\d{7,12}$/,
  // Long purely alphanumeric codes without spaces (reference codes, not names)
  /^[A-Z0-9]{10,25}$/,

  // ── Sentence fragment detection ────────────────────────────────
  // The patterns below target text that is clearly email body prose rather than
  // a company name. These leak into the customer column when the Account Name
  // field in the source Excel contains a copy of email text rather than an account.

  // Finite English verb phrases — sentences, not names
  // e.g. "did not forward the customs documents to"
  //      "has not been received", "was not provided"
  /\b(did\s+not|has\s+not|have\s+not|was\s+not|were\s+not|had\s+not|is\s+not|are\s+not|could\s+not|would\s+not|will\s+not|shall\s+not|does\s+not|do\s+not)\b/i,

  // Auto-generated system / email notification phrases
  // e.g. "This is an automatically generated E-mail"
  /\bautomatically\s+generated\b/i,
  /\bdo\s+not\s+reply\b/i,
  /\bnoreply\b/i,
  /\bno[\s\-]?reply\b/i,

  // Sentence-opener patterns (articles/demonstratives starting a phrase — never a company name)
  // e.g. "This is an automatically generated E-mail", "The following documents are"
  /^(this\s+(is|was|are|will)|there\s+(is|are|was|were)|it\s+(is|was)|the\s+(above|below|following|attached|enclosed))\b/i,

  // Fragment ending with a bare preposition (sentence tail, not a company name)
  // e.g. "did not forward the customs documents to"
  //      "please send the documents to", "forwarded to"
  /\s+(to|from|for|with|of|by|at|in|on)\s*\.?\s*$/i,

  // Portal / system / interface as the only content (not a company name)
  // e.g. "Portal.", "System", "Platform"
  /^(portal|system|platform|application|app|software|database|server|interface|module|dashboard|tool|solution|service\s+portal|customer\s+portal|web\s+portal)\.?\s*$/i,

  // "Service Representative [anything]" — internal service-role labels, not customers.
  // e.g. "Service Representative Dry", "Service Representative Reefer"
  /^service\s+representative\b/i,

  // "Service [cargo-type or city]" — internal service-route labels, not customers.
  // e.g. "Service Dry", "Service Intermodal Rotterdam", "Service Neuss", "Service Reefer"
  /^service\s+(dry|wet|reefer|bulk|breakbulk|intermodal|ro-ro|inland|barge|rail|neuss|duisburg|rotterdam|hamburg|antwerp|germany|netherlands|europe)\b/i,
];

/**
 * Returns true if the name is a generic junk label rather than a real company.
 *
 * Uses three layers of detection:
 * 1. Exact lowercase match against CUSTOMER_JUNK_EXACT
 * 2. All-junk-words check after stripping legal suffixes (GmbH, B.V., NV, etc.):
 *      - "Logistik GmbH" → strip → "logistik" → in JUNK_SINGLE_WORDS → junk
 *      - "BASF GmbH" → strip → "basf" → NOT in JUNK_SINGLE_WORDS → not junk
 *      - "Transport Service NV" → strip → "transport service" → both in set → junk
 * 3. Regex pattern match against CUSTOMER_JUNK_PATTERNS
 *
 * A company name is only accepted when NONE of the three layers fire.
 */
export function isCustomerJunkLabel(name: string): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // Hard minimum: single characters are never companies
  if (lower.length < 2) return true;

  // Layer 1: exact match
  if (CUSTOMER_JUNK_EXACT.has(lower)) return true;

  // Layer 2: strip legal suffixes THEN check if every remaining word is generic ops vocabulary.
  // This catches "Logistik GmbH", "Spedition BV", "Transport Service NV", etc.
  // while preserving real names like "BASF GmbH" or "Maersk Logistics".
  const strippedForWordCheck = normalizeForMatching(lower); // strips GmbH, B.V., NV, etc.
  const words = strippedForWordCheck.split(/[\s\-–_/]+/).filter(w => w.length > 1);
  if (words.length >= 1 && words.every(w => JUNK_SINGLE_WORDS.has(w))) return true;

  // Layer 2b: word-count ceiling — sentence fragments leaked from email body.
  // Real company names almost never exceed 6 whitespace-separated tokens.
  // Strings with 6+ tokens that lack a legal suffix are almost certainly prose.
  // We skip this check when the original name contains a legal suffix (e.g. "BASF
  // Chemicals Europe GmbH & Co. KG" is legitimate even though it is long).
  const rawTokens = trimmed.split(/\s+/);
  const hasLegalSuffix = /\b(gmbh|b\.?v\.?|n\.?v\.?|s\.?a\.?|ltd\.?|limited|inc\.?|corp\.?|llc\.?|plc\.?|a\.?g\.?|s\.?e\.?|k\.?g\.?|u\.?g\.?|s\.?r\.?l\.?|s\.?p\.?a\.?)\b/i.test(trimmed);
  if (rawTokens.length >= 6 && !hasLegalSuffix) return true;

  // Layer 3: regex patterns
  if (CUSTOMER_JUNK_PATTERNS.some(p => p.test(trimmed))) return true;

  return false;
}
// ─────────────────────────────────────────────────────────────────
// OUTPUT QUALITY VALIDATION
//
// Call validateOutputGuards() after aggregation to detect any
// data-quality violations in the final dashboard output.
// Returns an array of violations (empty = clean).
// ─────────────────────────────────────────────────────────────────

export interface ValidationViolation {
  rule: string;
  offender: string;
  severity: 'ERROR' | 'WARN';
}

// ─────────────────────────────────────────────────────────────────
// AREA HOTSPOT ALLOWLIST — STRICT POSITIVE GATE
//
// Only the operational inland routing areas and the two approved
// deepsea port clusters may appear in the Area Hotspots chart.
//
// ALL other geographic labels (generic DE cities, NL/BE cities,
// raw ZIP codes, etc.) are suppressed from chart output.
// If a new operational area needs to be added, it must be explicitly
// included in this allowlist.
// ─────────────────────────────────────────────────────────────────

/** Exact area label names that are allowed in the Area Hotspot chart */
const ALLOWED_AREA_LABELS = new Set<string>([
  // Inland routing clusters
  'Mainz / Germersheim',
  'Duisburg / Rhine-Ruhr',
  // Deepsea port visibility (optional — retain for terminal context)
  'Rotterdam',
  'Rotterdam / Dordrecht',
  'Antwerp',
]);

/**
 * Returns true if an area name is safe to show in the Area Hotspot chart.
 * Uses a strict positive allowlist — only explicitly approved area labels pass.
 * All other geographic labels (raw ZIPs, generic cities, NL/BE areas) are suppressed.
 */
export function isAllowedAreaLabel(name: string): boolean {
  if (!name) return false;
  return ALLOWED_AREA_LABELS.has(name);
}

/**
 * Scan aggregated dashboard output for rule violations.
 *
 * Checks enforced (all ERROR severity unless noted):
 *  1. No operational entity (depot/terminal/approved haulier) in Customer Burden
 *  2. No internal ISR / Maersk address-book label in Customer Burden
 *  3. No junk placeholder in Customer Burden
 *  4. No recognised external carrier (KNOWN_CARRIERS) in Customer Burden
 *  5. No ocean carrier / counterparty name in Customer Burden
 *  6. Positive company name gate — name must pass isPositiveCustomerCandidate
 *  7. Only approved transporters in Transporter Performance
 *  8. Area Hotspots uses only allowlisted operational labels (strict positive gate)
 *  9. Named hardcoded entities that must never appear in Customer Burden
 * 10. Case number presence check (WARN)
 * 11. Dictionary integrity — all required approved transporters resolvable (WARN)
 */
export function validateOutputGuards(
  customerBurden:         Array<{ name: string }>,
  transporterPerformance: Array<{ name: string }>,
  areaHotspots?:          Array<{ name: string }>,
  caseNumberPreservation?: { totalRecords: number; recordsWithCaseNumber: number },
): ValidationViolation[] {
  const v: ValidationViolation[] = [];

  // Customer Burden checks — each blocked class gets its own rule for actionable output.
  // Priority order mirrors isBlockedFromCustomerRole() but with specific rule names.
  for (const c of customerBurden) {
    if (isKnownOperationalEntity(c.name))
      v.push({ rule: 'OPERATIONAL_ENTITY_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
    else if (isInternalISRLabel(c.name))
      v.push({ rule: 'ISR_LABEL_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
    else if (isCustomerJunkLabel(c.name))
      v.push({ rule: 'JUNK_LABEL_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
    else {
      // Carrier/counterparty checks — two paths: entity dict + ocean carrier regex
      const entityHit = lookupEntity(c.name);
      if (entityHit && entityHit.entry.entityType === 'carrier')
        v.push({ rule: 'CARRIER_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
      else if (OCEAN_CARRIER_PATTERNS.some(p => p.test(c.name)))
        v.push({ rule: 'OCEAN_CARRIER_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
      else if (!isPositiveCustomerCandidate(c.name))
        v.push({ rule: 'NON_COMPANY_NAME_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
    }
  }

  for (const t of transporterPerformance) {
    if (!isApprovedTransporter(t.name))
      v.push({ rule: 'NON_APPROVED_IN_TRANSPORTER', offender: t.name, severity: 'ERROR' });
  }

  if (areaHotspots) {
    for (const a of areaHotspots) {
      if (!isAllowedAreaLabel(a.name)) {
        // ERROR: area allowlist is a definitive positive gate — anything not in it
        // should never reach the chart after both aggregation and component filters.
        v.push({ rule: 'DISALLOWED_AREA_IN_HOTSPOTS', offender: a.name, severity: 'ERROR' });
      }
    }
  }

  // Case number preservation check
  if (caseNumberPreservation && caseNumberPreservation.totalRecords > 0) {
    if (caseNumberPreservation.recordsWithCaseNumber === 0) {
      v.push({ rule: 'NO_CASE_NUMBERS_IN_DATASET', offender: '(all records)', severity: 'WARN' });
    }
  }

  // Explicit named entities that must never appear in Customer Burden
  const neverInCustomer = [
    'hutchison ports duisburg', 'hp duisburg',
    'falco lines belgium nv',
    'european gateway services',
    'dp world intermodal b.v.', 'dp world',
    'cts container-terminal gmbh', 'cts container terminal',
    'maersk line', 'maersk', 'msc', 'cma cgm',
  ];
  for (const name of neverInCustomer) {
    const hit = customerBurden.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (hit) v.push({ rule: 'NAMED_ENTITY_IN_CUSTOMER_BURDEN', offender: hit.name, severity: 'ERROR' });
  }

  // Verify approved transporters are in the dictionary
  const requiredTransporters = [
    'optimodal nederland bv', 'kiem transport',
    'dch duesseldorfer container-hafen',
    'h&s andernach', 'bonn azs', 'trier azs', 'egs nuremberg',
    'hutchison ports duisburg', 'european gateway services',
    'cts container-terminal gmbh',
  ];
  for (const alias of requiredTransporters) {
    if (!isApprovedTransporter(alias))
      v.push({ rule: 'APPROVED_TRANSPORTER_MISSING', offender: alias, severity: 'WARN' });
  }

  return v;
}
