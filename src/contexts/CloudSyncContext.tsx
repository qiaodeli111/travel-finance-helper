import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { useAuth } from './AuthContext';
import {
  createLedger,
  updateLedger,
  getLedger,
  subscribeToUserLedgers,
  createExpense,
  updateExpense,
  softDeleteExpense,
  deleteExpense,
  getExpenses,
  subscribeToExpenses,
  addMember,
  getLedgerMembers,
  CloudLedger,
  CloudExpense,
  LedgerMember,
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
  cloudLedgers: CloudLedger[];  // List of user's cloud ledgers
  isLoadingLedgers: boolean;    // Loading state for ledger list
}

export interface CloudSyncContextType extends CloudSyncState {
  syncNow: (ledgerId: string, data: AppState) => Promise<void>;
  enableCloud: () => void;
  disableCloud: () => void;
  clearError: () => void;
  loadFromCloud: (ledgerId: string) => Promise<AppState | null>;
  subscribeToLedgerUpdates: (ledgerId: string, callback: (data: AppState) => void) => () => void;
  markPendingChange: () => void;
  refreshCloudLedgers: () => void;  // Manual refresh function
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
  cloudLedgers: [],
  isLoadingLedgers: false,
};

interface CloudSyncProviderProps {
  children: ReactNode;
}

export const CloudSyncProvider: React.FC<CloudSyncProviderProps> = ({ children }) => {
  const [state, setState] = useState<CloudSyncState>(initialState);
  const auth = useAuth();
  const subscriptionsRef = useRef<(() => void)[]>([]);
  const ledgerSubscriptionRef = useRef<(() => void) | null>(null);

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

  // Refresh cloud ledgers - manual trigger
  const refreshCloudLedgers = useCallback(() => {
    if (!isAuthenticated || !state.isCloudEnabled || !auth.user) {
      console.log('Cannot refresh ledgers: not authenticated or cloud disabled');
      return;
    }

    // Clean up existing subscription
    if (ledgerSubscriptionRef.current) {
      ledgerSubscriptionRef.current();
    }

    setState((prev) => ({ ...prev, isLoadingLedgers: true }));

    // Subscribe to user's ledgers
    const unsubscribe = subscribeToUserLedgers(auth.user.uid, (ledgers) => {
      console.log('Received cloud ledgers update:', ledgers.length, 'ledgers');
      setState((prev) => ({
        ...prev,
        cloudLedgers: ledgers,
        isLoadingLedgers: false,
      }));
    });

    ledgerSubscriptionRef.current = unsubscribe;
  }, [isAuthenticated, state.isCloudEnabled, auth.user]);

  // Track locally deleted expense IDs for sync
  const locallyDeletedIdsRef = useRef<Set<string>>(new Set());

  // Track synced expense IDs to detect deletions
  const lastSyncedIdsRef = useRef<Set<string>>(new Set());

  // Sync ledger data to Firestore (bidirectional)
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
            originCountry: data.originCountry,
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
          originCountry: data.originCountry,
        } as CloudLedger;
        await createLedger(cloudLedger);

        // Add current user as a member (owner role)
        // This is required for subscribeToUserLedgers to find the ledger
        // Member ID must be in format: {ledgerId}_{userId} for Firestore security rules
        const memberId = `${ledgerId}_${auth.user!.uid}`;
        const member: LedgerMember = {
          id: memberId,
          ledgerId,
          userId: auth.user!.uid,
          role: 'owner',
          joinedAt: null as never,
          displayName: auth.user!.displayName || auth.user!.email?.split('@')[0] || 'User',
        };
        await addMember(ledgerId, member);
        console.log('Created ledger member record for user:', auth.user!.uid, 'with id:', memberId);
      }

      // Get existing expenses from cloud (including soft-deleted ones)
      const existingExpenses = await getExpenses(ledgerId);
      const activeCloudExpenses = existingExpenses.filter(e => !e.deletedAt);
      const deletedCloudExpenseIds = new Set(
        existingExpenses.filter(e => e.deletedAt).map(e => e.id)
      );

      const existingExpenseIds = new Set(existingExpenses.map(e => e.id));
      const localExpenseIds = new Set(data.expenses.map(e => e.id));

      // Track previously synced IDs to detect local deletions
      const previousSyncedIds = lastSyncedIdsRef.current;
      const currentLocalIds = new Set(data.expenses.map(e => e.id));

      // Detect locally deleted expenses (were in previous sync, not in current local)
      const locallyDeletedIds = new Set<string>();
      previousSyncedIds.forEach(id => {
        if (!currentLocalIds.has(id) && existingExpenseIds.has(id)) {
          locallyDeletedIds.add(id);
        }
      });

      // Soft delete in cloud for locally deleted expenses
      for (const expenseId of locallyDeletedIds) {
        if (!deletedCloudExpenseIds.has(expenseId)) {
          try {
            const cloudExp = existingExpenses.find(e => e.id === expenseId);
            if (cloudExp) {
              await softDeleteExpense(ledgerId, expenseId, cloudExp.version || 1);
              console.log('Soft deleted expense in cloud:', expenseId);
            }
          } catch (err) {
            console.error('Failed to soft delete expense:', expenseId, err);
          }
        }
      }

      // Upload new local expenses that don't exist in cloud (and aren't soft-deleted)
      for (const expense of data.expenses) {
        if (!existingExpenseIds.has(expense.id)) {
          const cloudExpense: Omit<CloudExpense, 'createdAt' | 'updatedAt'> = {
            id: expense.id,
            ledgerId,
            createdBy: expense.createdBy || auth.user!.uid,
            createdByDisplayName: expense.createdByDisplayName || auth.user!.displayName || 'User',
            date: expense.date,
            description: expense.description,
            amount: expense.amount,
            category: expense.category,
            payerId: expense.payerId,
            sharedWithFamilyIds: expense.sharedWithFamilyIds || [],
            travelPlaceName: expense.travelPlaceName,
            paymentCurrency: expense.paymentCurrency,
            settlementCurrency: expense.settlementCurrency,
            fxSnapshot: expense.fxSnapshot,
            amountSettlement: expense.amountSettlement,
            version: expense.version || 1,
          };

          try {
            await createExpense(ledgerId, cloudExpense as CloudExpense);
          } catch (err) {
            console.error('Failed to create expense:', expense.id, err);
          }
        }
      }

      // Update lastSyncedIds for next sync
      lastSyncedIdsRef.current = new Set(data.expenses.map(e => e.id));

      // Download active expenses from cloud that don't exist locally
      const newCloudExpenses: Expense[] = [];
      for (const cloudExp of activeCloudExpenses) {
        if (!localExpenseIds.has(cloudExp.id)) {
          newCloudExpenses.push({
            id: cloudExp.id,
            date: cloudExp.date,
            description: cloudExp.description,
            amount: cloudExp.amount,
            category: cloudExp.category,
            payerId: cloudExp.payerId,
            sharedWithFamilyIds: cloudExp.sharedWithFamilyIds,
            travelPlaceName: cloudExp.travelPlaceName,
            paymentCurrency: cloudExp.paymentCurrency,
            settlementCurrency: cloudExp.settlementCurrency,
            fxSnapshot: cloudExp.fxSnapshot,
            amountSettlement: cloudExp.amountSettlement,
            createdBy: cloudExp.createdBy,
            createdByDisplayName: cloudExp.createdByDisplayName,
            createdAt: cloudExp.createdAt ? cloudExp.createdAt.seconds * 1000 : undefined,
            version: cloudExp.version || 1,
            updatedAt: cloudExp.updatedAt ? cloudExp.updatedAt.seconds * 1000 : undefined,
          });
        }
      }

      // If there are new expenses from cloud, update local state
      if (newCloudExpenses.length > 0) {
        console.log(`Downloaded ${newCloudExpenses.length} new expenses from cloud`);
        // Return the new expenses to be merged by the caller
        // This will be handled by the sync caller (App.tsx)
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

      const allExpenses = await getExpenses(ledgerId);
      // Filter out soft-deleted expenses
      const activeExpenses = allExpenses.filter(e => !e.deletedAt);

      // Update lastSyncedIds for deletion tracking
      lastSyncedIdsRef.current = new Set(activeExpenses.map(e => e.id));

      // Convert cloud data to app state with creator info
      const appState: AppState = {
        ledgerName: ledger.name,
        expenses: activeExpenses.map((e) => ({
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
        })),
        exchangeRate: ledger.exchangeRate,
        families: ledger.families,
        currencyCode: ledger.currencyCode,
        destination: ledger.destination,
        baseCurrency: ledger.baseCurrency,
        originCountry: ledger.originCountry || '中国',
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
        const allExpenses = await getExpenses(ledgerId);
        // Filter out soft-deleted expenses
        const activeExpenses = allExpenses.filter(e => !e.deletedAt);
        const appState: AppState = {
          ledgerName: ledger.name,
          expenses: activeExpenses.map((e) => ({
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
          })),
          exchangeRate: ledger.exchangeRate,
          families: ledger.families,
          currencyCode: ledger.currencyCode,
          destination: ledger.destination,
          baseCurrency: ledger.baseCurrency,
          originCountry: ledger.originCountry || '中国',
          lastUpdated: Date.now(),
        };
        callback(appState);
      }
    });

    // Subscribe to expense changes
    const unsubExpenses = subscribeToExpenses(ledgerId, async (expenses) => {
      const ledger = await getLedger(ledgerId);
      if (ledger) {
        // Filter out soft-deleted expenses
        const activeExpenses = expenses.filter(e => !e.deletedAt);
        const appState: AppState = {
          ledgerName: ledger.name,
          expenses: activeExpenses.map((e) => ({
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
          })),
          exchangeRate: ledger.exchangeRate,
          families: ledger.families,
          currencyCode: ledger.currencyCode,
          destination: ledger.destination,
          baseCurrency: ledger.baseCurrency,
          originCountry: ledger.originCountry || '中国',
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
      if (ledgerSubscriptionRef.current) {
        ledgerSubscriptionRef.current();
        ledgerSubscriptionRef.current = null;
      }
      setState((prev) => ({
        ...prev,
        isCloudEnabled: false,
        syncStatus: 'idle',
        cloudLedgers: [],
        isLoadingLedgers: false,
      }));
    }
  }, [isAuthenticated, state.isCloudEnabled]);

  // Subscribe to cloud ledgers when cloud is enabled and user is authenticated
  useEffect(() => {
    if (isAuthenticated && state.isCloudEnabled && auth.user) {
      console.log('Subscribing to cloud ledgers for user:', auth.user.uid);

      setState((prev) => ({ ...prev, isLoadingLedgers: true }));

      const unsubscribe = subscribeToUserLedgers(auth.user.uid, (ledgers) => {
        console.log('Received cloud ledgers update:', ledgers.length, 'ledgers');
        setState((prev) => ({
          ...prev,
          cloudLedgers: ledgers,
          isLoadingLedgers: false,
        }));
      });

      ledgerSubscriptionRef.current = unsubscribe;

      return () => {
        if (ledgerSubscriptionRef.current) {
          ledgerSubscriptionRef.current();
          ledgerSubscriptionRef.current = null;
        }
      };
    }
  }, [isAuthenticated, state.isCloudEnabled, auth.user]);

  const value: CloudSyncContextType = {
    ...state,
    syncNow,
    enableCloud,
    disableCloud,
    clearError,
    loadFromCloud,
    subscribeToLedgerUpdates,
    markPendingChange,
    refreshCloudLedgers,
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