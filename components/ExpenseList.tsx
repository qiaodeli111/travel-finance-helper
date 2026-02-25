import React from 'react';
import { Expense, Family } from '../types';
import { Trash2, Receipt } from 'lucide-react';

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

export const ExpenseList: React.FC<ExpenseListProps> = ({ expenses, onDelete }) => {
  if (expenses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
        <Receipt size={48} className="mb-4 opacity-50" />
        <p>暂无账单记录</p>
      </div>
    );
  }

  // Changed to ascending order (early to late)
  const sortedExpenses = [...expenses].sort((a, b) => a.date - b.date);
  const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="space-y-3">
      {sortedExpenses.map((expense) => {
        const isF1 = expense.payer === Family.F1 || (typeof expense.payer === 'string' && expense.payer.includes('Family 1'));
        
        return (
          <div key={expense.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex justify-between items-center group">
            <div className="flex gap-4 items-center overflow-hidden">
              {/* Family Avatar */}
              <div 
                 className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0 
                ${isF1 ? 'bg-blue-500' : 'bg-orange-500'}`}
              >
                <span>{isF1 ? '家1' : '家2'}</span>
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
              <span className="font-bold text-gray-700 font-mono text-sm sm:text-base whitespace-nowrap">
                {formatIDR(expense.amountIDR)}
              </span>
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