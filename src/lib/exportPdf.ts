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

// ─── Chart colour palette (terracotta tones) ──────────────────────
const CHART_COLORS: [number,number,number][] = [
  [188,  84,  46],  // terracotta
  [210, 140,  80],  // warm orange
  [230, 175, 115],  // sandy peach
  [170, 110,  70],  // clay brown
  [200, 155, 105],  // warm tan
  [145,  95,  55],  // deep clay
];

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
function sectionHeader(
  doc: jsPDF,
  y: number,
  title: string,
  pageWidth: number,
  margin: number,
): number {
  fillColor(doc, COLORS.bgAccentStrip);
  doc.rect(margin, y, 3, 6, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  textColor(doc, COLORS.textAccent);
  doc.text(title, margin + 6, y + 4.5);
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.line(margin, y + 8, pageWidth - margin, y + 8);
  return y + 14;
}

// ─── KPI tile helper ──────────────────────────────────────────────
function kpiTile(
  doc: jsPDF,
  x: number, y: number,
  w: number, h: number,
  value: string, label: string,
): void {
  fillColor(doc, COLORS.bgKpi);
  doc.roundedRect(x, y, w, h, 2, 2, 'F');
  fillColor(doc, COLORS.bgAccentStrip);
  doc.rect(x, y, w, 1.5, 'F');
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 2, 2, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  textColor(doc, COLORS.textAccent);
  doc.text(value, x + w / 2, y + h / 2 + 1, { align: 'center' });
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

// ─── Horizontal bar chart ─────────────────────────────────────────
function drawHorizBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  items: Array<{ label: string; value: number }>,
  maxValue: number,
  barHeight = 6,
  gap = 3,
  color: [number,number,number] = COLORS.bgAccentStrip,
): number {
  const labelWidth = 65;
  const barAreaWidth = width - labelWidth - 20;
  let cy = y;
  for (const item of items) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    textColor(doc, COLORS.textPrimary);
    const truncLabel = item.label.length > 30 ? item.label.slice(0, 28) + '\u2026' : item.label;
    doc.text(truncLabel, x + labelWidth - 2, cy + barHeight - 1, { align: 'right' });
    fillColor(doc, COLORS.bgSection);
    doc.rect(x + labelWidth, cy, barAreaWidth, barHeight, 'F');
    const barW = maxValue > 0 ? (item.value / maxValue) * barAreaWidth : 0;
    fillColor(doc, color);
    doc.rect(x + labelWidth, cy, barW, barHeight, 'F');
    doc.setFontSize(7.5);
    textColor(doc, COLORS.textSecondary);
    doc.text(String(item.value), x + labelWidth + barW + 2, cy + barHeight - 1);
    cy += barHeight + gap;
  }
  return cy + 4;
}

// ─── Proportional stacked bar (pie substitute) ────────────────────
function drawProportionalBar(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  segments: Array<{ label: string; count: number; pct: number; color: [number,number,number] }>,
): number {
  const barH = 10;
  let cx = x;
  for (const seg of segments) {
    const segW = (seg.pct / 100) * width;
    fillColor(doc, seg.color);
    doc.rect(cx, y, segW, barH, 'F');
    cx += segW;
  }
  // Legend
  let legendX = x;
  let legendY = y + barH + 4;
  for (const seg of segments) {
    fillColor(doc, seg.color);
    doc.rect(legendX, legendY, 4, 4, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    textColor(doc, COLORS.textSecondary);
    const labelText = `${seg.label.slice(0, 18)} ${seg.pct.toFixed(1)}%`;
    doc.text(labelText, legendX + 6, legendY + 3.5);
    legendX += 55;
    if (legendX > x + width - 50) { legendX = x; legendY += 10; }
  }
  return legendY + 12;
}

// ─── Weekly bar chart (trend) ─────────────────────────────────────
function drawWeeklyBarChart(
  doc: jsPDF,
  x: number,
  y: number,
  width: number,
  height: number,
  weeks: Array<{ week: string; count: number }>,
): number {
  if (weeks.length === 0) return y + 4;
  const maxCount = Math.max(...weeks.map(w => w.count), 1);
  const barW = Math.min(12, (width - 10) / weeks.length - 2);
  const gap = weeks.length > 1
    ? (width - 10 - barW * weeks.length) / (weeks.length - 1)
    : 0;
  // Y axis baseline
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.line(x, y + height, x + width, y + height);
  // Find peak week for highlight
  let peakIdx = 0;
  let peakVal = 0;
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].count > peakVal) { peakVal = weeks[i].count; peakIdx = i; }
  }
  for (let i = 0; i < weeks.length; i++) {
    const bx = x + i * (barW + gap);
    const bh = (weeks[i].count / maxCount) * height;
    const by = y + height - bh;
    // Highlight peak in terracotta, others in warm tan
    const barColor: [number,number,number] = i === peakIdx
      ? COLORS.bgAccentStrip
      : [200, 155, 105];
    fillColor(doc, barColor);
    doc.rect(bx, by, barW, bh, 'F');
    // Week label
    doc.setFontSize(6.5);
    textColor(doc, COLORS.textMuted);
    const shortLabel = weeks[i].week.replace(/^\d{4}-/, '');
    doc.text(shortLabel, bx + barW / 2, y + height + 5, { align: 'center' });
  }
  return y + height + 12;
}

// ─── Executive findings generator ────────────────────────────────
function generateExecutiveFindings(analysis: AnalysisResult): string[] {
  const findings: string[] = [];
  const { summary, issueBreakdown, loadRefIntelligence: lr } = analysis;

  // Top category by volume
  const topIssue = issueBreakdown[0];
  if (topIssue) {
    findings.push(
      `${topIssue.label} is the highest volume category with ${topIssue.count.toLocaleString()} cases (${topIssue.percent.toFixed(1)}% of total).`,
    );
  }

  // Top category by hours lost
  const sorted = [...issueBreakdown].sort((a, b) => (b.hoursLost ?? 0) - (a.hoursLost ?? 0));
  const topHours = sorted[0];
  if (topHours && topHours.hoursLost > 0) {
    findings.push(
      `${topHours.label} drives the most operational hours lost at ${topHours.hoursLost.toFixed(0)}h across the reporting period.`,
    );
  }

  // Preventable workload
  if (summary.preventablePct > 0) {
    findings.push(
      `An estimated ${summary.preventablePct.toFixed(1)}% of cases represent potentially preventable workload through improved process controls.`,
    );
  }

  // Load reference
  if (lr && lr.totalMissing > 5) {
    findings.push(
      `Missing Load Reference cases (${lr.totalMissing}) continue to generate execution delays and rework — transporter briefing is recommended.`,
    );
  }

  return findings;
}

// ─── Priority actions grouping helper ────────────────────────────
function buildActionGroups(actions: AnalysisResult['actions']): Array<{
  groupLabel: string;
  items: string[];
}> {
  const groups: Array<{ groupLabel: string; items: string[] }> = [];

  if (actions.quickWins.length > 0) {
    groups.push({ groupLabel: 'Quick Wins', items: actions.quickWins });
  }
  if (actions.structuralFixes.length > 0) {
    groups.push({ groupLabel: 'Structural Fixes', items: actions.structuralFixes });
  }
  if (actions.customerInterventions.length > 0) {
    groups.push({
      groupLabel: 'Customer Actions',
      items: actions.customerInterventions.map(c => `${c.customer}: ${c.action}`),
    });
  }
  if (actions.transporterEscalations.length > 0) {
    groups.push({
      groupLabel: 'Transporter Actions',
      items: actions.transporterEscalations.map(t => `${t.transporter}: ${t.action}`),
    });
  }
  if (actions.automationOpportunities.length > 0) {
    groups.push({ groupLabel: 'Automation Opportunities', items: actions.automationOpportunities });
  }
  if (actions.complianceControls.length > 0) {
    groups.push({ groupLabel: 'Compliance Controls', items: actions.complianceControls });
  }

  return groups;
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

  const TOTAL_PAGES = 9;
  let pg = 1;

  // ── Derived KPI values ────────────────────────────────────────
  const preventableHours = issueBreakdown
    .filter(i => i.preventable)
    .reduce((sum, i) => sum + (i.hoursLost ?? 0), 0);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 1 — EXECUTIVE OVERVIEW
  // ══════════════════════════════════════════════════════════════════
  paintPageBackground(doc);

  // Top espresso header strip
  fillColor(doc, COLORS.bgDark);
  doc.rect(0, 0, W, 28, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  textColor(doc, COLORS.textOnDark);
  doc.text('Case Intelligence Suite — Operational Intelligence Brief', W / 2, 13, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(210, 207, 201);
  doc.text(
    `Period: ${summary.weekRange}   |   Prepared: ${new Date().toLocaleDateString('en-GB')}`,
    W / 2, 22, { align: 'center' },
  );

  // Thin terracotta rule beneath strip
  fillColor(doc, COLORS.bgAccentStrip);
  doc.rect(0, 28, W, 1.5, 'F');

  // ── 4 KPI tiles ──────────────────────────────────────────────
  const kpiY  = 36;
  const kpiW  = (W - MARGIN * 2 - 12) / 4;
  const kpiH  = 30;
  const kpiGap = 4;

  kpiTile(doc, MARGIN,                         kpiY, kpiW, kpiH,
    summary.totalCases.toLocaleString(), 'Total Cases');
  kpiTile(doc, MARGIN + (kpiW + kpiGap),       kpiY, kpiW, kpiH,
    `${summary.preventablePct.toFixed(1)}%`, 'Preventable Workload %');
  kpiTile(doc, MARGIN + (kpiW + kpiGap) * 2,  kpiY, kpiW, kpiH,
    `${summary.totalHoursLost.toFixed(0)}h`, 'Total Hours Lost');
  kpiTile(doc, MARGIN + (kpiW + kpiGap) * 3,  kpiY, kpiW, kpiH,
    `${preventableHours.toFixed(0)}h`, 'Preventable Hours');

  let y = kpiY + kpiH + 10;

  // ── Thin section divider ─────────────────────────────────────
  drawColor(doc, COLORS.borderLight);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y, W - MARGIN, y);
  y += 5;

  // ── Chart section labels ──────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  textColor(doc, COLORS.textPrimary);
  doc.text('Case Distribution by Category', MARGIN, y);
  y += 4;

  // ── CHART 1 — Proportional stacked bar (top 6 categories) ────
  const top6 = issueBreakdown.slice(0, 6);
  const top6Total = top6.reduce((s, i) => s + i.count, 0);
  if (top6Total > 0 && top6.length > 0) {
    const segments = top6.map((item, idx) => ({
      label: item.label,
      count: item.count,
      pct: (item.count / (summary.totalCases || 1)) * 100,
      color: CHART_COLORS[idx % CHART_COLORS.length],
    }));
    y = drawProportionalBar(doc, MARGIN, y, W - MARGIN * 2, segments);
  } else {
    noDataRow(doc, y + 4, 'No issue breakdown data available.');
    y += 14;
  }

  y += 4;

  // ── CHART 2 — Hours Lost by Category (horizontal bar chart) ──
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  textColor(doc, COLORS.textPrimary);
  doc.text('Hours Lost by Category (Top 6)', MARGIN, y);
  y += 4;

  const hoursSorted = [...issueBreakdown]
    .filter(i => i.hoursLost > 0)
    .sort((a, b) => b.hoursLost - a.hoursLost)
    .slice(0, 6);

  if (hoursSorted.length > 0) {
    const maxHours = hoursSorted[0].hoursLost;
    y = drawHorizBarChart(
      doc, MARGIN, y, W - MARGIN * 2,
      hoursSorted.map(i => ({ label: i.label, value: Math.round(i.hoursLost) })),
      maxHours,
      6, 3,
      COLORS.bgAccentStrip,
    );
  } else {
    noDataRow(doc, y + 4, 'No hours data available.');
    y += 14;
  }

  y += 4;

  // ── Executive Findings ────────────────────────────────────────
  if (y < 240) {
    drawColor(doc, COLORS.borderLight);
    doc.setLineWidth(0.3);
    doc.line(MARGIN, y, W - MARGIN, y);
    y += 5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    textColor(doc, COLORS.textAccent);
    doc.text('Executive Findings', MARGIN, y);
    y += 5;

    const findings = generateExecutiveFindings(analysis);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    textColor(doc, COLORS.textSecondary);
    for (const finding of findings) {
      if (y > 270) break;
      const lines = doc.splitTextToSize(`\u2022  ${finding}`, W - MARGIN * 2 - 4);
      doc.text(lines, MARGIN + 2, y);
      y += lines.length * 4.5 + 2;
    }
  }

  addPageFooter(doc, pg, TOTAL_PAGES, W, MARGIN);

  // ══════════════════════════════════════════════════════════════════
  // PAGE 2 — EXECUTIVE SUMMARY
  // ══════════════════════════════════════════════════════════════════
  doc.addPage(); pg++;
  paintPageBackground(doc);

  y = sectionHeader(doc, 18, 'Executive Summary', W, MARGIN);

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

  // Intro sentence
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  textColor(doc, COLORS.textSecondary);
  doc.text(
    'This section highlights the operational issue categories generating the highest case volume and workload across the reporting period.',
    MARGIN, y, { maxWidth: W - MARGIN * 2 },
  );
  y += 10;

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
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 60 },
      2: { cellWidth: 18 },
      3: { cellWidth: 18 },
      4: { cellWidth: 25 },
      5: { cellWidth: 18 },
      6: { cellWidth: 20 },
    },
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
      head: [['Customer', 'Cases', 'Hours', 'Preventable %', 'Load Ref', 'Customs', 'Top Issue', 'Risk']],
      body: customerBurden.slice(0, 30).map(c => [
        c.name,
        c.count,
        c.hoursLost.toFixed(1),
        `${c.preventablePct.toFixed(0)}%`,
        c.missingLoadRef || '—',
        c.missingCustomsDocs || '—',
        c.topIssue,
        c.risk,
      ]),
      columnStyles: {
        0: { cellWidth: 55 },
        1: { cellWidth: 16 },
        2: { cellWidth: 16 },
        3: { cellWidth: 22 },
        4: { cellWidth: 14 },
        5: { cellWidth: 14 },
        6: { cellWidth: 25 },
        7: { cellWidth: 12 },
      },
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
    // Mini bar chart — Top 10 transporters by case volume
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    textColor(doc, COLORS.textPrimary);
    doc.text('Top 10 Transporters by Case Volume', MARGIN, y);
    y += 4;

    const top10transporters = transporterPerformance
      .slice(0, 10)
      .map(t => ({ label: t.name, value: t.count }));
    const maxTCount = top10transporters.length > 0
      ? Math.max(...top10transporters.map(t => t.value))
      : 1;

    y = drawHorizBarChart(
      doc, MARGIN, y, W - MARGIN * 2,
      top10transporters, maxTCount,
      5, 2,
      [170, 110, 70] as [number,number,number],
    );
    y += 4;

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

  // 4 KPI tiles
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

  // ── Weekly trend — visual bar chart ─────────────────────────
  const weeklyMissing  = lr.weeklyMissing ?? {};
  const weeklyEntries  = Object.entries(weeklyMissing)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8);

  if (weeklyEntries.length >= 2 && y < 200) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    textColor(doc, COLORS.textPrimary);
    doc.text('Weekly Trend — Missing Load References', MARGIN, y);
    y += 5;

    const weekBarData = weeklyEntries.map(([wk, cnt]) => ({
      week: wk,
      count: typeof cnt === 'number' ? cnt : Number(cnt),
    }));
    y = drawWeeklyBarChart(doc, MARGIN, y, W - MARGIN * 2, 28, weekBarData);
  }

  // ── Two-column layout: Top Transporters | Top Customers ──────
  const colW   = (W - MARGIN * 2 - 6) / 2;
  const colGap = 6;
  const colRightX = MARGIN + colW + colGap;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  textColor(doc, COLORS.textPrimary);
  doc.text('Top Transporters', MARGIN, y);
  doc.text('Top Customers',    colRightX, y);
  y += 4;

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
    // Horizontal bar chart — Cases by Area
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    textColor(doc, COLORS.textPrimary);
    doc.text('Cases by Area', MARGIN, y);
    y += 4;

    const areaBarItems = [...areaHotspots]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(a => ({ label: a.name, value: a.count }));
    const maxAreaCount = areaBarItems.length > 0
      ? Math.max(...areaBarItems.map(a => a.value))
      : 1;

    y = drawHorizBarChart(
      doc, MARGIN, y, W - MARGIN * 2,
      areaBarItems, maxAreaCount,
      5, 2,
      COLORS.highlightBlue as [number,number,number],
    );
    y += 4;

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

  const actionGroups = buildActionGroups(actions);

  if (actionGroups.length === 0) {
    noDataRow(doc, y + 4, 'No priority actions generated.');
    y += 14;
  } else {
    for (const group of actionGroups) {
      if (y > 255) break;

      // Group label with terracotta accent bar
      fillColor(doc, COLORS.bgAccentStrip);
      doc.rect(MARGIN, y, 2.5, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      textColor(doc, COLORS.textAccent);
      doc.text(group.groupLabel, MARGIN + 5, y + 4);
      y += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      textColor(doc, COLORS.textSecondary);
      for (const item of group.items) {
        if (y > 260) break;
        const lines = doc.splitTextToSize(`\u2022  ${item}`, W - MARGIN * 2 - 6);
        doc.text(lines, MARGIN + 4, y);
        y += lines.length * 4.5 + 1.5;
      }
      y += 4;
    }
  }

  // Predictive forecast (if space allows)
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
        MARGIN, y,
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
