import React from 'react';
import { Expense, Family } from '../types';
import { Trash2, Receipt } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  families: Family[];
  currencyCode: string;
  exchangeRate: number;
  onDelete: (id: string) => void;
}

const COLORS = ['bg-blue-500', 'bg-orange-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500'];

export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, families, currencyCode, exchangeRate, onDelete }) => {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Receipt size={48} className="mb-4 opacity-50" />
        <p>暂无账单记录</p>
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
        const familyName = familyIndex >= 0 ? families[familyIndex].name : '未知';
        const colorClass = COLORS[familyIndex % COLORS.length] || 'bg-gray-500';
        
        // Resolve Amount
        const amount = expense.amount !== undefined ? expense.amount : (expense as any).amountIDR;
        const cnyAmount = amount / exchangeRate;

        return (
          <div key={expense.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex justify-between items-center group">
            <div className="flex gap-4 items-center overflow-hidden">
              {/* Family Avatar */}
              <div 
                 className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 ${colorClass}`}
                 title={familyName}
              >
                <span>{familyName.slice(0, 2)}</span>
              </div>
              
              <div className="min-w-0">
                <h4 className="font-semibold text-gray-800 line-clamp-1">{expense.description}</h4>
                <div className="flex gap-2 text-xs text-gray-500 mt-1 items-center">
                  <span className="bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">{expense.category}</span>
                  <span className="whitespace-nowrap">{new Date(expense.date).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pl-2 shrink-0">
              <div className="text-right">
                <div className="font-bold text-gray-700 font-mono text-sm sm:text-base whitespace-nowrap">
                  {formatCurrency(amount)}
                </div>
                <div className="text-xs text-gray-400">
                  ≈ {formatCNY(cnyAmount)}
                </div>
              </div>
              <button 
                onClick={() => {
                  if(window.confirm('确定删除这条账单吗？')) onDelete(expense.id);
                }}
                className="text-gray-300 hover:text-red-500 transition-colors p-2"
              >
                <Trash2 size={18} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
