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
