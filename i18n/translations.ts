export type Language = 'en' | 'zh';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  zh: '中文',
};

export const BASE_CURRENCIES = [
  { code: 'CNY', name: '人民币', nameEn: 'Chinese Yuan', language: 'zh' as Language },
  { code: 'USD', name: '美元', nameEn: 'US Dollar', language: 'en' as Language },
  { code: 'EUR', name: '欧元', nameEn: 'Euro', language: 'en' as Language },
  { code: 'GBP', name: '英镑', nameEn: 'British Pound', language: 'en' as Language },
  { code: 'JPY', name: '日元', nameEn: 'Japanese Yen', language: 'en' as Language },
  { code: 'KRW', name: '韩元', nameEn: 'Korean Won', language: 'en' as Language },
  { code: 'HKD', name: '港币', nameEn: 'Hong Kong Dollar', language: 'en' as Language },
  { code: 'TWD', name: '新台币', nameEn: 'Taiwan Dollar', language: 'en' as Language },
  { code: 'SGD', name: '新加坡元', nameEn: 'Singapore Dollar', language: 'en' as Language },
  { code: 'AUD', name: '澳元', nameEn: 'Australian Dollar', language: 'en' as Language },
  { code: 'CAD', name: '加元', nameEn: 'Canadian Dollar', language: 'en' as Language },
  { code: 'NZD', name: '新西兰元', nameEn: 'New Zealand Dollar', language: 'en' as Language },
  { code: 'INR', name: '印度卢比', nameEn: 'Indian Rupee', language: 'en' as Language },
  { code: 'THB', name: '泰铢', nameEn: 'Thai Baht', language: 'en' as Language },
  { code: 'MYR', name: '马来西亚林吉特', nameEn: 'Malaysian Ringgit', language: 'en' as Language },
  { code: 'VND', name: '越南盾', nameEn: 'Vietnamese Dong', language: 'en' as Language },
  { code: 'PHP', name: '菲律宾比索', nameEn: 'Philippine Peso', language: 'en' as Language },
  { code: 'IDR', name: '印尼盾', nameEn: 'Indonesian Rupiah', language: 'en' as Language },
  { code: 'RUB', name: '俄罗斯卢布', nameEn: 'Russian Ruble', language: 'en' as Language },
  { code: 'BRL', name: '巴西雷亚尔', nameEn: 'Brazilian Real', language: 'en' as Language },
  { code: 'CHF', name: '瑞士法郎', nameEn: 'Swiss Franc', language: 'en' as Language },
  { code: 'SEK', name: '瑞典克朗', nameEn: 'Swedish Krona', language: 'en' as Language },
  { code: 'NOK', name: '挪威克朗', nameEn: 'Norwegian Krone', language: 'en' as Language },
  { code: 'DKK', name: '丹麦克朗', nameEn: 'Danish Krone', language: 'en' as Language },
  { code: 'PLN', name: '波兰兹罗提', nameEn: 'Polish Zloty', language: 'en' as Language },
  { code: 'TRY', name: '土耳其里拉', nameEn: 'Turkish Lira', language: 'en' as Language },
  { code: 'ZAR', name: '南非兰特', nameEn: 'South African Rand', language: 'en' as Language },
  { code: 'AED', name: '阿联酋迪拉姆', nameEn: 'UAE Dirham', language: 'en' as Language },
  { code: 'SAR', name: '沙特里亚尔', nameEn: 'Saudi Riyal', language: 'en' as Language },
  { code: 'ILS', name: '以色列新谢克尔', nameEn: 'Israeli Shekel', language: 'en' as Language },
];

export const getLanguageByCurrency = (currency: string): Language => {
  const found = BASE_CURRENCIES.find(c => c.code === currency);
  return found?.language || 'en';
};

export const translations = {
  en: {
    // App title
    appTitle: 'Travel Expense Splitter',
    appSubtitle: 'Split travel expenses with friends and family',

    // Header
    currentRate: 'Exchange Rate',
    totalExpense: 'Total Expense',
    updateRate: 'Update Rate',
    settings: 'Settings',

    // Tabs
    summaryTab: 'Overview & Settlement',
    expensesTab: 'Expense List',

    // Ledger
    newLedger: 'New Ledger',
    createLedger: 'Create New Ledger',
    ledgerName: 'Ledger Name',
    ledgerNamePlaceholder: 'e.g., Bali Trip',

    // Settings Modal
    settingsTitle: 'Ledger Settings',
    settingsSubtitle: 'Configure your travel expense parameters',
    baseCurrency: 'Base Currency',
    baseCurrencyHint: 'Settlement will be calculated in this currency',
    originCountry: 'Where are you from?',
    originCountryHint: 'Determines settlement currency and display language',
    destination: 'Travel Destination',
    families: 'Participating Groups (2-5)',
    addGroup: 'Add Group',
    groupName: 'Group Name',
    people: 'People',
    settlementHint: 'Expenses will be split proportionally by group size',
    cancel: 'Cancel',
    saveSettings: 'Save Settings',

    // Expense Form
    addExpense: 'Add Expense',
    addExpenseSubtitle: 'Record every expense on your journey',
    expenseDate: 'Expense Date',
    expenseDescription: 'Description',
    expenseDescriptionPlaceholder: 'e.g., Dinner, Tickets...',
    amount: 'Amount',
    amountPlaceholder: 'Enter amount',
    category: 'Category',
    payer: 'Who Paid',
    saveExpense: 'Save Expense',

    // Categories
    accommodation: 'Accommodation',
    transport: 'Transport',
    food: 'Food',
    entertainment: 'Entertainment',
    shopping: 'Shopping',
    other: 'Other',

    // Summary
    totalSpent: 'Total Spent',
    paid: 'Paid',
    shouldPay: 'Should Pay',
    receive: 'Receive',
    owe: 'Owe',
    settlementPlan: 'Settlement Plan',
    settlementCalcHint: 'Auto-calculated based on group size ratio',
    allSettled: 'All Settled!',
    allSettledHint: 'All groups have paid their fair share',
    categoryStats: 'Expense by Category',

    // Expense List
    noExpenses: 'No expenses yet',
    noExpensesHint: 'Tap the button below to add your first expense',
    deleteConfirm: 'Delete this expense?',

    // Export
    backupData: 'Backup',
    restoreData: 'Restore',
    exportMarkdown: 'Export Markdown',
    exportPDF: 'Export PDF Report',
    exportTitle: 'Complete Report',
    exportTime: 'Export Time',

    // Language
    language: 'Language',

    // Misc
    from: 'from',
    to: 'to',
    pays: 'pays',
    approximately: '≈',
    persons: 'persons',
    family: 'Family',
    group: 'Group',

    // Destination countries
    countries: {
      argentina: 'Argentina',
      uae: 'UAE',
      egypt: 'Egypt',
      australia: 'Australia',
      brazil: 'Brazil',
      russia: 'Russia',
      philippines: 'Philippines',
      korea: 'South Korea',
      canada: 'Canada',
      cambodia: 'Cambodia',
      laos: 'Laos',
      maldives: 'Maldives',
      malaysia: 'Malaysia',
      usa: 'USA',
      myanmar: 'Myanmar',
      mexico: 'Mexico',
      southAfrica: 'South Africa',
      nepal: 'Nepal',
      europe: 'Europe',
      japan: 'Japan',
      switzerland: 'Switzerland',
      sriLanka: 'Sri Lanka',
      thailand: 'Thailand',
      turkey: 'Turkey',
      singapore: 'Singapore',
      newZealand: 'New Zealand',
      india: 'India',
      indonesia: 'Indonesia',
      uk: 'United Kingdom',
      vietnam: 'Vietnam',
      macau: 'Macau',
      hongKong: 'Hong Kong',
    },

    // Messages
    rateUpdateConfirm: 'Latest rate: 1 {{base}} = {{rate}} {{target}}\nUpdate current ledger rate?',
    rateFetchFailed: 'Failed to fetch rate. Please check your network.',
    importSuccess: 'Import successful!',
    invalidFormat: 'Invalid file format',
    parseFailed: 'Failed to parse file',
  },

  zh: {
    // App title
    appTitle: '旅行分账助手',
    appSubtitle: '轻松分摊旅行费用',

    // Header
    currentRate: '当前汇率',
    totalExpense: '总支出',
    updateRate: '更新汇率',
    settings: '设置',

    // Tabs
    summaryTab: '概览 & 结算',
    expensesTab: '账单明细',

    // Ledger
    newLedger: '新建账本',
    createLedger: '新建账本',
    ledgerName: '账本名称',
    ledgerNamePlaceholder: '例如：巴厘岛旅行账本',

    // Settings Modal
    settingsTitle: '账本设置',
    settingsSubtitle: '配置您的旅行分账参数',
    baseCurrency: '结算货币',
    baseCurrencyHint: '最终结算将以此货币计算',
    originCountry: '我们来自哪里',
    originCountryHint: '决定结算货币和界面语言',
    destination: '旅行目的地',
    families: '参与家庭 (2-5个)',
    addGroup: '添加家庭',
    groupName: '家庭名称',
    people: '人数',
    settlementHint: '结算时将按照家庭人数比例自动分摊费用',
    cancel: '取消',
    saveSettings: '保存设置',

    // Expense Form
    addExpense: '新增账单',
    addExpenseSubtitle: '记录旅途中的每一笔消费',
    expenseDate: '消费日期',
    expenseDescription: '消费描述',
    expenseDescriptionPlaceholder: '例如：海鲜大餐、景点门票...',
    amount: '金额',
    amountPlaceholder: '输入金额',
    category: '类别',
    payer: '谁付的钱',
    saveExpense: '确认保存',

    // Categories
    accommodation: '住宿',
    transport: '交通',
    food: '餐饮',
    entertainment: '娱乐',
    shopping: '购物',
    other: '其他',

    // Summary
    totalSpent: '总支出',
    paid: '已付',
    shouldPay: '应付份额',
    receive: '应收',
    owe: '应付',
    settlementPlan: '最终结算方案',
    settlementCalcHint: '按家庭人数比例分摊，差额自动计算',
    allSettled: '账目已平，无需转账',
    allSettledHint: '各家庭支出比例均衡',
    categoryStats: '消费类别统计',

    // Expense List
    noExpenses: '暂无账单记录',
    noExpensesHint: '点击右下角按钮添加第一笔消费',
    deleteConfirm: '确定删除这条账单吗？',

    // Export
    backupData: '备份数据',
    restoreData: '恢复数据',
    exportMarkdown: '导出 Markdown',
    exportPDF: '导出完整 PDF 报告',
    exportTitle: '完整报告',
    exportTime: '导出时间',

    // Language
    language: '语言',

    // Misc
    from: '从',
    to: '到',
    pays: '付给',
    approximately: '≈',
    persons: '人',
    family: '家庭',
    group: '组',

    // Destination countries
    countries: {
      argentina: '阿根廷',
      uae: '阿联酋',
      egypt: '埃及',
      australia: '澳大利亚',
      brazil: '巴西',
      russia: '俄罗斯',
      philippines: '菲律宾',
      korea: '韩国',
      canada: '加拿大',
      cambodia: '柬埔寨',
      laos: '老挝',
      maldives: '马尔代夫',
      malaysia: '马来西亚',
      usa: '美国',
      myanmar: '缅甸',
      mexico: '墨西哥',
      southAfrica: '南非',
      nepal: '尼泊尔',
      europe: '欧洲',
      japan: '日本',
      switzerland: '瑞士',
      sriLanka: '斯里兰卡',
      thailand: '泰国',
      turkey: '土耳其',
      singapore: '新加坡',
      newZealand: '新西兰',
      india: '印度',
      indonesia: '印度尼西亚',
      uk: '英国',
      vietnam: '越南',
      macau: '中国澳门',
      hongKong: '中国香港',
    },

    // Messages
    rateUpdateConfirm: '获取到最新汇率: 1 {{base}} = {{rate}} {{target}}\n是否更新当前账本汇率？',
    rateFetchFailed: '汇率获取失败，请检查网络连接。',
    importSuccess: '导入成功！',
    invalidFormat: '文件格式不正确',
    parseFailed: '文件解析失败',
  },
};

export type TranslationKey = keyof typeof translations.en;