import React, { useState, useMemo } from 'react';
import { Dashboard } from './Dashboard';
import { InvoiceList } from './InvoiceList';
import { InvoiceDetail } from './InvoiceDetail';
import { UploadModal } from './UploadModal';
import { ManualEntryModal } from './ManualEntryModal';
import { ReconRaptorModal } from './ReconRaptorModal';
import { AIAssistant } from './AIAssistant';
import { SignIn } from './SignIn';
import { MOCK_INVOICES as INITIAL_DATA, TEAM_STAGES } from '../constants';
import { Invoice, FlowStage, Evidence, TeamView, Attachment, StatusDetail, FlowType } from '../types';
import { Plus, Upload, Search, LayoutDashboard, FileText, CheckCircle2, RefreshCw, Filter, Users, Activity, Wallet, ArrowRight, LogOut, User, ShieldCheck, Landmark, Zap } from 'lucide-react';
import { clsx } from 'clsx';

type SortKey = 'createdAt' | 'amount' | 'vendor';
type SortDirection = 'asc' | 'desc';
type Page = 'dashboard' | 'invoices';

const App: React.FC = () => {
  const [user, setUser] = useState<{ name: string; role: string } | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_DATA);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [isReconRaptorModalOpen, setIsReconRaptorModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<TeamView>('RECON'); 
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'createdAt', direction: 'desc' });

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => {
      const term = searchTerm.toLowerCase();
      const matchesSearch = 
        inv.invoiceNumber.toLowerCase().includes(term) ||
        inv.vendor.toLowerCase().includes(term);
      
      if (!matchesSearch) return false;
      if (filterEntity !== 'ALL' && inv.entity !== filterEntity) return false;

      if (activeView === 'ALL') return true;
      
      // Payment view only shows items awaiting payout confirmation
      if (activeView === 'PAYMENT') return inv.paymentStatus === 'REQUESTED';

      // Reconciliation view shows its owned stages PLUS items that are Closed but not in the Payment Queue
      if (activeView === 'RECON') {
        const isReconStage = TEAM_STAGES.RECON.includes(inv.currentStage);
        const isClosedButRelevant = inv.currentStage === FlowStage.CLOSED && inv.paymentStatus !== 'REQUESTED';
        return isReconStage || isClosedButRelevant;
      }

      const allowedStages = TEAM_STAGES[activeView] || [];
      return allowedStages.includes(inv.currentStage);
    });

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortConfig.key) {
        case 'amount':
          comparison = (a.amount || 0) - (b.amount || 0);
          break;
        case 'vendor':
          comparison = a.vendor.localeCompare(b.vendor);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
      }
      return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [invoices, searchTerm, activeView, filterEntity, sortConfig]);

  const apReconInvoices = useMemo(() => filteredInvoices.filter(i => i.source === 'RECON'), [filteredInvoices]);
  const apManualInvoices = useMemo(() => filteredInvoices.filter(i => i.source !== 'RECON'), [filteredInvoices]);

  const viewCounts = useMemo(() => {
    const counts = { ALL: 0, RECON: 0, AP: 0, PAYMENT: 0 };
    invoices.forEach(inv => {
      counts.ALL++;
      if (inv.paymentStatus === 'REQUESTED') counts.PAYMENT++;
      if (TEAM_STAGES.AP.includes(inv.currentStage)) counts.AP++;
      if (TEAM_STAGES.RECON.includes(inv.currentStage) || (inv.currentStage === FlowStage.CLOSED && inv.paymentStatus !== 'REQUESTED')) {
        counts.RECON++;
      }
    });
    return counts;
  }, [invoices]);

  const syncSelectedInvoice = (updatedInvoices: Invoice[], id: string) => {
    if (selectedInvoice && selectedInvoice.id === id) {
      const refreshed = updatedInvoices.find(inv => inv.id === id);
      if (refreshed) setSelectedInvoice(refreshed);
    }
  };

  const handleUpdateStage = (id: string, newStage: FlowStage) => {
    setInvoices(prev => {
      const next = prev.map(inv => inv.id === id ? { ...inv, currentStage: newStage, updatedAt: new Date().toISOString() } : inv);
      syncSelectedInvoice(next, id);
      return next;
    });
  };

  const handleAddEvidence = (id: string, evidenceData: any) => {
    setInvoices(prev => {
      const next = prev.map(inv => {
        if (inv.id === id) {
          const newEvidence: Evidence = {
            ...evidenceData,
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            stageAddedAt: evidenceData.stageAddedAt || inv.currentStage
          };
          return { ...inv, evidence: [...inv.evidence, newEvidence] };
        }
        return inv;
      });
      syncSelectedInvoice(next, id);
      return next;
    });
  };

  const handleRequestPayment = (id: string) => {
    setInvoices(prev => {
      const next = prev.map(inv => inv.id === id ? { ...inv, paymentStatus: 'REQUESTED' } : inv);
      syncSelectedInvoice(next, id);
      return next;
    });
  };

  const handlePaymentValidate = (id: string, comments: string, attachments: Attachment[]) => {
     setInvoices(prev => {
        const next = prev.map(inv => {
          if (inv.id === id) {
            // SPEC: Does NOT: reopen flow, change status, create new stage.
            // Status stays CLOSED, but paymentStatus changes to PAID, 
            // causing it to move from Payment View back to Reconciliation View.
            return {
              ...inv,
              paymentStatus: 'PAID',
              updatedAt: new Date().toISOString(),
              paymentValidation: { 
                validatedBy: 'Treasury Team', 
                validatedAt: new Date().toISOString(), 
                comments, 
                attachments 
              }
            };
          }
          return inv;
        });
        syncSelectedInvoice(next, id);
        return next;
     });
  };

  const handleBulkUpload = (newInvoicesData: Partial<Invoice>[]) => {
    const now = new Date().toISOString();
    const newInvoices: Invoice[] = newInvoicesData.map((data, i) => ({
      id: `new-${Date.now()}-${i}`,
      invoiceNumber: data.invoiceNumber!,
      vendor: data.vendor!,
      amount: data.amount,
      entity: data.entity,
      poCreator: data.poCreator,
      source: 'EXCEL',
      statusDetail: 'NONE',
      submissionTimestamp: now,
      flowType: data.flowType!,
      currentStage: data.currentStage!,
      createdAt: now,
      updatedAt: now,
      evidence: [],
      paymentStatus: 'NONE',
      paymentBlocked: false
    }));
    setInvoices(prev => [...prev, ...newInvoices]);
  };

  const handleManualSubmit = (newInvoice: Invoice) => {
     setInvoices(prev => [newInvoice, ...prev]);
  };

  const TabButton = ({ view, label, icon: Icon, colorClass }: { view: TeamView, label: string, icon: any, colorClass: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={clsx(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 border",
        activeView === view 
          ? `bg-slate-800 border-slate-600 text-white shadow-lg ${colorClass}` 
          : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      )}
    >
      <Icon size={16} />
      {label}
      <span className={clsx("ml-1.5 text-xs px-2 py-0.5 rounded-md font-mono", activeView === view ? "bg-slate-950 text-white border border-slate-700" : "bg-slate-900/50 text-slate-500 border border-slate-800")}>
        {viewCounts[view]}
      </span>
    </button>
  );

  if (!user) {
    return <SignIn onSignIn={setUser} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand-500/30">
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="bg-brand-600 p-2 rounded-lg shadow-lg shadow-brand-900/20"><Activity className="text-white" size={20} /></div>
              <h1 className="text-xl font-black tracking-tight text-white hidden md:block uppercase">FinComms</h1>
            </div>
            <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setCurrentPage('dashboard')} className={clsx("px-4 py-1.5 rounded-md text-sm font-black uppercase tracking-tighter flex items-center gap-2 transition-all", currentPage === 'dashboard' ? "bg-brand-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}><LayoutDashboard size={16} /> Dashboard</button>
              <button onClick={() => setCurrentPage('invoices')} className={clsx("px-4 py-1.5 rounded-md text-sm font-black uppercase tracking-tighter flex items-center gap-2 transition-all", currentPage === 'invoices' ? "bg-brand-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}><FileText size={16} /> Invoices</button>
            </nav>
          </div>
          
          <div className="flex items-center gap-4">
             <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-black text-white uppercase tracking-tight">{user.name}</span>
                <span className="text-[10px] text-brand-400 font-black uppercase tracking-widest">{user.role}</span>
             </div>
             <button onClick={() => setUser(null)} className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all" title="Sign Out">
                <LogOut size={18} />
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'dashboard' ? (
          <Dashboard invoices={invoices} onNavigateToInvoices={() => setCurrentPage('invoices')} onSelectInvoice={setSelectedInvoice} />
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
            <div className="flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
              <div className="flex flex-wrap gap-2 p-1.5 bg-slate-900/80 rounded-2xl border border-slate-800 backdrop-blur-sm shadow-xl">
                <TabButton view="RECON" label="Reconciliation" icon={CheckCircle2} colorClass="text-emerald-400" />
                <TabButton view="AP" label="AP Processing" icon={RefreshCw} colorClass="text-brand-400" />
                <TabButton view="PAYMENT" label="Payment Queue" icon={Wallet} colorClass="text-violet-400" />
                <TabButton view="ALL" label="All Entries" icon={Users} colorClass="text-slate-200" />
              </div>
              <div className="flex flex-wrap items-center gap-3 w-full xl:w-auto">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="absolute left-3 top-2.5 text-slate-400" size={16} aria-hidden="true" />
                  <input type="text" placeholder="Search Invoices or Vendors..." className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:ring-2 focus:ring-brand-500/50 outline-none transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                </div>
                {activeView === 'AP' && (
                  <button onClick={() => setIsManualEntryModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-700 shadow-lg transition-all flex items-center gap-2"><Plus size={16} /> Add Manual</button>
                )}
                {activeView === 'RECON' && (
                  <>
                    <button onClick={() => setIsReconRaptorModalOpen(true)} className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 hover:scale-[1.02]"><Zap size={16} /> ReconRaptor</button>
                    <button onClick={() => setIsUploadModalOpen(true)} className="bg-brand-600 hover:bg-brand-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(79,70,229,0.3)] transition-all flex items-center gap-2 hover:scale-[1.02]"><Upload size={16} /> Deloitte Upload</button>
                  </>
                )}
              </div>
            </div>

            {activeView === 'AP' ? (
              <div className="space-y-12">
                <section>
                  <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="w-1.5 h-6 bg-brand-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                      <ArrowRight className="text-brand-400" size={18} /> 
                      FROM RECONCILIATION
                      <span className="text-[10px] font-black text-brand-400 bg-brand-950/40 px-2.5 py-1 rounded-lg border border-brand-900/30 ml-4 uppercase tracking-[0.2em]">Escalated Items</span>
                    </h3>
                  </div>
                  <InvoiceList invoices={apReconInvoices} onSelectInvoice={setSelectedInvoice} />
                </section>

                <section>
                  <div className="flex items-center gap-3 mb-6 px-2">
                    <div className="w-1.5 h-6 bg-orange-500 rounded-full shadow-[0_0_10px_rgba(249,115,22,0.5)]"></div>
                    <h3 className="text-xl font-black text-white flex items-center gap-2 tracking-tight">
                      <ArrowRight className="text-orange-400" size={18} /> 
                      DIRECT ENTRIES
                      <span className="text-[10px] font-black text-orange-400 bg-orange-950/40 px-2.5 py-1 rounded-lg border border-orange-900/30 ml-4 uppercase tracking-[0.2em]">Local Processing</span>
                    </h3>
                  </div>
                  <InvoiceList invoices={apManualInvoices} onSelectInvoice={setSelectedInvoice} />
                </section>
              </div>
            ) : activeView === 'PAYMENT' ? (
              <section className="relative overflow-hidden rounded-[3rem] p-1 bg-gradient-to-br from-violet-600/30 via-transparent to-brand-600/30">
                <div className="bg-slate-950/90 backdrop-blur-3xl rounded-[2.9rem] p-8 lg:p-12 border border-slate-800/50">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-12">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div className="p-4 bg-violet-600 rounded-3xl shadow-[0_15px_40px_rgba(139,92,246,0.3)] ring-4 ring-violet-500/10">
                          <Landmark className="text-white" size={32} />
                        </div>
                        <div>
                          <h3 className="text-5xl font-black text-white tracking-tighter leading-none">TREASURY HUB</h3>
                          <p className="text-violet-400 font-black text-xs uppercase tracking-[0.4em] mt-2 ml-1">Final Disbursement Orchestration</p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-lg max-w-xl font-medium leading-relaxed">Secure payment verification and bank file generation queue for all approved invoices across entities.</p>
                    </div>
                    <div className="flex items-center gap-6 bg-slate-900/50 px-8 py-6 rounded-3xl border border-slate-800 backdrop-blur-md self-start">
                       <div className="text-right">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Queue Value</p>
                          <p className="text-3xl font-black text-violet-400 font-mono tracking-tight">
                            €{new Intl.NumberFormat('en-IE').format(filteredInvoices.reduce((sum, i) => sum + (i.amount || 0), 0))}
                          </p>
                       </div>
                    </div>
                  </div>
                  <InvoiceList invoices={filteredInvoices} onSelectInvoice={setSelectedInvoice} />
                </div>
              </section>
            ) : (
              <InvoiceList invoices={filteredInvoices} onSelectInvoice={setSelectedInvoice} />
            )}
          </div>
        )}
      </main>

      {selectedInvoice && (
        <>
          <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-40 transition-opacity" onClick={() => setSelectedInvoice(null)} />
          <InvoiceDetail 
            invoice={selectedInvoice} 
            activeView={activeView}
            onClose={() => setSelectedInvoice(null)} 
            onUpdateStage={handleUpdateStage}
            onAddEvidence={handleAddEvidence}
            onPaymentValidate={handlePaymentValidate}
            onRequestPayment={handleRequestPayment}
          />
        </>
      )}

      {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleBulkUpload} existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))} />}
      {isManualEntryModalOpen && (
        <ManualEntryModal
          onClose={() => setIsManualEntryModalOpen(false)}
          onAdd={handleManualSubmit}
          existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))}
          simplified={activeView === 'RECON'}
        />
      )}
      {isReconRaptorModalOpen && (
        <ReconRaptorModal
          isOpen={isReconRaptorModalOpen}
          onClose={() => setIsReconRaptorModalOpen(false)}
          onImportComplete={() => {
            // Refresh invoices from API if using API, or just close modal
            setIsReconRaptorModalOpen(false);
          }}
          existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))}
        />
      )}
      <AIAssistant invoices={invoices} />
    </div>
  );
};

export default App;