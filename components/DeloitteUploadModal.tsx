import React, { useCallback, useState, useRef, useMemo } from 'react';
import { Upload, X, AlertTriangle, FileSpreadsheet, FileText, CheckCircle, Loader2, Paperclip, Filter, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import pako from 'pako';
import { Invoice, FlowType, FlowStage, Attachment } from '../types';
import { compressFile, formatFileSize, MAX_ORIGINAL_SIZE } from '../lib/compression';

// Compress file to base64 for session storage - handles large files safely
const compressFileToBase64 = async (file: File): Promise<string> => {
  // Skip files larger than 5MB to avoid storage issues
  if (file.size > 5 * 1024 * 1024) {
    console.warn('File too large for session storage:', file.name, file.size);
    return '';
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        const compressed = pako.gzip(uint8Array);

        // Convert to base64 in chunks to avoid stack overflow
        const chunkSize = 32768; // 32KB chunks
        let base64 = '';
        for (let i = 0; i < compressed.length; i += chunkSize) {
          const chunk = compressed.slice(i, i + chunkSize);
          base64 += String.fromCharCode.apply(null, Array.from(chunk));
        }
        resolve(btoa(base64));
      } catch (err) {
        console.error('Compression error:', err);
        resolve(''); // Return empty string instead of failing
      }
    };
    reader.onerror = () => resolve(''); // Return empty string on error
    reader.readAsArrayBuffer(file);
  });
};

// Generate unique session ID
const generateSessionId = (): string => {
  return `deloitte_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Session type for traceback
interface DeloitteSession {
  id: string;
  createdAt: string;
  vendorStatementName: string;
  erpStatementName: string;
  analysisFileName: string;
  vendorStatementData: string;
  erpStatementData: string;
  analysisFileData: string;
  importedCount: number;
  filteredByColO: number;
  selectedCompanies: string[];
  selectedCompanyNames: string[];
}

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
  const [rawData, setRawData] = useState<any[]>([]); // All valid rows before filtering
  const [step, setStep] = useState<'attachments' | 'excel' | 'filter'>('attachments');
  const [attachments, setAttachments] = useState<AttachmentState>({
    vendorStatement: null,
    erpStatement: null
  });
  const [isCompressing, setIsCompressing] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Analysis file for session storage
  const [analysisFile, setAnalysisFile] = useState<File | null>(null);

  // Filter states
  const [selectedCompanies, setSelectedCompanies] = useState<Set<string>>(new Set());
  const [selectedCompanyNames, setSelectedCompanyNames] = useState<Set<string>>(new Set());
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [showCompanyNameDropdown, setShowCompanyNameDropdown] = useState(false);
  const [filteredByColO, setFilteredByColO] = useState(0);

  // Session for traceback
  const [sessionId, setSessionId] = useState<string>('');

  const vendorInputRef = useRef<HTMLInputElement>(null);
  const erpInputRef = useRef<HTMLInputElement>(null);

  // Get unique companies and company names from raw data
  const uniqueCompanies = useMemo(() => {
    const companies = new Set<string>();
    rawData.forEach(row => {
      if (row.company) companies.add(row.company);
    });
    return Array.from(companies).sort();
  }, [rawData]);

  const uniqueCompanyNames = useMemo(() => {
    const names = new Set<string>();
    rawData.forEach(row => {
      if (row.companyName) names.add(row.companyName);
    });
    return Array.from(names).sort();
  }, [rawData]);

  // Filter preview based on selected companies/names
  const filteredPreview = useMemo(() => {
    let filtered = rawData;

    if (selectedCompanies.size > 0) {
      filtered = filtered.filter(row => selectedCompanies.has(row.company));
    }

    if (selectedCompanyNames.size > 0) {
      filtered = filtered.filter(row => selectedCompanyNames.has(row.companyName));
    }

    return filtered;
  }, [rawData, selectedCompanies, selectedCompanyNames]);

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
    setAnalysisFile(file); // Store for session
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
        // Note: xlsx library reads all rows regardless of Excel filters
        // We'll check for hidden rows if available
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }) as any[][];

        // Check if there are hidden rows info in the sheet
        const hiddenRows = new Set<number>();
        if (sheet['!rows']) {
          sheet['!rows'].forEach((rowInfo: any, idx: number) => {
            if (rowInfo && rowInfo.hidden) {
              hiddenRows.add(idx);
            }
          });
        }

        // Deloitte format column mapping (0-indexed):
        // Column B (index 1) = Company
        // Column C (index 2) = Company Name
        // Column L (index 11) = Document Number
        // Column N (index 13) = Amount
        // Column O (index 14) = Filter column (remove rows where value < 6)

        const validRows: any[] = [];
        const duplicates: string[] = [];
        const parseErrors: string[] = [];
        let colOFilteredCount = 0;

        // Find header row index - look for row containing header keywords
        let headerRowIndex = 0;
        for (let i = 0; i < Math.min(jsonData.length, 10); i++) {
          const row = jsonData[i];
          if (!row) continue;
          // Check if this row contains header-like values (text in columns B, C, L)
          const colB = row[1] ? String(row[1]).toLowerCase().trim() : '';
          const colC = row[2] ? String(row[2]).toLowerCase().trim() : '';
          const colL = row[11] ? String(row[11]).toLowerCase().trim() : '';
          // If any of these look like headers, mark this as header row
          if (colB.includes('company') || colC.includes('name') || colL.includes('doc') || colL.includes('number')) {
            headerRowIndex = i;
            break;
          }
        }

        // Skip header row and any rows before it, start from headerRowIndex + 1
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
          // Skip hidden/filtered rows
          if (hiddenRows.has(i)) continue;

          const row = jsonData[i];
          if (!row || row.length === 0) continue;

          // Column A (index 0) - skip rows where this is empty (filter criteria)
          const colA = row[0] ? String(row[0]).trim() : '';
          if (!colA) continue;

          // Column O filter - skip rows where value < 6
          const colO = row[14];
          if (colO !== undefined && colO !== null && colO !== '') {
            const colOVal = typeof colO === 'number' ? colO : parseFloat(String(colO).trim());
            if (!isNaN(colOVal) && colOVal < 6) {
              colOFilteredCount++;
              continue;
            }
          }

          const company = row[1] ? String(row[1]).trim() : '';      // Column B - Company
          const companyName = row[2] ? String(row[2]).trim() : '';  // Column C - Company Name
          const docNum = row[11] ? String(row[11]).trim() : '';     // Column L - Document Number
          const amount = row[13];                                    // Column N - Amount

          // Skip header-like rows (if docNum looks like a header)
          const docNumLower = docNum.toLowerCase();
          if (docNumLower.includes('doc') || docNumLower.includes('number') || docNumLower.includes('invoice')) continue;

          // Skip empty rows (need at least Document Number)
          if (!docNum) continue;

          // Parse amount - handle negative values and various formats
          let parsedAmount: number | undefined;
          if (amount !== undefined && amount !== null && amount !== '') {
            const numVal = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.-]/g, ''));
            if (!isNaN(numVal)) {
              parsedAmount = Math.abs(numVal); // Use absolute value
            }
          }

          // Skip rows with small amounts (less than 6 EUR)
          if (parsedAmount !== undefined && parsedAmount < 6) continue;

          // Check for duplicates
          if (existingInvoiceNumbers.has(docNum)) {
            duplicates.push(docNum);
            continue;
          }

          validRows.push({
            invoiceNumber: docNum,
            company: company || '',          // Column B
            companyName: companyName || '',  // Column C
            vendor: companyName || company || 'Unknown Vendor', // For display
            entity: company || undefined,
            amount: parsedAmount,
            currency: 'EUR',
            flowType: FlowType.MISSING_INVOICE,
            currentStage: FlowStage.MISSING_INVOICE_MISSING,
            source: 'EXCEL'
          });
        }

        setFilteredByColO(colOFilteredCount);

        if (parseErrors.length > 0) {
          setError(`Parse errors: ${parseErrors.slice(0, 3).join('; ')}${parseErrors.length > 3 ? '...' : ''}`);
        } else if (duplicates.length > 0) {
          setError(`Ignored ${duplicates.length} duplicates: ${duplicates.slice(0, 3).join(', ')}${duplicates.length > 3 ? '...' : ''}`);
        }

        if (validRows.length === 0 && duplicates.length === 0 && parseErrors.length === 0) {
          setError("No valid rows found. Ensure the file has data in columns B (Company), C (Company Name), L (Document Number), and N (Amount).");
        }

        // Store raw data for filtering, move to filter step
        setRawData(validRows);
        setPreview(validRows);

        // Reset filters
        setSelectedCompanies(new Set());
        setSelectedCompanyNames(new Set());

        // Move to filter step if we have data
        if (validRows.length > 0) {
          setStep('filter');
        }
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

  const handleConfirm = async () => {
    setIsImporting(true);
    setError(null);

    // Create session ID for traceback
    const currentSessionId = generateSessionId();
    setSessionId(currentSessionId);

    // Try to store session (optional - don't block import if it fails)
    try {
      // Only store file data if files are small enough
      let vendorStatementData = '';
      let erpStatementData = '';
      let analysisFileData = '';

      // Only compress if files are reasonably small (< 2MB each)
      if (attachments.vendorStatement && attachments.vendorStatement.compressedSize < 2 * 1024 * 1024) {
        vendorStatementData = attachments.vendorStatement.data;
      }

      if (attachments.erpStatement && attachments.erpStatement.compressedSize < 2 * 1024 * 1024) {
        erpStatementData = attachments.erpStatement.data;
      }

      // Skip analysis file compression for large files
      if (analysisFile && analysisFile.size < 2 * 1024 * 1024) {
        analysisFileData = await compressFileToBase64(analysisFile);
      }

      // Store session in localStorage (metadata only if files too large)
      const session: DeloitteSession = {
        id: currentSessionId,
        createdAt: new Date().toISOString(),
        vendorStatementName: attachments.vendorStatement?.name || '',
        erpStatementName: attachments.erpStatement?.name || '',
        analysisFileName: analysisFile?.name || '',
        vendorStatementData,
        erpStatementData,
        analysisFileData,
        importedCount: filteredPreview.length,
        filteredByColO,
        selectedCompanies: Array.from(selectedCompanies),
        selectedCompanyNames: Array.from(selectedCompanyNames)
      };

      // Try to store in localStorage
      const existingSessions = JSON.parse(localStorage.getItem('deloitteSessions') || '[]');
      existingSessions.push(session);

      // Keep only last 10 sessions to manage storage
      while (existingSessions.length > 10) {
        existingSessions.shift();
      }

      localStorage.setItem('deloitteSessions', JSON.stringify(existingSessions));
      console.log('DeloitteSession saved:', currentSessionId);
    } catch (storageErr) {
      // Session storage failed - continue anyway, just log the error
      console.warn('Could not save session for traceback:', storageErr);
    }

    // Always proceed with import regardless of session storage
    try {
      const invoicesWithSession = filteredPreview.map(inv => ({
        ...inv,
        deloitteSessionId: currentSessionId
      }));

      onUpload(invoicesWithSession, {
        vendorStatement: attachments.vendorStatement || undefined,
        erpStatement: attachments.erpStatement || undefined
      });
      onClose();
    } catch (err: any) {
      setError(`Failed to import: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
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
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 ${step === 'attachments' ? 'text-emerald-400' : (step === 'excel' || step === 'filter') ? 'text-emerald-500' : 'text-slate-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'attachments' ? 'bg-emerald-600 text-white' : (step === 'excel' || step === 'filter') ? 'bg-emerald-600/50 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>1</div>
              <span className="text-xs font-bold hidden sm:inline">Statements</span>
            </div>
            <div className="flex-1 h-0.5 bg-slate-700">
              <div className={`h-full bg-emerald-500 transition-all duration-500 ${(step === 'excel' || step === 'filter') ? 'w-full' : 'w-0'}`}></div>
            </div>
            <div className={`flex items-center gap-2 ${step === 'excel' ? 'text-emerald-400' : step === 'filter' ? 'text-emerald-500' : 'text-slate-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'excel' ? 'bg-emerald-600 text-white' : step === 'filter' ? 'bg-emerald-600/50 text-emerald-300' : 'bg-slate-700 text-slate-400'}`}>2</div>
              <span className="text-xs font-bold hidden sm:inline">Upload Excel</span>
            </div>
            <div className="flex-1 h-0.5 bg-slate-700">
              <div className={`h-full bg-emerald-500 transition-all duration-500 ${step === 'filter' ? 'w-full' : 'w-0'}`}></div>
            </div>
            <div className={`flex items-center gap-2 ${step === 'filter' ? 'text-emerald-400' : 'text-slate-500'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${step === 'filter' ? 'bg-emerald-600 text-white' : 'bg-slate-700 text-slate-400'}`}>3</div>
              <span className="text-xs font-bold hidden sm:inline">Filter & Import</span>
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
          ) : step === 'excel' ? (
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
                  <div><span className="text-emerald-400 font-bold">Column B:</span> Company</div>
                  <div><span className="text-emerald-400 font-bold">Column C:</span> Company Name</div>
                  <div><span className="text-emerald-400 font-bold">Column L:</span> Document Number</div>
                  <div><span className="text-emerald-400 font-bold">Column N:</span> Amount</div>
                  <div className="col-span-2"><span className="text-rose-400 font-bold">Column O:</span> Filter (rows with value &lt; 6 are removed)</div>
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
                <p className="text-slate-300 font-medium">Drag & drop Recon Analysis Excel file</p>
                <p className="text-slate-500 text-sm mt-2">or click to browse</p>
              </div>
            </div>
          ) : step === 'filter' ? (
            <div>
              {/* Show attached files summary */}
              <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-4 mb-4">
                <p className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3">Source Documents</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="truncate">{attachments.vendorStatement?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="truncate">{attachments.erpStatement?.name}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <CheckCircle size={14} className="text-emerald-500" />
                    <span className="truncate">{analysisFile?.name}</span>
                  </div>
                </div>
              </div>

              {/* Filter info */}
              {filteredByColO > 0 && (
                <div className="bg-amber-900/20 border border-amber-900/30 rounded-xl p-3 mb-4">
                  <p className="text-xs text-amber-400">
                    <Filter size={12} className="inline mr-1" />
                    {filteredByColO} rows filtered out (Column O &lt; 6)
                  </p>
                </div>
              )}

              {/* Filter Dropdowns */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                {/* Company Filter (Column B) */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Filter by Company (Column B)
                  </label>
                  <button
                    onClick={() => { setShowCompanyDropdown(!showCompanyDropdown); setShowCompanyNameDropdown(false); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-left text-sm text-white flex items-center justify-between hover:border-emerald-500 transition-colors"
                  >
                    <span className={selectedCompanies.size === 0 ? 'text-slate-500' : 'text-white'}>
                      {selectedCompanies.size === 0 ? 'All Companies' : `${selectedCompanies.size} selected`}
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCompanyDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showCompanyDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                      <button
                        onClick={() => setSelectedCompanies(new Set())}
                        className="w-full px-4 py-2 text-left text-xs text-emerald-400 hover:bg-slate-700 border-b border-slate-700"
                      >
                        Clear Selection (Show All)
                      </button>
                      {uniqueCompanies.map(company => (
                        <button
                          key={company}
                          onClick={() => {
                            const newSet = new Set(selectedCompanies);
                            if (newSet.has(company)) {
                              newSet.delete(company);
                            } else {
                              newSet.add(company);
                            }
                            setSelectedCompanies(newSet);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                        >
                          <div className={`w-4 h-4 rounded border ${selectedCompanies.has(company) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'} flex items-center justify-center`}>
                            {selectedCompanies.has(company) && <CheckCircle size={12} className="text-white" />}
                          </div>
                          <span className="truncate">{company}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Company Name Filter (Column C) */}
                <div className="relative">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Filter by Company Name (Column C)
                  </label>
                  <button
                    onClick={() => { setShowCompanyNameDropdown(!showCompanyNameDropdown); setShowCompanyDropdown(false); }}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-left text-sm text-white flex items-center justify-between hover:border-emerald-500 transition-colors"
                  >
                    <span className={selectedCompanyNames.size === 0 ? 'text-slate-500' : 'text-white'}>
                      {selectedCompanyNames.size === 0 ? 'All Company Names' : `${selectedCompanyNames.size} selected`}
                    </span>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform ${showCompanyNameDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  {showCompanyNameDropdown && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                      <button
                        onClick={() => setSelectedCompanyNames(new Set())}
                        className="w-full px-4 py-2 text-left text-xs text-emerald-400 hover:bg-slate-700 border-b border-slate-700"
                      >
                        Clear Selection (Show All)
                      </button>
                      {uniqueCompanyNames.map(name => (
                        <button
                          key={name}
                          onClick={() => {
                            const newSet = new Set(selectedCompanyNames);
                            if (newSet.has(name)) {
                              newSet.delete(name);
                            } else {
                              newSet.add(name);
                            }
                            setSelectedCompanyNames(newSet);
                          }}
                          className="w-full px-4 py-2 text-left text-sm text-white hover:bg-slate-700 flex items-center gap-2"
                        >
                          <div className={`w-4 h-4 rounded border ${selectedCompanyNames.has(name) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'} flex items-center justify-center`}>
                            {selectedCompanyNames.has(name) && <CheckCircle size={12} className="text-white" />}
                          </div>
                          <span className="truncate">{name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Results count */}
              <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-lg p-4 mb-4 flex items-center gap-3">
                <div className="bg-emerald-500/20 p-2 rounded-full">
                  <FileSpreadsheet size={20} className="text-emerald-500" />
                </div>
                <div>
                  <p className="text-white font-medium">
                    Ready to import {filteredPreview.length} invoices
                    {filteredPreview.length !== rawData.length && (
                      <span className="text-slate-400 text-sm ml-2">
                        (filtered from {rawData.length})
                      </span>
                    )}
                  </p>
                  <p className="text-slate-400 text-xs">Duplicates and small amounts (&lt;€6) have been filtered.</p>
                </div>
              </div>

              {/* Preview table */}
              <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-700">
                <table className="w-full text-left text-xs text-slate-400">
                   <thead className="bg-slate-800 text-slate-300 sticky top-0">
                     <tr>
                       <th className="p-2">Company</th>
                       <th className="p-2">Company Name</th>
                       <th className="p-2">Doc Number</th>
                       <th className="p-2">Amount</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-700 bg-slate-900">
                     {filteredPreview.slice(0, 50).map((row, i) => (
                       <tr key={i}>
                         <td className="p-2 text-slate-300">{row.company || '-'}</td>
                         <td className="p-2 text-slate-300">{row.companyName || '-'}</td>
                         <td className="p-2 text-white font-mono">{row.invoiceNumber}</td>
                         <td className="p-2 text-emerald-400">{row.amount ? `€${row.amount.toLocaleString()}` : '-'}</td>
                       </tr>
                     ))}
                     {filteredPreview.length > 50 && (
                       <tr>
                         <td colSpan={4} className="p-2 text-center text-slate-500">
                           ... and {filteredPreview.length - 50} more rows
                         </td>
                       </tr>
                     )}
                   </tbody>
                </table>
              </div>

              {error && (
                <div className="mt-4 bg-amber-900/20 border border-amber-900/50 text-amber-400 rounded-lg p-3 text-xs flex items-start gap-2">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-between gap-3 bg-slate-950/50">
          <div>
            {step === 'excel' && (
              <button
                onClick={() => { setStep('attachments'); setPreview([]); setRawData([]); }}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors text-sm font-bold"
              >
                ← Back
              </button>
            )}
            {step === 'filter' && (
              <button
                onClick={() => { setStep('excel'); setPreview([]); setRawData([]); setAnalysisFile(null); }}
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
            ) : step === 'filter' && filteredPreview.length > 0 ? (
              <button
                onClick={handleConfirm}
                disabled={isImporting}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg font-bold text-sm transition-all shadow-lg flex items-center gap-2"
              >
                {isImporting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>Import {filteredPreview.length} Invoices</>
                )}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
