// ─────────────────────────────────────────────────────────────────
// Built-in entity reference dictionaries
// Every entity has: canonicalName, entityType, and aliases[]
// Priority for classification: deepsea_terminal > depot > transporter > customer
// 'carrier' = recognised external logistics company; NOT blocked from customer charts;
//             NOT shown in Transporter Performance (approved hauliers only).
// ─────────────────────────────────────────────────────────────────

export type EntityType = 'transporter' | 'depot' | 'deepsea_terminal' | 'customer' | 'carrier' | 'unknown_entity';

export interface EntityEntry {
  canonicalName: string;
  entityType: EntityType;
  aliases: string[];           // all lowercase, used for matching
}

// ─────────────────────────────────────────────────────────────────
// APPROVED DEEP SEA TERMINALS
// Restricted to Rotterdam, Antwerp, and Bremen/Bremerhaven only.
// Hamburg, Felixstowe, Southampton are NOT part of this dashboard.
// ─────────────────────────────────────────────────────────────────
export const DEEPSEA_TERMINALS: EntityEntry[] = [
  // Rotterdam
  { canonicalName: 'ECT Delta Terminal',       entityType: 'deepsea_terminal', aliases: ['ect delta','ect','ect euromax','europe combined terminals'] },
  { canonicalName: 'APM Terminals Maasvlakte', entityType: 'deepsea_terminal', aliases: ['apm terminals','apmt','apm maasvlakte','apmt maasvlakte','apm rotterdam'] },
  { canonicalName: 'RWG Terminal',             entityType: 'deepsea_terminal', aliases: ['rwg','rotterdam world gateway','world gateway'] },
  { canonicalName: 'EUROMAX Terminal',         entityType: 'deepsea_terminal', aliases: ['euromax terminal','euromax rotterdam','euromax'] },
  { canonicalName: 'Hutchison Ports Rotterdam',entityType: 'deepsea_terminal', aliases: ['hutchison ports rotterdam','hutchison rotterdam','hutchison ecth','ecth'] },
  { canonicalName: 'Uniport Multipurpose',     entityType: 'deepsea_terminal', aliases: ['uniport','uniport multipurpose','uniport rotterdam'] },
  { canonicalName: 'OVET Terminal',            entityType: 'deepsea_terminal', aliases: ['ovet','ovet terminal'] },
  // Antwerp
  { canonicalName: 'MSC PSA European Terminal',entityType: 'deepsea_terminal', aliases: ['msct','msc psa','psa antwerp','msc psa european terminal','deurganckdok'] },
  { canonicalName: 'DP World Antwerp Gateway', entityType: 'deepsea_terminal', aliases: ['dp world antwerp','antwerp gateway','dpw antwerp'] },
  { canonicalName: 'PSA HNN Antwerp',          entityType: 'deepsea_terminal', aliases: ['psa hnn','hnn antwerp','hessenatie','north sea terminal antwerp'] },
  { canonicalName: 'Antwerp Terminal',         entityType: 'deepsea_terminal', aliases: ['antwerp terminal','at antwerp'] },
  // Bremen / Bremerhaven
  { canonicalName: 'Eurogate Bremerhaven',     entityType: 'deepsea_terminal', aliases: ['eurogate bremerhaven','bct','bremer container terminal'] },
  { canonicalName: 'NTB Bremerhaven',          entityType: 'deepsea_terminal', aliases: ['ntb','north sea terminal bremerhaven','nst bremerhaven'] },
];

// ─────────────────────────────────────────────────────────────────
// INLAND DEPOTS / BARGE-RAIL TERMINALS
// ─────────────────────────────────────────────────────────────────
export const INLAND_DEPOTS: EntityEntry[] = [
  // Rhine corridor
  { canonicalName: 'Contargo Rhine Ruhr',    entityType: 'depot', aliases: ['contargo rhine ruhr','contargo ruhr','contargo dortmund','contargo duisburg'] },
  { canonicalName: 'Contargo Trimodal',      entityType: 'depot', aliases: ['contargo trimodal','contargo köln','contargo cologne','contargo neuss'] },
  { canonicalName: 'Contargo',               entityType: 'depot', aliases: ['contargo'] },
  { canonicalName: 'ZSK am Zehnhoff',        entityType: 'depot', aliases: ['am zehnhoff','zehnhoff','zsk','andernach zehnhoff'] },
  { canonicalName: 'H&S Andernach',          entityType: 'depot', aliases: ['h&s andernach','h s andernach','hs andernach','deajhra','h&s schiffahrts andernach','h+s andernach'] },
  { canonicalName: 'Bonn AZS',               entityType: 'depot', aliases: ['bonn azs','azs bonn','debnx01','bon depot'] },
  { canonicalName: 'Trier AZS',              entityType: 'depot', aliases: ['trier azs','azs trier','detreaz'] },
  { canonicalName: 'EGS Nuremberg',          entityType: 'depot', aliases: ['egs nuremberg','egs nürnberg','egs','denue02'] },
  { canonicalName: 'Germersheim DPW',        entityType: 'depot', aliases: ['germersheim dpw','dpw germersheim','germersheim','dp world germersheim','degrh01'] },
  { canonicalName: 'Rheinhafen Andernach',   entityType: 'depot', aliases: ['rheinhafen andernach','andernach depot'] },
  { canonicalName: 'Gustavsburg Contargo',   entityType: 'depot', aliases: ['gustavsburg contargo','gustavsburg','contargo gustavsburg'] },
  { canonicalName: 'Mainz Frankenbach',      entityType: 'depot', aliases: ['mainz frankenbach','frankenbach','mainz depot'] },
  // Rhine South / Basel
  { canonicalName: 'Rhenus Basel',           entityType: 'depot', aliases: ['rhenus basel','rhenus port basel','rheinport basel'] },
  { canonicalName: 'Häfen Basel',            entityType: 'depot', aliases: ['häfen basel','hafen basel','rheinhafen basel'] },
  // Ruhr / NRW
  { canonicalName: 'DIT Depot',              entityType: 'depot', aliases: ['dit depot','dit duisburg','duisburg intermodal'] },
  { canonicalName: 'RRT Depot',              entityType: 'depot', aliases: ['rrt depot','rrt duisburg'] },
  { canonicalName: 'Duisburg Hafen',         entityType: 'depot', aliases: ['duisport','duisburg hafen','duisburg port','dusiburg'] },
  { canonicalName: 'HP Duisburg',            entityType: 'depot', aliases: ['hp duisburg'] },
  // Bavaria / South Germany
  { canonicalName: 'Nürnberg CDN',           entityType: 'depot', aliases: ['nuernberg cdn','nürnberg cdn','cdn nuremberg','cdn nürnberg'] },
  { canonicalName: 'München Container Terminal',entityType: 'depot', aliases: ['münchen container','munich container','mct münchen','mct munich'] },
  // Netherlands inland
  { canonicalName: 'Moerdijk Container Terminal',entityType: 'depot', aliases: ['moerdijk','mct moerdijk','container terminal moerdijk'] },
  { canonicalName: 'Nijmegen Inland Terminal',entityType: 'depot', aliases: ['nijmegen terminal','barge nijmegen'] },
  { canonicalName: 'Venlo Container Terminal',entityType: 'depot', aliases: ['venlo terminal','venlo container'] },
  // Belgium inland
  { canonicalName: 'Liège Container Terminal',entityType: 'depot', aliases: ['liège terminal','liege terminal','trilogiport'] },
];

// ─────────────────────────────────────────────────────────────────
// APPROVED SPECIALIST INLAND HAULIERS
// ONLY these 6 appear in Transporter Performance reporting.
// entityType = 'transporter' is EXCLUSIVELY reserved for these.
// ─────────────────────────────────────────────────────────────────
export const APPROVED_TRANSPORTERS: EntityEntry[] = [
  { canonicalName: 'Starmans',    entityType: 'transporter', aliases: ['starmans'] },
  { canonicalName: 'Henk Dammes', entityType: 'transporter', aliases: ['henk dammes','dammes'] },
  { canonicalName: 'Falcoline',   entityType: 'transporter', aliases: ['falcoline','falcoline gmbh','falcoline transport','falcoline spedition'] },
  { canonicalName: 'GTS Coldchain',entityType: 'transporter', aliases: ['gts coldchain','gts cold','gts truck','gts logistics','gts duisburg','gts transport','gts'] },
  { canonicalName: 'CTV Vrede',   entityType: 'transporter', aliases: ['ctv vrede','ctv transport','ctv','ctv spedition','ctv gmbh'] },
  { canonicalName: 'EKB Transport',entityType: 'transporter', aliases: ['ekb transport','ekb'] },
];

// ─────────────────────────────────────────────────────────────────
// KNOWN EXTERNAL CARRIERS
// Recognised for entity disambiguation only.
// entityType = 'carrier' — distinct from 'transporter'.
// These are NOT operational entities for this dashboard:
//   - They DO NOT appear in Transporter Performance
//   - They DO NOT block customer inference (can appear in Customer Burden
//     if that company genuinely raised a case as a counterparty/customer)
// ─────────────────────────────────────────────────────────────────
export const KNOWN_CARRIERS: EntityEntry[] = [
  { canonicalName: 'DB Schenker',        entityType: 'carrier', aliases: ['db schenker','schenker','dbschenker'] },
  { canonicalName: 'DHL Freight',        entityType: 'carrier', aliases: ['dhl freight','dhl logistics','dhl'] },
  { canonicalName: 'DSV',                entityType: 'carrier', aliases: ['dsv road','dsv air','dsv logistics','dsv'] },
  { canonicalName: 'Rhenus Logistics',   entityType: 'carrier', aliases: ['rhenus logistics','rhenus road','rhenus transport'] },
  { canonicalName: 'Dachser',            entityType: 'carrier', aliases: ['dachser'] },
  { canonicalName: 'Kuehne+Nagel',       entityType: 'carrier', aliases: ['kuehne nagel','kühne nagel','kühnenegel','kuhne nagel','k+n','kuehne+nagel'] },
  { canonicalName: 'XPO Logistics',      entityType: 'carrier', aliases: ['xpo logistics','xpo transport','xpo'] },
  { canonicalName: 'Geodis',             entityType: 'carrier', aliases: ['geodis'] },
  { canonicalName: 'Ceva Logistics',     entityType: 'carrier', aliases: ['ceva logistics','ceva'] },
  { canonicalName: 'Raben Group',        entityType: 'carrier', aliases: ['raben group','raben transport','raben'] },
  { canonicalName: 'Gefco',              entityType: 'carrier', aliases: ['gefco','ceva gefco'] },
  { canonicalName: 'Fiege Logistics',    entityType: 'carrier', aliases: ['fiege logistics','fiege'] },
  { canonicalName: 'Samskip',            entityType: 'carrier', aliases: ['samskip'] },
  { canonicalName: 'Nedcargo',           entityType: 'carrier', aliases: ['nedcargo'] },
  { canonicalName: 'Van Dieren Transport',entityType: 'carrier', aliases: ['van dieren','vandieren'] },
  { canonicalName: 'Kloosterboer',       entityType: 'carrier', aliases: ['kloosterboer'] },
  { canonicalName: 'PostNL',             entityType: 'carrier', aliases: ['postnl','post nl'] },
  { canonicalName: 'TNT Express',        entityType: 'carrier', aliases: ['tnt express','tnt'] },
  { canonicalName: 'UPS',                entityType: 'carrier', aliases: ['ups supply chain','ups freight','ups'] },
  { canonicalName: 'FedEx',              entityType: 'carrier', aliases: ['fedex freight','fedex'] },
  { canonicalName: 'Wincanton',          entityType: 'carrier', aliases: ['wincanton'] },
  { canonicalName: 'HGK Shipping',       entityType: 'carrier', aliases: ['hgk shipping','hgk'] },
  { canonicalName: 'Broekman Logistics', entityType: 'carrier', aliases: ['broekman logistics','broekman'] },
  { canonicalName: 'CTD Logistics',      entityType: 'carrier', aliases: ['ctd logistics','ctd'] },
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
// KNOWN_CARRIERS ('carrier' type) are intentionally EXCLUDED from operational
// sets so they do NOT block customer inference or customer-level reporting.
// ─────────────────────────────────────────────────────────────────

/** Canonical names of true operational entities (terminal / depot / approved haulier) */
export const OPERATIONAL_CANONICAL_NAMES: Set<string> = new Set(
  [...DEEPSEA_TERMINALS, ...INLAND_DEPOTS, ...APPROVED_TRANSPORTERS].map(e => e.canonicalName.toLowerCase())
);

/** All aliases of true operational entities */
export const OPERATIONAL_ALIAS_SET: Set<string> = new Set(
  [...DEEPSEA_TERMINALS, ...INLAND_DEPOTS, ...APPROVED_TRANSPORTERS].flatMap(e => e.aliases)
);

/** Approved transporter canonical names — the 6 specialist inland hauliers */
export const APPROVED_TRANSPORTER_CANONICAL: Set<string> = new Set(
  APPROVED_TRANSPORTERS.map(e => e.canonicalName.toLowerCase())
);

/** Approved transporter aliases — all aliases belonging to the 6 hauliers */
export const APPROVED_TRANSPORTER_ALIASES: Set<string> = new Set(
  APPROVED_TRANSPORTERS.flatMap(e => e.aliases)
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
 * Returns true ONLY if the name matches an APPROVED TRANSPORTER
 * (canonical name or alias from APPROVED_TRANSPORTERS only).
 * KNOWN_CARRIERS have entityType='carrier' and will NOT pass this check.
 * Only approved transporters may appear in Transporter Performance reporting.
 */
export function isApprovedTransporter(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (APPROVED_TRANSPORTER_CANONICAL.has(lower)) return true;
  if (APPROVED_TRANSPORTER_ALIASES.has(lower)) return true;
  // Partial match against approved aliases only (not KNOWN_CARRIERS)
  for (const alias of APPROVED_TRANSPORTER_ALIASES) {
    if (lower.includes(alias)) return true;
  }
  return false;
}
