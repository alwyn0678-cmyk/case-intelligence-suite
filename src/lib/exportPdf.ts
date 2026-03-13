import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult } from '../types/analysis';

// ─── Color palette ────────────────────────────────────────────────
// Premium dark theme matching the web dashboard.
const COLORS = {
  // Backgrounds
  bgPrimary:   [18,  18,  30]  as const,   // deep charcoal / near-black
  bgCard:      [28,  28,  42]  as const,   // slightly lighter card background
  bgAccent:    [94,  64, 157]  as const,   // soft purple accent
  bgMuted:     [45,  45,  65]  as const,   // muted slate for alternating rows
  // Text
  textPrimary: [248, 248, 252] as const,   // near-white
  textMuted:   [160, 160, 180] as const,   // muted secondary text
  textAccent:  [179, 136, 255] as const,   // lavender accent text
  // Highlights
  highlightGreen: [72,  199, 142] as const,  // positive / resolved
  highlightAmber: [255, 183,  77] as const,  // warning
  highlightRed:   [255,  99,  99] as const,  // critical / urgent
  highlightBlue:  [100, 181, 246] as const,  // informational
  // Table
  tableHeader: [40,  40,  58]  as const,   // table header background
  tableBorder: [60,  60,  80]  as const,   // subtle border
};

// Legacy aliases kept for internal use
const BG     = COLORS.bgPrimary;
const SURF   = COLORS.bgCard;
const BORDER = COLORS.tableBorder;
const TEXT   = COLORS.textPrimary;
const MUTED  = COLORS.textMuted;
const PURPLE = COLORS.textAccent;
const AMBER  = COLORS.highlightAmber;
const TEAL   = COLORS.highlightGreen;
const RED    = COLORS.highlightRed;

function fill(doc: jsPDF, color: readonly [number,number,number]): void {
  doc.setFillColor(color[0], color[1], color[2]);
}
function ink(doc: jsPDF, color: readonly [number,number,number]): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

type DocWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

function pageHeader(doc: DocWithAutoTable, title: string, pageNum: number): void {
  const W = doc.internal.pageSize.getWidth();
  fill(doc, BG); doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');
  fill(doc, SURF); doc.rect(0, 0, W, 16, 'F');
  // Left: accent bar
  fill(doc, COLORS.bgAccent); doc.rect(0, 0, 3, 16, 'F');
  ink(doc, PURPLE); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('CASE INTELLIGENCE SUITE', 14, 10.5);
  ink(doc, MUTED); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(title, 80, 10.5);
  doc.text(`Page ${pageNum}  ·  ${new Date().toLocaleDateString('en-GB')}`, W - 14, 10.5, { align: 'right' });
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  ink(doc, COLORS.textAccent); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
  doc.text(text, 14, y);
  // Underline rule
  const W = doc.internal.pageSize.getWidth();
  fill(doc, COLORS.bgAccent); doc.rect(14, y + 2, W - 28, 0.5, 'F');
  return y + 12;
}

// KPI tile — draws a rounded card with a large value and small label
function kpiTile(
  doc: jsPDF,
  x: number, y: number, w: number, h: number,
  value: string, label: string,
  valColor: readonly [number,number,number] = COLORS.textAccent,
): void {
  fill(doc, SURF); doc.roundedRect(x, y, w, h, 3, 3, 'F');
  // Top accent bar on card
  fill(doc, COLORS.bgAccent); doc.roundedRect(x, y, w, 2.5, 1, 1, 'F');
  ink(doc, valColor); doc.setFontSize(17); doc.setFont('helvetica', 'bold');
  doc.text(value, x + w / 2, y + h / 2 + 2, { align: 'center' });
  ink(doc, MUTED); doc.setFontSize(6.5); doc.setFont('helvetica', 'normal');
  doc.text(label, x + w / 2, y + h - 5, { align: 'center' });
}

function tableDefaults(headFill: readonly [number,number,number] = COLORS.tableHeader) {
  return {
    headStyles: {
      fillColor: [...headFill]  as [number,number,number],
      textColor: [255, 255, 255] as [number,number,number],
      fontSize: 8,
      fontStyle: 'bold' as const,
    },
    bodyStyles: {
      fillColor: [...SURF]  as [number,number,number],
      textColor: [...TEXT]  as [number,number,number],
      fontSize: 8,
      cellPadding: { top: 4, right: 6, bottom: 4, left: 6 },
    },
    alternateRowStyles: { fillColor: [...COLORS.bgMuted] as [number,number,number] },
    styles: { lineColor: [...BORDER] as [number,number,number], lineWidth: 0.1 },
    margin: { left: 14, right: 14 },
  };
}

// "No data" placeholder for sparse sections
function noDataRow(doc: jsPDF, y: number, message = 'No data available.'): void {
  ink(doc, MUTED); doc.setFontSize(8); doc.setFont('helvetica', 'italic');
  doc.text(message, 14, y);
}

export async function exportToPdf(analysis: AnalysisResult): Promise<void> {
  const { summary, issueBreakdown, customerBurden, transporterPerformance,
          customsCompliance: cc, loadRefIntelligence: lr, areaHotspots, forecast, actions } = analysis;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithAutoTable;
  const W = doc.internal.pageSize.getWidth();
  let pg = 1;

  // ── Cover ────────────────────────────────────────────────────────
  fill(doc, BG); doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');
  // Top accent strip
  fill(doc, COLORS.bgAccent); doc.rect(0, 0, W, 4, 'F');

  ink(doc, MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('OPERATIONAL INTELLIGENCE REPORT', 14, 80);

  ink(doc, TEXT); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
  doc.text('Case Intelligence', 14, 98);
  doc.text('Suite', 14, 112);

  // Vertical accent bar
  fill(doc, COLORS.bgAccent); doc.rect(14, 115, 60, 0.75, 'F');

  ink(doc, MUTED); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${summary.weekRange}`, 14, 132);
  doc.text(`Total Cases: ${summary.totalCases.toLocaleString()}`, 14, 142);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 152);

  // KPI tiles
  const boxY = 172;
  const boxW = 55;
  const boxH = 34;
  kpiTile(doc, 14,        boxY, boxW, boxH, summary.totalCases.toLocaleString(),    'TOTAL CASES',     PURPLE);
  kpiTile(doc, 14+boxW+4, boxY, boxW, boxH, `${summary.preventablePct.toFixed(1)}%`,'PREVENTABLE',     AMBER);
  kpiTile(doc, 14+boxW*2+8,boxY,boxW, boxH, `${summary.totalHoursLost.toFixed(0)}h`,'HOURS LOST',      TEAL);

  // ── Executive Summary ────────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Executive Summary', pg);
  let y = sectionTitle(doc, 'Executive Summary', 26);

  ink(doc, MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(summary.narrative, W - 28);
  doc.text(lines, 14, y); y += lines.length * 5 + 12;

  autoTable(doc, {
    startY: y,
    head: [['KPI', 'Value']],
    body: [
      ['Total Cases',         summary.totalCases.toLocaleString()],
      ['Total Hours Lost',    `${summary.totalHoursLost.toFixed(1)}h`],
      ['Preventable %',       `${summary.preventablePct.toFixed(1)}%`],
      ['Top Issue',           `${summary.topIssue} (${summary.topIssueCount})`],
      ['Top Customer',        `${summary.topCustomer} (${summary.topCustomerCount})`],
      ['Top Area',            `${summary.topArea} (${summary.topAreaCount})`],
      ['Quick Win',           summary.quickWin],
    ],
    ...tableDefaults(),
  });

  // ── Issue Breakdown ──────────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Issue Intelligence', pg);
  y = sectionTitle(doc, 'Issue Intelligence', 26);

  autoTable(doc, {
    startY: y,
    head: [['#', 'Category', 'Cases', '% Total', 'Hours Lost', 'Preventable', 'Trend']],
    body: issueBreakdown.map((i, n) => [
      n + 1,
      i.label,
      i.count,
      `${i.percent.toFixed(1)}%`,
      i.hoursLost.toFixed(1),
      i.preventable ? 'Yes' : 'No',
      i.trend,
    ]),
    ...tableDefaults(),
  });

  // ── Customer Burden ──────────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Customer Burden', pg);
  y = sectionTitle(doc, 'Customer Burden', 26);

  if (customerBurden.length === 0) {
    noDataRow(doc, y + 4, 'No customer data found in this dataset.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Customer', 'Cases', 'Hours', 'Prev%', 'Load Ref', 'Customs', 'Top Issue', 'Risk']],
      body: customerBurden.slice(0, 30).map((c, n) => [
        n + 1,
        c.name,
        c.count,
        c.hoursLost.toFixed(1),
        `${c.preventablePct.toFixed(0)}%`,
        c.missingLoadRef || '—',
        c.missingCustomsDocs || '—',
        c.topIssue,
        c.risk,
      ]),
      ...tableDefaults(),
    });
  }

  // ── Transporter Performance ──────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Transporter Performance', pg);
  y = sectionTitle(doc, 'Transporter Performance', 26);

  if (transporterPerformance.length === 0) {
    noDataRow(doc, y + 4, 'No transporter data found in this dataset.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Transporter', 'Cases', 'Delays', 'Not On Time', 'Wait Time', 'Score', 'Risk']],
      body: transporterPerformance.map((t, n) => [
        n + 1,
        t.name,
        t.count,
        t.delays || '—',
        t.notOnTime || '—',
        t.waitingTime || '—',
        `${t.punctualityScore.toFixed(0)}%`,
        t.risk,
      ]),
      ...tableDefaults(),
    });
  }

  // ── Customs & Compliance ─────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Customs & Compliance', pg);
  y = sectionTitle(doc, 'Customs & Compliance', 26);

  autoTable(doc, {
    startY: y,
    head: [['Category', 'Cases']],
    body: [
      ['Total Compliance Cases', cc.totalCases],
      ['Customs Documentation',  cc.customsDocs],
      ['Portbase Issues',        cc.portbaseIssues],
      ['Bill of Lading (B/L)',   cc.blIssues],
      ['T1 / Transit Documents', cc.t1Issues],
    ],
    ...tableDefaults(),
  });

  // ── Load Reference Intelligence ──────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Load Reference Intelligence', pg);
  y = sectionTitle(doc, 'Load Reference Intelligence', 26);

  // KPI tiles row
  const lrBoxW = 43;
  const lrBoxH = 30;
  const lrBoxGap = 4;
  const lrBoxY = y;

  kpiTile(doc, 14,                        lrBoxY, lrBoxW, lrBoxH,
    lr.totalMissing.toString(), 'TOTAL MISSING', RED);
  kpiTile(doc, 14 + lrBoxW + lrBoxGap,   lrBoxY, lrBoxW, lrBoxH,
    lr.totalProvided !== undefined ? lr.totalProvided.toString() : '—',
    'PROVIDED / UPDATED', TEAL);
  kpiTile(doc, 14 + (lrBoxW + lrBoxGap) * 2, lrBoxY, lrBoxW, lrBoxH,
    `${lr.estimatedRework.toFixed(1)}h`, 'REWORK HOURS', AMBER);
  kpiTile(doc, 14 + (lrBoxW + lrBoxGap) * 3, lrBoxY, lrBoxW, lrBoxH,
    lr.avgConfidence !== undefined ? `${(lr.avgConfidence * 100).toFixed(0)}%` : '—',
    'AVG CONFIDENCE', PURPLE);

  y = lrBoxY + lrBoxH + 12;

  // Top customers (offenders) table
  ink(doc, MUTED); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('TOP CUSTOMERS — MISSING LOAD REFERENCES', 14, y);
  y += 4;

  if (lr.topOffenders.length === 0) {
    noDataRow(doc, y + 2);
    y += 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Customer', 'Missing Refs']],
      body: lr.topOffenders.map((o, n) => [n + 1, o.name, o.count]),
      foot: [['', 'TOTAL', lr.totalMissing]],
      footStyles: { fillColor: [...COLORS.tableHeader] as [number,number,number], textColor: [255,255,255] as [number,number,number], fontStyle: 'bold' as const, fontSize: 8 },
      ...tableDefaults(RED),
    });
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 10;
  }

  // Top transporters table (if data available)
  const topTransporters = lr.topTransporters ?? [];
  if (y < 230) {
    ink(doc, MUTED); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('TOP TRANSPORTERS — MISSING LOAD REFERENCES', 14, y);
    y += 4;

    if (topTransporters.length === 0) {
      noDataRow(doc, y + 2, 'No transporter data available for missing load references.');
      y += 10;
    } else {
      autoTable(doc, {
        startY: y,
        head: [['#', 'Transporter', 'Cases']],
        body: topTransporters.slice(0, 8).map((t, n) => [n + 1, t.name, t.count]),
        ...tableDefaults(AMBER),
      });
      y = (doc.lastAutoTable?.finalY ?? y + 40) + 10;
    }
  }

  // Weekly trend table (if data available)
  const weeklyMissing = lr.weeklyMissing ?? {};
  const weeklyEntries = Object.entries(weeklyMissing).sort(([a], [b]) => a.localeCompare(b)).slice(-8);
  if (weeklyEntries.length >= 2 && y < 240) {
    ink(doc, MUTED); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
    doc.text('WEEKLY TREND — MISSING LOAD REFERENCES', 14, y);
    y += 4;
    autoTable(doc, {
      startY: y,
      head: [['Week', 'Missing Refs']],
      body: weeklyEntries.map(([wk, cnt]) => [wk, cnt]),
      ...tableDefaults(PURPLE),
    });
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 10;
  }

  // ── Area Hotspots ────────────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Area Hotspots', pg);
  y = sectionTitle(doc, 'Area Hotspots', 26);

  if (areaHotspots.length === 0) {
    noDataRow(doc, y + 4, 'No area data found in this dataset.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Area', 'Cases', 'Hours Lost', 'Top Issue', 'Trend']],
      body: areaHotspots.map((a, n) => [n + 1, a.name, a.count, a.hoursLost.toFixed(1), a.topIssue, a.trend]),
      ...tableDefaults(COLORS.highlightBlue),
    });
  }

  // ── Predictive Intelligence ──────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Predictive Intelligence', pg);
  y = sectionTitle(doc, 'Predictive Intelligence — Next Week Forecast', 26);

  if (!forecast.available) {
    noDataRow(doc, y + 4, forecast.reason ?? 'Insufficient data for forecast.');
  } else {
    ink(doc, MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Forecast basis: ${forecast.weeksAnalyzed} weeks analysed · weighted rolling average · confidence: ${forecast.confidence}`, 14, y);
    y += 8;

    // Forecast volume KPI
    kpiTile(doc, 14, y, 60, 30, forecast.nextWeekVolume.toLocaleString(), 'EXPECTED NEXT WEEK', PURPLE);
    y += 42;

    autoTable(doc, {
      startY: y,
      head: [['Issue', 'Forecasted Cases', 'Trend']],
      body: forecast.topIssues.map(i => [i.label, i.forecasted, i.trend]),
      ...tableDefaults(),
    });

    const afterPred = doc.lastAutoTable?.finalY ?? y + 60;
    autoTable(doc, {
      startY: afterPred + 12,
      head: [['Pre-emptive Recommended Actions']],
      body: forecast.actions.map((a, n) => [`${n + 1}. ${a}`]),
      ...tableDefaults(AMBER),
    });
  }

  // ── Priority Actions ─────────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Priority Actions', pg);
  y = sectionTitle(doc, 'Priority Actions', 26);

  const actionRows = [
    ...actions.quickWins.map(w            => ['Quick Win',          w, 'HIGH']),
    ...actions.structuralFixes.map(f      => ['Structural Fix',     f, 'MEDIUM']),
    ...actions.customerInterventions.map(c => [`Customer: ${c.customer}`, c.action, 'HIGH']),
    ...actions.transporterEscalations.map(t => [`Transporter: ${t.transporter}`, t.action, 'HIGH']),
    ...actions.automationOpportunities.map(o => ['Automation',      o, 'MEDIUM']),
    ...actions.complianceControls.map(c   => ['Compliance Control', c, 'MEDIUM']),
  ];

  if (actionRows.length === 0) {
    noDataRow(doc, y + 4, 'No priority actions generated.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Action', 'Priority']],
      body: actionRows,
      ...tableDefaults(AMBER),
    });
  }

  doc.save(`CaseIntelligence_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
