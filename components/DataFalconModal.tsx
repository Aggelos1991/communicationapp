import React, { useState, useRef } from 'react';
import { X, Upload, FileText, Loader2, Download, Zap, AlertTriangle, CheckCircle, Eye, DollarSign, CreditCard, Scale, FileSpreadsheet, Bird } from 'lucide-react';
import * as XLSX from 'xlsx';
import clsx from 'clsx';
// @ts-ignore - pdf.js types
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker - use a more reliable CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

interface DataFalconModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete?: (records: ExtractedRecord[]) => void;
}

interface ExtractedRecord {
  alternativeDocument: string;
  concepto: string;
  date: string;
  reason: 'Invoice' | 'Payment' | 'Credit Note';
  debit: number | '';
  credit: number | '';
}

// Normalize numbers like 1.234,56 → 1234.56
const normalizeNumber = (value: any): number | '' => {
  if (!value) return '';
  let s = String(value).trim().replace(/\s/g, '');

  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }

  s = s.replace(/[^\d.\-]/g, '');

  try {
    const num = parseFloat(s);
    return isNaN(num) ? '' : Math.round(num * 100) / 100;
  } catch {
    return '';
  }
};

export const DataFalconModal: React.FC<DataFalconModalProps> = ({
  isOpen,
  onClose,
  onImportComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string[]>([]);
  const [records, setRecords] = useState<ExtractedRecord[]>([]);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  // Get OpenAI API key from environment
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  // Extract text from PDF using pdf.js with timeout protection
  const extractPdfText = async (pdfFile: File): Promise<string[]> => {
    setProgress('Loading PDF document...');

    try {
      const arrayBuffer = await pdfFile.arrayBuffer();
      setProgress('Initializing PDF parser...');

      // Create loading task with timeout
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        useWorkerFetch: false,
        isEvalSupported: false,
        useSystemFonts: true
      });

      // Add timeout for PDF loading (30 seconds)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('PDF loading timeout - file may be too complex')), 30000);
      });

      setProgress('Parsing PDF structure (this may take a moment)...');
      const pdf = await Promise.race([loadingTask.promise, timeoutPromise]);

      const lines: string[] = [];
      const totalPages = pdf.numPages;
      setProgress(`Found ${totalPages} pages. Extracting text...`);

      for (let i = 1; i <= totalPages; i++) {
        setProgress(`Page ${i}/${totalPages} - extracting text...`);

        try {
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();

          // Group text items by Y position to reconstruct lines
          const itemsByY: Record<number, any[]> = {};
          for (const item of textContent.items) {
            if ('str' in item && item.str.trim()) {
              const y = Math.round((item as any).transform[5]);
              if (!itemsByY[y]) itemsByY[y] = [];
              itemsByY[y].push(item);
            }
          }

          // Sort by Y position (top to bottom) and concatenate X-sorted items
          const sortedYs = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
          for (const y of sortedYs) {
            const items = itemsByY[y].sort((a, b) => a.transform[4] - b.transform[4]);
            const line = items.map((item: any) => item.str).join(' ').trim();
            if (line) lines.push(line);
          }
        } catch (pageErr) {
          console.warn(`Error extracting page ${i}:`, pageErr);
          // Continue with other pages
        }

        setProgress(`Page ${i}/${totalPages} done - ${lines.length} lines extracted`);
      }

      setProgress(`Complete! ${lines.length} lines from ${totalPages} pages`);
      return lines;
    } catch (err: any) {
      console.error('PDF extraction error:', err);
      throw new Error(`PDF extraction failed: ${err.message}`);
    }
  };

  // Abort controller for cancelling extraction
  const [abortController, setAbortController] = useState<AbortController | null>(null);

  const cancelExtraction = () => {
    if (abortController) {
      abortController.abort();
      setAbortController(null);
    }
    setIsExtracting(false);
    setProgress('');
    setError('Extraction cancelled');
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setRecords([]);
    setExtractedText([]);
    setIsExtracting(true);

    const controller = new AbortController();
    setAbortController(controller);

    try {
      const lines = await extractPdfText(uploadedFile);
      if (!controller.signal.aborted) {
        setExtractedText(lines);
      }
    } catch (err: any) {
      if (!controller.signal.aborted) {
        setError(`Failed to extract PDF text: ${err.message}. Try uploading an Excel/CSV version instead.`);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsExtracting(false);
        setProgress('');
      }
      setAbortController(null);
    }
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;

    setFile(uploadedFile);
    setError(null);
    setRecords([]);
    setExtractedText([]);
    setIsExtracting(true);

    try {
      const data = await uploadedFile.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      // Get data as raw array
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // Convert to text lines for GPT processing
      const lines = rawData
        .filter(row => row.some(cell => cell !== null && cell !== undefined && cell !== ''))
        .map(row => row.join(' | '));

      setExtractedText(lines);
    } catch (err: any) {
      setError(`Failed to read file: ${err.message}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const runGPTExtraction = async () => {
    if (!apiKey) {
      setError('OpenAI API key not configured. Add VITE_OPENAI_API_KEY to your environment variables.');
      return;
    }

    if (extractedText.length === 0) {
      setError('No text to process. Please upload a file first.');
      return;
    }

    setIsProcessing(true);
    setError(null);

    const BATCH_SIZE = 60;
    const allRecords: ExtractedRecord[] = [];

    try {
      const totalBatches = Math.ceil(extractedText.length / BATCH_SIZE);

      for (let i = 0; i < extractedText.length; i += BATCH_SIZE) {
        const batchNum = Math.floor(i / BATCH_SIZE) + 1;
        setProgress(`Processing batch ${batchNum}/${totalBatches}...`);

        const batch = extractedText.slice(i, i + BATCH_SIZE);
        const textBlock = batch.join('\n');

        const prompt = `
You are a financial data extractor specialized in Spanish and Greek vendor statements.
Each line may contain:
- Fecha (Date)
- Documento / N° DOC / Αρ. Παραστατικού / Αρ. Τιμολογίου (Document number)
- Concepto / Περιγραφή / Comentario (description)
- DEBE / Χρέωση (Invoice amount)
- HABER / Πίστωση (Payments or credit notes)
- SALDO (ignore)
- TOTAL / TOTALES / ΤΕΛΙΚΟ / ΣΥΝΟΛΟ / IMPORTE TOTAL / TOTAL FACTURA — treat as invoice total if no DEBE/HABER available

⚠️ RULES
1. Ignore lines with 'Asiento', 'Saldo', 'IVA','Total Saldo'.
2. Exclude codes like "Código IC N" or similar from document detection.
3. If "N° DOC" or "Documento" missing, detect invoice-like code (FAC123, F23, INV-2024, FRA-005, ΤΙΜ 123, etc or embedded in Concepto/Περιγραφή/Comentario as fallback)).
4. Detect reason:
   - "Cobro", "Pago", "Transferencia", "Remesa", "Bank", "Trf", "Pagado" → Payment
   - "Abono", "Nota de crédito", "Crédito", "Descuento", "Πίστωση" → Credit Note
   - "Fra.", "Factura", "Τιμολόγιο", "Παραστατικό" → Invoice
5. DEBE / Χρέωση → Invoice (put in Debit)
6. HABER / Πίστωση → Payment or Credit Note (put in Credit)
7. If neither DEBE nor HABER exists but TOTAL/TOTALES/ΤΕΛΙΚΟ/ΣΥΝΟΛΟ appear, use that value as Debit (Invoice total).
8. Output strictly JSON array only, no explanations.

OUTPUT FORMAT:
[
  {
    "Alternative Document": "string (invoice or payment ref)",
    "Concepto": "factura num from description",
    "Date": "dd/mm/yy or yyyy-mm-dd",
    "Reason": "Invoice | Payment | Credit Note",
    "Debit": "DEBE or TOTAL amount",
    "Credit": "HABER amount"
  }
]

Text to analyze:
${textBlock}
`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.0
          })
        });

        if (!response.ok) {
          throw new Error(`OpenAI API error: ${response.status}`);
        }

        const result = await response.json();
        const content = result.choices[0]?.message?.content?.trim() || '';

        // Parse JSON from response
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          try {
            const data = JSON.parse(jsonMatch[0]);

            for (const row of data) {
              const altDoc = String(row['Alternative Document'] || '').trim();

              // Skip excluded patterns
              if (/codigo\s*ic\s*n/i.test(altDoc)) continue;
              if (!altDoc || /(asiento|saldo|iva|total\s+saldo)/i.test(altDoc)) continue;

              let debitVal = normalizeNumber(row.Debit);
              let creditVal = normalizeNumber(row.Credit);
              let reason = (row.Reason || '').trim() as 'Invoice' | 'Payment' | 'Credit Note';

              // Handle dual values
              if (debitVal !== '' && creditVal !== '') {
                if (reason.toLowerCase() === 'payment' || reason.toLowerCase() === 'credit note') {
                  debitVal = '';
                } else if (reason.toLowerCase() === 'invoice') {
                  creditVal = '';
                }
              }

              // Classification fix
              if (debitVal !== '' && creditVal === '') {
                if (typeof debitVal === 'number' && debitVal < 0) {
                  creditVal = Math.abs(debitVal);
                  debitVal = '';
                  reason = 'Credit Note';
                } else {
                  reason = 'Invoice';
                }
              } else if (creditVal !== '' && debitVal === '') {
                if (/abono|nota|crédit|descuento|πίστωση/i.test(JSON.stringify(row))) {
                  reason = 'Credit Note';
                } else {
                  reason = 'Payment';
                }
              } else if (debitVal === '' && creditVal === '') {
                continue;
              }

              allRecords.push({
                alternativeDocument: altDoc,
                concepto: String(row.Concepto || '').trim(),
                date: String(row.Date || '').trim(),
                reason,
                debit: debitVal,
                credit: creditVal
              });
            }
          } catch (parseErr) {
            console.error('JSON parse error:', parseErr);
          }
        }
      }

      setRecords(allRecords);
      setProgress('');
    } catch (err: any) {
      setError(`GPT extraction failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setProgress('');
    }
  };

  const exportToExcel = () => {
    if (records.length === 0) return;

    const ws = XLSX.utils.json_to_sheet(records.map(r => ({
      'Alternative Document': r.alternativeDocument,
      'Concepto': r.concepto,
      'Date': r.date,
      'Reason': r.reason,
      'Debit': r.debit,
      'Credit': r.credit
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Extracted Data');

    const filename = `datafalcon_extract_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Export formatted for ReconRaptor vendor statement import
  const exportForReconRaptor = () => {
    if (records.length === 0) return;

    // ReconRaptor expects these columns for vendor statements:
    // Invoice, Date, Debit, Credit, Amount (optional), Reason/Description
    const reconRaptorData = records.map(r => {
      // Use the document number as invoice reference
      const invoice = r.alternativeDocument || r.concepto || '';

      // Calculate amount: debit for invoices, credit for payments/credit notes
      const debitAmt = typeof r.debit === 'number' ? r.debit : 0;
      const creditAmt = typeof r.credit === 'number' ? r.credit : 0;

      return {
        'Invoice': invoice,
        'Date': r.date,
        'Debit': debitAmt > 0 ? debitAmt : '',
        'Credit': creditAmt > 0 ? creditAmt : '',
        'Amount': debitAmt > 0 ? debitAmt : (creditAmt > 0 ? creditAmt : ''),
        'Reason': r.reason,
        'Description': r.concepto
      };
    });

    const ws = XLSX.utils.json_to_sheet(reconRaptorData);

    // Set column widths for better readability
    ws['!cols'] = [
      { wch: 20 },  // Invoice
      { wch: 12 },  // Date
      { wch: 14 },  // Debit
      { wch: 14 },  // Credit
      { wch: 14 },  // Amount
      { wch: 12 },  // Reason
      { wch: 30 }   // Description
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vendor Statement');

    const filename = `reconraptor_vendor_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  // Calculate totals
  const totals = records.reduce((acc, r) => {
    if (typeof r.debit === 'number') acc.debit += r.debit;
    if (typeof r.credit === 'number') acc.credit += r.credit;
    return acc;
  }, { debit: 0, credit: 0 });

  const netAmount = totals.debit - totals.credit;

  const resetState = () => {
    setFile(null);
    setExtractedText([]);
    setRecords([]);
    setError(null);
    setProgress('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-amber-900/30 to-orange-900/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-amber-600/20 p-3 rounded-2xl border border-amber-500/30">
              <Bird size={28} className="text-amber-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tight">DataFalcon Pro</h2>
              <p className="text-amber-400 text-sm font-medium">AI-Powered Vendor Statement Extractor</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Error Display */}
          {error && (
            <div className="bg-red-900/20 border border-red-900/50 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="text-red-400 shrink-0 mt-0.5" size={20} />
              <div>
                <p className="text-red-400 font-medium">{error}</p>
              </div>
            </div>
          )}

          {/* Progress Display - Always visible during extraction */}
          {(progress || isExtracting) && (
            <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Loader2 className="text-amber-400 animate-spin" size={20} />
                <div>
                  <p className="text-amber-400 font-medium">{progress || 'Initializing PDF reader...'}</p>
                  <p className="text-amber-400/60 text-xs mt-1">Large PDFs may take a moment to process</p>
                </div>
              </div>
              <button
                onClick={cancelExtraction}
                className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-600/50 text-red-400 rounded-lg text-xs font-bold transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          {/* File Upload */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* PDF Upload */}
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Upload PDF (Vendor Statement)
              </label>
              <input
                type="file"
                ref={pdfInputRef}
                onChange={handlePdfUpload}
                accept=".pdf"
                className="hidden"
              />
              <button
                onClick={() => { resetState(); pdfInputRef.current?.click(); }}
                disabled={isExtracting || isProcessing}
                className={clsx(
                  "w-full border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center gap-3",
                  file?.name.endsWith('.pdf')
                    ? "border-amber-500/50 bg-amber-900/10"
                    : "border-slate-700 hover:border-amber-500/50 hover:bg-slate-800/30"
                )}
              >
                {isExtracting && file?.name.endsWith('.pdf') ? (
                  <Loader2 size={32} className="text-amber-400 animate-spin" />
                ) : file?.name.endsWith('.pdf') ? (
                  <>
                    <CheckCircle size={32} className="text-amber-400" />
                    <span className="text-amber-400 font-bold text-sm truncate max-w-full">{file.name}</span>
                  </>
                ) : (
                  <>
                    <FileText size={32} className="text-slate-500" />
                    <span className="text-slate-400 text-sm">Click to upload PDF</span>
                  </>
                )}
              </button>
            </div>

            {/* Excel Upload */}
            <div>
              <label className="block text-sm font-bold text-slate-400 mb-2 uppercase tracking-wider">
                Upload Excel/CSV (Pre-extracted data)
              </label>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleExcelUpload}
                accept=".xlsx,.xls,.csv"
                className="hidden"
              />
              <button
                onClick={() => { resetState(); fileInputRef.current?.click(); }}
                disabled={isExtracting || isProcessing}
                className={clsx(
                  "w-full border-2 border-dashed rounded-2xl p-8 transition-all flex flex-col items-center gap-3",
                  file && !file.name.endsWith('.pdf')
                    ? "border-emerald-500/50 bg-emerald-900/10"
                    : "border-slate-700 hover:border-emerald-500/50 hover:bg-slate-800/30"
                )}
              >
                {isExtracting && file && !file.name.endsWith('.pdf') ? (
                  <Loader2 size={32} className="text-emerald-400 animate-spin" />
                ) : file && !file.name.endsWith('.pdf') ? (
                  <>
                    <CheckCircle size={32} className="text-emerald-400" />
                    <span className="text-emerald-400 font-bold text-sm truncate max-w-full">{file.name}</span>
                  </>
                ) : (
                  <>
                    <Upload size={32} className="text-slate-500" />
                    <span className="text-slate-400 text-sm">Click to upload Excel/CSV</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Text Preview */}
          {extractedText.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                  Extracted Text ({extractedText.length} lines)
                </label>
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  <Eye size={14} />
                  {showPreview ? 'Hide' : 'Show'} Preview
                </button>
              </div>
              {showPreview && (
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 max-h-48 overflow-y-auto">
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap">
                    {extractedText.slice(0, 30).join('\n')}
                    {extractedText.length > 30 && '\n... (truncated)'}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Action Button */}
          {extractedText.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={runGPTExtraction}
                disabled={isProcessing || !apiKey}
                className={clsx(
                  "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all",
                  isProcessing || !apiKey
                    ? "bg-slate-700 text-slate-500 cursor-not-allowed"
                    : "bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white shadow-xl shadow-amber-900/30"
                )}
              >
                {isProcessing ? (
                  <>
                    <Loader2 size={24} className="animate-spin" />
                    Processing with GPT...
                  </>
                ) : (
                  <>
                    <Zap size={24} />
                    Run AI Extraction
                  </>
                )}
              </button>
            </div>
          )}

          {/* API Key Warning */}
          {!apiKey && extractedText.length > 0 && (
            <div className="bg-amber-900/20 border border-amber-900/50 rounded-xl p-4 text-center">
              <p className="text-amber-400 text-sm">
                <strong>OpenAI API Key Required:</strong> Add <code className="bg-slate-800 px-2 py-0.5 rounded">VITE_OPENAI_API_KEY</code> to your environment variables.
              </p>
            </div>
          )}

          {/* Results */}
          {records.length > 0 && (
            <>
              {/* Summary Stats */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-emerald-900/20 border border-emerald-900/50 rounded-xl p-4 text-center">
                  <DollarSign className="text-emerald-400 mx-auto mb-2" size={24} />
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Debit</p>
                  <p className="text-2xl font-black text-emerald-400">
                    €{totals.debit.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="bg-rose-900/20 border border-rose-900/50 rounded-xl p-4 text-center">
                  <CreditCard className="text-rose-400 mx-auto mb-2" size={24} />
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Total Credit</p>
                  <p className="text-2xl font-black text-rose-400">
                    €{totals.credit.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <div className={clsx(
                  "border rounded-xl p-4 text-center",
                  netAmount >= 0 ? "bg-emerald-900/20 border-emerald-900/50" : "bg-rose-900/20 border-rose-900/50"
                )}>
                  <Scale className={netAmount >= 0 ? "text-emerald-400" : "text-rose-400"} size={24} style={{ margin: '0 auto', marginBottom: '8px' }} />
                  <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Net Balance</p>
                  <p className={clsx("text-2xl font-black", netAmount >= 0 ? "text-emerald-400" : "text-rose-400")}>
                    €{netAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {/* Results Table */}
              <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 overflow-hidden">
                <div className="p-4 border-b border-slate-700/50 flex items-center justify-between">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <CheckCircle className="text-emerald-400" size={18} />
                    Extracted Records ({records.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={exportForReconRaptor}
                      className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-sm font-bold transition-all"
                      title="Export formatted for ReconRaptor vendor statement import"
                    >
                      <FileSpreadsheet size={16} />
                      Export for ReconRaptor
                    </button>
                    <button
                      onClick={exportToExcel}
                      className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all"
                    >
                      <Download size={16} />
                      Export Raw Data
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-900/50 sticky top-0">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Document</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Date</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Concepto</th>
                        <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase">Type</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Debit</th>
                        <th className="px-4 py-3 text-right text-xs font-bold text-slate-400 uppercase">Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-700/30">
                      {records.map((record, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30">
                          <td className="px-4 py-3 text-white font-mono">{record.alternativeDocument}</td>
                          <td className="px-4 py-3 text-slate-300">{record.date}</td>
                          <td className="px-4 py-3 text-slate-400 truncate max-w-[200px]">{record.concepto}</td>
                          <td className="px-4 py-3">
                            <span className={clsx(
                              "px-2 py-1 rounded-lg text-xs font-bold",
                              record.reason === 'Invoice' && "bg-emerald-900/30 text-emerald-400",
                              record.reason === 'Payment' && "bg-blue-900/30 text-blue-400",
                              record.reason === 'Credit Note' && "bg-amber-900/30 text-amber-400"
                            )}>
                              {record.reason}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-emerald-400">
                            {record.debit !== '' ? `€${record.debit.toLocaleString('en-IE', { minimumFractionDigits: 2 })}` : ''}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-rose-400">
                            {record.credit !== '' ? `€${record.credit.toLocaleString('en-IE', { minimumFractionDigits: 2 })}` : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-700 bg-slate-950/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
