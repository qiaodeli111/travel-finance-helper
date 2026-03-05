import { Family, Category } from './index';

// For use without direct Firebase import
export type Timestamp = {
  seconds: number;
  nanoseconds: number;
  toDate: () => Date;
};

// User profile stored in Firestore
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  phoneNumber: string | null;
  isAnonymous: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

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

// Ledger member document
export interface LedgerMember {
  id: string;
  ledgerId: string;
  userId: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  joinedAt: Timestamp;
  displayName: string;
}

// Invitation document
export interface Invitation {
  id: string;
  ledgerId: string;
  ledgerName: string;
  inviterId: string;
  inviterName: string;
  inviteCode: string;
  expiresAt: Timestamp | null;
  usedAt: Timestamp | null;
  createdAt: Timestamp;
}

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

// Collection paths
export const COLLECTIONS = {
  USERS: 'users',
  LEDGERS: 'ledgers',
  MEMBERS: 'members',
  INVITATIONS: 'invitations',
  EXPENSES: 'expenses',
} as const;