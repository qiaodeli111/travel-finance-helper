import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { Category } from '../types';
import type { AppState, Expense } from '../types';
import {
  computeLedgerSettlement,
  formatPaidByCurrency,
  generateSettlementTransfers,
  normalizeExpense,
} from './settlementService';

const baseState: AppState = {
  ledgerName: 'Trip',
  expenses: [],
  exchangeRate: 2,
  families: [
    { id: 'f1', name: 'A', count: 2 },
    { id: 'f2', name: 'B', count: 1 },
  ],
  currencyCode: 'TRY',
  destination: 'Istanbul',
  baseCurrency: 'CNY',
  originCountry: '中国',
  lastUpdated: 1000,
};

const mkExpense = (patch: Partial<Expense>): Expense => ({
  id: patch.id ?? 'e1',
  date: patch.date ?? 1000,
  description: patch.description ?? 'Dinner',
  amount: patch.amount ?? 200,
  category: patch.category ?? Category.FOOD,
  payerId: patch.payerId ?? 'f1',
  sharedWithFamilyIds: patch.sharedWithFamilyIds,
  travelPlaceName: patch.travelPlaceName,
  paymentCurrency: patch.paymentCurrency,
  settlementCurrency: patch.settlementCurrency,
  fxSnapshot: patch.fxSnapshot,
  amountSettlement: patch.amountSettlement,
  createdAt: patch.createdAt,
  createdBy: patch.createdBy,
  createdByDisplayName: patch.createdByDisplayName,
  version: patch.version,
  deletedAt: patch.deletedAt,
  updatedAt: patch.updatedAt,
});

describe('settlementService', () => {
  it('normalizes legacy expense using ledger defaults and exchangeRate', () => {
    const expense = mkExpense({ amount: 200, createdAt: 5000, sharedWithFamilyIds: ['f2'] });
    const normalized = normalizeExpense(expense, baseState);

    assert.equal(normalized.paymentCurrency, 'TRY');
    assert.equal(normalized.settlementCurrency, 'CNY');
    assert.equal(normalized.travelPlaceName, 'Istanbul');
    assert.equal(normalized.amountPayment, 200);
    assert.equal(normalized.amountSettlement, 100);
    assert.deepEqual(normalized.fxSnapshot, {
      base: 'CNY',
      quote: 'TRY',
      rate: 2,
      capturedAt: 5000,
    });
  });

  it('keeps explicit amountSettlement and explicit fx snapshot', () => {
    const expense = mkExpense({
      paymentCurrency: 'USD',
      settlementCurrency: 'CNY',
      amountSettlement: 77,
      fxSnapshot: {
        base: 'CNY',
        quote: 'USD',
        rate: 7.2,
        capturedAt: 999,
      },
    });

    const normalized = normalizeExpense(expense, baseState);
    assert.equal(normalized.amountSettlement, 77);
    assert.equal(normalized.fxSnapshot.capturedAt, 999);
  });

  it('computes ledger totals per family transfers and category totals', () => {
    const expenses: Expense[] = [
      mkExpense({
        id: 'e1',
        amount: 200,
        payerId: 'f1',
        sharedWithFamilyIds: undefined,
        category: Category.FOOD,
      }),
      mkExpense({
        id: 'e2',
        amount: 60,
        payerId: 'f2',
        sharedWithFamilyIds: ['f1'],
        category: Category.TRANSPORT,
      }),
    ];

    const result = computeLedgerSettlement({
      ...baseState,
      expenses,
    });

    assert.equal(result.settlementCurrency, 'CNY');
    assert.deepEqual(result.totals.totalPaymentByCurrency, { TRY: 260 });
    assert.equal(result.totals.totalSettlement, 130);
    assert.deepEqual(result.categoryTotalsSettlement, {
      [Category.FOOD]: 100,
      [Category.TRANSPORT]: 30,
    });

    const family1 = result.perFamily.find(item => item.familyId === 'f1');
    const family2 = result.perFamily.find(item => item.familyId === 'f2');

    assert.deepEqual(family1, {
      familyId: 'f1',
      paidByCurrency: { TRY: 200 },
      paidSettlement: 100,
      consumedSettlement: 86.67,
      netSettlement: 13.33,
    });
    assert.deepEqual(family2, {
      familyId: 'f2',
      paidByCurrency: { TRY: 60 },
      paidSettlement: 30,
      consumedSettlement: 43.33,
      netSettlement: -13.33,
    });

    assert.deepEqual(result.transfers, [
      {
        fromFamilyId: 'f2',
        toFamilyId: 'f1',
        amountSettlement: 13.33,
      },
    ]);
  });

  it('supports helper transfer generation and paid-by-currency formatting', () => {
    const transfers = generateSettlementTransfers([
      {
        familyId: 'f1',
        paidByCurrency: { CNY: 20 },
        paidSettlement: 20,
        consumedSettlement: 5,
        netSettlement: 15,
      },
      {
        familyId: 'f2',
        paidByCurrency: { TRY: 30 },
        paidSettlement: 30,
        consumedSettlement: 45,
        netSettlement: -15,
      },
    ]);

    assert.deepEqual(transfers, [{ fromFamilyId: 'f2', toFamilyId: 'f1', amountSettlement: 15 }]);
    assert.equal(formatPaidByCurrency({ TRY: 333, CNY: 20 }), 'CNY 20 + TRY 333');
  });
});
