/**
 * Export Workbook Service — Template-based
 *
 * Loads public/export_template.xlsx, fills it with engine-computed data
 * while preserving the template's formatting, then triggers download.
 *
 * Sheets: Assumption | Production Env | UAT Env | Dev Env |
 *         Platform Recommendations | Architecture
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  AppFormData,
  CalculationResult,
  ServerSpec,
} from '../types';
import { calculateInfra } from './CalculatorEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportWorkbookInput {
  /** Current form state */
  formData: AppFormData;
  /** Engine result for the currently selected environment */
  result: CalculationResult;
}

// ─── Style Snapshot Helpers ──────────────────────────────────────────────────

type StyleSnap = {
  font?: Partial<ExcelJS.Font>;
  fill?: ExcelJS.Fill;
  border?: Partial<ExcelJS.Borders>;
  alignment?: Partial<ExcelJS.Alignment>;
};

function snap(cell: ExcelJS.Cell): StyleSnap {
  const s: StyleSnap = {};
  try { if (cell.font && Object.keys(cell.font).length) s.font = JSON.parse(JSON.stringify(cell.font)); } catch { /* ignore */ }
  try { if (cell.fill && (cell.fill as any).type) s.fill = JSON.parse(JSON.stringify(cell.fill)); } catch { /* ignore */ }
  try { if (cell.border && Object.keys(cell.border).length) s.border = JSON.parse(JSON.stringify(cell.border)); } catch { /* ignore */ }
  try { if (cell.alignment && Object.keys(cell.alignment).length) s.alignment = JSON.parse(JSON.stringify(cell.alignment)); } catch { /* ignore */ }
  return s;
}

function applySnap(cell: ExcelJS.Cell, s: StyleSnap) {
  if (s.font) cell.font = s.font;
  if (s.fill) cell.fill = s.fill;
  if (s.border) cell.border = s.border;
  if (s.alignment) cell.alignment = s.alignment;
}

// ─── Block Styles (env sheets) ───────────────────────────────────────────────

interface BlockStyles {
  name: StyleSnap;       // Server name row (col C, merged C:D)
  specLabel: StyleSnap;  // Specification label cell (col C, bold + gray fill)
  specValue: StyleSnap;  // Specification value cell (col D, bold + gray fill)
  dataLabel: StyleSnap;  // Data label cells (col C: RAM, HDD… — not bold, no fill)
  dataValue: StyleSnap;  // Data value cells (col D: values — not bold, no fill)
  note: StyleSnap;       // Notes cell (col E, PROD only)
}

/** Capture styles from the first server block in the template.
 *  startRow     = server name row
 *  startRow + 1 = Specification row (bold, gray fill)
 *  startRow + 2 = RAM row (normal data style) */
function captureBlockStyles(ws: ExcelJS.Worksheet, startRow: number): BlockStyles {
  return {
    name:      snap(ws.getCell(startRow, 3)),       // Server name
    specLabel: snap(ws.getCell(startRow + 1, 3)),   // Specification label (bold + gray)
    specValue: snap(ws.getCell(startRow + 1, 4)),   // Specification value (bold + gray)
    dataLabel: snap(ws.getCell(startRow + 2, 3)),   // RAM label (data style)
    dataValue: snap(ws.getCell(startRow + 2, 4)),   // RAM value (data style)
    note:      snap(ws.getCell(startRow, 5)),        // Notes
  };
}

// ─── Clear Data Area ─────────────────────────────────────────────────────────

/** Remove all merges at or below `fromRow`, then clear cell values */
function clearFrom(ws: ExcelJS.Worksheet, fromRow: number) {
  // 1. Remove merges in data area (access ExcelJS internal structure)
  try {
    const merges: Record<string, any> = (ws as any)._merges;
    if (merges && typeof merges === 'object') {
      const keys = Object.keys(merges);
      for (const key of keys) {
        const mc = merges[key];
        const m = mc?.model || mc;
        if (m && typeof m.top === 'number' && m.top >= fromRow) {
          try { ws.unMergeCells(m.top, m.left, m.bottom, m.right); } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  // 2. Clear cell values AND formatting so empty rows don't keep gray fills / borders
  const lastRow = Math.max(ws.rowCount, fromRow + 300);
  for (let r = fromRow; r <= lastRow; r++) {
    const row = ws.getRow(r);
    // Iterate cols A-F (1-6) — broad sweep to catch all template styling
    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.value = null;
      // Reset entire style object — this is the only reliable way to strip
      // leftover gray fills, borders, fonts from template cells
      cell.style = {};
    }
  }
}

// ─── Server Notes (PROD column E) ───────────────────────────────────────────

function noteFor(server: ServerSpec): string {
  const id = server.id.toLowerCase();
  const nm = server.name.toLowerCase();

  if (id.includes('forward') || nm.includes('forward') || nm.includes('haproxy') || nm.includes('ha proxy'))
    return 'HAProxy(High Availability Proxy) load balancer will distribute the workload across application servers.\nAlso serves as web layer for CRM Application';

  if ((id.includes('crm') || nm.includes('crm')) && (nm.includes('app') || nm.includes('application')))
    return 'Storage space for upload documents can vary based on the requirements and use cases';

  if (nm.includes('database') || (nm.includes('db') && nm.includes('server') && !nm.includes('app+db')))
    return 'HDD size is for average data assumptions, it can be changed based on actual requirements';

  if (id.includes('mkt') || nm.includes('marketing'))
    return 'Can be as Proxy server for Marketing app as it needs to be exposed on Public front.\nCan keep marketing application on DMZ and DB will be in Internal Zone over port 3306';

  if (id.includes('talend') || nm.includes('talend'))
    return 'Data migration and sync jobs (optional)';

  if (id.includes('clickhouse') || nm.includes('clickhouse') || nm.includes('analytical'))
    return 'Metabase application for Analytical reports';

  if (id.includes('bot-gpu') || nm.includes('gpu worker'))
    return 'GPU-accelerated AI inference worker';

  if (id.includes('rocketchat') || nm.includes('rocket'))
    return 'Team communication and messaging platform';

  return '';
}

// ─── Write One Server Block (7 rows) ────────────────────────────────────────

function writeBlock(
  ws: ExcelJS.Worksheet,
  row: number,
  srv: ServerSpec,
  st: BlockStyles,
  isProd: boolean,
) {
  // Server name (merged C:D)
  ws.mergeCells(row, 3, row, 4);
  const nameCell = ws.getCell(row, 3);
  nameCell.value = srv.name;
  applySnap(nameCell, st.name);

  // Specification (bold + gray fill)
  const specL = ws.getCell(row + 1, 3); specL.value = 'Specification'; applySnap(specL, st.specLabel);
  const specV = ws.getCell(row + 1, 4); specV.value = srv.specification || ''; applySnap(specV, st.specValue);

  // RAM (data style — not bold, no fill)
  const ramL = ws.getCell(row + 2, 3); ramL.value = 'RAM'; applySnap(ramL, st.dataLabel);
  const ramV = ws.getCell(row + 2, 4); ramV.value = srv.ram; applySnap(ramV, st.dataValue);

  // HDD
  const hddL = ws.getCell(row + 3, 3); hddL.value = 'HDD'; applySnap(hddL, st.dataLabel);
  const hddV = ws.getCell(row + 3, 4); hddV.value = srv.hdd; applySnap(hddV, st.dataValue);

  // Processor
  const cpuL = ws.getCell(row + 4, 3); cpuL.value = 'Processor'; applySnap(cpuL, st.dataLabel);
  const cpuV = ws.getCell(row + 4, 4); cpuV.value = srv.cpu; applySnap(cpuV, st.dataValue);

  // OS
  const osL = ws.getCell(row + 5, 3); osL.value = 'OS'; applySnap(osL, st.dataLabel);
  const osV = ws.getCell(row + 5, 4); osV.value = srv.os; applySnap(osV, st.dataValue);

  // Row +6 is the blank separator row — left empty

  // Notes column (PROD only, col E merged vertically)
  if (isProd) {
    let notes = noteFor(srv);
    if (srv.gpu?.enabled) {
      const gpu = `GPU: ${srv.gpu.type} (${srv.gpu.vram})`;
      notes = notes ? `${notes}\n${gpu}` : gpu;
    }
    if (notes) {
      ws.mergeCells(row, 5, row + 5, 5);
      const noteCell = ws.getCell(row, 5);
      noteCell.value = notes;
      applySnap(noteCell, st.note);
      noteCell.alignment = { ...(noteCell.alignment || {}), wrapText: true, vertical: 'middle' };
    }
  }
}

// ─── Fill: Assumption Sheet ──────────────────────────────────────────────────

function fillAssumption(
  ws: ExcelJS.Worksheet,
  fd: AppFormData,
  _res: CalculationResult,
) {
  // Capture styles from existing cells before clearing
  const headerSt = snap(ws.getCell('A1'));
  const labelSt = snap(ws.getCell('A2'));
  const valueSt = snap(ws.getCell('B2'));

  clearFrom(ws, 1);

  let r = 1;

  // ── CRM Load ──────────────────────────────────────────────
  ws.mergeCells(`A${r}:B${r}`);
  ws.getCell(`A${r}`).value = 'Load Calculation - CRM';
  applySnap(ws.getCell(`A${r}`), headerSt);
  r++;

  const crmActive = (fd.crm.namedUsers * fd.crm.concurrencyRate) / 100;
  const crmTPS = (crmActive * fd.crm.triggersPerMinute) / 60;

  const crmRows: [string, string | number][] = [
    ['Named Users', fd.crm.namedUsers],
    ['Concurrent logged in sessions', fd.crm.concurrencyRate / 100],
    ['No of server load triggers per active session per minute', fd.crm.triggersPerMinute],
    ['Number of server load triggers/second', Number(crmTPS.toFixed(6))],
    ['Total number of active load users/second', Number(crmActive.toFixed(2))],
  ];
  for (const [label, value] of crmRows) {
    ws.getCell(`A${r}`).value = label; applySnap(ws.getCell(`A${r}`), labelSt);
    ws.getCell(`B${r}`).value = value; applySnap(ws.getCell(`B${r}`), valueSt);
    r++;
  }
  r += 2; // blank separator (extra gap before heading)

  // ── Marketing Load (if enabled) ───────────────────────────
  if (fd.solutions.marketing) {
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = 'Load Calculation - Marketing';
    applySnap(ws.getCell(`A${r}`), headerSt);
    r++;

    const mktActive = (fd.marketing.namedUsers * fd.marketing.concurrencyRate) / 100;
    const mktTPS = (mktActive * fd.marketing.triggersPerMinute) / 60;

    const mktRows: [string, string | number][] = [
      ['Named Users', fd.marketing.namedUsers],
      ['Concurrent logged in sessions', fd.marketing.concurrencyRate / 100],
      ['No of server load triggers per active session per minute', fd.marketing.triggersPerMinute],
      ['Number of server load triggers/second', Number(mktTPS.toFixed(6))],
      ['Total number of active load users/second', Number(mktActive.toFixed(2))],
    ];
    for (const [label, value] of mktRows) {
      ws.getCell(`A${r}`).value = label; applySnap(ws.getCell(`A${r}`), labelSt);
      ws.getCell(`B${r}`).value = value; applySnap(ws.getCell(`B${r}`), valueSt);
      r++;
    }
    r += 2; // blank separator (extra gap before heading)
  }

  // ── R-YaBot Load ──────────────────────────────────────────
  ws.mergeCells(`A${r}:B${r}`);
  ws.getCell(`A${r}`).value = 'Load Calculation - R-Yabot';
  applySnap(ws.getCell(`A${r}`), headerSt);
  r++;

  const botRPM = fd.bot.activeUsers * fd.bot.requestsPerMinute;
  const tpm = botRPM * fd.bot.avgTokensPerRequest;

  const botRows: [string, string | number][] = [
    ['Concurrently Active Users Interacting with Bot', fd.bot.activeUsers],
    ['No of Bot Requests Per User Per Minute', fd.bot.requestsPerMinute],
    ['Total Number of Concurrent Bot Requests Per Minute', botRPM],
    ['Avg No of Tokens per Request (100 words ~ 133 tokens)', fd.bot.avgTokensPerRequest],
    ['Total No of Tokens Per Minute (TPM)', tpm],
  ];
  for (const [label, value] of botRows) {
    ws.getCell(`A${r}`).value = label; applySnap(ws.getCell(`A${r}`), labelSt);
    ws.getCell(`B${r}`).value = value; applySnap(ws.getCell(`B${r}`), valueSt);
    r++;
  }
  r += 3; // larger gap before requirements

  // ── Requirements ──────────────────────────────────────────
  ws.getCell(`A${r}`).value = 'Requirements';
  applySnap(ws.getCell(`A${r}`), headerSt);
  r++;

  const reqs = [
    '3-tire Application Architecture - Presentation, Web and Database Layer',
    'Presentation and Web layer will deploy on Single server, but flexible to keep on separate server',
    'PreProd will be the 50% of Production enviroment (If applicable)',
    'DR will be replica of the DC',
    'DC to DR bandwidth will be 40 Mbps',
    'Users bandwidth will be minimum 50 Mbps from on Load Balancer end',
    'Internal server bandwidth will be 100 Mbps',
    'For 3rd party integration - minimum bandwidth will be 50 Mbps',
    "All servers can be Virtual Machine subjective to Client's policy",
    'Initial server sizing can be smaller for cost saving',
    'Shared 3rd Party integration are for illustration purpose based on assumptions',
  ];
  for (const req of reqs) {
    ws.getCell(`A${r}`).value = req;
    applySnap(ws.getCell(`A${r}`), labelSt);
    r++;
  }
}

// ─── Fill: Environment Sheet (PROD / UAT / DEV) ─────────────────────────────

function fillEnvSheet(
  ws: ExcelJS.Worksheet,
  result: CalculationResult,
  fd: AppFormData,
  isProd: boolean,
) {
  const dataStartRow = isProd ? 4 : 5;

  // Capture styles from first server block before clearing
  const styles = captureBlockStyles(ws, dataStartRow);

  // Update header rows (keep existing merge + styles, just update text)
  if (isProd) {
    ws.getCell('B1').value =
      'Note : The resources mentioned below are based on initial assumptions and it might get increased.';
    ws.getCell('B2').value =
      `Assuming upto ${result.crmMetrics.activeLoadUsers} concurrent users for ${fd.clientName || 'client'} (As per Server load Calculation)\nDR will be replica of DC`;
  } else {
    const envLabel = ws.name?.includes('UAT') ? 'UAT' : 'Dev';
    ws.getCell('B2').value =
      'Note : The resources mentioned below are based on initial assumptions and it might get increased.';
    ws.getCell('B3').value =
      `Assuming ${result.crmMetrics.activeLoadUsers} concurrent users for ${envLabel}`;
  }

  // Clear data area (merges + cell values)
  clearFrom(ws, dataStartRow);

  // SaaS mode — no servers, just a message
  if (result.saasMessage) {
    ws.getCell(dataStartRow, 3).value = result.saasMessage;
    return;
  }

  // Write server blocks
  let row = dataStartRow;
  for (const srv of result.servers) {
    writeBlock(ws, row, srv, styles, isProd);
    row += 7;
  }

  // Cloud cost section (if RyaBot on-cloud)
  if (result.ryaBotCloudCost) {
    row++;
    ws.mergeCells(row, 3, row, 4);
    const hdr = ws.getCell(row, 3);
    hdr.value = 'R-YaBot Cloud Cost Estimate';
    applySnap(hdr, styles.name);
    row++;

    const costRows: [string, string | number][] = [
      ['Provider', result.ryaBotCloudCost.provider],
      ['TPM', result.ryaBotCloudCost.tpm],
      ['Monthly Cost (USD)', `$${result.ryaBotCloudCost.monthlyCostUSD.toLocaleString()}`],
      ['Notes', result.ryaBotCloudCost.notes],
    ];
    for (const [k, v] of costRows) {
      ws.getCell(row, 3).value = k; applySnap(ws.getCell(row, 3), styles.dataLabel);
      ws.getCell(row, 4).value = v; applySnap(ws.getCell(row, 4), styles.dataValue);
      row++;
    }
  }
}

// ─── Fill: Platform Recommendations Sheet ────────────────────────────────────
// The template already contains the full Platform Recommendations sheet with
// proper formatting (blue headers, black data rows, etc.). We leave it
// completely untouched so all styles, merges, and layout are preserved as-is.
// This sheet is intentionally NOT modified at export time.

// ─── Main Export Function ────────────────────────────────────────────────────

/**
 * Load the Excel template, fill it with computed engine data, and trigger download.
 */
export async function exportSizingWorkbook(input: ExportWorkbookInput): Promise<void> {
  const { formData, result } = input;

  // 1. Fetch template
  const response = await fetch('/export_template.xlsx');
  const buffer = await response.arrayBuffer();

  // 2. Load workbook (preserves all formatting, column widths, row heights)
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // 3. Get worksheet references
  const assumptionWs = wb.getWorksheet('Assumption')!;
  const prodWs       = wb.getWorksheet('Production Env')!;
  const uatWs        = wb.getWorksheet('UAT Env')!;
  const devWs        = wb.getWorksheet('Dev Env')!;
  // Platform Recommendations & Architecture sheets are left as-is from template

  // 4. Compute results for all three environments
  const prodResult = formData.environment === 'PROD'
    ? result
    : calculateInfra({ ...formData, environment: 'PROD' });
  const uatResult = calculateInfra({ ...formData, environment: 'UAT' });
  const devResult = calculateInfra({ ...formData, environment: 'DEV' });

  // 5. Fill each sheet
  fillAssumption(assumptionWs, formData, result);
  fillEnvSheet(prodWs, prodResult, formData, true);
  fillEnvSheet(uatWs,  uatResult,  formData, false);
  fillEnvSheet(devWs,  devResult,  formData, false);
  // Platform Recommendations & Architecture sheets are left as-is from template

  // 6. Generate buffer and download
  const outBuffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([outBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const clientSlug = (formData.clientName || 'Infra').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${clientSlug}_Sizing_Report_${dateStr}.xlsx`);
}
