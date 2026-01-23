import React, { useState, useMemo, useEffect, useRef } from 'react';
import { X, Upload, FileSpreadsheet, CheckCircle, AlertTriangle, Send, Trash2, RefreshCw, Zap, Download, Database, FileCheck, FileX, Wallet, ArrowRightLeft, FileArchive } from 'lucide-react';
import * as XLSX from 'xlsx';
import pako from 'pako';
import clsx from 'clsx';
import { FlowType, FlowStage, ReconSession } from '../types';

// Compress file to base64
const compressFileToBase64 = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer;
        const uint8Array = new Uint8Array(arrayBuffer);
        const compressed = pako.gzip(uint8Array);
        const base64 = btoa(String.fromCharCode(...compressed));
        resolve(base64);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// Decompress base64 to blob for download
const decompressBase64ToBlob = (base64: string, mimeType: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decompressed = pako.ungzip(bytes);
  return new Blob([decompressed], { type: mimeType });
};

// Generate unique session ID
const generateSessionId = (): string => {
  return `recon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

interface ReconRaptorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: (invoices: any[]) => void;
  existingInvoiceNumbers: Set<string>;
}

interface MatchedInvoice {
  erpInvoice: string;
  vendorInvoice: string;
  erpAmount: number;
  vendorAmount: number;
  difference: number;
  status: 'perfect' | 'difference';
  erpEntity?: string;
  vendorEntity?: string;
}

interface PaymentMatch {
  erpDescription: string;
  vendorDescription: string;
  amount: number;
  erpDate?: string;
  vendorDate?: string;
  matchType: 'exact';
}

interface MissingInvoice {
  id: string;
  invoice: string;
  amount: number;
  date?: string;
  vendor?: string;
  entity?: string;
  selected: boolean;
}

// Animated background component with CSS
const AnimatedBackground: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Floating orbs */}
      <div className="absolute w-96 h-96 -top-48 -left-48 bg-gradient-to-br from-emerald-500/20 to-teal-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute w-80 h-80 -bottom-40 -right-40 bg-gradient-to-br from-cyan-500/20 to-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '5s', animationDelay: '1s' }} />
      <div className="absolute w-64 h-64 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gradient-to-br from-purple-500/10 to-pink-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s', animationDelay: '2s' }} />

      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
        backgroundSize: '50px 50px'
      }} />

      {/* Animated particles */}
      {[...Array(12)].map((_, i) => (
        <div
          key={i}
          className="absolute w-1 h-1 bg-emerald-400/40 rounded-full"
          style={{
            left: `${10 + (i * 8)}%`,
            top: `${20 + (i % 3) * 30}%`,
            animation: `float ${3 + (i % 3)}s ease-in-out infinite`,
            animationDelay: `${i * 0.3}s`
          }}
        />
      ))}

      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) translateX(0px); opacity: 0.4; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
        }
      `}</style>
    </div>
  );
};

// 3D Raptor Icon with CSS animation
const RaptorIcon: React.FC = () => {
  return (
    <div className="relative w-16 h-16 perspective-1000">
      <div
        className="w-full h-full bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-600 rounded-2xl shadow-2xl shadow-emerald-500/50 flex items-center justify-center transform-gpu"
        style={{
          animation: 'iconFloat 3s ease-in-out infinite',
          transformStyle: 'preserve-3d'
        }}
      >
        <Zap className="text-white drop-shadow-lg" size={32} />
        <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent rounded-2xl" />
      </div>
      <div
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-12 h-2 bg-emerald-500/30 rounded-full blur-sm"
        style={{ animation: 'shadowPulse 3s ease-in-out infinite' }}
      />
      <style>{`
        @keyframes iconFloat {
          0%, 100% { transform: translateY(0) rotateX(0deg) rotateY(0deg); }
          25% { transform: translateY(-4px) rotateX(5deg) rotateY(-5deg); }
          50% { transform: translateY(-8px) rotateX(0deg) rotateY(0deg); }
          75% { transform: translateY(-4px) rotateX(-5deg) rotateY(5deg); }
        }
        @keyframes shadowPulse {
          0%, 100% { transform: translateX(-50%) scale(1); opacity: 0.3; }
          50% { transform: translateX(-50%) scale(0.8); opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

// Helper functions
const normalizeNumber = (v: any): number => {
  if (v === null || v === undefined || String(v).trim() === '') return 0;
  let s = String(v).replace(/[^\d,.\-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  const num = parseFloat(s);
  return isNaN(num) ? 0 : num;
};

const cleanInvoiceCode = (inv: string): string => {
  if (!inv) return '';
  return String(inv).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
};

const fuzzyRatio = (a: string, b: string): number => {
  const s1 = a.toLowerCase();
  const s2 = b.toLowerCase();
  if (s1 === s2) return 1;
  const len1 = s1.length;
  const len2 = s2.length;
  const maxLen = Math.max(len1, len2);
  if (maxLen === 0) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return 1 - matrix[len1][len2] / maxLen;
};

export const ReconRaptorModal: React.FC<ReconRaptorModalProps> = ({
  isOpen,
  onClose,
  onImportComplete,
  existingInvoiceNumbers
}) => {
  const [erpFile, setErpFile] = useState<File | null>(null);
  const [vendorFile, setVendorFile] = useState<File | null>(null);
  const [erpData, setErpData] = useState<any[]>([]);
  const [vendorData, setVendorData] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [activeTab, setActiveTab] = useState<'matched' | 'payments' | 'missing-erp' | 'missing-vendor'>('matched');

  // Results
  const [matchedInvoices, setMatchedInvoices] = useState<MatchedInvoice[]>([]);
  const [paymentMatches, setPaymentMatches] = useState<PaymentMatch[]>([]);
  const [missingInErp, setMissingInErp] = useState<MissingInvoice[]>([]);
  const [missingInVendor, setMissingInVendor] = useState<MissingInvoice[]>([]);
  const [hasProcessed, setHasProcessed] = useState(false);

  // Session for traceback
  const [sessionId, setSessionId] = useState<string>('');
  const [vendorName, setVendorName] = useState<string>('');

  const normalizeColumns = (data: any[], tag: 'erp' | 'ven'): any[] => {
    const colMap: Record<string, string[]> = {
      invoice: ['invoice', 'inv', 'τιμολόγιο', 'factura', 'doc', 'reference', 'ref', 'document', 'αριθμός', 'number', 'nº'],
      date: ['date', 'fecha', 'ημερομηνία', 'data'],
      debit: ['debit', 'debe', 'χρέωση', 'cargo'],
      credit: ['credit', 'haber', 'πίστωση', 'abono'],
      amount: ['amount', 'value', 'total', 'sum', 'ποσό', 'αξία', 'importe', 'valor', 'balance', 'υπόλοιπο'],
      reason: ['reason', 'description', 'concepto', 'αιτιολογία', 'περιγραφή', 'desc'],
      vendor: ['vendor', 'supplier', 'proveedor', 'προμηθευτής'],
      entity: ['entity', 'company', 'entidad', 'οντότητα', 'εταιρεία']
    };

    return data.map(row => {
      const newRow: any = { ...row };
      const lowerKeys = Object.keys(row).map(k => ({ orig: k, lower: k.toLowerCase() }));

      for (const [field, aliases] of Object.entries(colMap)) {
        for (const { orig, lower } of lowerKeys) {
          if (aliases.some(a => lower.includes(a))) {
            newRow[`${field}_${tag}`] = row[orig];
            break;
          }
        }
      }
      return newRow;
    });
  };

  const processFile = (file: File, type: 'erp' | 'vendor') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { raw: true, defval: '' });

        const normalized = normalizeColumns(jsonData, type === 'erp' ? 'erp' : 'ven');

        if (type === 'erp') {
          setErpData(normalized);
          setErpFile(file);
        } else {
          setVendorData(normalized);
          setVendorFile(file);
        }
        setError(null);
      } catch (err) {
        setError(`Failed to parse ${type.toUpperCase()} file`);
      }
    };
    reader.readAsBinaryString(file);
  };

  const runReconciliation = () => {
    if (erpData.length === 0 || vendorData.length === 0) {
      setError('Please upload both ERP and Vendor files');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      // ============================================================
      // ACCOUNTING LOGIC FOR AP RECONCILIATION
      // ============================================================
      // ERP (Your Books - AP Perspective):
      //   Credit = Liability (you owe vendor) = positive invoice
      //   Debit = Reduces liability = payment or credit note (negative)
      //
      // Vendor Statement (Their AR Perspective):
      //   Debit = You owe them = positive invoice
      //   Credit = Reduces what you owe = payment or credit note (negative)
      // ============================================================

      // Calculate amount from ERP row (your books)
      const calcErpAmount = (row: any): number => {
        const directAmount = normalizeNumber(row.amount_erp || 0);
        if (directAmount !== 0) return Math.abs(directAmount);

        const debit = normalizeNumber(row.debit_erp || 0);
        const credit = normalizeNumber(row.credit_erp || 0);

        // In AP: Credit = liability (invoice), Debit = reduces liability
        if (credit !== 0) return Math.abs(credit);
        if (debit !== 0) return Math.abs(debit);
        return 0;
      };

      // Calculate amount from Vendor row (their statement)
      const calcVendorAmount = (row: any): number => {
        const directAmount = normalizeNumber(row.amount_ven || 0);
        if (directAmount !== 0) return Math.abs(directAmount);

        const debit = normalizeNumber(row.debit_ven || 0);
        const credit = normalizeNumber(row.credit_ven || 0);

        // In vendor statement: Debit = you owe, Credit = credit note/payment
        if (debit !== 0) return Math.abs(debit);
        if (credit !== 0) return Math.abs(credit);
        return 0;
      };

      // Process ERP data
      const erpAll = erpData.map((row, idx) => {
        const amt = calcErpAmount(row);
        const invoiceRaw = String(row.invoice_erp || '').trim();
        const invoiceClean = cleanInvoiceCode(invoiceRaw);
        const hasInvoiceNumber = invoiceClean.length > 0;
        return {
          ...row,
          __id: `erp_${idx}`,
          __inv: invoiceRaw,
          __inv_clean: invoiceClean,
          __amt: amt,
          __hasInvoice: hasInvoiceNumber
        };
      });

      // Process Vendor data
      const venAll = vendorData.map((row, idx) => {
        const amt = calcVendorAmount(row);
        const invoiceRaw = String(row.invoice_ven || '').trim();
        const invoiceClean = cleanInvoiceCode(invoiceRaw);
        const hasInvoiceNumber = invoiceClean.length > 0;
        return {
          ...row,
          __id: `ven_${idx}`,
          __inv: invoiceRaw,
          __inv_clean: invoiceClean,
          __amt: amt,
          __hasInvoice: hasInvoiceNumber
        };
      });

      // ============================================================
      // CONSOLIDATION: Group by invoice number and sum amounts
      // This handles multiple entries for same invoice (partials, credit notes)
      // ============================================================
      const consolidateByInvoice = (rows: any[], prefix: string) => {
        const grouped: Record<string, any[]> = {};

        for (const row of rows) {
          if (!row.__hasInvoice || row.__amt === 0) continue;
          const key = row.__inv_clean;
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(row);
        }

        const consolidated: any[] = [];
        for (const [invClean, group] of Object.entries(grouped)) {
          // Sum all amounts for this invoice
          const totalAmt = group.reduce((sum, r) => sum + r.__amt, 0);

          // Skip if net amount is zero (fully paid/cancelled)
          if (Math.abs(totalAmt) < 0.01) continue;

          // Take first row as base, update amount
          const base = { ...group[0] };
          base.__amt = Math.abs(totalAmt);
          base.__entryCount = group.length;
          consolidated.push(base);
        }
        return consolidated;
      };

      // Get items with and without invoice numbers
      const erpWithInv = erpAll.filter(r => r.__hasInvoice && r.__amt > 0);
      const erpPayments = erpAll.filter(r => !r.__hasInvoice && r.__amt > 0);
      const venWithInv = venAll.filter(r => r.__hasInvoice && r.__amt > 0);
      const venPayments = venAll.filter(r => !r.__hasInvoice && r.__amt > 0);

      // Consolidate invoices
      const erpConsolidated = consolidateByInvoice(erpWithInv, 'erp');
      const venConsolidated = consolidateByInvoice(venWithInv, 'ven');

      // ============================================================
      // TIER 1: Exact invoice number match (normalized)
      // ============================================================
      const matched: MatchedInvoice[] = [];
      const usedVendor = new Set<string>();
      const usedErp = new Set<string>();

      for (const erp of erpConsolidated) {
        for (const ven of venConsolidated) {
          if (usedVendor.has(ven.__inv_clean)) continue;

          if (erp.__inv_clean === ven.__inv_clean) {
            const diff = Math.abs(erp.__amt - ven.__amt);
            matched.push({
              erpInvoice: erp.__inv,
              vendorInvoice: ven.__inv,
              erpAmount: erp.__amt,
              vendorAmount: ven.__amt,
              difference: Math.round(diff * 100) / 100,
              status: diff <= 0.01 ? 'perfect' : 'difference',
              erpEntity: erp.entity_erp || '',
              vendorEntity: ven.entity_ven || ''
            });
            usedVendor.add(ven.__inv_clean);
            usedErp.add(erp.__inv_clean);
            break;
          }
        }
      }

      // ============================================================
      // TIER 2: Fuzzy invoice number match (>85% similar + amount within €10)
      // ============================================================
      const remainingErp = erpConsolidated.filter(e => !usedErp.has(e.__inv_clean));
      const remainingVen = venConsolidated.filter(v => !usedVendor.has(v.__inv_clean));

      for (const erp of remainingErp) {
        let bestMatch: any = null;
        let bestRatio = 0;

        for (const ven of remainingVen) {
          if (usedVendor.has(ven.__inv_clean)) continue;

          const ratio = fuzzyRatio(erp.__inv_clean, ven.__inv_clean);
          const amtDiff = Math.abs(erp.__amt - ven.__amt);

          // Must be >85% similar AND amount within €10
          if (ratio > 0.85 && amtDiff < 10 && ratio > bestRatio) {
            bestRatio = ratio;
            bestMatch = ven;
          }
        }

        if (bestMatch) {
          const amtDiff = Math.abs(erp.__amt - bestMatch.__amt);
          matched.push({
            erpInvoice: erp.__inv,
            vendorInvoice: bestMatch.__inv,
            erpAmount: erp.__amt,
            vendorAmount: bestMatch.__amt,
            difference: Math.round(amtDiff * 100) / 100,
            status: 'difference',
            erpEntity: erp.entity_erp || '',
            vendorEntity: bestMatch.entity_ven || ''
          });
          usedVendor.add(bestMatch.__inv_clean);
          usedErp.add(erp.__inv_clean);
        }
      }

      // ============================================================
      // TIER 3: Payment matching (no invoice number, match by exact amount)
      // ============================================================
      const paymentMatchResults: PaymentMatch[] = [];
      const paymentUsedErp = new Set<string>();
      const paymentUsedVen = new Set<string>();

      for (const erp of erpPayments) {
        if (paymentUsedErp.has(erp.__id)) continue;

        for (const ven of venPayments) {
          if (paymentUsedVen.has(ven.__id)) continue;

          // Exact amount match (within 1 cent)
          if (Math.abs(erp.__amt - ven.__amt) <= 0.01) {
            const erpDesc = erp.reason_erp || erp.description_erp || `Payment €${erp.__amt.toFixed(2)}`;
            const venDesc = ven.reason_ven || ven.description_ven || `Payment €${ven.__amt.toFixed(2)}`;

            paymentMatchResults.push({
              erpDescription: erpDesc,
              vendorDescription: venDesc,
              amount: erp.__amt,
              erpDate: erp.date_erp,
              vendorDate: ven.date_ven,
              matchType: 'exact'
            });
            paymentUsedErp.add(erp.__id);
            paymentUsedVen.add(ven.__id);
            break;
          }
        }
      }

      console.log('=== ReconRaptor Debug ===');
      console.log('Total rows:', { erp: erpData.length, vendor: vendorData.length });
      console.log('With invoice #:', { erp: erpWithInv.length, vendor: venWithInv.length });
      console.log('Consolidated:', { erp: erpConsolidated.length, vendor: venConsolidated.length });
      console.log('Payments:', { erp: erpPayments.length, vendor: venPayments.length });
      console.log('Invoice matches:', matched.length);
      console.log('Payment matches:', paymentMatchResults.length);

      // ============================================================
      // MISSING INVOICES
      // ============================================================
      // Missing in ERP = Vendor has it, you don't (need to book it)
      const missInErp = venConsolidated
        .filter(v => !usedVendor.has(v.__inv_clean))
        .map((v, idx) => ({
          id: `miss_erp_${idx}`,
          invoice: v.__inv,
          amount: v.__amt,
          date: v.date_ven,
          vendor: v.vendor_ven || '',
          entity: v.entity_ven || '',
          selected: false
        }));

      // Missing in Vendor = You have it, vendor doesn't (investigate)
      const missInVendor = erpConsolidated
        .filter(e => !usedErp.has(e.__inv_clean))
        .map((e, idx) => ({
          id: `miss_ven_${idx}`,
          invoice: e.__inv,
          amount: e.__amt,
          date: e.date_erp,
          vendor: e.vendor_erp || '',
          entity: e.entity_erp || '',
          selected: false
        }));

      setMatchedInvoices(matched);
      setPaymentMatches(paymentMatchResults);
      setMissingInErp(missInErp);
      setMissingInVendor(missInVendor);
      setHasProcessed(true);
      setActiveTab('matched');
    } catch (err: any) {
      setError(`Reconciliation error: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelection = (id: string, type: 'erp' | 'vendor') => {
    if (type === 'erp') {
      setMissingInErp(prev => prev.map(inv =>
        inv.id === id ? { ...inv, selected: !inv.selected } : inv
      ));
    } else {
      setMissingInVendor(prev => prev.map(inv =>
        inv.id === id ? { ...inv, selected: !inv.selected } : inv
      ));
    }
  };

  const selectAll = (type: 'erp' | 'vendor', selected: boolean) => {
    if (type === 'erp') {
      setMissingInErp(prev => prev.map(inv => ({ ...inv, selected })));
    } else {
      setMissingInVendor(prev => prev.map(inv => ({ ...inv, selected })));
    }
  };

  const deleteSelected = (type: 'erp' | 'vendor') => {
    if (type === 'erp') {
      setMissingInErp(prev => prev.filter(inv => !inv.selected));
    } else {
      setMissingInVendor(prev => prev.filter(inv => !inv.selected));
    }
  };

  const updateInvoice = (id: string, type: 'erp' | 'vendor', field: keyof MissingInvoice, value: any) => {
    if (type === 'erp') {
      setMissingInErp(prev => prev.map(inv =>
        inv.id === id ? { ...inv, [field]: value } : inv
      ));
    } else {
      setMissingInVendor(prev => prev.map(inv =>
        inv.id === id ? { ...inv, [field]: value } : inv
      ));
    }
  };

  const deleteRow = (id: string, type: 'erp' | 'vendor') => {
    if (type === 'erp') {
      setMissingInErp(prev => prev.filter(inv => inv.id !== id));
    } else {
      setMissingInVendor(prev => prev.filter(inv => inv.id !== id));
    }
  };

  const sendToReconQueue = async (type: 'erp' | 'vendor', sendAll: boolean) => {
    const invoicesList = type === 'erp' ? missingInErp : missingInVendor;
    const toSend = sendAll ? invoicesList : invoicesList.filter(inv => inv.selected);

    if (toSend.length === 0) {
      setError('No invoices selected');
      return;
    }

    const newInvoices = toSend.filter(inv => !existingInvoiceNumbers.has(inv.invoice));

    if (newInvoices.length === 0) {
      setError('All selected invoices already exist in the system');
      return;
    }

    setIsImporting(true);
    setError(null);

    try {
      // Create session ID if not exists
      let currentSessionId = sessionId;
      if (!currentSessionId && erpFile && vendorFile) {
        currentSessionId = generateSessionId();
        setSessionId(currentSessionId);

        // Compress and store files for traceback
        const erpCompressed = await compressFileToBase64(erpFile);
        const vendorCompressed = await compressFileToBase64(vendorFile);

        // Store session in localStorage (could be moved to backend later)
        const session: ReconSession = {
          id: currentSessionId,
          createdAt: new Date().toISOString(),
          createdBy: '', // Will be set by parent
          vendorName: vendorName || 'Unknown Vendor',
          erpFileName: erpFile.name,
          vendorFileName: vendorFile.name,
          erpFileData: erpCompressed,
          vendorFileData: vendorCompressed,
          matchedCount: matchedInvoices.length,
          missingInErpCount: missingInErp.length,
          missingInVendorCount: missingInVendor.length,
          importedCount: newInvoices.length
        };

        // Store in localStorage with size limit check
        const existingSessions = JSON.parse(localStorage.getItem('reconSessions') || '[]');
        existingSessions.push(session);

        // Keep only last 20 sessions to manage storage
        while (existingSessions.length > 20) {
          existingSessions.shift();
        }

        localStorage.setItem('reconSessions', JSON.stringify(existingSessions));
        console.log('ReconSession saved:', currentSessionId);
      }

      const invoiceData = newInvoices.map(inv => ({
        invoiceNumber: inv.invoice,
        vendor: inv.vendor || vendorName || 'Unknown Vendor',
        entity: inv.entity || '',
        amount: inv.amount || 0,
        currency: 'EUR',
        flowType: FlowType.MISSING_INVOICE,
        currentStage: FlowStage.MISSING_INVOICE_MISSING,
        source: 'RECON',
        reconSessionId: currentSessionId // Link to session for traceback
      }));

      if (type === 'erp') {
        if (sendAll) {
          setMissingInErp([]);
        } else {
          setMissingInErp(prev => prev.filter(inv => !inv.selected));
        }
      } else {
        if (sendAll) {
          setMissingInVendor([]);
        } else {
          setMissingInVendor(prev => prev.filter(inv => !inv.selected));
        }
      }

      onImportComplete(invoiceData);
    } catch (err: any) {
      setError(`Failed to save session: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  // Download source file from session
  const downloadSourceFile = (fileType: 'erp' | 'vendor') => {
    if (!sessionId) return;

    const sessions: ReconSession[] = JSON.parse(localStorage.getItem('reconSessions') || '[]');
    const session = sessions.find(s => s.id === sessionId);

    if (!session) {
      setError('Session not found');
      return;
    }

    try {
      const data = fileType === 'erp' ? session.erpFileData : session.vendorFileData;
      const fileName = fileType === 'erp' ? session.erpFileName : session.vendorFileName;
      const blob = decompressBase64ToBlob(data, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(`Failed to download file: ${err.message}`);
    }
  };

  const stats = useMemo(() => ({
    perfect: matchedInvoices.filter(m => m.status === 'perfect').length,
    difference: matchedInvoices.filter(m => m.status === 'difference').length,
    paymentMatches: paymentMatches.length,
    missingErp: missingInErp.length,
    missingVendor: missingInVendor.length,
    totalErp: erpData.length,
    totalVendor: vendorData.length
  }), [matchedInvoices, paymentMatches, missingInErp, missingInVendor, erpData, vendorData]);

  const selectedErpCount = missingInErp.filter(i => i.selected).length;
  const selectedVendorCount = missingInVendor.filter(i => i.selected).length;

  const exportAllResults = () => {
    const wb = XLSX.utils.book_new();

    if (matchedInvoices.length > 0) {
      const matchedData = matchedInvoices.map(inv => ({
        'ERP Invoice': inv.erpInvoice,
        'Vendor Invoice': inv.vendorInvoice,
        'ERP Amount': inv.erpAmount,
        'Vendor Amount': inv.vendorAmount,
        'Difference': inv.difference,
        'Status': inv.status === 'perfect' ? 'Perfect Match' : 'Has Difference'
      }));
      const ws1 = XLSX.utils.json_to_sheet(matchedData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Matched');
    }

    if (paymentMatches.length > 0) {
      const paymentData = paymentMatches.map(pm => ({
        'ERP Description': pm.erpDescription,
        'Vendor Description': pm.vendorDescription,
        'Amount': pm.amount,
        'ERP Date': pm.erpDate || '',
        'Vendor Date': pm.vendorDate || '',
        'Match Type': 'Exact Amount (No Invoice #)'
      }));
      const wsPayment = XLSX.utils.json_to_sheet(paymentData);
      XLSX.utils.book_append_sheet(wb, wsPayment, 'Payment Matches');
    }

    if (missingInErp.length > 0) {
      const erpExportData = missingInErp.map(inv => ({
        'Invoice #': inv.invoice,
        'Amount': inv.amount,
        'Date': inv.date || '',
        'Vendor': inv.vendor || ''
      }));
      const ws2 = XLSX.utils.json_to_sheet(erpExportData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Missing in ERP');
    }

    if (missingInVendor.length > 0) {
      const venData = missingInVendor.map(inv => ({
        'Invoice #': inv.invoice,
        'Amount': inv.amount,
        'Date': inv.date || '',
        'Entity': inv.entity || ''
      }));
      const ws3 = XLSX.utils.json_to_sheet(venData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Missing in Vendor');
    }

    XLSX.writeFile(wb, `ReconRaptor_Full_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-xl flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl border border-slate-700/50 w-full max-w-7xl max-h-[92vh] overflow-hidden shadow-2xl shadow-black/50 relative">
        <AnimatedBackground />

        {/* Header */}
        <div className="relative flex items-center justify-between px-8 py-6 border-b border-slate-700/50 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80 backdrop-blur-sm">
          <div className="flex items-center gap-5">
            <RaptorIcon />
            <div>
              <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-400 to-cyan-400">
                ReconRaptor
              </h2>
              <p className="text-sm text-slate-400 font-medium">Intelligent Vendor Reconciliation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-3 hover:bg-slate-700/50 rounded-xl transition-all hover:scale-110 group"
          >
            <X className="text-slate-400 group-hover:text-white transition-colors" size={24} />
          </button>
        </div>

        <div className="relative overflow-y-auto max-h-[calc(92vh-100px)] p-8">
          {/* File Upload Section - Side by Side */}
          <div className="grid grid-cols-2 gap-6 mb-8">
            {/* ERP Upload */}
            <div className={clsx(
              "relative group border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 overflow-hidden",
              erpFile
                ? "border-emerald-500/50 bg-emerald-500/5"
                : "border-slate-600 hover:border-emerald-500/50 hover:bg-emerald-500/5"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'erp')}
                className="hidden"
                id="erp-upload"
              />
              <label htmlFor="erp-upload" className="cursor-pointer block relative z-10">
                {erpFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
                      <CheckCircle className="text-emerald-400" size={28} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">{erpFile.name}</p>
                      <p className="text-emerald-400 text-sm font-medium">{erpData.length} rows loaded</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-slate-700/50 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                      <Database className="text-slate-400 group-hover:text-emerald-400 transition-colors" size={28} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">ERP Export</p>
                      <p className="text-slate-400 text-sm">Drop Excel file or click to upload</p>
                    </div>
                  </div>
                )}
              </label>
            </div>

            {/* Vendor Upload */}
            <div className={clsx(
              "relative group border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300 overflow-hidden",
              vendorFile
                ? "border-cyan-500/50 bg-cyan-500/5"
                : "border-slate-600 hover:border-cyan-500/50 hover:bg-cyan-500/5"
            )}>
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0], 'vendor')}
                className="hidden"
                id="vendor-upload"
              />
              <label htmlFor="vendor-upload" className="cursor-pointer block relative z-10">
                {vendorFile ? (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-cyan-500/20 rounded-2xl flex items-center justify-center">
                      <CheckCircle className="text-cyan-400" size={28} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">{vendorFile.name}</p>
                      <p className="text-cyan-400 text-sm font-medium">{vendorData.length} rows loaded</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-slate-700/50 rounded-2xl flex items-center justify-center group-hover:bg-cyan-500/20 transition-colors">
                      <FileSpreadsheet className="text-slate-400 group-hover:text-cyan-400 transition-colors" size={28} />
                    </div>
                    <div>
                      <p className="text-white font-bold text-lg">Vendor Statement</p>
                      <p className="text-slate-400 text-sm">Drop Excel file or click to upload</p>
                    </div>
                  </div>
                )}
              </label>
            </div>
          </div>

          {/* Vendor Name Input */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-slate-400 mb-2">Vendor Name (for imported invoices)</label>
            <input
              type="text"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              placeholder="Enter vendor name..."
              className="w-full bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Action Buttons - All in a Row */}
          <div className="flex items-center justify-center gap-4 mb-8">
            <button
              onClick={runReconciliation}
              disabled={!erpFile || !vendorFile || isProcessing}
              className={clsx(
                "flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300",
                erpFile && vendorFile && !isProcessing
                  ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:shadow-xl hover:shadow-emerald-500/30 hover:scale-105 hover:-translate-y-1"
                  : "bg-slate-700 text-slate-400 cursor-not-allowed"
              )}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="animate-spin" size={22} />
                  Processing...
                </>
              ) : (
                <>
                  <Zap size={22} />
                  Run Reconciliation
                </>
              )}
            </button>

            {hasProcessed && (
              <button
                onClick={exportAllResults}
                className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 rounded-2xl text-white font-bold transition-all duration-300 hover:shadow-xl hover:shadow-blue-500/30 hover:scale-105 hover:-translate-y-1"
              >
                <Download size={20} />
                Export Report
              </button>
            )}
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-center gap-3 backdrop-blur-sm">
              <AlertTriangle className="text-red-400 flex-shrink-0" size={20} />
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {/* Results Section */}
          {hasProcessed && (
            <>
              {/* Stats Cards */}
              <div className="grid grid-cols-5 gap-4 mb-8">
                <div
                  onClick={() => setActiveTab('matched')}
                  className={clsx(
                    "relative overflow-hidden rounded-2xl p-5 text-center cursor-pointer transition-all duration-300 group",
                    activeTab === 'matched'
                      ? "bg-emerald-500/20 border-2 border-emerald-500/50 scale-105"
                      : "bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/15"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent" />
                  <FileCheck className="mx-auto mb-2 text-emerald-400" size={24} />
                  <p className="text-3xl font-black text-emerald-400">{stats.perfect}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase">Perfect</p>
                </div>

                <div
                  onClick={() => setActiveTab('matched')}
                  className={clsx(
                    "relative overflow-hidden rounded-2xl p-5 text-center cursor-pointer transition-all duration-300",
                    activeTab === 'matched'
                      ? "bg-amber-500/20 border-2 border-amber-500/50 scale-105"
                      : "bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/15"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-amber-500/10 to-transparent" />
                  <ArrowRightLeft className="mx-auto mb-2 text-amber-400" size={24} />
                  <p className="text-3xl font-black text-amber-400">{stats.difference}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase">Differences</p>
                </div>

                <div
                  onClick={() => setActiveTab('payments')}
                  className={clsx(
                    "relative overflow-hidden rounded-2xl p-5 text-center cursor-pointer transition-all duration-300",
                    activeTab === 'payments'
                      ? "bg-cyan-500/20 border-2 border-cyan-500/50 scale-105"
                      : "bg-cyan-500/10 border border-cyan-500/30 hover:bg-cyan-500/15"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent" />
                  <Wallet className="mx-auto mb-2 text-cyan-400" size={24} />
                  <p className="text-3xl font-black text-cyan-400">{stats.paymentMatches}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase">Payments</p>
                </div>

                <div
                  onClick={() => setActiveTab('missing-erp')}
                  className={clsx(
                    "relative overflow-hidden rounded-2xl p-5 text-center cursor-pointer transition-all duration-300",
                    activeTab === 'missing-erp'
                      ? "bg-rose-500/20 border-2 border-rose-500/50 scale-105"
                      : "bg-rose-500/10 border border-rose-500/30 hover:bg-rose-500/15"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-rose-500/10 to-transparent" />
                  <FileX className="mx-auto mb-2 text-rose-400" size={24} />
                  <p className="text-3xl font-black text-rose-400">{stats.missingErp}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase">Missing ERP</p>
                </div>

                <div
                  onClick={() => setActiveTab('missing-vendor')}
                  className={clsx(
                    "relative overflow-hidden rounded-2xl p-5 text-center cursor-pointer transition-all duration-300",
                    activeTab === 'missing-vendor'
                      ? "bg-purple-500/20 border-2 border-purple-500/50 scale-105"
                      : "bg-purple-500/10 border border-purple-500/30 hover:bg-purple-500/15"
                  )}
                >
                  <div className="absolute inset-0 bg-gradient-to-t from-purple-500/10 to-transparent" />
                  <FileX className="mx-auto mb-2 text-purple-400" size={24} />
                  <p className="text-3xl font-black text-purple-400">{stats.missingVendor}</p>
                  <p className="text-xs text-slate-400 font-bold uppercase">Missing Vendor</p>
                </div>
              </div>

              {/* Tab Content */}
              <div className="bg-slate-800/30 rounded-2xl border border-slate-700/50 backdrop-blur-sm overflow-hidden">
                {/* Matched Invoices Tab */}
                {activeTab === 'matched' && matchedInvoices.length > 0 && (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-emerald-900/30 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-emerald-300 uppercase">ERP Invoice</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-emerald-300 uppercase">Vendor Invoice</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-emerald-300 uppercase">Entity</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-emerald-300 uppercase">ERP Amount</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-emerald-300 uppercase">Vendor Amount</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-emerald-300 uppercase">Difference</th>
                          <th className="px-4 py-4 text-center text-xs font-bold text-emerald-300 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {matchedInvoices.map((inv, idx) => (
                          <tr key={idx} className="border-t border-slate-700/30 hover:bg-emerald-900/10 transition-colors">
                            <td className="px-4 py-3 text-sm text-white font-mono">{inv.erpInvoice}</td>
                            <td className="px-4 py-3 text-sm text-white font-mono">{inv.vendorInvoice}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{inv.erpEntity || inv.vendorEntity || '-'}</td>
                            <td className="px-4 py-3 text-sm text-white text-right font-mono">€{inv.erpAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-sm text-white text-right font-mono">€{inv.vendorAmount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-sm text-right font-mono">
                              <span className={inv.difference > 0 ? 'text-amber-400' : 'text-emerald-400'}>
                                €{inv.difference.toLocaleString('en-IE', { minimumFractionDigits: 2 })}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={clsx(
                                "px-3 py-1.5 rounded-full text-xs font-bold",
                                inv.status === 'perfect' ? "bg-emerald-500/20 text-emerald-400" : "bg-amber-500/20 text-amber-400"
                              )}>
                                {inv.status === 'perfect' ? '✓ Perfect' : '⚠ Diff'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'matched' && matchedInvoices.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <FileCheck size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No matched invoices found</p>
                  </div>
                )}

                {/* Payment Matches Tab */}
                {activeTab === 'payments' && paymentMatches.length > 0 && (
                  <div className="overflow-x-auto max-h-96 overflow-y-auto">
                    <table className="w-full">
                      <thead className="bg-cyan-900/30 sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-4 text-left text-xs font-bold text-cyan-300 uppercase">ERP Description</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-cyan-300 uppercase">Vendor Description</th>
                          <th className="px-4 py-4 text-right text-xs font-bold text-cyan-300 uppercase">Amount</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-cyan-300 uppercase">ERP Date</th>
                          <th className="px-4 py-4 text-left text-xs font-bold text-cyan-300 uppercase">Vendor Date</th>
                          <th className="px-4 py-4 text-center text-xs font-bold text-cyan-300 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentMatches.map((pm, idx) => (
                          <tr key={idx} className="border-t border-slate-700/30 hover:bg-cyan-900/10 transition-colors">
                            <td className="px-4 py-3 text-sm text-white">{pm.erpDescription}</td>
                            <td className="px-4 py-3 text-sm text-white">{pm.vendorDescription}</td>
                            <td className="px-4 py-3 text-sm text-white text-right font-mono font-bold">€{pm.amount.toLocaleString('en-IE', { minimumFractionDigits: 2 })}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{pm.erpDate || '-'}</td>
                            <td className="px-4 py-3 text-sm text-slate-300">{pm.vendorDate || '-'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-cyan-500/20 text-cyan-400">
                                💰 Matched
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {activeTab === 'payments' && paymentMatches.length === 0 && (
                  <div className="p-12 text-center text-slate-400">
                    <Wallet size={48} className="mx-auto mb-4 opacity-50" />
                    <p>No payment matches found</p>
                  </div>
                )}

                {/* Missing in ERP Tab */}
                {activeTab === 'missing-erp' && (
                  <>
                    {/* Action Bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-rose-900/20 border-b border-rose-500/30">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={missingInErp.length > 0 && missingInErp.every(inv => inv.selected)}
                          onChange={(e) => selectAll('erp', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rose-500"
                        />
                        <span className="text-sm text-slate-400">Select All</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteSelected('erp')}
                          disabled={selectedErpCount === 0}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-white font-medium transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete ({selectedErpCount})
                        </button>
                        <button
                          onClick={() => sendToReconQueue('erp', false)}
                          disabled={selectedErpCount === 0 || isImporting}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-bold transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                          Send Selected
                        </button>
                        <button
                          onClick={() => sendToReconQueue('erp', true)}
                          disabled={missingInErp.length === 0 || isImporting}
                          className="flex items-center gap-1.5 px-3 py-2 bg-rose-600 hover:bg-rose-500 rounded-lg text-xs text-white font-bold transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                          Send All ({missingInErp.length})
                        </button>
                      </div>
                    </div>

                    {missingInErp.length > 0 ? (
                      <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-rose-900/30 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-3 w-12"></th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-rose-300 uppercase">Entity</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-rose-300 uppercase">Vendor Name</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-rose-300 uppercase">Invoice #</th>
                              <th className="px-3 py-3 text-right text-xs font-bold text-rose-300 uppercase">Amount</th>
                              <th className="px-3 py-3 w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingInErp.map((inv) => (
                              <tr key={inv.id} className="border-t border-slate-700/30 hover:bg-rose-900/10 transition-colors">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={inv.selected}
                                    onChange={() => toggleSelection(inv.id, 'erp')}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-rose-500"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="text"
                                    value={inv.entity || ''}
                                    onChange={(e) => updateInvoice(inv.id, 'erp', 'entity', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                                    placeholder="Entity"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="text"
                                    value={inv.vendor || ''}
                                    onChange={(e) => updateInvoice(inv.id, 'erp', 'vendor', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-rose-500 focus:outline-none"
                                    placeholder="Vendor Name"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="text"
                                    value={inv.invoice}
                                    onChange={(e) => updateInvoice(inv.id, 'erp', 'invoice', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-rose-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="number"
                                    value={inv.amount}
                                    onChange={(e) => updateInvoice(inv.id, 'erp', 'amount', parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-right focus:border-rose-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => deleteRow(inv.id, 'erp')}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-400">
                        <FileX size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No missing invoices in ERP</p>
                      </div>
                    )}
                  </>
                )}

                {/* Missing in Vendor Tab */}
                {activeTab === 'missing-vendor' && (
                  <>
                    {/* Action Bar */}
                    <div className="flex items-center justify-between px-4 py-3 bg-purple-900/20 border-b border-purple-500/30">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={missingInVendor.length > 0 && missingInVendor.every(inv => inv.selected)}
                          onChange={(e) => selectAll('vendor', e.target.checked)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500"
                        />
                        <span className="text-sm text-slate-400">Select All</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteSelected('vendor')}
                          disabled={selectedVendorCount === 0}
                          className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-white font-medium transition-colors disabled:opacity-50"
                        >
                          <Trash2 size={14} />
                          Delete ({selectedVendorCount})
                        </button>
                        <button
                          onClick={() => sendToReconQueue('vendor', false)}
                          disabled={selectedVendorCount === 0 || isImporting}
                          className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs text-white font-bold transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                          Send Selected
                        </button>
                        <button
                          onClick={() => sendToReconQueue('vendor', true)}
                          disabled={missingInVendor.length === 0 || isImporting}
                          className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-xs text-white font-bold transition-colors disabled:opacity-50"
                        >
                          <Send size={14} />
                          Send All ({missingInVendor.length})
                        </button>
                      </div>
                    </div>

                    {missingInVendor.length > 0 ? (
                      <div className="overflow-x-auto max-h-80 overflow-y-auto">
                        <table className="w-full">
                          <thead className="bg-purple-900/30 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-3 w-12"></th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-purple-300 uppercase">Entity</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-purple-300 uppercase">Vendor Name</th>
                              <th className="px-3 py-3 text-left text-xs font-bold text-purple-300 uppercase">Invoice #</th>
                              <th className="px-3 py-3 text-right text-xs font-bold text-purple-300 uppercase">Amount</th>
                              <th className="px-3 py-3 w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {missingInVendor.map((inv) => (
                              <tr key={inv.id} className="border-t border-slate-700/30 hover:bg-purple-900/10 transition-colors">
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={inv.selected}
                                    onChange={() => toggleSelection(inv.id, 'vendor')}
                                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-purple-500"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="text"
                                    value={inv.entity || ''}
                                    onChange={(e) => updateInvoice(inv.id, 'vendor', 'entity', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                                    placeholder="Entity"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="text"
                                    value={inv.vendor || ''}
                                    onChange={(e) => updateInvoice(inv.id, 'vendor', 'vendor', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                                    placeholder="Vendor Name"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="text"
                                    value={inv.invoice}
                                    onChange={(e) => updateInvoice(inv.id, 'vendor', 'invoice', e.target.value)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-3 py-1">
                                  <input
                                    type="number"
                                    value={inv.amount}
                                    onChange={(e) => updateInvoice(inv.id, 'vendor', 'amount', parseFloat(e.target.value) || 0)}
                                    className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white font-mono text-right focus:border-purple-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <button
                                    onClick={() => deleteRow(inv.id, 'vendor')}
                                    className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="p-12 text-center text-slate-400">
                        <FileX size={48} className="mx-auto mb-4 opacity-50" />
                        <p>No missing invoices in Vendor statement</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
