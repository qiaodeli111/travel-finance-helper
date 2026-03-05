# 同步架构重构实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 重构同步架构，解决删除同步、账本列表同步、游客模式和账本创建引导问题

**Architecture:** 引入版本控制和软删除机制，实现乐观更新+冲突解决；登录后自动合并云端账本；游客模式使用 sessionStorage；账本创建使用多步骤向导

**Tech Stack:** React, TypeScript, Firebase Firestore, IndexedDB (idb)

---

## Phase 1: 数据模型更新

### Task 1.1: 更新 Expense 类型添加版本控制字段

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/types.ts:26-38`

**Step 1: 添加版本控制字段到 Expense 接口**

在 `Expense` 接口中添加 `version`, `deletedAt`, `updatedAt` 字段：

```typescript
export interface Expense {
  id: string;
  date: number; // timestamp
  description: string;
  amount: number; // Generic amount in target currency
  category: Category;
  payerId: string; // Family ID
  sharedWithFamilyIds?: string[]; // IDs of families sharing this expense (excluding payer)
  // Creator info for tracking who added the expense
  createdBy?: string; // User ID who created this expense
  createdByDisplayName?: string; // Display name of creator
  createdAt?: number; // Timestamp when the expense record was created

  // Version control fields for sync
  version?: number;           // 版本号，每次修改 +1
  deletedAt?: number;         // 软删除时间戳，存在则表示已删除
  updatedAt?: number;         // 最后更新时间戳
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add types.ts
git commit -m "feat: add version control fields to Expense type"
```

---

### Task 1.2: 更新 CloudExpense 类型添加版本控制字段

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/types/firestore.ts:64-77`

**Step 1: 添加版本控制字段到 CloudExpense 接口**

```typescript
// Cloud expense document
export interface CloudExpense {
  id: string;
  ledgerId: string;
  createdBy: string;
  createdByDisplayName: string;
  date: number;
  description: string;
  amount: number;
  category: Category;
  payerId: string;
  sharedWithFamilyIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Version control fields
  version: number;           // 版本号，每次修改 +1
  deletedAt?: Timestamp | null;  // 软删除时间戳
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add types/firestore.ts
git commit -m "feat: add version control fields to CloudExpense type"
```

---

### Task 1.3: 更新 LedgerMeta 类型添加同步字段

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/types/firestore.ts:23-38`

**Step 1: 在 CloudLedger 接口添加同步字段**

```typescript
// Cloud ledger document
export interface CloudLedger {
  id: string;
  name: string;
  ownerId: string;
  destination: string;
  currencyCode: string;
  baseCurrency: string;
  exchangeRate: number;
  families: Family[];
  originCountry?: string; // Where the users are from
  status?: 'active' | 'archived'; // Ledger status
  archivedAt?: Timestamp | null; // When archived
  archivedBy?: string | null; // Who archived it
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Sync control fields
  version?: number;           // 账本元数据版本
  lastSyncedAt?: Timestamp | null; // 最后同步时间
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add types/firestore.ts
git commit -m "feat: add sync control fields to CloudLedger type"
```

---

## Phase 2: SyncService 核心模块

### Task 2.1: 创建 SyncService 核心文件

**Files:**
- Create: `/mnt/d/Projects/travel-finance-helper/services/SyncService.ts`

**Step 1: 创建 SyncService 文件**

```typescript
import { Expense } from '../types';
import { CloudExpense } from '../types/firestore';

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
  const remoteUpdatedAt = remote.updatedAt?.toMillis?.() || 0;

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
    createdBy: cloud.createdBy,
    createdByDisplayName: cloud.createdByDisplayName,
    createdAt: cloud.createdAt?.toMillis?.() || Date.now(),
    version: cloud.version || 1,
    updatedAt: cloud.updatedAt?.toMillis?.() || Date.now(),
  };
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
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add services/SyncService.ts
git commit -m "feat: add SyncService core module with version control and conflict resolution"
```

---

### Task 2.2: 更新 firestoreService 支持软删除

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/services/firestoreService.ts`

**Step 1: 添加软删除函数**

在 `firestoreService.ts` 中添加 `softDeleteExpense` 函数：

```typescript
/**
 * Soft delete an expense (sets deletedAt timestamp)
 */
export async function softDeleteExpense(
  ledgerId: string,
  expenseId: string,
  currentVersion: number
): Promise<void> {
  try {
    const expenseRef = doc(db, COLLECTIONS.LEDGERS, ledgerId, COLLECTIONS.EXPENSES, expenseId);

    await updateDoc(expenseRef, {
      deletedAt: serverTimestamp(),
      version: currentVersion + 1,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error soft deleting expense:', error);
    throw new Error(`Failed to delete expense: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Step 2: 修改 createExpense 函数添加 version 字段**

找到 `createExpense` 函数，添加 `version: 1`：

```typescript
export async function createExpense(ledgerId: string, expense: Omit<CloudExpense, 'createdAt' | 'updatedAt'>): Promise<void> {
  try {
    const expenseRef = doc(db, COLLECTIONS.LEDGERS, ledgerId, COLLECTIONS.EXPENSES, expense.id);

    await setDoc(expenseRef, {
      ...expense,
      version: expense.version || 1,  // 添加这行
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    // ...
  }
}
```

**Step 3: 修改 updateExpense 函数增加 version**

找到 `updateExpense` 函数，确保更新时增加版本号：

```typescript
export async function updateExpense(
  ledgerId: string,
  expenseId: string,
  data: Partial<CloudExpense>
): Promise<void> {
  try {
    const expenseRef = doc(db, COLLECTIONS.LEDGERS, ledgerId, COLLECTIONS.EXPENSES, expenseId);

    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: serverTimestamp(),
    };

    // Increment version if not explicitly set
    if (data.version === undefined) {
      // Get current version first
      const currentDoc = await getDoc(expenseRef);
      const currentVersion = currentDoc.exists() ? (currentDoc.data().version || 0) : 0;
      updateData.version = currentVersion + 1;
    }

    await updateDoc(expenseRef, updateData);
  } catch (error) {
    // ...
  }
}
```

**Step 4: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 5: Commit**

```bash
git add services/firestoreService.ts
git commit -m "feat: add soft delete and version control to expense operations"
```

---

### Task 2.3: 修改 App.tsx 使用软删除

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/App.tsx`

**Step 1: 导入 softDeleteExpense**

在文件顶部的导入区域添加：

```typescript
import { softDeleteExpense } from './services/firestoreService';
import { incrementVersion } from './services/SyncService';
```

**Step 2: 修改删除逻辑**

找到 `ExpenseList` 组件的 `onDelete` 回调（约 line 737），修改为：

```typescript
onDelete={async (id) => {
  // 找到要删除的账单
  const expenseToDelete = state.expenses.find(e => e.id === id);
  if (!expenseToDelete) return;

  // 乐观更新：立即从本地状态移除
  setState(prev => ({
    ...prev,
    expenses: prev.expenses.filter(e => e.id !== id)
  }));

  // 同步到云端
  if (user && activeId && isCloudEnabled) {
    try {
      // 使用软删除
      await softDeleteExpense(activeId, id, expenseToDelete.version || 0);
      console.log('Expense soft deleted from cloud');
    } catch (err) {
      console.error('Failed to delete expense from cloud:', err);
    }
  }
}}
```

**Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: use soft delete for expense deletion"
```

---

## Phase 3: 账本列表同步

### Task 3.1: 创建账本同步服务

**Files:**
- Create: `/mnt/d/Projects/travel-finance-helper/services/LedgerSyncService.ts`

**Step 1: 创建 LedgerSyncService 文件**

```typescript
import { CloudLedger } from '../types/firestore';

// Local ledger metadata
export interface LedgerMeta {
  id: string;
  name: string;
  lastAccess: number;
  ownerId?: string;
  isLocal?: boolean;
  isCloudSynced?: boolean;
  status: 'active' | 'archived';
  version?: number;
  lastSyncedAt?: number;
}

export interface LedgerSyncResult {
  merged: LedgerMeta[];
  toUpload: LedgerMeta[];
  toDownload: string[]; // ledger IDs to download
}

const LEDGER_LIST_KEY = 'ledger_list';
const GUEST_LEDGER_KEY = 'guest_ledger';

/**
 * Get local ledger list
 */
export function getLocalLedgers(): LedgerMeta[] {
  try {
    const stored = localStorage.getItem(LEDGER_LIST_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

/**
 * Save local ledger list
 */
export function saveLocalLedgers(ledgers: LedgerMeta[], isGuest: boolean = false): void {
  const storage = isGuest ? sessionStorage : localStorage;
  storage.setItem(LEDGER_LIST_KEY, JSON.stringify(ledgers));
}

/**
 * Clear guest data
 */
export function clearGuestData(): void {
  sessionStorage.removeItem(LEDGER_LIST_KEY);
  sessionStorage.removeItem(GUEST_LEDGER_KEY);
}

/**
 * Check if in guest mode
 */
export function isGuestMode(): boolean {
  return sessionStorage.getItem(LEDGER_LIST_KEY) !== null &&
         localStorage.getItem(LEDGER_LIST_KEY) === null;
}

/**
 * Merge local and cloud ledger lists
 */
export function mergeLedgerLists(
  local: LedgerMeta[],
  cloud: CloudLedger[]
): LedgerSyncResult {
  const cloudMap = new Map(cloud.map(l => [l.id, l]));
  const localMap = new Map(local.map(l => [l.id, l]));

  const merged: LedgerMeta[] = [];
  const toUpload: LedgerMeta[] = [];
  const toDownload: string[] = [];

  // Process cloud ledgers
  for (const cloudLedger of cloud) {
    const localLedger = localMap.get(cloudLedger.id);

    if (!localLedger) {
      // Cloud has it, local doesn't - download
      toDownload.push(cloudLedger.id);
      merged.push(cloudToMeta(cloudLedger));
    } else {
      // Both have it - compare versions
      const cloudVersion = cloudLedger.version || 0;
      const localVersion = localLedger.version || 0;

      if (cloudVersion >= localVersion) {
        merged.push(cloudToMeta(cloudLedger));
      } else {
        merged.push(localLedger);
        toUpload.push(localLedger);
      }
    }
  }

  // Process local-only ledgers
  for (const localLedger of local) {
    if (!cloudMap.has(localLedger.id)) {
      // Local has it, cloud doesn't - upload
      toUpload.push(localLedger);
      merged.push(localLedger);
    }
  }

  return { merged, toUpload, toDownload };
}

/**
 * Convert CloudLedger to LedgerMeta
 */
function cloudToMeta(cloud: CloudLedger): LedgerMeta {
  return {
    id: cloud.id,
    name: cloud.name,
    lastAccess: cloud.updatedAt?.toMillis?.() || Date.now(),
    ownerId: cloud.ownerId,
    isCloudSynced: true,
    status: cloud.status || 'active',
    version: cloud.version || 0,
    lastSyncedAt: cloud.updatedAt?.toMillis?.(),
  };
}
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add services/LedgerSyncService.ts
git commit -m "feat: add LedgerSyncService for ledger list synchronization"
```

---

### Task 3.2: 修改 App.tsx 登录后同步账本列表

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/App.tsx`

**Step 1: 导入 LedgerSyncService**

```typescript
import {
  getLocalLedgers,
  saveLocalLedgers,
  mergeLedgerLists,
  clearGuestData,
  isGuestMode,
  LedgerMeta
} from './services/LedgerSyncService';
```

**Step 2: 添加登录后同步逻辑**

在 `useEffect` 中监听用户登录状态，登录后同步账本列表：

```typescript
// Sync ledger list on login
useEffect(() => {
  if (!user || !isCloudEnabled) return;

  const syncLedgerList = async () => {
    try {
      const { subscribeToUserLedgers } = await import('./services/firestoreService');

      // Subscribe to user's ledgers from cloud
      const unsubscribe = subscribeToUserLedgers(user.uid, async (cloudLedgers) => {
        const localLedgers = getLocalLedgers();
        const result = mergeLedgerLists(localLedgers, cloudLedgers);

        // Save merged list
        saveLocalLedgers(result.merged);
        setLedgers(result.merged);

        // Upload local-only ledgers to cloud
        for (const ledger of result.toUpload) {
          // Upload logic here
          console.log('Uploading local ledger to cloud:', ledger.id);
        }

        // Download cloud-only ledgers
        for (const ledgerId of result.toDownload) {
          console.log('Downloading cloud ledger:', ledgerId);
        }
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Failed to sync ledger list:', error);
    }
  };

  syncLedgerList();
}, [user, isCloudEnabled]);
```

**Step 3: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 4: Commit**

```bash
git add App.tsx
git commit -m "feat: sync ledger list on login with merge logic"
```

---

## Phase 4: 登录提示模态框

### Task 4.1: 创建 LoginPromptModal 组件

**Files:**
- Create: `/mnt/d/Projects/travel-finance-helper/components/LoginPromptModal.tsx`

**Step 1: 创建 LoginPromptModal 组件**

```typescript
import React from 'react';
import { LogIn, UserPlus, Eye } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface LoginPromptModalProps {
  isOpen: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
  isOpen,
  onLogin,
  onRegister,
  onGuest,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 text-center bg-gradient-to-r from-sky-50 to-blue-50">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {t('welcomeTitle', '欢迎使用旅行分账助手')}
          </h2>
          <p className="text-gray-500 mt-2">
            {t('loginPromptSubtitle', '登录后可多设备同步、与好友协作分账')}
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 flex flex-col gap-3">
          <button
            onClick={onLogin}
            className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-sky-600 hover:to-blue-700 transition-all"
          >
            <LogIn size={20} />
            {t('login', '登录')}
          </button>

          <button
            onClick={onRegister}
            className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
          >
            <UserPlus size={20} />
            {t('register', '注册新账号')}
          </button>

          <button
            onClick={onGuest}
            className="w-full py-3 px-4 text-gray-500 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
          >
            <Eye size={20} />
            {t('guestMode', '游客模式体验')}
          </button>
        </div>

        {/* Warning */}
        <div className="px-6 pb-6">
          <p className="text-xs text-center text-orange-500 bg-orange-50 rounded-lg p-3">
            {t('guestModeWarning', '游客模式数据仅保存在当前浏览器，关闭后将丢失')}
          </p>
        </div>
      </div>
    </div>
  );
};
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add components/LoginPromptModal.tsx
git commit -m "feat: add LoginPromptModal component for initial login prompt"
```

---

### Task 4.2: 集成 LoginPromptModal 到 App.tsx

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/App.tsx`

**Step 1: 添加状态**

```typescript
const [showLoginPrompt, setShowLoginPrompt] = useState(false);
```

**Step 2: 添加 useEffect 检测是否需要显示登录提示**

```typescript
// Show login prompt on first visit
useEffect(() => {
  const hasVisitedBefore = localStorage.getItem('has_visited_before');
  if (!hasVisitedBefore && !user) {
    setShowLoginPrompt(true);
    localStorage.setItem('has_visited_before', 'true');
  }
}, [user]);
```

**Step 3: 添加处理函数**

```typescript
const handleGuestMode = () => {
  setShowLoginPrompt(false);
  // Guest mode - use sessionStorage
  console.log('Entering guest mode');
};

const handleLoginFromPrompt = () => {
  setShowLoginPrompt(false);
  // Trigger login modal
  setShowAuthModal(true);
};

const handleRegisterFromPrompt = () => {
  setShowLoginPrompt(false);
  // Trigger register modal
  setShowAuthModal(true);
};
```

**Step 4: 渲染 LoginPromptModal**

在 JSX 中添加：

```tsx
<LoginPromptModal
  isOpen={showLoginPrompt && !user}
  onLogin={handleLoginFromPrompt}
  onRegister={handleRegisterFromPrompt}
  onGuest={handleGuestMode}
/>
```

**Step 5: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: integrate LoginPromptModal into app entry flow"
```

---

## Phase 5: 账本创建向导

### Task 5.1: 重构 WelcomeWizard 为 LedgerCreationWizard

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/components/WelcomeWizard.tsx`

**Step 1: 重命名为 LedgerCreationWizard 并增强功能**

现有 `WelcomeWizard` 已经是4步向导，需要：
1. 导出为 `LedgerCreationWizard` 别名
2. 添加 `forceOpen` prop 以支持手动触发
3. 确保步骤完整：基本信息 → 货币设置 → 家庭成员 → 完成

在文件末尾添加：

```typescript
// Alias for use as creation wizard
export const LedgerCreationWizard: React.FC<WelcomeWizardProps & { forceOpen?: boolean }> = (props) => {
  return <WelcomeWizard {...props} />;
};
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add components/WelcomeWizard.tsx
git commit -m "feat: add LedgerCreationWizard alias to WelcomeWizard"
```

---

### Task 5.2: 集成向导到账本创建流程

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/App.tsx`

**Step 1: 添加状态**

```typescript
const [showCreationWizard, setShowCreationWizard] = useState(false);
```

**Step 2: 修改 handleCreateNewLedger**

找到 `handleCreateNewLedger` 函数，修改为打开向导：

```typescript
const handleCreateNewLedger = () => {
  setShowCreationWizard(true);
};
```

**Step 3: 添加向导完成处理**

```typescript
const handleWizardComplete = async (data: {
  ledgerName: string;
  destination: string;
  originCountry: string;
  baseCurrency: string;
  families: Family[];
}) => {
  const id = `ledger_${Date.now()}`;

  // Create new ledger with wizard data
  const newState: AppState = {
    ledgerName: data.ledgerName,
    expenses: [],
    exchangeRate: await fetchExchangeRate(data.baseCurrency, getCurrencyForDestination(data.destination)),
    families: data.families,
    currencyCode: getCurrencyForDestination(data.destination),
    destination: data.destination,
    baseCurrency: data.baseCurrency,
    originCountry: data.originCountry,
    lastUpdated: Date.now(),
  };

  // Save and sync
  saveLedger(id, newState);
  setLedgers(prev => [...prev, {
    id,
    name: data.ledgerName,
    lastAccess: Date.now(),
    ownerId: user?.uid,
    isCloudSynced: isCloudEnabled,
    status: 'active',
  }]);

  setActiveId(id);
  setState(newState);
  setShowCreationWizard(false);

  // Sync to cloud if enabled
  if (isCloudEnabled && user) {
    syncNow(id, newState);
  }
};

// Helper function to get currency for destination
const getCurrencyForDestination = (destination: string): string => {
  const country = COUNTRIES.find(c => c.name === destination || c.nameEn === destination);
  return country?.currency || 'USD';
};
```

**Step 4: 渲染 LedgerCreationWizard**

```tsx
<WelcomeWizard
  isOpen={showCreationWizard || (ledgers.length === 0 && !showLoginPrompt)}
  onComplete={handleWizardComplete}
/>
```

**Step 5: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 6: Commit**

```bash
git add App.tsx
git commit -m "feat: integrate LedgerCreationWizard into ledger creation flow"
```

---

## Phase 6: 翻译更新

### Task 6.1: 添加新文案翻译

**Files:**
- Modify: `/mnt/d/Projects/travel-finance-helper/i18n/translations.ts`

**Step 1: 添加翻译键**

```typescript
export const translations = {
  zh: {
    // ... existing translations
    welcomeTitle: '欢迎使用旅行分账助手',
    loginPromptSubtitle: '登录后可多设备同步、与好友协作分账',
    login: '登录',
    register: '注册新账号',
    guestMode: '游客模式体验',
    guestModeWarning: '游客模式数据仅保存在当前浏览器，关闭后将丢失',
    syncStatusSyncing: '同步中...',
    syncStatusSynced: '已同步',
    syncStatusOffline: '离线模式',
    syncStatusError: '同步失败',
    viewerCannotEdit: '作为查看者，您无法修改账本设置',
  },
  en: {
    // ... existing translations
    welcomeTitle: 'Welcome to Travel Finance Helper',
    loginPromptSubtitle: 'Login to sync across devices and collaborate with friends',
    login: 'Login',
    register: 'Register New Account',
    guestMode: 'Try Guest Mode',
    guestModeWarning: 'Guest mode data is saved only in this browser and will be lost when closed',
    syncStatusSyncing: 'Syncing...',
    syncStatusSynced: 'Synced',
    syncStatusOffline: 'Offline',
    syncStatusError: 'Sync Failed',
    viewerCannotEdit: 'As a viewer, you cannot modify ledger settings',
  },
};
```

**Step 2: 验证 TypeScript 编译**

Run: `npx tsc --noEmit`
Expected: 无错误

**Step 3: Commit**

```bash
git add i18n/translations.ts
git commit -m "feat: add translations for new sync and login features"
```

---

## Phase 7: 最终测试与构建

### Task 7.1: 完整构建测试

**Step 1: 运行完整构建**

Run: `npm run build`
Expected: 构建成功，无错误

**Step 2: 运行开发服务器测试**

Run: `npm run dev`
Expected: 开发服务器启动成功

---

## 执行摘要

| Phase | 任务数 | 主要改动 |
|-------|--------|----------|
| Phase 1 | 3 | 数据模型更新 |
| Phase 2 | 3 | SyncService 核心模块 |
| Phase 3 | 2 | 账本列表同步 |
| Phase 4 | 2 | 登录提示模态框 |
| Phase 5 | 2 | 账本创建向导 |
| Phase 6 | 1 | 翻译更新 |
| Phase 7 | 1 | 最终测试与构建 |

**总任务数**: 14
**预计新增代码量**: ~800 行
**预计修改代码量**: ~400 行