import { Expense } from '../types';
import { CloudExpense, Timestamp } from '../types/firestore';

// ==================== Types ====================

export interface SyncResult {
  success: boolean;
  conflicts: ConflictInfo[];
  mergedData: Expense[];
}

export interface ConflictInfo {
  localId: string;
  remoteId: string;
  localVersion: number;
  remoteVersion: number;
  resolvedBy: 'local' | 'remote';
}

// ==================== Version Manager ====================

/**
 * Increment version number for an expense
 */
export function incrementVersion(expense: Expense): Expense {
  return {
    ...expense,
    version: (expense.version || 0) + 1,
    updatedAt: Date.now(),
  };
}

/**
 * Initialize version for a new expense
 */
export function initializeVersion(expense: Expense): Expense {
  return {
    ...expense,
    version: 1,
    updatedAt: Date.now(),
  };
}

/**
 * Compare two versions
 * Returns: 1 if a > b, -1 if a < b, 0 if equal
 */
export function compareVersions(a: number | undefined, b: number | undefined): number {
  const vA = a || 0;
  const vB = b || 0;
  if (vA > vB) return 1;
  if (vA < vB) return -1;
  return 0;
}

// ==================== Conflict Resolver ====================

/**
 * Resolve conflict between local and remote expense
 * Version high wins; if equal, updatedAt decides
 */
export function resolveConflict(
  local: Expense,
  remote: CloudExpense
): { expense: Expense; resolvedBy: 'local' | 'remote' } {
  const localVersion = local.version || 0;
  const remoteVersion = remote.version || 0;

  // Version comparison
  if (remoteVersion > localVersion) {
    return {
      expense: cloudExpenseToLocal(remote),
      resolvedBy: 'remote',
    };
  }

  if (localVersion > remoteVersion) {
    return {
      expense: local,
      resolvedBy: 'local',
    };
  }

  // Versions equal - compare timestamps
  const localUpdatedAt = local.updatedAt || 0;
  const remoteUpdatedAt = timestampToMillis(remote.updatedAt);

  if (remoteUpdatedAt > localUpdatedAt) {
    return {
      expense: cloudExpenseToLocal(remote),
      resolvedBy: 'remote',
    };
  }

  return {
    expense: local,
    resolvedBy: 'local',
  };
}

/**
 * Resolve conflict when one side is deleted
 * Delete always wins
 */
export function resolveDeletionConflict(
  local: Expense | null,
  remote: CloudExpense | null
): { expense: Expense | null; shouldDelete: boolean } {
  // If remote is deleted
  if (remote?.deletedAt) {
    return { expense: null, shouldDelete: true };
  }

  // If local is deleted
  if (local?.deletedAt) {
    return { expense: null, shouldDelete: true };
  }

  // Both exist - normal conflict resolution
  if (local && remote) {
    const resolved = resolveConflict(local, remote);
    return { expense: resolved.expense, shouldDelete: false };
  }

  // One side missing
  return {
    expense: local || (remote ? cloudExpenseToLocal(remote) : null),
    shouldDelete: false,
  };
}

/**
 * Merge local and remote expense lists
 */
export function mergeExpenses(
  localExpenses: Expense[],
  remoteExpenses: CloudExpense[]
): SyncResult {
  const conflicts: ConflictInfo[] = [];
  const mergedMap = new Map<string, Expense>();

  // Create map of local expenses
  for (const expense of localExpenses) {
    if (expense.deletedAt) continue; // Skip locally deleted
    mergedMap.set(expense.id, expense);
  }

  // Process remote expenses
  for (const remote of remoteExpenses) {
    if (remote.deletedAt) {
      // Remote is deleted - remove from merged
      mergedMap.delete(remote.id);
      continue;
    }

    const local = mergedMap.get(remote.id);

    if (!local) {
      // Only remote has it
      mergedMap.set(remote.id, cloudExpenseToLocal(remote));
    } else {
      // Both have it - resolve conflict
      const result = resolveConflict(local, remote);

      if (result.resolvedBy === 'remote') {
        conflicts.push({
          localId: local.id,
          remoteId: remote.id,
          localVersion: local.version || 0,
          remoteVersion: remote.version || 0,
          resolvedBy: 'remote',
        });
      }

      mergedMap.set(remote.id, result.expense);
    }
  }

  return {
    success: true,
    conflicts,
    mergedData: Array.from(mergedMap.values()),
  };
}

// ==================== Helpers ====================

/**
 * Convert CloudExpense to local Expense format
 */
function cloudExpenseToLocal(cloud: CloudExpense): Expense {
  return {
    id: cloud.id,
    date: cloud.date,
    description: cloud.description,
    amount: cloud.amount,
    category: cloud.category,
    payerId: cloud.payerId,
    sharedWithFamilyIds: cloud.sharedWithFamilyIds,
    travelPlaceName: cloud.travelPlaceName,
    paymentCurrency: cloud.paymentCurrency,
    settlementCurrency: cloud.settlementCurrency,
    fxSnapshot: cloud.fxSnapshot,
    amountSettlement: cloud.amountSettlement,
    createdBy: cloud.createdBy,
    createdByDisplayName: cloud.createdByDisplayName,
    createdAt: timestampToMillis(cloud.createdAt),
    version: cloud.version || 1,
    updatedAt: timestampToMillis(cloud.updatedAt),
  };
}

/**
 * Convert Timestamp to milliseconds
 */
function timestampToMillis(timestamp: Timestamp | null | undefined): number {
  if (!timestamp) return 0;
  // Timestamp has seconds and nanoseconds, convert to milliseconds
  if ('toMillis' in timestamp && typeof (timestamp as any).toMillis === 'function') {
    return (timestamp as any).toMillis();
  }
  return timestamp.seconds * 1000;
}

/**
 * Check if expense is deleted
 */
export function isDeleted(expense: Expense | CloudExpense): boolean {
  return !!expense.deletedAt;
}

/**
 * Filter out deleted expenses
 */
export function filterDeleted<T extends { deletedAt?: unknown }>(items: T[]): T[] {
  return items.filter(item => !item.deletedAt);
}