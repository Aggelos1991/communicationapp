import React, { useMemo } from 'react';
import { ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Invoice, FlowStage, FlowType } from '../types';
import { BarChart3, ArrowRight, FileText, Clock, FileWarning } from 'lucide-react';

interface DashboardProps {
  invoices: Invoice[];
  onNavigateToInvoices: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ invoices, onNavigateToInvoices, onSelectInvoice }) => {
  const stats = useMemo(() => {
    const s = {
      total: invoices.length,
      active: 0,
      totalValue: 0,
      missing: 0,
      missingValue: 0,
      pendingPO: 0,
      pendingPOValue: 0,
    };

    invoices.forEach(inv => {
      // Check if closed (case insensitive)
      const isClosed = inv.currentStage === FlowStage.CLOSED ||
                       inv.currentStage === 'Closed' ||
                       (typeof inv.currentStage === 'string' && inv.currentStage.toLowerCase() === 'closed');
      if (isClosed) return;

      // Parse amount robustly
      const amount = typeof inv.amount === 'number' ? inv.amount : parseFloat(String(inv.amount)) || 0;
      s.totalValue += amount;
      s.active++;

      // Missing Invoices - MISSING_INVOICE flow type (not closed)
      const isMissing = inv.flowType === FlowType.MISSING_INVOICE ||
                        inv.flowType === 'MISSING_INVOICE' ||
                        (typeof inv.flowType === 'string' && inv.flowType.toUpperCase() === 'MISSING_INVOICE');
      if (isMissing) {
        s.missing++;
        s.missingValue += amount;
      }

      // PO Pending - based on currentStage being "PO Pending" or MISSING_INVOICE_PO_PENDING
      const isPOPending = inv.currentStage === FlowStage.MISSING_INVOICE_PO_PENDING ||
                          inv.currentStage === 'PO Pending' ||
                          (typeof inv.currentStage === 'string' && inv.currentStage.toLowerCase() === 'po pending');
      if (isPOPending) {
        s.pendingPO++;
        s.pendingPOValue += amount;
      }
    });

    return s;
  }, [invoices]);

  // Vendor Exposure - Missing invoices grouped by vendor
  const vendorExposure = useMemo(() => {
    const vendors: Record<string, number> = {};

    // Debug: log all invoices to understand data structure
    console.log('Dashboard invoices count:', invoices.length);
    if (invoices.length > 0) {
      console.log('Sample invoice:', JSON.stringify(invoices[0], null, 2));
      console.log('All flowTypes:', [...new Set(invoices.map(i => i.flowType))]);
    }

    const missingInvoices = invoices.filter(i => {
      // Check both exact enum match and string equality (case insensitive)
      const isMissing = i.flowType === FlowType.MISSING_INVOICE ||
                        i.flowType === 'MISSING_INVOICE' ||
                        (typeof i.flowType === 'string' && i.flowType.toUpperCase() === 'MISSING_INVOICE');
      const isNotClosed = i.currentStage !== FlowStage.CLOSED && i.currentStage !== 'Closed';
      return isMissing && isNotClosed;
    });

    console.log('Missing invoices for vendor exposure:', missingInvoices.length);
    if (missingInvoices.length > 0) {
      console.log('Missing invoices sample:', missingInvoices.slice(0, 3).map(i => ({
        vendor: i.vendor,
        amount: i.amount,
        flowType: i.flowType,
        currentStage: i.currentStage
      })));
    }

    missingInvoices.forEach(i => {
      const vendorName = i.vendor && i.vendor.trim() ? i.vendor.trim() : 'Unknown';
      const amount = typeof i.amount === 'number' ? i.amount : parseFloat(String(i.amount)) || 0;
      vendors[vendorName] = (vendors[vendorName] || 0) + amount;
    });

    console.log('Vendor exposure data:', vendors);

    return Object.entries(vendors)
      .map(([name, value]) => ({ name: name.length > 20 ? name.substring(0, 20) + '...' : name, fullName: name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [invoices]);

  const formatEuro = (val: number) => {
    if (isNaN(val) || val === null || val === undefined) return '€0';
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex items-center justify-between pb-6 border-b border-slate-800/50">
        <div>
          <h2 className="text-2xl font-bold text-white">Overview</h2>
          <p className="text-sm text-slate-400 mt-1">Financial operations summary</p>
        </div>
        <button
          onClick={onNavigateToInvoices}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold transition-all"
        >
          View All Invoices <ArrowRight size={14} />
        </button>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Active */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Active Invoices</p>
              <p className="text-3xl font-bold text-white mt-1">{stats.active}</p>
              <p className="text-xs text-slate-500 mt-1">{formatEuro(stats.totalValue)} total value</p>
            </div>
            <div className="p-3 bg-slate-700/50 rounded-xl">
              <FileText className="text-slate-400" size={24} />
            </div>
          </div>
        </div>

        {/* Missing Invoices */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">Missing Invoices</p>
              <p className="text-3xl font-bold text-rose-400 mt-1">{stats.missing}</p>
              <p className="text-xs text-slate-500 mt-1">{formatEuro(stats.missingValue)} exposure</p>
            </div>
            <div className="p-3 bg-rose-500/10 rounded-xl">
              <FileWarning className="text-rose-400" size={24} />
            </div>
          </div>
        </div>

        {/* PO Pending */}
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">PO Pending</p>
              <p className="text-3xl font-bold text-amber-400 mt-1">{stats.pendingPO}</p>
              <p className="text-xs text-slate-500 mt-1">{formatEuro(stats.pendingPOValue)} value</p>
            </div>
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Clock className="text-amber-400" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Exposure Chart */}
      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-rose-500/10 rounded-lg">
              <BarChart3 className="text-rose-400" size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Vendor Exposure</h3>
              <p className="text-xs text-slate-500">Missing invoice value by vendor</p>
            </div>
          </div>
        </div>

        <div className="h-[300px]">
          {vendorExposure.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendorExposure} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
                  dy={10}
                  angle={-30}
                  textAnchor="end"
                  height={70}
                  interval={0}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={formatEuro}
                  width={70}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  content={({ active, payload }) => {
                    if (active && payload?.length) return (
                      <div className="bg-slate-900 border border-slate-700 px-4 py-3 rounded-lg shadow-xl">
                        <p className="text-slate-400 text-xs font-medium mb-1">{payload[0].payload.fullName}</p>
                        <p className="text-rose-400 text-lg font-bold">{formatEuro(payload[0].value as number)}</p>
                      </div>
                    );
                    return null;
                  }}
                />
                <Bar dataKey="value" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm">
              No vendor exposure data available
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
