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
// Only 'carrier' entities can appear in Customer Burden charts.
// ─────────────────────────────────────────────────────────────────

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
  { canonicalName: 'Germersheim DPW',       entityType: 'depot', roles: ['depot','transporter'], aliases: ['germersheim dpw','dpw germersheim','germersheim','dp world germersheim','degrh01'] },
  // HP Duisburg: Rhine barge company that also operates an inland depot
  { canonicalName: 'HP Duisburg',           entityType: 'depot', roles: ['depot','transporter'], aliases: ['hp duisburg'] },
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
  { canonicalName: 'Falcoline',           entityType: 'transporter', roles: ['transporter'],         aliases: ['falcoline','falcoline gmbh','falcoline transport','falcoline spedition','falcoline belgium','falcoline belgie'] },
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
//   - They do NOT block customer inference
// Note: HGK has been moved to INLAND_DEPOTS (dual-role depot+transporter).
// ─────────────────────────────────────────────────────────────────
export const KNOWN_CARRIERS: EntityEntry[] = [
  { canonicalName: 'DB Schenker',         entityType: 'carrier', roles: ['carrier'], aliases: ['db schenker','schenker','dbschenker'] },
  { canonicalName: 'DHL Freight',         entityType: 'carrier', roles: ['carrier'], aliases: ['dhl freight','dhl logistics','dhl'] },
  { canonicalName: 'DSV',                 entityType: 'carrier', roles: ['carrier'], aliases: ['dsv road','dsv air','dsv logistics','dsv'] },
  { canonicalName: 'Rhenus Logistics',    entityType: 'carrier', roles: ['carrier'], aliases: ['rhenus logistics','rhenus road','rhenus transport'] },
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
 * Look up a raw string against the entity alias map.
 * Returns the best matching EntityEntry and the alias that matched, or null.
 */
export function lookupEntity(text: string): { entry: EntityEntry; matchedAlias: string } | null {
  const lower = text.toLowerCase().trim();
  // Try longest aliases first (greedy match) to avoid 'dhl' swallowing 'dhl freight'
  const sortedAliases = Array.from(ENTITY_ALIAS_MAP.keys()).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (lower.includes(alias)) {
      return { entry: ENTITY_ALIAS_MAP.get(alias)!, matchedAlias: alias };
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Hard-guard utility sets  (used by analyzeData.ts)
// OPERATIONAL = deepsea_terminal + depot + transporter (approved hauliers ONLY).
// KNOWN_CARRIERS ('carrier' type) are EXCLUDED from operational sets
// (they do NOT appear in Transporter Performance, as they are not approved hauliers).
// They DO block customer inference — a known logistics carrier appearing in the customer
// column is more likely a data-quality issue than a genuine customer account.
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

/**
 * Returns true if the name should be BLOCKED from appearing as a resolved customer.
 *
 * Blocked categories:
 *   - Operational entities: deepsea_terminal, depot, approved transporter
 *   - Recognised external carriers (KNOWN_CARRIERS) — logistics cos, not customers
 *   - Internal ISR / Maersk address-book entries
 *   - Generic junk placeholder labels
 *
 * Use this function at every customer-assignment decision point.
 */
export function isBlockedFromCustomerRole(name: string): boolean {
  if (!name) return false;
  if (isKnownOperationalEntity(name)) return true;
  if (isInternalISRLabel(name)) return true;
  if (isCustomerJunkLabel(name)) return true;
  // Also block recognized carrier entities
  const hit = lookupEntity(name);
  if (hit && hit.entry.entityType === 'carrier') return true;
  return false;
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
// ─────────────────────────────────────────────────────────────────
const CUSTOMER_JUNK_EXACT = new Set<string>([
  'service',
  'service representative',
  'service intermodal',
  'service team',
  'reference',
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
  'intermodal',
]);

/**
 * Returns true if the name is a generic junk label rather than a real company.
 * These must not appear in Customer Burden or related customer charts.
 */
export function isCustomerJunkLabel(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (lower.length < 2) return true;
  return CUSTOMER_JUNK_EXACT.has(lower);
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

/** Expected operational area labels for German ZIPs */
const OPERATIONAL_AREA_LABELS = new Set(['Mainz / Germersheim', 'Duisburg / Rhine-Ruhr']);

/** Area label patterns that look like they came from DE_RULES generic geography */
const GENERIC_DE_AREA_PATTERN = /^(Berlin|Brandenburg|Hamburg|Hannover|Bremen|Saxony|Rhine-Ruhr|NRW|Münster|Köln|Saarland|Stuttgart|Bavaria|Nuremberg|Thüringen|Brunswick)/i;

/**
 * Scan aggregated dashboard output for rule violations.
 *
 * Checks enforced:
 *  1. No operational entity (depot/terminal/transporter/carrier) in Customer Burden
 *  2. No internal ISR label in Customer Burden
 *  3. No junk placeholder in Customer Burden
 *  4. Only approved transporters in Transporter Performance
 *  5. Area Hotspots for German corridors uses operational labels only
 *  6. All expected approved transporters are resolvable
 */
export function validateOutputGuards(
  customerBurden:         Array<{ name: string }>,
  transporterPerformance: Array<{ name: string }>,
  areaHotspots?:          Array<{ name: string }>,
): ValidationViolation[] {
  const v: ValidationViolation[] = [];

  for (const c of customerBurden) {
    if (isBlockedFromCustomerRole(c.name))
      v.push({ rule: 'BLOCKED_ENTITY_IN_CUSTOMER_BURDEN', offender: c.name, severity: 'ERROR' });
  }

  for (const t of transporterPerformance) {
    if (!isApprovedTransporter(t.name))
      v.push({ rule: 'NON_APPROVED_IN_TRANSPORTER', offender: t.name, severity: 'ERROR' });
  }

  if (areaHotspots) {
    for (const a of areaHotspots) {
      // Flag area names that look like DE_RULES generic geography leaked through
      if (GENERIC_DE_AREA_PATTERN.test(a.name) && !OPERATIONAL_AREA_LABELS.has(a.name)) {
        v.push({ rule: 'GENERIC_DE_AREA_IN_HOTSPOTS', offender: a.name, severity: 'WARN' });
      }
    }
  }

  // Verify approved transporters are in the dictionary
  const requiredTransporters = [
    'optimodal nederland bv', 'kiem transport',
    'dch duesseldorfer container-hafen',
    'h&s andernach', 'bonn azs', 'trier azs', 'egs nuremberg',
  ];
  for (const alias of requiredTransporters) {
    if (!isApprovedTransporter(alias))
      v.push({ rule: 'APPROVED_TRANSPORTER_MISSING', offender: alias, severity: 'WARN' });
  }

  return v;
}
