import React, { useCallback, useState } from 'react';
import { Upload, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Invoice, FlowType, FlowStage } from '../types';

interface UploadModalProps {
  onClose: () => void;
  onUpload: (invoices: Partial<Invoice>[]) => void;
  existingInvoiceNumbers: Set<string>;
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onUpload, existingInvoiceNumbers }) => {
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
        const jsonData = XLSX.utils.sheet_to_json(firstSheet);
        
        // Validation
        const validRows: any[] = [];
        const duplicates: string[] = [];
        
        jsonData.forEach((row: any) => {
          // Normalize keys to lowercase for safety
          const normalized: any = {};
          Object.keys(row).forEach(k => normalized[k.toLowerCase().trim().replace(/_/g, '').replace(/ /g, '')] = row[k]);
          
          // Map columns: ENTITY, INVOICE NUMBER, VENDOR NAME, AMOUNT
          const invNum = normalized['invoicenumber'] || normalized['invoice'] || normalized['inv'];
          const vendor = normalized['vendorname'] || normalized['vendor'];
          const entity = normalized['entity'];
          const amount = normalized['amount'];

          if (invNum && vendor) {
            const numStr = String(invNum).trim();
            if (existingInvoiceNumbers.has(numStr)) {
              duplicates.push(numStr);
            } else {
              // All Excel uploads are MISSING_INVOICE flow starting at MISSING stage
              validRows.push({
                invoiceNumber: numStr,
                vendor: String(vendor),
                entity: entity ? String(entity) : undefined,
                amount: amount ? Number(amount) : undefined,
                currency: 'EUR',
                flowType: FlowType.MISSING_INVOICE,
                currentStage: FlowStage.MISSING_INVOICE_MISSING
              });
            }
          }
        });

        if (duplicates.length > 0) {
          setError(`Ignored ${duplicates.length} duplicates: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
        }

        if (validRows.length === 0 && duplicates.length === 0) {
          setError("No valid rows found. Ensure columns 'INVOICE NUMBER' and 'VENDOR NAME' exist.");
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
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="text-emerald-500" />
            Upload Missing Invoices
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><X size={20}/></button>
        </div>
        
        <div className="p-6">
          {!preview.length ? (
            <div 
              onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={handleDrop}
              className={ `
                border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer relative
                ${isDragOver ? 'border-brand-500 bg-brand-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-800/50'}
              `}
            >
              <input 
                type="file" 
                accept=".xlsx,.xls,.csv" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
              />
              <Upload className="mx-auto text-slate-400 mb-4" size={48} />
              <p className="text-slate-300 font-medium">Drag & drop excel file here</p>
              <p className="text-slate-500 text-sm mt-2">or click to browse</p>
              <div className="mt-4 text-xs text-slate-600">
                Required columns: INVOICE NUMBER, VENDOR NAME<br/>Optional: ENTITY, AMOUNT
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
                       <th className="p-2">Invoice</th>
                       <th className="p-2">Vendor</th>
                       <th className="p-2">Amount</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-700 bg-slate-900">
                     {preview.map((row, i) => (
                       <tr key={i}>
                         <td className="p-2 text-slate-300">{row.entity || '-'}</td>
                         <td className="p-2 text-white">{row.invoiceNumber}</td>
                         <td className="p-2">{row.vendor}</td>
                         <td className="p-2 text-emerald-300">{row.amount ? `€${row.amount}` : '-'}</td>
                       </tr>
                     ))}
                   </tbody>
                </table>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 bg-red-900/20 border border-red-900/50 rounded-lg p-3 flex items-start gap-3">
              <AlertTriangle className="text-red-500 shrink-0 mt-0.5" size={16} />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
          {preview.length > 0 && (
             <button onClick={handleConfirm} className="px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg font-medium transition-colors">
               Import Invoices
             </button>
          )}
        </div>
      </div>
    </div>
  );
};