import React, { useState, useMemo } from 'react';
import { Invoice, TeamView, FlowStage, FlowType } from '../types';
import { FLOW_CONFIG } from '../constants';
import { Badge } from './ui/Badge';
import { ChevronRight, FileText, MessageSquare, Building2, UserCircle, Clock, Link as LinkIcon, ExternalLink, Trash2, Filter, X, Edit, Ban, CheckCircle, Download, ArrowRight, Send } from 'lucide-react';
import { clsx } from 'clsx';
import { exportToExcel } from '../lib/exportExcel';

interface InvoiceListProps {
  invoices: Invoice[];
  onSelectInvoice: (invoice: Invoice) => void;
  onDeleteInvoice?: (id: string) => void;
  onBulkDelete?: (ids: string[]) => void;
  activeView?: TeamView;
  onTogglePaymentBlocked?: (id: string, blocked: boolean) => void;
  onBulkUpdatePaymentBlocked?: (ids: string[], blocked: boolean) => void;
  onBulkUpdateStage?: (ids: string[], stage: FlowStage) => void;
}

export const InvoiceList: React.FC<InvoiceListProps> = ({ invoices, onSelectInvoice, onDeleteInvoice, onBulkDelete, activeView, onTogglePaymentBlocked, onBulkUpdatePaymentBlocked, onBulkUpdateStage }) => {
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

  // Get next available stages based on selected invoices
  const getAvailableStages = (): { stage: FlowStage; label: string }[] => {
    if (selectedIds.size === 0) return [];

    // Get the selected invoices
    const selectedInvoices = filteredInvoices.filter(inv => selectedIds.has(inv.id));
    if (selectedInvoices.length === 0) return [];

    // Collect all possible next stages from all selected invoices
    const nextStagesSet = new Set<FlowStage>();

    selectedInvoices.forEach(invoice => {
      const flowStages = FLOW_CONFIG[invoice.flowType as FlowType];
      if (!flowStages) return;

      const currentIndex = flowStages.indexOf(invoice.currentStage as FlowStage);
      if (currentIndex === -1) return;

      // Add all stages after the current one
      for (let i = currentIndex + 1; i < flowStages.length; i++) {
        nextStagesSet.add(flowStages[i]);
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
              <th className="px-6 py-4">PO Owner</th>
              <th className="px-6 py-4">Detail</th>
              <th className="px-6 py-4">Amount</th>
              <th className="px-6 py-4">Status</th>
              {activeView === 'RECON' && <th className="px-6 py-4 text-center">Payment</th>}
              <th className="px-6 py-4 text-center">Docs</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700/50">
            {filteredInvoices.length === 0 ? (
              <tr>
                <td colSpan={(onBulkDelete || onBulkUpdateStage || onBulkUpdatePaymentBlocked) ? (activeView === 'RECON' ? 12 : 11) : (activeView === 'RECON' ? 11 : 10)} className="px-6 py-12 text-center text-slate-400 italic">
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
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.poCreator ? (
                        <div className="flex items-center gap-1.5 text-orange-200 bg-orange-950/40 px-2 py-1 rounded border border-orange-900/30 w-fit text-xs font-medium">
                           <UserCircle size={12} className="text-orange-400" aria-hidden="true" /> {invoice.poCreator}
                        </div>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {invoice.statusDetail && invoice.statusDetail !== 'NONE' ? (
                        <span className={clsx(
                          "px-2 py-0.5 rounded text-[10px] font-bold uppercase border tracking-tight",
                          invoice.statusDetail === 'WITHOUT PO' ? "bg-red-950/40 text-red-400 border-red-900/40" : "bg-blue-950/40 text-blue-400 border-blue-900/40"
                        )}>
                          {invoice.statusDetail}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
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
                        <button
                          onClick={(e) => handleToggleBlocked(invoice.id, invoice.paymentBlocked, e)}
                          className={clsx(
                            "p-2 rounded-lg transition-all flex items-center gap-1.5 mx-auto",
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
                      </td>
                    )}
                    <td className="px-6 py-4 text-center">
                      {invoice.sharepointUrl && (
                        <a 
                          href={invoice.sharepointUrl} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-brand-400 hover:text-brand-300 p-1.5 bg-brand-950/30 rounded-lg border border-brand-900/30 transition-all inline-block hover:scale-110 active:scale-95"
                          onClick={(e) => e.stopPropagation()}
                          title="View on SharePoint"
                        >
                          <LinkIcon size={14} />
                        </a>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
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
    </div>
  );
};