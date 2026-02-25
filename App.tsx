import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Trash2, ChevronDown, FolderPlus, FileInput, FileText, Download, Wallet, RefreshCw, Settings } from 'lucide-react';
import { AppState, Family, COUNTRIES } from './types';
import { ExpenseForm } from './components/ExpenseForm';
import { Summary } from './components/Summary';
import { ExpenseList } from './components/ExpenseList';
import { SettingsModal } from './components/SettingsModal';
import { createLedgerId, saveLedger, loadLedger } from './services/storageService';
import { exportToMarkdown, exportToPDF } from './services/exportService';

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
  ledgerName: '新建账本',
  expenses: [], 
  exchangeRate: DEFAULT_RATE, 
  families: DEFAULT_FAMILIES,
  currencyCode: 'IDR',
  destination: '印度尼西亚',
  lastUpdated: Date.now() 
};

// Helper to fetch rate
const fetchExchangeRate = async (targetCurrency: string): Promise<number | null> => {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/CNY');
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data.rates[targetCurrency];
  } catch (e) {
    console.error("Failed to fetch exchange rate:", e);
    return null;
  }
};

const App: React.FC = () => {
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
        setState(data);
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

      // Fetch latest rate in background
      const rate = await fetchExchangeRate('IDR');
      if (rate) {
        setState(prev => {
          const updated = { ...prev, exchangeRate: rate };
          saveLedger(id, updated);
          return updated;
        });
      }
    }
  }, [ledgers]);

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
        setState(data);
        setLedgers(prev => prev.map(L => 
             L.id === activeId ? { ...L, name: data.ledgerName, lastAccess: Date.now() } : L
        ));
    }
  }, [activeId]);

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
    const rate = await fetchExchangeRate(state.currencyCode);
    setRateLoading(false);
    if (rate) {
      if(window.confirm(`获取到最新汇率: 1 CNY = ${rate} ${state.currencyCode}\n是否更新当前账本汇率？`)) {
        setState(prev => ({...prev, exchangeRate: rate}));
      }
    } else {
      alert("汇率获取失败，请检查网络连接。");
    }
  };

  const handleSaveSettings = async (ledgerName: string, families: Family[], destination: string, currency: string) => {
    let newRate = state.exchangeRate;
    if (currency !== state.currencyCode) {
      setRateLoading(true);
      const rate = await fetchExchangeRate(currency);
      setRateLoading(false);
      if (rate) newRate = rate;
    }

    setState(prev => ({
      ...prev,
      ledgerName,
      families,
      destination,
      currencyCode: currency,
      exchangeRate: newRate
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
                    setState(json);
                    alert("导入成功！");
                } else {
                    alert("文件格式不正确");
                }
            } catch (err) {
                alert("文件解析失败");
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
      {/* Header Background Layer */}
      <div className="absolute top-0 left-0 right-0 h-64 bg-teal-600 z-0" />

      {/* Header Content Layer - High Z-Index for Dropdowns */}
      <header className="relative z-30 p-4 pb-12 text-white">
        <div className="flex justify-between items-center mb-4">
          <div className="relative">
            <button 
              onClick={() => setShowLedgerMenu(!showLedgerMenu)}
              className="flex items-center gap-2 font-bold text-lg hover:bg-teal-700 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Wallet size={20} />
              {state.ledgerName}
              <ChevronDown size={16} />
            </button>

            {/* Ledger Menu */}
            {showLedgerMenu && (
              <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden text-gray-800 z-50">
                <div className="max-h-60 overflow-y-auto">
                  {ledgers.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handleSwitchLedger(l.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between ${activeId === l.id ? 'bg-teal-50 text-teal-700' : ''}`}
                    >
                      <span className="truncate">{l.name}</span>
                      {activeId === l.id && <CheckCircle size={14} />}
                    </button>
                  ))}
                </div>
                <div className="border-t p-2">
                  <button 
                    onClick={handleCreateNewLedger}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-teal-600 hover:bg-teal-50 rounded-lg font-medium"
                  >
                    <Plus size={16} /> 新建账本
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
             <button 
              onClick={() => setShowSettingsModal(true)}
              className="p-2 hover:bg-teal-700 rounded-full transition-colors"
              title="设置"
            >
              <Settings size={20} />
            </button>
            <button 
              onClick={handleRefreshRate}
              className={`p-2 hover:bg-teal-700 rounded-full transition-colors ${rateLoading ? 'animate-spin' : ''}`}
              title="更新汇率"
            >
              <RefreshCw size={20} />
            </button>
          </div>
        </div>

        {/* Stats Summary (Mini) */}
        <div className="flex justify-between items-end">
          <div>
            <p className="text-teal-100 text-xs mb-1">当前汇率</p>
            <p className="font-mono font-medium">1 CNY = {state.exchangeRate} {state.currencyCode}</p>
          </div>
          <div className="text-right">
             <p className="text-teal-100 text-xs mb-1">总支出</p>
             <p className="text-2xl font-bold">
               {new Intl.NumberFormat('id-ID', { style: 'currency', currency: state.currencyCode, maximumFractionDigits: 0 }).format(state.expenses.reduce((sum, e) => sum + (e.amount || (e as any).amountIDR || 0), 0))}
             </p>
          </div>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="mx-4 -mt-8 relative z-20 bg-white rounded-2xl shadow-sm min-h-[60vh] flex flex-col">
        {/* Tabs */}
        <div className="flex border-b">
          <button 
            onClick={() => setActiveTab('summary')}
            className={`flex-1 py-4 text-center font-medium text-sm transition-colors ${activeTab === 'summary' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            概览 & 结算
          </button>
          <button 
            onClick={() => setActiveTab('expenses')}
            className={`flex-1 py-4 text-center font-medium text-sm transition-colors ${activeTab === 'expenses' ? 'text-teal-600 border-b-2 border-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            账单明细 ({state.expenses.length})
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
        <button onClick={handleExportJSON} className="flex flex-col items-center justify-center bg-white p-3 rounded-xl shadow-sm text-gray-600 text-xs gap-1 hover:bg-gray-50">
          <FolderPlus size={20} className="text-blue-500" />
          备份数据
        </button>
        <button onClick={handleImportJSON} className="flex flex-col items-center justify-center bg-white p-3 rounded-xl shadow-sm text-gray-600 text-xs gap-1 hover:bg-gray-50">
          <FileInput size={20} className="text-purple-500" />
          恢复数据
        </button>
        <button onClick={handleExportMarkdown} className="flex flex-col items-center justify-center bg-white p-3 rounded-xl shadow-sm text-gray-600 text-xs gap-1 hover:bg-gray-50">
          <FileText size={20} className="text-green-500" />
          导出 Markdown
        </button>
         <button onClick={handleExportPDF} disabled={exportLoading} className="col-span-3 flex items-center justify-center bg-gray-800 text-white p-3 rounded-xl shadow-sm text-sm font-medium gap-2 hover:bg-gray-900">
          {exportLoading ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
          导出完整 PDF 报告
        </button>
      </div>

      {/* Floating Add Button */}
      <button 
        onClick={() => setShowAddModal(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-teal-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-teal-700 hover:scale-105 transition-all z-40"
      >
        <Plus size={28} />
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
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
        />
      )}

      {/* Hidden PDF Export Container */}
      <div id="pdf-export-container" className="fixed top-0 left-[200vw] w-[800px] bg-white p-8 z-[-1]">
        <h1 className="text-3xl font-bold mb-2 text-teal-800">{state.ledgerName} - 完整报告</h1>
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
