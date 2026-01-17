import React, { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Invoice, FlowStage, FlowType } from '../types';
// Fixed missing FileText import from lucide-react
import { AlertCircle, CheckCircle2, Clock, TrendingUp, Activity, Wallet, Zap, Calendar, UserCircle, Building2, AlertTriangle, FileWarning, BarChart3, ShieldCheck, Users, ArrowRight, FileText } from 'lucide-react';
import { clsx } from 'clsx';

interface DashboardProps {
  invoices: Invoice[];
  onNavigateToInvoices: () => void;
  onSelectInvoice: (invoice: Invoice) => void;
}

const StatCard = ({ title, value, subValue, icon: Icon, colorClass, delay, gradient }: any) => (
  <div 
    className={clsx(
      "relative overflow-hidden rounded-2xl border border-slate-700/50 p-6 backdrop-blur-sm transition-all hover:scale-[1.02] duration-300 group animate-in fade-in slide-in-from-bottom-4 fill-mode-forwards",
      gradient || "bg-slate-900/40"
    )}
    style={{ animationDelay: `${delay}ms` }}
  >
    <div className={clsx("absolute -top-4 -right-4 p-4 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-500", colorClass)}>
      <Icon size={120} />
    </div>
    <div className="relative z-10">
      <div className={clsx("inline-flex p-3 rounded-xl bg-slate-800/80 mb-4 ring-1 ring-inset ring-white/10 shadow-lg", colorClass)}>
        <Icon size={24} />
      </div>
      <h3 className="text-4xl font-black text-white tracking-tighter mb-1">{value}</h3>
      <p className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-2">{title}</p>
      {subValue && (
        <div className="flex items-center gap-2 mt-3">
          <div className="h-1 flex-1 bg-slate-800 rounded-full overflow-hidden">
            <div className={clsx("h-full rounded-full transition-all duration-1000", colorClass.replace('text-', 'bg-'))} style={{ width: '65%' }}></div>
          </div>
          <p className="text-[10px] font-mono text-slate-400 whitespace-nowrap">{subValue}</p>
        </div>
      )}
    </div>
  </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ invoices, onNavigateToInvoices, onSelectInvoice }) => {
  const stats = useMemo(() => {
    const s = {
      total: invoices.length,
      active: 0,
      totalValue: 0,
      missing: 0,
      pendingPO: 0,
      readyPost: 0,
      paymentValidation: 0,
      exrPending: 0,
      withoutPo: 0,
      closed: 0,
    };

    invoices.forEach(inv => {
      // Handle closed invoices
      if (inv.currentStage === FlowStage.CLOSED) {
        if (inv.paymentStatus === 'PAID') s.closed++;
        return;
      }

      s.totalValue += inv.amount || 0;

      // Payment Queue: Invoices with payment requested
      if (inv.paymentStatus === 'REQUESTED') {
        s.paymentValidation++;
        s.active++;
        return;
      }

      // Active invoices
      s.active++;

      // Missing Invoices: Only MISSING_INVOICE flow in RECON stages
      if (inv.flowType === FlowType.MISSING_INVOICE &&
          (inv.currentStage === FlowStage.MISSING_INVOICE_MISSING ||
           inv.currentStage === FlowStage.MISSING_INVOICE_SENT_TO_AP)) {
        s.missing++;
      }

      // PO Pendings: Count PO_PENDING_CREATED, PO_PENDING_EXR_CREATED, and WITHOUT PO items
      if (inv.currentStage === FlowStage.PO_PENDING_CREATED ||
          inv.currentStage === FlowStage.PO_PENDING_EXR_CREATED ||
          inv.statusDetail === 'WITHOUT PO') {
        s.pendingPO++;
      }

      // EXR Pending and WITHOUT PO status details
      if (inv.statusDetail === 'EXR PENDING') s.exrPending++;
      if (inv.statusDetail === 'WITHOUT PO') s.withoutPo++;

      // Ready to Post: Items in Posted stage
      if (inv.currentStage === FlowStage.MISSING_INVOICE_POSTED) s.readyPost++;
    });

    return s;
  }, [invoices]);

  const topMissingVendors = useMemo(() => {
    const vendors: Record<string, number> = {};
    invoices
      .filter(i => i.flowType === FlowType.MISSING_INVOICE && i.currentStage !== FlowStage.CLOSED)
      .forEach(i => {
        vendors[i.vendor] = (vendors[i.vendor] || 0) + (i.amount || 0);
      });
    return Object.entries(vendors)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [invoices]);

  const poCreatorBottleneck = useMemo(() => {
    const data: Record<string, number> = {};
    invoices
      .filter(i => i.poCreator && i.currentStage !== FlowStage.CLOSED)
      .forEach(i => {
        data[i.poCreator!] = (data[i.poCreator!] || 0) + (i.amount || 0);
      });
    return Object.entries(data)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [invoices]);

  const statusAllocation = [
    { name: 'Missing', value: stats.missing, color: '#f43f5e' }, 
    { name: 'PO Pending', value: stats.pendingPO, color: '#f59e0b' }, 
    { name: 'Ready', value: stats.readyPost, color: '#10b981' }, 
    { name: 'Payment', value: stats.paymentValidation, color: '#8b5cf6' },
  ].filter(d => d.value > 0);

  const formatEuro = (val: number) => new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      
      {/* Dynamic Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-8 border-b border-slate-800/50">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-600 rounded-lg shadow-lg shadow-brand-900/30">
               <Activity className="text-white" size={24} />
             </div>
             <h2 className="text-4xl font-black text-white tracking-tighter">Finance Command Center</h2>
          </div>
          <p className="text-slate-300 font-medium text-lg ml-11">Real-time procurement & posting orchestration.</p>
        </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Missing Invoices" value={stats.missing} subValue="Reconciliation Queue" icon={FileWarning} colorClass="text-rose-500" delay={0} gradient="bg-gradient-to-br from-rose-950/10 to-slate-900/40" />
        <StatCard title="PO Pendings" value={stats.pendingPO} subValue="Procurement Queue" icon={Clock} colorClass="text-amber-500" delay={100} gradient="bg-gradient-to-br from-amber-950/10 to-slate-900/40" />
        <StatCard title="EXR Pending" value={stats.exrPending} subValue="Expenses Review" icon={ShieldCheck} colorClass="text-cyan-500" delay={200} gradient="bg-gradient-to-br from-cyan-950/10 to-slate-900/40" />
        <StatCard title="Payment Queue" value={stats.paymentValidation} subValue="Treasury Workflow" icon={Wallet} colorClass="text-violet-500" delay={300} gradient="bg-gradient-to-br from-violet-950/10 to-slate-900/40" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Left Column - Large Charts */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Top Missing Vendors */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-1 h-full bg-rose-500/50"></div>
            <div className="flex items-center justify-between mb-8">
              <div>
                <h4 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                  <BarChart3 className="text-rose-500" size={20} />
                  Top Missing Vendor Exposure
                </h4>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-1">Total value of unreceived invoices per vendor</p>
              </div>
            </div>
            
            <div className="h-[280px]">
              {topMissingVendors.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMissingVendors} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '600' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={formatEuro} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      content={({ active, payload }) => {
                        if (active && payload?.length) return (
                          <div className="bg-slate-900 border border-slate-700 p-4 rounded-xl shadow-2xl">
                            <p className="text-slate-300 text-[10px] uppercase font-bold mb-1">{payload[0].payload.name}</p>
                            <p className="text-rose-400 text-xl font-black">{formatEuro(payload[0].value as number)}</p>
                          </div>
                        );
                        return null;
                      }}
                    />
                    <Bar dataKey="value" fill="url(#roseGradient)" radius={[6, 6, 0, 0]} barSize={40} />
                    <defs>
                      <linearGradient id="roseGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" />
                        <stop offset="100%" stopColor="#881337" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic">No missing invoices currently tracked.</div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PO Creator Bottleneck */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-amber-500/50"></div>
              <h4 className="text-sm font-black text-slate-200 uppercase tracking-widest mb-8 flex items-center gap-2">
                <Users size={16} className="text-amber-500" /> Procurement Bottlenecks
              </h4>
              <div className="h-[220px]">
                {poCreatorBottleneck.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={poCreatorBottleneck} layout="vertical" margin={{ left: -10, right: 30 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#cbd5e1', fontSize: 11, fontWeight: '700' }} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(val: number) => formatEuro(val)} />
                      <Bar dataKey="value" fill="#f59e0b" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">All POs processed.</div>
                )}
              </div>
            </div>

            {/* Stage Allocation */}
            <div className="bg-slate-900/50 border border-slate-800 rounded-3xl p-8 backdrop-blur-sm relative group">
              <div className="absolute top-0 left-0 w-1 h-full bg-brand-500/50"></div>
              <h4 className="text-sm font-black text-slate-200 uppercase tracking-widest mb-8 flex items-center gap-2">
                <TrendingUp size={16} className="text-brand-500" /> Pipeline Density
              </h4>
              <div className="h-[220px] flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusAllocation} cx="50%" cy="50%" innerRadius={60} outerRadius={85} paddingAngle={8} dataKey="value" stroke="none" cornerRadius={8}>
                      {statusAllocation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none mt-6">
                  <p className="text-2xl font-black text-white">{stats.active}</p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Active</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Status Detail & Alerts */}
        <div className="space-y-8">

           {/* Detail Cards - EXR vs WITHOUT PO */}
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-center shadow-lg">
                 <p className="text-3xl font-black text-white">{stats.exrPending}</p>
                 <p className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest mt-1">EXR PENDING</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-3xl text-center shadow-lg">
                 <p className="text-3xl font-black text-white">{stats.withoutPo}</p>
                 <p className="text-[10px] font-bold text-rose-400 uppercase tracking-widest mt-1">WITHOUT PO</p>
              </div>
           </div>

           {/* Quick Navigation Panel */}
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                <FileText size={80} className="text-brand-500" />
             </div>
             <h4 className="text-xs font-black text-brand-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                Actions Hub
             </h4>
             <div className="space-y-3">
               <button onClick={onNavigateToInvoices} className="w-full py-4 bg-slate-800 hover:bg-brand-600 text-slate-200 hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-3 border border-slate-700 hover:border-brand-500 shadow-xl">
                 Go to Invoices Queue <ArrowRight size={16} />
               </button>
               <p className="text-[10px] text-slate-500 font-bold text-center uppercase tracking-widest mt-4">
                 Manage processing across entities
               </p>
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};