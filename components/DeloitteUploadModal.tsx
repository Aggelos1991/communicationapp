import React, { useCallback, useState } from 'react';
import { Upload, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice, FlowType, FlowStage } from '../types';

interface DeloitteUploadModalProps {
  onClose: () => void;
  onUpload: (invoices: Partial<Invoice>[]) => void;
  existingInvoiceNumbers: Set<string>;
}

export const DeloitteUploadModal: React.FC<DeloitteUploadModalProps> = ({ onClose, onUpload, existingInvoiceNumbers }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<any[]>([]);

  const processFile = (file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];

        // Get raw data with header row
        const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as any[][];

        // Deloitte format column mapping (0-indexed):
        // Column B (index 1) = Entity
        // Column C (index 2) = Company Name (Vendor)
        // Column L (index 11) = Doc No (Invoice Number)
        // Column N (index 13) = Value (Amount)

        const validRows: any[] = [];
        const duplicates: string[] = [];
        const parseErrors: string[] = [];

        // Skip header row (index 0), start from index 1
        for (let i = 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          const entity = row[1] ? String(row[1]).trim() : '';      // Column B
          const vendor = row[2] ? String(row[2]).trim() : '';       // Column C
          const invNum = row[11] ? String(row[11]).trim() : '';     // Column L
          const amount = row[13];                                    // Column N

          // Skip empty rows
          if (!invNum && !vendor) continue;

          // Validate required fields
          if (!invNum) {
            parseErrors.push(`Row ${i + 1}: Missing Doc No (Column L)`);
            continue;
          }
          if (!vendor) {
            parseErrors.push(`Row ${i + 1}: Missing Company Name (Column C)`);
            continue;
          }

          // Check for duplicates
          if (existingInvoiceNumbers.has(invNum)) {
            duplicates.push(invNum);
            continue;
          }

          // Parse amount
          let parsedAmount: number | undefined;
          if (amount !== undefined && amount !== null && amount !== '') {
            const numVal = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numVal)) {
              parsedAmount = Math.abs(numVal); // Use absolute value
            }
          }

          validRows.push({
            invoiceNumber: invNum,
            vendor: vendor,
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
          setError("No valid rows found. Ensure the file has data in columns B (Entity), C (Company Name), L (Doc No), and N (Value).");
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
    if (file) processFile(file);
  }, []);

  const handleConfirm = () => {
    onUpload(preview);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-gradient-to-r from-emerald-900/30 to-teal-900/30">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-500" />
            Deloitte Upload
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20}/></button>
        </div>

        <div className="p-6">
          {!preview.length ? (
            <div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Column Mapping</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div><span className="text-emerald-400 font-bold">Column B:</span> Entity</div>
                  <div><span className="text-emerald-400 font-bold">Column C:</span> Company Name</div>
                  <div><span className="text-emerald-400 font-bold">Column L:</span> Doc No (Invoice #)</div>
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
                  onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
                />
                <Upload className="mx-auto text-slate-400 mb-4" size={48} />
                <p className="text-slate-300 font-medium">Drag & drop Deloitte excel file</p>
                <p className="text-slate-500 text-sm mt-2">or click to browse</p>
              </div>
            </div>
          ) : (
            <div>
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

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3 bg-slate-950/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
          >
            Cancel
          </button>
          {preview.length > 0 && (
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
  );
};
