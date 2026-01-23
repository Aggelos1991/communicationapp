import React, { useState, useRef, useEffect } from 'react';
import { Invoice, FlowStage, FlowType, Attachment, Evidence, TeamView, ReconSession } from '../types';
import { FLOW_CONFIG, TEAM_STAGES, getStageOwner } from '../constants';
import { X, CheckCircle2, Clock, Mail, ShieldCheck, Send, Building2, FileText, ArrowRight, Users, UserCircle, History, Layers, ChevronRight, Zap, Euro, Landmark, Inbox, Edit, Save, XCircle, Undo2, Paperclip, Download, Loader2, FileArchive } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from './ui/Badge';
import api, { downloadFile } from '../lib/api';
import { compressFile, downloadCompressedFile, formatFileSize, MAX_ORIGINAL_SIZE } from '../lib/compression';
import pako from 'pako';

// Decompress base64 to blob for download (for ReconRaptor traceback)
const decompressBase64ToBlob = (base64: string, mimeType: string): Blob => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decompressed = pako.ungzip(bytes);
  return new Blob([decompressed], { type: mimeType });
};

interface InvoiceDetailProps {
  invoice: Invoice;
  activeView: TeamView;
  onClose: () => void;
  onUpdateStage: (invoiceId: string, newStage: FlowStage) => void;
  onUpdateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  onAddEvidence: (invoiceId: string, evidence: any) => void;
  onPaymentValidate: (invoiceId: string, comments: string, attachments: Attachment[]) => Promise<void>;
  onRequestPayment: (invoiceId: string) => void;
  onRevertStage?: (invoiceId: string) => void;
}

// All attachments are now URL links to save storage (no file uploads)

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  invoice,
  activeView,
  onClose,
  onUpdateStage,
  onUpdateInvoice,
  onAddEvidence,
  onPaymentValidate,
  onRequestPayment,
  onRevertStage
}) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [editData, setEditData] = useState({
    vendor: invoice.vendor,
    amount: invoice.amount || 0,
    entity: invoice.entity || '',
    poCreator: invoice.poCreator || '',
    sharepointUrl: invoice.sharepointUrl || ''
  });
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentAttachments, setPaymentAttachments] = useState<Attachment[]>([]);
  const [isPaymentCompressing, setIsPaymentCompressing] = useState(false);
  const paymentFileInputRef = useRef<HTMLInputElement>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [paymentValidation, setPaymentValidation] = useState<any>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(true);

  // ReconRaptor traceback - load session if this invoice came from ReconRaptor
  const [reconSession, setReconSession] = useState<ReconSession | null>(null);

  // Confirmation modal states
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    targetStage: FlowStage | null;
  }>({ isOpen: false, title: '', message: '', targetStage: null });

  // Load evidence and payment validation with attachments
  const loadData = async () => {
    setLoadingEvidence(true);
    try {
      const [evidenceData, paymentData] = await Promise.all([
        api.evidence.getByInvoiceId(invoice.id),
        api.paymentValidations.getByInvoiceId(invoice.id)
      ]);
      setEvidence(evidenceData || []);
      setPaymentValidation(paymentData);
    } catch (error) {
      console.error('Error loading evidence/payment:', error);
    } finally {
      setLoadingEvidence(false);
    }
  };

  // Load ReconRaptor session for traceback if this invoice came from RECON
  // Matches by: 1) reconSessionId if available, 2) vendor name match
  const loadReconSession = () => {
    if (invoice.source !== 'RECON') return;

    try {
      const sessions = JSON.parse(localStorage.getItem('reconSessions') || '[]') as ReconSession[];

      // First try to match by sessionId
      if (invoice.reconSessionId) {
        const sessionById = sessions.find(s => s.id === invoice.reconSessionId);
        if (sessionById) {
          setReconSession(sessionById);
          return;
        }
      }

      // Fallback: find by vendor name (case insensitive)
      // This ensures all invoices from same vendor point to same files
      const vendorLower = invoice.vendor?.toLowerCase().trim();
      if (vendorLower) {
        const sessionByVendor = sessions.find(s =>
          s.vendorName?.toLowerCase().trim() === vendorLower
        );
        if (sessionByVendor) {
          setReconSession(sessionByVendor);
          return;
        }
      }

      setReconSession(null);
    } catch (error) {
      console.error('Error loading recon session:', error);
    }
  };

  // Download source file from ReconRaptor session
  const downloadSourceFile = (type: 'erp' | 'vendor') => {
    if (!reconSession) return;

    try {
      const data = type === 'erp' ? reconSession.erpFileData : reconSession.vendorFileData;
      const fileName = type === 'erp' ? reconSession.erpFileName : reconSession.vendorFileName;
      const mimeType = fileName.endsWith('.xlsx')
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/vnd.ms-excel';

      const blob = decompressBase64ToBlob(data, mimeType);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading source file:', error);
      alert('Failed to download file');
    }
  };

  useEffect(() => {
    loadData();
    loadReconSession();
  }, [invoice.id, invoice.vendor]);

  const handleSaveEdit = () => {
    onUpdateInvoice(invoice.id, editData);
    setIsEditMode(false);
  };

  const handleCancelEdit = () => {
    setEditData({
      vendor: invoice.vendor,
      amount: invoice.amount || 0,
      entity: invoice.entity || '',
      poCreator: invoice.poCreator || '',
      sharepointUrl: invoice.sharepointUrl || ''
    });
    setIsEditMode(false);
  };

  const flowStages = FLOW_CONFIG[invoice.flowType];
  const currentStageIndex = flowStages.indexOf(invoice.currentStage);

  const isFlowHidden = invoice.source === 'MANUAL';

  // Check if invoice can be reverted (not at initial stage)
  const canRevert = currentStageIndex > 0;
  
  // Show confirmation modal for specific stages
  const showStageConfirmation = (stage: FlowStage, title: string, message: string) => {
    setConfirmModal({ isOpen: true, title, message, targetStage: stage });
  };

  // Confirm and proceed with stage change
  const handleConfirmStageChange = () => {
    if (confirmModal.targetStage) {
      onUpdateStage(invoice.id, confirmModal.targetStage);
    }
    setConfirmModal({ isOpen: false, title: '', message: '', targetStage: null });
  };

  // Cancel confirmation
  const handleCancelConfirmation = () => {
    setConfirmModal({ isOpen: false, title: '', message: '', targetStage: null });
  };

  const handleStageClick = (stage: FlowStage, index: number) => {
    console.log('Stage button clicked:', {
      stage,
      index,
      currentStage: invoice.currentStage,
      currentStageIndex,
      isNextStage: index === currentStageIndex + 1,
      isFlowHidden,
      canProgress: index > currentStageIndex
    });

    if (invoice.currentStage === FlowStage.CLOSED) return;

    // Allow jumping to CLOSED from PO_CREATED or EXR_CREATED
    const canJumpToClosed = stage === FlowStage.CLOSED &&
      (invoice.currentStage === FlowStage.PO_PENDING_CREATED ||
       invoice.currentStage === FlowStage.PO_PENDING_EXR_CREATED);

    if (index === currentStageIndex + 1 || (isFlowHidden && index > currentStageIndex) || canJumpToClosed) {
       console.log('Calling onUpdateStage with:', invoice.id, stage);

       // Add confirmation for PO Email Sent, PO Created, Posted, and EXR Created stages
       if (stage === FlowStage.PO_PENDING_SENT) {
         showStageConfirmation(
           stage,
           'Confirm PO Email Sent',
           `Are you sure you want to mark invoice ${invoice.invoiceNumber} as "PO Email Sent"? This indicates the PO process has started.`
         );
       } else if (stage === FlowStage.PO_PENDING_CREATED) {
         showStageConfirmation(
           stage,
           'Confirm PO Created',
           `Are you sure you want to mark invoice ${invoice.invoiceNumber} as PO Created? This confirms the Purchase Order has been successfully created.`
         );
       } else if (stage === FlowStage.MISSING_INVOICE_POSTED) {
         showStageConfirmation(
           stage,
           'Confirm PO Created & Posted',
           `Are you sure you want to mark invoice ${invoice.invoiceNumber} as PO Created & Posted? This confirms the Purchase Order has been created and invoice is posted.`
         );
       } else if (stage === FlowStage.PO_PENDING_EXR_CREATED) {
         showStageConfirmation(
           stage,
           'Confirm EXR Created',
           `Are you sure you want to mark invoice ${invoice.invoiceNumber} as EXR Created? This confirms the Expense Report has been successfully created.`
         );
       } else {
         onUpdateStage(invoice.id, stage);
       }
    } else {
       console.log('Stage progression blocked - not the next stage');
    }
  };

  const handlePaymentSubmit = async () => {
    try {
      await onPaymentValidate(invoice.id, paymentComment, paymentAttachments);
      // Clear form after successful submission
      setPaymentComment('');
      setPaymentAttachments([]);
    } catch (error) {
      console.error('Error submitting payment validation:', error);
      alert('Failed to submit payment validation. Please try again.');
    }
  };

  const handlePaymentFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsPaymentCompressing(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ORIGINAL_SIZE) {
          alert(`File "${file.name}" is too large. Maximum size is ${MAX_ORIGINAL_SIZE / 1024 / 1024}MB`);
          continue;
        }
        const compressed = await compressFile(file);
        const attachment: Attachment = {
          id: `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: compressed.originalName,
          mimeType: compressed.mimeType,
          data: compressed.data,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize
        };
        setPaymentAttachments(prev => [...prev, attachment]);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to compress file');
    } finally {
      setIsPaymentCompressing(false);
      if (paymentFileInputRef.current) paymentFileInputRef.current.value = '';
    }
  };

  const formatEuro = (val: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[750px] bg-slate-900 border-l border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] transform transition-transform duration-300 ease-in-out z-50 flex flex-col font-sans overflow-hidden">

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60] animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl p-8 max-w-md w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-brand-600/20 p-3 rounded-2xl">
                <CheckCircle2 size={28} className="text-brand-500" />
              </div>
              <h3 className="text-xl font-black text-white">{confirmModal.title}</h3>
            </div>
            <p className="text-slate-300 mb-8 leading-relaxed">{confirmModal.message}</p>
            <div className="flex gap-4">
              <button
                onClick={handleCancelConfirmation}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-wide transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmStageChange}
                className="flex-1 bg-brand-600 hover:bg-brand-500 text-white py-4 rounded-2xl font-bold text-sm uppercase tracking-wide transition-all shadow-lg shadow-brand-900/30"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Panel */}
      <div className="px-8 py-8 border-b border-slate-800 bg-slate-900/50 backdrop-blur-md z-10">
        <div className="flex justify-between items-start">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-slate-800 p-2 rounded-xl border border-slate-700 shadow-inner">
                <FileText className="text-brand-400" size={24} />
              </div>
              <div>
                <h2 className="text-3xl font-black text-white tracking-tighter leading-none">{invoice.invoiceNumber}</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">{invoice.source} Entry System</p>
              </div>
              <div className="ml-4 flex items-center gap-2">
                 <Badge stage={invoice.currentStage} />
                 {invoice.paymentStatus === 'REQUESTED' && (
                   <span className="flex items-center gap-1.5 bg-violet-500/10 text-violet-400 border border-violet-500/20 px-2.5 py-1 rounded-full text-[10px] font-black uppercase animate-pulse">
                     <Euro size={12} /> Awaiting Payment
                   </span>
                 )}
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
               <div className="flex items-center gap-2">
                  <UserCircle size={16} className="text-slate-600" />
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editData.vendor}
                      onChange={(e) => setEditData({...editData, vendor: e.target.value})}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm font-bold text-slate-200 focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="Vendor name"
                    />
                  ) : (
                    <span className="text-sm font-bold text-slate-200">{invoice.vendor}</span>
                  )}
               </div>
               <div className="flex items-center gap-2">
                  <Euro size={16} className="text-slate-600" />
                  {isEditMode ? (
                    <input
                      type="number"
                      value={editData.amount}
                      onChange={(e) => setEditData({...editData, amount: parseFloat(e.target.value) || 0})}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1 text-sm font-black text-emerald-400 font-mono w-32 focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="Amount"
                    />
                  ) : (
                    <span className="text-sm font-black text-emerald-400 font-mono">
                      {invoice.amount ? formatEuro(invoice.amount) : '0 EUR'}
                    </span>
                  )}
               </div>
               <div className="flex items-center gap-2 bg-slate-800/50 px-3 py-1 rounded-lg border border-slate-800">
                  <Building2 size={14} className="text-brand-500" />
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editData.entity}
                      onChange={(e) => setEditData({...editData, entity: e.target.value})}
                      className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-400 w-32 focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="Entity"
                    />
                  ) : (
                    <span className="text-xs font-bold text-slate-400">{invoice.entity || 'Unassigned'}</span>
                  )}
               </div>
               <div className="flex items-center gap-2 bg-orange-950/20 px-3 py-1 rounded-lg border border-orange-900/30">
                  <Users size={14} className="text-orange-500" />
                  {isEditMode ? (
                    <input
                      type="text"
                      value={editData.poCreator}
                      onChange={(e) => setEditData({...editData, poCreator: e.target.value})}
                      className="bg-orange-950/30 border border-orange-900/30 rounded-lg px-2 py-0.5 text-xs font-bold text-orange-300 w-32 focus:ring-2 focus:ring-brand-500 outline-none"
                      placeholder="PO Creator"
                    />
                  ) : invoice.poCreator ? (
                    <span className="text-xs font-bold text-orange-300">{invoice.poCreator}</span>
                  ) : (
                    <span className="text-xs font-bold text-orange-300/50">No PO Creator</span>
                  )}
               </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditMode ? (
              <>
                <button onClick={handleSaveEdit} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  <Save size={16} /> Save
                </button>
                <button onClick={handleCancelEdit} className="flex items-center gap-2 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  <XCircle size={16} /> Cancel
                </button>
              </>
            ) : (
              <>
                {onRevertStage && canRevert && (
                  <button
                    onClick={() => onRevertStage(invoice.id)}
                    className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                    title="Revert to previous stage"
                  >
                    <Undo2 size={16} /> Revert
                  </button>
                )}
                <button onClick={() => setIsEditMode(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                  <Edit size={16} /> Edit
                </button>
              </>
            )}
            <button onClick={onClose} className="text-slate-600 hover:text-white transition-all p-2 hover:bg-slate-800 rounded-2xl">
              <X size={28} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col bg-slate-950">
        
        {/* Status Context Sub-header */}
        <div className="bg-slate-900/30 border-b border-slate-800 px-8 py-3 flex items-center justify-between">
           <div className="flex items-center gap-2 text-slate-500">
              {isFlowHidden ? <Layers size={14} /> : <History size={14} />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {isFlowHidden ? 'Manual AP Access' : 'Tracking Lifecycle'}
              </span>
           </div>
           {invoice.statusDetail && invoice.statusDetail !== 'NONE' && (
              <div className={clsx(
                "px-2.5 py-1 rounded-lg text-[10px] font-black border uppercase tracking-widest",
                invoice.statusDetail === 'EXR PENDING' ? "bg-cyan-900/20 border-cyan-800 text-cyan-400" : "bg-rose-900/20 border-rose-800 text-rose-400"
              )}>
                {invoice.statusDetail}
              </div>
            )}
        </div>

        {/* ReconRaptor Traceback Section - shows source files for RECON invoices */}
        {invoice.source === 'RECON' && reconSession && (
          <div className="bg-gradient-to-r from-amber-950/30 to-slate-900 border-b border-amber-900/30 px-8 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-amber-600/20 p-2 rounded-xl border border-amber-600/30">
                  <FileArchive size={18} className="text-amber-500" />
                </div>
                <div>
                  <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em]">ReconRaptor Source Files</p>
                  <p className="text-xs text-slate-400">Vendor: <span className="font-bold text-white">{reconSession.vendorName}</span></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadSourceFile('erp')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 px-4 py-2.5 rounded-xl transition-all group"
                >
                  <Download size={14} className="text-amber-500" />
                  <div className="text-left">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">ERP Export</p>
                    <p className="text-[10px] font-bold text-slate-300 group-hover:text-white truncate max-w-[120px]">{reconSession.erpFileName}</p>
                  </div>
                </button>
                <button
                  onClick={() => downloadSourceFile('vendor')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-amber-500/50 px-4 py-2.5 rounded-xl transition-all group"
                >
                  <Download size={14} className="text-amber-500" />
                  <div className="text-left">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Vendor Statement</p>
                    <p className="text-[10px] font-bold text-slate-300 group-hover:text-white truncate max-w-[120px]">{reconSession.vendorFileName}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto px-8 py-8 scrollbar-thin">
          <div className="max-w-3xl mx-auto space-y-12">
            
            {isFlowHidden ? (
              <div className="space-y-10">
                <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-2xl relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-5">
                    <Zap size={100} className="text-amber-500" />
                  </div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] mb-6">Workflow Progression Hub</p>
                    <div className="grid grid-cols-2 gap-3">
                      {flowStages.map((stage, idx) => {
                        const isActive = stage === invoice.currentStage;
                        const canAdvance = idx > currentStageIndex && invoice.currentStage !== FlowStage.CLOSED;

                        // Custom labels for Direct Entries: ALWAYS show "& CLOSED" for PO CREATED and EXR CREATED
                        let displayLabel = stage;
                        let targetStage = stage;

                        if (stage === FlowStage.PO_PENDING_CREATED) {
                          displayLabel = 'PO CREATED & CLOSED';
                          targetStage = FlowStage.CLOSED; // Clicking goes to CLOSED
                        } else if (stage === FlowStage.PO_PENDING_EXR_CREATED) {
                          displayLabel = 'EXR CREATED & CLOSED';
                          targetStage = FlowStage.CLOSED; // Clicking goes to CLOSED
                        }

                        // Handler for MANUAL flow stage clicks with confirmation
                        const handleManualStageClick = () => {
                          if (stage === FlowStage.PO_PENDING_SENT) {
                            showStageConfirmation(
                              targetStage,
                              'Confirm PO Email Sent',
                              `Are you sure you want to move invoice ${invoice.invoiceNumber} to "PO Email Sent" status?`
                            );
                          } else if (stage === FlowStage.PO_PENDING_CREATED || stage === FlowStage.PO_PENDING_EXR_CREATED) {
                            showStageConfirmation(
                              targetStage,
                              stage === FlowStage.PO_PENDING_CREATED ? 'Confirm PO Created & Close' : 'Confirm EXR Created & Close',
                              `Are you sure you want to mark invoice ${invoice.invoiceNumber} as ${displayLabel}? This will close the invoice.`
                            );
                          } else {
                            onUpdateStage(invoice.id, targetStage);
                          }
                        };

                        return (
                          <button
                            key={stage}
                            disabled={!canAdvance}
                            onClick={handleManualStageClick}
                            className={clsx(
                              "group relative px-5 py-4 rounded-2xl text-[11px] font-black uppercase tracking-wider transition-all border flex items-center justify-between overflow-hidden",
                              isActive ? "bg-amber-600 border-amber-500 text-white shadow-[0_10px_30px_rgba(217,119,6,0.3)] ring-2 ring-amber-600/20" :
                              canAdvance ? "bg-slate-800 border-slate-700 text-slate-300 hover:border-amber-500/50 hover:bg-slate-800/80 hover:scale-[1.02] shadow-xl" :
                              "bg-slate-900/40 border-slate-800/50 text-slate-700 opacity-40 cursor-not-allowed"
                            )}
                          >
                            <span className="relative z-10">{displayLabel}</span>
                            {canAdvance && <ChevronRight size={16} className="text-amber-500 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />}
                            {isActive && <CheckCircle2 size={16} className="text-white/80" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="space-y-6 mt-10">
                  <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-6 shadow-xl">
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">COMMUNICATION / NOTES</p>
                     <StageInput stage={invoice.currentStage} invoiceId={invoice.id} onAddEvidence={onAddEvidence} onAfterSubmit={loadData} isCurrent={true} />
                  </div>
                  <div className="flex items-center justify-between px-2">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-[0.3em] flex items-center gap-2">
                       <History size={14} /> Communication History
                     </h3>
                  </div>
                  <EvidenceSection evidence={evidence} />
                </div>
              </div>
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-6 top-6 bottom-0 w-0.5 bg-slate-800 z-0"></div>
                {flowStages.filter(s => s !== FlowStage.CLOSED).map((stage, index) => {
                  const filteredStages = flowStages.filter(s => s !== FlowStage.CLOSED);
                  const filteredCurrentIndex = filteredStages.indexOf(invoice.currentStage);
                  const isCompleted = index < filteredCurrentIndex;
                  const isCurrent = index === filteredCurrentIndex;
                  const isNext = index === filteredCurrentIndex + 1 && invoice.currentStage !== FlowStage.CLOSED;
                  const stageEvidence = evidence.filter(e => e.stageAddedAt === stage);
                  
                  return (
                    <div key={stage} className="relative z-10 flex gap-8 pb-12 last:pb-0">
                      <div className={clsx(
                        "w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shrink-0 bg-slate-900 shadow-2xl",
                        isCompleted ? "border-emerald-500/30 text-emerald-500 shadow-emerald-900/20" :
                        isCurrent ? "border-brand-500 text-brand-500 ring-4 ring-brand-500/10 shadow-brand-900/40" :
                        isNext ? "border-brand-500/20 text-brand-500/40 animate-pulse" :
                        "border-slate-800 text-slate-700"
                      )}>
                        {isCompleted ? <CheckCircle2 size={24} /> : isCurrent ? <Clock size={24} className="animate-pulse" /> : <div className="w-2 h-2 rounded-full bg-current" />}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="flex items-center justify-between mb-4">
                           <h4 className={clsx("text-lg font-black tracking-tight", isCurrent ? "text-white" : isNext ? "text-slate-400" : "text-slate-500")}>
                             {stage}
                             {isNext && <span className="ml-3 text-[10px] font-black text-brand-500 uppercase tracking-widest bg-brand-500/10 px-2 py-0.5 rounded">Awaiting Action</span>}
                           </h4>
                        </div>
                        
                        {isNext && (
                          <>
                            {invoice.currentStage === FlowStage.MISSING_INVOICE_SENT_TO_VENDOR ? (
                              <div className="mb-8 p-1 rounded-[2.2rem] bg-gradient-to-r from-brand-600 via-indigo-500 to-violet-600 shadow-[0_15px_40px_rgba(79,70,229,0.3)] animate-in zoom-in-95 duration-500">
                                <button
                                  onClick={() => onUpdateStage(invoice.id, FlowStage.MISSING_INVOICE_PO_PENDING)}
                                  className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                >
                                  <div className="text-left">
                                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Invoice Received from Vendor</p>
                                    <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">PO Pending</p>
                                  </div>
                                  <div className="bg-brand-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                    <ArrowRight size={24} />
                                  </div>
                                </button>
                              </div>
                            ) : invoice.currentStage === FlowStage.MISSING_INVOICE_PO_PENDING ? (
                              <div className="mb-8 p-1 rounded-[2.2rem] bg-gradient-to-r from-emerald-600 via-green-500 to-teal-600 shadow-[0_15px_40px_rgba(16,185,129,0.3)] animate-in zoom-in-95 duration-500">
                                <button
                                  onClick={() => showStageConfirmation(
                                    FlowStage.MISSING_INVOICE_POSTED,
                                    'Confirm PO Created & Posted',
                                    `Are you sure you want to mark invoice ${invoice.invoiceNumber} as PO Created & Posted? This confirms the Purchase Order has been successfully created and the invoice is posted.`
                                  )}
                                  className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                >
                                  <div className="text-left">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Purchase Order Created & Posted</p>
                                    <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">PO Created & Posted</p>
                                  </div>
                                  <div className="bg-emerald-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                    <CheckCircle2 size={24} />
                                  </div>
                                </button>
                              </div>
                            ) : (invoice.currentStage === FlowStage.MISSING_INVOICE_MISSING || invoice.currentStage === FlowStage.MISSING_INVOICE_SENT_TO_VENDOR) && activeView === 'RECON' ? (
                              <div className="space-y-3 mb-8">
                                {/* Send to Vendor button - sends to AP with "Sent to Vendor" stage */}
                                <div className="p-1 rounded-[2.2rem] bg-gradient-to-r from-amber-600 via-orange-500 to-yellow-600 shadow-[0_15px_40px_rgba(245,158,11,0.3)] animate-in zoom-in-95 duration-500">
                                  <button
                                    onClick={() => onUpdateStage(invoice.id, FlowStage.MISSING_INVOICE_SENT_TO_VENDOR)}
                                    className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-4 rounded-[2rem] transition-all flex items-center justify-between group"
                                  >
                                    <div className="text-left">
                                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Request Invoice from Supplier</p>
                                      <p className="text-lg font-black tracking-tight group-hover:translate-x-1 transition-transform">Send to Vendor</p>
                                    </div>
                                    <div className="bg-amber-600 p-2.5 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                      <Send size={20} />
                                    </div>
                                  </button>
                                </div>
                                {/* Send to AP Processing button */}
                                <div className="p-1 rounded-[2.2rem] bg-gradient-to-r from-purple-600 via-violet-500 to-indigo-600 shadow-[0_15px_40px_rgba(139,92,246,0.3)] animate-in zoom-in-95 duration-500">
                                  <button
                                    onClick={() => onUpdateStage(invoice.id, FlowStage.MISSING_INVOICE_SENT_TO_AP)}
                                    className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-4 rounded-[2rem] transition-all flex items-center justify-between group"
                                  >
                                    <div className="text-left">
                                      <p className="text-[10px] font-black text-purple-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Forward to AP Processing Team</p>
                                      <p className="text-lg font-black tracking-tight group-hover:translate-x-1 transition-transform">Send to AP Processing</p>
                                    </div>
                                    <div className="bg-purple-600 p-2.5 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                      <ArrowRight size={20} />
                                    </div>
                                  </button>
                                </div>
                              </div>
                            ) : invoice.currentStage === FlowStage.MISSING_INVOICE_POSTED && activeView === 'RECON' ? (
                              <div className="mb-8 p-1 rounded-[2.2rem] bg-gradient-to-r from-green-600 via-emerald-500 to-teal-600 shadow-[0_15px_40px_rgba(16,185,129,0.3)] animate-in zoom-in-95 duration-500">
                                <button
                                  onClick={() => onUpdateStage(invoice.id, FlowStage.CLOSED)}
                                  className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                >
                                  <div className="text-left">
                                    <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Complete Reconciliation</p>
                                    <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">Reconciliation Completed</p>
                                  </div>
                                  <div className="bg-emerald-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                    <CheckCircle2 size={24} />
                                  </div>
                                </button>
                              </div>
                            ) : (
                              <div className="mb-8 p-1 rounded-[2.2rem] bg-gradient-to-r from-brand-600 via-indigo-500 to-violet-600 shadow-[0_15px_40px_rgba(79,70,229,0.3)] animate-in zoom-in-95 duration-500">
                                <button
                                  onClick={() => handleStageClick(stage, index)}
                                  className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                >
                                  <div className="text-left">
                                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Action Required</p>
                                    <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">{stage === FlowStage.CLOSED ? 'Reconciliation Completed' : `Mark as ${stage}`}</p>
                                  </div>
                                  <div className="bg-brand-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                    <ArrowRight size={24} />
                                  </div>
                                </button>
                              </div>
                            )}
                          </>
                        )}

                        <EvidenceSection evidence={stageEvidence} />
                        {(isCurrent || isCompleted) && (
                          <StageInput stage={stage} invoiceId={invoice.id} onAddEvidence={onAddEvidence} onAfterSubmit={loadData} isCurrent={isCurrent} />
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Reconciliation Completed Section - shows when invoice is at Posted stage */}
                {invoice.currentStage === FlowStage.MISSING_INVOICE_POSTED && activeView === 'RECON' && (
                  <div className="relative z-10 flex gap-8 pb-12">
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-all duration-500 shrink-0 bg-slate-900 shadow-2xl border-emerald-500/20 text-emerald-500/40 animate-pulse">
                      <CheckCircle2 size={24} />
                    </div>
                    <div className="flex-1 pt-1">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-black tracking-tight text-slate-400">
                          Reconciliation Completed
                          <span className="ml-3 text-[10px] font-black text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded">Final Step</span>
                        </h4>
                      </div>
                      <div className="mb-8 p-1 rounded-[2.2rem] bg-gradient-to-r from-green-600 via-emerald-500 to-teal-600 shadow-[0_15px_40px_rgba(16,185,129,0.3)] animate-in zoom-in-95 duration-500">
                        <button
                          onClick={() => onUpdateStage(invoice.id, FlowStage.CLOSED)}
                          className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                        >
                          <div className="text-left">
                            <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Complete Reconciliation</p>
                            <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">Reconciliation Completed</p>
                          </div>
                          <div className="bg-emerald-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                            <CheckCircle2 size={24} />
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Payment Section */}
            {invoice.currentStage === FlowStage.CLOSED && (
              <div className="mt-12 pt-12 border-t border-slate-800">
                {invoice.paymentStatus === 'PAID' ? (
                  <div className="bg-emerald-950/20 border border-emerald-900/30 p-8 rounded-3xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                       <ShieldCheck size={100} className="text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-3 mb-6">
                       <CheckCircle2 className="text-emerald-500" size={24} />
                       <h4 className="text-xl font-black text-emerald-400 tracking-tight uppercase">Disbursement Verified</h4>
                    </div>
                    <p className="text-slate-300 italic mb-6 border-l-4 border-emerald-500/30 pl-4 py-2 bg-emerald-500/5 rounded-r-xl">"{paymentValidation?.comments}"</p>
                    <div className="flex flex-wrap gap-2">
                       {paymentValidation?.attachments?.map((f: Attachment, i: number) => (
                         <button
                           key={i}
                           onClick={() => downloadCompressedFile(f.data, f.name, f.mimeType)}
                           className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-emerald-900/20 hover:border-emerald-500 transition-colors cursor-pointer group/file"
                         >
                            <Paperclip size={14} className="text-emerald-400" />
                            <span className="text-[10px] font-bold text-slate-400 group-hover/file:text-emerald-400">{f.name}</span>
                            <span className="text-[8px] text-emerald-600">({formatFileSize(f.compressedSize)})</span>
                            <Download size={10} className="text-emerald-500" />
                         </button>
                       ))}
                    </div>
                  </div>
                ) : invoice.paymentStatus === 'REQUESTED' ? (
                  /* ALWAYS show validation hub if in REQUESTED status, removing view-based locking */
                  <div className="bg-slate-900 border-2 border-violet-500/40 rounded-[2.5rem] shadow-2xl overflow-hidden ring-4 ring-violet-500/5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-gradient-to-r from-violet-600/30 to-slate-900 p-8 border-b border-violet-500/20 flex justify-between items-center">
                       <div className="flex items-center gap-4">
                          <div className="p-3 bg-violet-600 rounded-2xl shadow-lg">
                            <Landmark size={24} className="text-white" />
                          </div>
                          <div>
                            <h4 className="font-black text-xl text-white tracking-tight leading-none uppercase">Treasury Payment Entry</h4>
                            <p className="text-[10px] text-violet-400 font-black uppercase tracking-[0.3em] mt-2">Final Disbursement Action</p>
                          </div>
                       </div>
                    </div>
                    <div className="p-8 space-y-6">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Payment Reply / Note</label>
                          <textarea
                              className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-5 text-sm text-white focus:ring-2 focus:ring-violet-500/50 outline-none min-h-[140px] placeholder-slate-700 transition-all shadow-inner"
                              placeholder="Add bank reference or final payout comments..."
                              value={paymentComment}
                              onChange={(e) => setPaymentComment(e.target.value)}
                          />
                       </div>

                       {/* Compressed file attachments for payment proof */}
                       {invoice.source !== 'MANUAL' && (
                         <>
                           {paymentAttachments.length > 0 && (
                             <div className="flex flex-wrap gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                               {paymentAttachments.map((att) => (
                                 <div key={att.id} className="flex items-center gap-2 bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-900/50">
                                    <Paperclip size={14} className="text-emerald-400" />
                                    <span className="text-[10px] font-bold text-emerald-300 truncate max-w-[120px]">{att.name}</span>
                                    <span className="text-[8px] text-emerald-600">({formatFileSize(att.compressedSize)})</span>
                                    <button onClick={() => setPaymentAttachments(prev => prev.filter(a => a.id !== att.id))} className="text-slate-600 hover:text-red-400 ml-1">
                                      <X size={10} />
                                    </button>
                                 </div>
                               ))}
                             </div>
                           )}

                           <input type="file" ref={paymentFileInputRef} onChange={handlePaymentFileSelect} className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.msg,.eml" />

                           <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                              <button
                                onClick={() => paymentFileInputRef.current?.click()}
                                disabled={isPaymentCompressing}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-black text-slate-300 hover:text-white transition-all bg-slate-800 px-6 py-4 rounded-2xl border border-slate-700 hover:bg-slate-700 uppercase tracking-widest"
                              >
                                 {isPaymentCompressing ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />} Attach Proof
                              </button>

                              <button
                                onClick={handlePaymentSubmit}
                                disabled={!paymentComment.trim() && paymentAttachments.length === 0}
                                className="flex-1 w-full flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-violet-900/40 transition-all hover:scale-[1.02] active:scale-95 group"
                              >
                                Confirm Payment & Return to Reconciliation <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                              </button>
                           </div>
                         </>
                       )}

                       {/* For MANUAL invoices, show only submit button */}
                       {invoice.source === 'MANUAL' && (
                         <div className="pt-4">
                           <button
                             onClick={handlePaymentSubmit}
                             disabled={!paymentComment.trim()}
                             className="w-full flex items-center justify-center gap-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-30 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-violet-900/40 transition-all hover:scale-[1.02] active:scale-95 group"
                           >
                             Confirm Payment & Return to Reconciliation <Send size={18} className="group-hover:translate-x-1 transition-transform" />
                           </button>
                         </div>
                       )}
                    </div>
                  </div>
                ) : invoice.source !== 'MANUAL' ? (
                  /* Reconciliation Completed with optional Treasury Payment Entry */
                  <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/30 border-2 border-emerald-500/20 p-12 rounded-[2.5rem] text-center shadow-2xl shadow-emerald-900/10">
                    <ShieldCheck size={64} className="text-emerald-500 mx-auto mb-6" />
                    <h4 className="text-3xl font-black bg-gradient-to-r from-emerald-400 via-green-300 to-emerald-400 bg-clip-text text-transparent mb-2 tracking-tight">Reconciliation Completed</h4>
                    <p className="text-slate-500 text-sm font-medium mb-8">This invoice has been fully reconciled</p>
                    <button onClick={() => onRequestPayment(invoice.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-sm uppercase tracking-wider transition-all shadow-2xl shadow-emerald-900/40 flex items-center gap-3 mx-auto hover:scale-105 active:scale-95">
                      <Inbox size={18} /> Send to Treasury Payment Entry
                    </button>
                    <p className="text-slate-600 text-xs mt-4 italic">Optional</p>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const EvidenceSection = ({ evidence }: { evidence: Evidence[] }) => {
  const handleDownload = (attachment: Attachment) => {
    try {
      downloadCompressedFile(attachment.data, attachment.name, attachment.mimeType);
    } catch (error) {
      alert('Failed to download file');
    }
  };

  return (
    <div className="space-y-4">
      {evidence.length === 0 && <p className="text-center py-6 text-slate-600 text-xs italic">No activity entries yet.</p>}
      {evidence.map(ev => (
        <div key={ev.id} className="bg-slate-900/40 border border-slate-800/50 rounded-2xl p-4 shadow-sm relative group transition-all hover:bg-slate-900 hover:border-slate-700">
          <div className="flex justify-between items-center mb-3">
             <div className="flex items-center gap-2">
                <span className={clsx("text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-widest", ev.type === 'EMAIL' ? "bg-blue-900/40 text-blue-400" : "bg-slate-800 text-slate-500")}>{ev.type}</span>
                <span className="text-[10px] font-bold text-slate-500">{ev.createdBy}</span>
             </div>
             <span className="text-[10px] font-mono text-slate-700">{new Date(ev.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <p className="text-sm text-slate-300 leading-relaxed pl-1">{ev.content}</p>
          {ev.attachments && ev.attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pl-1">
              {ev.attachments.map((file, idx) => (
                <button
                  key={idx}
                  onClick={() => handleDownload(file)}
                  className="flex items-center gap-2 bg-emerald-950/30 px-3 py-2 rounded-xl border border-emerald-900/50 hover:border-emerald-500 transition-colors cursor-pointer group/file"
                >
                  <Paperclip size={14} className="text-emerald-400" />
                  <span className="text-[10px] font-bold text-emerald-300 group-hover/file:text-emerald-200 truncate max-w-[140px]">{file.name}</span>
                  <span className="text-[8px] text-emerald-600">({formatFileSize(file.compressedSize)})</span>
                  <Download size={10} className="text-emerald-500" />
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

// Compressed file attachments to save storage
const StageInput: React.FC<{ stage: FlowStage; invoiceId: string; onAddEvidence: (id: string, data: any) => void; onAfterSubmit?: () => void; isCurrent: boolean; }> = ({ stage, invoiceId, onAddEvidence, onAfterSubmit, isCurrent }) => {
  const [text, setText] = useState('');
  const [isEmail, setIsEmail] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isCompressing, setIsCompressing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsCompressing(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > MAX_ORIGINAL_SIZE) {
          alert(`File "${file.name}" is too large. Maximum size is ${MAX_ORIGINAL_SIZE / 1024 / 1024}MB`);
          continue;
        }
        const compressed = await compressFile(file);
        const attachment: Attachment = {
          id: `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: compressed.originalName,
          mimeType: compressed.mimeType,
          data: compressed.data,
          originalSize: compressed.originalSize,
          compressedSize: compressed.compressedSize
        };
        setAttachments(prev => [...prev, attachment]);
      }
    } catch (error: any) {
      alert(error.message || 'Failed to compress file');
    } finally {
      setIsCompressing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!text.trim() && attachments.length === 0) return;

    try {
      await onAddEvidence(invoiceId, {
        type: isEmail ? 'EMAIL' : 'NOTE',
        content: text,
        attachments: attachments.length > 0 ? attachments : undefined,
        createdBy: 'System User',
        stageAddedAt: stage
      });
      setText(''); setIsEmail(false); setAttachments([]);

      if (onAfterSubmit) {
        await onAfterSubmit();
      }
    } catch (error) {
      console.error('Error submitting evidence:', error);
      alert('Failed to submit evidence. Please try again.');
    }
  };

  return (
    <div className={clsx("mt-4 transition-all rounded-2xl", isCurrent ? "bg-slate-800/50 border border-slate-700" : "opacity-40 hover:opacity-100")}>
      <div className="p-5 space-y-4">
        {/* Attachments preview */}
        {attachments.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div key={att.id} className="bg-emerald-950/30 text-[10px] font-bold text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-900/50 flex items-center gap-2">
                <Paperclip size={10} />
                <span className="truncate max-w-[120px]">{att.name}</span>
                <span className="text-emerald-600">({formatFileSize(att.compressedSize)})</span>
                <X size={10} className="cursor-pointer hover:text-red-400" onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))} />
              </div>
            ))}
          </div>
        )}

        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          rows={4}
          placeholder="Add note or description..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="flex items-center justify-between pt-2">
           <div className="flex gap-2">
              <button onClick={() => setIsEmail(!isEmail)} className={clsx("p-2 rounded-xl transition-colors", isEmail ? "bg-blue-600/20 text-blue-400" : "text-slate-500 hover:bg-slate-700 hover:text-slate-300")} title="Mark as Email"><Mail size={16} /></button>
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.msg,.eml" />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isCompressing}
                className={clsx("p-2 rounded-xl transition-colors", attachments.length > 0 ? "bg-emerald-600/20 text-emerald-400" : "text-slate-500 hover:bg-slate-700 hover:text-slate-300")}
                title="Attach file (compressed)"
              >
                {isCompressing ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
              </button>
           </div>
           <button onClick={handleSubmit} disabled={!text.trim() && attachments.length === 0} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-xl transition-all shadow-lg shadow-brand-900/30 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-wider flex items-center gap-2">
             <Send size={14} /> Post Note
           </button>
        </div>
      </div>
    </div>
  );
};