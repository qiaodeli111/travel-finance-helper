import React, { useState } from 'react';
import { Category, Family, Expense, FamilyLabels } from '../types';
import { Sparkles, X, Calendar } from 'lucide-react';

interface ExpenseFormProps {
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onClose: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ onAddExpense, onClose }) => {
  const [description, setDescription] = useState('');
  const [amountIDR, setAmountIDR] = useState<string>('');
  const [category, setCategory] = useState<Category>(Category.FOOD);
  const [payer, setPayer] = useState<Family>(Family.F1);
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amountIDR || !date) return;
    onAddExpense({
      description,
      amountIDR: parseFloat(amountIDR),
      category,
      payer,
      date: new Date(date).getTime(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col">
        <div className="p-4 border-b flex justify-between items-center bg-teal-600 text-white">
          <h2 className="font-semibold text-lg">新增账单</h2>
          <button onClick={onClose} className="p-1 hover:bg-teal-700 rounded-full">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-4 text-gray-900">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">消费日期</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 text-gray-400" size={18} />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">消费描述</label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="例如：乌布午餐"
                className="w-full px-4 py-3 border rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1">金额 (IDR 印尼盾)</label>
              <div className="relative">
                <span className="absolute left-3 top-3 text-gray-400 font-semibold">Rp</span>
                <input
                  type="number"
                  required
                  min="0"
                  value={amountIDR}
                  onChange={(e) => setAmountIDR(e.target.value)}
                  placeholder="输入印尼盾金额"
                  className="w-full pl-10 pr-4 py-3 border rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none font-mono font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">类别</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full px-3 py-3 border rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  {Object.values(Category).map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">谁付的钱</label>
                <select
                  value={payer}
                  onChange={(e) => setPayer(e.target.value as Family)}
                  className="w-full px-3 py-3 border rounded-xl bg-white text-gray-900 focus:ring-2 focus:ring-teal-500 outline-none"
                >
                  <option value={Family.F1}>{FamilyLabels[Family.F1]}</option>
                  <option value={Family.F2}>{FamilyLabels[Family.F2]}</option>
                </select>
              </div>
            </div>
          </form>
        </div>

        <div className="p-4 border-t bg-gray-50 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors">取消</button>
          <button type="submit" form="expense-form" className="px-8 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2">
            <Sparkles size={18} /> 确认保存
          </button>
        </div>
      </div>
    </div>
  );
};