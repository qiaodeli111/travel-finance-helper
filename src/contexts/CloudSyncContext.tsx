import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';

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
  syncNow: () => Promise<void>;
  enableCloud: () => void;
  disableCloud: () => void;
  clearError: () => void;
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
    setState((prev) => ({ ...prev, isCloudEnabled: false, syncStatus: 'idle' }));
  }, []);

  // Sync now action
  const syncNow = useCallback(async (): Promise<void> => {
    if (!state.isCloudEnabled) {
      setState((prev) => ({ ...prev, error: 'Cloud sync is not enabled' }));
      return;
    }

    if (!isAuthenticated) {
      setState((prev) => ({ ...prev, error: 'Must be logged in to sync' }));
      return;
    }

    if (!state.isOnline) {
      setState((prev) => ({ ...prev, syncStatus: 'offline', error: 'Cannot sync while offline' }));
      return;
    }

    setState((prev) => ({ ...prev, syncStatus: 'syncing', error: null }));

    try {
      // Simulate sync delay - in real implementation, this would call Firebase Firestore
      // or other cloud sync service
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setState((prev) => ({
        ...prev,
        syncStatus: 'synced',
        lastSyncAt: new Date(),
        pendingChanges: 0,
        error: null,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Sync failed';
      setState((prev) => ({ ...prev, syncStatus: 'error', error: message }));
    }
  }, [state.isCloudEnabled, state.isOnline, isAuthenticated]);

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

  // Auto-sync when coming back online if cloud is enabled
  useEffect(() => {
    if (state.isOnline && state.isCloudEnabled && isAuthenticated && state.pendingChanges > 0) {
      syncNow();
    }
  }, [state.isOnline, state.isCloudEnabled, isAuthenticated, state.pendingChanges, syncNow]);

  const value: CloudSyncContextType = {
    ...state,
    syncNow,
    enableCloud,
    disableCloud,
    clearError,
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