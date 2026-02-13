/**
 * Export Workbook Service
 *
 * Generates a multi-sheet .xlsx workbook from already-computed engine results
 * and form config. Pure function — no DOM reads, no state mutation, no UI imports.
 *
 * Sheets: Introduction | Server Load Calculation | Prod Sizing | UAT Sizing |
 *         Platform Recommendation | Architecture
 */

import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import {
  AppFormData,
  CalculationResult,
  ServerSpec,
} from '../types';
import { calculateInfra } from './CalculatorEngine';
import { getPlatformRecommendations } from '../config/platformRecommendations';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ExportWorkbookInput {
  /** Current form state */
  formData: AppFormData;
  /** Engine result for the currently selected environment */
  result: CalculationResult;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Set column widths on a worksheet */
function autoWidth(ws: XLSX.WorkSheet, data: (string | number | undefined)[][]) {
  const colWidths: number[] = [];
  for (const row of data) {
    row.forEach((cell, i) => {
      const len = cell != null ? String(cell).length : 0;
      colWidths[i] = Math.max(colWidths[i] || 10, len + 2);
    });
  }
  ws['!cols'] = colWidths.map(w => ({ wch: Math.min(w, 60) }));
}

/** Classify load tier from CRM triggers/sec */
function classifyLoadTier(triggersPerSec: number, namedUsers: number): string {
  if (triggersPerSec > 100 || namedUsers > 3000) return 'High';
  if (triggersPerSec > 10 || namedUsers > 300) return 'Medium';
  return 'Low';
}

/** Flatten servers into export rows */
function serversToRows(servers: ServerSpec[]): (string | number)[][] {
  return servers.map(s => [
    s.name,
    s.specification || '',
    s.cpu,
    s.ram,
    s.hdd,
    s.os,
    s.loadCategory,
    s.networkZone,
    s.gpu?.enabled ? `${s.gpu.type} (${s.gpu.vram})` : 'N/A',
    s.additionalNotes || '',
  ]);
}

const SERVER_HEADERS = [
  'Server Name',
  'Specification',
  'CPU',
  'RAM',
  'Storage (HDD)',
  'OS',
  'Load Category',
  'Network Zone',
  'GPU',
  'Notes',
];

// ─── Sheet Builders ──────────────────────────────────────────────────────────

function buildIntroductionSheet(
  formData: AppFormData,
  result: CalculationResult,
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [
    ['Infrastructure Sizing Report'],
    [],
    ['Field', 'Value'],
    ['Client Name', formData.clientName || 'N/A'],
    ['Environment', formData.environment],
    ['Solution Type', formData.solutionType.toUpperCase().replace('-', ' ')],
    ['High Availability (HA)', formData.haEnabled ? 'Yes' : 'No'],
    ['Disaster Recovery (DR)', formData.drEnabled ? 'Yes' : 'No'],
    ['Date Generated', new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    [],
    ['Summary Metrics', ''],
    ['Active Load Users', result.crmMetrics.activeLoadUsers],
    ['CRM Triggers/sec', result.crmMetrics.triggersPerSecond],
    ['Bot Requests/min', result.botMetrics.requestsPerMinute],
    ['Bot TPM', result.botMetrics.tpm],
    ['Total Server Nodes', result.servers.length],
  ];

  if (result.ryaBotCloudCost) {
    rows.push(
      ['RyaBot Cloud Provider', result.ryaBotCloudCost.provider],
      ['RyaBot Monthly Cost (USD)', `$${result.ryaBotCloudCost.monthlyCostUSD.toLocaleString()}`],
    );
  }

  if (result.saasMessage) {
    rows.push([], ['SaaS Note', result.saasMessage]);
  }

  // Solutions enabled
  rows.push([], ['Solutions Enabled', '']);
  const solutionLabels: [keyof typeof formData.solutions, string][] = [
    ['crm', 'CRM'],
    ['marketing', 'Marketing Automation'],
    ['ryaBot', 'R-Yabot (AI Layer)'],
    ['clickhouse', 'ClickHouse Analytics'],
    ['metabase', 'Metabase BI'],
  ];
  for (const [key, label] of solutionLabels) {
    rows.push([label, formData.solutions[key] ? 'Enabled' : 'Disabled']);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, rows);
  return ws;
}

function buildServerLoadSheet(
  formData: AppFormData,
  result: CalculationResult,
): XLSX.WorkSheet {
  const concurrentUsers = (formData.crm.namedUsers * formData.crm.concurrencyRate) / 100;
  const triggersPerSec = (concurrentUsers * formData.crm.triggersPerMinute) / 60;
  const botRPM = formData.bot.activeUsers * formData.bot.requestsPerMinute;
  const tpm = botRPM * formData.bot.avgTokensPerRequest;
  const loadTier = classifyLoadTier(triggersPerSec, formData.crm.namedUsers);

  const rows: (string | number)[][] = [
    ['Server Load Calculation'],
    [],
    ['CRM Load Parameters', ''],
    ['Metric', 'Value'],
    ['Named Users', formData.crm.namedUsers],
    ['Concurrency Rate (%)', formData.crm.concurrencyRate],
    ['Triggers Per Minute (per user session)', formData.crm.triggersPerMinute],
    ['Concurrent / Active Users', Math.ceil(concurrentUsers)],
    ['Triggers Per Second', Number(triggersPerSec.toFixed(2))],
    ['Active Load Users/sec', result.crmMetrics.activeLoadUsers],
    ['Load Tier Classification', loadTier],
    [],
    ['Bot Load Parameters', ''],
    ['Metric', 'Value'],
    ['Concurrent Bot Users', formData.bot.activeUsers],
    ['Requests Per User/Min', formData.bot.requestsPerMinute],
    ['Avg Tokens Per Request', formData.bot.avgTokensPerRequest],
    ['Total Requests/Min (RPM)', botRPM],
    ['Tokens Per Minute (TPM)', tpm],
    ['R-Yabot Deployment Mode', formData.ryabotMode === 'cloud' ? 'Cloud' : 'On-Premise'],
    ['GPU Performance Level', formData.ryabotMode === 'premise' ? formData.bot.ryaBotPerformance : 'N/A (Cloud)'],
    [],
    ['Storage & Analytics', ''],
    ['Metric', 'Value'],
    ['Raw Data Volume (GB/month)', formData.dataVolumeGB],
    ['Environment Multiplier', formData.environment],
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, rows);
  return ws;
}

function buildSizingSheet(
  label: string,
  result: CalculationResult,
): XLSX.WorkSheet {
  const headerRow = [label];
  const rows: (string | number)[][] = [
    headerRow,
    [],
    SERVER_HEADERS,
    ...serversToRows(result.servers),
  ];

  if (result.ryaBotCloudCost) {
    rows.push(
      [],
      ['R-Yabot Cloud Cost Estimate'],
      ['Provider', 'TPM', 'Monthly Cost (USD)', 'Notes'],
      [
        result.ryaBotCloudCost.provider,
        result.ryaBotCloudCost.tpm,
        `$${result.ryaBotCloudCost.monthlyCostUSD.toLocaleString()}`,
        result.ryaBotCloudCost.notes,
      ],
    );
  }

  if (result.saasMessage) {
    rows.push([], ['SaaS Note', result.saasMessage]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, rows);
  return ws;
}

function buildProdSheet(result: CalculationResult): XLSX.WorkSheet {
  return buildSizingSheet('Production Sizing', result);
}

function buildUATSheet(formData: AppFormData): XLSX.WorkSheet {
  // Run the SAME engine with UAT environment override
  const uatFormData: AppFormData = {
    ...formData,
    environment: 'UAT',
  };
  const uatResult = calculateInfra(uatFormData);
  return buildSizingSheet('UAT Sizing', uatResult);
}

function buildPlatformSheet(): XLSX.WorkSheet {
  const rec = getPlatformRecommendations();

  const rows: (string | number)[][] = [
    ['Platform Recommendations'],
    [],
    ['Software Recommendations'],
    ['Software', 'Supported Version', 'Component Hosted', 'Comments'],
    ...rec.software.map(s => [s.software, s.supportedVersion, s.componentHosted, s.comments]),
    [],
    ['Browser Recommendations'],
    ['Browser', 'Supported Version'],
    ...rec.browsers.map(b => [b.browser, b.supportedVersion]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, rows);
  return ws;
}

function buildArchitectureSheet(): XLSX.WorkSheet {
  const rows: string[][] = [
    ['Architecture Diagram'],
    [],
    ['This sheet is reserved for architecture diagrams.'],
    ['Attach or paste diagrams manually after export.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  autoWidth(ws, rows);
  return ws;
}

// ─── Main Export Function ────────────────────────────────────────────────────

/**
 * Build and download a multi-sheet .xlsx workbook.
 *
 * @param input - formData + pre-computed engine result
 */
export function exportSizingWorkbook(input: ExportWorkbookInput): void {
  const { formData, result } = input;

  // Determine which result to use for Prod sheet.
  // If the current environment is PROD, use the existing result directly.
  // Otherwise, compute a PROD result via the engine.
  let prodResult: CalculationResult;
  if (formData.environment === 'PROD') {
    prodResult = result;
  } else {
    prodResult = calculateInfra({ ...formData, environment: 'PROD' });
  }

  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildIntroductionSheet(formData, result), 'Introduction');
  XLSX.utils.book_append_sheet(wb, buildServerLoadSheet(formData, result), 'Server Load Calculation');
  XLSX.utils.book_append_sheet(wb, buildProdSheet(prodResult), 'Prod Sizing');
  XLSX.utils.book_append_sheet(wb, buildUATSheet(formData), 'UAT Sizing');
  XLSX.utils.book_append_sheet(wb, buildPlatformSheet(), 'Platform Recommendation');
  XLSX.utils.book_append_sheet(wb, buildArchitectureSheet(), 'Architecture');

  // Generate buffer and save
  const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbOut], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const clientSlug = (formData.clientName || 'Infra').replace(/[^a-zA-Z0-9]/g, '_');
  const dateStr = new Date().toISOString().slice(0, 10);
  saveAs(blob, `${clientSlug}_Sizing_Report_${dateStr}.xlsx`);
}
