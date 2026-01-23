import React, { useState } from 'react';
import { Upload, X, FileSpreadsheet, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice, FlowType, FlowStage, StatusDetail } from '../types';

interface UploadModalAPProps {
  onClose: () => void;
  onUpload: (invoices: Invoice[]) => void;
  existingInvoiceNumbers: Set<string>;
  userEmail?: string;
  userRole?: string;
}

interface ParsedRow {
  entity: string;
  invoiceNumber: string;
  vendor: string;
  amount?: number;
  poCreator: string;
  sharepointUrl?: string;
  statusDetail: StatusDetail;
  comment?: string;
}

export const UploadModalAP: React.FC<UploadModalAPProps> = ({
  onClose,
  onUpload,
  existingInvoiceNumbers,
  userEmail,
  userRole
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData([]);
      setErrors([]);
      setSuccess(false);
    }
  };

  const parseExcel = async () => {
    if (!file) return;

    setParsing(true);
    setErrors([]);
    setParsedData([]);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const rows: ParsedRow[] = [];
      const parseErrors: string[] = [];

      jsonData.forEach((row: any, idx: number) => {
        const rowNum = idx + 2;

        // Validate mandatory fields: Entity, Invoice Number, Vendor, PO Creator
        if (!row['Entity']?.toString().trim()) {
          parseErrors.push(`Row ${rowNum}: Entity is required`);
        }
        if (!row['Invoice Number']?.toString().trim()) {
          parseErrors.push(`Row ${rowNum}: Invoice Number is required`);
        }
        if (!row['Vendor']?.toString().trim()) {
          parseErrors.push(`Row ${rowNum}: Vendor is required`);
        }
        if (!row['PO Creator']?.toString().trim()) {
          parseErrors.push(`Row ${rowNum}: PO Creator is required`);
        }

        // Check for duplicates
        const invoiceNum = row['Invoice Number']?.toString().trim();
        if (invoiceNum && existingInvoiceNumbers.has(invoiceNum)) {
          parseErrors.push(`Row ${rowNum}: Invoice ${invoiceNum} already exists`);
        }

        // Validate Status Detail
        const statusDetail = row['Status Detail']?.toString().trim().toUpperCase();
        if (statusDetail && !['WITHOUT PO', 'EXR PENDING', 'NONE'].includes(statusDetail)) {
          parseErrors.push(`Row ${rowNum}: Status Detail must be "WITHOUT PO", "EXR PENDING", or "NONE"`);
        }

        const parsedRow: ParsedRow = {
          entity: row['Entity']?.toString().trim() || '',
          invoiceNumber: invoiceNum || '',
          vendor: row['Vendor']?.toString().trim() || '',
          amount: row['Amount'] ? parseFloat(row['Amount'].toString()) : undefined,
          poCreator: row['PO Creator']?.toString().trim() || '',
          sharepointUrl: row['SharePoint URL']?.toString().trim() || undefined,
          statusDetail: (statusDetail as StatusDetail) || 'NONE',
          comment: row['Comment']?.toString().trim() || undefined,
        };

        rows.push(parsedRow);
      });

      if (parseErrors.length > 0) {
        setErrors(parseErrors);
      } else if (rows.length === 0) {
        setErrors(['No valid data found in Excel file']);
      } else {
        setParsedData(rows);
      }
    } catch (err: any) {
      setErrors([`Failed to parse Excel file: ${err.message}`]);
    } finally {
      setParsing(false);
    }
  };

  const handleUpload = () => {
    if (parsedData.length === 0) return;

    const now = new Date().toISOString();
    const invoices: Invoice[] = parsedData.map((row, idx) => {
      const evidence = row.comment ? [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'NOTE' as const,
        content: row.comment,
        createdAt: now,
        createdBy: userEmail || 'System User',
        stageAddedAt: FlowStage.PO_PENDING_RECEIVED
      }] : [];

      return {
        id: `upload-ap-${Date.now()}-${idx}`,
        invoiceNumber: row.invoiceNumber,
        vendor: row.vendor,
        entity: row.entity,
        amount: row.amount,
        currency: 'EUR',
        poCreator: row.poCreator,
        sharepointUrl: row.sharepointUrl,
        statusDetail: row.statusDetail,
        submissionTimestamp: now,
        flowType: FlowType.PO_PENDING,
        currentStage: FlowStage.PO_PENDING_RECEIVED,
        source: 'EXCEL',
        createdAt: now,
        updatedAt: now,
        createdBy: userEmail,
        createdByRole: userRole,
        evidence,
        paymentStatus: 'NONE'
      };
    });

    onUpload(invoices);
    setSuccess(true);
    setTimeout(() => {
      onClose();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">

        {/* Header */}
        <div className="bg-gradient-to-r from-brand-900 to-brand-950 border-b border-brand-800 p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-brand-600/20 rounded-xl shadow-lg">
              <FileSpreadsheet size={24} className="text-brand-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">Import Excel for AP Processing</h2>
              <p className="text-[10px] text-brand-300 mt-0.5 uppercase tracking-[0.2em] font-black">
                Bulk Upload PO Pending Invoices
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">

          {/* Instructions */}
          <div className="bg-brand-950/30 border border-brand-900/50 rounded-xl p-4">
            <h3 className="text-sm font-bold text-brand-300 mb-3 flex items-center gap-2">
              <AlertCircle size={16} />
              Excel Format Requirements
            </h3>
            <div className="text-xs text-slate-300 space-y-1.5">
              <p className="font-semibold text-white">Required Columns (must match exactly):</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-brand-300">Entity</span> - Business entity (e.g., IE-HQ, EU-HQ)</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-brand-300">Invoice Number</span> - Unique invoice identifier</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-brand-300">Vendor</span> - Vendor/supplier name</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded text-brand-300">PO Creator</span> - PO owner/creator name</li>
              </ul>
              <p className="font-semibold text-white mt-3">Optional Columns:</p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Amount</span> - Invoice amount (numeric)</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">SharePoint URL</span> - Link to document</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Status Detail</span> - "WITHOUT PO", "EXR PENDING", or "NONE"</li>
                <li><span className="font-mono bg-slate-800 px-1.5 py-0.5 rounded">Comment</span> - Additional notes</li>
              </ul>
            </div>
          </div>

          {/* File Upload */}
          <div>
            <label className="block text-sm font-bold text-slate-300 mb-3">Select Excel File (.xlsx, .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-400 file:mr-4 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-bold file:bg-brand-600 file:text-white hover:file:bg-brand-500 file:cursor-pointer cursor-pointer"
            />
          </div>

          {/* Parse Button */}
          {file && !parsedData.length && errors.length === 0 && (
            <button
              onClick={parseExcel}
              disabled={parsing}
              className="w-full bg-brand-600 hover:bg-brand-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              {parsing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Parsing...
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  Parse Excel File
                </>
              )}
            </button>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="bg-red-950/30 border border-red-900/50 rounded-xl p-4">
              <h4 className="text-sm font-bold text-red-300 mb-2 flex items-center gap-2">
                <XCircle size={16} />
                Validation Errors ({errors.length})
              </h4>
              <ul className="text-xs text-red-200 space-y-1 max-h-48 overflow-y-auto">
                {errors.map((err, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-red-500 mt-0.5">•</span>
                    <span>{err}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Success Preview */}
          {parsedData.length > 0 && (
            <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4">
              <h4 className="text-sm font-bold text-emerald-300 mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} />
                Ready to Upload ({parsedData.length} invoices)
              </h4>
              <div className="text-xs text-emerald-200 space-y-1 max-h-48 overflow-y-auto">
                {parsedData.slice(0, 5).map((row, idx) => (
                  <div key={idx} className="bg-emerald-950/40 p-2 rounded border border-emerald-900/30">
                    <span className="font-mono font-bold text-emerald-400">{row.invoiceNumber}</span> - {row.vendor} ({row.entity}) - PO: {row.poCreator}
                  </div>
                ))}
                {parsedData.length > 5 && (
                  <p className="text-emerald-400 font-semibold mt-2">+ {parsedData.length - 5} more invoices...</p>
                )}
              </div>
            </div>
          )}

          {/* Success Message */}
          {success && (
            <div className="bg-green-950/30 border border-green-900/50 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 size={20} className="text-green-400" />
              <span className="text-sm font-bold text-green-300">Upload successful! Closing...</span>
            </div>
          )}
        </div>

        {/* Footer */}
        {parsedData.length > 0 && !success && (
          <div className="bg-slate-950 border-t border-slate-800 p-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 px-6 py-3 rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              className="flex-1 bg-brand-600 hover:bg-brand-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Upload size={16} />
              Upload {parsedData.length} Invoices
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
