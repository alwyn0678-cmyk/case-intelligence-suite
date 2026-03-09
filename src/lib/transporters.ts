// Known transporter keywords derived from zip.xlsx (Truck + Barge-Rail sheets).
// Account names containing any of these (case-insensitive) are classified as
// transporters; everything else is treated as a customer.

const TRANSPORTER_KEYWORDS: string[] = [
  // Truck transporters
  'starmans',
  'henk dammes',
  'falcoline',
  'gts coldchain',
  'gts truck',
  'ctv vrede',
  'hp duisburg truck',
  'ekb',

  // Barge / Rail inland terminals & depots
  'hutchison ports',
  'dit depot',
  'rrt depot',
  'mainz frankenbach',
  'gustavsburg contargo',
  'contargo',
  'bonn azs',
  'am zehnhoff',
  'zehnhoff',
  'trier azs',
  'germersheim dpw',
  'rheinhafen andernach',
  'nuernberg cdn',
];

export function isTransporter(accountName: string): boolean {
  const lower = accountName.toLowerCase().trim();
  return TRANSPORTER_KEYWORDS.some(kw => lower.includes(kw));
}
