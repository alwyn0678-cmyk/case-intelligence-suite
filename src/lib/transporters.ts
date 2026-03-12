// Known transporter / depot keywords used during file parsing to
// reclassify account column values when no dedicated transporter column exists.
// Only includes APPROVED_TRANSPORTERS and INLAND_DEPOTS.
// KNOWN_CARRIERS (DSV, DHL, XPO, etc.) are intentionally excluded here —
// they are not operational entities for this dashboard.

const TRANSPORTER_KEYWORDS: string[] = [
  // Approved specialist inland hauliers
  'starmans',
  'henk dammes',
  'dammes',
  'falcoline',
  'gts coldchain',
  'gts cold',
  'gts truck',
  'gts logistics',
  'gts duisburg',
  'ctv vrede',
  'ctv transport',
  'ekb transport',
  'ekb',

  // Inland depots / barge-rail terminals
  'contargo',
  'zehnhoff',
  'h&s andernach',
  'hs andernach',
  'bonn azs',
  'azs bonn',
  'trier azs',
  'azs trier',
  'egs nuremberg',
  'germersheim dpw',
  'dpw germersheim',
  'dp world germersheim',
  'rheinhafen andernach',
  'gustavsburg',
  'mainz frankenbach',
  'frankenbach',
  'dit depot',
  'rrt depot',
  'hp duisburg',
  'nuernberg cdn',
  'moerdijk',
  'venlo container',
  'nijmegen terminal',
];

export function isTransporter(accountName: string): boolean {
  const lower = accountName.toLowerCase().trim();
  return TRANSPORTER_KEYWORDS.some(kw => lower.includes(kw));
}
