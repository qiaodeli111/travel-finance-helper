import React from 'react';
import { Expense, Family } from '../types';
import { Trash2, Receipt, Calendar, CreditCard } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface ExpenseListProps {
  expenses: Expense[];
  families: Family[];
  currencyCode: string;
  exchangeRate: number;
  onDelete: (id: string) => void;
}

const COLORS = ['bg-sky-500', 'bg-orange-500', 'bg-emerald-500', 'bg-purple-500', 'bg-pink-500'];

export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, families, currencyCode, exchangeRate, onDelete }) => {
  const { t } = useTranslation();

  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <div className="w-20 h-20 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
          <Receipt size={40} className="text-gray-300" />
        </div>
        <p className="text-gray-500 font-medium">{t('noExpenses')}</p>
        <p className="text-sm text-gray-400 mt-1">{t('noExpensesHint')}</p>
      </div>
    );
  }

  // Sort by date ascending
  const sortedExpenses = [...expenses].sort((a, b) => a.date - b.date);

  const formatCurrency = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: currencyCode, maximumFractionDigits: 0 }).format(val);
  const formatCNY = (val: number) => new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 }).format(val);

  return (
    <div className="space-y-3">
      {sortedExpenses.map((expense) => {
        // Resolve Payer
        let payerId = expense.payerId;
        if (!payerId && (expense as any).payer) {
             // Legacy fallback
             payerId = (expense as any).payer === 'Family 1' ? 'f1' : 'f2';
        }

        const familyIndex = families.findIndex(f => f.id === payerId);
        const familyName = familyIndex >= 0 ? families[familyIndex].name : 'Unknown';
        const colorClass = COLORS[familyIndex % COLORS.length] || 'bg-gray-500';

        // Resolve Amount
        const amount = expense.amount !== undefined ? expense.amount : (expense as any).amountIDR;
        const cnyAmount = amount / exchangeRate;

        return (
          <div key={expense.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all group">
            <div className="flex justify-between items-center gap-3">
              <div className="flex gap-3 items-center overflow-hidden flex-1">
                {/* Family Avatar */}
                <div
                   className={`w-11 h-11 rounded-xl flex items-center justify-center text-white text-xs font-bold shrink-0 ${colorClass} shadow-lg shadow-${colorClass.split('-')[1]}-500/30`}
                   title={familyName}
                >
                  <span>{familyName.slice(0, 2)}</span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-semibold text-gray-800 line-clamp-1">{expense.description}</h4>
                  <div className="flex gap-2 text-xs text-gray-500 mt-1.5 items-center flex-wrap">
                    <span className="bg-gray-100 px-2.5 py-1 rounded-lg font-medium whitespace-nowrap">{expense.category}</span>
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar size={12} />
                      {new Date(expense.date).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 pl-2 shrink-0">
                <div className="text-right">
                  <div className="font-bold text-gray-800 font-mono text-base sm:text-lg whitespace-nowrap">
                    {formatCurrency(amount)}
                  </div>
                  <div className="text-xs text-gray-400 flex items-center gap-1">
                    <CreditCard size={10} />
                    ≈ {formatCNY(cnyAmount)}
                  </div>
                </div>
                <button
                  onClick={() => {
                    if(window.confirm(t('deleteConfirm'))) onDelete(expense.id);
                  }}
                  className="text-gray-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-xl"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
