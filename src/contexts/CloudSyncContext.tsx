import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  createLedger,
  updateLedger,
  getLedger,
  subscribeToUserLedgers,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenses,
  subscribeToExpenses,
  CloudLedger,
  CloudExpense,
} from '../../services/firestoreService';
import { AppState, Expense, Family } from '../../types';

// Types for sync state
export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';

export interface CloudSyncState {
  isOnline: boolean;
  syncStatus: SyncStatus;
  lastSyncAt: Date | null;
  pendingChanges: number;
  error: string | null;
  isCloudEnabled: boolean;
}

export interface CloudSyncContextType extends CloudSyncState {
  syncNow: (ledgerId: string, data: AppState) => Promise<void>;
  enableCloud: () => void;
  disableCloud: () => void;
  clearError: () => void;
  loadFromCloud: (ledgerId: string) => Promise<AppState | null>;
  subscribeToLedgerUpdates: (ledgerId: string, callback: (data: AppState) => void) => () => void;
  markPendingChange: () => void;
}

// Create context with undefined as default (will be set by provider)
const CloudSyncContext = createContext<CloudSyncContextType | undefined>(undefined);

// Initial state
const initialState: CloudSyncState = {
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  syncStatus: 'idle',
  lastSyncAt: null,
  pendingChanges: 0,
  error: null,
  isCloudEnabled: false,
};

interface CloudSyncProviderProps {
  children: ReactNode;
}

export const CloudSyncProvider: React.FC<CloudSyncProviderProps> = ({ children }) => {
  const [state, setState] = useState<CloudSyncState>(initialState);
  const auth = useAuth();
  const subscriptionsRef = useRef<(() => void)[]>([]);

  // Check if user is logged in (cloud sync requires authentication)
  const isAuthenticated = auth.user !== null;

  // Clear error action
  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null, syncStatus: prev.isOnline ? 'idle' : 'offline' }));
  }, []);

  // Enable cloud sync
  const enableCloud = useCallback(() => {
    if (!isAuthenticated) {
      setState((prev) => ({ ...prev, error: 'Must be logged in to enable cloud sync' }));
      return;
    }
    setState((prev) => ({ ...prev, isCloudEnabled: true, error: null }));
  }, [isAuthenticated]);

  // Disable cloud sync
  const disableCloud = useCallback(() => {
    // Cleanup all subscriptions
    subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
    subscriptionsRef.current = [];
    setState((prev) => ({ ...prev, isCloudEnabled: false, syncStatus: 'idle' }));
  }, []);

  // Mark a pending change (for offline queue)
  const markPendingChange = useCallback(() => {
    setState((prev) => ({ ...prev, pendingChanges: prev.pendingChanges + 1 }));
  }, []);

  // Sync ledger data to Firestore
  const syncNow = useCallback(async (ledgerId: string, data: AppState): Promise<void> => {
    if (!state.isCloudEnabled) {
      console.log('Cloud sync is not enabled');
      return;
    }

    if (!isAuthenticated) {
      console.log('Must be logged in to sync');
      return;
    }

    if (!state.isOnline) {
      console.log('Cannot sync while offline');
      markPendingChange();
      return;
    }

    setState((prev) => ({ ...prev, syncStatus: 'syncing', error: null }));

    try {
      // Check if ledger exists in cloud
      const existingLedger = await getLedger(ledgerId);

      if (existingLedger) {
        // Ledger exists in cloud - only update if user is the owner
        // Non-owner members should NOT update ledger metadata
        if (existingLedger.ownerId !== auth.user!.uid) {
          console.log('User is not the owner, skipping ledger update');
          // But we can still sync expenses
        } else {
          // Owner can update ledger metadata
          const cloudLedger: Partial<CloudLedger> = {
            name: data.ledgerName,
            destination: data.destination,
            currencyCode: data.currencyCode,
            baseCurrency: data.baseCurrency,
            exchangeRate: data.exchangeRate,
            families: data.families,
          };
          await updateLedger(ledgerId, cloudLedger);
        }
      } else {
        // Ledger doesn't exist in cloud - create it with current user as owner
        const cloudLedger: CloudLedger = {
          id: ledgerId,
          name: data.ledgerName,
          ownerId: auth.user!.uid,
          destination: data.destination,
          currencyCode: data.currencyCode,
          baseCurrency: data.baseCurrency,
          exchangeRate: data.exchangeRate,
          families: data.families,
        };
        await createLedger(cloudLedger);
      }

      // Sync expenses - only sync new expenses that don't exist in cloud
      const existingExpenses = await getExpenses(ledgerId);
      const existingExpenseIds = new Set(existingExpenses.map(e => e.id));

      for (const expense of data.expenses) {
        // Only create expenses that don't exist in cloud
        if (!existingExpenseIds.has(expense.id)) {
          const cloudExpense: CloudExpense = {
            id: expense.id,
            ledgerId,
            createdBy: auth.user!.uid,
            createdByDisplayName: auth.user!.displayName || 'User',
            date: expense.date,
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            payerId: expense.payerId,
            sharedWithFamilyIds: expense.sharedWithFamilyIds,
          };

          try {
            await createExpense(ledgerId, cloudExpense);
          } catch (err) {
            console.error('Failed to create expense:', expense.id, err);
          }
        }
      }

      setState((prev) => ({
        ...prev,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
        pendingChanges: 0,
        error: null,
      }));

      console.log('Sync completed successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      console.error('Sync failed:', message);
      setState((prev) => ({ ...prev, syncStatus: 'error', error: message }));
      markPendingChange();
    }
  }, [state.isCloudEnabled, state.isOnline, isAuthenticated, auth.user, markPendingChange]);

  // Load ledger data from cloud
  const loadFromCloud = useCallback(async (ledgerId: string): Promise<AppState | null> => {
    if (!isAuthenticated || !state.isCloudEnabled) {
      return null;
    }

    try {
      const ledger = await getLedger(ledgerId);
      if (!ledger) {
        return null;
      }

      const expenses = await getExpenses(ledgerId);

      // Convert cloud data to app state
      const appState: AppState = {
        ledgerName: ledger.name,
        expenses: expenses.map((e) => ({
          id: e.id,
          date: e.date,
          description: e.description,
          amount: e.amount,
          category: e.category,
          payerId: e.payerId,
          sharedWithFamilyIds: e.sharedWithFamilyIds,
        })),
        exchangeRate: ledger.exchangeRate,
        families: ledger.families,
        currencyCode: ledger.currencyCode,
        destination: ledger.destination,
        baseCurrency: ledger.baseCurrency,
        originCountry: '中国', // Default, could be stored in ledger
        lastUpdated: Date.now(),
      };

      return appState;
    } catch (err) {
      console.error('Failed to load from cloud:', err);
      return null;
    }
  }, [isAuthenticated, state.isCloudEnabled]);

  // Subscribe to real-time ledger updates
  const subscribeToLedgerUpdates = useCallback((
    ledgerId: string,
    callback: (data: AppState) => void
  ): (() => void) => {
    if (!isAuthenticated || !state.isCloudEnabled) {
      return () => {};
    }

    // Subscribe to ledger changes
    const unsubLedger = subscribeToUserLedgers(auth.user!.uid, async (ledgers) => {
      const ledger = ledgers.find(l => l.id === ledgerId);
      if (ledger) {
        const expenses = await getExpenses(ledgerId);
        const appState: AppState = {
          ledgerName: ledger.name,
          expenses: expenses.map((e) => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: e.amount,
            category: e.category,
            payerId: e.payerId,
            sharedWithFamilyIds: e.sharedWithFamilyIds,
          })),
          exchangeRate: ledger.exchangeRate,
          families: ledger.families,
          currencyCode: ledger.currencyCode,
          destination: ledger.destination,
          baseCurrency: ledger.baseCurrency,
          originCountry: '中国',
          lastUpdated: Date.now(),
        };
        callback(appState);
      }
    });

    // Subscribe to expense changes
    const unsubExpenses = subscribeToExpenses(ledgerId, async (expenses) => {
      const ledger = await getLedger(ledgerId);
      if (ledger) {
        const appState: AppState = {
          ledgerName: ledger.name,
          expenses: expenses.map((e) => ({
            id: e.id,
            date: e.date,
            description: e.description,
            amount: e.amount,
            category: e.category,
            payerId: e.payerId,
            sharedWithFamilyIds: e.sharedWithFamilyIds,
          })),
          exchangeRate: ledger.exchangeRate,
          families: ledger.families,
          currencyCode: ledger.currencyCode,
          destination: ledger.destination,
          baseCurrency: ledger.baseCurrency,
          originCountry: '中国',
          lastUpdated: Date.now(),
        };
        callback(appState);
      }
    });

    // Store subscriptions for cleanup
    const unsubscribe = () => {
      unsubLedger();
      unsubExpenses();
    };
    subscriptionsRef.current.push(unsubscribe);

    return unsubscribe;
  }, [isAuthenticated, state.isCloudEnabled, auth.user]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: true,
        syncStatus: prev.isCloudEnabled && isAuthenticated ? 'idle' : prev.syncStatus,
      }));
    };

    const handleOffline = () => {
      setState((prev) => ({
        ...prev,
        isOnline: false,
        syncStatus: prev.isCloudEnabled ? 'offline' : prev.syncStatus,
      }));
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup on unmount
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isAuthenticated]);

  // Initial state check on mount
  useEffect(() => {
    const checkInitialState = () => {
      const isCurrentlyOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

      setState((prev) => ({
        ...prev,
        isOnline: isCurrentlyOnline,
        syncStatus: !isCurrentlyOnline ? 'offline' : prev.syncStatus,
      }));
    };

    checkInitialState();
  }, []);

  // Auto-enable cloud sync when user logs in
  useEffect(() => {
    if (isAuthenticated && !state.isCloudEnabled) {
      setState((prev) => ({ ...prev, isCloudEnabled: true, syncStatus: 'idle' }));
    } else if (!isAuthenticated && state.isCloudEnabled) {
      // Cleanup subscriptions on logout
      subscriptionsRef.current.forEach(unsubscribe => unsubscribe());
      subscriptionsRef.current = [];
      setState((prev) => ({ ...prev, isCloudEnabled: false, syncStatus: 'idle' }));
    }
  }, [isAuthenticated, state.isCloudEnabled]);

  const value: CloudSyncContextType = {
    ...state,
    syncNow,
    enableCloud,
    disableCloud,
    clearError,
    loadFromCloud,
    subscribeToLedgerUpdates,
    markPendingChange,
  };

  return <CloudSyncContext.Provider value={value}>{children}</CloudSyncContext.Provider>;
};

// Custom hook for consuming cloud sync context
export const useCloudSync = (): CloudSyncContextType => {
  const context = useContext(CloudSyncContext);
  if (context === undefined) {
    throw new Error('useCloudSync must be used within a CloudSyncProvider');
  }
  return context;
};

export { CloudSyncContext };