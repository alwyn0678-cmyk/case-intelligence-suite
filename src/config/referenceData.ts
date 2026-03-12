// ─────────────────────────────────────────────────────────────────
// Built-in entity reference dictionaries
// Every entity has: canonicalName, entityType, and aliases[]
// Priority for classification: deepsea_terminal > depot > transporter > customer
// ─────────────────────────────────────────────────────────────────

export type EntityType = 'transporter' | 'depot' | 'deepsea_terminal' | 'customer' | 'unknown_entity';

export interface EntityEntry {
  canonicalName: string;
  entityType: EntityType;
  aliases: string[];           // all lowercase, used for matching
}

// ─────────────────────────────────────────────────────────────────
// DEEPSEA TERMINALS (Rotterdam, Hamburg, Antwerp, Bremen, …)
// ─────────────────────────────────────────────────────────────────
export const DEEPSEA_TERMINALS: EntityEntry[] = [
  // Rotterdam
  { canonicalName: 'ECT Delta Terminal',       entityType: 'deepsea_terminal', aliases: ['ect delta','ect','euromax','ect euromax','europe combined terminals'] },
  { canonicalName: 'APM Terminals Maasvlakte', entityType: 'deepsea_terminal', aliases: ['apm terminals','apmt','apm maasvlakte','apmt maasvlakte','apm rotterdam'] },
  { canonicalName: 'RWG Terminal',             entityType: 'deepsea_terminal', aliases: ['rwg','rotterdam world gateway','world gateway'] },
  { canonicalName: 'EUROMAX Terminal',         entityType: 'deepsea_terminal', aliases: ['euromax terminal','euromax rotterdam'] },
  { canonicalName: 'Hutchison Ports Rotterdam',entityType: 'deepsea_terminal', aliases: ['hutchison ports','hutchison rotterdam','hutchison ecth','ecth'] },
  { canonicalName: 'Uniport Multipurpose',     entityType: 'deepsea_terminal', aliases: ['uniport','uniport multipurpose','uniport rotterdam'] },
  { canonicalName: 'OVET Terminal',            entityType: 'deepsea_terminal', aliases: ['ovet','ovet terminal'] },
  // Hamburg
  { canonicalName: 'HHLA Burchardkai',         entityType: 'deepsea_terminal', aliases: ['burchardkai','hhla burchardkai','ctb','container terminal burchardkai'] },
  { canonicalName: 'HHLA Altenwerder',         entityType: 'deepsea_terminal', aliases: ['altenwerder','cta','container terminal altenwerder','hhla altenwerder'] },
  { canonicalName: 'HHLA Tollerort',           entityType: 'deepsea_terminal', aliases: ['tollerort','ctt','hhla tollerort'] },
  { canonicalName: 'Eurogate Hamburg',         entityType: 'deepsea_terminal', aliases: ['eurogate hamburg','eurogate'] },
  { canonicalName: 'MSC Gate Hamburg',         entityType: 'deepsea_terminal', aliases: ['msc gate','msc gate hamburg'] },
  // Antwerp
  { canonicalName: 'MSC PSA European Terminal',entityType: 'deepsea_terminal', aliases: ['msct','msc psa','psa antwerp','msc psa european terminal','deurganckdok'] },
  { canonicalName: 'DP World Antwerp Gateway', entityType: 'deepsea_terminal', aliases: ['dp world antwerp','antwerp gateway','dpw antwerp'] },
  { canonicalName: 'PSA HNN Antwerp',          entityType: 'deepsea_terminal', aliases: ['psa hnn','hnn antwerp','hessenatie','north sea terminal'] },
  { canonicalName: 'Antwerp Terminal',         entityType: 'deepsea_terminal', aliases: ['antwerp terminal','at antwerp'] },
  // Bremen / Bremerhaven
  { canonicalName: 'Eurogate Bremerhaven',     entityType: 'deepsea_terminal', aliases: ['eurogate bremerhaven','bct','bremer container terminal'] },
  { canonicalName: 'NTB Bremerhaven',          entityType: 'deepsea_terminal', aliases: ['ntb','north sea terminal bremerhaven','nst bremerhaven'] },
  // Felixstowe / UK
  { canonicalName: 'Port of Felixstowe',       entityType: 'deepsea_terminal', aliases: ['felixstowe','port of felixstowe'] },
  { canonicalName: 'DP World Southampton',     entityType: 'deepsea_terminal', aliases: ['southampton','dp world southampton'] },
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
  { canonicalName: 'Germersheim DPW',        entityType: 'depot', aliases: ['germersheim dpw','dpw germersheim','germersheim','dp world germersheim','degrh01','dpw germersheim'] },
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
// Only these 6 appear in Transporter Performance reporting.
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
// KNOWN EXTERNAL CARRIERS (recognised as operational — blocked from
// customer charts — but NOT shown in Transporter Performance)
// ─────────────────────────────────────────────────────────────────
export const KNOWN_CARRIERS: EntityEntry[] = [
  { canonicalName: 'DB Schenker',        entityType: 'transporter', aliases: ['db schenker','schenker','dbschenker'] },
  { canonicalName: 'DHL Freight',        entityType: 'transporter', aliases: ['dhl freight','dhl logistics','dhl'] },
  { canonicalName: 'DSV',                entityType: 'transporter', aliases: ['dsv road','dsv air','dsv logistics','dsv'] },
  { canonicalName: 'Rhenus Logistics',   entityType: 'transporter', aliases: ['rhenus logistics','rhenus road','rhenus transport'] },
  { canonicalName: 'Dachser',            entityType: 'transporter', aliases: ['dachser'] },
  { canonicalName: 'Kuehne+Nagel',       entityType: 'transporter', aliases: ['kuehne nagel','kühne nagel','kühnenegel','kuhne nagel','k+n','kuehne+nagel'] },
  { canonicalName: 'XPO Logistics',      entityType: 'transporter', aliases: ['xpo logistics','xpo transport','xpo'] },
  { canonicalName: 'Geodis',             entityType: 'transporter', aliases: ['geodis'] },
  { canonicalName: 'Ceva Logistics',     entityType: 'transporter', aliases: ['ceva logistics','ceva'] },
  { canonicalName: 'Raben Group',        entityType: 'transporter', aliases: ['raben group','raben transport','raben'] },
  { canonicalName: 'Gefco',              entityType: 'transporter', aliases: ['gefco','ceva gefco'] },
  { canonicalName: 'Fiege Logistics',    entityType: 'transporter', aliases: ['fiege logistics','fiege'] },
  { canonicalName: 'Samskip',            entityType: 'transporter', aliases: ['samskip'] },
  { canonicalName: 'Nedcargo',           entityType: 'transporter', aliases: ['nedcargo'] },
  { canonicalName: 'Van Dieren Transport',entityType: 'transporter', aliases: ['van dieren','vandieren'] },
  { canonicalName: 'Kloosterboer',       entityType: 'transporter', aliases: ['kloosterboer'] },
  { canonicalName: 'PostNL',             entityType: 'transporter', aliases: ['postnl','post nl'] },
  { canonicalName: 'TNT Express',        entityType: 'transporter', aliases: ['tnt express','tnt'] },
  { canonicalName: 'UPS',                entityType: 'transporter', aliases: ['ups supply chain','ups freight','ups'] },
  { canonicalName: 'FedEx',              entityType: 'transporter', aliases: ['fedex freight','fedex'] },
  { canonicalName: 'Wincanton',          entityType: 'transporter', aliases: ['wincanton'] },
  { canonicalName: 'HGK Shipping',       entityType: 'transporter', aliases: ['hgk shipping','hgk'] },
  { canonicalName: 'Broekman Logistics', entityType: 'transporter', aliases: ['broekman logistics','broekman'] },
  { canonicalName: 'CTD Logistics',      entityType: 'transporter', aliases: ['ctd logistics','ctd'] },
];

// Combined export kept for backward compatibility
export const TRANSPORTERS: EntityEntry[] = [...APPROVED_TRANSPORTERS, ...KNOWN_CARRIERS];

// ─────────────────────────────────────────────────────────────────
// Combined lookup (priority order enforced in entityExtraction.ts)
// ─────────────────────────────────────────────────────────────────
export const ALL_ENTITIES: EntityEntry[] = [
  ...DEEPSEA_TERMINALS,
  ...INLAND_DEPOTS,
  ...TRANSPORTERS,
];

/**
 * Build a flat lookup table: alias (lowercase) → EntityEntry
 * When two entries share an alias the higher-priority one wins
 * (deepsea_terminal > depot > transporter).
 */
const PRIORITY: Record<EntityType, number> = {
  deepsea_terminal: 3,
  depot: 2,
  transporter: 1,
  customer: 0,
  unknown_entity: -1,
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
// ─────────────────────────────────────────────────────────────────

/** All canonical names of known operational entities (depot / terminal / transporter) */
export const OPERATIONAL_CANONICAL_NAMES: Set<string> = new Set(
  [...DEEPSEA_TERMINALS, ...INLAND_DEPOTS, ...TRANSPORTERS].map(e => e.canonicalName.toLowerCase())
);

/** All aliases of known operational entities */
export const OPERATIONAL_ALIAS_SET: Set<string> = new Set(
  [...DEEPSEA_TERMINALS, ...INLAND_DEPOTS, ...TRANSPORTERS].flatMap(e => e.aliases)
);

/** Approved transporter canonical names — only the 6 specialist inland hauliers */
export const APPROVED_TRANSPORTER_CANONICAL: Set<string> = new Set(
  APPROVED_TRANSPORTERS.map(e => e.canonicalName.toLowerCase())
);

/**
 * Returns true if the name (canonical or alias) belongs to any known
 * operational entity (transporter, depot, deepsea_terminal).
 * A known operational entity must NEVER enter customer-level reporting.
 */
export function isKnownOperationalEntity(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (OPERATIONAL_CANONICAL_NAMES.has(lower)) return true;
  if (OPERATIONAL_ALIAS_SET.has(lower)) return true;
  // Also run through lookupEntity to catch partial alias matches
  const hit = lookupEntity(name);
  return hit !== null && hit.entry.entityType !== 'customer';
}

/**
 * Returns true only if the name matches an approved transporter canonical name or alias.
 * Only approved transporters may appear in Transporter Performance reporting.
 */
export function isApprovedTransporter(name: string): boolean {
  if (!name) return false;
  const lower = name.toLowerCase().trim();
  if (APPROVED_TRANSPORTER_CANONICAL.has(lower)) return true;
  const hit = lookupEntity(name);
  return hit !== null && hit.entry.entityType === 'transporter';
}
