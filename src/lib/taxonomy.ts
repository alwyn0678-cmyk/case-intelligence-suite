export interface TaxonomyItem {
  id: string;
  label: string;
  keywords: string[];
  hours: number;       // estimated hours lost per case
  preventable: boolean;
  color: string;
}

export const ISSUE_TAXONOMY: TaxonomyItem[] = [
  {
    id: 'load_ref',
    label: 'Missing Load Reference',
    keywords: [
      'load ref','loadref','load reference','without reference','no reference',
      'ref missing','booking ref','booking number','without booking','reference number',
      'load number','without load','no load ref','missing reference',
    ],
    hours: 0.5, preventable: true, color: '#dc6d7d',
  },
  {
    id: 'customs',
    label: 'Customs / Documentation',
    keywords: [
      'customs','douane','zoll','declaration','mrn','eur1','certificate of origin',
      'coo','phytosanitary','health cert','import license','export license',
      'commercial invoice','customs clearance','customs hold','customs inspection',
      'import declaration','export declaration','customs duty',
    ],
    hours: 1.5, preventable: true, color: '#d8a34c',
  },
  {
    id: 'portbase',
    label: 'Portbase / Port Notification',
    keywords: [
      'portbase','port notification','port clearance','pre-notification',
      'port system','pcs message','ata notification','atd notification',
      'pre arrival','port entry','terminal notification',
    ],
    hours: 0.75, preventable: true, color: '#7aa2ff',
  },
  {
    id: 'bl',
    label: 'Bill of Lading (B/L)',
    keywords: [
      'bill of lading','b/l','sea waybill','original bl','telex release',
      'surrender bl','express bl','lading','bl correction','bl amendment',
      'release of bl','bl not received','bl missing',
    ],
    hours: 1.0, preventable: false, color: '#52c7c7',
  },
  {
    id: 't1',
    label: 'T1 / Transit Document',
    keywords: [
      't1 document','transit document','community transit','transit declaration',
      'transit entry','t1 missing','t1 error','t1 correction','transit pass',
    ],
    hours: 1.25, preventable: true, color: '#8b7cff',
  },
  {
    id: 'delay',
    label: 'Delay / Not On Time',
    keywords: [
      'delay','delayed','not on time','late arrival','late delivery','missed eta',
      'overdue','behind schedule','no show','punctuality','not arrived',
      'late collection','not collected','not delivered','running late',
      'not on-time','arrival delay',
    ],
    hours: 2.0, preventable: false, color: '#dc6d7d',
  },
  {
    id: 'closing_time',
    label: 'Closing Time / Cutoff',
    keywords: [
      'closing time','cutoff','cut-off','cut off','vgm deadline','vgm cutoff',
      'closing deadline','missed cutoff','closing hour','after cutoff',
      'terminal cutoff','missed closing','before closing',
    ],
    hours: 0.5, preventable: true, color: '#d8a34c',
  },
  {
    id: 'amendment',
    label: 'Amendment / Correction',
    keywords: [
      'amendment','correction','amend','change request','modification',
      'update booking','booking change','rate correction','address correction',
      'consignee change','shipper change','booking amendment',
    ],
    hours: 0.75, preventable: true, color: '#7aa2ff',
  },
  {
    id: 'waiting_time',
    label: 'Waiting Time / Demurrage',
    keywords: [
      'waiting time','demurrage','detention','wait time','waiting costs',
      'standing time','excessive wait','free time exceeded','storage costs',
      'container detention','chassis detention',
    ],
    hours: 1.5, preventable: false, color: '#52c7c7',
  },
  {
    id: 'rate',
    label: 'Rate / Pricing / Invoice',
    keywords: [
      'rate query','pricing','rate dispute','invoice query','overcharge',
      'surcharge','freight rate','rate increase','quotation','tariff',
      'billing query','charge dispute','incorrect invoice','rate discrepancy',
    ],
    hours: 0.5, preventable: false, color: '#8b7cff',
  },
  {
    id: 'damage',
    label: 'Damage / Loss / Claim',
    keywords: [
      'damage','damaged','cargo loss','lost cargo','missing cargo','shortfall',
      'cargo claim','breakage','contamination','stolen cargo','theft',
      'missing goods','shortage','goods missing',
    ],
    hours: 3.0, preventable: false, color: '#dc6d7d',
  },
  {
    id: 'equipment',
    label: 'Container / Equipment',
    keywords: [
      'equipment issue','seal broken','reefer','temperature deviation','swap body',
      'container damage','trailer damage','faulty unit','defective container',
      'container unavailable','equipment shortage',
    ],
    hours: 1.0, preventable: false, color: '#d8a34c',
  },
  {
    id: 'tracking',
    label: 'Tracking / Visibility',
    keywords: [
      'tracking','where is','status update','no update','visibility',
      'track and trace','no tracking','not visible','no information',
      'whereabouts','location query','shipment status',
    ],
    hours: 0.25, preventable: true, color: '#7aa2ff',
  },
  {
    id: 'communication',
    label: 'Communication / Escalation',
    keywords: [
      'no response','no reply','escalation','complaint','dissatisfied',
      'follow-up','follow up','unanswered','not answered',
      'poor communication','urgent escalation','no feedback',
    ],
    hours: 0.5, preventable: true, color: '#52c7c7',
  },
  {
    id: 'other',
    label: 'Other / Unclassified',
    keywords: [],
    hours: 0.5, preventable: false, color: '#a6aec4',
  },
];

export const TAXONOMY_MAP = Object.fromEntries(ISSUE_TAXONOMY.map(t => [t.id, t]));
