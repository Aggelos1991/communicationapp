import React, { useState, useMemo, useRef } from 'react';
import { Invoice, TeamView, FlowStage, FlowType, Attachment } from '../types';
import { FLOW_CONFIG, TEAM_STAGES } from '../constants';
import { Badge } from './ui/Badge';
import { ChevronRight, FileText, MessageSquare, Building2, UserCircle, Clock, Link as LinkIcon, ExternalLink, Trash2, Filter, X, Edit, Ban, CheckCircle, Download, ArrowRight, Send, Undo2, Paperclip, Mail, Loader2 } from 'lucide-react';
import { clsx } from 'clsx';
import { exportToExcel } from '../lib/exportExcel';
import { compressFile, downloadCompressedFile, formatFileSize, MAX_ORIGINAL_SIZE } from '../lib/compression';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  activeView?: TeamView;
  onTogglePaymentBlocked?: (id: string, blocked: boolean) => void;
  onBulkUpdatePaymentBlocked?: (ids: string[], blocked: boolean) => void;
  onBulkUpdateStage?: (ids: string[], stage: FlowStage) => void;
  onBulkRequestPayment?: (ids: string[]) => void;
  onRevertStage?: (id: string) => void;
  onBulkRevertStage?: (ids: string[]) => void;
  onUpdateBlockEmail?: (id: string, reason: string, attachment?: Attachment) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onSelectInvoice, onDeleteInvoice, onBulkDelete, activeView, onTogglePaymentBlocked, onBulkUpdatePaymentBlocked, onBulkUpdateStage, onBulkRequestPayment, onRevertStage, onBulkRevertStage, onUpdateBlockEmail }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showBulkStageMenu, setShowBulkStageMenu] = useState(false);
  const [filters, setFilters] = useState({
    entity: 'ALL',
    vendor: 'ALL',
    poOwner: 'ALL',
    status: 'ALL',
    statusDetail: 'ALL',
  });

  // Block email modal state
  const [blockEmailModal, setBlockEmailModal] = useState<{
    isOpen: boolean;
    invoiceId: string;
    invoiceNumber: string;
    currentReason: string;
    currentAttachment?: Attachment;
  } | null>(null);
  const [reasonInput, setReasonInput] = useState('');
  const [blockAttachment, setBlockAttachment] = useState<Attachment | null>(null);
  const [isBlockCompressing, setIsBlockCompressing] = useState(false);
  const blockFileInputRef = useRef<HTMLInputElement>(null);

  const toggleSelection = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredInvoices.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredInvoices.map(i => i.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedIds.size > 0 && onBulkDelete) {
      onBulkDelete(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDeleteInvoice) {
      onDeleteInvoice(id);
    }
  };

  const handleToggleBlocked = (id: string, currentBlocked: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePaymentBlocked) {
      onTogglePaymentBlocked(id, !currentBlocked);
    }
  };

  const handleBulkPaymentBlocked = (blocked: boolean) => {
    if (selectedIds.size > 0 && onBulkUpdatePaymentBlocked) {
      onBulkUpdatePaymentBlocked(Array.from(selectedIds), blocked);
      setSelectedIds(new Set());
    }
  };

  const handleBulkStageChange = (stage: FlowStage) => {
    if (selectedIds.size > 0 && onBulkUpdateStage) {
      onBulkUpdateStage(Array.from(selectedIds), stage);
      setSelectedIds(new Set());
      setShowBulkStageMenu(false);
    }
  };

  const handleRevert = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRevertStage) {
      onRevertStage(id);
    }
  };

  const handleBulkRevert = () => {
    if (selectedIds.size > 0 && onBulkRevertStage) {
      onBulkRevertStage(Array.from(selectedIds));
      setSelectedIds(new Set());
    }
  };

  // Open block email modal
  const openBlockEmailModal = (invoice: Invoice, e: React.MouseEvent) => {
    e.stopPropagation();
    setBlockEmailModal({
      isOpen: true,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      currentReason: invoice.blockReason || '',
      currentAttachment: (invoice as any).blockAttachment
    });
    setReasonInput(invoice.blockReason || '');
    setBlockAttachment((invoice as any).blockAttachment || null);
  };

  // Handle file selection for block evidence
  const handleBlockFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_ORIGINAL_SIZE) {
      alert(`File too large. Maximum size is ${MAX_ORIGINAL_SIZE / 1024 / 1024}MB`);
      return;
    }

    setIsBlockCompressing(true);
    try {
      const compressed = await compressFile(file);
      setBlockAttachment({
        id: `block-${Date.now()}`,
        name: compressed.originalName,
        mimeType: compressed.mimeType,
        data: compressed.data,
        originalSize: compressed.originalSize,
        compressedSize: compressed.compressedSize
      });
    } catch (error: any) {
      alert(error.message || 'Failed to compress file');
    } finally {
      setIsBlockCompressing(false);
      if (blockFileInputRef.current) blockFileInputRef.current.value = '';
    }
  };

  // Save block email
  const handleSaveBlockEmail = () => {
    if (blockEmailModal && onUpdateBlockEmail) {
      onUpdateBlockEmail(blockEmailModal.invoiceId, reasonInput, blockAttachment || undefined);
      setBlockEmailModal(null);
      setReasonInput('');
      setBlockAttachment(null);
    }
  };

  // Check if invoice can be reverted (not at initial stage)
  const canRevert = (invoice: Invoice): boolean => {
    const flowStages = invoice.flowType === FlowType.MISSING_INVOICE
      ? [FlowStage.MISSING_INVOICE_MISSING, FlowStage.MISSING_INVOICE_SENT_TO_VENDOR, FlowStage.MISSING_INVOICE_SENT_TO_AP, FlowStage.MISSING_INVOICE_PO_PENDING, FlowStage.MISSING_INVOICE_POSTED, FlowStage.CLOSED]
      : [FlowStage.PO_PENDING_RECEIVED, FlowStage.PO_PENDING_SENT, FlowStage.PO_PENDING_CREATED, FlowStage.PO_PENDING_EXR_CREATED, FlowStage.CLOSED];

    const currentIndex = flowStages.indexOf(invoice.currentStage);
    return currentIndex > 0;
  };

  // Check if any selected invoices can be reverted
  const canBulkRevert = (): boolean => {
    if (selectedIds.size === 0) return false;
    const selectedInvoices = filteredInvoices.filter(inv => selectedIds.has(inv.id));
    return selectedInvoices.some(inv => canRevert(inv));
  };

  // Get next available stages based on selected invoices and current view
  const getAvailableStages = (): { stage: FlowStage; label: string }[] => {
    if (selectedIds.size === 0) return [];

    // Get the selected invoices
    const selectedInvoices = filteredInvoices.filter(inv => selectedIds.has(inv.id));
    if (selectedInvoices.length === 0) return [];

    // Get allowed stages for current view
    const allowedStagesForView: FlowStage[] = [];
    if (activeView === 'RECON') {
      allowedStagesForView.push(...TEAM_STAGES.RECON, ...TEAM_STAGES.AP); // RECON can advance to AP stages
    } else if (activeView === 'AP') {
      allowedStagesForView.push(...TEAM_STAGES.AP, FlowStage.MISSING_INVOICE_POSTED, FlowStage.CLOSED); // AP can advance to Posted and Closed
    } else {
      // For ALL view, allow all stages
      allowedStagesForView.push(...TEAM_STAGES.RECON, ...TEAM_STAGES.AP, FlowStage.CLOSED);
    }

    // Collect all possible next stages from all selected invoices
    const nextStagesSet = new Set<FlowStage>();

    selectedInvoices.forEach(invoice => {
      const flowStages = FLOW_CONFIG[invoice.flowType as FlowType];
      if (!flowStages) return;

      const currentIndex = flowStages.indexOf(invoice.currentStage as FlowStage);
      if (currentIndex === -1) return;

      // Add all stages after the current one that are allowed for this view
      for (let i = currentIndex + 1; i < flowStages.length; i++) {
        if (allowedStagesForView.includes(flowStages[i])) {
          nextStagesSet.add(flowStages[i]);
        }
      }
    });

    // Convert to array and return with labels
    return Array.from(nextStagesSet).map(stage => ({
      stage,
      label: stage // The stage value is already human-readable
    }));
  };

  // Extract unique values for filters
  const uniqueEntities = useMemo(() => Array.from(new Set(invoices.map(i => i.entity).filter(Boolean))).sort(), [invoices]);
  const uniqueVendors = useMemo(() => Array.from(new Set(invoices.map(i => i.vendor).filter(Boolean))).sort(), [invoices]);
  const uniquePOOwners = useMemo(() => Array.from(new Set(invoices.map(i => i.poCreator).filter(Boolean))).sort(), [invoices]);
  const uniqueStatuses = useMemo(() => Array.from(new Set(invoices.map(i => i.currentStage).filter(Boolean))).sort(), [invoices]);
  const uniqueStatusDetails = useMemo(() => Array.from(new Set(invoices.map(i => i.statusDetail).filter(Boolean))).sort(), [invoices]);

  // Apply filters
  const filteredInvoices = useMemo(() => {
    return invoices.filter(invoice => {
      if (filters.entity !== 'ALL' && invoice.entity !== filters.entity) return false;
      if (filters.vendor !== 'ALL' && invoice.vendor !== filters.vendor) return false;
      if (filters.poOwner !== 'ALL' && invoice.poCreator !== filters.poOwner) return false;
      if (filters.status !== 'ALL' && invoice.currentStage !== filters.status) return false;
      if (filters.statusDetail !== 'ALL' && invoice.statusDetail !== filters.statusDetail) return false;
      return true;
    });
  }, [invoices, filters]);

  const clearFilters = () => {
    setFilters({
      entity: 'ALL',
      vendor: 'ALL',
      poOwner: 'ALL',
      status: 'ALL',
      statusDetail: 'ALL',
    });
  };

  const hasActiveFilters = Object.values(filters).some(f => f !== 'ALL');

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-sm">
      {/* Filter Toggle and Controls */}
      <div className="bg-slate-900/50 border-b border-slate-700 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all",
              showFilters ? "bg-brand-600 text-white" : "bg-slate-700 text-slate-300 hover:bg-slate-600"
            )}
          >
            <Filter size={16} />
            Filters {hasActiveFilters && `(${Object.values(filters).filter(f => f !== 'ALL').length})`}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-300 rounded-lg text-xs font-semibold transition-colors"
            >
              <X size={14} /> Clear All Filters
            </button>
          )}
        </div>
        <button
          onClick={() => exportToExcel(filteredInvoices, activeView || 'ALL')}
          disabled={filteredInvoices.length === 0}
          className={clsx(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all",
            filteredInvoices.length > 0
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/30"
              : "bg-slate-700 text-slate-500 cursor-not-allowed"
          )}
        >
          <Download size={16} />
          Export to Excel
          {filteredInvoices.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-md text-xs">
              {filteredInvoices.length}
            </span>
          )}
        </button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-slate-900/30 border-b border-slate-700 px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {/* Entity Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Entity</label>
              <select
                value={filters.entity}
                onChange={(e) => setFilters(prev => ({ ...prev, entity: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="ALL">All Entities</option>
                {uniqueEntities.map(entity => (
                  <option key={entity} value={entity}>{entity}</option>
                ))}
              </select>
            </div>

            {/* Vendor Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Vendor</label>
              <select
                value={filters.vendor}
                onChange={(e) => setFilters(prev => ({ ...prev, vendor: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="ALL">All Vendors</option>
                {uniqueVendors.map(vendor => (
                  <option key={vendor} value={vendor}>{vendor}</option>
                ))}
              </select>
            </div>

            {/* PO Owner Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">PO Owner</label>
              <select
                value={filters.poOwner}
                onChange={(e) => setFilters(prev => ({ ...prev, poOwner: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="ALL">All PO Owners</option>
                {uniquePOOwners.map(po => (
                  <option key={po} value={po}>{po}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Status</label>
              <select
                value={filters.status}
                onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="ALL">All Statuses</option>
                {uniqueStatuses.map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            {/* Status Detail Filter */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wider">Detail</label>
              <select
                value={filters.statusDetail}
                onChange={(e) => setFilters(prev => ({ ...prev, statusDetail: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-brand-500 outline-none"
              >
                <option value="ALL">All Details</option>
                {uniqueStatusDetails.map(detail => (
                  <option key={detail} value={detail}>{detail}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {selectedIds.size > 0 && (
        <div className="bg-brand-900/20 border-b border-brand-900/50 px-6 py-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <span className="text-brand-300 text-sm font-bold">
              {selectedIds.size} invoice{selectedIds.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk Payment Status (RECON view only) */}
              {activeView === 'RECON' && onBulkUpdatePaymentBlocked && (
                <>
                  <button
                    onClick={() => handleBulkPaymentBlocked(false)}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <CheckCircle size={14} /> Set OK
                  </button>
                  <button
                    onClick={() => handleBulkPaymentBlocked(true)}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Ban size={14} /> Set Blocked
                  </button>
                  <div className="w-px h-6 bg-slate-600 mx-1"></div>
                </>
              )}

              {/* Forward to Payment Queue - RECON view only for Closed invoices */}
              {activeView === 'RECON' && onBulkRequestPayment && filteredInvoices.some(inv => selectedIds.has(inv.id) && inv.currentStage === FlowStage.CLOSED) && (
                <>
                  <button
                    onClick={() => {
                      if (onBulkRequestPayment) {
                        const closedIds = Array.from(selectedIds).filter(id => {
                          const inv = filteredInvoices.find(i => i.id === id);
                          return inv && inv.currentStage === FlowStage.CLOSED;
                        });
                        onBulkRequestPayment(closedIds);
                        setSelectedIds(new Set());
                      }
                    }}
                    className="px-3 py-1.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg"
                  >
                    <Send size={14} /> Forward to Payment Queue
                  </button>
                  <div className="w-px h-6 bg-slate-600 mx-1"></div>
                </>
              )}

              {/* Bulk Revert */}
              {onBulkRevertStage && canBulkRevert() && (
                <>
                  <button
                    onClick={handleBulkRevert}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Undo2 size={14} /> Revert Stage
                  </button>
                  <div className="w-px h-6 bg-slate-600 mx-1"></div>
                </>
              )}

              {/* Bulk Stage Change */}
              {onBulkUpdateStage && getAvailableStages().length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowBulkStageMenu(!showBulkStageMenu)}
                    className="px-3 py-1.5 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <ArrowRight size={14} /> Change Stage
                  </button>
                  {showBulkStageMenu && (
                    <div className="absolute top-full left-0 mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl z-50 min-w-[200px]">
                      {getAvailableStages().map(({ stage, label }) => (
                        <button
                          key={stage}
                          onClick={() => handleBulkStageChange(stage)}
                          className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 first:rounded-t-lg last:rounded-b-lg flex items-center gap-2"
                        >
                          <Send size={12} className="text-brand-400" />
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bulk Delete */}
              {onBulkDelete && (
                <>
                  <div className="w-px h-6 bg-slate-600 mx-1"></div>
                  <button
                    onClick={handleBulkDelete}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </>
              )}

              {/* Clear Selection */}
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors"
              >
                <X size={14} /> Clear
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-900/70 text-slate-200 uppercase tracking-wide text-[10px] font-semibold border-b border-slate-700">
            <tr>
              {(onBulkDelete || onBulkUpdateStage || onBulkUpdatePaymentBlocked) && (
                <th className="px-4 py-4 w-12">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredInvoices.length && filteredInvoices.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer"
                  />
                </th>
              )}
              <th className="px-6 py-4">Processing Date</th>
              <th className="px-6 py-4">Entity</th>
              <th className="px-6 py-4">Invoice #</th>
              <th className="px-6 py-4">Vendor</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              {activeView === 'RECON' && <th className="px-6 py-4 text-center">Payment</th>}
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={(onBulkDelete || onBulkUpdateStage || onBulkUpdatePaymentBlocked) ? (activeView === 'RECON' ? 9 : 8) : (activeView === 'RECON' ? 8 : 7)} className="px-6 py-12 text-center text-slate-400 italic">
                  {hasActiveFilters ? 'No invoices match the selected filters.' : 'No invoices found in this queue.'}
                </td>
              </tr>
            ) : (
              filteredInvoices.map((invoice) => {
                const timestamp = new Date(invoice.submissionTimestamp || invoice.createdAt).toLocaleString([], {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <tr
                    key={invoice.id}
                    className={clsx(
                      "hover:bg-slate-700/40 transition-colors group cursor-pointer",
                      selectedIds.has(invoice.id) && "bg-brand-900/20"
                    )}
                    onClick={() => onSelectInvoice(invoice)}
                  >
                    {(onBulkDelete || onBulkUpdateStage || onBulkUpdatePaymentBlocked) && (
                      <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(invoice.id)}
                          onChange={(e) => toggleSelection(invoice.id, e as any)}
                          className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-slate-300 font-mono text-xs">
                         <Clock size={12} className="text-brand-400" aria-hidden="true" />
                         {timestamp}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="bg-slate-950 px-2 py-1 rounded border border-slate-700 text-white font-semibold text-xs inline-flex items-center gap-1.5 shadow-sm">
                        <Building2 size={10} className="text-brand-400" aria-hidden="true" />
                        {invoice.entity || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-white whitespace-nowrap tracking-tight">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-200">
                      {invoice.vendor}
                    </td>
                    <td className="px-6 py-4 text-slate-100 whitespace-nowrap font-mono font-semibold">
                      {invoice.amount ? 
                        new Intl.NumberFormat('en-IE', { style: 'currency', currency: invoice.currency || 'EUR' }).format(invoice.amount) 
                        : '—'}
                    </td>
                    <td className="px-6 py-4">
                      <Badge stage={invoice.currentStage} className="text-[10px] font-black uppercase tracking-tight" />
                    </td>
                    {activeView === 'RECON' && (
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={(e) => handleToggleBlocked(invoice.id, invoice.paymentBlocked, e)}
                            className={clsx(
                              "p-2 rounded-lg transition-all flex items-center gap-1.5",
                              invoice.paymentBlocked
                                ? "bg-red-900/30 text-red-400 hover:bg-red-900/50 border border-red-900/50"
                                : "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 border border-emerald-900/50"
                            )}
                            title={invoice.paymentBlocked ? "Payment Blocked - Click to unblock" : "Payment Allowed - Click to block"}
                          >
                            {invoice.paymentBlocked ? (
                              <>
                                <Ban size={14} />
                                <span className="text-[10px] font-bold uppercase">Blocked</span>
                              </>
                            ) : (
                              <>
                                <CheckCircle size={14} />
                                <span className="text-[10px] font-bold uppercase">OK</span>
                              </>
                            )}
                          </button>
                          {/* Attachment icon - only show when blocked */}
                          {invoice.paymentBlocked && onUpdateBlockEmail && (() => {
                            // Parse blockAttachment if it's a string
                            let att = invoice.blockAttachment;
                            if (typeof att === 'string' && att) {
                              try { att = JSON.parse(att); } catch(e) {}
                            }
                            const hasAttachment = att && typeof att === 'object' && att.data;
                            return (
                              <>
                                <button
                                  onClick={(e) => openBlockEmailModal(invoice, e)}
                                  className={clsx(
                                    "p-2 rounded-lg transition-all border",
                                    hasAttachment
                                      ? "bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50 border-emerald-900/50"
                                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 border-slate-700 animate-pulse"
                                  )}
                                  title={hasAttachment ? "View/Edit block evidence" : "Add block evidence (required)"}
                                >
                                  <Paperclip size={14} />
                                </button>
                                {/* Download icon - only show when has attachment with data */}
                                {hasAttachment && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (att && att.data) {
                                        downloadCompressedFile(att.data, att.name, att.mimeType);
                                      }
                                    }}
                                    className="p-2 rounded-lg transition-all border bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 border-blue-900/50"
                                    title="Download block evidence"
                                  >
                                    <Download size={14} />
                                  </button>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {onRevertStage && canRevert(invoice) && (
                          <button
                            onClick={(e) => handleRevert(invoice.id, e)}
                            className="p-2 text-amber-400 hover:text-amber-300 hover:bg-amber-900/20 rounded-lg transition-all"
                            title="Revert to previous stage"
                          >
                            <Undo2 size={14} />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectInvoice(invoice);
                          }}
                          className="p-2 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 rounded-lg transition-all"
                          title="Edit invoice"
                        >
                          <Edit size={14} />
                        </button>
                        {onDeleteInvoice && (
                          <button
                            onClick={(e) => handleDelete(invoice.id, e)}
                            className="p-2 text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-all"
                            title="Delete invoice"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <button className="text-brand-400 hover:text-brand-300 font-bold text-xs flex items-center gap-1 uppercase tracking-wide group-hover:gap-2 transition-all">
                          View <ChevronRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Block Email Modal */}
      {blockEmailModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setBlockEmailModal(null)}>
          <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-700 bg-gradient-to-r from-red-900/30 to-orange-900/30">
              <h3 className="text-lg font-bold text-white flex items-center gap-3">
                <div className="bg-red-600/20 p-2 rounded-xl">
                  <Mail size={20} className="text-red-400" />
                </div>
                Block Evidence - {blockEmailModal.invoiceNumber}
              </h3>
              <p className="text-slate-400 text-sm mt-2">
                Attach the email screenshot/PDF sent to PO Owner as evidence.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Email Evidence (Screenshot/PDF)
                </label>
                <input
                  type="file"
                  ref={blockFileInputRef}
                  onChange={handleBlockFileSelect}
                  className="hidden"
                  accept="image/*,.pdf,.msg,.eml"
                />
                {blockAttachment ? (
                  <div className="bg-emerald-950/30 border border-emerald-900/50 rounded-xl p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Paperclip size={18} className="text-emerald-400" />
                      <div>
                        <p className="text-emerald-300 text-sm font-semibold truncate max-w-[250px]">{blockAttachment.name}</p>
                        <p className="text-emerald-600 text-xs">{formatFileSize(blockAttachment.compressedSize)} compressed</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setBlockAttachment(null)}
                      className="p-1.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => blockFileInputRef.current?.click()}
                    disabled={isBlockCompressing}
                    className="w-full bg-slate-950 border-2 border-dashed border-slate-700 hover:border-brand-500 rounded-xl px-4 py-6 text-slate-400 text-sm transition-all flex items-center justify-center gap-3"
                  >
                    {isBlockCompressing ? (
                      <>
                        <Loader2 size={20} className="animate-spin" />
                        Compressing...
                      </>
                    ) : (
                      <>
                        <Paperclip size={20} />
                        Click to attach email screenshot or PDF
                      </>
                    )}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Reason for Blocking
                </label>
                <textarea
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g., PO Owner notified on [date], awaiting response..."
                  rows={3}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 resize-none"
                />
              </div>

              {blockEmailModal.currentAttachment && (
                <div className="bg-blue-950/30 border border-blue-900/50 rounded-xl p-4">
                  <p className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-2">Current Attachment</p>
                  <button
                    onClick={() => downloadCompressedFile(blockEmailModal.currentAttachment!.data, blockEmailModal.currentAttachment!.name, blockEmailModal.currentAttachment!.mimeType)}
                    className="text-blue-300 hover:text-blue-200 text-sm flex items-center gap-2"
                  >
                    <Download size={14} />
                    {blockEmailModal.currentAttachment.name} ({formatFileSize(blockEmailModal.currentAttachment.compressedSize)})
                  </button>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-slate-700 flex justify-end gap-3 bg-slate-950/50">
              <button
                onClick={() => { setBlockEmailModal(null); setBlockAttachment(null); setReasonInput(''); }}
                className="px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-sm font-bold transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveBlockEmail}
                disabled={!blockAttachment && !reasonInput.trim()}
                className="px-5 py-2.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-xl text-sm font-bold transition-all flex items-center gap-2"
              >
                <Paperclip size={16} />
                Save Evidence
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};