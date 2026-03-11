import React, { useState, useEffect } from 'react';
import { Category, Family, Expense } from '../types';
import { Sparkles, X, Calendar, MapPin, CreditCard, Users, Tag } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { translations } from '../i18n/translations';
import { useAuth } from '../src/contexts/AuthContext';

interface ExpenseFormProps {
  families: Family[];
  destination: string;
  currencyCode: string;
  baseCurrency: string;
  exchangeRate: number;
  onAddExpense: (expense: Omit<Expense, 'id'>) => void;
  onClose: () => void;
}

export const ExpenseForm: React.FC<ExpenseFormProps> = ({
  families,
  destination,
  currencyCode,
  baseCurrency,
  exchangeRate,
  onAddExpense,
  onClose,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [category, setCategory] = useState<Category>(Category.FOOD);
  const [payerId, setPayerId] = useState<string>('');
  const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sharedWithFamilyIds, setSharedWithFamilyIds] = useState<string[]>([]);

  // Multi-currency settlement fields
  const [travelPlaceName, setTravelPlaceName] = useState<string>(destination);
  const [paymentCurrency, setPaymentCurrency] = useState<string>(currencyCode);
  const [settlementCurrency, setSettlementCurrency] = useState<string>(baseCurrency);
  const [fxRate, setFxRate] = useState<string>(currencyCode === baseCurrency ? '1' : String(exchangeRate));

  // Keep multi-currency defaults in sync with the active ledger until the user edits them
  useEffect(() => {
    setTravelPlaceName(prev => prev || destination);
  }, [destination]);

  useEffect(() => {
    setPaymentCurrency(prev => prev || currencyCode);
  }, [currencyCode]);

  useEffect(() => {
    setSettlementCurrency(prev => prev || baseCurrency);
  }, [baseCurrency]);

  useEffect(() => {
    if (!paymentCurrency || !settlementCurrency) return;
    setFxRate(paymentCurrency.trim().toUpperCase() === settlementCurrency.trim().toUpperCase() ? '1' : String(exchangeRate));
  }, [paymentCurrency, settlementCurrency, exchangeRate]);

  // Set default payer and default share with all other families
  useEffect(() => {
    if (families.length > 0 && !payerId) {
      setPayerId(families[0].id);
    }
  }, [families, payerId]);

  // Update shared families when payer changes - default to all other families
  useEffect(() => {
    const otherFamilyIds = families.filter(f => f.id !== payerId).map(f => f.id);
    setSharedWithFamilyIds(otherFamilyIds);
  }, [payerId, families]);

  // Close on Escape for keyboard accessibility
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSharedWithToggle = (familyId: string) => {
    setSharedWithFamilyIds(prev =>
      prev.includes(familyId)
        ? prev.filter(id => id !== familyId)
        : [...prev, familyId]
    );
  };

  const handleSelectAllShared = () => {
    const allOtherFamilyIds = families.filter(f => f.id !== payerId).map(f => f.id);
    setSharedWithFamilyIds(allOtherFamilyIds);
  };

  const handleDeselectAllShared = () => {
    setSharedWithFamilyIds([]);
  };

  const normalizedPaymentCurrency = paymentCurrency.trim().toUpperCase() || currencyCode;
  const normalizedSettlementCurrency = settlementCurrency.trim().toUpperCase() || baseCurrency;
  const parsedAmount = parseFloat(amount);
  const parsedFxRate = parseFloat(fxRate);
  const effectiveFxRate = normalizedPaymentCurrency === normalizedSettlementCurrency ? 1 : parsedFxRate;
  const hasValidSettlement = Number.isFinite(parsedAmount) && parsedAmount > 0 && Number.isFinite(effectiveFxRate) && effectiveFxRate > 0;
  const settlementAmount = hasValidSettlement ? parsedAmount / effectiveFxRate : undefined;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount || !date || !payerId || !hasValidSettlement) return;

    const resolvedTravelPlaceName = travelPlaceName.trim() || destination;
    const resolvedPaymentCurrency = (paymentCurrency || currencyCode).trim().toUpperCase();
    const resolvedSettlementCurrency = (settlementCurrency || baseCurrency).trim().toUpperCase();
    const capturedAt = Date.now();

    onAddExpense({
      description,
      amount: parsedAmount,
      category,
      payerId,
      date: new Date(date).getTime(),
      sharedWithFamilyIds,
      travelPlaceName: resolvedTravelPlaceName,
      paymentCurrency: resolvedPaymentCurrency,
      settlementCurrency: resolvedSettlementCurrency,
      fxSnapshot: {
        base: resolvedSettlementCurrency,
        quote: resolvedPaymentCurrency,
        rate: effectiveFxRate,
        capturedAt,
      },
      amountSettlement: settlementAmount,
      // Add creator info
      createdBy: user?.uid,
      createdByDisplayName: user?.displayName || user?.email?.split('@')[0] || 'User',
      createdAt: capturedAt,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col border border-white/50 max-h-[90vh]">
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

        <div className="p-6 overflow-y-auto">
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
                {t('amount')} ({paymentCurrency || currencyCode})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">{paymentCurrency || currencyCode}</span>
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

            {/* Multi-currency Settlement */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                  <MapPin size={14} className="text-sky-500" />
                  {t('travelPlaceName')}
                </label>
                <input
                  type="text"
                  value={travelPlaceName}
                  onChange={(e) => setTravelPlaceName(e.target.value)}
                  placeholder={destination}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  {t('paymentCurrency')}
                </label>
                <input
                  type="text"
                  value={paymentCurrency}
                  onChange={(e) => setPaymentCurrency(e.target.value.toUpperCase())}
                  maxLength={3}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 uppercase focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  {t('settlementCurrency')}
                </label>
                <input
                  type="text"
                  value={settlementCurrency}
                  readOnly
                  className="w-full px-4 py-3.5 bg-gray-100 border border-gray-200 rounded-2xl text-gray-700 uppercase focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                  {t('fxRate')} ({t('fxRateHint')})
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.000001"
                  value={fxRate}
                  onChange={(e) => setFxRate(e.target.value)}
                  disabled={normalizedPaymentCurrency === normalizedSettlementCurrency}
                  className={`w-full px-4 py-3.5 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all font-mono ${normalizedPaymentCurrency === normalizedSettlementCurrency ? 'bg-gray-100 text-gray-700' : 'bg-gray-50'}`}
                />
                {paymentCurrency && settlementCurrency && (
                  <p className="mt-2 text-xs text-gray-500">
                    1 {settlementCurrency || baseCurrency} = {paymentCurrency === settlementCurrency ? '1' : fxRate || exchangeRate} {paymentCurrency || currencyCode}
                  </p>
                )}
                {settlementAmount !== undefined && (
                  <p className="mt-1 text-sm font-semibold text-sky-700">
                    {t('settlementAmount')}: {settlementAmount.toFixed(2)} {settlementCurrency || baseCurrency}
                  </p>
                )}
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

            {/* Share With Field */}
            <div>
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
                <Users size={14} className="text-sky-500" />
                {t('shareWith')}
              </label>
              <p className="text-xs text-gray-400 mb-3">{t('shareWithHint')}</p>
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={handleSelectAllShared}
                  className="px-3 py-1.5 text-xs font-medium text-sky-600 bg-sky-50 hover:bg-sky-100 rounded-lg transition-colors"
                >
                  {t('selectAll')}
                </button>
                <button
                  type="button"
                  onClick={handleDeselectAllShared}
                  className="px-3 py-1.5 text-xs font-medium text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {t('deselectAll')}
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {families.filter(f => f.id !== payerId).map(family => (
                  <label
                    key={family.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      sharedWithFamilyIds.includes(family.id)
                        ? 'border-sky-500 bg-sky-50'
                        : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={sharedWithFamilyIds.includes(family.id)}
                      onChange={() => handleSharedWithToggle(family.id)}
                      className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500"
                    />
                    <span className="font-medium text-gray-700">{family.name}</span>
                    <span className="text-xs text-gray-400">({family.count} {t('persons')})</span>
                  </label>
                ))}
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
