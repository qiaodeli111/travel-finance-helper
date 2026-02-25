export enum Family {
  F1 = 'Family 1',
  F2 = 'Family 2',
}

export const FamilyLabels: Record<Family, string> = {
  [Family.F1]: '家庭 1',
  [Family.F2]: '家庭 2',
};

export enum Category {
  ACCOMMODATION = '住宿',
  TRANSPORT = '交通',
  FOOD = '餐饮',
  ENTERTAINMENT = '娱乐',
  SHOPPING = '购物',
  OTHER = '其他',
}

export interface Expense {
  id: string;
  date: number; // timestamp
  description: string;
  amountIDR: number;
  category: Category;
  payer: Family;
}

export interface AppState {
  ledgerName: string; // Title of the ledger
  expenses: Expense[];
  exchangeRate: number; // 1 CNY = X IDR
  family1Count: number;
  family2Count: number;
  lastUpdated: number; // Timestamp for sync conflict resolution
}