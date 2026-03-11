import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, CheckCircle, Trash2, ChevronDown, FolderPlus, FileInput, FileText, Download, Wallet, RefreshCw, Settings, Plane, MapPin, Globe, Compass, Languages, User, LogOut, Cloud, Users, BookOpen, Star, Archive } from 'lucide-react';
import { AppState, Family, COUNTRIES, ORIGIN_COUNTRIES } from './types';
import { ExpenseForm } from './components/ExpenseForm';
import { Summary } from './components/Summary';
import { ExpenseList } from './components/ExpenseList';
import { SettingsModal } from './components/SettingsModal';
import { AuthModal } from './components/AuthModal';
import { SyncIndicator } from './components/SyncIndicator';
import { InviteModal } from './components/InviteModal';
import { MembersPanel } from './components/MembersPanel';
import { MigrationModal } from './components/MigrationModal';
import { UserProfileModal } from './components/UserProfileModal';
import { LedgerManagePanel } from './components/LedgerManagePanel';
import { LoginPromptModal } from './components/LoginPromptModal';
import { WelcomeWizard } from './components/WelcomeWizard';
import { GuestLedgerSyncModal } from './components/GuestLedgerSyncModal';
import { createLedgerId } from './services/storageService';
import { exportToMarkdown, exportToPDF } from './services/exportService';
import { useTranslation } from './i18n/useTranslation';
import { Language, LANGUAGE_NAMES, getLanguageByCurrency } from './i18n/translations';
import { useAuth } from './src/contexts/AuthContext';
import { useCloudSync } from './src/contexts/CloudSyncContext';
import { getLedgerMembers, checkPermission } from './services/collaborationService';
import { LedgerMember } from './types/firestore';

// Constants
const LEDGER_LIST_KEY = 'my_ledgers_v1';
const DEFAULT_RATE = 2200; // Default IDR rate as fallback

interface LedgerMeta {
  id: string;
  name: string;
  lastAccess: number;
  ownerId?: string;           // 创建者用户ID
  ownerDisplayName?: string;  // 创建者显示名称
  isLocal?: boolean;          // 是否为本地账本
  isCloudSynced?: boolean;    // 是否已同步到云端
  status?: 'active' | 'archived'; // 账本状态
}

const DEFAULT_FAMILIES: Family[] = [
  { id: 'f1', name: 'family1', count: 2 },
  { id: 'f2', name: 'lilei', count: 1 }
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

  // --- Auth & Cloud Sync ---
  const { user, signOut, loading: authLoading } = useAuth();
  const { isCloudEnabled, enableCloud, syncNow, markPendingChange, loadFromCloud, cloudLedgers, isLoadingLedgers } = useCloudSync();

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
  // For cloud-only mode: ledgers come directly from cloudLedgers
  // No local storage for ledger list - pure remote architecture
  const ledgers = React.useMemo(() => {
    return cloudLedgers.map(cl => {
      // Handle updatedAt - it could be a Firestore Timestamp object or a number
      let lastAccess = 0;
      if (cl.updatedAt) {
        if (typeof cl.updatedAt === 'object' && 'seconds' in cl.updatedAt) {
          lastAccess = (cl.updatedAt as { seconds: number; nanoseconds: number }).seconds * 1000;
        } else if (typeof cl.updatedAt === 'number') {
          lastAccess = cl.updatedAt;
        }
      }

      return {
        id: cl.id,
        name: cl.name,
        lastAccess,
        isCloudSynced: true,
        ownerId: cl.ownerId,
        status: cl.status as 'active' | 'archived' | undefined,
      };
    });
  }, [cloudLedgers]);

  const [activeId, setActiveId] = useState<string | null>(null);

  // --- Ledger Data State ---
  const [state, setState] = useState<AppState>(DEFAULT_STATE);
  const [activeTab, setActiveTab] = useState<'expenses' | 'summary'>('summary');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showLedgerMenu, setShowLedgerMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showMembersPanel, setShowMembersPanel] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [showLedgerPanel, setShowLedgerPanel] = useState(false);
  const [showWelcomeWizard, setShowWelcomeWizard] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Guest mode state - stored in memory only, lost on browser close
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [guestLedgers, setGuestLedgers] = useState<Array<{
    id: string;
    name: string;
    data: AppState;
    createdAt: number;
  }>>([]);
  const [showGuestSyncModal, setShowGuestSyncModal] = useState(false);

  // Check if current ledger is archived
  const currentLedger = ledgers.find(l => l.id === activeId);
  const isArchived = currentLedger?.status === 'archived';
  const [rateLoading, setRateLoading] = useState(false);

  const [currentUserRole, setCurrentUserRole] = useState<'owner' | 'admin' | 'member' | 'viewer' | null>(null);
  const [inviteCodeFromUrl, setInviteCodeFromUrl] = useState<string | null>(null);
  const [inviteMode, setInviteMode] = useState<'create' | 'join'>('create');
  const [defaultLedgerId, setDefaultLedgerId] = useState<string | null>(() => {
    try {
      return localStorage.getItem('default_ledger_id');
    } catch { return null; }
  });

  // Track if we're currently loading data from cloud to prevent race condition
  const isLoadingFromCloudRef = useRef(false);

  // --- Handle Invite Link from URL ---
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/join\/([A-Z0-9]+)$/i);
    if (match) {
      const code = match[1].toUpperCase();
      setInviteCodeFromUrl(code);
      // Clean up URL
      window.history.replaceState({}, '', '/');
      // If user is already logged in, show invite modal immediately
      if (user) {
        setShowInviteModal(true);
      }
      // If not logged in, the invite modal will be shown after login (see effect below)
    }
  }, []); // Run once on mount

  // --- Show Invite Modal after Login if there's a pending invite ---
  useEffect(() => {
    if (user && inviteCodeFromUrl && !showInviteModal) {
      setShowInviteModal(true);
    }
  }, [user, inviteCodeFromUrl]);

  // --- Show Login Prompt on first visit ---
  useEffect(() => {
    // Only show login prompt if user is not logged in and not in guest mode
    if (!user && !isGuestMode) {
      const hasVisitedBefore = localStorage.getItem('has_visited_before');
      if (!hasVisitedBefore) {
        setShowLoginPrompt(true);
        localStorage.setItem('has_visited_before', 'true');
      }
    }
  }, [user, isGuestMode]);

  // --- Handle guest-to-cloud sync after login ---
  useEffect(() => {
    if (user && guestLedgers.length > 0 && isGuestMode) {
      // User just logged in and has guest ledgers - show sync modal
      setShowGuestSyncModal(true);
      setIsGuestMode(false);
    }
  }, [user, guestLedgers, isGuestMode]);

  // --- Check for local ledgers that need migration after login ---
  useEffect(() => {
    if (user && ledgers.length > 0) {
      // Check if any local ledgers need to be migrated to cloud
      const localLedgers = ledgers.filter(l => l.isLocal || !l.isCloudSynced);
      if (localLedgers.length > 0 && !user.isAnonymous) {
        // User just logged in and has local ledgers - show migration prompt
        const hasSeenMigrationPrompt = localStorage.getItem('migration_prompt_seen');
        if (!hasSeenMigrationPrompt) {
          setShowMigrationModal(true);
          localStorage.setItem('migration_prompt_seen', 'true');
        }
      }
    }
  }, [user, ledgers]);

  // --- Persistence of Ledger List ---
  // Removed: ledgers now come directly from cloudLedgers (pure remote architecture)

  // --- Initialization Logic ---
  const initApp = useCallback(async () => {
    // For logged-in users with cloud ledgers
    if (user && ledgers.length > 0) {
      // Try to load default ledger from cloud first
      let targetLedgerId = defaultLedgerId;

      // If no local default, try to get from cloud
      if (!targetLedgerId) {
        try {
          const { getUserDefaultLedger } = await import('./services/firestoreService');
          const cloudDefault = await getUserDefaultLedger(user.uid);
          if (cloudDefault) {
            targetLedgerId = cloudDefault;
            setDefaultLedgerId(cloudDefault);
            localStorage.setItem('default_ledger_id', cloudDefault);
          }
        } catch (err) {
          console.error('Failed to get default ledger from cloud:', err);
        }
      }

      let targetLedger = targetLedgerId ? ledgers.find(l => l.id === targetLedgerId) : null;

      // If no default ledger or it doesn't exist, use most recent
      if (!targetLedger) {
        targetLedger = ledgers.sort((a, b) => b.lastAccess - a.lastAccess)[0];
      }

      if (targetLedger) {
        setActiveId(targetLedger.id);

        // Load ledger data from cloud
        if (isCloudEnabled && user) {
          const cloudData = await loadFromCloud(targetLedger.id);
          if (cloudData) {
            setState(cloudData);
            updateLanguageFromOrigin(cloudData.originCountry);
          }
        }
      }
    } else if (isGuestMode && guestLedgers.length > 0) {
      // Guest mode: load from memory
      const mostRecent = guestLedgers.sort((a, b) => b.createdAt - a.createdAt)[0];
      setActiveId(mostRecent.id);
      setState(mostRecent.data);
    }
    // Note: Don't auto-show WelcomeWizard here - it will be shown when user clicks "New Ledger"
  }, [ledgers, updateLanguageFromOrigin, isCloudEnabled, user, loadFromCloud, defaultLedgerId, isGuestMode, guestLedgers]);

  useEffect(() => {
    // Run initialization when auth is ready
    // Only show WelcomeWizard after we're certain the user has no ledgers
    // (not just because ledgers haven't loaded yet)
    if (!authLoading && user && !activeId && !isLoadingLedgers && !showWelcomeWizard) {
      if (ledgers.length > 0) {
        // User has ledgers - load the default or most recent one
        initApp();
      }
      // Don't auto-show WelcomeWizard here - let user click "New Ledger"
      // The original blank screen issue is fixed by waiting for isLoadingLedgers
    }
  }, [authLoading, user, ledgers.length, activeId, initApp, isGuestMode, isLoadingLedgers, showWelcomeWizard]);

  // --- Fetch current user role ---
  useEffect(() => {
    const fetchRole = async () => {
      if (user && activeId && isCloudEnabled) {
        const members = await getLedgerMembers(activeId);
        const currentMember = members.find(m => m.userId === user.uid);
        setCurrentUserRole(currentMember?.role as any || null);
      } else if (user) {
        const ledger = ledgers.find(l => l.id === activeId);
        if (ledger?.ownerId === user.uid || !ledger?.ownerId) {
          setCurrentUserRole('owner');
        }
      } else {
        setCurrentUserRole(null);
      }
    };
    fetchRole();
  }, [user, activeId, isCloudEnabled, ledgers]);

  // --- Subscribe to user profile for default ledger sync ---
  useEffect(() => {
    if (!user || !isCloudEnabled) return;

    let unsubscribe: (() => void) | null = null;

    const subscribeToUserSettings = async () => {
      const { subscribeToUserProfile } = await import('./services/firestoreService');
      unsubscribe = subscribeToUserProfile(user.uid, (data) => {
        if (data.defaultLedgerId && data.defaultLedgerId !== defaultLedgerId) {
          console.log('Default ledger updated from another device:', data.defaultLedgerId);
          setDefaultLedgerId(data.defaultLedgerId);
          localStorage.setItem('default_ledger_id', data.defaultLedgerId);
        }
      });
    };

    subscribeToUserSettings();

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [user, isCloudEnabled, defaultLedgerId]);

  // --- Load Data when Active ID Changes ---
  useEffect(() => {
    if (!activeId) return;

    const loadData = async () => {
      // Pure remote: load ledger data from cloud
      if (isCloudEnabled && user) {
        // Set loading flag to prevent race condition with syncNow
        isLoadingFromCloudRef.current = true;
        console.log('Loading ledger from cloud:', activeId);
        const cloudData = await loadFromCloud(activeId);
        if (cloudData) {
          // Ensure required fields exist
          if (!cloudData.families) {
            cloudData.families = [
              { id: 'f1', name: 'family1', count: 2 },
              { id: 'f2', name: 'lilei', count: 1 }
            ];
          }
          if (!cloudData.baseCurrency) {
            cloudData.baseCurrency = 'CNY';
          }
          if (!cloudData.originCountry) {
            cloudData.originCountry = '中国';
          }
          setState(cloudData);
          updateLanguageFromOrigin(cloudData.originCountry);
        }
        // Clear loading flag after data is loaded
        isLoadingFromCloudRef.current = false;
      }
    };

    loadData();

    // Subscribe to real-time expense updates from cloud
    let unsubscribe: (() => void) | null = null;

    if (isCloudEnabled && user && activeId) {
      const setupSubscription = async () => {
        const { subscribeToExpenses } = await import('./services/firestoreService');
        unsubscribe = subscribeToExpenses(activeId, (cloudExpenses) => {
          console.log('Received expense update from cloud:', cloudExpenses.length, 'expenses');

          // Pure remote: sync expenses directly from cloud
          setState(prev => {
            // Filter out deleted expenses
            const activeCloudExpenses = cloudExpenses.filter(e => !e.deletedAt);

            // Pure remote: use cloud expenses as source of truth
            const syncedExpenses = activeCloudExpenses.map(e => ({
              id: e.id,
              date: e.date,
              description: e.description,
              amount: e.amount,
              category: e.category,
              payerId: e.payerId,
              sharedWithFamilyIds: e.sharedWithFamilyIds,
              travelPlaceName: e.travelPlaceName,
              paymentCurrency: e.paymentCurrency,
              settlementCurrency: e.settlementCurrency,
              fxSnapshot: e.fxSnapshot,
              amountSettlement: e.amountSettlement,
              createdBy: e.createdBy,
              createdByDisplayName: e.createdByDisplayName,
              createdAt: e.createdAt ? e.createdAt.seconds * 1000 : undefined,
              version: e.version || 1,
              updatedAt: e.updatedAt ? e.updatedAt.seconds * 1000 : undefined,
            }));

            return { ...prev, expenses: syncedExpenses };
          });
        });
      };
      setupSubscription();
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [activeId, updateLanguageFromOrigin, isCloudEnabled, user, loadFromCloud]);

  // --- Save Data Effect ---
  useEffect(() => {
    if (!activeId) return;
    const timer = setTimeout(() => {
      // Don't sync while loading data from cloud (prevents race condition)
      if (isLoadingFromCloudRef.current) {
        return;
      }
      // Auto-sync to cloud if enabled
      if (isCloudEnabled && user && activeId) {
        syncNow(activeId, state).catch(err => {
          console.error('Auto-sync failed:', err);
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [state, activeId, isCloudEnabled, user, syncNow]);

  // --- Handlers ---
  const handleCreateNewLedger = async () => {
    // Show WelcomeWizard for a more ceremonial ledger creation experience
    setShowWelcomeWizard(true);
    setShowLedgerMenu(false);
  };

  const handleSwitchLedger = (id: string) => {
    // Check if it's a guest ledger
    const guestLedger = guestLedgers.find(gl => gl.id === id);
    if (guestLedger && isGuestMode) {
      setActiveId(id);
      setState(guestLedger.data);
    } else {
      // Pure remote: just switch the active ID, data will load from cloud
      setActiveId(id);
    }
    setShowLedgerMenu(false);
  };

  // --- Login Prompt Handlers ---
  const handleGuestMode = () => {
    setShowLoginPrompt(false);
    setIsGuestMode(true);
    // Show welcome wizard for guest to create their first ledger
    setShowWelcomeWizard(true);
  };

  const handleLoginFromPrompt = () => {
    setShowLoginPrompt(false);
    setShowAuthModal(true);
  };

  const handleRegisterFromPrompt = () => {
    setShowLoginPrompt(false);
    setShowAuthModal(true);
  };

  // Handle guest sync complete
  const handleGuestSyncComplete = () => {
    setGuestLedgers([]);
    setShowGuestSyncModal(false);
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
    // Check for duplicate name if name changed and user is logged in
    if (ledgerName !== state.ledgerName && user && isCloudEnabled) {
      try {
        const { checkLedgerNameExists } = await import('./services/firestoreService');
        const nameExists = await checkLedgerNameExists(user.uid, ledgerName, activeId);
        if (nameExists) {
          alert(language === 'zh'
            ? `账本名称"${ledgerName}"已存在，请使用其他名称`
            : `Ledger name "${ledgerName}" already exists. Please use a different name.`);
          return;
        }
      } catch (err) {
        console.error('Failed to check ledger name:', err);
      }
    }

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

  const handleSignOut = async () => {
    try {
      await signOut();
      setShowUserMenu(false);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const handleEnableCloudSync = () => {
    enableCloud();
    setShowMigrationModal(true);
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
                  {/* Cloud ledgers for logged-in users */}
                  {ledgers.map(l => (
                    <button
                      key={l.id}
                      onClick={() => handleSwitchLedger(l.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-sky-50 flex items-center justify-between transition-colors ${activeId === l.id ? 'bg-sky-50 text-sky-600' : ''}`}
                    >
                      <span className="truncate font-medium flex items-center gap-2">
                        {l.id === defaultLedgerId && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                        {l.name}
                      </span>
                      {activeId === l.id && <CheckCircle size={14} />}
                    </button>
                  ))}
                  {/* Guest ledgers for guest mode */}
                  {isGuestMode && guestLedgers.map(gl => (
                    <button
                      key={gl.id}
                      onClick={() => handleSwitchLedger(gl.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-sky-50 flex items-center justify-between transition-colors ${activeId === gl.id ? 'bg-sky-50 text-sky-600' : ''}`}
                    >
                      <span className="truncate font-medium flex items-center gap-2">
                        {gl.name}
                      </span>
                      {activeId === gl.id && <CheckCircle size={14} />}
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
                  {!isGuestMode && (
                    <>
                      <button
                        onClick={() => {
                          setShowLedgerMenu(false);
                          setInviteMode('join');
                          setShowInviteModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-sky-600 hover:bg-sky-50 rounded-lg font-semibold transition-colors"
                      >
                        <Users size={16} /> {t('joinWithCode')}
                      </button>
                      <button
                        onClick={() => {
                          setShowLedgerMenu(false);
                          setShowLedgerPanel(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors"
                      >
                        <BookOpen size={16} /> {t('ledgerManage')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
             {/* User Status */}
             {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm border border-white/10"
                >
                  <div className="w-6 h-6 bg-white/30 rounded-full flex items-center justify-center">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="" className="w-6 h-6 rounded-full" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                  <span className="text-sm font-medium hidden sm:inline">
                    {user.displayName || user.email?.split('@')[0] || 'User'}
                  </span>
                  <ChevronDown size={14} className="opacity-70" />
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute top-full right-0 mt-2 w-56 glass-card rounded-xl shadow-xl overflow-hidden text-gray-800 z-50">
                    <div className="p-3 border-b border-gray-100">
                      <p className="font-medium text-sm truncate">{user.displayName || 'User'}</p>
                      <p className="text-xs text-gray-500 truncate">{user.email}</p>
                    </div>
                    <div className="p-2">
                      <SyncIndicator />
                    </div>
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowUserProfile(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                      >
                        <User size={16} className="text-sky-500" />
                        {t('userProfile')}
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowInviteModal(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                      >
                        <Users size={16} className="text-sky-500" />
                        {t('inviteMembers')}
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false);
                          setShowMembersPanel(true);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-sky-50 transition-colors"
                      >
                        <Users size={16} className="text-sky-500" />
                        {t('members')}
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={16} />
                        {t('signOut')}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="flex items-center gap-2 px-3 py-2 hover:bg-white/20 rounded-xl transition-all backdrop-blur-sm border border-white/10"
              >
                <User size={18} />
                <span className="text-sm font-medium">{t('login')}</span>
              </button>
            )}

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
          <div className="flex justify-between items-end gap-3 pointer-events-auto">
          <div className="rounded-2xl border border-white/30 bg-white/92 px-4 py-3 text-slate-900 shadow-lg shadow-slate-950/10 backdrop-blur-md">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700/80">{t('currentRate')}</p>
            <p className="mt-1 font-mono text-sm font-bold tabular-nums text-slate-950">1 {state.baseCurrency} = {state.exchangeRate.toFixed(2)} {state.currencyCode}</p>
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
              baseCurrency={state.baseCurrency}
              onDelete={async (id) => {
                // Soft delete from cloud - subscription will update the UI
                if (user && activeId && isCloudEnabled) {
                  try {
                    const { softDeleteExpense, getExpenses } = await import('./services/firestoreService');
                    // Get current version from cloud
                    const expenses = await getExpenses(activeId);
                    const cloudExpense = expenses.find(e => e.id === id);
                    if (cloudExpense) {
                      await softDeleteExpense(activeId, id, cloudExpense.version || 1);
                      console.log('Expense soft deleted from cloud:', id);
                      // The subscription will automatically update the UI
                    } else {
                      console.log('Expense not found in cloud, skipping soft delete');
                    }
                  } catch (err) {
                    console.error('Failed to soft delete expense from cloud:', err);
                  }
                }
              }}
            />
          )}
        </div>
      </main>

      {/* Export Actions - PDF only */}
      <div className="mx-4 mt-6 mb-24">
        <button onClick={handleExportPDF} disabled={exportLoading || state.expenses.length === 0} className={`w-full flex items-center justify-center p-3.5 rounded-2xl text-sm font-bold gap-2 transition-all ${state.expenses.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-lg shadow-sky-500/25 hover:from-sky-600 hover:to-blue-700'}`}>
          {exportLoading ? <RefreshCw className="animate-spin" size={18} /> : <Download size={18} />}
          {t('exportPDF')}
        </button>
      </div>

      {/* Floating Add Button - Travel Style - Hidden for archived ledgers or users without edit permission */}
      {!isArchived && (isGuestMode || checkPermission(currentUserRole || 'member', 'edit_expenses')) && (
        <button
          onClick={() => setShowAddModal(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-gradient-to-br from-orange-400 to-pink-500 text-white rounded-2xl shadow-2xl shadow-orange-500/30 flex items-center justify-center hover:scale-110 hover:rotate-3 transition-all z-40 group"
        >
          <Plus size={28} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      )}

      {/* Archived Banner */}
      {isArchived && (
        <div className="fixed bottom-6 right-6 px-4 py-3 bg-orange-100 text-orange-700 rounded-2xl flex items-center gap-2 z-40">
          <Archive size={18} />
          <span className="text-sm font-medium">{t('archived', 'This ledger is archived')}</span>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <ExpenseForm
          families={state.families}
          destination={state.destination}
          currencyCode={state.currencyCode}
          baseCurrency={state.baseCurrency}
          exchangeRate={state.exchangeRate}
          onAddExpense={async (expense) => {
            const newExpense = {
              ...expense,
              id: `e${Date.now()}`,
              createdBy: user?.uid || 'guest',
              createdByDisplayName: user?.displayName || user?.email?.split('@')[0] || 'Guest',
              createdAt: Date.now()
            };

            // Update local state immediately
            setState(prev => ({
              ...prev,
              expenses: [...prev.expenses, newExpense]
            }));

            // For guest mode: update guest ledger in memory
            if (isGuestMode && activeId) {
              setGuestLedgers(prev => prev.map(gl => {
                if (gl.id === activeId) {
                  return {
                    ...gl,
                    data: {
                      ...gl.data,
                      expenses: [...gl.data.expenses, newExpense]
                    }
                  };
                }
                return gl;
              }));
            }

            // Upload to cloud immediately if logged in and cloud is enabled
            if (user && activeId && isCloudEnabled) {
              try {
                const { createExpense } = await import('./services/firestoreService');
                await createExpense(activeId, {
                  id: newExpense.id,
                  ledgerId: activeId,
                  createdBy: newExpense.createdBy,
                  createdByDisplayName: newExpense.createdByDisplayName,
                  date: newExpense.date,
                  description: newExpense.description,
                  amount: newExpense.amount,
                  category: newExpense.category,
                  payerId: newExpense.payerId,
                  sharedWithFamilyIds: newExpense.sharedWithFamilyIds || [],
                  travelPlaceName: newExpense.travelPlaceName,
                  paymentCurrency: newExpense.paymentCurrency,
                  settlementCurrency: newExpense.settlementCurrency,
                  fxSnapshot: newExpense.fxSnapshot,
                  amountSettlement: newExpense.amountSettlement,
                } as any);
                console.log('Expense uploaded to cloud');
              } catch (err) {
                console.error('Failed to upload expense:', err);
              }
            }
          }}
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
          userRole={currentUserRole}
          onSave={handleSaveSettings}
          onClose={() => setShowSettingsModal(false)}
          onExportJSON={handleExportJSON}
          onImportJSON={handleImportJSON}
          onExportMarkdown={handleExportMarkdown}
          onExportPDF={handleExportPDF}
          onOpenInviteMembers={() => {
            setShowSettingsModal(false);
            setShowInviteModal(true);
          }}
          onOpenMembers={() => {
            setShowSettingsModal(false);
            setShowMembersPanel(true);
          }}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          initialMode="login"
        />
      )}

      {/* Invite Modal */}
      {/* Invite Modal - show for both creating and joining */}
      {showInviteModal && (
        <InviteModal
          isOpen={showInviteModal}
          onClose={() => {
            setShowInviteModal(false);
            setInviteCodeFromUrl(null);
            setInviteMode('create');
          }}
          ledgerId={activeId || undefined}
          ledgerName={state.ledgerName}
          inviteCode={inviteCodeFromUrl || undefined}
          forceJoinMode={inviteMode === 'join'}
          onJoinSuccess={async (ledgerId, ledgerName) => {
            // Pure remote: just switch to the joined ledger
            setActiveId(ledgerId);

            // Load ledger data from cloud
            if (isCloudEnabled && user) {
              const cloudData = await loadFromCloud(ledgerId);
              if (cloudData) {
                setState(cloudData);
                updateLanguageFromOrigin(cloudData.originCountry);
              }
            }
          }}
        />
      )}

      {/* Members Panel */}
      {showMembersPanel && activeId && (
        <MembersPanel
          isOpen={showMembersPanel}
          onClose={() => setShowMembersPanel(false)}
          ledgerId={activeId}
          ownerId={user?.uid || ''}
        />
      )}

      {/* Migration Modal */}
      {showMigrationModal && activeId && (
        <MigrationModal
          isOpen={showMigrationModal}
          onClose={() => setShowMigrationModal(false)}
          ledgerId={activeId}
          localData={state}
        />
      )}

      {/* User Profile Modal */}
      {showUserProfile && (
        <UserProfileModal
          isOpen={showUserProfile}
          onClose={() => setShowUserProfile(false)}
        />
      )}

      {/* Ledger Manage Panel */}
      {showLedgerPanel && (
        <LedgerManagePanel
          isOpen={showLedgerPanel}
          onClose={() => setShowLedgerPanel(false)}
          ledgers={ledgers.map(l => ({
            ...l,
            isDefault: l.id === defaultLedgerId,
            isCloudSynced: isCloudEnabled && !!user
          }))}
          activeId={activeId}
          onSelect={(id) => {
            setActiveId(id);
            setShowLedgerPanel(false);
          }}
          onSetDefault={async (id) => {
            setDefaultLedgerId(id);
            localStorage.setItem('default_ledger_id', id);
            // Sync to cloud for cross-device sync
            if (user) {
              try {
                const { updateUserDefaultLedger } = await import('./services/firestoreService');
                await updateUserDefaultLedger(user.uid, id);
              } catch (err) {
                console.error('Failed to sync default ledger to cloud:', err);
              }
            }
          }}
          onDelete={async (id) => {
            if (id === activeId) return;
            // Delete from cloud - the subscription will update the UI
            try {
              const { deleteLedger: deleteCloudLedger } = await import('./services/firestoreService');
              await deleteCloudLedger(id);
            } catch (err) {
              console.error('Failed to delete ledger from cloud:', err);
            }
          }}
          onRefresh={() => {
            // Refresh is handled by cloud subscription
          }}
          onArchive={async (id) => {
            if (!user) return;
            try {
              const { updateLedger: updateCloudLedger } = await import('./services/firestoreService');
              await updateCloudLedger(id, { status: 'archived', archivedBy: user.uid });
              // UI will update via cloud subscription
            } catch (err) {
              console.error('Failed to archive ledger:', err);
            }
          }}
          onUnarchive={async (id) => {
            if (!user) return;
            try {
              const { updateLedger: updateCloudLedger } = await import('./services/firestoreService');
              await updateCloudLedger(id, { status: 'active', archivedBy: null });
              // UI will update via cloud subscription
            } catch (err) {
              console.error('Failed to unarchive ledger:', err);
            }
          }}
        />
      )}

      {/* Login Prompt Modal for First-time Users */}
      <LoginPromptModal
        isOpen={showLoginPrompt && !user}
        onLogin={handleLoginFromPrompt}
        onRegister={handleRegisterFromPrompt}
        onGuest={handleGuestMode}
      />

      {/* Welcome Wizard for New Users */}
      {showWelcomeWizard && (
        <WelcomeWizard
          isOpen={showWelcomeWizard}
          onClose={() => setShowWelcomeWizard(false)}
          onComplete={async (data) => {
            const id = createLedgerId();
            const newState: AppState = {
              ledgerName: data.ledgerName,
              expenses: [],
              exchangeRate: DEFAULT_RATE,
              families: data.families,
              currencyCode: COUNTRIES.find(c => c.name === data.destination)?.currency || 'IDR',
              destination: data.destination,
              baseCurrency: data.baseCurrency,
              originCountry: data.originCountry,
              lastUpdated: Date.now()
            };

            // Handle guest mode vs logged-in user
            if (isGuestMode) {
              // Guest mode: store in memory only
              setGuestLedgers(prev => [...prev, {
                id,
                name: newState.ledgerName,
                data: newState,
                createdAt: Date.now(),
              }]);
              setActiveId(id);
              setState(newState);
            } else if (isCloudEnabled && user) {
              // Logged-in user: create ledger in cloud
              try {
                const { createLedger, addMember, updateUserDefaultLedger, checkLedgerNameExists } = await import('./services/firestoreService');

                // Check for duplicate name
                const nameExists = await checkLedgerNameExists(user.uid, newState.ledgerName);
                if (nameExists) {
                  alert(language === 'zh'
                    ? `账本名称"${newState.ledgerName}"已存在，请使用其他名称`
                    : `Ledger name "${newState.ledgerName}" already exists. Please use a different name.`);
                  return;
                }

                await createLedger({
                  id,
                  name: newState.ledgerName,
                  ownerId: user.uid,
                  destination: newState.destination,
                  currencyCode: newState.currencyCode,
                  baseCurrency: newState.baseCurrency,
                  exchangeRate: newState.exchangeRate,
                  families: newState.families,
                  originCountry: newState.originCountry,
                } as any);

                // Add user as member
                const memberId = `${id}_${user.uid}`;
                await addMember(id, {
                  id: memberId,
                  ledgerId: id,
                  userId: user.uid,
                  role: 'owner',
                  displayName: user.displayName || user.email?.split('@')[0] || 'User',
                } as any);

                // Save default ledger to cloud if set
                if (data.setAsDefault) {
                  await updateUserDefaultLedger(user.uid, id);
                }
              } catch (err) {
                console.error('Failed to create cloud ledger:', err);
              }
            }

            setActiveId(id);
            setState(newState);
            if (data.setAsDefault) {
              setDefaultLedgerId(id);
              localStorage.setItem('default_ledger_id', id);
            }
            setShowWelcomeWizard(false);
            updateLanguageFromOrigin(data.originCountry);
          }}
        />
      )}

      {/* Guest Ledger Sync Modal */}
      <GuestLedgerSyncModal
        isOpen={showGuestSyncModal}
        onClose={() => setShowGuestSyncModal(false)}
        guestLedgers={guestLedgers}
        onSyncComplete={handleGuestSyncComplete}
      />

      {/* Hidden PDF Export Container */}
      <div id="pdf-export-container" className="fixed top-0 left-[200vw] w-[800px] bg-white p-8 z-[-1]">
        <h1 className="text-3xl font-bold mb-2 text-sky-800">{state.ledgerName} - {t('exportTitle')}</h1>
        <p className="text-gray-500 mb-6">{t('exportTime')}: {new Date().toLocaleString()}</p>

        <div className="mb-8">
          <h2 className="text-xl font-bold mb-4 border-b pb-2 text-gray-700">{t('summaryTab')}</h2>
          <Summary state={state} />
        </div>

        <div>
          <h2 className="text-xl font-bold mb-4 border-b pb-2 text-gray-700">{t('expensesTab')}</h2>
          <ExpenseList
            expenses={state.expenses}
            families={state.families}
            currencyCode={state.currencyCode}
            exchangeRate={state.exchangeRate}
            baseCurrency={state.baseCurrency}
            onDelete={() => {}} // No-op for export view
          />
        </div>
      </div>
    </div>
  );
};

export default App;
