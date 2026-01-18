import React, { useState, useRef, useEffect } from 'react';
import { Invoice, FlowStage, FlowType, Attachment, Evidence, TeamView } from '../types';
import { FLOW_CONFIG, TEAM_STAGES, getStageOwner } from '../constants';
import { X, CheckCircle2, Clock, Mail, ShieldCheck, Send, Building2, FileText, Image as ImageIcon, FileSpreadsheet, File, ArrowRight, Users, Lock, UserCircle, History, Layers, Paperclip, ChevronRight, Zap, Euro, Landmark, Inbox, Edit, Save, XCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from './ui/Badge';
import api, { downloadFile } from '../lib/api';

interface InvoiceDetailProps {
  invoice: Invoice;
  activeView: TeamView;
  onClose: () => void;
  onUpdateStage: (invoiceId: string, newStage: FlowStage) => void;
  onUpdateInvoice: (invoiceId: string, updates: Partial<Invoice>) => void;
  onAddEvidence: (invoiceId: string, evidence: any) => void;
  onPaymentValidate: (invoiceId: string, comments: string, attachments: Attachment[]) => void;
  onRequestPayment: (invoiceId: string) => void;
}

const getFileIcon = (type: Attachment['type']) => {
  switch (type) {
    case 'IMAGE': return <ImageIcon size={14} className="text-purple-400" />;
    case 'EXCEL': return <FileSpreadsheet size={14} className="text-emerald-400" />;
    case 'PDF': return <FileText size={14} className="text-red-400" />;
    default: return <File size={14} className="text-slate-400" />;
  }
};

export const InvoiceDetail: React.FC<InvoiceDetailProps> = ({
  invoice,
  activeView,
  onClose,
  onUpdateStage,
  onUpdateInvoice,
  onAddEvidence,
  onPaymentValidate,
  onRequestPayment
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
  const [paymentFiles, setPaymentFiles] = useState<File[]>([]);
  const paymentFileRef = useRef<HTMLInputElement>(null);
  const [evidence, setEvidence] = useState<Evidence[]>([]);
  const [paymentValidation, setPaymentValidation] = useState<any>(null);
  const [loadingEvidence, setLoadingEvidence] = useState(true);

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

  useEffect(() => {
    loadData();
  }, [invoice.id]);

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
       onUpdateStage(invoice.id, stage);
    } else {
       console.log('Stage progression blocked - not the next stage');
    }
  };

  const handlePaymentSubmit = async () => {
    try {
      // Upload files first if any
      let attachments: any[] = [];
      if (paymentFiles.length > 0) {
        const uploadResult = await api.upload(paymentFiles);
        attachments = uploadResult.files;
      }

      onPaymentValidate(invoice.id, paymentComment, attachments);
    } catch (error) {
      console.error('Error submitting payment validation:', error);
      alert('Failed to submit payment validation. Please try again.');
    }
  };

  const formatEuro = (val: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-[750px] bg-slate-900 border-l border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] transform transition-transform duration-300 ease-in-out z-50 flex flex-col font-sans overflow-hidden">
      
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
              <button onClick={() => setIsEditMode(true)} className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all">
                <Edit size={16} /> Edit
              </button>
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

                        return (
                          <button
                            key={stage}
                            disabled={!canAdvance}
                            onClick={() => onUpdateStage(invoice.id, targetStage)}
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
                {flowStages.map((stage, index) => {
                  const isCompleted = index < currentStageIndex;
                  const isCurrent = index === currentStageIndex;
                  const isNext = index === currentStageIndex + 1 && invoice.currentStage !== FlowStage.CLOSED;
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
                            {invoice.currentStage === FlowStage.MISSING_INVOICE_SENT_TO_AP ? (
                              <div className="mb-8 space-y-4">
                                <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] mb-2">AP Processing Options</p>
                                <div className="p-1 rounded-[2.2rem] bg-gradient-to-r from-brand-600 via-indigo-500 to-violet-600 shadow-[0_15px_40px_rgba(79,70,229,0.3)] animate-in zoom-in-95 duration-500">
                                  <button
                                    onClick={() => handleStageClick(stage, index)}
                                    className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                  >
                                    <div className="text-left">
                                      <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Continue Processing</p>
                                      <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">PO Pending</p>
                                    </div>
                                    <div className="bg-brand-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                      <ArrowRight size={24} />
                                    </div>
                                  </button>
                                </div>
                                <div className="p-1 rounded-[2.2rem] bg-gradient-to-r from-rose-600 via-red-500 to-orange-600 shadow-[0_15px_40px_rgba(225,29,72,0.3)] animate-in zoom-in-95 duration-500">
                                  <button
                                    onClick={() => onUpdateStage(invoice.id, FlowStage.MISSING_INVOICE_MISSING)}
                                    className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                  >
                                    <div className="text-left">
                                      <p className="text-[10px] font-black text-rose-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Send Back to Reconciliation</p>
                                      <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">Invoice Missing</p>
                                    </div>
                                    <div className="bg-rose-600 p-3 rounded-2xl shadow-xl group-hover:scale-110 transition-all">
                                      <ArrowRight size={24} className="rotate-180" />
                                    </div>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="mb-8 p-1 rounded-[2.2rem] bg-gradient-to-r from-brand-600 via-indigo-500 to-violet-600 shadow-[0_15px_40px_rgba(79,70,229,0.3)] animate-in zoom-in-95 duration-500">
                                <button
                                  onClick={() => handleStageClick(stage, index)}
                                  className="w-full bg-slate-950/95 hover:bg-transparent text-white px-8 py-5 rounded-[2rem] transition-all flex items-center justify-between group"
                                >
                                  <div className="text-left">
                                    <p className="text-[10px] font-black text-brand-400 uppercase tracking-[0.3em] group-hover:text-white transition-colors">Action Required</p>
                                    <p className="text-xl font-black tracking-tight group-hover:translate-x-1 transition-transform">Mark as {stage}</p>
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
                       {paymentValidation?.attachments?.map((f, i) => (
                         <button
                           key={i}
                           onClick={() => downloadFile(f.url, f.name)}
                           className="flex items-center gap-2 bg-slate-900/80 px-3 py-2 rounded-xl border border-emerald-900/20 hover:border-emerald-500 transition-colors cursor-pointer group/file"
                         >
                            {getFileIcon(f.type)}
                            <span className="text-[10px] font-bold text-slate-400 group-hover/file:text-emerald-400">{f.name}</span>
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

                       {/* Only show attachments for non-MANUAL invoices */}
                       {invoice.source !== 'MANUAL' && (
                         <>
                           {paymentFiles.length > 0 && (
                             <div className="flex flex-wrap gap-2 p-3 bg-slate-950 rounded-2xl border border-slate-800">
                               {paymentFiles.map((f, i) => (
                                 <div key={i} className="flex items-center gap-2 bg-slate-900 px-3 py-2 rounded-xl border border-slate-700">
                                    <File size={14} className="text-violet-400" />
                                    <span className="text-[10px] font-bold text-slate-300">{f.name}</span>
                                    <button onClick={() => setPaymentFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-600 hover:text-white ml-1">
                                      <X size={10} />
                                    </button>
                                 </div>
                               ))}
                             </div>
                           )}

                           <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
                              <button
                                onClick={() => paymentFileRef.current?.click()}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 text-xs font-black text-slate-300 hover:text-white transition-all bg-slate-800 px-6 py-4 rounded-2xl border border-slate-700 hover:bg-slate-700 uppercase tracking-widest"
                              >
                                 <Paperclip size={16} /> Attach Payout Proof
                              </button>
                              <input type="file" ref={paymentFileRef} className="hidden" multiple onChange={(e) => e.target.files && setPaymentFiles(Array.from(e.target.files))} />

                              <button
                                onClick={handlePaymentSubmit}
                                disabled={!paymentComment.trim() && paymentFiles.length === 0}
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
                  /* NONE or other status - button to move to Payment Queue (hidden for MANUAL invoices) */
                  <div className="bg-slate-900 border-2 border-dashed border-slate-800 p-12 rounded-[2.5rem] text-center group transition-all hover:border-emerald-500/30 shadow-xl">
                    <ShieldCheck size={56} className="text-slate-700 mx-auto mb-6 group-hover:text-emerald-500/50 transition-all group-hover:scale-110" />
                    <h4 className="text-xl font-black text-white mb-3">Workflow Posted</h4>
                    <p className="text-slate-500 text-sm mb-10 max-w-sm mx-auto font-medium">Posting phase is complete. Push to the Payment Hub to initiate final bank disbursement.</p>
                    <button onClick={() => onRequestPayment(invoice.id)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] transition-all shadow-2xl shadow-emerald-900/40 flex items-center gap-3 mx-auto hover:scale-105 active:scale-95 group">
                      Forward to Payment Queue <Inbox size={18} className="group-hover:-translate-y-1 transition-transform" />
                    </button>
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

const EvidenceSection = ({ evidence }: { evidence: Evidence[] }) => (
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
                onClick={(e) => {
                  e.stopPropagation();
                  downloadFile(file.url, file.name);
                }}
                className="flex items-center gap-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 hover:border-emerald-500 transition-colors cursor-pointer group/file"
              >
                {getFileIcon(file.type)}
                <span className="text-[10px] font-bold text-slate-500 group-hover/file:text-emerald-400 truncate max-w-[140px]">{file.name}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    ))}
  </div>
);

const StageInput: React.FC<{ stage: FlowStage; invoiceId: string; onAddEvidence: (id: string, data: any) => void; onAfterSubmit?: () => void; isCurrent: boolean; }> = ({ stage, invoiceId, onAddEvidence, onAfterSubmit, isCurrent }) => {
  const [text, setText] = useState('');
  const [isEmail, setIsEmail] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!text.trim() && files.length === 0) return;

    try {
      // Upload files first if any
      let attachments: any[] = [];
      if (files.length > 0) {
        const uploadResult = await api.upload(files);
        attachments = uploadResult.files;
      }

      await onAddEvidence(invoiceId, { type: isEmail ? 'EMAIL' : 'NOTE', content: text, attachments, createdBy: 'System User', stageAddedAt: stage });
      setText(''); setFiles([]); setIsEmail(false);

      // Reload evidence after submission
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
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {files.map((f, i) => (
              <div key={i} className="bg-slate-950 text-[10px] font-bold text-slate-400 px-3 py-1.5 rounded-full border border-slate-800 flex items-center gap-2">
                {f.name} <X size={10} className="cursor-pointer" onClick={() => setFiles(prev => prev.filter((_, idx) => idx !== i))} />
              </div>
            ))}
          </div>
        )}
        <textarea
          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:ring-2 focus:ring-brand-500/50 transition-all"
          rows={4}
          placeholder="Initial reason for tracking or communication thread context..."
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="flex items-center justify-between pt-2">
           <div className="flex gap-2">
              <button onClick={() => setIsEmail(!isEmail)} className={clsx("p-2 rounded-xl transition-colors", isEmail ? "bg-blue-600/20 text-blue-400" : "text-slate-500 hover:bg-slate-700 hover:text-slate-300")} title="Email Sync"><Mail size={16} /></button>
              <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:text-white hover:bg-slate-700 rounded-xl transition-colors"><Paperclip size={16} /></button>
              <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => e.target.files && setFiles(prev => [...prev, ...Array.from(e.target.files!)])} />
           </div>
           <button onClick={handleSubmit} disabled={!text.trim() && files.length === 0} className="bg-brand-600 hover:bg-brand-500 text-white px-6 py-2 rounded-xl transition-all shadow-lg shadow-brand-900/30 disabled:opacity-30 disabled:cursor-not-allowed font-bold text-xs uppercase tracking-wider flex items-center gap-2">
             <Send size={14} /> Post Note
           </button>
        </div>
      </div>
    </div>
  );
};