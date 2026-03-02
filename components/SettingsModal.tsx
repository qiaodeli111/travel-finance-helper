import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Settings, MapPin, Users, BookOpen, Globe, Cloud, CloudOff, Download, Upload, FileText, FileDown } from 'lucide-react';
import { Family, COUNTRIES, ORIGIN_COUNTRIES } from '../types';
import { useTranslation, getCountryDisplayText } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { useCloudSync } from '../src/contexts/CloudSyncContext';

interface SettingsModalProps {
  ledgerName: string;
  families: Family[];
  destination: string;
  originCountry: string;
  baseCurrency: string;
  onSave: (ledgerName: string, families: Family[], destination: string, currency: string, originCountry: string, baseCurrency: string) => void;
  onClose: () => void;
  onExportJSON?: () => void;
  onImportJSON?: () => void;
  onExportMarkdown?: () => void;
  onExportPDF?: () => void;
  userRole?: 'owner' | 'admin' | 'member' | 'viewer' | null;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  ledgerName,
  families,
  destination,
  originCountry,
  baseCurrency,
  onSave,
  onClose,
  onExportJSON,
  onImportJSON,
  onExportMarkdown,
  onExportPDF,
  userRole
}) => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { isCloudEnabled, enableCloud, syncNow, syncStatus } = useCloudSync();

  const canChangeSettings = !userRole || userRole === 'owner' || userRole === 'admin';
  const isViewer = userRole === 'viewer';

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

  const handleOriginChange = (newOrigin: string) => {
    setLocalOriginCountry(newOrigin);
    const origin = ORIGIN_COUNTRIES.find(c => c.name === newOrigin);
    if (origin) {
      setLocalBaseCurrency(origin.currency);
    }
  };

  const handleDestinationChange = (newDest: string) => {
    setLocalDestination(newDest);
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

  const handleEnableCloudSync = () => {
    if (!user) {
      // Will be handled by parent component to show login modal
      return;
    }
    enableCloud();
    // syncNow will be called by parent when data changes
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col max-h-[90vh] border border-white/50">
        {/* Header */}
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
          {/* Cloud Sync Section */}
          <div className="p-4 bg-gradient-to-r from-sky-50 to-blue-50 rounded-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {isCloudEnabled ? (
                  <Cloud size={24} className="text-sky-500" />
                ) : (
                  <CloudOff size={24} className="text-gray-400" />
                )}
                <div>
                  <p className="font-medium text-gray-800">{t('cloudSyncEnabled')}</p>
                  <p className="text-xs text-gray-500">
                    {user ? t('syncStatus') + ': ' + t(syncStatus) : t('signInToSync')}
                  </p>
                </div>
              </div>
              {!isCloudEnabled && (
                <button
                  onClick={handleEnableCloudSync}
                  className="px-4 py-2 bg-sky-500 text-white rounded-xl text-sm font-medium hover:bg-sky-600 transition-colors"
                >
                  {t('enableCloudSync')}
                </button>
              )}
            </div>
          </div>

          {/* Data Management Section */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-3">
              <FileText size={14} className="text-orange-500" />
              {t('backupData')} / {t('restoreData')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onExportJSON}
                className="flex items-center justify-center gap-2 p-3 bg-orange-50 hover:bg-orange-100 rounded-xl text-orange-600 font-medium transition-colors"
              >
                <Download size={18} />
                {t('backupData')}
              </button>
              <button
                onClick={onImportJSON}
                className="flex items-center justify-center gap-2 p-3 bg-green-50 hover:bg-green-100 rounded-xl text-green-600 font-medium transition-colors"
              >
                <Upload size={18} />
                {t('restoreData')}
              </button>
            </div>
          </div>

          {/* Export Section */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-3">
              <FileDown size={14} className="text-purple-500" />
              {t('exportTitle')}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={onExportMarkdown}
                className="flex items-center justify-center gap-2 p-3 bg-purple-50 hover:bg-purple-100 rounded-xl text-purple-600 font-medium transition-colors"
              >
                <FileText size={18} />
                Markdown
              </button>
              <button
                onClick={onExportPDF}
                className="flex items-center justify-center gap-2 p-3 bg-red-50 hover:bg-red-100 rounded-xl text-red-600 font-medium transition-colors"
              >
                <FileDown size={18} />
                PDF
              </button>
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

          {/* Origin Country */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <Globe size={14} className="text-sky-500" />
              {t('originCountry')}
            </label>
            <select
              value={localOriginCountry}
              onChange={(e) => handleOriginChange(e.target.value)}
              disabled={!canChangeSettings}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {ORIGIN_COUNTRIES.map(c => (
                <option key={c.name} value={c.name}>
                  {getCountryDisplayText(c.name, language)}
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
              disabled={!canChangeSettings}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-gray-900 focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {COUNTRIES.map(c => (
                <option key={c.name} value={c.name}>{getCountryDisplayText(c.name, language)}</option>
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
              {localFamilies.map((f) => (
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
                      disabled={!canChangeSettings}
                      className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-center focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Viewer Hint */}
          {isViewer && (
            <p className="text-xs text-orange-500 mt-4 p-2 bg-orange-50 rounded">
              作为查看者，您无法修改账本设置。
            </p>
          )}
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