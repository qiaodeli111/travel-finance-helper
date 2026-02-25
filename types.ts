export interface Family {
  id: string;
  name: string;
  count: number;
}

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
  amount: number; // Generic amount in target currency
  category: Category;
  payerId: string; // Family ID
}

export interface AppState {
  ledgerName: string;
  expenses: Expense[];
  exchangeRate: number; // 1 CNY = X Target Currency
  families: Family[];
  currencyCode: string; // e.g. 'IDR'
  destination: string; // e.g. 'Indonesia'
  lastUpdated: number;
}

export const COUNTRIES = [
  { name: '印度尼西亚', currency: 'IDR', label: '印尼盾' },
  { name: '泰国', currency: 'THB', label: '泰铢' },
  { name: '日本', currency: 'JPY', label: '日元' },
  { name: '美国', currency: 'USD', label: '美元' },
  { name: '欧洲', currency: 'EUR', label: '欧元' },
  { name: '英国', currency: 'GBP', label: '英镑' },
  { name: '韩国', currency: 'KRW', label: '韩元' },
  { name: '马来西亚', currency: 'MYR', label: '林吉特' },
  { name: '新加坡', currency: 'SGD', label: '新加坡元' },
  { name: '越南', currency: 'VND', label: '越南盾' },
  { name: '澳大利亚', currency: 'AUD', label: '澳元' },
  { name: '中国香港', currency: 'HKD', label: '港币' },
  { name: '中国澳门', currency: 'MOP', label: '澳门元' },
];
