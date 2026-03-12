// ─────────────────────────────────────────────────────────────────
// Built-in ZIP / postal code → routing area rules
// Eliminates dependency on an external ZIP mapping file upload.
// External upload still works and takes precedence over these rules.
// ─────────────────────────────────────────────────────────────────

export type RoutingAlignment = 'aligned' | 'unusual' | 'conflicting' | 'no_zip';

export interface ZipRule {
  /** Test function: returns true if this rule matches the ZIP */
  test: (zip: string) => boolean;
  area: string;
  /** Typical inland depot/routing corridor for this area */
  typicalRouting?: string;
}

// ─── Business-specific depot routing rules (HIGHEST PRIORITY for DE ZIPs) ────
// Simplified to two operational areas:
//   "Mainz / Germersheim" — FRANKENBACH/MAINZ and GERMERSHEIM DP World corridors
//   "Duisburg / Rhine-Ruhr" — all other German ZIPs (default)
// typicalRouting hints are kept for traceability but area labels are consolidated.
const DE_DEPOT_ROUTING_RULES: ZipRule[] = [
  // FRANKENBACH / MAINZ — 35000-36999 (Kassel / Hessen North)
  { test: z => /^3[56]\d{3}$/.test(z), area: 'Mainz / Germersheim', typicalRouting: 'FRANKENBACH / MAINZ (DEMNZ01)' },
  // FRANKENBACH / MAINZ — 55000-55999 (Mainz / Bingen)
  { test: z => /^55\d{3}$/.test(z), area: 'Mainz / Germersheim', typicalRouting: 'FRANKENBACH / MAINZ (DEMNZ01)' },
  // FRANKENBACH / MAINZ — 60000-65999 (Frankfurt / Rhine-Main)
  { test: z => /^6[0-5]\d{3}$/.test(z), area: 'Mainz / Germersheim', typicalRouting: 'FRANKENBACH / MAINZ (DEMNZ01) — Contargo Gustavsburg alt.' },
  // GERMERSHEIM DP World — 66000-79999 (Saarland / Mannheim / Baden-Württemberg)
  { test: z => /^6[6-9]\d{3}$/.test(z), area: 'Mainz / Germersheim', typicalRouting: 'GERMERSHEIM DP World (DEGRH01)' },
  { test: z => /^7\d{4}$/.test(z),       area: 'Mainz / Germersheim', typicalRouting: 'GERMERSHEIM DP World (DEGRH01)' },
  // GERMERSHEIM DP World — 80000-89999 (Bavaria / Munich)
  { test: z => /^8\d{4}$/.test(z),       area: 'Mainz / Germersheim', typicalRouting: 'GERMERSHEIM DP World (DEGRH01)' },
  // FRANKENBACH / MAINZ — 95000-97999 (Würzburg / Bavaria North)
  { test: z => /^9[5-7]\d{3}$/.test(z), area: 'Mainz / Germersheim', typicalRouting: 'FRANKENBACH / MAINZ (DEMNZ01) — EGS (DENUE02) alt.' },
  // Default: all other 5-digit German ZIPs → Duisburg / Rhine-Ruhr
  { test: z => /^\d{5}$/.test(z), area: 'Duisburg / Rhine-Ruhr', typicalRouting: 'Rhine barge — Duisburg / RRT / DIT' },
];

// ─── German postal codes (5 digits) ──────────────────────────────
// Source: Germany postal code regional breakdown
const DE_RULES: ZipRule[] = [
  { test: z => /^0[1-9]/.test(z), area: 'Saxony / East Germany',      typicalRouting: 'Dresden / Leipzig corridor' },
  { test: z => /^10|^11|^12|^13|^14/.test(z), area: 'Berlin',          typicalRouting: 'Berlin area' },
  { test: z => /^15|^16|^17/.test(z), area: 'Brandenburg',             typicalRouting: 'Berlin / Oder corridor' },
  { test: z => /^18|^19/.test(z), area: 'Mecklenburg / Rostock',       typicalRouting: 'Rostock port area' },
  { test: z => /^20|^21|^22/.test(z), area: 'Hamburg',                 typicalRouting: 'Hamburg deepsea terminal' },
  { test: z => /^23|^24/.test(z), area: 'Schleswig-Holstein',          typicalRouting: 'Hamburg corridor' },
  { test: z => /^25|^26|^27/.test(z), area: 'Lower Saxony North',      typicalRouting: 'Hamburg / Bremen corridor' },
  { test: z => /^28|^29/.test(z), area: 'Bremen',                      typicalRouting: 'Bremen / Bremerhaven port' },
  { test: z => /^30|^31|^32|^33|^34/.test(z), area: 'Hannover / Lower Saxony', typicalRouting: 'Hannover hub' },
  { test: z => /^35|^36|^37/.test(z), area: 'Kassel / Hessen North',   typicalRouting: 'Rhine-Main corridor' },
  { test: z => /^38|^39/.test(z), area: 'Brunswick / Magdeburg',       typicalRouting: 'Hannover / Elbe corridor' },
  { test: z => /^40|^41|^42|^43|^44|^45|^46|^47/.test(z), area: 'Rhine-Ruhr / NRW', typicalRouting: 'Rhine barge — Duisburg/RRT/DIT' },
  { test: z => /^48|^49/.test(z), area: 'Münster / Osnabrück',         typicalRouting: 'Rhine-Ruhr corridor' },
  { test: z => /^50|^51|^52|^53/.test(z), area: 'Köln / Bonn',        typicalRouting: 'Rhine barge — Bonn AZS / Andernach' },
  { test: z => /^54|^55|^56/.test(z), area: 'Rheinland-Pfalz North',   typicalRouting: 'Rhine barge — Andernach / Koblenz' },
  { test: z => /^57|^58|^59/.test(z), area: 'Sauerland / Siegerland',  typicalRouting: 'Rhine-Ruhr corridor' },
  { test: z => /^60|^61|^63|^64|^65/.test(z), area: 'Frankfurt / Rhine-Main', typicalRouting: 'Rhine barge — Mainz / Gustavsburg' },
  { test: z => /^62|^69/.test(z), area: 'Rhine-Neckar',                typicalRouting: 'Rhine barge — Mannheim / Germersheim' },
  { test: z => /^66|^67|^68/.test(z), area: 'Saarland / Mannheim',     typicalRouting: 'Rhine barge — Germersheim' },
  { test: z => /^70|^71|^72|^73|^74|^75/.test(z), area: 'Stuttgart / BW North', typicalRouting: 'Rail/truck — Stuttgart hub' },
  { test: z => /^76|^77|^78|^79/.test(z), area: 'Baden (Freiburg / Karlsruhe)', typicalRouting: 'Rhine barge or truck — Basel / Rheinfelden' },
  { test: z => /^80|^81|^82|^83|^84|^85|^86|^87/.test(z), area: 'Bavaria (Munich)', typicalRouting: 'Rail/truck — Munich hub' },
  { test: z => /^88|^89/.test(z), area: 'Allgäu / Ulm',               typicalRouting: 'Munich / Stuttgart corridor' },
  { test: z => /^90|^91|^92|^93|^94|^95|^96/.test(z), area: 'Nuremberg / Bavaria North', typicalRouting: 'Rail — Nuremberg CDN depot' },
  { test: z => /^97|^98/.test(z), area: 'Würzburg / Bavaria',          typicalRouting: 'Nuremberg / Frankfurt corridor' },
  { test: z => /^99/.test(z), area: 'Thüringen / Erfurt',              typicalRouting: 'Leipzig / Frankfurt corridor' },
];

// ─── Dutch postal codes (4 digits + 2 letters, e.g. 3011 AA) ─────
const NL_RULES: ZipRule[] = [
  { test: z => /^10[0-9][0-9]/.test(z) || /^NL/.test(z.toUpperCase()), area: 'Amsterdam',        typicalRouting: 'Rotterdam / Schiphol' },
  { test: z => /^30[0-9][0-9]/.test(z), area: 'Rotterdam',             typicalRouting: 'Rotterdam deepsea terminal' },
  { test: z => /^31[0-9][0-9]/.test(z), area: 'Rotterdam / Dordrecht', typicalRouting: 'Rotterdam hub' },
  { test: z => /^32[0-9][0-9]/.test(z) || /^33[0-9][0-9]/.test(z), area: 'Utrecht / NL Central', typicalRouting: 'Rotterdam corridor' },
  { test: z => /^51[0-9][0-9]/.test(z) || /^52[0-9][0-9]/.test(z), area: 'Tilburg / Breda',      typicalRouting: 'Antwerp / Rotterdam corridor' },
  { test: z => /^56[0-9][0-9]/.test(z), area: 'Eindhoven',             typicalRouting: 'Antwerp / Rotterdam corridor' },
  { test: z => /^58[0-9][0-9]/.test(z) || /^59[0-9][0-9]/.test(z), area: 'Venlo / Limburg NL',   typicalRouting: 'Venlo inland terminal' },
];

// ─── Belgian postal codes (4 digits starting 1–9) ─────────────
const BE_RULES: ZipRule[] = [
  { test: z => /^[12][0-9][0-9][0-9]/.test(z), area: 'Brussels',           typicalRouting: 'Antwerp corridor' },
  { test: z => /^2[0-9][0-9][0-9]/.test(z),    area: 'Antwerp',            typicalRouting: 'Antwerp deepsea terminal' },
  { test: z => /^3[0-9][0-9][0-9]/.test(z),    area: 'Leuven / Belgium East', typicalRouting: 'Antwerp / Liège corridor' },
  { test: z => /^4[0-9][0-9][0-9]/.test(z),    area: 'Liège / Belgium',    typicalRouting: 'Liège container terminal' },
  { test: z => /^5[0-9][0-9][0-9]/.test(z),    area: 'Namur / Wallonia',   typicalRouting: 'Antwerp / Liège corridor' },
  { test: z => /^6[0-9][0-9][0-9]/.test(z),    area: 'Charleroi / Belgium South', typicalRouting: 'Antwerp corridor' },
  { test: z => /^8[0-9][0-9][0-9]/.test(z),    area: 'Bruges / West Flanders', typicalRouting: 'Bruges / Antwerp port' },
  { test: z => /^9[0-9][0-9][0-9]/.test(z),    area: 'Ghent / East Flanders',   typicalRouting: 'Ghent / Antwerp port' },
];

// ─── Swiss postal codes (4 digits starting 1–9) ───────────────
const CH_RULES: ZipRule[] = [
  { test: z => /^[1-2][0-9][0-9][0-9]/.test(z), area: 'Switzerland (Romandy / Lausanne)', typicalRouting: 'Basel Rhine barge or truck' },
  { test: z => /^3[0-9][0-9][0-9]/.test(z),     area: 'Switzerland (Bern)',                typicalRouting: 'Basel Rhine barge or truck' },
  { test: z => /^4[0-9][0-9][0-9]/.test(z),     area: 'Switzerland (Basel)',               typicalRouting: 'Rhine barge — Häfen Basel' },
  { test: z => /^5[0-9][0-9][0-9]/.test(z),     area: 'Switzerland (Aarau / Aargau)',       typicalRouting: 'Basel / Zurich corridor' },
  { test: z => /^6[0-9][0-9][0-9]/.test(z),     area: 'Switzerland (Lucerne / Zug)',        typicalRouting: 'Basel / Zurich corridor' },
  { test: z => /^[7-8][0-9][0-9][0-9]/.test(z), area: 'Switzerland (Zurich)',               typicalRouting: 'Rail/truck — Zurich hub' },
  { test: z => /^9[0-9][0-9][0-9]/.test(z),     area: 'Switzerland (St. Gallen / East)',   typicalRouting: 'Munich / Zurich corridor' },
];

// ─── Austrian postal codes (4 digits) ─────────────────────────
const AT_RULES: ZipRule[] = [
  { test: z => /^1[0-9][0-9][0-9]/.test(z), area: 'Vienna',            typicalRouting: 'Rail/truck — Vienna hub' },
  { test: z => /^4[0-9][0-9][0-9]/.test(z), area: 'Linz / Upper Austria', typicalRouting: 'Munich / Vienna corridor' },
  { test: z => /^5[0-9][0-9][0-9]/.test(z), area: 'Salzburg',          typicalRouting: 'Munich / Vienna corridor' },
  { test: z => /^6[0-9][0-9][0-9]/.test(z), area: 'Innsbruck / Tyrol', typicalRouting: 'Munich / Brenner corridor' },
  { test: z => /^8[0-9][0-9][0-9]/.test(z), area: 'Graz / Styria',     typicalRouting: 'Vienna / Graz corridor' },
];

// ─── All rules combined ────────────────────────────────────────
const ALL_ZIP_RULES: ZipRule[] = [
  ...DE_DEPOT_ROUTING_RULES,
  ...DE_RULES,
  ...NL_RULES,
  ...BE_RULES,
  ...CH_RULES,
  ...AT_RULES,
];

/**
 * Detect the country prefix from common formats.
 * e.g. "DE-12345", "NL-3011AA", "BE 2000", "CH 8001" etc.
 */
function normalizeZip(raw: string): { zip: string; countryHint: string } {
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');
  const countryMatch = cleaned.match(/^([A-Z]{2})[-\s]?(.+)$/);
  if (countryMatch) {
    return { zip: countryMatch[2], countryHint: countryMatch[1] };
  }
  return { zip: cleaned, countryHint: '' };
}

/**
 * Resolve a raw ZIP/postcode to an area name and optional routing hint.
 * Also checks context for country keywords.
 * Returns null if no rule matches.
 */
export function resolveZipToArea(rawZip: string, contextText = ''): { area: string; typicalRouting?: string } | null {
  if (!rawZip) return null;

  const { zip, countryHint } = normalizeZip(rawZip);
  const ctx = contextText.toLowerCase();

  // Force country rule set based on explicit country hint or context
  const forceNL = countryHint === 'NL' || ctx.includes('netherlands') || ctx.includes('nederland');
  const forceBE = countryHint === 'BE' || ctx.includes('belgium') || ctx.includes('belgie') || ctx.includes('belgique');
  const forceCH = countryHint === 'CH' || ctx.includes('switzerland') || ctx.includes('schweiz') || ctx.includes('suisse');
  const forceAT = countryHint === 'AT' || ctx.includes('austria') || ctx.includes('österreich');

  const ruleSets: ZipRule[][] = [];
  if (forceNL) ruleSets.push(NL_RULES);
  else if (forceBE) ruleSets.push(BE_RULES);
  else if (forceCH) ruleSets.push(CH_RULES);
  else if (forceAT) ruleSets.push(AT_RULES);
  else {
    // Try to infer by ZIP length/format
    const isLikelyDE = /^\d{5}/.test(zip);
    const isLikelyNL = /^\d{4}[A-Z]{2}/.test(zip) || /^\d{4}$/.test(zip);
    const isLikelyBE = /^\d{4}$/.test(zip) && parseInt(zip, 10) >= 1000 && parseInt(zip, 10) <= 9999;

    if (isLikelyDE) ruleSets.push(DE_DEPOT_ROUTING_RULES);
    else if (isLikelyNL) ruleSets.push(NL_RULES);
    else if (isLikelyBE) ruleSets.push(BE_RULES, CH_RULES, AT_RULES);
    else ruleSets.push(DE_DEPOT_ROUTING_RULES, NL_RULES, BE_RULES, CH_RULES, AT_RULES);
  }

  for (const ruleSet of ruleSets) {
    for (const rule of ruleSet) {
      if (rule.test(zip)) return { area: rule.area, typicalRouting: rule.typicalRouting };
    }
  }

  // Final fallback: try all rules
  for (const rule of ALL_ZIP_RULES) {
    if (rule.test(zip)) return { area: rule.area, typicalRouting: rule.typicalRouting };
  }

  return null;
}

/**
 * Extract all ZIP-like patterns from a text string.
 * Returns an array of candidate ZIPs (German, Dutch, Belgian, Swiss formats).
 */
export function extractZipsFromText(text: string): string[] {
  const found: string[] = [];
  // 5-digit German ZIPs
  const de = text.match(/\b\d{5}\b/g);
  if (de) found.push(...de);
  // 4-digit + optional 2 letters (Dutch / Belgian / Swiss)
  const nl = text.match(/\b\d{4}\s?[A-Z]{2}\b/g);
  if (nl) found.push(...nl.map(z => z.replace(/\s/, '')));
  // Country-prefixed codes
  const prefixed = text.match(/\b[A-Z]{2}[-\s]?\d{4,5}\b/g);
  if (prefixed) found.push(...prefixed);
  return [...new Set(found)];
}
