
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { CalculationResult, ServerSpec } from '../types';

export const exportToPDF = (result: CalculationResult) => {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  // Header
  doc.setFontSize(20);
  doc.setTextColor(30, 41, 59);
  doc.text('Infrastructure Capacity Planning Report', 14, 20);
  
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated on: ${timestamp}`, 14, 28);
  doc.text(`InfraSizer Pro Engine v1.0`, 14, 33);

  // Summary of Metrics
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Summary of Load Metrics', 14, 45);

  const metricData = [
    ['Metric', 'Calculated Value'],
    ['CRM Triggers/sec', result.crmMetrics.triggersPerSecond.toString()],
    ['CRM Active Users', result.crmMetrics.activeLoadUsers.toString()],
    ['Bot Requests/min', result.botMetrics.requestsPerMinute.toString()],
    ['Tokens Per Minute (TPM)', result.botMetrics.tpm.toLocaleString()],
  ];

  autoTable(doc, {
    startY: 50,
    head: [metricData[0]],
    body: metricData.slice(1),
    theme: 'striped',
    headStyles: { fillColor: [30, 41, 59] },
    margin: { left: 14, right: 14 },
  });

  let currentY = (doc as any).lastAutoTable.finalY + 15;

  // Servers Details
  result.servers.forEach((server, index) => {
    // Check if we need a new page
    if (currentY > 230) {
      doc.addPage();
      currentY = 20;
    }

    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.setFont('helvetica', 'bold');
    doc.text(server.name, 14, currentY);
    currentY += 5;

    const tableData = [
      ['Specification', server.specification || ''],
      ['RAM', server.ram],
      ['HDD', server.hdd],
      ['Processor', server.cpu],
      ['OS', server.os]
    ];

    autoTable(doc, {
      startY: currentY,
      head: [],
      body: tableData,
      theme: 'grid',
      columnStyles: {
        0: { fontStyle: 'bold', fillColor: [248, 250, 252], cellWidth: 50 },
        1: { cellWidth: 'auto' }
      },
      styles: { fontSize: 10, cellPadding: 3 },
      margin: { left: 14, right: 14 },
    });

    currentY = (doc as any).lastAutoTable.finalY + 12;
  });

  doc.save('Infra_Capacity_Planning_Report.pdf');
};

export const exportToExcel = (servers: ServerSpec[]) => {
  const worksheet = XLSX.utils.json_to_sheet(servers.map(s => ({
    'Server Node': s.name,
    'Specification': s.specification,
    'CPU Cores': s.cpu,
    'RAM (GB)': s.ram,
    'Storage (GB)': s.hdd,
    'Operating System': s.os,
    'Load Category': s.loadCategory
  })));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Infra Recommendations');
  XLSX.writeFile(workbook, 'Infra_Sizing_Report.xlsx');
};

export const exportToCSV = (servers: ServerSpec[]) => {
  const headers = ['Server Node', 'Specification', 'CPU', 'RAM', 'Storage', 'OS', 'Load Tier'];
  const rows = servers.map(s => [
    `"${s.name}"`,
    `"${s.specification}"`,
    `"${s.cpu}"`,
    `"${s.ram}"`,
    `"${s.hdd}"`,
    `"${s.os}"`,
    s.loadCategory
  ].join(','));
  
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'Infra_Sizing_Export.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
