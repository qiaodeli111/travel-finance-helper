import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Settings, MapPin, Users, BookOpen, Globe, Languages } from 'lucide-react';
import { Family, COUNTRIES, ORIGIN_COUNTRIES } from '../types';
import { useTranslation } from '../i18n/useTranslation';
import { LANGUAGE_NAMES, Language } from '../i18n/translations';

interface SettingsModalProps {
  ledgerName: string;
  families: Family[];
  destination: string;
  originCountry: string;
  baseCurrency: string;
  onSave: (ledgerName: string, families: Family[], destination: string, currency: string, originCountry: string, baseCurrency: string) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  ledgerName,
  families,
  destination,
  originCountry,
  baseCurrency,
  onSave,
  onClose
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [localLedgerName, setLocalLedgerName] = useState(ledgerName);
  const [localFamilies, setLocalFamilies] = useState<Family[]>(families);
  const [localDestination, setLocalDestination] = useState(destination);
  const [localOriginCountry, setLocalOriginCountry] = useState(originCountry);
  const [localBaseCurrency, setLocalBaseCurrency] = useState(baseCurrency);

  useEffect(() => {
    setLocalLedgerName(ledgerName);
    setLocalFamilies(families);
    setLocalDestination(destination);
    setLocalOriginCountry(originCountry);
    setLocalBaseCurrency(baseCurrency);
  }, [ledgerName, families, destination, originCountry, baseCurrency]);

  // Update base currency when origin country changes
  const handleOriginChange = (newOrigin: string) => {
    setLocalOriginCountry(newOrigin);
    const origin = ORIGIN_COUNTRIES.find(c => c.name === newOrigin);
    if (origin) {
      setLocalBaseCurrency(origin.currency);
      // Auto-switch language
      setLanguage(origin.language);
    }
  };

  const handleDestinationChange = (newDest: string) => {
    setLocalDestination(newDest);
    // Auto-update ledger name if it follows the pattern or is default
    const isDefaultName = localLedgerName.includes('Trip') || localLedgerName.includes('旅行账本') || localLedgerName === 'New Ledger' || localLedgerName === '新建账本';
    if (isDefaultName) {
      setLocalLedgerName(language === 'zh' ? `${newDest}旅行账本` : `${newDest} Trip`);
    }
  };

  const handleAddFamily = () => {
    if (localFamilies.length >= 5) return;
    const newId = `f${Date.now()}`;
    const defaultName = language === 'zh' ? `家庭 ${localFamilies.length + 1}` : `Group ${localFamilies.length + 1}`;
    setLocalFamilies([...localFamilies, { id: newId, name: defaultName, count: 2 }]);
  };

  const handleRemoveFamily = (id: string) => {
    if (localFamilies.length <= 2) return;
    setLocalFamilies(localFamilies.filter(f => f.id !== id));
  };

  const handleUpdateFamily = (id: string, field: 'name' | 'count', value: string | number) => {
    setLocalFamilies(localFamilies.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const handleSave = () => {
    const country = COUNTRIES.find(c => c.name === localDestination);
    const currency = country ? country.currency : 'IDR';
    onSave(localLedgerName, localFamilies, localDestination, currency, localOriginCountry, localBaseCurrency);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/50">
        {/* Header - Travel Theme */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Settings size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('settingsTitle')}</h2>
              <p className="text-sky-100 text-xs">{t('settingsSubtitle')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {/* Language Switcher */}
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl">
            <div className="flex items-center gap-2">
              <Languages size={18} className="text-sky-500" />
              <span className="text-sm font-medium text-gray-700">{t('language')}</span>
            </div>
            <div className="flex gap-1 bg-white rounded-xl p-1 shadow-sm">
              {(Object.keys(LANGUAGE_NAMES) as Language[]).map((lang) => (
                <button
                  key={lang}
                  onClick={() => setLanguage(lang)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    language === lang
                      ? 'bg-sky-500 text-white shadow-sm'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  {LANGUAGE_NAMES[lang]}
                </button>
              ))}
            </div>
          </div>

          {/* Ledger Name */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <BookOpen size={14} className="text-sky-500" />
              {t('ledgerName')}
            </label>
            <input
              type="text"
              value={localLedgerName}
              onChange={(e) => setLocalLedgerName(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all"
              placeholder={t('ledgerNamePlaceholder')}
            />
          </div>

          {/* Origin Country - Where are you from */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <Globe size={14} className="text-sky-500" />
              {t('originCountry')}
            </label>
            <select
              value={localOriginCountry}
              onChange={(e) => handleOriginChange(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
            >
              {ORIGIN_COUNTRIES.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.currency} - {c.label})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
              {t('originCountryHint')}
            </p>
          </div>

          {/* Destination */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <MapPin size={14} className="text-sky-500" />
              {t('destination')}
            </label>
            <select
              value={localDestination}
              onChange={(e) => handleDestinationChange(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer"
            >
              {COUNTRIES.map(c => (
                <option key={c.name} value={c.name}>{c.name} ({c.currency})</option>
              ))}
            </select>
          </div>

          {/* Families */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase">
                <Users size={14} className="text-sky-500" />
                {t('families')}
              </label>
              {localFamilies.length < 5 && (
                <button onClick={handleAddFamily} className="text-sky-600 text-sm font-semibold flex items-center gap-1 px-3 py-1.5 bg-sky-50 rounded-xl hover:bg-sky-100 transition-colors">
                  <Plus size={16} /> {t('addGroup')}
                </button>
              )}
            </div>

            <div className="space-y-3">
              {localFamilies.map((f, index) => (
                <div key={f.id} className="flex gap-3 items-center bg-gray-50 p-3 rounded-2xl">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={f.name}
                      onChange={(e) => handleUpdateFamily(f.id, 'name', e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                      placeholder={t('groupName')}
                    />
                  </div>
                  <div className="w-20">
                    <input
                      type="number"
                      min="1"
                      value={f.count}
                      onChange={(e) => handleUpdateFamily(f.id, 'count', parseInt(e.target.value) || 1)}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <div className="w-10 flex justify-center">
                    {localFamilies.length > 2 && (
                      <button onClick={() => handleRemoveFamily(f.id)} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors">
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
              {t('settlementHint')}
            </p>
          </div>
        </div>

        <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
          <button onClick={onClose} className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-200 rounded-2xl transition-colors">
            {t('cancel')}
          </button>
          <button onClick={handleSave} className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2">
            <Save size={18} /> {t('saveSettings')}
          </button>
        </div>
      </div>
    </div>
  );
};