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
  { name: '阿根廷', currency: 'ARS', label: '阿根廷比索' },
  { name: '阿联酋', currency: 'AED', label: '迪拉姆' },
  { name: '埃及', currency: 'EGP', label: '埃及镑' },
  { name: '澳大利亚', currency: 'AUD', label: '澳元' },
  { name: '巴西', currency: 'BRL', label: '雷亚尔' },
  { name: '俄罗斯', currency: 'RUB', label: '卢布' },
  { name: '菲律宾', currency: 'PHP', label: '菲律宾比索' },
  { name: '韩国', currency: 'KRW', label: '韩元' },
  { name: '加拿大', currency: 'CAD', label: '加元' },
  { name: '柬埔寨', currency: 'KHR', label: '瑞尔' },
  { name: '老挝', currency: 'LAK', label: '基普' },
  { name: '马尔代夫', currency: 'MVR', label: '拉菲亚' },
  { name: '马来西亚', currency: 'MYR', label: '林吉特' },
  { name: '美国', currency: 'USD', label: '美元' },
  { name: '缅甸', currency: 'MMK', label: '缅元' },
  { name: '墨西哥', currency: 'MXN', label: '墨西哥比索' },
  { name: '南非', currency: 'ZAR', label: '兰特' },
  { name: '尼泊尔', currency: 'NPR', label: '尼泊尔卢比' },
  { name: '欧洲', currency: 'EUR', label: '欧元' },
  { name: '日本', currency: 'JPY', label: '日元' },
  { name: '瑞士', currency: 'CHF', label: '瑞士法郎' },
  { name: '斯里兰卡', currency: 'LKR', label: '斯里兰卡卢比' },
  { name: '泰国', currency: 'THB', label: '泰铢' },
  { name: '土耳其', currency: 'TRY', label: '里拉' },
  { name: '新加坡', currency: 'SGD', label: '新加坡元' },
  { name: '新西兰', currency: 'NZD', label: '新西兰元' },
  { name: '印度', currency: 'INR', label: '卢比' },
  { name: '印度尼西亚', currency: 'IDR', label: '印尼盾' },
  { name: '英国', currency: 'GBP', label: '英镑' },
  { name: '越南', currency: 'VND', label: '越南盾' },
  { name: '中国澳门', currency: 'MOP', label: '澳门元' },
  { name: '中国台湾', currency: 'TWD', label: '新台币' },
  { name: '中国香港', currency: 'HKD', label: '港币' },
];

// Origin countries - where users are from (determines settlement currency and UI language)
export const ORIGIN_COUNTRIES = [
  { name: '中国', currency: 'CNY', language: 'zh' as const, label: '人民币' },
  { name: '美国', currency: 'USD', language: 'en' as const, label: 'US Dollar' },
  { name: '英国', currency: 'GBP', language: 'en' as const, label: 'British Pound' },
  { name: '日本', currency: 'JPY', language: 'en' as const, label: 'Japanese Yen' },
  { name: '韩国', currency: 'KRW', language: 'en' as const, label: 'Korean Won' },
  { name: '新加坡', currency: 'SGD', language: 'en' as const, label: 'Singapore Dollar' },
  { name: '澳大利亚', currency: 'AUD', language: 'en' as const, label: 'Australian Dollar' },
  { name: '加拿大', currency: 'CAD', language: 'en' as const, label: 'Canadian Dollar' },
  { name: '新西兰', currency: 'NZD', language: 'en' as const, label: 'New Zealand Dollar' },
  { name: '德国', currency: 'EUR', language: 'en' as const, label: 'Euro' },
  { name: '法国', currency: 'EUR', language: 'en' as const, label: 'Euro' },
  { name: '意大利', currency: 'EUR', language: 'en' as const, label: 'Euro' },
  { name: '西班牙', currency: 'EUR', language: 'en' as const, label: 'Euro' },
  { name: '荷兰', currency: 'EUR', language: 'en' as const, label: 'Euro' },
  { name: '瑞士', currency: 'CHF', language: 'en' as const, label: 'Swiss Franc' },
  { name: '中国香港', currency: 'HKD', language: 'en' as const, label: 'Hong Kong Dollar' },
  { name: '中国台湾', currency: 'TWD', language: 'en' as const, label: 'Taiwan Dollar' },
  { name: '马来西亚', currency: 'MYR', language: 'en' as const, label: 'Malaysian Ringgit' },
  { name: '泰国', currency: 'THB', language: 'en' as const, label: 'Thai Baht' },
  { name: '印度', currency: 'INR', language: 'en' as const, label: 'Indian Rupee' },
  { name: '巴西', currency: 'BRL', language: 'en' as const, label: 'Brazilian Real' },
  { name: '墨西哥', currency: 'MXN', language: 'en' as const, label: 'Mexican Peso' },
  { name: '俄罗斯', currency: 'RUB', language: 'en' as const, label: 'Russian Ruble' },
  { name: '阿联酋', currency: 'AED', language: 'en' as const, label: 'UAE Dirham' },
  { name: '沙特阿拉伯', currency: 'SAR', language: 'en' as const, label: 'Saudi Riyal' },
  { name: '南非', currency: 'ZAR', language: 'en' as const, label: 'South African Rand' },
  { name: '其他', currency: 'USD', language: 'en' as const, label: 'US Dollar (default)' },
];

export type OriginCountry = typeof ORIGIN_COUNTRIES[number];
