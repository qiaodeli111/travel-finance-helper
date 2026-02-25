import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CheckCircle, Trash2, ChevronDown, FolderPlus, FileInput, FileText, Download, Wallet, RefreshCw } from 'lucide-react';
import { AppState } from './types';
import { ExpenseForm } from './components/ExpenseForm';
import { Summary } from './components/Summary';
import { ExpenseList } from './components/ExpenseList';
import { createLedgerId, saveLedger, loadLedger } from './services/storageService';
import { exportToMarkdown, exportToPDF } from './services/exportService';

// Constants
const LEDGER_LIST_KEY = 'my_ledgers_v1';
const DEFAULT_RATE = 2200;

interface LedgerMeta {
  id: string;
  name: string;
  lastAccess: number;
}

const DEFAULT_STATE: AppState = { 
  ledgerName: '新建账本',
  expenses: [], 
  exchangeRate: DEFAULT_RATE, 
  family1Count: 4, 
  family2Count: 2, 
  lastUpdated: Date.now() 
};

// Helper to fetch rate
const fetchCNYtoIDR = async (): Promise<number | null> => {
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/CNY');
    if (!res.ok) throw new Error("Network response was not ok");
    const data = await res.json();
    return data.rates.IDR;
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
      
      // Auto-refresh rate if still at default when loading existing ledger
      const data = loadLedger(mostRecent.id);
      if (data && data.exchangeRate === DEFAULT_RATE) {
          const rate = await fetchCNYtoIDR();
          if (rate) {
              setState(prev => ({...prev, exchangeRate: rate}));
          }
      }
    } else {
      // First time user: Create default
      const defaultData = { 
        ...DEFAULT_STATE, 
        ledgerName: "我的巴厘岛账本"
      };
      const id = createLedgerId();
      saveLedger(id, defaultData);
      
      const newMeta = { id, name: defaultData.ledgerName, lastAccess: Date.now() };
      setLedgers([newMeta]);
      setActiveId(id);
      setState(defaultData);

      // Fetch latest rate in background
      const rate = await fetchCNYtoIDR();
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

    const rate = await fetchCNYtoIDR();
    if (rate) setState(prev => ({...prev, exchangeRate: rate}));
  };

  const handleSwitchLedger = (id: string) => {
    setActiveId(id);
    setShowLedgerMenu(false);
  };

  const handleRefreshRate = async () => {
    setRateLoading(true);
    const rate = await fetchCNYtoIDR();
    setRateLoading(false);
    if (rate) {
      if(window.confirm(`获取到最新汇率: 1 CNY = ${rate} IDR\n是否更新当前账本汇率？`)) {
        setState(prev => ({...prev, exchangeRate: rate}));
      }
    } else {
      alert("汇率获取失败，请检查网络连接。");
    }
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
                const data = JSON.parse(ev.target?.result as string);
                if(window.confirm(`确定要导入"${data.ledgerName}"吗？这将覆盖当前数据。`)) {
                    setState(data);
                }
            } catch(err) { alert("文件格式错误"); }
        };
        reader.readAsText(file);
    };
    input.click();
  };

  if (!activeId) return null;

  return (
    <div className="min-h-screen bg-[#f0fdf4] text-gray-800 pb-24" id="printable-area">
      <header className="bg-teal-600 text-white shadow-md sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex justify-between items-center p-4">
          <div className="flex flex-col cursor-pointer" onClick={() => setShowLedgerMenu(!showLedgerMenu)}>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight">{state.ledgerName}</h1>
              <ChevronDown size={16} className={`transition-transform ${showLedgerMenu ? 'rotate-180' : ''}`} />
            </div>
            <p className="text-xs text-teal-100 opacity-80">{state.family1Count}人 vs {state.family2Count}人</p>
          </div>
          <button onClick={() => window.confirm('清空账单？') && setState(p => ({...p, expenses:[]}))} className="p-2 bg-teal-700 rounded-full hover:bg-red-600">
             <Trash2 size={18} />
          </button>
        </div>

        {showLedgerMenu && (
          <div className="absolute top-full left-0 right-0 bg-white text-gray-800 shadow-xl border-b z-50">
            <div className="max-w-3xl mx-auto p-2">
              {ledgers.map(l => (
                <button key={l.id} onClick={() => handleSwitchLedger(l.id)} className={`w-full text-left px-4 py-3 rounded-lg flex justify-between ${activeId === l.id ? 'bg-teal-50 text-teal-700 font-bold' : ''}`}>
                  <span>{l.name}</span>
                  {activeId === l.id && <CheckCircle size={16} />}
                </button>
              ))}
              <button onClick={handleCreateNewLedger} className="flex items-center justify-center gap-2 w-full py-3 mt-2 text-blue-600 border-t">
                <FolderPlus size={18} /> 新建账本
              </button>
            </div>
            <div className="fixed inset-0 z-[-1] bg-black/20" onClick={() => setShowLedgerMenu(false)}></div>
          </div>
        )}
      </header>

      <main className="max-w-3xl mx-auto p-4">
        {activeTab === 'summary' ? (
          <Summary expenses={state.expenses} exchangeRate={state.exchangeRate} family1Count={state.family1Count} family2Count={state.family2Count} />
        ) : (
          <ExpenseList expenses={state.expenses} onDelete={(id) => setState(prev => ({ ...prev, expenses: prev.expenses.filter(e => e.id !== id) }))} />
        )}
      </main>

      <div className="max-w-3xl mx-auto px-4 mt-8 border-t pt-6" data-html2canvas-ignore>
        <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-widest">账本设置</h3>
        <div className="bg-white rounded-xl shadow-sm p-5 space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">账本名称</label>
            <input 
              value={state.ledgerName}
              onChange={e => setState(p => ({...p, ledgerName: e.target.value}))}
              className="w-full border rounded-lg p-3 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs text-gray-500 mb-1">家庭1人数</label>
                <input 
                  type="number" 
                  value={state.family1Count || ''} 
                  placeholder="0"
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setState(p => ({...p, family1Count: isNaN(val) ? 0 : val}));
                  }}
                  className="w-full border rounded-lg p-3 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" 
                />
             </div>
             <div>
                <label className="block text-xs text-gray-500 mb-1">家庭2人数</label>
                <input 
                  type="number" 
                  value={state.family2Count || ''} 
                  placeholder="0"
                  onChange={e => {
                    const val = parseInt(e.target.value);
                    setState(p => ({...p, family2Count: isNaN(val) ? 0 : val}));
                  }}
                  className="w-full border rounded-lg p-3 text-sm bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none" 
                />
             </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 flex justify-between">
               <span>汇率 (1 CNY = ? IDR)</span>
               <button onClick={handleRefreshRate} className="text-teal-600 flex items-center gap-1">
                  <RefreshCw size={12} className={rateLoading ? "animate-spin" : ""} /> {rateLoading ? "获取中" : "获取最新"}
               </button>
            </label>
            <input 
              type="number" 
              value={state.exchangeRate || ''} 
              placeholder="0.00"
              onChange={e => {
                const val = parseFloat(e.target.value);
                setState(p => ({...p, exchangeRate: isNaN(val) ? 0 : val}));
              }}
              className="w-full border rounded-lg p-3 text-sm bg-white text-gray-900 font-mono focus:ring-2 focus:ring-teal-500 outline-none" 
            />
          </div>

          <div className="pt-4 border-t space-y-3">
             <div className="grid grid-cols-2 gap-3">
               <button onClick={() => exportToMarkdown(state)} className="py-2 text-sm border rounded-lg bg-gray-50 flex items-center justify-center gap-2 text-gray-700 hover:bg-gray-100"><FileText size={16}/> Markdown</button>
               <button onClick={async () => {setExportLoading(true); await exportToPDF('printable-area', state.ledgerName); setExportLoading(false);}} className="py-2 text-sm border rounded-lg bg-red-50 text-red-700 flex items-center justify-center gap-2 hover:bg-red-100"><Download size={16}/> {exportLoading ? "生成中" : "PDF 报表"}</button>
             </div>
             <div className="grid grid-cols-2 gap-3">
               <button onClick={handleExportJSON} className="py-2 text-sm border rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center gap-2 hover:bg-teal-100"><Wallet size={16}/> 备份数据</button>
               <button onClick={handleImportJSON} className="py-2 text-sm border rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center gap-2 hover:bg-blue-100"><FileInput size={16}/> 恢复数据</button>
             </div>
          </div>
        </div>
      </div>

      <button onClick={() => setShowAddModal(true)} className="fixed bottom-24 right-6 bg-teal-600 text-white p-4 rounded-full shadow-lg z-40 active:scale-95 transition-transform" data-html2canvas-ignore>
        <Plus size={28} />
      </button>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t h-16 flex justify-around items-center z-30 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]" data-html2canvas-ignore>
        <button onClick={() => setActiveTab('summary')} className={`w-full h-full text-sm font-medium transition-colors ${activeTab === 'summary' ? 'text-teal-600 bg-teal-50/50' : 'text-gray-400'}`}>概览</button>
        <div className="w-px h-8 bg-gray-200"></div>
        <button onClick={() => setActiveTab('expenses')} className={`w-full h-full text-sm font-medium transition-colors ${activeTab === 'expenses' ? 'text-teal-600 bg-teal-50/50' : 'text-gray-400'}`}>账单 ({state.expenses.length})</button>
      </nav>

      {showAddModal && (
        <ExpenseForm 
          onAddExpense={(newExp) => { setState(p => ({ ...p, expenses: [...p.expenses, { ...newExp, id: crypto.randomUUID() }] })); setShowAddModal(false); }} 
          onClose={() => setShowAddModal(false)} 
        />
      )}
    </div>
  );
};

export default App;