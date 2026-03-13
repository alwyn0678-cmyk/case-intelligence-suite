import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AnalysisResult } from '../types/analysis';

// ─── Terracotta & Eggshell — Premium Editorial Palette ────────────
const COLORS = {
  // ── Primary backgrounds ──────────────────────────────
  bgPage:        [250, 247, 242] as [number,number,number], // warm eggshell / ivory
  bgSection:     [244, 239, 230] as [number,number,number], // soft parchment (card/section bg)
  bgAccentStrip: [188,  84,  46] as [number,number,number], // terracotta / burnt orange
  bgTableHeader: [210, 165, 130] as [number,number,number], // warm sand header row
  bgTableAlt:    [247, 243, 236] as [number,number,number], // very subtle parchment alt row
  bgDark:        [ 40,  34,  28] as [number,number,number], // deep espresso / near-black
  bgKpi:         [255, 250, 244] as [number,number,number], // KPI tile background (warm white)

  // ── Text ─────────────────────────────────────────────
  textPrimary:   [ 38,  30,  22] as [number,number,number], // near-black espresso
  textSecondary: [ 90,  75,  60] as [number,number,number], // warm dark brown
  textMuted:     [140, 120, 100] as [number,number,number], // muted taupe
  textOnDark:    [250, 247, 242] as [number,number,number], // eggshell on dark strips
  textAccent:    [188,  84,  46] as [number,number,number], // terracotta for headings/accents

  // ── Highlights ────────────────────────────────────────
  highlightGreen: [ 74, 150,  89] as [number,number,number], // muted sage green
  highlightAmber: [200, 130,  40] as [number,number,number], // warm amber
  highlightRed:   [185,  65,  50] as [number,number,number], // muted clay red
  highlightBlue:  [ 80, 130, 160] as [number,number,number], // dusty steel blue

  // ── Borders / dividers ────────────────────────────────
  borderLight:   [220, 210, 195] as [number,number,number], // warm light border
  borderMedium:  [180, 160, 135] as [number,number,number], // medium warm border

  // ── Table ─────────────────────────────────────────────
  tableText:     [ 50,  40,  30] as [number,number,number], // dark warm brown for table body
};

type DocWithAutoTable = jsPDF & {
  lastAutoTable?: { finalY: number };
};

// ─── Utility helpers ─────────────────────────────────────────────

function fillColor(doc: jsPDF, color: [number,number,number]): void {
  doc.setFillColor(color[0], color[1], color[2]);
}
function textColor(doc: jsPDF, color: [number,number,number]): void {
  doc.setTextColor(color[0], color[1], color[2]);
}
function drawColor(doc: jsPDF, color: [number,number,number]): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

// ─── Section header helper ────────────────────────────────────────
// Returns next y after the header block.
function sectionHeader(
  doc: jsPDF,
  y: number,
  title: string,
  pageWidth: number,
  margin: number,
): number {
  // Terracotta left accent bar (3mm wide, 6mm tall)
  fillColor(doc, COLORS.bgAccentStrip);
  doc.rect(margin, y, 3, 6, 'F');
  // Title text offset right of bar
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  textColor(doc, COLORS.textAccent);
  doc.text(title, margin + 6, y + 4.5);
  // Thin rule under the title
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 8, pageWidth - margin, y + 8);
  return y + 14; // next y
}

// ─── KPI tile helper ──────────────────────────────────────────────
function kpiTile(
  doc: jsPDF,
  x: number, y: number,
  w: number, h: number,
  value: string, label: string,
): void {
  // Background
  fillColor(doc, COLORS.bgKpi);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  // Top terracotta accent bar
  fillColor(doc, COLORS.bgAccentStrip);
  doc.rect(x, y, w, 1.5, 'F');
  // Light border
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  // Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  textColor(doc, COLORS.textAccent);
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' });
  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  textColor(doc, COLORS.textMuted);
  doc.text(label, x + w / 2, y + h - 3, { align: 'center' });
}

// ─── Table defaults (autoTable styles) ───────────────────────────
function tableDefaults(headFill: [number,number,number] = COLORS.bgTableHeader) {
  return {
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
      textColor: COLORS.tableText,
      lineColor: COLORS.borderLight,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: headFill,
      textColor: COLORS.tableText,
      fontStyle: 'bold' as const,
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
    },
    alternateRowStyles: {
      fillColor: COLORS.bgTableAlt,
    },
    tableLineColor: COLORS.borderLight,
    tableLineWidth: 0.3,
    margin: { left: 18, right: 18 },
  };
}

// ─── Page footer helper ───────────────────────────────────────────
function addPageFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  pageWidth: number,
  margin: number,
): void {
  const y = 285;
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  textColor(doc, COLORS.textMuted);
  doc.text('Case Intelligence Suite — Operational Intelligence Report', margin, y + 4);
  doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, y + 4, { align: 'right' });
}

// ─── "No data" placeholder ────────────────────────────────────────
function noDataRow(doc: jsPDF, y: number, message = 'No data available.'): void {
  textColor(doc, COLORS.textMuted);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.text(message, 18, y);
}

// ─── Page background ──────────────────────────────────────────────
function paintPageBackground(doc: jsPDF): void {
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  fillColor(doc, COLORS.bgPage);
  doc.rect(0, 0, W, H, 'F');
}

export async function exportToPdf(analysis: AnalysisResult): Promise<void> {
  const {
    summary,
    issueBreakdown,
    customerBurden,
    transporterPerformance,
    customsCompliance: cc,
    loadRefIntelligence: lr,
    areaHotspots,
    forecast,
    actions,
  } = analysis;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' }) as DocWithAutoTable;
  const W = doc.internal.pageSize.getWidth();
  const MARGIN = 18;

  // We'll update totalPages on final save; use placeholder count
  const TOTAL_PAGES = 9;
  let pg = 1;

  // ══════════════════════════════════════════════════════════════════
  // COVER PAGE
  // ══════════════════════════════════════════════════════════════════
  paintPageBackground(doc);

  // Top espresso strip (full width, 28mm)
  fillColor(doc, COLORS.bgDark);
  doc.rect(0, 0, W, 28, 'F');

  // Report title centred in the strip
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  textColor(doc, COLORS.textOnDark);
  doc.text('Case Intelligence Suite', W / 2, 14, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  // Approximate 70% opacity via a lighter tint of textOnDark
  doc.setTextColor(210, 207, 201);
  doc.text('Operational Intelligence Report', W / 2, 22, { align: 'center' });

  // Thin terracotta rule beneath the strip
  fillColor(doc, COLORS.bgAccentStrip);
  doc.rect(0, 28, W, 1.5, 'F');

  // Meta block (left-aligned, ~40mm from top)
  const metaY = 40;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  textColor(doc, COLORS.textSecondary);
  doc.text(`Prepared:  ${new Date().toLocaleDateString('en-GB')}`,         MARGIN, metaY);
  doc.text(`Period:      ${summary.weekRange}`,                             MARGIN, metaY + 7);
  doc.text(`Total Cases:  ${summary.totalCases.toLocaleString()}`,          MARGIN, metaY + 14);

  // Thin separator under meta
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, metaY + 20, W - MARGIN, metaY + 20);

  // KPI row — 4 tiles
  const kpiY  = metaY + 26;
  const kpiW  = (W - MARGIN * 2 - 12) / 4; // 3 gaps of 4mm
  const kpiH  = 34;
  const kpiGap = 4;

  const missingLoadRefs = lr.totalMissing;
  const unclassifiedPct = (() => {
    const u = issueBreakdown.find(i => i.id === 'other');
    return u ? u.percent.toFixed(1) + '%' : '0.0%';
  })();

  kpiTile(doc, MARGIN,                          kpiY, kpiW, kpiH,
    summary.totalCases.toLocaleString(), 'Total Cases');
  kpiTile(doc, MARGIN + (kpiW + kpiGap),        kpiY, kpiW, kpiH,
    `${summary.preventablePct.toFixed(1)}%`, 'Rate / Finance Cases');
  kpiTile(doc, MARGIN + (kpiW + kpiGap) * 2,   kpiY, kpiW, kpiH,
    missingLoadRefs.toString(), 'Missing Load Refs');
  kpiTile(doc, MARGIN + (kpiW + kpiGap) * 3,   kpiY, kpiW, kpiH,
    unclassifiedPct, 'Unclassified %');

  // Cover footer rule
  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  let y = sectionHeader(doc, 18, 'Executive Summary', W, MARGIN);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  textColor(doc, COLORS.textSecondary);
  const narrativeLines = doc.splitTextToSize(summary.narrative, W - MARGIN * 2);
  doc.text(narrativeLines, MARGIN, y);
  y += narrativeLines.length * 5 + 8;

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

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 3 — ISSUE INTELLIGENCE
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Issue Intelligence', W, MARGIN);

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

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 4 — CUSTOMER BURDEN
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Customer Burden', W, MARGIN);

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

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 5 — TRANSPORTER PERFORMANCE
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Transporter Performance', W, MARGIN);

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

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 6 — CUSTOMS & COMPLIANCE
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Customs & Compliance', W, MARGIN);

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

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 7 — LOAD REFERENCE INTELLIGENCE
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Missing Load Reference — Intelligence', W, MARGIN);

  // Operational summary text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  textColor(doc, COLORS.textSecondary);
  const lrSummaryText =
    'Load reference cases represent execution blockers where the reference required for vehicle ' +
    'dispatch or terminal access has not been provided. Each missing reference generates rework ' +
    'and can delay cargo movement.';
  const lrSummaryLines = doc.splitTextToSize(lrSummaryText, W - MARGIN * 2);
  doc.text(lrSummaryLines, MARGIN, y);
  y += lrSummaryLines.length * 5 + 6;

  // 4 KPI tiles in a row
  const lrKpiW  = (W - MARGIN * 2 - 12) / 4;
  const lrKpiH  = 30;
  const lrKpiGap = 4;
  const lrKpiY  = y;

  kpiTile(doc, MARGIN,                              lrKpiY, lrKpiW, lrKpiH,
    lr.totalMissing.toString(), 'Total Missing');
  kpiTile(doc, MARGIN + (lrKpiW + lrKpiGap),       lrKpiY, lrKpiW, lrKpiH,
    lr.totalProvided !== undefined ? lr.totalProvided.toString() : '—',
    'Provided / Updated');
  kpiTile(doc, MARGIN + (lrKpiW + lrKpiGap) * 2,  lrKpiY, lrKpiW, lrKpiH,
    `${lr.estimatedRework.toFixed(1)}h`, 'Est. Rework Hours');
  kpiTile(doc, MARGIN + (lrKpiW + lrKpiGap) * 3,  lrKpiY, lrKpiW, lrKpiH,
    lr.avgConfidence !== undefined ? `${(lr.avgConfidence * 100).toFixed(0)}%` : '—',
    'Avg Confidence %');

  y = lrKpiY + lrKpiH + 10;

  // Two-column layout: Top Transporters | Top Customers
  const colW   = (W - MARGIN * 2 - 6) / 2; // 6mm gutter
  const colGap = 6;
  const colRightX = MARGIN + colW + colGap;

  // Column headings
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  textColor(doc, COLORS.textPrimary);
  doc.text('Top Transporters', MARGIN, y);
  doc.text('Top Customers',    colRightX, y);
  y += 4;

  // Prepare table data
  const topTransporters = lr.topTransporters ?? [];
  const topOffenders    = lr.topOffenders ?? [];
  const totalMissing    = lr.totalMissing || 1;

  const transporterRows = topTransporters.slice(0, 8).map((t, n) => [
    n + 1,
    t.name,
    t.count,
    `${((t.count / totalMissing) * 100).toFixed(1)}%`,
  ]);
  const customerRows = topOffenders.slice(0, 8).map((o, n) => [
    n + 1,
    o.name,
    o.count,
    `${((o.count / totalMissing) * 100).toFixed(1)}%`,
  ]);

  const twoColTableDefaults = (headFill: [number,number,number] = COLORS.bgTableHeader) => ({
    theme: 'plain' as const,
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      textColor: COLORS.tableText,
      lineColor: COLORS.borderLight,
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: headFill,
      textColor: COLORS.tableText,
      fontStyle: 'bold' as const,
      fontSize: 8,
      cellPadding: { top: 3.5, bottom: 3.5, left: 4, right: 4 },
    },
    alternateRowStyles: { fillColor: COLORS.bgTableAlt },
    tableLineColor: COLORS.borderLight,
    tableLineWidth: 0.3,
  });

  let leftFinalY  = y;
  let rightFinalY = y;

  if (transporterRows.length === 0) {
    noDataRow(doc, y + 2, 'No transporter data available.');
    leftFinalY = y + 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Transporter', 'Cases', '%']],
      body: transporterRows,
      ...twoColTableDefaults(),
      margin: { left: MARGIN, right: colRightX },
      tableWidth: colW,
    });
    leftFinalY = (doc.lastAutoTable?.finalY ?? y + 40);
  }

  if (customerRows.length === 0) {
    noDataRow(doc, y + 2, 'No customer data available.');
    rightFinalY = y + 10;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Customer', 'Cases', '%']],
      body: customerRows,
      ...twoColTableDefaults(),
      margin: { left: colRightX, right: MARGIN },
      tableWidth: colW,
    });
    rightFinalY = (doc.lastAutoTable?.finalY ?? y + 40);
  }

  y = Math.max(leftFinalY, rightFinalY) + 10;

  // Weekly trend (if ≥2 weeks of data)
  const weeklyMissing  = lr.weeklyMissing ?? {};
  const weeklyEntries  = Object.entries(weeklyMissing)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8);

  if (weeklyEntries.length >= 2 && y < 240) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    textColor(doc, COLORS.textPrimary);
    doc.text('Weekly Trend — Missing Load References', MARGIN, y);
    y += 4;

    autoTable(doc, {
      startY: y,
      head: [['Week', 'Missing Refs']],
      body: weeklyEntries.map(([wk, cnt]) => [wk, cnt]),
      ...tableDefaults(COLORS.bgTableHeader),
    });
    y = (doc.lastAutoTable?.finalY ?? y + 40) + 10;
  }

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 8 — AREA HOTSPOTS
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Area Hotspots', W, MARGIN);

  if (areaHotspots.length === 0) {
    noDataRow(doc, y + 4, 'No area data found in this dataset.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['#', 'Area', 'Cases', 'Hours Lost', 'Top Issue', 'Trend']],
      body: areaHotspots.map((a, n) => [
        n + 1,
        a.name,
        a.count,
        a.hoursLost.toFixed(1),
        a.topIssue,
        a.trend,
      ]),
      ...tableDefaults(COLORS.highlightBlue as [number,number,number]),
    });
  }

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 9 — PRIORITY ACTIONS
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Priority Actions', W, MARGIN);

  const actionRows = [
    ...actions.quickWins.map(w              => ['Quick Win',          w, 'HIGH']),
    ...actions.structuralFixes.map(f        => ['Structural Fix',     f, 'MEDIUM']),
    ...actions.customerInterventions.map(c  => [`Customer: ${c.customer}`,     c.action, 'HIGH']),
    ...actions.transporterEscalations.map(t => [`Transporter: ${t.transporter}`, t.action, 'HIGH']),
    ...actions.automationOpportunities.map(o => ['Automation',        o, 'MEDIUM']),
    ...actions.complianceControls.map(c     => ['Compliance Control', c, 'MEDIUM']),
  ];

  if (actionRows.length === 0) {
    noDataRow(doc, y + 4, 'No priority actions generated.');
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Type', 'Action', 'Priority']],
      body: actionRows,
      ...tableDefaults(COLORS.highlightAmber as [number,number,number]),
    });
  }

  // Predictive forecast section (appended to same page if space allows)
  y = (doc.lastAutoTable?.finalY ?? y + 60) + 14;
  if (y < 220) {
    y = sectionHeader(doc, y, 'Predictive Intelligence — Next Week Forecast', W, MARGIN);

    if (!forecast.available) {
      noDataRow(doc, y + 4, forecast.reason ?? 'Insufficient data for forecast.');
    } else {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      textColor(doc, COLORS.textSecondary);
      doc.text(
        `Forecast basis: ${forecast.weeksAnalyzed} weeks analysed · weighted rolling average · confidence: ${forecast.confidence}`,
        MARGIN,
        y,
      );
      y += 8;

      kpiTile(doc, MARGIN, y, 58, 28, forecast.nextWeekVolume.toLocaleString(), 'Expected Next Week');
      y += 36;

      if (y < 240) {
        autoTable(doc, {
          startY: y,
          head: [['Issue', 'Forecasted Cases', 'Trend']],
          body: forecast.topIssues.map(i => [i.label, i.forecasted, i.trend]),
          ...tableDefaults(),
        });
      }
    }
  }

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  doc.save(`CaseIntelligence_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
}
