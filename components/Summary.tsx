import React, { useState, useEffect, useRef } from 'react';
import { AppState } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendingUp, Users, Wallet, ArrowRightLeft, Receipt, PiggyBank } from 'lucide-react';
import { useTranslation, getCategoryTranslation } from '../i18n/useTranslation';

interface SummaryProps {
  state: AppState;
}

const CATEGORY_COLORS = ['#0ea5e9', '#f97316', '#84cc16', '#ec4899', '#8b5cf6', '#f59e0b'];
const FAMILY_CARD_GRADIENTS = [
  'from-sky-500 via-blue-500 to-cyan-500',
  'from-orange-400 via-amber-400 to-yellow-400',
  'from-emerald-500 via-green-500 to-lime-500',
  'from-fuchsia-500 via-pink-500 to-rose-500',
  'from-violet-500 via-purple-500 to-indigo-500',
  'from-teal-500 via-cyan-500 to-sky-500',
];

const getFamilyColorClass = (familyId: string) => {
  let hash = 0;
  for (let i = 0; i < familyId.length; i++) {
    hash = familyId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FAMILY_CARD_GRADIENTS[Math.abs(hash) % FAMILY_CARD_GRADIENTS.length];
};

export const Summary: React.FC<SummaryProps> = ({ state }) => {
  const { t, language } = useTranslation();
  const { expenses, families, exchangeRate, currencyCode, baseCurrency } = state;

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [isChartReady, setIsChartReady] = useState(false);

  const totalAmount = expenses.reduce((sum, e) => {
    const amt = e.amount !== undefined ? e.amount : (e as any).amountIDR;
    return sum + amt;
  }, 0);
  const totalBaseCurrency = totalAmount / exchangeRate;

  const familyStats = families.map(f => {
    const paid = expenses
      .filter(e => {
        if (e.payerId) return e.payerId === f.id;
        return (e as any).payer === (f.id === 'f1' ? 'Family 1' : 'Family 2');
      })
      .reduce((sum, e) => sum + (e.amount || (e as any).amountIDR), 0);

    let share = 0;
    expenses.forEach(e => {
      const amt = e.amount || (e as any).amountIDR;

      let sharingFamilyIds: string[];
      if (e.sharedWithFamilyIds !== undefined) {
        sharingFamilyIds = [e.payerId, ...e.sharedWithFamilyIds];
      } else {
        sharingFamilyIds = families.map(fm => fm.id);
      }

      if (sharingFamilyIds.includes(f.id)) {
        const sharingFamilies = families.filter(fm => sharingFamilyIds.includes(fm.id));
        const sharingPeople = sharingFamilies.reduce((sum, fm) => sum + fm.count, 0);

        if (sharingPeople > 0) {
          share += amt * (f.count / sharingPeople);
        }
      }
    });

    const balance = paid - share;

    return { ...f, paid, share, balance };
  });

  interface Settlement {
    from: string;
    to: string;
    amount: number;
  }

  const settlements: Settlement[] = [];
  const workingBalances = familyStats.map(f => ({ ...f }));

  const debtors = workingBalances.filter(b => b.balance < -0.01);
  const creditors = workingBalances.filter(b => b.balance > 0.01);

  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount,
    });

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) < 0.01) dIndex++;
    if (creditor.balance < 0.01) cIndex++;
  }

  const dataByCategory = expenses.reduce((acc, curr) => {
    const amt = curr.amount || (curr as any).amountIDR;
    const found = acc.find(item => item.name === curr.category);
    if (found) {
      found.value += amt;
    } else {
      acc.push({ name: curr.category, value: amt });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  const totalPeople = families.reduce((sum, family) => sum + family.count, 0);
  const leadingPayer = familyStats.reduce<(typeof familyStats)[number] | null>(
    (top, family) => (!top || family.paid > top.paid ? family : top),
    null
  );
  const topReceiver = familyStats.reduce<(typeof familyStats)[number] | null>(
    (top, family) => (!top || family.balance > top.balance ? family : top),
    null
  );

  const categoryBreakdown = dataByCategory
    .map((category, index) => ({
      ...category,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      label: getCategoryTranslation(category.name, language),
      percentage: totalAmount > 0 ? (category.value / totalAmount) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(val);
  const formatBaseCurrency = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: baseCurrency || 'CNY', maximumFractionDigits: 0 }).format(val);

  useEffect(() => {
    if (dataByCategory.length === 0) return;
    const rafId = requestAnimationFrame(() => {
      if (chartContainerRef.current) {
        const { offsetWidth, offsetHeight } = chartContainerRef.current;
        if (offsetWidth > 0 && offsetHeight > 0) {
          setIsChartReady(true);
        }
      }
    });
    return () => cancelAnimationFrame(rafId);
  }, [dataByCategory.length]);

  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-sky-900 to-cyan-700 p-6 text-white shadow-xl shadow-sky-900/10">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-16 left-1/3 h-40 w-40 rounded-full bg-cyan-300/10 blur-3xl" />
        <div className="relative grid gap-5 lg:grid-cols-[1.35fr_0.9fr] lg:items-end">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-sky-100">
              <TrendingUp size={14} />
              {t('summaryHeroLabel')}
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('summaryHeroTitle')}</h2>
              <p className="mt-2 max-w-2xl text-sm text-sky-100/85">{t('summaryHeroSubtitle')}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-sky-100/80">{t('totalSpent')}</p>
                <p className="mt-1 text-3xl font-bold">{formatCurrency(totalAmount)}</p>
                <p className="mt-1 text-sm text-sky-100/80">
                  {t('approximately')} {formatBaseCurrency(totalBaseCurrency)}
                </p>
              </div>
              <div className="rounded-2xl bg-white/10 px-4 py-3 backdrop-blur-sm">
                <p className="text-xs text-sky-100/80">{t('summaryExpenseCount')}</p>
                <p className="mt-1 text-2xl font-bold">{expenses.length}</p>
                <p className="mt-1 text-sm text-sky-100/80">{t('summaryParticipantCount', { count: totalPeople })}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/35 bg-white/88 p-4 text-slate-900 shadow-lg shadow-slate-900/10 backdrop-blur-md">
              <div className="flex items-center gap-2 text-sky-700">
                <Receipt size={16} />
                <span className="text-sm font-semibold">{t('summaryTopPayer')}</span>
              </div>
              <p className="mt-3 text-lg font-bold tracking-tight text-slate-950">{leadingPayer?.name || '—'}</p>
              <p className="mt-1 text-sm font-medium text-slate-600">{leadingPayer ? formatCurrency(leadingPayer.paid) : formatCurrency(0)}</p>
            </div>
            <div className="rounded-2xl border border-white/30 bg-slate-950/72 p-4 text-white shadow-lg shadow-slate-950/20 backdrop-blur-md">
              <div className="flex items-center gap-2 text-emerald-200">
                <PiggyBank size={16} />
                <span className="text-sm font-semibold">{t('summaryTopReceiver')}</span>
              </div>
              <p className="mt-3 text-lg font-bold tracking-tight text-white">{topReceiver?.balance && topReceiver.balance > 0 ? topReceiver.name : '—'}</p>
              <p className="mt-1 text-sm font-medium text-emerald-100/90">
                {topReceiver && topReceiver.balance > 0 ? formatBaseCurrency(topReceiver.balance / exchangeRate) : formatBaseCurrency(0)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {familyStats.map(family => {
          const isSettled = Math.abs(family.balance) < 0.01;
          const isPositive = family.balance > 0.01;
          const statusLabel = isSettled ? t('settled') : isPositive ? t('receive') : t('owe');
          const badgeClass = isSettled
            ? 'bg-slate-100 text-slate-700'
            : isPositive
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-rose-100 text-rose-700';
          const balanceClass = isSettled
            ? 'text-slate-600'
            : isPositive
              ? 'text-emerald-600'
              : 'text-rose-600';

          return (
            <article
              key={family.id}
              className={`relative overflow-hidden rounded-3xl bg-gradient-to-br ${getFamilyColorClass(family.id)} p-[1px] shadow-lg shadow-slate-200/50`}
            >
              <div className="rounded-[calc(1.5rem-1px)] bg-white/90 p-5 backdrop-blur-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <Users size={16} />
                      <span>{family.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{t('summaryParticipantCount', { count: family.count })}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass}`}>
                    {statusLabel}
                  </span>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t('paid')}</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(family.paid)}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">{t('shouldPay')}</p>
                    <p className="mt-1 text-base font-semibold text-slate-900">{formatCurrency(family.share)}</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-slate-100 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs text-slate-500">{t('summaryNetBalance')}</p>
                  <div className="mt-1 flex items-end justify-between gap-3">
                    <p className={`text-lg font-bold ${balanceClass}`}>
                      {statusLabel}
                      {!isSettled && ` ${formatCurrency(Math.abs(family.balance))}`}
                    </p>
                    <p className="text-xs text-slate-400">{formatBaseCurrency(Math.abs(family.balance) / exchangeRate)}</p>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="glass-card rounded-3xl p-5 shadow-lg shadow-slate-200/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-600">
              <ArrowRightLeft size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('settlementPlan')}</h3>
              <p className="text-sm text-slate-500">{t('settlementCalcHint')}</p>
            </div>
          </div>

          {settlements.length > 0 ? (
            <div className="mt-5 space-y-3">
              {settlements.map((settlement, index) => (
                <div key={index} className="rounded-2xl border border-slate-100 bg-white/90 p-4 shadow-sm">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-600">{settlement.from}</div>
                      <ArrowRightLeft size={16} className="text-slate-300" />
                      <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-600">{settlement.to}</div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm text-slate-500">{settlement.from} {t('pays')} {settlement.to}</p>
                      <p className="mt-1 text-lg font-bold text-indigo-600">{formatBaseCurrency(settlement.amount / exchangeRate)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-3xl bg-gradient-to-r from-emerald-50 to-green-50 p-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600">
                <Wallet size={24} />
              </div>
              <p className="mt-4 text-lg font-semibold text-emerald-700">{t('allSettled')}</p>
              <p className="mt-1 text-sm text-emerald-600">{t('allSettledHint')}</p>
            </div>
          )}
        </div>

        <div className="glass-card rounded-3xl p-5 shadow-lg shadow-slate-200/40">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-100 text-sky-600">
              <TrendingUp size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{t('categoryStats')}</h3>
              <p className="text-sm text-slate-500">{t('summaryCategorySubtitle')}</p>
            </div>
          </div>

          {categoryBreakdown.length > 0 ? (
            <div className="mt-5 space-y-5">
              <div ref={chartContainerRef} className="h-64 w-full">
                {isChartReady && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={categoryBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={92}
                        paddingAngle={3}
                        dataKey="value"
                        stroke="none"
                      >
                        {categoryBreakdown.map(category => (
                          <Cell key={category.name} fill={category.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => formatCurrency(value)}
                        contentStyle={{ borderRadius: '16px', border: '1px solid #e2e8f0', boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="space-y-3">
                {categoryBreakdown.map(category => (
                  <div key={category.name} className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 px-4 py-3 shadow-sm ring-1 ring-slate-100">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="h-3 w-3 flex-shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">{category.label}</p>
                        <p className="text-xs text-slate-500">{category.percentage.toFixed(1)}%</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-slate-900">{formatCurrency(category.value)}</p>
                      <p className="text-xs text-slate-500">{formatBaseCurrency(category.value / exchangeRate)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
              {t('noExpensesHint')}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
