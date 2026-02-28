import React from 'react';
import { AppState, Family } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { TrendingUp, Users, Wallet, ArrowRightLeft } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface SummaryProps {
  state: AppState;
}

const COLORS = ['#0ea5e9', '#f97316', '#84cc16', '#ec4899', '#8b5cf6', '#f59e0b'];

export const Summary: React.FC<SummaryProps> = ({ state }) => {
  const { t } = useTranslation();
  const { expenses, families, exchangeRate, currencyCode, baseCurrency } = state;

  // 1. Calculate Totals
  const totalAmount = expenses.reduce((sum, e) => {
    const amt = e.amount !== undefined ? e.amount : (e as any).amountIDR;
    return sum + amt;
  }, 0);
  const totalCNY = totalAmount / exchangeRate;

  // 2. Calculate Family Stats
  const totalPeople = families.reduce((sum, f) => sum + f.count, 0);

  const familyStats = families.map(f => {
    // Paid
    const paid = expenses
      .filter(e => {
        if (e.payerId) return e.payerId === f.id;
        // Legacy check
        return (e as any).payer === (f.id === 'f1' ? 'Family 1' : 'Family 2');
      })
      .reduce((sum, e) => sum + (e.amount || (e as any).amountIDR), 0);

    // Share
    const ratio = totalPeople > 0 ? f.count / totalPeople : 0;
    const share = totalAmount * ratio;

    // Balance (Positive = Paid more than share = Should Receive)
    const balance = paid - share;

    return { ...f, paid, share, balance };
  });

  // 3. Settlement Logic
  interface Settlement {
    from: string;
    to: string;
    amount: number;
  }

  const settlements: Settlement[] = [];
  // Clone to modify balances during calculation
  const workingBalances = familyStats.map(f => ({ ...f }));

  const debtors = workingBalances.filter(b => b.balance < -0.01);
  const creditors = workingBalances.filter(b => b.balance > 0.01);

  let dIndex = 0;
  let cIndex = 0;

  while (dIndex < debtors.length && cIndex < creditors.length) {
    const debtor = debtors[dIndex];
    const creditor = creditors[cIndex];

    // Amount to settle is min of what debtor owes and what creditor is owed
    const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

    settlements.push({
      from: debtor.name,
      to: creditor.name,
      amount: amount
    });

    debtor.balance += amount;
    creditor.balance -= amount;

    if (Math.abs(debtor.balance) < 0.01) dIndex++;
    if (creditor.balance < 0.01) cIndex++;
  }

  // Chart Data
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

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(val);
  const formatBaseCurrency = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: baseCurrency || 'CNY', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-6">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Card */}
        <div className="bg-gradient-to-br from-sky-500 to-blue-600 rounded-2xl p-5 text-white shadow-lg shadow-sky-500/20 col-span-1 md:col-span-2 lg:col-span-1 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={18} className="text-sky-100" />
              <h3 className="text-sky-100 text-sm font-medium uppercase tracking-wider">{t('totalSpent')}</h3>
            </div>
            <div className="text-3xl font-bold mb-1">{formatCurrency(totalAmount)}</div>
            <div className="text-sky-100 text-sm flex items-center gap-1">
              <span className="opacity-70">{t('approximately')}</span>
              <span>{formatBaseCurrency(totalCNY)}</span>
            </div>
          </div>
        </div>

        {/* Family Cards */}
        {familyStats.map((f, index) => (
          <div key={f.id} className={`rounded-2xl p-5 shadow-md border-l-4 ${index % 2 === 0 ? 'bg-gradient-to-br from-orange-50 to-orange-100/50 border-orange-400' : 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-400'}`}>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-gray-600 text-sm font-medium flex items-center gap-1.5">
                <Users size={14} />
                {f.name}
              </h3>
              <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full text-gray-500">{f.count} {t('persons')}</span>
            </div>
            <div className="text-xl font-bold text-gray-800 mb-2">{formatCurrency(f.paid)}</div>
            <div className="space-y-1">
              <p className="text-xs text-gray-500">{t('shouldPay')}: {formatCurrency(f.share)}</p>
              <p className={`text-xs font-bold px-2 py-1 rounded-lg inline-block ${f.balance >= 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {f.balance >= 0 ? `${t('receive')} ${formatCurrency(f.balance)}` : `${t('owe')} ${formatCurrency(Math.abs(f.balance))}`}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Settlement Section */}
      {settlements.length > 0 ? (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-100 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 bg-indigo-500 rounded-xl flex items-center justify-center">
              <ArrowRightLeft size={16} className="text-white" />
            </div>
            <h2 className="text-indigo-900 font-bold text-lg">{t('settlementPlan')}</h2>
          </div>
          <div className="space-y-3">
            {settlements.map((s, idx) => (
              <div key={idx} className="bg-white p-4 rounded-2xl shadow-sm border border-indigo-50 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <span className="font-bold text-orange-600 text-sm">{s.from.slice(0, 2)}</span>
                  </div>
                  <ArrowRightLeft size={16} className="text-gray-300" />
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
                    <span className="font-bold text-emerald-600 text-sm">{s.to.slice(0, 2)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-500 text-sm">{s.from} {t('pays')} {s.to}</span>
                  <span className="text-xl font-bold text-indigo-600 bg-indigo-50 px-4 py-1.5 rounded-xl">{formatCurrency(s.amount)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-center text-xs text-indigo-400 mt-4">
            * {t('settlementCalcHint')}
          </p>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Wallet size={28} className="text-green-500" />
          </div>
          <p className="text-green-700 font-semibold text-lg">{t('allSettled')}</p>
          <p className="text-green-500 text-sm mt-1">{t('allSettledHint')}</p>
        </div>
      )}

      {/* Chart */}
      {dataByCategory.length > 0 && (
        <div className="bg-white/80 backdrop-blur-sm p-5 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-sky-100 rounded-lg flex items-center justify-center">
              <TrendingUp size={14} className="text-sky-600" />
            </div>
            <h3 className="text-gray-700 font-bold">{t('categoryStats')}</h3>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={dataByCategory}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  fill="#8884d8"
                  paddingAngle={3}
                  dataKey="value"
                >
                  {dataByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};
