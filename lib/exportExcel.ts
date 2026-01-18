import * as XLSX from 'xlsx';
import { Invoice, TeamView } from '../types';

interface ExportColumn {
  header: string;
  key: keyof Invoice | 'formattedAmount' | 'formattedDate' | 'paymentBlockedStatus';
  width?: number;
}

const VIEW_TITLES: Record<TeamView, string> = {
  ALL: 'All Invoices',
  RECON: 'Reconciliation Queue',
  AP: 'AP Processing Queue',
  PAYMENT: 'Payment Queue'
};

const BASE_COLUMNS: ExportColumn[] = [
  { header: 'Processing Date', key: 'formattedDate', width: 18 },
  { header: 'Entity', key: 'entity', width: 15 },
  { header: 'Invoice Number', key: 'invoiceNumber', width: 20 },
  { header: 'Vendor', key: 'vendor', width: 25 },
  { header: 'PO Owner', key: 'poCreator', width: 20 },
  { header: 'Detail', key: 'statusDetail', width: 15 },
  { header: 'Amount', key: 'formattedAmount', width: 15 },
  { header: 'Currency', key: 'currency', width: 10 },
  { header: 'Status', key: 'currentStage', width: 22 },
];

const RECON_EXTRA_COLUMNS: ExportColumn[] = [
  { header: 'Payment Status', key: 'paymentBlockedStatus', width: 18 },
];

const PAYMENT_EXTRA_COLUMNS: ExportColumn[] = [
  { header: 'Payment Status', key: 'paymentStatus', width: 18 },
];

function formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString([], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function formatAmount(amount: number | undefined, currency: string = 'EUR'): string {
  if (amount === undefined || amount === null) return '';
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency
  }).format(amount);
}

function getColumnsForView(view: TeamView): ExportColumn[] {
  const columns = [...BASE_COLUMNS];

  if (view === 'RECON') {
    columns.push(...RECON_EXTRA_COLUMNS);
  } else if (view === 'PAYMENT') {
    columns.push(...PAYMENT_EXTRA_COLUMNS);
  }

  return columns;
}

function prepareDataForExport(invoices: Invoice[], view: TeamView): Record<string, string>[] {
  return invoices.map(invoice => ({
    formattedDate: formatDate(invoice.submissionTimestamp || invoice.createdAt),
    entity: invoice.entity || '',
    invoiceNumber: invoice.invoiceNumber || '',
    vendor: invoice.vendor || '',
    poCreator: invoice.poCreator || '',
    statusDetail: invoice.statusDetail === 'NONE' ? '' : (invoice.statusDetail || ''),
    formattedAmount: formatAmount(invoice.amount, invoice.currency),
    currency: invoice.currency || '',
    currentStage: invoice.currentStage || '',
    paymentBlockedStatus: invoice.paymentBlocked ? 'BLOCKED' : 'OK',
    paymentStatus: invoice.paymentStatus || '',
  }));
}

function filterEmptyColumns(data: Record<string, string>[], columns: ExportColumn[]): ExportColumn[] {
  return columns.filter(col => {
    // Check if any row has data for this column
    return data.some(row => {
      const value = row[col.key as string];
      return value !== undefined && value !== null && value !== '';
    });
  });
}

export function exportToExcel(invoices: Invoice[], view: TeamView): void {
  if (invoices.length === 0) {
    alert('No data to export');
    return;
  }

  // Get columns for this view
  const allColumns = getColumnsForView(view);

  // Prepare data
  const data = prepareDataForExport(invoices, view);

  // Filter out empty columns
  const columns = filterEmptyColumns(data, allColumns);

  // Create worksheet data with headers
  const headers = columns.map(col => col.header);
  const rows = data.map(row => columns.map(col => row[col.key as string] || ''));
  const wsData = [headers, ...rows];

  // Create worksheet from array of arrays
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  worksheet['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

  // Style the header row (bold)
  // Note: xlsx library has limited styling in the free version
  // but we can set column widths

  // Create workbook
  const wb = XLSX.utils.book_new();
  const sheetName = VIEW_TITLES[view].replace(/[\\/*?[\]]/g, '').substring(0, 31);
  XLSX.utils.book_append_sheet(wb, worksheet, sheetName);

  // Generate filename with date
  const date = new Date().toISOString().split('T')[0];
  const filename = `${VIEW_TITLES[view].replace(/\s+/g, '_')}_${date}.xlsx`;

  // Download the file
  XLSX.writeFile(wb, filename);
}
