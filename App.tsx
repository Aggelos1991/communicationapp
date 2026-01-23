
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Dashboard } from './components/Dashboard';
import { InvoiceList } from './components/InvoiceList';
import { InvoiceDetail } from './components/InvoiceDetail';
import { UploadModal } from './components/UploadModal';
import { UploadModalAP } from './components/UploadModalAP';
import { DeloitteUploadModal } from './components/DeloitteUploadModal';
import { ManualEntryModal } from './components/ManualEntryModal';
import { AIAssistant } from './components/AIAssistant';
import { SignIn } from './components/SignIn';
import { SettingsModal } from './components/SettingsModal';
import { TEAM_STAGES } from './constants';
import { Invoice, FlowStage, FlowType, Evidence, TeamView, Attachment, StatusDetail } from './types';
import { Plus, Upload, Search, LayoutDashboard, FileText, CheckCircle2, RefreshCw, Filter, Users, Activity, Wallet, ArrowRight, LogOut, User, Settings } from 'lucide-react';
import { clsx } from 'clsx';
import { authService, type AuthUser } from './services/authService';
import api from './lib/api';

type SortKey = 'createdAt' | 'amount' | 'vendor';
type SortDirection = 'asc' | 'desc';
type Page = 'dashboard' | 'invoices';

const App: React.FC = () => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [totpVerified, setTotpVerified] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoadingInvoices, setIsLoadingInvoices] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploadModalAPOpen, setIsUploadModalAPOpen] = useState(false);
  const [isDeloitteUploadOpen, setIsDeloitteUploadOpen] = useState(false);
  const [isManualEntryModalOpen, setIsManualEntryModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  const [searchTerm, setSearchTerm] = useState('');
  const [activeView, setActiveView] = useState<TeamView>('RECON'); // Default to Reconciliation first
  const [filterEntity, setFilterEntity] = useState<string>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: SortDirection }>({ key: 'createdAt', direction: 'desc' });

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const session = await authService.getSession();
        if (session?.user) {
          const authUser = authService.transformUser(session.user);
          // Only set user if TOTP was verified in this session
          // Existing sessions are already verified
          setUser(authUser);
          setTotpVerified(true);
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkSession();

    // Listen for auth state changes - only accept if TOTP verified
    const { data: { subscription } } = authService.onAuthStateChange((authUser) => {
      // Only update user state if TOTP was verified or user is signing out
      if (!authUser) {
        setUser(null);
        setTotpVerified(false);
      } else if (totpVerified) {
        setUser(authUser);
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [totpVerified]);

  // Load invoices function - wrapped in useCallback to prevent infinite loops
  const loadInvoices = useCallback(async () => {
    if (!user) {
      setInvoices([]);
      setIsLoadingInvoices(false);
      return;
    }

    setIsLoadingInvoices(true);
    try {
      const invoices = await api.invoices.getAll();
      setInvoices(invoices);
    } catch (error) {
      console.error('Error loading invoices:', error);
      alert('Failed to load invoices. Please refresh the page.');
    } finally {
      setIsLoadingInvoices(false);
    }
  }, [user]);

  // Load invoices when user changes
  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const filteredInvoices = useMemo(() => {
    let result = invoices.filter(inv => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        inv.invoiceNumber?.toLowerCase().includes(term) ||
        inv.vendor?.toLowerCase().includes(term);
      
      if (!matchesSearch) return false;
      if (filterEntity !== 'ALL' && inv.entity !== filterEntity) return false;

      if (activeView === 'ALL') return true;
      if (activeView === 'PAYMENT') return inv.paymentStatus === 'REQUESTED';

      if (activeView === 'RECON') {
        // Exclude invoices that have been sent to Payment Queue
        if (inv.paymentStatus === 'REQUESTED') return false;
        // Exclude CLOSED direct entries (PO_PENDING flow) - they stay in AP/Direct Entries
        if (inv.currentStage === FlowStage.CLOSED && inv.flowType === FlowType.PO_PENDING) return false;
        const isReconStage = TEAM_STAGES.RECON.includes(inv.currentStage);
        return isReconStage;
      }

      if (activeView === 'AP') {
        const isAPStage = TEAM_STAGES.AP.includes(inv.currentStage);
        const isClosedDirectEntry = inv.currentStage === FlowStage.CLOSED && inv.flowType === FlowType.PO_PENDING && inv.paymentStatus !== 'REQUESTED';
        return isAPStage || isClosedDirectEntry;
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

  // Invoices that were escalated from RECON team (MISSING_INVOICE flow at AP stages)
  // This includes "Sent to Vendor" which is part of the reconciliation flow
  const apReconInvoices = useMemo(() =>
    filteredInvoices.filter(i =>
      i.flowType === FlowType.MISSING_INVOICE &&
      TEAM_STAGES.AP.includes(i.currentStage)
    ),
    [filteredInvoices]
  );

  // Direct entries: PO_PENDING flow only (not MISSING_INVOICE)
  const apManualInvoices = useMemo(() =>
    filteredInvoices.filter(i =>
      i.flowType === FlowType.PO_PENDING &&
      (TEAM_STAGES.AP.includes(i.currentStage) ||
       (i.currentStage === FlowStage.CLOSED && i.paymentStatus !== 'REQUESTED'))
    ),
    [filteredInvoices]
  );

  const viewCounts = useMemo(() => {
    const counts = { ALL: 0, RECON: 0, AP: 0, PAYMENT: 0 };
    invoices.forEach(inv => {
      counts.ALL++;

      // Payment Queue: only REQUESTED status
      if (inv.paymentStatus === 'REQUESTED') {
        counts.PAYMENT++;
        return; // Don't count in other categories
      }

      // AP Processing: AP stages + closed direct entries
      if (TEAM_STAGES.AP.includes(inv.currentStage) ||
          (inv.currentStage === FlowStage.CLOSED && inv.flowType === FlowType.PO_PENDING)) {
        counts.AP++;
      }

      // Reconciliation: RECON stages + closed reconciliation items
      if (TEAM_STAGES.RECON.includes(inv.currentStage) ||
          (inv.currentStage === FlowStage.CLOSED && inv.flowType === FlowType.MISSING_INVOICE)) {
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

  const handleUpdateStage = async (id: string, newStage: FlowStage) => {
    if (!user) return;

    try {
      const updatedInvoice = await api.invoices.update(id, { currentStage: newStage });

      // Update selected invoice if it's the one being updated
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      // Reload all invoices to ensure dashboard updates
      await loadInvoices();
    } catch (error) {
      console.error('Error updating stage:', error);
      alert('Failed to update stage. Please try again.');
    }
  };

  const handleAddEvidence = async (id: string, evidenceData: any) => {
    if (!user) return;

    try {
      const invoice = invoices.find(inv => inv.id === id);
      if (!invoice) return;

      await api.evidence.create({
        invoiceId: id,
        type: evidenceData.type,
        content: evidenceData.content,
        stageAddedAt: evidenceData.stageAddedAt || invoice.currentStage,
        attachments: evidenceData.attachments || [],
      });

      // Reload the specific invoice to get updated evidence
      const updatedInvoice = await api.invoices.getById(id);

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      // Reload all invoices
      await loadInvoices();
    } catch (error) {
      console.error('Error adding evidence:', error);
      alert('Failed to add evidence. Please try again.');
    }
  };

  const handleRequestPayment = async (id: string) => {
    if (!user) return;

    try {
      const updatedInvoice = await api.invoices.update(id, { paymentStatus: 'REQUESTED' });

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      // Reload invoices to update dashboard
      await loadInvoices();
    } catch (error) {
      console.error('Error requesting payment:', error);
      alert('Failed to request payment. Please try again.');
    }
  };

  const handleBulkRequestPayment = async (ids: string[]) => {
    if (!user) return;

    try {
      await Promise.all(ids.map(id => api.invoices.update(id, { paymentStatus: 'REQUESTED' })));
      await loadInvoices();
    } catch (error) {
      console.error('Error bulk requesting payment:', error);
      alert('Failed to request payment for some invoices. Please try again.');
    }
  };

  const handlePaymentValidate = async (id: string, comments: string, attachments: Attachment[]) => {
    if (!user) return;

    try {
      // Create payment validation (automatically updates invoice to PAID)
      await api.paymentValidations.create({
        invoiceId: id,
        comments: comments || null,
        attachments: attachments || [],
      });

      // Refresh invoice
      const updatedInvoice = await api.invoices.getById(id);

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      // Reload all invoices to update dashboard
      await loadInvoices();
    } catch (error) {
      console.error('Error validating payment:', error);
      alert('Failed to validate payment. Please try again.');
    }
  };

  const handleUpdateInvoice = async (id: string, updates: Partial<Invoice>) => {
    if (!user) return;

    try {
      const updatedInvoice = await api.invoices.update(id, updates);

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      // Reload all invoices to ensure consistency
      await loadInvoices();
    } catch (error) {
      console.error('Error updating invoice:', error);
      alert('Failed to update invoice. Please try again.');
    }
  };

  const handleTogglePaymentBlocked = async (id: string, blocked: boolean) => {
    if (!user) return;

    try {
      await api.invoices.update(id, { paymentBlocked: blocked });
      // Reload all invoices to update UI
      await loadInvoices();
    } catch (error) {
      console.error('Error toggling payment blocked:', error);
      alert('Failed to update payment blocked status. Please try again.');
    }
  };

  const handleBulkUpdatePaymentBlocked = async (ids: string[], blocked: boolean) => {
    if (!user) return;

    try {
      await api.invoices.bulkUpdate(ids, { paymentBlocked: blocked });
      await loadInvoices();
    } catch (error) {
      console.error('Error bulk updating payment blocked:', error);
      alert('Failed to update payment blocked status. Please try again.');
    }
  };

  const handleBulkUpdateStage = async (ids: string[], stage: FlowStage) => {
    if (!user) return;

    console.log('Bulk update stage called:', { ids, stage });
    try {
      const result = await api.invoices.bulkUpdate(ids, { currentStage: stage });
      console.log('Bulk update result:', result);
      await loadInvoices();
    } catch (error) {
      console.error('Error bulk updating stage:', error);
      alert('Failed to update invoice stages. Please try again.');
    }
  };

  // Revert invoice to previous stage
  const handleRevertStage = async (id: string) => {
    if (!user) return;

    const invoice = invoices.find(inv => inv.id === id);
    if (!invoice) return;

    // Get the flow stages for this invoice's flow type
    const flowStages = invoice.flowType === FlowType.MISSING_INVOICE
      ? [FlowStage.MISSING_INVOICE_MISSING, FlowStage.MISSING_INVOICE_SENT_TO_VENDOR, FlowStage.MISSING_INVOICE_SENT_TO_AP, FlowStage.MISSING_INVOICE_PO_PENDING, FlowStage.MISSING_INVOICE_POSTED, FlowStage.CLOSED]
      : [FlowStage.PO_PENDING_RECEIVED, FlowStage.PO_PENDING_SENT, FlowStage.PO_PENDING_CREATED, FlowStage.PO_PENDING_EXR_CREATED, FlowStage.CLOSED];

    const currentIndex = flowStages.indexOf(invoice.currentStage);

    // Can't revert if already at first stage
    if (currentIndex <= 0) {
      alert('Cannot revert - invoice is already at the initial stage.');
      return;
    }

    const previousStage = flowStages[currentIndex - 1];

    try {
      const updatedInvoice = await api.invoices.update(id, { currentStage: previousStage });

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      await loadInvoices();
    } catch (error) {
      console.error('Error reverting stage:', error);
      alert('Failed to revert stage. Please try again.');
    }
  };

  // Bulk revert invoices to previous stage
  const handleBulkRevertStage = async (ids: string[]) => {
    if (!user) return;

    try {
      for (const id of ids) {
        const invoice = invoices.find(inv => inv.id === id);
        if (!invoice) continue;

        const flowStages = invoice.flowType === FlowType.MISSING_INVOICE
          ? [FlowStage.MISSING_INVOICE_MISSING, FlowStage.MISSING_INVOICE_SENT_TO_VENDOR, FlowStage.MISSING_INVOICE_SENT_TO_AP, FlowStage.MISSING_INVOICE_PO_PENDING, FlowStage.MISSING_INVOICE_POSTED, FlowStage.CLOSED]
          : [FlowStage.PO_PENDING_RECEIVED, FlowStage.PO_PENDING_SENT, FlowStage.PO_PENDING_CREATED, FlowStage.PO_PENDING_EXR_CREATED, FlowStage.CLOSED];

        const currentIndex = flowStages.indexOf(invoice.currentStage);

        if (currentIndex > 0) {
          const previousStage = flowStages[currentIndex - 1];
          await api.invoices.update(id, { currentStage: previousStage });
        }
      }

      await loadInvoices();
    } catch (error) {
      console.error('Error bulk reverting stages:', error);
      alert('Failed to revert some invoice stages. Please try again.');
    }
  };

  // Update block evidence with compressed file attachment
  const handleUpdateBlockEmail = async (id: string, reason: string, attachment?: Attachment) => {
    if (!user) return;

    try {
      const updateData: any = {
        blockReason: reason
      };

      // Store attachment as JSON string if provided
      if (attachment) {
        updateData.blockAttachment = JSON.stringify(attachment);
      }

      const updatedInvoice = await api.invoices.update(id, updateData);

      if (selectedInvoice?.id === id) {
        setSelectedInvoice(updatedInvoice);
      }

      await loadInvoices();
    } catch (error) {
      console.error('Error updating block evidence:', error);
      alert('Failed to save block evidence. Please try again.');
    }
  };

  const handleBulkUpload = async (newInvoicesData: Partial<Invoice>[]) => {
    if (!user) return;

    try {
      const createdInvoices: Invoice[] = [];

      for (const data of newInvoicesData) {
        const createdInvoice = await api.invoices.create({
          ...data,
          source: data.source || 'EXCEL',
          statusDetail: data.statusDetail || 'NONE',
          paymentStatus: data.paymentStatus || 'NONE',
          currency: data.currency || 'EUR',
        });

        createdInvoices.push(createdInvoice);
      }

      // Reload all invoices after bulk upload
      await loadInvoices();
    } catch (error: any) {
      console.error('Error bulk uploading invoices:', error);
      if (error.message?.includes('duplicate')) {
        alert('Some invoices have duplicate invoice numbers. Please check your Excel file.');
      } else {
        alert('Failed to upload invoices. Please try again.');
      }
    }
  };

  const handleManualSubmit = async (newInvoice: Invoice) => {
    if (!user) return;

    try {
      const createdInvoice = await api.invoices.create(newInvoice);

      // If there's evidence (communication notes), create it for the invoice
      if (newInvoice.evidence && newInvoice.evidence.length > 0) {
        for (const ev of newInvoice.evidence) {
          await api.evidence.create({
            invoiceId: createdInvoice.id,
            type: ev.type,
            content: ev.content,
            stageAddedAt: ev.stageAddedAt,
            attachments: ev.attachments || [],
          });
        }
      }

      // Reload all invoices after manual submission
      await loadInvoices();
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      if (error.message?.includes('duplicate') || error.code === '23505') {
        alert('An invoice with this number already exists. Please use a different invoice number.');
      } else {
        alert('Failed to create invoice. Please try again.');
      }
    }
  };

  const handleDeleteInvoice = async (id: string) => {
    if (!user) return;
    if (!confirm('Are you sure you want to delete this invoice?')) return;

    try {
      await api.invoices.delete(id);

      // Close detail modal if this invoice was selected
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
      }

      // Reload invoices from server to ensure fresh data
      await loadInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      alert('Failed to delete invoice. Please try again.');
    }
  };

  const handleBulkDelete = async (ids: string[]) => {
    if (!user) return;
    if (!confirm(`Are you sure you want to delete ${ids.length} invoices?`)) return;

    try {
      await api.invoices.bulkDelete(ids);

      // Close detail modal if selected invoice was deleted
      if (selectedInvoice && ids.includes(selectedInvoice.id)) {
        setSelectedInvoice(null);
      }

      // Reload invoices from server to ensure fresh data
      await loadInvoices();
    } catch (error) {
      console.error('Error deleting invoices:', error);
      alert('Failed to delete invoices. Please try again.');
    }
  };

  const TabButton = ({ view, label, icon: Icon, colorClass }: { view: TeamView, label: string, icon: any, colorClass: string }) => (
    <button
      onClick={() => setActiveView(view)}
      className={clsx(
        "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold uppercase tracking-tight flex items-center transition-all duration-200 border",
        activeView === view
          ? `bg-slate-800 border-slate-600 text-white shadow-lg ${colorClass}`
          : "bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
      )}
    >
      <Icon size={16} />
      {label}
      <span className={clsx("ml-1.5 text-xs px-2 py-0.5 rounded-md font-mono font-medium", activeView === view ? "bg-slate-950 text-white border border-slate-700" : "bg-slate-900/50 text-slate-500 border border-slate-800")}>
        {viewCounts[view]}
      </span>
    </button>
  );

  const handleSignOut = async () => {
    try {
      await authService.signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show loading state while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-brand-600/20 border-t-brand-600 rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <SignIn onSignIn={(authUser) => {
      setUser(authUser);
      setTotpVerified(true);
    }} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans selection:bg-brand-500/30">
      <header className="sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="bg-brand-600 p-2 rounded-lg shadow-lg shadow-brand-900/20"><Activity className="text-white" size={20} /></div>
              <h1 className="text-xl font-extrabold tracking-tighter text-white hidden md:block" style={{letterSpacing: '-0.04em'}}>FinComms</h1>
            </div>
            <nav className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button onClick={() => setCurrentPage('dashboard')} className={clsx("px-4 py-1.5 rounded-md text-sm font-bold uppercase tracking-tight flex items-center gap-2 transition-all", currentPage === 'dashboard' ? "bg-brand-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}><LayoutDashboard size={16} /> Dashboard</button>
              <button onClick={() => setCurrentPage('invoices')} className={clsx("px-4 py-1.5 rounded-md text-sm font-bold uppercase tracking-tight flex items-center gap-2 transition-all", currentPage === 'invoices' ? "bg-brand-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50")}><FileText size={16} /> Invoices</button>
            </nav>
          </div>
          
          <div className="flex items-center gap-2">
             <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 text-slate-400 hover:text-brand-400 hover:bg-slate-800 rounded-xl transition-all" title="Settings">
                <Settings size={18} />
             </button>
             <button onClick={handleSignOut} className="p-2.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-xl transition-all" title="Sign Out">
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
                {activeView === 'RECON' && (
                  <>
                    <button onClick={() => setIsManualEntryModalOpen(true)} className="bg-slate-800 hover:bg-slate-700 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border border-slate-700 shadow-lg transition-all flex items-center gap-2"><Plus size={16} /> Add Manual</button>
                    <button onClick={() => setIsDeloitteUploadOpen(true)} className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all flex items-center gap-2 hover:scale-[1.02]"><Upload size={16} /> Deloitte Upload</button>
                  </>
                )}
                {activeView === 'AP' && (
                  <button onClick={() => setIsUploadModalAPOpen(true)} className="bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest shadow-[0_10px_30px_rgba(234,88,12,0.3)] transition-all flex items-center gap-2 hover:scale-[1.02]"><Upload size={16} /> Import Excel</button>
                )}
              </div>
            </div>

            {activeView === 'AP' ? (
              <section>
                <InvoiceList
                  invoices={filteredInvoices}
                  onSelectInvoice={setSelectedInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  onBulkDelete={handleBulkDelete}
                  activeView="AP"
                  onBulkUpdateStage={handleBulkUpdateStage}
                  onRevertStage={handleRevertStage}
                  onBulkRevertStage={handleBulkRevertStage}
                />
              </section>
            ) : activeView === 'RECON' ? (
              <section>
                <div className="flex items-center gap-3 mb-6 px-2">
                  <div className="w-1.5 h-6 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2" style={{letterSpacing: '-0.02em'}}>
                    <ArrowRight className="text-emerald-400" size={18} />
                    RECONCILIATION QUEUE
                    <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-900/30 ml-4 uppercase tracking-wider">Active Invoices</span>
                  </h3>
                </div>
                <InvoiceList
                  invoices={filteredInvoices}
                  onSelectInvoice={setSelectedInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  onBulkDelete={handleBulkDelete}
                  activeView={activeView}
                  onTogglePaymentBlocked={handleTogglePaymentBlocked}
                  onBulkUpdatePaymentBlocked={handleBulkUpdatePaymentBlocked}
                  onBulkUpdateStage={handleBulkUpdateStage}
                  onBulkRequestPayment={handleBulkRequestPayment}
                  onRevertStage={handleRevertStage}
                  onBulkRevertStage={handleBulkRevertStage}
                  onUpdateBlockEmail={handleUpdateBlockEmail}
                />
              </section>
            ) : activeView === 'PAYMENT' ? (
              <section>
                <div className="flex items-center gap-3 mb-6 px-2">
                  <div className="w-1.5 h-6 bg-violet-500 rounded-full shadow-[0_0_10px_rgba(139,92,246,0.5)]"></div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2" style={{letterSpacing: '-0.02em'}}>
                    <ArrowRight className="text-violet-400" size={18} />
                    PAYMENT QUEUE
                    <span className="text-[10px] font-semibold text-violet-400 bg-violet-950/40 px-2.5 py-1 rounded-lg border border-violet-900/30 ml-4 uppercase tracking-wider">Pending Payments</span>
                  </h3>
                </div>
                <InvoiceList
                  invoices={filteredInvoices}
                  onSelectInvoice={setSelectedInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  onBulkDelete={handleBulkDelete}
                  activeView="PAYMENT"
                  onBulkUpdateStage={handleBulkUpdateStage}
                  onRevertStage={handleRevertStage}
                  onBulkRevertStage={handleBulkRevertStage}
                />
              </section>
            ) : (
              <section>
                <div className="flex items-center gap-3 mb-6 px-2">
                  <div className="w-1.5 h-6 bg-slate-500 rounded-full shadow-[0_0_10px_rgba(148,163,184,0.5)]"></div>
                  <h3 className="text-xl font-extrabold text-white flex items-center gap-2" style={{letterSpacing: '-0.02em'}}>
                    <ArrowRight className="text-slate-400" size={18} />
                    ALL ENTRIES
                    <span className="text-[10px] font-semibold text-slate-400 bg-slate-950/40 px-2.5 py-1 rounded-lg border border-slate-900/30 ml-4 uppercase tracking-wider">Complete Overview</span>
                  </h3>
                </div>
                <InvoiceList
                  invoices={filteredInvoices}
                  onSelectInvoice={setSelectedInvoice}
                  onDeleteInvoice={handleDeleteInvoice}
                  onBulkDelete={handleBulkDelete}
                  activeView="ALL"
                  onBulkUpdateStage={handleBulkUpdateStage}
                  onRevertStage={handleRevertStage}
                  onBulkRevertStage={handleBulkRevertStage}
                />
              </section>
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
            onUpdateInvoice={handleUpdateInvoice}
            onAddEvidence={handleAddEvidence}
            onPaymentValidate={handlePaymentValidate}
            onRequestPayment={handleRequestPayment}
            onRevertStage={handleRevertStage}
          />
        </>
      )}

      {isUploadModalOpen && <UploadModal onClose={() => setIsUploadModalOpen(false)} onUpload={handleBulkUpload} existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))} />}
      {isUploadModalAPOpen && (
        <UploadModalAP
          onClose={() => setIsUploadModalAPOpen(false)}
          onUpload={handleBulkUpload}
          existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))}
          userEmail={user?.email}
          userRole={user?.role}
        />
      )}
      {isDeloitteUploadOpen && (
        <DeloitteUploadModal
          onClose={() => setIsDeloitteUploadOpen(false)}
          onUpload={handleBulkUpload}
          existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))}
        />
      )}
      {isManualEntryModalOpen && (
        <ManualEntryModal
          onClose={() => setIsManualEntryModalOpen(false)}
          onAdd={handleManualSubmit}
          existingInvoiceNumbers={new Set(invoices.map(i => i.invoiceNumber))}
          existingInvoices={invoices}
          simplified={activeView === 'RECON'}
          userEmail={user?.email}
          userRole={user?.role}
        />
      )}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          userEmail={user?.email}
        />
      )}
      <AIAssistant invoices={invoices} />
    </div>
  );
};

export default App;
