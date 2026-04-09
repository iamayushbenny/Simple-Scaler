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
import { calculateInfra, calculateLoadMetrics } from './CalculatorEngine';
import { getPlatformRecommendations, getSelectedStackIds, ProductStackId, SoftwareRecommendation } from '../config/platformRecommendations';

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

  // ── CRM Load (only when selected) ─────────────────────────
  if (fd.solutions.crm) {
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = 'Load Calculation - CRM';
    applySnap(ws.getCell(`A${r}`), headerSt);
    r++;

    const crmLoad = calculateLoadMetrics(fd.crm.namedUsers, fd.crm.concurrencyRate, fd.crm.triggersPerMinute);

    const crmRows: [string, string | number][] = [
      ['Named Users', fd.crm.namedUsers],
      ['Concurrent logged in sessions', `${fd.crm.concurrencyRate}%`],
      ['No of server load triggers per active session per minute', fd.crm.triggersPerMinute],
      ['Number of server load triggers/second', Number(crmLoad.perSecondRate.toFixed(6))],
      ['Total number of active load users/second', Number(crmLoad.activeLoadPerSecond.toFixed(6))],
    ];
    for (const [label, value] of crmRows) {
      ws.getCell(`A${r}`).value = label; applySnap(ws.getCell(`A${r}`), labelSt);
      ws.getCell(`B${r}`).value = value; applySnap(ws.getCell(`B${r}`), valueSt);
      r++;
    }
    r += 2; // blank separator (extra gap before heading)
  }

  // ── Marketing Load (if enabled) ───────────────────────────
  if (fd.solutions.marketing) {
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = 'Load Calculation - Marketing';
    applySnap(ws.getCell(`A${r}`), headerSt);
    r++;

    const mktLoad = calculateLoadMetrics(fd.marketing.namedUsers, fd.marketing.concurrencyRate, fd.marketing.triggersPerMinute);

    const mktRows: [string, string | number][] = [
      ['Named Users', fd.marketing.namedUsers],
      ['Concurrent logged in sessions', `${fd.marketing.concurrencyRate}%`],
      ['No of server load triggers per active session per minute', fd.marketing.triggersPerMinute],
      ['Number of server load triggers/second', Number(mktLoad.perSecondRate.toFixed(6))],
      ['Total number of active load users/second', Number(mktLoad.activeLoadPerSecond.toFixed(6))],
    ];
    for (const [label, value] of mktRows) {
      ws.getCell(`A${r}`).value = label; applySnap(ws.getCell(`A${r}`), labelSt);
      ws.getCell(`B${r}`).value = value; applySnap(ws.getCell(`B${r}`), valueSt);
      r++;
    }
    r += 2; // blank separator (extra gap before heading)
  }

  // ── R-YaBot Load (only when selected) ─────────────────────
  if (fd.solutions.ryaBot) {
    ws.mergeCells(`A${r}:B${r}`);
    ws.getCell(`A${r}`).value = 'Load Calculation - R-Yabot';
    applySnap(ws.getCell(`A${r}`), headerSt);
    r++;

    const botRPM = fd.bot.activeUsers * fd.bot.requestsPerMinute;
    const tpm = botRPM * fd.bot.avgTokensPerRequest;

    const botRows: [string, string | number][] = [
      ['Concurrently Active Users Interacting with Bot', fd.bot.activeUsers],
      ['No of Bot Requests Per User Per Minute', fd.bot.requestsPerMinute],
      ['Total Number of Concurrent Bot Requests Per Minute', Number(botRPM.toFixed(6))],
      ['Avg No of Tokens per Request (100 words ~ 133 tokens)', fd.bot.avgTokensPerRequest],
      ['Total No of Tokens Per Minute (TPM)', Number(tpm.toFixed(2))],
    ];
    for (const [label, value] of botRows) {
      ws.getCell(`A${r}`).value = label; applySnap(ws.getCell(`A${r}`), labelSt);
      ws.getCell(`B${r}`).value = value; applySnap(ws.getCell(`B${r}`), valueSt);
      r++;
    }
    r += 3; // larger gap before requirements
  }

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

function fillPreRequisites(ws: ExcelJS.Worksheet) {
  ws.getColumn(1).width = 135;
  ws.getColumn(1).alignment = { vertical: 'top', wrapText: true, horizontal: 'left' };

  const headerFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E5CC6' },
  };

  const highlightFill: ExcelJS.Fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFFFFF00' },
  };

  const contentRows = [
    { type: 'header' as const, text: 'Infrastructure Pre-requisite' },
    { type: 'text' as const, text: "Server Sizing: The server size must adhere to SimpleCRM's hardware sizing sheet. Initially, a small-sized server is acceptable, particularly for virtual servers." },
    { type: 'text' as const, text: "Network Architecture: The network architecture should align with SimpleCRM's hardware sizing sheet." },
    { type: 'text' as const, text: "Technology Stack: The software and stack versions should be on SimpleCRM's hardware sizing sheet." },
    { type: 'text' as const, text: 'Tools Requirement: Deployment, support, and maintenance necessitate access to Putty and FTP.' },
    { type: 'text' as const, text: 'Connectivity of the server to SimpleCRM team can be over either SSL VPN or SiteToSite VPN only with Split Tunnel mode.' },
    { type: 'text' as const, text: 'Remote screen tools like WebEx,Teams,Anydesk or Teamviewer will not work for Deployment and Developement process.' },
    { type: 'text' as const, text: 'Monitoring Tool: A monitoring tool must be configured on the server. The client is responsible for procuring either an open-source or paid monitoring tool like Grafana/Prometheous or Zabbix.' },
    { type: 'text' as const, text: 'All ports should be communicate between all CRM servers internally' },
    { type: 'text' as const, text: 'Bandwidth: The minimum required internet bandwidth connectivity between the data center (DC) and the disaster recovery (DR) site should be 40 Mbps.' },
    { type: 'blank' as const, text: '' },
    { type: 'header' as const, text: 'Access Pre-requisite' },
    { type: 'text' as const, text: 'Internet Access for Deployment: Full internet access without restrictions is required for the initial deployment of the LAMP stack to download necessary files from relevant repositories. Whitelisting of URLs will not work as it fetches the download from multiple mirror source based on location/region.' },
    { type: 'text' as const, text: 'Post-Deployment Internet Access: After deployment, internet access can be restricted as per integration and configuration needs.' },
    { type: 'text' as const, text: 'Server Access Dependency: If continuous server access is not provided to SimpleCRM, the turnaround time (TAT) will be increased based on dependencies.' },
    { type: 'text' as const, text: 'Remote Access Protocols: Provision of secure remote access solutions for authorized users from any location. Utilization of virtual private networks (VPNs) or SSL encryption for data integrity during remote sessions.' },
    { type: 'text' as const, text: 'Access Logs and Auditing: Generation of access logs to monitor user activities and system usage. Auditing of access logs to detect and mitigate security threats.' },
    { type: 'text' as const, text: 'Backup and Recovery Procedures: Regular backup procedures to prevent data loss and system failures. Defined recovery protocols to restore data and functionality in case of incidents. Customer needs to align necessary arrangements for the same.' },
    { type: 'text' as const, text: 'Emergency Access Procedures: Establishment of emergency access procedures for authorized personnel to address critical issues or system outages. Clearly defined escalation paths and contact information for obtaining emergency assistance and support.' },
    { type: 'text' as const, text: 'Any external connection required for mentioned integration needs to be allowed by customer' },
    { type: 'text' as const, text: 'Marketing application to be placed in DMZ and allowing the connections with Bulkemail SMTP and IMAP for bounce management' },
    { type: 'text' as const, text: "Number of servers can be reduce if HA is not required based on Client's requirements" },
    { type: 'text' as const, text: 'Client SOC shall review the architecture and revert if any queries regarding the connection and placement of the applications or flows' },
  ];

  let rowNum = 1;
  for (const entry of contentRows) {
    const row = ws.getRow(rowNum);
    const cell = ws.getCell(rowNum, 1);

    if (entry.type === 'header') {
      cell.value = entry.text;
      cell.font = { name: 'Poppins', bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
      cell.fill = headerFill;
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      row.height = 22;
    } else if (entry.type === 'blank') {
      row.height = 10;
      cell.value = '';
    } else {
      cell.value = entry.text;
      const isLastLine = rowNum === contentRows.length;
      cell.font = { name: 'Poppins', size: 11, color: { argb: 'FF000000' }, bold: isLastLine };
      cell.alignment = { vertical: 'top', wrapText: true };
      if (isLastLine) {
        cell.fill = highlightFill;
      }

      // Poppins wraps slightly earlier than default fonts; keep extra headroom to avoid clipped lines.
      const approxCharsPerLine = 125;
      const lineCount = entry.text
        .split('\n')
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / approxCharsPerLine)), 0);
      row.height = Math.max(20, lineCount * 18);
    }

    rowNum++;
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

  // Determine server priority for sorted export
  const getSortPriority = (srv: ServerSpec) => {
    const nm = srv.name.toLowerCase();
    const id = srv.id.toLowerCase();
    if (nm.includes('forward') || id.includes('forward')) return 1;
    if (nm.includes('marketing') || id.includes('mkt')) return 2;
    if (nm.includes('haproxy') || nm.includes('ha proxy') || id.includes('haproxy')) return 3;
    if (nm.includes('presentation') || id.includes('presentation')) return 4;
    return 999;
  };

  // Stably sort servers based on priority
  const sortedServers = result.servers
    .map((srv, index) => ({ srv, index, priority: getSortPriority(srv) }))
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return a.index - b.index; // Fallback to original relative order
    })
    .map(item => item.srv);

  // Write server blocks
  let row = dataStartRow;
  for (const srv of sortedServers) {
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
function selectedStackSections(fd: AppFormData): Array<{ title: string; rows: SoftwareRecommendation[] }> {
  const cfg = getPlatformRecommendations();
  const stackIds = getSelectedStackIds(fd);
  const titleByStack: Record<ProductStackId, string> = {
    crm: 'SimpleCRM Platform Recommendations - CRM',
    ryabot: 'SimpleCRM Platform Recommendations - R-YaBot',
    marketing: 'SimpleCRM Platform Recommendations - Marketing',
    chatbot: 'SimpleCRM Chatbot Recommendations - v6',
  };

  const sections: Array<{ title: string; rows: SoftwareRecommendation[] }> = [];
  for (const stackId of stackIds) {
    const stackRows = cfg.productStacks?.[stackId] || [];
    if (stackRows.length > 0) {
      sections.push({ title: titleByStack[stackId], rows: stackRows });
    }
  }

  // Legacy fallback: if no stack rows are available, render one generic section.
  if (sections.length === 0 && cfg.software?.length) {
    sections.push({
      title: 'SimpleCRM Platform Recommendations',
      rows: cfg.software,
    });
  }

  return sections;
}

function clearMergesAndValues(ws: ExcelJS.Worksheet, fromRow: number, toRow: number) {
  try {
    const merges: Record<string, any> = (ws as any)._merges;
    if (merges && typeof merges === 'object') {
      const keys = Object.keys(merges);
      for (const key of keys) {
        const mc = merges[key];
        const m = mc?.model || mc;
        if (!m || typeof m.top !== 'number') continue;
        if (m.top >= fromRow && m.bottom <= toRow) {
          try { ws.unMergeCells(m.top, m.left, m.bottom, m.right); } catch { /* ignore */ }
        }
      }
    }
  } catch { /* ignore */ }

  for (let r = fromRow; r <= toRow; r++) {
    ws.getCell(r, 2).value = null;
    ws.getCell(r, 3).value = null;
  }
}

function fillPlatformRecommendationsSheet(ws: ExcelJS.Worksheet, fd: AppFormData) {
  const cfg = getPlatformRecommendations();
  const sections = selectedStackSections(fd);
  const browserRows = cfg.browsers || [];

  // Template anchors (existing sheet layout)
  const softwareTitleRow = 1;
  const softwareHeaderRow = 2;
  const softwareDataStartRow = 3;
  const browserTitleTemplateRow = 10;
  const browserHeaderTemplateRow = 11;
  const browserDataTemplateRow = 12;

  const sectionTitleStyle = snap(ws.getCell(softwareTitleRow, 2));
  const sectionHeaderLeftStyle = snap(ws.getCell(softwareHeaderRow, 2));
  const sectionHeaderRightStyle = snap(ws.getCell(softwareHeaderRow, 3));
  const softwareDataLeftStyle = snap(ws.getCell(softwareDataStartRow, 2));
  const softwareDataRightStyle = snap(ws.getCell(softwareDataStartRow, 3));
  const browserTitleStyle = snap(ws.getCell(browserTitleTemplateRow, 2));
  const browserHeaderLeftStyle = snap(ws.getCell(browserHeaderTemplateRow, 2));
  const browserHeaderRightStyle = snap(ws.getCell(browserHeaderTemplateRow, 3));
  const browserDataLeftStyle = snap(ws.getCell(browserDataTemplateRow, 2));
  const browserDataRightStyle = snap(ws.getCell(browserDataTemplateRow, 3));

  // Clear and rebuild the entire B:C recommendation area to avoid stale layout artifacts.
  clearMergesAndValues(ws, 1, 250);

  let row = 1;

  for (const section of sections) {
    ws.mergeCells(row, 2, row, 3);
    const titleCell = ws.getCell(row, 2);
    titleCell.value = section.title;
    applySnap(titleCell, sectionTitleStyle);
    titleCell.alignment = { ...(titleCell.alignment || {}), horizontal: 'center', vertical: 'middle' };
    row++;

    const hdrL = ws.getCell(row, 2);
    const hdrR = ws.getCell(row, 3);
    hdrL.value = 'Software';
    hdrR.value = 'Supported Versions';
    applySnap(hdrL, sectionHeaderLeftStyle);
    applySnap(hdrR, sectionHeaderRightStyle);
    hdrL.alignment = { ...(hdrL.alignment || {}), horizontal: 'left', vertical: 'middle' };
    hdrR.alignment = { ...(hdrR.alignment || {}), horizontal: 'center', vertical: 'middle' };
    row++;

    for (const sw of section.rows) {
      const left = ws.getCell(row, 2);
      const right = ws.getCell(row, 3);
      left.value = sw.software;
      right.value = sw.supportedVersion;
      applySnap(left, softwareDataLeftStyle);
      applySnap(right, softwareDataRightStyle);
      left.alignment = { ...(left.alignment || {}), horizontal: 'left', vertical: 'middle' };
      right.alignment = { ...(right.alignment || {}), horizontal: 'left', vertical: 'middle' };
      row++;
    }

    // Visual separator between selected stacks.
    row += 1;
  }

  // Render browser section after stacks.
  const browserTitleRow = Math.max(row, 10);
  const browserHeaderRow = browserTitleRow + 1;
  const browserDataStartRow = browserHeaderRow + 1;

  ws.mergeCells(browserTitleRow, 2, browserTitleRow, 3);
  const browserTitleCell = ws.getCell(browserTitleRow, 2);
  browserTitleCell.value = 'SimpleCRM Browser Recommendations';
  applySnap(browserTitleCell, sectionTitleStyle);
  browserTitleCell.alignment = { ...(browserTitleCell.alignment || {}), horizontal: 'center', vertical: 'middle' };

  const browserHeaderLeft = ws.getCell(browserHeaderRow, 2);
  const browserHeaderRight = ws.getCell(browserHeaderRow, 3);
  browserHeaderLeft.value = 'Browser';
  browserHeaderRight.value = 'Supported Versions';
  applySnap(browserHeaderLeft, browserHeaderLeftStyle);
  applySnap(browserHeaderRight, browserHeaderRightStyle);
  browserHeaderLeft.alignment = { ...(browserHeaderLeft.alignment || {}), horizontal: 'left', vertical: 'middle' };
  browserHeaderRight.alignment = { ...(browserHeaderRight.alignment || {}), horizontal: 'center', vertical: 'middle' };

  row = browserDataStartRow;
  for (const br of browserRows) {
    const left = ws.getCell(row, 2);
    const right = ws.getCell(row, 3);
    left.value = br.browser;
    right.value = br.supportedVersion;
    applySnap(left, browserDataLeftStyle);
    applySnap(right, browserDataRightStyle);
    left.alignment = { ...(left.alignment || {}), horizontal: 'left', vertical: 'middle' };
    right.alignment = { ...(right.alignment || {}), horizontal: 'left', vertical: 'middle' };
    row++;
  }

  // Keep references to template anchor constants for readability.
  void softwareTitleRow;
  void softwareHeaderRow;
}

// ─── Main Export Function ────────────────────────────────────────────────────

/**
 * Load the Excel template, fill it with computed engine data, and trigger download.
 */
export async function exportSizingWorkbook(input: ExportWorkbookInput): Promise<void> {
  const { formData, result } = input;
  const UAT_WORKLOAD_RATIO = 0.2; // UAT should be a reduced subset of PROD load

  const scaleUserCount = (value: number, ratio: number): number => {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return Math.max(1, Math.ceil(value * ratio));
  };

  // 1. Fetch template
  const response = await fetch('/export_template.xlsx');
  const buffer = await response.arrayBuffer();

  // 2. Load workbook (preserves all formatting, column widths, row heights)
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // 2.1 Insert Pre-requisites sheet and force tab order explicitly
  const preReqWs = wb.addWorksheet('Pre-requisites');

  const desiredOrder = [
    'Pre-requisites',
    'Assumption',
    'Production Env',
    'UAT Env',
    'Dev Env',
    'Platform Recommendations',
    'Architecture',
  ];

  let orderNo = 1;
  for (const name of desiredOrder) {
    const ws = wb.getWorksheet(name);
    if (ws) (ws as any).orderNo = orderNo++;
  }

  // Keep any additional template sheets after the known ordered tabs.
  for (const ws of wb.worksheets) {
    if (!desiredOrder.includes(ws.name)) {
      (ws as any).orderNo = orderNo++;
    }
  }

  // 3. Get worksheet references
  const assumptionWs = wb.getWorksheet('Assumption')!;
  const prodWs       = wb.getWorksheet('Production Env')!;
  const uatWs        = wb.getWorksheet('UAT Env')!;
  const devWs        = wb.getWorksheet('Dev Env')!;
  const platformWs   = wb.getWorksheet('Platform Recommendations')!;
  // Platform Recommendations & Architecture sheets are left as-is from template

  // 4. Compute results for all three environments
  const prodResult = formData.environment === 'PROD'
    ? result
    : calculateInfra({ ...formData, environment: 'PROD' });

  // UAT export rules:
  // 1) UAT load is a reduced subset of PROD input load (20%)
  // 2) HA is always disabled in UAT exports
  const uatFormData: AppFormData = {
    ...formData,
    environment: 'UAT',
    haEnabled: false,
    crm: {
      ...formData.crm,
      namedUsers: scaleUserCount(formData.crm.namedUsers, UAT_WORKLOAD_RATIO),
    },
    marketing: {
      ...formData.marketing,
      namedUsers: scaleUserCount(formData.marketing.namedUsers, UAT_WORKLOAD_RATIO),
    },
    bot: {
      ...formData.bot,
      activeUsers: scaleUserCount(formData.bot.activeUsers, UAT_WORKLOAD_RATIO),
    },
  };

  const uatResult = calculateInfra(uatFormData);
  // Dev export follows the same reduced workload strategy as UAT.
  const devFormData: AppFormData = {
    ...formData,
    environment: 'DEV',
    haEnabled: false,
    crm: {
      ...formData.crm,
      namedUsers: scaleUserCount(formData.crm.namedUsers, UAT_WORKLOAD_RATIO),
    },
    marketing: {
      ...formData.marketing,
      namedUsers: scaleUserCount(formData.marketing.namedUsers, UAT_WORKLOAD_RATIO),
    },
    bot: {
      ...formData.bot,
      activeUsers: scaleUserCount(formData.bot.activeUsers, UAT_WORKLOAD_RATIO),
    },
  };
  const devResult = calculateInfra(devFormData);

  // 5. Fill each sheet
  fillPreRequisites(preReqWs);
  fillAssumption(assumptionWs, formData, result);
  fillEnvSheet(prodWs, prodResult, formData, true);
  fillEnvSheet(uatWs,  uatResult,  formData, false);
  fillEnvSheet(devWs,  devResult,  formData, false);
  fillPlatformRecommendationsSheet(platformWs, formData);

  // 6. Generate buffer and download
  const outBuffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([outBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const clientSlug = (formData.clientName || 'Infra').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${clientSlug}_Sizing_Report_${dateStr}.xlsx`);
}
