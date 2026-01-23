import React, { useState, useEffect } from "react";
import {
  Plus,
  X,
  AlertTriangle,
  Building2,
  FileText,
  User,
  Euro,
  MessageSquare,
  UserCircle,
  Briefcase,
  Link,
  Tag,
  FileWarning,
  Search,
} from "lucide-react";
import { Invoice, FlowType, FlowStage, Evidence, StatusDetail } from "../types";
import { clsx } from "clsx";
import { TEAM_STAGES } from "../constants";

const getTeamFromInvoice = (invoice: Invoice): string => {
  if (
    invoice.paymentStatus === "REQUESTED" ||
    invoice.paymentStatus === "PAID"
  ) {
    return "Payment Team";
  }
  if (TEAM_STAGES.RECON.includes(invoice.currentStage)) {
    return "Reconciliation Team";
  }
  if (TEAM_STAGES.AP.includes(invoice.currentStage)) {
    return "AP Processing Team";
  }
  if (invoice.currentStage === FlowStage.CLOSED) {
    return "Closed/Completed";
  }
  return "Unknown Team";
};

interface ManualEntryModalProps {
  onClose: () => void;
  onAdd: (invoice: Invoice) => void;
  existingInvoiceNumbers: Set<string>;
  existingInvoices: Invoice[];
  simplified?: boolean;
  userEmail?: string;
  userRole?: string;
}

export const ManualEntryModal: React.FC<ManualEntryModalProps> = ({
  onClose,
  onAdd,
  existingInvoiceNumbers,
  existingInvoices,
  simplified = false,
  userEmail,
  userRole,
}) => {
  const [formData, setFormData] = useState({
    invoiceNumber: "",
    vendor: "",
    entity: "",
    amount: "",
    comment: "",
    poCreator: "",
    sharepointUrl: "",
    statusDetail: "NONE" as StatusDetail,
    flowType: simplified ? FlowType.MISSING_INVOICE : FlowType.PO_PENDING,
  });
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (
      !formData.invoiceNumber.trim() ||
      !formData.vendor.trim() ||
      !formData.entity.trim()
    ) {
      setError("Entity, Invoice Number, and Vendor are required.");
      return;
    }

    // PO Creator is required for AP Processing team (non-simplified) when adding a PO Pending case
    if (
      !simplified &&
      formData.flowType === FlowType.PO_PENDING &&
      !formData.poCreator.trim()
    ) {
      setError("PO Creator is required for PO Pending flows.");
      return;
    }

    // Only check for duplicates in Reconciliation (simplified mode)
    if (
      simplified &&
      existingInvoiceNumbers.has(formData.invoiceNumber.trim())
    ) {
      const existingInvoice = existingInvoices.find(
        (inv) => inv.invoiceNumber === formData.invoiceNumber.trim()
      );
      if (existingInvoice) {
        const team = getTeamFromInvoice(existingInvoice);
        const statusInfo = existingInvoice.currentStage;
        const poInfo = existingInvoice.poCreator
          ? ` (PO Owner: ${existingInvoice.poCreator})`
          : "";
        setError(
          `Duplicate Error: Invoice ${formData.invoiceNumber.trim()} is already being tracked by ${team}. Current Status: ${statusInfo}${poInfo}`
        );
      } else {
        setError("Duplicate Error: This invoice is already being tracked.");
      }
      return;
    }

    const now = new Date().toISOString();
    const initialStage =
      formData.flowType === FlowType.PO_PENDING
        ? FlowStage.PO_PENDING_RECEIVED
        : FlowStage.MISSING_INVOICE_MISSING;

    const evidence: Evidence[] = [];
    if (formData.comment.trim()) {
      evidence.push({
        id: Math.random().toString(36).substr(2, 9),
        type: "NOTE",
        content: formData.comment,
        createdAt: now,
        createdBy: "System User",
        stageAddedAt: initialStage,
      });
    }

    const newInvoice: Invoice = {
      id: `man-${Date.now()}`,
      invoiceNumber: formData.invoiceNumber.trim(),
      vendor: formData.vendor.trim(),
      entity: formData.entity.trim(),
      amount: formData.amount ? parseFloat(formData.amount) : undefined,
      currency: "EUR",
      poCreator:
        !simplified && formData.flowType === FlowType.PO_PENDING
          ? formData.poCreator.trim()
          : undefined,
      sharepointUrl:
        (!simplified && formData.sharepointUrl.trim()) || undefined,
      statusDetail: simplified ? "NONE" : formData.statusDetail,
      submissionTimestamp: now,
      flowType: formData.flowType,
      currentStage: initialStage,
      source:
        formData.flowType === FlowType.MISSING_INVOICE ? "RECON" : "MANUAL",
      createdAt: now,
      updatedAt: now,
      createdBy: userEmail,
      createdByRole: userRole,
      evidence: evidence,
      paymentStatus: "NONE",
    };

    onAdd(newInvoice);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden text-slate-50">
        <div className="bg-slate-950 border-b border-slate-800 p-6 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div
              className={clsx(
                "p-3 rounded-xl shadow-lg",
                simplified || formData.flowType === FlowType.MISSING_INVOICE
                  ? "bg-rose-600/20 text-rose-500"
                  : "bg-amber-600/20 text-amber-500"
              )}
            >
              {simplified || formData.flowType === FlowType.MISSING_INVOICE ? (
                <FileWarning size={24} />
              ) : (
                <Briefcase size={24} />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                {simplified
                  ? "New Missing Invoice Entry"
                  : formData.flowType === FlowType.MISSING_INVOICE
                  ? "New Missing Invoice Entry"
                  : "New PO Pending Entry"}
              </h2>
              <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-[0.2em] font-black">
                {simplified
                  ? "Reconciliation Team Context"
                  : "AP Processing Team Context"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-white p-2 hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-6 bg-slate-900 max-h-[85vh] overflow-y-auto scrollbar-thin"
        >
          {/* Flow Type Selector - Only for AP Processing (non-simplified) */}
          {!simplified && (
            <div>
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">
                Flow Type
              </label>
              <div className="flex gap-2 p-1.5 bg-slate-800 rounded-xl border border-slate-700">
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, flowType: FlowType.PO_PENDING })
                  }
                  className={clsx(
                    "flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                    formData.flowType === FlowType.PO_PENDING
                      ? "bg-amber-600 text-white shadow-lg shadow-amber-900/40"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <Briefcase size={14} />
                  PO Pending
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFormData({ ...formData, flowType: FlowType.MISSING_INVOICE })
                  }
                  className={clsx(
                    "flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-2",
                    formData.flowType === FlowType.MISSING_INVOICE
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-900/40"
                      : "text-slate-500 hover:text-slate-300"
                  )}
                >
                  <FileWarning size={14} />
                  Missing Invoice
                </button>
              </div>
            </div>
          )}

          <div
            className={clsx(
              "grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800",
              simplified && "grid-cols-1"
            )}
          >
            <div className="col-span-1">
              <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                Business Entity *
              </label>
              <div className="relative">
                <Building2
                  className="absolute left-3 top-2.5 text-slate-600"
                  size={14}
                />
                <input
                  type="text"
                  required
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:ring-1 focus:ring-brand-500/50 outline-none placeholder-slate-800 text-sm"
                  placeholder="e.g. IE-HQ"
                  value={formData.entity}
                  onChange={(e) =>
                    setFormData({ ...formData, entity: e.target.value })
                  }
                />
              </div>
            </div>
            {!simplified && formData.flowType === FlowType.PO_PENDING && (
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
                  PO Creator / Owner *
                </label>
                <div className="relative">
                  <UserCircle
                    className="absolute left-3 top-2.5 text-slate-600"
                    size={14}
                  />
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-white focus:ring-1 focus:ring-brand-500/50 outline-none placeholder-slate-800 text-sm"
                    placeholder="Owner Name"
                    value={formData.poCreator}
                    onChange={(e) =>
                      setFormData({ ...formData, poCreator: e.target.value })
                    }
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">
                Financial Details
              </label>
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <FileText
                    className="absolute left-3 top-2.5 text-slate-500"
                    size={16}
                  />
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 outline-none text-sm placeholder-slate-600"
                    placeholder="Invoice Number *"
                    value={formData.invoiceNumber}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        invoiceNumber: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="relative w-1/3">
                  <Euro
                    className="absolute left-3 top-2.5 text-slate-500"
                    size={16}
                  />
                  <input
                    type="number"
                    step="0.01"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 outline-none text-sm placeholder-slate-600"
                    placeholder="Value (EUR)"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                  />
                </div>
              </div>
            </div>

            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">
                Supplier Information
              </label>
              <div className="relative">
                <User
                  className="absolute left-3 top-2.5 text-slate-500"
                  size={16}
                />
                <input
                  type="text"
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 outline-none text-sm placeholder-slate-600"
                  placeholder="Vendor Name *"
                  value={formData.vendor}
                  onChange={(e) =>
                    setFormData({ ...formData, vendor: e.target.value })
                  }
                />
              </div>
            </div>

            {!simplified && formData.flowType === FlowType.PO_PENDING && (
              <>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">
                    Status Categorization
                  </label>
                  <div className="flex gap-2 p-1.5 bg-slate-800 rounded-xl border border-slate-700">
                    {(
                      ["WITHOUT PO", "EXR PENDING", "NONE"] as StatusDetail[]
                    ).map((status) => (
                      <button
                        key={status}
                        type="button"
                        onClick={() =>
                          setFormData({ ...formData, statusDetail: status })
                        }
                        className={clsx(
                          "flex-1 py-2 text-[10px] font-black rounded-lg transition-all flex items-center justify-center gap-2 uppercase tracking-tighter",
                          formData.statusDetail === status
                            ? "bg-amber-600 text-white shadow-lg shadow-amber-900/40"
                            : "text-slate-500 hover:text-slate-300"
                        )}
                      >
                        {status}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">
                    SharePoint Link
                  </label>
                  <div className="relative">
                    <Link
                      className="absolute left-3 top-2.5 text-slate-500"
                      size={16}
                    />
                    <input
                      type="url"
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-2 focus:ring-brand-500/50 outline-none text-sm placeholder-slate-700 font-mono"
                      placeholder="https://company.sharepoint.com/..."
                      value={formData.sharepointUrl}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          sharepointUrl: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </>
            )}

            <div className="col-span-2">
              <label className="block text-[10px] font-black text-slate-500 mb-2 uppercase tracking-[0.2em]">
                Communication / Notes
              </label>
              <textarea
                className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-500/50 outline-none resize-none placeholder-slate-700 text-sm"
                rows={3}
                placeholder="Initial reason for tracking or communication thread context..."
                value={formData.comment}
                onChange={(e) =>
                  setFormData({ ...formData, comment: e.target.value })
                }
              />
            </div>
          </div>

          {error && (
            <div className="bg-rose-900/20 border border-rose-900/50 rounded-xl p-4 flex items-start gap-3 animate-in fade-in slide-in-from-top-1">
              <AlertTriangle
                className="text-rose-500 shrink-0 mt-0.5"
                size={18}
              />
              <p className="text-rose-400 text-sm font-bold tracking-tight">
                {error}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-6 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 text-slate-500 hover:text-white transition-colors text-xs font-black uppercase tracking-widest"
            >
              Discard
            </button>
            <button
              type="submit"
              className={clsx(
                "px-10 py-3 text-white rounded-xl font-black text-xs uppercase tracking-[0.1em] transition-all shadow-xl active:scale-95",
                simplified
                  ? "bg-rose-600 hover:bg-rose-500 shadow-rose-900/30"
                  : "bg-amber-600 hover:bg-amber-500 shadow-amber-900/30"
              )}
            >
              Ignite Workflow
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
