import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult } from '../types/analysis';

const BG      = [15,  16,  20]  as const;
const SURF    = [23,  25,  34]  as const;
const BORDER  = [42,  47,  63]  as const;
const TEXT    = [236, 239, 247] as const;
const MUTED   = [166, 174, 196] as const;
const PURPLE  = [139, 124, 255] as const;
const AMBER   = [216, 163, 76]  as const;
const TEAL    = [82,  199, 199] as const;
const RED     = [220, 109, 125] as const;

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
  ink(doc, PURPLE); doc.setFontSize(8); doc.setFont('helvetica', 'bold');
  doc.text('CASE INTELLIGENCE SUITE', 14, 10.5);
  ink(doc, MUTED); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
  doc.text(title, 80, 10.5);
  doc.text(`Page ${pageNum}  ·  ${new Date().toLocaleDateString('en-GB')}`, W - 14, 10.5, { align: 'right' });
}

function sectionTitle(doc: jsPDF, text: string, y: number): number {
  ink(doc, TEXT); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
  doc.text(text, 14, y);
  return y + 8;
}

function tableDefaults(headFill: readonly [number,number,number] = PURPLE) {
  return {
    headStyles:          { fillColor: [...headFill] as [number,number,number], textColor: [255,255,255] as [number,number,number], fontSize: 8 },
    bodyStyles:          { fillColor: [...SURF]    as [number,number,number], textColor: [...TEXT]    as [number,number,number], fontSize: 8 },
    alternateRowStyles:  { fillColor: [...BG]      as [number,number,number] },
    styles:              { lineColor: [...BORDER]  as [number,number,number], lineWidth: 0.1 },
    margin:              { left: 14, right: 14 },
  };
}

export async function exportToPdf(analysis: AnalysisResult): Promise<void> {
  const { summary, issueBreakdown, customerBurden, transporterPerformance,
          customsCompliance: cc, loadRefIntelligence: lr, areaHotspots, forecast, actions } = analysis;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithAutoTable;
  const W = doc.internal.pageSize.getWidth();
  let pg = 1;

  // ── Cover ────────────────────────────────────────────────────
  fill(doc, BG); doc.rect(0, 0, W, doc.internal.pageSize.getHeight(), 'F');
  fill(doc, PURPLE); doc.rect(0, 0, W, 3, 'F');

  ink(doc, MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  doc.text('OPERATIONAL INTELLIGENCE REPORT', 14, 80);

  ink(doc, TEXT); doc.setFontSize(28); doc.setFont('helvetica', 'bold');
  doc.text('Case Intelligence', 14, 98);
  doc.text('Suite', 14, 112);

  ink(doc, MUTED); doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`Period: ${summary.weekRange}`, 14, 135);
  doc.text(`Total Cases: ${summary.totalCases.toLocaleString()}`, 14, 145);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')}`, 14, 155);

  // Stat boxes
  const boxY = 176;
  fill(doc, SURF); doc.roundedRect(14, boxY, 54, 32, 3, 3, 'F');
  fill(doc, SURF); doc.roundedRect(74, boxY, 54, 32, 3, 3, 'F');
  fill(doc, SURF); doc.roundedRect(134, boxY, 54, 32, 3, 3, 'F');

  const statVal = (x: number, val: string, clr: readonly [number,number,number]) => {
    ink(doc, clr); doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(val, x + 27, boxY + 16, { align: 'center' });
  };
  const statLbl = (x: number, lbl: string) => {
    ink(doc, MUTED); doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text(lbl, x + 27, boxY + 25, { align: 'center' });
  };
  statVal(14,  summary.totalCases.toLocaleString(),        PURPLE);  statLbl(14,  'TOTAL CASES');
  statVal(74,  `${summary.preventablePct.toFixed(1)}%`,    AMBER);   statLbl(74,  'PREVENTABLE');
  statVal(134, `${summary.totalHoursLost.toFixed(0)}h`,    TEAL);    statLbl(134, 'HOURS LOST');

  // ── Executive Summary ────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Executive Summary', pg);
  let y = sectionTitle(doc, 'Executive Summary', 26);

  ink(doc, MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
  const lines = doc.splitTextToSize(summary.narrative, W - 28);
  doc.text(lines, 14, y); y += lines.length * 5 + 6;

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

  // ── Issue Breakdown ──────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Issue Intelligence', pg);
  sectionTitle(doc, 'Issue Intelligence', 26);

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Category', 'Cases', '% Total', 'Hours Lost', 'Preventable', 'Trend']],
    body: issueBreakdown.map((i, n) => [n+1, i.label, i.count, `${i.percent.toFixed(1)}%`, i.hoursLost.toFixed(1), i.preventable ? 'Yes' : 'No', i.trend]),
    ...tableDefaults(),
  });

  // ── Customer Burden ──────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Customer Burden', pg);
  sectionTitle(doc, 'Customer Burden', 26);

  autoTable(doc, {
    startY: 34,
    head: [['#', 'Customer', 'Cases', 'Hours', 'Prev%', 'Load Ref', 'Customs', 'Top Issue', 'Risk']],
    body: customerBurden.slice(0, 30).map((c, n) => [n+1, c.name, c.count, c.hoursLost.toFixed(1), `${c.preventablePct.toFixed(0)}%`, c.missingLoadRef||'—', c.missingCustomsDocs||'—', c.topIssue, c.risk]),
    ...tableDefaults(),
  });

  // ── Transporter Performance ──────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Transporter Performance', pg);
  sectionTitle(doc, 'Transporter Performance', 26);

  if (transporterPerformance.length === 0) {
    ink(doc, MUTED); doc.setFontSize(9);
    doc.text('No transporter data found in this dataset.', 14, 40);
  } else {
    autoTable(doc, {
      startY: 34,
      head: [['#', 'Transporter', 'Cases', 'Delays', 'Not On Time', 'Wait Time', 'Score', 'Risk']],
      body: transporterPerformance.map((t, n) => [n+1, t.name, t.count, t.delays||'—', t.notOnTime||'—', t.waitingTime||'—', `${t.punctualityScore.toFixed(0)}%`, t.risk]),
      ...tableDefaults(),
    });
  }

  // ── Customs & Compliance ─────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Customs & Compliance', pg);
  sectionTitle(doc, 'Customs & Compliance', 26);

  autoTable(doc, {
    startY: 34,
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

  const afterCC = doc.lastAutoTable?.finalY ?? 80;
  autoTable(doc, {
    startY: afterCC + 10,
    head: [['Customer', 'Compliance Cases']],
    body: cc.topOffenders.map(o => [o.name, o.count]),
    ...tableDefaults(TEAL),
  });

  // ── Load References ──────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Load Reference Intelligence', pg);
  sectionTitle(doc, 'Load Reference Intelligence', 26);

  autoTable(doc, {
    startY: 34,
    head: [['Customer', 'Missing Refs']],
    body: [
      ...lr.topOffenders.map(o => [o.name, o.count]),
      ['TOTAL', lr.totalMissing],
      ['Est. Rework Hours', `${lr.estimatedRework.toFixed(1)}h`],
    ],
    ...tableDefaults(RED),
  });

  // ── Area Hotspots ────────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Area Hotspots', pg);
  sectionTitle(doc, 'Area Hotspots', 26);

  if (areaHotspots.length === 0) {
    ink(doc, MUTED); doc.setFontSize(9);
    doc.text('No area data found in this dataset.', 14, 40);
  } else {
    autoTable(doc, {
      startY: 34,
      head: [['#', 'Area', 'Cases', 'Hours Lost', 'Top Issue', 'Trend']],
      body: areaHotspots.map((a, n) => [n+1, a.name, a.count, a.hoursLost.toFixed(1), a.topIssue, a.trend]),
      ...tableDefaults(TEAL),
    });
  }

  // ── Predictive Intelligence ──────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Predictive Intelligence', pg);
  y = sectionTitle(doc, 'Predictive Intelligence — Next Week Forecast', 26);

  if (!forecast.available) {
    ink(doc, MUTED); doc.setFontSize(9); doc.text(forecast.reason ?? 'Insufficient data.', 14, y + 4);
  } else {
    ink(doc, MUTED); doc.setFontSize(9);
    doc.text(`Forecast basis: ${forecast.weeksAnalyzed} weeks analysed · weighted rolling average · confidence: ${forecast.confidence}`, 14, y);
    y += 8;
    ink(doc, PURPLE); doc.setFontSize(22); doc.setFont('helvetica', 'bold');
    doc.text(`${forecast.nextWeekVolume.toLocaleString()} cases`, 14, y + 10);
    ink(doc, MUTED); doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('expected next week', 14, y + 18);
    y += 28;

    autoTable(doc, {
      startY: y,
      head: [['Issue', 'Forecasted Cases', 'Trend']],
      body: forecast.topIssues.map(i => [i.label, i.forecasted, i.trend]),
      ...tableDefaults(),
    });

    const afterPred = doc.lastAutoTable?.finalY ?? y + 60;
    autoTable(doc, {
      startY: afterPred + 10,
      head: [['Pre-emptive Recommended Actions']],
      body: forecast.actions.map((a, n) => [`${n+1}. ${a}`]),
      ...tableDefaults(AMBER),
    });
  }

  // ── Priority Actions ─────────────────────────────────────────
  doc.addPage(); pg++;
  pageHeader(doc, 'Priority Actions', pg);
  sectionTitle(doc, 'Priority Actions', 26);

  autoTable(doc, {
    startY: 34,
    head: [['Type', 'Action', 'Priority']],
    body: [
      ...actions.quickWins.map(w          => ['Quick Win',          w, 'HIGH']),
      ...actions.structuralFixes.map(f    => ['Structural Fix',     f, 'MEDIUM']),
      ...actions.customerInterventions.map(c => [`Customer: ${c.customer}`, c.action, 'HIGH']),
      ...actions.transporterEscalations.map(t => [`Transporter: ${t.transporter}`, t.action, 'HIGH']),
      ...actions.automationOpportunities.map(o => ['Automation',    o, 'MEDIUM']),
      ...actions.complianceControls.map(c => ['Compliance Control', c, 'MEDIUM']),
    ],
    ...tableDefaults(AMBER),
  });

  doc.save(`CaseIntelligence_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
