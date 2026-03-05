export interface Family {
  id: string;
  name: string;
  count: number;
}

export enum Category {
  ACCOMMODATION = 'Accommodation',
  TRANSPORT = 'Transport',
  FOOD = 'Food',
  ENTERTAINMENT = 'Entertainment',
  SHOPPING = 'Shopping',
  OTHER = 'Other',
}

// Legacy Chinese categories for migration
export const CATEGORY_MIGRATION: Record<string, Category> = {
  '住宿': Category.ACCOMMODATION,
  '交通': Category.TRANSPORT,
  '餐饮': Category.FOOD,
  '娱乐': Category.ENTERTAINMENT,
  '购物': Category.SHOPPING,
  '其他': Category.OTHER,
};

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

export interface AppState {
  ledgerName: string;
  expenses: Expense[];
  exchangeRate: number; // 1 Base Currency = X Target Currency
  families: Family[];
  currencyCode: string; // e.g. 'IDR' - destination currency
  destination: string; // e.g. 'Indonesia'
  baseCurrency: string; // e.g. 'CNY' - settlement currency
  originCountry: string; // e.g. '中国' - where the users are from
  lastUpdated: number;
}

export const COUNTRIES = [
  { name: '阿根廷', nameEn: 'Argentina', currency: 'ARS', label: '阿根廷比索', labelEn: 'Argentine Peso' },
  { name: '阿联酋', nameEn: 'UAE', currency: 'AED', label: '迪拉姆', labelEn: 'Dirham' },
  { name: '埃及', nameEn: 'Egypt', currency: 'EGP', label: '埃及镑', labelEn: 'Egyptian Pound' },
  { name: '澳大利亚', nameEn: 'Australia', currency: 'AUD', label: '澳元', labelEn: 'Australian Dollar' },
  { name: '巴西', nameEn: 'Brazil', currency: 'BRL', label: '雷亚尔', labelEn: 'Real' },
  { name: '俄罗斯', nameEn: 'Russia', currency: 'RUB', label: '卢布', labelEn: 'Ruble' },
  { name: '菲律宾', nameEn: 'Philippines', currency: 'PHP', label: '菲律宾比索', labelEn: 'Philippine Peso' },
  { name: '韩国', nameEn: 'South Korea', currency: 'KRW', label: '韩元', labelEn: 'Korean Won' },
  { name: '加拿大', nameEn: 'Canada', currency: 'CAD', label: '加元', labelEn: 'Canadian Dollar' },
  { name: '柬埔寨', nameEn: 'Cambodia', currency: 'KHR', label: '瑞尔', labelEn: 'Riel' },
  { name: '老挝', nameEn: 'Laos', currency: 'LAK', label: '基普', labelEn: 'Kip' },
  { name: '马尔代夫', nameEn: 'Maldives', currency: 'MVR', label: '拉菲亚', labelEn: 'Rufiyaa' },
  { name: '马来西亚', nameEn: 'Malaysia', currency: 'MYR', label: '林吉特', labelEn: 'Ringgit' },
  { name: '美国', nameEn: 'USA', currency: 'USD', label: '美元', labelEn: 'US Dollar' },
  { name: '缅甸', nameEn: 'Myanmar', currency: 'MMK', label: '缅元', labelEn: 'Kyat' },
  { name: '墨西哥', nameEn: 'Mexico', currency: 'MXN', label: '墨西哥比索', labelEn: 'Mexican Peso' },
  { name: '南非', nameEn: 'South Africa', currency: 'ZAR', label: '兰特', labelEn: 'Rand' },
  { name: '尼泊尔', nameEn: 'Nepal', currency: 'NPR', label: '尼泊尔卢比', labelEn: 'Nepalese Rupee' },
  { name: '欧洲', nameEn: 'Europe', currency: 'EUR', label: '欧元', labelEn: 'Euro' },
  { name: '日本', nameEn: 'Japan', currency: 'JPY', label: '日元', labelEn: 'Japanese Yen' },
  { name: '瑞士', nameEn: 'Switzerland', currency: 'CHF', label: '瑞士法郎', labelEn: 'Swiss Franc' },
  { name: '斯里兰卡', nameEn: 'Sri Lanka', currency: 'LKR', label: '斯里兰卡卢比', labelEn: 'Sri Lankan Rupee' },
  { name: '泰国', nameEn: 'Thailand', currency: 'THB', label: '泰铢', labelEn: 'Thai Baht' },
  { name: '土耳其', nameEn: 'Turkey', currency: 'TRY', label: '里拉', labelEn: 'Lira' },
  { name: '新加坡', nameEn: 'Singapore', currency: 'SGD', label: '新加坡元', labelEn: 'Singapore Dollar' },
  { name: '新西兰', nameEn: 'New Zealand', currency: 'NZD', label: '新西兰元', labelEn: 'New Zealand Dollar' },
  { name: '印度', nameEn: 'India', currency: 'INR', label: '卢比', labelEn: 'Indian Rupee' },
  { name: '印度尼西亚', nameEn: 'Indonesia', currency: 'IDR', label: '印尼盾', labelEn: 'Indonesian Rupiah' },
  { name: '英国', nameEn: 'United Kingdom', currency: 'GBP', label: '英镑', labelEn: 'British Pound' },
  { name: '越南', nameEn: 'Vietnam', currency: 'VND', label: '越南盾', labelEn: 'Vietnamese Dong' },
  { name: '中国澳门', nameEn: 'Macau', currency: 'MOP', label: '澳门元', labelEn: 'Macanese Pataca' },
  { name: '中国台湾', nameEn: 'Taiwan', currency: 'TWD', label: '新台币', labelEn: 'New Taiwan Dollar' },
  { name: '中国香港', nameEn: 'Hong Kong', currency: 'HKD', label: '港币', labelEn: 'Hong Kong Dollar' },
];

// Origin countries - where users are from (determines settlement currency and UI language)
export const ORIGIN_COUNTRIES = [
  { name: '中国', nameEn: 'China', currency: 'CNY', language: 'zh' as const, label: '人民币', labelEn: 'Chinese Yuan' },
  { name: '美国', nameEn: 'USA', currency: 'USD', language: 'en' as const, label: '美元', labelEn: 'US Dollar' },
  { name: '英国', nameEn: 'UK', currency: 'GBP', language: 'en' as const, label: '英镑', labelEn: 'British Pound' },
  { name: '日本', nameEn: 'Japan', currency: 'JPY', language: 'en' as const, label: '日元', labelEn: 'Japanese Yen' },
  { name: '韩国', nameEn: 'South Korea', currency: 'KRW', language: 'en' as const, label: '韩元', labelEn: 'Korean Won' },
  { name: '新加坡', nameEn: 'Singapore', currency: 'SGD', language: 'en' as const, label: '新加坡元', labelEn: 'Singapore Dollar' },
  { name: '澳大利亚', nameEn: 'Australia', currency: 'AUD', language: 'en' as const, label: '澳元', labelEn: 'Australian Dollar' },
  { name: '加拿大', nameEn: 'Canada', currency: 'CAD', language: 'en' as const, label: '加元', labelEn: 'Canadian Dollar' },
  { name: '新西兰', nameEn: 'New Zealand', currency: 'NZD', language: 'en' as const, label: '新西兰元', labelEn: 'New Zealand Dollar' },
  { name: '德国', nameEn: 'Germany', currency: 'EUR', language: 'en' as const, label: '欧元', labelEn: 'Euro' },
  { name: '法国', nameEn: 'France', currency: 'EUR', language: 'en' as const, label: '欧元', labelEn: 'Euro' },
  { name: '意大利', nameEn: 'Italy', currency: 'EUR', language: 'en' as const, label: '欧元', labelEn: 'Euro' },
  { name: '西班牙', nameEn: 'Spain', currency: 'EUR', language: 'en' as const, label: '欧元', labelEn: 'Euro' },
  { name: '荷兰', nameEn: 'Netherlands', currency: 'EUR', language: 'en' as const, label: '欧元', labelEn: 'Euro' },
  { name: '瑞士', nameEn: 'Switzerland', currency: 'CHF', language: 'en' as const, label: '瑞士法郎', labelEn: 'Swiss Franc' },
  { name: '中国香港', nameEn: 'Hong Kong', currency: 'HKD', language: 'en' as const, label: '港币', labelEn: 'Hong Kong Dollar' },
  { name: '中国台湾', nameEn: 'Taiwan', currency: 'TWD', language: 'en' as const, label: '新台币', labelEn: 'Taiwan Dollar' },
  { name: '马来西亚', nameEn: 'Malaysia', currency: 'MYR', language: 'en' as const, label: '林吉特', labelEn: 'Malaysian Ringgit' },
  { name: '泰国', nameEn: 'Thailand', currency: 'THB', language: 'en' as const, label: '泰铢', labelEn: 'Thai Baht' },
  { name: '印度', nameEn: 'India', currency: 'INR', language: 'en' as const, label: '卢比', labelEn: 'Indian Rupee' },
  { name: '巴西', nameEn: 'Brazil', currency: 'BRL', language: 'en' as const, label: '雷亚尔', labelEn: 'Brazilian Real' },
  { name: '墨西哥', nameEn: 'Mexico', currency: 'MXN', language: 'en' as const, label: '墨西哥比索', labelEn: 'Mexican Peso' },
  { name: '俄罗斯', nameEn: 'Russia', currency: 'RUB', language: 'en' as const, label: '卢布', labelEn: 'Russian Ruble' },
  { name: '阿联酋', nameEn: 'UAE', currency: 'AED', language: 'en' as const, label: '迪拉姆', labelEn: 'UAE Dirham' },
  { name: '沙特阿拉伯', nameEn: 'Saudi Arabia', currency: 'SAR', language: 'en' as const, label: '沙特里亚尔', labelEn: 'Saudi Riyal' },
  { name: '南非', nameEn: 'South Africa', currency: 'ZAR', language: 'en' as const, label: '兰特', labelEn: 'South African Rand' },
  { name: '其他', nameEn: 'Other', currency: 'USD', language: 'en' as const, label: '其他货币', labelEn: 'Other Currency' },
];

export type OriginCountry = typeof ORIGIN_COUNTRIES[number];
