import { AppState, Expense, Category, CATEGORY_MIGRATION } from '../types';
import { CloudLedger, CloudExpense, UserProfile, LedgerMember, COLLECTIONS } from '../types/firestore';
import { db } from './firebaseConfig';
import { createUserProfile, createLedger, addMember, createExpense, getUserProfile, getExpenses, getLedger, getLedgerMembers, getInvitationByCode } from './firestoreService';
import { collection, getDocs, query, where, serverTimestamp, doc, setDoc } from 'firebase/firestore';

// ==================== LOCAL TO CLOUD MIGRATION ====================

/**
 * Migrate local ledger data to cloud (Firestore)
 * Creates a new ledger in the cloud with all expenses
 */
export async function migrateLocalToCloud(
  localData: AppState,
  ledgerId: string,
  userId: string,
  displayName: string
): Promise<{ ledgerId: string }> {
  // Create user profile if not exists
  const existingProfile = await getUserProfile(userId);
  if (!existingProfile) {
    await createUserProfile(userId, {
      email: null,
      displayName,
      isAnonymous: true,
    });
  }

  // Create cloud ledger
  const cloudLedger: CloudLedger = {
    id: ledgerId,
    name: localData.ledgerName,
    ownerId: userId,
    destination: localData.destination,
    currencyCode: localData.currencyCode,
    baseCurrency: localData.baseCurrency,
    exchangeRate: localData.exchangeRate,
    families: localData.families,
    createdAt: null as never,
    updatedAt: null as never,
  };

  await createLedger(cloudLedger);

  // Add owner as member
  // Member ID must be in format: {ledgerId}_{userId} for Firestore security rules
  const memberId = `${ledgerId}_${userId}`;
  const member: LedgerMember = {
    id: memberId,
    ledgerId,
    userId,
    role: 'owner',
    joinedAt: null as never,
    displayName,
  };
  await addMember(ledgerId, member);

  // Migrate all expenses
  for (const expense of localData.expenses) {
    const cloudExpense = convertLocalExpenseToCloud(expense, ledgerId, userId, displayName);
    await createExpense(ledgerId, cloudExpense);
  }

  return { ledgerId };
}

/**
 * Convert local expense to cloud expense format
 */
function convertLocalExpenseToCloud(
  expense: Expense,
  ledgerId: string,
  userId: string,
  displayName: string
): CloudExpense {
  // Handle legacy Chinese category migration
  let category = expense.category;
  if (typeof category === 'string' && CATEGORY_MIGRATION[category]) {
    category = CATEGORY_MIGRATION[category];
  }

  return {
    id: expense.id || crypto.randomUUID(),
    ledgerId,
    createdBy: userId,
    createdByDisplayName: displayName,
    date: expense.date,
    description: expense.description,
    amount: expense.amount,
    category: category as Category,
    payerId: expense.payerId,
    sharedWithFamilyIds: expense.sharedWithFamilyIds || [],
    version: expense.version || 1,  // Add version field
    createdAt: null as never,
    updatedAt: null as never,
  };
}

// ==================== CLOUD TO LOCAL MIGRATION ====================

/**
 * Migrate cloud ledger data to local storage
 * Fetches data from Firestore and saves to localStorage
 */
export async function migrateCloudToLocal(
  ledgerId: string,
  cloudLedger: CloudLedger,
  expenses: CloudExpense[]
): Promise<AppState> {
  const { loadLedger } = await import('./storageService');

  // Convert cloud expenses to local format
  const localExpenses: Expense[] = expenses.map(convertCloudExpenseToLocal);

  // Build local app state
  const localData: AppState = {
    ledgerName: cloudLedger.name,
    expenses: localExpenses,
    exchangeRate: cloudLedger.exchangeRate,
    families: cloudLedger.families,
    currencyCode: cloudLedger.currencyCode,
    destination: cloudLedger.destination,
    baseCurrency: cloudLedger.baseCurrency,
    originCountry: '', // Will be inferred from baseCurrency
    lastUpdated: Date.now(),
  };

  // Save to local storage
  const { saveLedger } = await import('./storageService');
  saveLedger(ledgerId, localData);

  return localData;
}

/**
 * Convert cloud expense to local expense format
 */
function convertCloudExpenseToLocal(expense: CloudExpense): Expense {
  return {
    id: expense.id,
    date: expense.date,
    description: expense.description,
    amount: expense.amount,
    category: expense.category,
    payerId: expense.payerId,
    sharedWithFamilyIds: expense.sharedWithFamilyIds,
    version: expense.version || 1,  // Include version for sync
    updatedAt: expense.updatedAt ? expense.updatedAt.seconds * 1000 : undefined,  // Include updatedAt
  };
}

// ==================== BIDIRECTIONAL SYNC ====================

/**
 * Sync result for reporting
 */
export interface SyncResult {
  success: boolean;
  localUpdated: boolean;
  cloudUpdated: boolean;
  error?: string;
}

/**
 * Check if local data exists for a ledger
 */
export async function hasLocalData(ledgerId: string): Promise<boolean> {
  const { loadLedger } = await import('./storageService');
  const localData = loadLedger(ledgerId);
  return localData !== null;
}

/**
 * Check if cloud data exists for a ledger
 */
export async function hasCloudData(ledgerId: string): Promise<boolean> {
  const ledger = await getLedger(ledgerId);
  return ledger !== null;
}

/**
 * Get data source status for a ledger
 */
export interface DataSourceStatus {
  hasLocal: boolean;
  hasCloud: boolean;
  localTimestamp?: number;
  cloudTimestamp?: number;
}

/**
 * Get the data source status for a ledger
 */
export async function getDataSourceStatus(ledgerId: string): Promise<DataSourceStatus> {
  const status: DataSourceStatus = {
    hasLocal: false,
    hasCloud: false,
  };

  // Check local
  const { loadLedger } = await import('./storageService');
  const localData = loadLedger(ledgerId);
  if (localData) {
    status.hasLocal = true;
    status.localTimestamp = localData.lastUpdated;
  }

  // Check cloud
  const cloudLedger = await getLedger(ledgerId);
  if (cloudLedger) {
    status.hasCloud = true;
    // Use updatedAt timestamp if available
    if (cloudLedger.updatedAt && typeof cloudLedger.updatedAt === 'object' && 'seconds' in cloudLedger.updatedAt) {
      status.cloudTimestamp = (cloudLedger.updatedAt.seconds as number) * 1000;
    }
  }

  return status;
}

/**
 * Resolve conflicts when data exists in both local and cloud
 * Strategy: Use the most recently updated data
 */
export async function resolveDataConflict(
  ledgerId: string,
  strategy: 'local' | 'cloud' | 'newest'
): Promise<SyncResult> {
  try {
    const status = await getDataSourceStatus(ledgerId);

    if (!status.hasLocal && !status.hasCloud) {
      return {
        success: false,
        localUpdated: false,
        cloudUpdated: false,
        error: 'No data found in either local or cloud',
      };
    }

    // If only one source has data, use that
    if (!status.hasCloud) {
      return { success: true, localUpdated: false, cloudUpdated: false };
    }

    if (!status.hasLocal) {
      // Need to pull from cloud
      const cloudLedger = await getLedger(ledgerId);
      if (!cloudLedger) {
        return {
          success: false,
          localUpdated: false,
          cloudUpdated: false,
          error: 'Failed to fetch cloud data',
        };
      }

      const expenses = await getExpenses(ledgerId);
      await migrateCloudToLocal(ledgerId, cloudLedger, expenses);

      return {
        success: true,
        localUpdated: true,
        cloudUpdated: false,
      };
    }

    // Both exist - resolve based on strategy
    let useCloud = false;

    if (strategy === 'local') {
      useCloud = false;
    } else if (strategy === 'cloud') {
      useCloud = true;
    } else {
      // Use newest
      const localTime = status.localTimestamp || 0;
      const cloudTime = status.cloudTimestamp || 0;
      useCloud = cloudTime > localTime;
    }

    if (useCloud) {
      // Pull from cloud to local
      const cloudLedger = await getLedger(ledgerId);
      if (!cloudLedger) {
        return {
          success: false,
          localUpdated: false,
          cloudUpdated: false,
          error: 'Failed to fetch cloud data',
        };
      }

      const expenses = await getExpenses(ledgerId);
      await migrateCloudToLocal(ledgerId, cloudLedger, expenses);

      return {
        success: true,
        localUpdated: true,
        cloudUpdated: false,
      };
    } else {
      // Keep local, push to cloud if needed
      // This would require user authentication
      return {
        success: true,
        localUpdated: false,
        cloudUpdated: false,
      };
    }
  } catch (error) {
    return {
      success: false,
      localUpdated: false,
      cloudUpdated: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// ==================== EXPORT/IMPORT UTILITIES ====================

/**
 * Export local data as JSON for backup
 */
export function exportLocalData(ledgerId: string): string | null {
  const { loadLedger } = require('./storageService');
  const data = loadLedger(ledgerId);
  return data ? JSON.stringify(data, null, 2) : null;
}

/**
 * Import data from JSON backup
 */
export function importLocalData(ledgerId: string, jsonData: string): AppState | null {
  try {
    const data = JSON.parse(jsonData) as AppState;
    const { saveLedger } = require('./storageService');
    saveLedger(ledgerId, data);
    return data;
  } catch (error) {
    console.error('Failed to import local data:', error);
    return null;
  }
}