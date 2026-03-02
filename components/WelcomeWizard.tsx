import React, { useState } from 'react';
import { Plane, MapPin, Globe, Users, BookOpen, Star, ArrowRight, ArrowLeft, Check } from 'lucide-react';
import { Family, COUNTRIES, ORIGIN_COUNTRIES } from '../types';
import { useTranslation, getCountryDisplayText } from '../i18n/useTranslation';
import { LANGUAGE_NAMES, Language } from '../i18n/translations';

interface WelcomeWizardProps {
  isOpen: boolean;
  onComplete: (data: {
    ledgerName: string;
    destination: string;
    originCountry: string;
    baseCurrency: string;
    families: Family[];
    setAsDefault: boolean;
  }) => void;
}

const DEFAULT_FAMILIES: Family[] = [
  { id: 'f1', name: '家庭 1', count: 4 },
  { id: 'f2', name: '家庭 2', count: 2 }
];

export const WelcomeWizard: React.FC<WelcomeWizardProps> = ({
  isOpen,
  onComplete
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [step, setStep] = useState(1);
  const [ledgerName, setLedgerName] = useState('');
  const [originCountry, setOriginCountry] = useState('中国');
  const [baseCurrency, setBaseCurrency] = useState('CNY');
  const [destination, setDestination] = useState('印度尼西亚');
  const [families, setFamilies] = useState<Family[]>(DEFAULT_FAMILIES);
  const [setAsDefault, setSetAsDefault] = useState(true);

  if (!isOpen) return null;

  const handleOriginChange = (newOrigin: string) => {
    setOriginCountry(newOrigin);
    const origin = ORIGIN_COUNTRIES.find(c => c.name === newOrigin);
    if (origin) {
      setBaseCurrency(origin.currency);
      setLanguage(origin.language);
    }
  };

  const handleDestinationChange = (newDest: string) => {
    setDestination(newDest);
    if (!ledgerName || ledgerName.includes('Trip') || ledgerName.includes('旅行账本')) {
      setLedgerName(language === 'zh' ? `${newDest}旅行账本` : `${newDest} Trip`);
    }
  };

  const handleAddFamily = () => {
    if (families.length >= 5) return;
    const newId = `f${Date.now()}`;
    const defaultName = language === 'zh' ? `家庭 ${families.length + 1}` : `Group ${families.length + 1}`;
    setFamilies([...families, { id: newId, name: defaultName, count: 2 }]);
  };

  const handleRemoveFamily = (id: string) => {
    if (families.length <= 2) return;
    setFamilies(families.filter(f => f.id !== id));
  };

  const handleUpdateFamily = (id: string, field: 'name' | 'count', value: string | number) => {
    setFamilies(families.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleComplete = () => {
    onComplete({
      ledgerName: ledgerName || (language === 'zh' ? '我的旅行账本' : 'My Travel Ledger'),
      destination,
      originCountry,
      baseCurrency,
      families,
      setAsDefault
    });
  };

  const totalSteps = 4;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-sky-500 to-blue-600 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-6 text-center bg-gradient-to-r from-sky-50 to-blue-50">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plane size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">{t('appTitle')}</h1>
          <p className="text-gray-500 mt-1">{t('appSubtitle')}</p>

          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mt-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-8 h-1 rounded-full transition-colors ${
                  i + 1 <= step ? 'bg-sky-500' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 min-h-[300px]">
          {/* Step 1: Language */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800">{t('language')}</h2>
                <p className="text-gray-500 text-sm mt-1">Select your preferred language</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(Object.keys(LANGUAGE_NAMES) as Language[]).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setLanguage(lang)}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      language === lang
                        ? 'border-sky-500 bg-sky-50 text-sky-600'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="text-lg font-bold">{LANGUAGE_NAMES[lang]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Origin & Destination */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-xl font-bold text-gray-800">{t('destination')}</h2>
                <p className="text-gray-500 text-sm mt-1">{t('originCountryHint')}</p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Globe size={16} className="text-sky-500" />
                  {t('originCountry')}
                </label>
                <select
                  value={originCountry}
                  onChange={(e) => handleOriginChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {ORIGIN_COUNTRIES.map(c => (
                    <option key={c.name} value={c.name}>
                      {getCountryDisplayText(c.name, language)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <MapPin size={16} className="text-sky-500" />
                  {t('destination')}
                </label>
                <select
                  value={destination}
                  onChange={(e) => handleDestinationChange(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.name} value={c.name}>
                      {getCountryDisplayText(c.name, language)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Step 3: Ledger Name & Families */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <BookOpen size={16} className="text-sky-500" />
                  {t('ledgerName')}
                </label>
                <input
                  type="text"
                  value={ledgerName}
                  onChange={(e) => setLedgerName(e.target.value)}
                  placeholder={t('ledgerNamePlaceholder')}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                    <Users size={16} className="text-sky-500" />
                    {t('families')}
                  </label>
                  {families.length < 5 && (
                    <button
                      onClick={handleAddFamily}
                      className="text-sky-600 text-sm font-medium hover:text-sky-700"
                    >
                      + {t('addGroup')}
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {families.map((f) => (
                    <div key={f.id} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={f.name}
                        onChange={(e) => handleUpdateFamily(f.id, 'name', e.target.value)}
                        className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 outline-none"
                      />
                      <input
                        type="number"
                        min="1"
                        value={f.count}
                        onChange={(e) => handleUpdateFamily(f.id, 'count', parseInt(e.target.value) || 1)}
                        className="w-16 px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm text-center focus:ring-2 focus:ring-sky-500 outline-none"
                      />
                      {families.length > 2 && (
                        <button
                          onClick={() => handleRemoveFamily(f.id)}
                          className="p-2 text-red-400 hover:text-red-600"
                        >
                          ×
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Set as Default */}
          {step === 4 && (
            <div className="space-y-6 text-center">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <Check size={40} className="text-green-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">{t('createLedger')}</h2>
              <p className="text-gray-500">{t('ledgerName')}: <strong>{ledgerName || (language === 'zh' ? '我的旅行账本' : 'My Travel Ledger')}</strong></p>

              <button
                onClick={() => setSetAsDefault(!setAsDefault)}
                className={`w-full p-4 rounded-2xl border-2 transition-all flex items-center justify-center gap-3 ${
                  setAsDefault
                    ? 'border-sky-500 bg-sky-50 text-sky-600'
                    : 'border-gray-200 text-gray-600'
                }`}
              >
                <Star size={20} className={setAsDefault ? 'fill-sky-500' : ''} />
                <span>{t('setDefault', 'Set as default ledger')}</span>
              </button>
              <p className="text-xs text-gray-400">
                {t('defaultHint', 'This ledger will open automatically when you visit')}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-100 flex justify-between bg-gray-50/50">
          <button
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            className="px-6 py-3 text-gray-600 font-medium hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-30 flex items-center gap-2"
          >
            <ArrowLeft size={18} />
            {t('cancel')}
          </button>

          {step < totalSteps ? (
            <button
              onClick={() => setStep(step + 1)}
              className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              {t('saveSettings')}
              <ArrowRight size={18} />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg transition-all flex items-center gap-2"
            >
              <Check size={18} />
              {t('createLedger')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};