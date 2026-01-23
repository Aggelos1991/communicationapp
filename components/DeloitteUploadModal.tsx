import React, { useCallback, useState, useRef } from 'react';
import { Upload, X, AlertTriangle, FileSpreadsheet, FileText, CheckCircle, Loader2, Paperclip } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice, FlowType, FlowStage, Attachment } from '../types';
import { compressFile, formatFileSize, MAX_ORIGINAL_SIZE } from '../lib/compression';

interface DeloitteUploadModalProps {
  onClose: () => void;
  onUpload: (invoices: Partial<Invoice>[], attachments?: { vendorStatement?: Attachment; erpStatement?: Attachment }) => void;
  existingInvoiceNumbers: Set<string>;
}

interface AttachmentState {
  vendorStatement: Attachment | null;
  erpStatement: Attachment | null;
}

export const DeloitteUploadModal: React.FC<DeloitteUploadModalProps> = ({ onClose, onUpload, existingInvoiceNumbers }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [step, setStep] = useState<'attachments' | 'excel'>('attachments');
  const [attachments, setAttachments] = useState<AttachmentState>({
    vendorStatement: null,
    erpStatement: null
  });
  const [isCompressing, setIsCompressing] = useState<string | null>(null);

  const vendorInputRef = useRef<HTMLInputElement>(null);
  const erpInputRef = useRef<HTMLInputElement>(null);

  const handleFileAttachment = async (file: File, type: 'vendorStatement' | 'erpStatement') => {
    if (file.size > MAX_ORIGINAL_SIZE) {
      setError(`File too large. Maximum size is ${MAX_ORIGINAL_SIZE / 1024 / 1024}MB`);
      return;
    }

    setIsCompressing(type);
    setError(null);

    try {
      const compressed = await compressFile(file);
      setAttachments(prev => ({
        ...prev,
        [type]: {
          id: `${type}-${Date.now()}`,
          name: compressed.originalName,
          mimeType: compressed.mimeType,
          data: compressed.data,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize
        }
      }));
    } catch (err: any) {
      setError(err.message || 'Failed to compress file');
    } finally {
      setIsCompressing(null);
    }
  };

  const processExcelFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        // Look for "Analysis" sheet first, then fall back to first sheet
        const analysisSheetName = workbook.SheetNames.find(name =>
          name.toLowerCase().includes('analysis')
        );
        const sheetName = analysisSheetName || workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Get raw data with header row
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Deloitte format column mapping (0-indexed):
        // Column B (index 1) = Entity
        // Column C (index 2) = Vendor Name
        // Column L (index 11) = Invoice Number
        // Column N (index 13) = Value (Amount)

        const validRows: any[] = [];
        const duplicates: string[] = [];
        const parseErrors: string[] = [];

        // Skip header row (index 0), start from index 1
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const entity = row[1] ? String(row[1]).trim() : '';      // Column B - Entity
          const vendor = row[2] ? String(row[2]).trim() : '';       // Column C - Vendor Name
          const invNum = row[11] ? String(row[11]).trim() : '';     // Column L - Invoice Number
          const amount = row[13];                                    // Column N - Value

          // Skip empty rows (need at least Invoice Number)
          if (!invNum) continue;

          // Check for duplicates
          if (existingInvoiceNumbers.has(invNum)) {
            duplicates.push(invNum);
            continue;
          }

          // Parse amount - handle negative values and various formats
          let parsedAmount: number | undefined;
          if (amount !== undefined && amount !== null && amount !== '') {
            const numVal = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numVal)) {
              parsedAmount = Math.abs(numVal); // Use absolute value
            }
          }

          validRows.push({
            invoiceNumber: invNum,
            vendor: vendor || entity || 'Unknown Vendor', // Fallback to entity or Unknown if vendor is empty
            entity: entity || undefined,
            amount: parsedAmount,
            currency: 'EUR',
            flowType: FlowType.MISSING_INVOICE,
            currentStage: FlowStage.MISSING_INVOICE_MISSING,
            source: 'EXCEL'
          });
        }

        if (parseErrors.length > 0) {
          setError(`Parse errors: ${parseErrors.slice(0, 3).join('; ')}${parseErrors.length > 3 ? '...' : ''}`);
        } else if (duplicates.length > 0) {
          setError(`Ignored ${duplicates.length} duplicates: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
        }

        if (validRows.length === 0 && duplicates.length === 0 && parseErrors.length === 0) {
          setError("No valid rows found. Ensure the file has data in columns B (Entity), C (Vendor Name), L (Invoice Number), and N (Value).");
        }

        setPreview(validRows);
      } catch (err) {
        console.error(err);
        setError("Failed to parse Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processExcelFile(file);
  }, []);

  const handleConfirm = () => {
    onUpload(preview, {
      vendorStatement: attachments.vendorStatement || undefined,
      erpStatement: attachments.erpStatement || undefined
    });
    onClose();
  };

  const canProceedToExcel = attachments.vendorStatement && attachments.erpStatement;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-emerald-900/30 to-teal-900/30">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-500" />
            Deloitte Reconciliation Upload
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20}/></button>
        </div>

        {/* Step Indicator */}
        <div className="px-6 py-4 bg-slate-950/50 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${step === 'attachments' ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'attachments' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>1</div>
              <span className="text-sm font-bold">Attach Statements</span>
            </div>
            <div className="flex-1 h-0.5 bg-slate-700">
              <div className={`h-full bg-emerald-500 transition-all duration-500 ${step === 'excel' ? 'w-full' : 'w-0'}`}></div>
            </div>
            <div className={`flex items-center gap-2 ${step === 'excel' ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${step === 'excel' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>2</div>
              <span className="text-sm font-bold">Upload Invoice Excel</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          {step === 'attachments' ? (
            <div className="space-y-6">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <p className="text-sm text-slate-300 mb-2">
                  <span className="text-emerald-400 font-bold">Step 1:</span> Attach the Vendor Statement and ERP Statement before uploading the missing invoice Excel.
                </p>
                <p className="text-xs text-slate-500">These documents will be stored as reference for the reconciliation process.</p>
              </div>

              {/* Vendor Statement Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  <span className="text-rose-400">*</span> Vendor Statement
                </label>
                <input
                  type="file"
                  ref={vendorInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileAttachment(e.target.files[0], 'vendorStatement')}
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                />
                {attachments.vendorStatement ? (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500/20 p-2 rounded-lg">
                        <CheckCircle size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-emerald-300 text-sm font-semibold truncate max-w-[300px]">{attachments.vendorStatement.name}</p>
                        <p className="text-emerald-600 text-xs">{formatFileSize(attachments.vendorStatement.compressedSize)} compressed</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAttachments(prev => ({ ...prev, vendorStatement: null }))}
                      className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => vendorInputRef.current?.click()}
                    disabled={isCompressing === 'vendorStatement'}
                    className="w-full bg-slate-950 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl px-4 py-6 text-slate-400 text-sm transition-all flex items-center justify-center gap-3"
                  >
                    {isCompressing === 'vendorStatement' ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Compressing...
                      </>
                    ) : (
                      <>
                        <Paperclip size={20} />
                        Click to attach Vendor Statement (PDF, Excel, Image)
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* ERP Statement Upload */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  <span className="text-rose-400">*</span> ERP Statement
                </label>
                <input
                  type="file"
                  ref={erpInputRef}
                  onChange={(e) => e.target.files?.[0] && handleFileAttachment(e.target.files[0], 'erpStatement')}
                  className="hidden"
                  accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg"
                />
                {attachments.erpStatement ? (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="bg-emerald-500/20 p-2 rounded-lg">
                        <CheckCircle size={20} className="text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-emerald-300 text-sm font-semibold truncate max-w-[300px]">{attachments.erpStatement.name}</p>
                        <p className="text-emerald-600 text-xs">{formatFileSize(attachments.erpStatement.compressedSize)} compressed</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setAttachments(prev => ({ ...prev, erpStatement: null }))}
                      className="p-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => erpInputRef.current?.click()}
                    disabled={isCompressing === 'erpStatement'}
                    className="w-full bg-slate-950 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-xl px-4 py-6 text-slate-400 text-sm transition-all flex items-center justify-center gap-3"
                  >
                    {isCompressing === 'erpStatement' ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Compressing...
                      </>
                    ) : (
                      <>
                        <Paperclip size={20} />
                        Click to attach ERP Statement (PDF, Excel, Image)
                      </>
                    )}
                  </button>
                )}
              </div>

              {error && (
                <div className="bg-amber-900/20 border border-amber-900/50 text-amber-400 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div>
              {!preview.length ? (
                <div>
                  {/* Show attached files summary */}
                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 mb-4">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Attached Documents</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="truncate">{attachments.vendorStatement?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="truncate">{attachments.erpStatement?.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Deloitte Excel Column Mapping</p>
                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                      <div><span className="text-emerald-400 font-bold">Column B:</span> Entity</div>
                      <div><span className="text-emerald-400 font-bold">Column C:</span> Vendor Name <span className="text-slate-500">(optional)</span></div>
                      <div><span className="text-emerald-400 font-bold">Column L:</span> Invoice Number</div>
                      <div><span className="text-emerald-400 font-bold">Column N:</span> Value (Amount)</div>
                    </div>
                  </div>
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={handleDrop}
                    className={ `
                      border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer relative
                      ${isDragOver ? 'border-emerald-500 bg-emerald-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'}
                    `}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      onChange={(e) => e.target.files?.[0] && processExcelFile(e.target.files[0])}
                    />
                    <Upload className="mx-auto text-slate-400 mb-4" size={48} />
                    <p className="text-slate-300 font-medium">Drag & drop Missing Invoice Excel file</p>
                    <p className="text-slate-500 text-sm mt-2">or click to browse</p>
                  </div>
                </div>
              ) : (
                <div>
                  {/* Show attached files summary */}
                  <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 mb-4">
                    <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Attached Documents</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="truncate">{attachments.vendorStatement?.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-300">
                        <CheckCircle size={14} className="text-emerald-500" />
                        <span className="truncate">{attachments.erpStatement?.name}</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-lg p-4 mb-4 flex items-center gap-3">
                    <div className="bg-emerald-500/20 p-2 rounded-full">
                      <FileSpreadsheet size={20} className="text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-white font-medium">Ready to import {preview.length} invoices</p>
                      <p className="text-slate-400 text-xs">Duplicates have been automatically filtered.</p>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700">
                    <table className="w-full text-left text-xs text-slate-400">
                       <thead className="bg-slate-800 text-slate-300 sticky top-0">
                         <tr>
                           <th className="p-2">Entity</th>
                           <th className="p-2">Doc No</th>
                           <th className="p-2">Company</th>
                           <th className="p-2">Value</th>
                         </tr>
                       </thead>
                       <tbody className="divide-y divide-slate-700 bg-slate-900">
                         {preview.map((row, i) => (
                           <tr key={i}>
                             <td className="p-2 text-slate-300">{row.entity || '-'}</td>
                             <td className="p-2 text-white">{row.invoiceNumber}</td>
                             <td className="p-2 text-slate-300">{row.vendor}</td>
                             <td className="p-2 text-emerald-400">{row.amount ? `€${row.amount.toLocaleString()}` : '-'}</td>
                           </tr>
                         ))}
                       </tbody>
                    </table>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 bg-amber-900/20 border border-amber-900/50 text-amber-400 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-between gap-3 bg-slate-950/50">
          <div>
            {step === 'excel' && (
              <button
                onClick={() => { setStep('attachments'); setPreview([]); }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
              >
                ← Back
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
            >
              Cancel
            </button>
            {step === 'attachments' ? (
              <button
                onClick={() => setStep('excel')}
                disabled={!canProceedToExcel}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-all shadow-lg flex items-center gap-2"
              >
                Continue to Excel Upload →
              </button>
            ) : preview.length > 0 && (
              <button
                onClick={handleConfirm}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-bold text-sm transition-all shadow-lg"
              >
                Import {preview.length} Invoices
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
