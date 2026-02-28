import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Trash2, ChevronDown, FolderPlus, FileInput, FileText, Download, Wallet, RefreshCw, Settings, Plane, MapPin, Globe, Compass, Languages } from 'lucide-react';
import { AppState, Family, COUNTRIES, ORIGIN_COUNTRIES } from './types';
import { ExpenseForm } from './components/ExpenseForm';
import { Summary } from './components/Summary';
import { ExpenseList } from './components/ExpenseList';
import { SettingsModal } from './components/SettingsModal';
import { createLedgerId, saveLedger, loadLedger } from './services/storageService';
import { exportToMarkdown, exportToPDF } from './services/exportService';
import { useTranslation } from './i18n/useTranslation';
import { Language, LANGUAGE_NAMES, getLanguageByCurrency } from './i18n/translations';

// Constants
const LEDGER_LIST_KEY = 'my_ledgers_v1';
const DEFAULT_RATE = 2200; // Default IDR rate as fallback

interface LedgerMeta {
  id: string;
  name: string;
  lastAccess: number;
}

const DEFAULT_FAMILIES: Family[] = [
  { id: 'f1', name: '家庭 1', count: 4 },
  { id: 'f2', name: '家庭 2', count: 2 }
];

const DEFAULT_STATE: AppState = {
  ledgerName: 'New Ledger',
  expenses: [],
  exchangeRate: DEFAULT_RATE,
  families: DEFAULT_FAMILIES,
  currencyCode: 'IDR',
  destination: '印度尼西亚',
  baseCurrency: 'CNY',
  originCountry: '中国',
  lastUpdated: Date.now()
};

// Helper to fetch rate - fetches from base currency to target currency
const fetchExchangeRate = async (baseCurrency: string, targetCurrency: string): Promise<number | null> => {
  try {
    const res = await fetch(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data.rates[targetCurrency];
  } catch (e) {
    console.error("Failed to fetch exchange rate:", e);
    return null;
  }
};

const App: React.FC = () => {
  // --- i18n ---
  const { t, language, setLanguage } = useTranslation();

  // Auto-set language based on origin country
  const updateLanguageFromOrigin = useCallback((originCountry: string) => {
    const origin = ORIGIN_COUNTRIES.find(c => c.name === originCountry);
    if (origin) {
      setLanguage(origin.language);
    } else {
      setLanguage('en');
    }
  }, [setLanguage]);

  // --- Global State ---
  const [ledgers, setLedgers] = useState<LedgerMeta[]>(() => {
    try {
      const saved = localStorage.getItem(LEDGER_LIST_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [activeId, setActiveId] = useState<string | null>(null);

  // --- Ledger Data State ---
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [activeTab, setActiveTab] = useState<'expenses' | 'summary'>('summary');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLedgerMenu, setShowLedgerMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [rateLoading, setRateLoading] = useState(false);

  // --- Persistence of Ledger List ---
  useEffect(() => {
    localStorage.setItem(LEDGER_LIST_KEY, JSON.stringify(ledgers));
  }, [ledgers]);

  // --- Initialization Logic ---
  const initApp = useCallback(async () => {
    if (ledgers.length > 0) {
      // Load the most recently accessed ledger
      const mostRecent = ledgers.sort((a, b) => b.lastAccess - a.lastAccess)[0];
      setActiveId(mostRecent.id);

      const data = loadLedger(mostRecent.id);
      if (data) {
        // Migration logic for old data
        if (!data.families) {
          data.families = [
            { id: 'f1', name: '家庭 1', count: (data as any).family1Count || 4 },
            { id: 'f2', name: '家庭 2', count: (data as any).family2Count || 2 }
          ];
          data.currencyCode = 'IDR';
          data.destination = '印度尼西亚';
        }
        // Migration: add baseCurrency and originCountry if missing
        if (!data.baseCurrency) {
          data.baseCurrency = 'CNY';
        }
        if (!data.originCountry) {
          data.originCountry = '中国';
        }
        setState(data);
        updateLanguageFromOrigin(data.originCountry);
      }
    } else {
      // First time user: Create default
      const defaultData = {
        ...DEFAULT_STATE,
        ledgerName: "我的旅行账本"
      };
      const id = createLedgerId();
      saveLedger(id, defaultData);

      const newMeta = { id, name: defaultData.ledgerName, lastAccess: Date.now() };
      setLedgers([newMeta]);
      setActiveId(id);
      setState(defaultData);
      updateLanguageFromOrigin(defaultData.originCountry);

      // Fetch latest rate in background
      const rate = await fetchExchangeRate(defaultData.baseCurrency, 'IDR');
      if (rate) {
        setState(prev => {
          const updated = { ...prev, exchangeRate: rate };
          saveLedger(id, updated);
          return updated;
        });
      }
    }
  }, [ledgers, updateLanguageFromOrigin]);

  useEffect(() => {
    if (!activeId) {
       const hasRun = document.body.dataset.initRun;
       if (!hasRun) {
         document.body.dataset.initRun = "true";
         initApp();
       }
    }
  }, [activeId, initApp]);

  // --- Load Data when Active ID Changes ---
  useEffect(() => {
    if (!activeId) return;
    const data = loadLedger(activeId);
    if (data) {
        // Migration logic here as well just in case
        if (!data.families) {
          data.families = [
            { id: 'f1', name: '家庭 1', count: (data as any).family1Count || 4 },
            { id: 'f2', name: '家庭 2', count: (data as any).family2Count || 2 }
          ];
          data.currencyCode = 'IDR';
          data.destination = '印度尼西亚';
        }
        // Migration: add baseCurrency and originCountry if missing
        if (!data.baseCurrency) {
          data.baseCurrency = 'CNY';
        }
        if (!data.originCountry) {
          data.originCountry = '中国';
        }
        setState(data);
        updateLanguageFromOrigin(data.originCountry);
        setLedgers(prev => prev.map(L =>
             L.id === activeId ? { ...L, name: data.ledgerName, lastAccess: Date.now() } : L
        ));
    }
  }, [activeId, updateLanguageFromOrigin]);

  // --- Save Data Effect ---
  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => {
      saveLedger(activeId, state);
      setLedgers(prev => prev.map(L =>
        L.id === activeId && L.name !== state.ledgerName
          ? { ...L, name: state.ledgerName }
          : L
      ));
    }, 500);
    return () => clearTimeout(timer);
  }, [state, activeId]);

  // --- Handlers ---
  const handleCreateNewLedger = async () => {
    const name = window.prompt("请输入新账本名称:", "新旅行账本");
    if (!name) return;

    const newState = { ...DEFAULT_STATE, ledgerName: name, lastUpdated: Date.now() };
    const newId = createLedgerId();
    saveLedger(newId, newState);

    const newMeta = { id: newId, name: name, lastAccess: Date.now() };
    setLedgers(prev => [...prev, newMeta]);
    setActiveId(newId);
    setState(newState);
    setShowLedgerMenu(false);

    const rate = await fetchExchangeRate('IDR');
    if (rate) setState(prev => ({...prev, exchangeRate: rate}));
  };

  const handleSwitchLedger = (id: string) => {
    setActiveId(id);
    setShowLedgerMenu(false);
  };

  const handleRefreshRate = async () => {
    setRateLoading(true);
    const rate = await fetchExchangeRate(state.baseCurrency, state.currencyCode);
    setRateLoading(false);
    if (rate) {
      if(window.confirm(t('rateUpdateConfirm', { base: state.baseCurrency, rate: rate.toFixed(2), target: state.currencyCode }))) {
        setState(prev => ({...prev, exchangeRate: rate}));
      }
    } else {
      alert(t('rateFetchFailed'));
    }
  };

  const handleSaveSettings = async (ledgerName: string, families: Family[], destination: string, currency: string, originCountry: string, baseCurrency: string) => {
    let newRate = state.exchangeRate;

    // Fetch new rate if currency or base currency changed
    if (currency !== state.currencyCode || baseCurrency !== state.baseCurrency) {
      setRateLoading(true);
      const rate = await fetchExchangeRate(baseCurrency, currency);
      setRateLoading(false);
      if (rate) newRate = rate;
    }

    // Update language based on origin country
    updateLanguageFromOrigin(originCountry);

    setState(prev => ({
      ...prev,
      ledgerName,
      families,
      destination,
      currencyCode: currency,
      exchangeRate: newRate,
      originCountry,
      baseCurrency
    }));
    setShowSettingsModal(false);
  };

  const handleExportJSON = () => {
    const dataStr = JSON.stringify(state);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${state.ledgerName}_backup.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json';
    input.onchange = (e: any) => {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string);
                if(json.ledgerName && json.expenses) {
                    // Basic validation passed
                    // Ensure migration if importing old json
                    if (!json.families) {
                      json.families = DEFAULT_FAMILIES;
                      json.currencyCode = 'IDR';
                      json.destination = '印度尼西亚';
                    }
                    // Migration: add baseCurrency and originCountry if missing
                    if (!json.baseCurrency) {
                      json.baseCurrency = 'CNY';
                    }
                    if (!json.originCountry) {
                      json.originCountry = '中国';
                    }
                    setState(json);
                    updateLanguageFromOrigin(json.originCountry);
                    alert(t('importSuccess'));
                } else {
                    alert(t('invalidFormat'));
                }
            } catch (err) {
                alert(t('parseFailed'));
            }
        };
        reader.readAsText(file);
    };
    input.click();
  };

  const handleExportMarkdown = () => {
    exportToMarkdown(state);
  };

  const handleExportPDF = async () => {
    setExportLoading(true);
    // Capture the hidden container which includes both Summary and List
    await exportToPDF('pdf-export-container', state.ledgerName);
    setExportLoading(false);
  };

  return (
    <div className="min-h-screen pb-20 relative" id="app-content">
      {/* Header Background Layer - Ocean to Sunset Gradient */}
      <div className="absolute top-0 left-0 right-0 h-72 bg-gradient-to-br from-sky-400 via-blue-500 to-orange-400 z-0" />

      {/* Decorative travel elements */}
      <div className="absolute top-16 right-8 text-white/10 z-0">
        <Plane size={120} strokeWidth={1} />
      </div>
      <div className="absolute top-32 left-4 text-white/10 z-0">
        <Globe size={80} strokeWidth={1} />
      </div>

      {/* Header Content Layer - High Z-Index for Dropdowns */}
      <header className="relative z-30 p-4 pb-12 text-white pointer-events-none">
        <div className="flex justify-between items-center mb-4 pointer-events-auto">
          <div className="relative">
            <button
              onClick={() => setShowLedgerMenu(!showLedgerMenu)}
              className="flex items-center gap-2 font-bold text-lg hover:bg-white/20 px-3 py-1.5 rounded-xl transition-all backdrop-blur-sm border border-white/10"
            >
              <Compass size={22} className="text-yellow-200" />
              {state.ledgerName}
              <ChevronDown size={16} className="opacity-70" />
            </button>

            {/* Ledger Menu */}
            {showLedgerMenu && (
              <div className="absolute top-full left-0 mt-2 w-56 glass-card rounded-xl shadow-xl overflow-hidden text-gray-800 z-50">
                <div className="max-h-60 overflow-y-auto">
                  {ledgers.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handleSwitchLedger(l.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-sky-50 flex items-center justify-between transition-colors ${activeId === l.id ? 'bg-sky-50 text-sky-600' : ''}`}
                    >
                      <span className="truncate font-medium">{l.name}</span>
                      {activeId === l.id && <CheckCircle size={14} />}
                    </button>
                  ))}
                </div>
                <div className="border-t border-gray-100 p-2">
                  <button
                    onClick={handleCreateNewLedger}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sky-600 hover:bg-sky-50 rounded-lg font-semibold transition-colors"
                  >
                    <Plus size={16} /> {t('newLedger')}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
             <button
              onClick={() => setShowSettingsModal(true)}
              className="p-2.5 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm border border-white/10"
              title={t('settings')}
            >
              <Settings size={20} />
            </button>
            <button
              onClick={handleRefreshRate}
              className={`p-2.5 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm border border-white/10 ${rateLoading ? 'animate-spin' : ''}`}
              title={t('updateRate')}
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Destination Badge */}
        <div className="flex items-center gap-2 mb-3 pointer-events-auto">
          <MapPin size={14} className="text-yellow-200" />
          <span className="text-sm font-medium text-white/90">{state.destination}</span>
        </div>

        {/* Stats Summary (Mini) */}
        <div className="flex justify-between items-end pointer-events-auto">
          <div className="glass-card px-4 py-2 rounded-xl">
            <p className="text-white/70 text-xs mb-0.5">{t('currentRate')}</p>
            <p className="font-mono font-semibold text-sm">1 {state.baseCurrency} = {state.exchangeRate.toFixed(2)} {state.currencyCode}</p>
          </div>
          <div className="text-right">
             <p className="text-white/70 text-xs mb-1">{t('totalExpense')}</p>
             <p className="text-2xl font-bold drop-shadow-lg">
               {new Intl.NumberFormat('id-ID', { style: 'currency', currency: state.currencyCode, maximumFractionDigits: 0 }).format(state.expenses.reduce((sum, e) => sum + (e.amount || (e as any).amountIDR || 0), 0))}
             </p>
          </div>
        </div>
      </header>

      {/* Main Content Card - Glassmorphism */}
      <main className="mx-4 -mt-6 relative z-20 glass-card rounded-3xl shadow-lg shadow-blue-900/5 min-h-[60vh] flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-4 text-center font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'summary' ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}`}
          >
            <Globe size={16} />
            {t('summaryTab')}
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-4 text-center font-semibold text-sm transition-all cursor-pointer flex items-center justify-center gap-2 ${activeTab === 'expenses' ? 'text-sky-600 border-b-2 border-sky-500 bg-sky-50/50' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50/50'}`}
          >
            <Wallet size={16} />
            {t('expensesTab')} ({state.expenses.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 flex-1">
          {activeTab === 'summary' ? (
            <Summary
              state={state}
            />
          ) : (
            <ExpenseList
              expenses={state.expenses}
              families={state.families}
              currencyCode={state.currencyCode}
              exchangeRate={state.exchangeRate}
              onDelete={(id) => setState(prev => ({...prev, expenses: prev.expenses.filter(e => e.id !== id)}))}
            />
          )}
        </div>
      </main>

      {/* Export Actions */}
      <div className="mx-4 mt-6 grid grid-cols-3 gap-3 mb-24">
        <button onClick={handleExportJSON} className="flex flex-col items-center justify-center glass-card p-3 rounded-2xl text-gray-600 text-xs gap-2 hover:bg-white/95 transition-all shadow-sm">
          <FolderPlus size={22} className="text-sky-500" />
          {t('backupData')}
        </button>
        <button onClick={handleImportJSON} className="flex flex-col items-center justify-center glass-card p-3 rounded-2xl text-gray-600 text-xs gap-2 hover:bg-white/95 transition-all shadow-sm">
          <FileInput size={22} className="text-orange-500" />
          {t('restoreData')}
        </button>
        <button onClick={handleExportMarkdown} className="flex flex-col items-center justify-center glass-card p-3 rounded-2xl text-gray-600 text-xs gap-2 hover:bg-white/95 transition-all shadow-sm">
          <FileText size={22} className="text-green-500" />
          {t('exportMarkdown')}
        </button>
         <button onClick={handleExportPDF} disabled={exportLoading} className="col-span-3 flex items-center justify-center bg-gradient-to-r from-sky-500 to-blue-600 text-white p-3.5 rounded-2xl shadow-lg shadow-sky-500/25 text-sm font-bold gap-2 hover:from-sky-600 hover:to-blue-700 transition-all">
          {exportLoading ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
          {t('exportPDF')}
        </button>
      </div>

      {/* Floating Add Button - Travel Style */}
      <button
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-500 text-white rounded-2xl shadow-2xl shadow-orange-500/30 flex items-center justify-center hover:scale-110 hover:rotate-3 transition-all z-40 group"
      >
        <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
      </button>

      {/* Modals */}
      {showAddModal && (
        <ExpenseForm
          families={state.families}
          currencyCode={state.currencyCode}
          onAddExpense={(expense) => setState(prev => ({
            ...prev,
            expenses: [...prev.expenses, { ...expense, id: `e${Date.now()}` }]
          }))}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          ledgerName={state.ledgerName}
          families={state.families}
          destination={state.destination}
          originCountry={state.originCountry}
          baseCurrency={state.baseCurrency}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Hidden PDF Export Container */}
      <div id="pdf-export-container" className="fixed top-0 left-[200vw] w-[800px] bg-white p-8 z-[-1]">
        <h1 className="text-3xl font-bold mb-2 text-sky-800">{state.ledgerName} - 完整报告</h1>
        <p className="text-gray-500 mb-6">导出时间: {new Date().toLocaleString()}</p>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b pb-2 text-gray-700">概览与结算</h2>
          <Summary state={state} />
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 border-b pb-2 text-gray-700">账单明细</h2>
          <ExpenseList
            expenses={state.expenses}
            families={state.families}
            currencyCode={state.currencyCode}
            exchangeRate={state.exchangeRate}
            onDelete={() => {}} // No-op for export view
          />
        </div>
      </div>
    </div>
  );
};

export default App;
