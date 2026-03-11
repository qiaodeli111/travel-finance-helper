import type { AppState, Expense, Family, FxSnapshot } from '../types';

/**
 * Expense shape after normalization.
 *
 * Guarantees these fields exist for downstream calculations:
 * - paymentCurrency, settlementCurrency
 * - amountPayment, amountSettlement
 * - travelPlaceName
 * - fxSnapshot (may be a derived snapshot)
 */
export interface NormalizedExpense {
  id: string;
  date: number;
  description: string;
  category: Expense['category'];
  payerId: string;
  sharedWithFamilyIds?: string[];
  travelPlaceName: string;
  paymentCurrency: string;
  settlementCurrency: string;
  amountPayment: number;
  amountSettlement: number;
  fxSnapshot: FxSnapshot;
}

export type LedgerFxContext = Pick<AppState, 'currencyCode' | 'baseCurrency' | 'exchangeRate' | 'destination'>;

export interface FamilySettlementStats {
  familyId: string;
  paidByCurrency: Record<string, number>;
  paidSettlement: number;
  consumedSettlement: number;
  netSettlement: number;
}

export interface SettlementTransfer {
  fromFamilyId: string;
  toFamilyId: string;
  amountSettlement: number;
}

export interface LedgerSettlementSummary {
  settlementCurrency: string;
  totals: {
    totalPaymentByCurrency: Record<string, number>;
    totalSettlement: number;
  };
  perFamily: FamilySettlementStats[];
  transfers: SettlementTransfer[];
  categoryTotalsSettlement: Record<string, number>;
}

const round2 = (value: number) => Math.round(value * 100) / 100;

const addToCurrencyMap = (map: Record<string, number>, currency: string, amount: number) => {
  map[currency] = round2((map[currency] ?? 0) + amount);
};

const getDefaultCapturedAt = (expense: Expense) => expense.createdAt ?? expense.date ?? Date.now();

const deriveFxSnapshotFromLedger = (
  ledger: LedgerFxContext,
  paymentCurrency: string,
  settlementCurrency: string,
  capturedAt: number
): FxSnapshot => {
  if (paymentCurrency === settlementCurrency) {
    return {
      base: settlementCurrency,
      quote: paymentCurrency,
      rate: 1,
      capturedAt,
    };
  }

  let base = settlementCurrency;
  let quote = paymentCurrency;
  let rate = 1;

  if (settlementCurrency === ledger.baseCurrency && paymentCurrency === ledger.currencyCode) {
    rate = ledger.exchangeRate;
  } else if (settlementCurrency === ledger.currencyCode && paymentCurrency === ledger.baseCurrency) {
    rate = 1 / ledger.exchangeRate;
  }

  return { base, quote, rate, capturedAt };
};

const convertWithFxSnapshot = (
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  fx: FxSnapshot
): number | undefined => {
  if (fromCurrency === toCurrency) return amount;
  if (fx.rate === 0) return undefined;

  if (fx.base === toCurrency && fx.quote === fromCurrency) {
    return amount / fx.rate;
  }

  if (fx.base === fromCurrency && fx.quote === toCurrency) {
    return amount * fx.rate;
  }

  return undefined;
};

const getSharingFamilies = (
  expense: Pick<NormalizedExpense, 'payerId' | 'sharedWithFamilyIds'>,
  families: Family[],
  familyById: Map<string, Family>
): Family[] => {
  const sharingFamilyIds =
    expense.sharedWithFamilyIds !== undefined
      ? Array.from(new Set([expense.payerId, ...expense.sharedWithFamilyIds]))
      : families.map(family => family.id);

  return sharingFamilyIds
    .map(id => familyById.get(id))
    .filter((family): family is Family => Boolean(family));
};

export const normalizeExpense = (expense: Expense, ledger: LedgerFxContext): NormalizedExpense => {
  const paymentCurrency = expense.paymentCurrency ?? ledger.currencyCode;
  const settlementCurrency = expense.settlementCurrency ?? ledger.baseCurrency;
  const amountPayment = expense.amount;
  const fxSnapshot =
    expense.fxSnapshot ??
    deriveFxSnapshotFromLedger(ledger, paymentCurrency, settlementCurrency, getDefaultCapturedAt(expense));

  const amountSettlement =
    expense.amountSettlement ??
    convertWithFxSnapshot(amountPayment, paymentCurrency, settlementCurrency, fxSnapshot) ??
    amountPayment;

  return {
    id: expense.id,
    date: expense.date,
    description: expense.description,
    category: expense.category,
    payerId: expense.payerId,
    sharedWithFamilyIds: expense.sharedWithFamilyIds,
    travelPlaceName: expense.travelPlaceName ?? ledger.destination,
    paymentCurrency,
    settlementCurrency,
    amountPayment,
    amountSettlement: round2(amountSettlement),
    fxSnapshot,
  };
};

export const calculateFamilySettlementStats = (params: {
  expenses: Expense[];
  families: Family[];
  ledger: LedgerFxContext;
}): FamilySettlementStats[] => {
  const { expenses, families, ledger } = params;
  const familyById = new Map(families.map(family => [family.id, family] as const));
  const statsById = new Map<string, FamilySettlementStats>(
    families.map(family => [
      family.id,
      {
        familyId: family.id,
        paidByCurrency: {},
        paidSettlement: 0,
        consumedSettlement: 0,
        netSettlement: 0,
      },
    ])
  );

  for (const expense of expenses.map(item => normalizeExpense(item, ledger))) {
    const payerStats = statsById.get(expense.payerId);
    if (payerStats) {
      addToCurrencyMap(payerStats.paidByCurrency, expense.paymentCurrency, expense.amountPayment);
      payerStats.paidSettlement += expense.amountSettlement;
    }

    const sharingFamilies = getSharingFamilies(expense, families, familyById);
    const sharingPeople = sharingFamilies.reduce((sum, family) => sum + family.count, 0);
    if (sharingPeople <= 0) continue;

    for (const family of sharingFamilies) {
      const stats = statsById.get(family.id);
      if (!stats) continue;
      stats.consumedSettlement += expense.amountSettlement * (family.count / sharingPeople);
    }
  }

  return families.map(family => {
    const stats = statsById.get(family.id)!;
    return {
      ...stats,
      paidSettlement: round2(stats.paidSettlement),
      consumedSettlement: round2(stats.consumedSettlement),
      netSettlement: round2(stats.paidSettlement - stats.consumedSettlement),
    };
  });
};

export const generateSettlementTransfers = (stats: FamilySettlementStats[], epsilon = 0.01): SettlementTransfer[] => {
  const debtors = stats
    .filter(item => item.netSettlement < -epsilon)
    .map(item => ({ familyId: item.familyId, balance: item.netSettlement }));

  const creditors = stats
    .filter(item => item.netSettlement > epsilon)
    .map(item => ({ familyId: item.familyId, balance: item.netSettlement }));

  const transfers: SettlementTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex]!;
    const creditor = creditors[creditorIndex]!;
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    if (amount > epsilon) {
      transfers.push({
        fromFamilyId: debtor.familyId,
        toFamilyId: creditor.familyId,
        amountSettlement: round2(amount),
      });
    }

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) <= epsilon) debtorIndex += 1;
    if (creditor.balance <= epsilon) creditorIndex += 1;
  }

  return transfers;
};

export const computeLedgerSettlement = (state: AppState): LedgerSettlementSummary => {
  const normalizedExpenses = state.expenses.map(expense => normalizeExpense(expense, state));
  const totalPaymentByCurrency: Record<string, number> = {};
  const categoryTotalsSettlement: Record<string, number> = {};
  let totalSettlement = 0;

  for (const expense of normalizedExpenses) {
    addToCurrencyMap(totalPaymentByCurrency, expense.paymentCurrency, expense.amountPayment);
    categoryTotalsSettlement[expense.category] = round2(
      (categoryTotalsSettlement[expense.category] ?? 0) + expense.amountSettlement
    );
    totalSettlement += expense.amountSettlement;
  }

  const perFamily = calculateFamilySettlementStats({
    expenses: state.expenses,
    families: state.families,
    ledger: state,
  });

  return {
    settlementCurrency: state.baseCurrency,
    totals: {
      totalPaymentByCurrency,
      totalSettlement: round2(totalSettlement),
    },
    perFamily,
    transfers: generateSettlementTransfers(perFamily),
    categoryTotalsSettlement,
  };
};

export const formatPaidByCurrency = (paidByCurrency: Record<string, number>, epsilon = 0.01): string => {
  return Object.entries(paidByCurrency)
    .filter(([, amount]) => Math.abs(amount) > epsilon)
    .map(([currency, amount]) => {
      const rounded = round2(amount);
      const text = String(rounded)
        .replace(/\.0+$/, '')
        .replace(/(\.\d*[1-9])0+$/, '$1');
      return `${currency} ${text}`;
    })
    .join(' + ');
};
