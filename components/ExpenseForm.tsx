import React, { useState, useEffect } from 'react';
import { Category, Family, Expense } from '../types';
import { Sparkles, X, Calendar, MapPin, CreditCard, Users, Tag } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { translations } from '../i18n/translations';

interface ExpenseFormProps {
  families: Family[];
  currencyCode: string;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onClose: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({ families, currencyCode, onAddExpense, onClose }) => {
  const { t } = useTranslation();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<Category>(Category.FOOD);
  const [payerId, setPayerId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Set default payer
  useEffect(() => {
    if (families.length > 0 && !payerId) {
      setPayerId(families[0].id);
    }
  }, [families, payerId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date || !payerId) return;
    onAddExpense({
      description,
      amount: parseFloat(amount),
      category,
      payerId,
      date: new Date(date).getTime(),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-white/50">
        {/* Header - Travel Theme */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <MapPin size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('addExpense')}</h2>
              <p className="text-sky-100 text-xs">{t('addExpenseSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6">
          <form id="expense-form" onSubmit={handleSubmit} className="space-y-5">
            {/* Date Field */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                <Calendar size={14} className="text-sky-500" />
                {t('expenseDate')}
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                />
              </div>
            </div>

            {/* Description Field */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                <Tag size={14} className="text-sky-500" />
                {t('expenseDescription')}
              </label>
              <input
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t('expenseDescriptionPlaceholder')}
                className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all placeholder:text-gray-400"
              />
            </div>

            {/* Amount Field */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                <CreditCard size={14} className="text-sky-500" />
                {t('amount')} ({currencyCode})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">{currencyCode}</span>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={t('amountPlaceholder')}
                  className="w-full pl-16 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all font-mono font-bold text-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Category Field */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">{t('category')}</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                >
                  {Object.values(Category).map((c) => (
                    <option key={c} value={c}>{t(c.toLowerCase() as keyof typeof translations.en)}</option>
                  ))}
                </select>
              </div>

              {/* Payer Field */}
              <div>
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                  <Users size={14} className="text-sky-500" />
                  {t('payer')}
                </label>
                <select
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
                >
                  {families.map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-200 rounded-2xl transition-colors">
            {t('cancel')}
          </button>
          <button type="submit" form="expense-form" className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2">
            <Sparkles size={18} /> {t('saveExpense')}
          </button>
        </div>
      </div>
    </div>
  );
};
