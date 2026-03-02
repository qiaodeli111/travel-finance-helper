import React, { useState, useEffect } from 'react';
import { X, BookOpen, MapPin, Users, Globe, Cloud, CloudOff, Star, StarOff, Trash2, Loader2 } from 'lucide-react';
import { useTranslation, getCountryDisplayText } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { useCloudSync } from '../src/contexts/CloudSyncContext';
import { loadLedger, deleteLedger } from '../services/storageService';
import { AppState, Family } from '../types';

interface LedgerMeta {
  id: string;
  name: string;
  lastAccess: number;
  isDefault?: boolean;
  isCloudSynced?: boolean;
  ownerId?: string;
  members?: string[];
}

interface LedgerManagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  ledgers: LedgerMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export const LedgerManagePanel: React.FC<LedgerManagePanelProps> = ({
  isOpen,
  onClose,
  ledgers,
  activeId,
  onSelect,
  onSetDefault,
  onDelete,
  onRefresh
}) => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { isCloudEnabled } = useCloudSync();
  const [selectedLedger, setSelectedLedger] = useState<LedgerMeta | null>(null);
  const [ledgerData, setLedgerData] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (selectedLedger) {
      const data = loadLedger(selectedLedger.id);
      setLedgerData(data);
    }
  }, [selectedLedger]);

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl border border-white/50">
        {/* Header */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('ledgerName')} {t('members')}</h2>
              <p className="text-sky-100 text-xs">{ledgers.length} {t('persons')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex h-[60vh]">
          {/* Ledger List */}
          <div className="w-1/2 border-r border-gray-100 overflow-y-auto">
            {ledgers.map((ledger) => (
              <div
                key={ledger.id}
                onClick={() => setSelectedLedger(ledger)}
                className={`p-4 border-b border-gray-50 cursor-pointer hover:bg-sky-50 transition-colors ${
                  selectedLedger?.id === ledger.id ? 'bg-sky-50' : ''
                } ${activeId === ledger.id ? 'border-l-4 border-l-sky-500' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ledger.isDefault && (
                      <Star size={16} className="text-yellow-500 fill-yellow-500" />
                    )}
                    <span className="font-medium text-gray-800">{ledger.name}</span>
                  </div>
                  {ledger.isCloudSynced ? (
                    <Cloud size={16} className="text-sky-500" />
                  ) : (
                    <CloudOff size={16} className="text-gray-300" />
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('lastSynced')}: {formatDate(ledger.lastAccess)}
                </p>
              </div>
            ))}
          </div>

          {/* Ledger Details */}
          <div className="w-1/2 p-4 overflow-y-auto">
            {selectedLedger && ledgerData ? (
              <div className="space-y-4">
                <h3 className="font-bold text-lg text-gray-800">{selectedLedger.name}</h3>

                {/* Status */}
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                  {selectedLedger.isCloudSynced ? (
                    <>
                      <Cloud size={20} className="text-sky-500" />
                      <span className="text-sky-600 font-medium">{t('cloudSyncEnabled')}</span>
                    </>
                  ) : (
                    <>
                      <CloudOff size={20} className="text-gray-400" />
                      <span className="text-gray-500">{t('cloudSyncDisabled')}</span>
                    </>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-sky-500" />
                    <span className="text-gray-500">{t('destination')}:</span>
                    <span className="text-gray-800">{getCountryDisplayText(ledgerData.destination, language)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Globe size={16} className="text-sky-500" />
                    <span className="text-gray-500">{t('baseCurrency')}:</span>
                    <span className="text-gray-800">{ledgerData.baseCurrency}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-sky-500" />
                    <span className="text-gray-500">{t('families')}:</span>
                    <span className="text-gray-800">{ledgerData.families?.length || 0} {t('persons')}</span>
                  </div>
                </div>

                {/* Families List */}
                {ledgerData.families && ledgerData.families.length > 0 && (
                  <div className="p-3 bg-gray-50 rounded-xl">
                    <p className="text-xs font-bold text-gray-500 uppercase mb-2">{t('families')}</p>
                    <div className="space-y-1">
                      {ledgerData.families.map((f: Family) => (
                        <div key={f.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{f.name}</span>
                          <span className="text-gray-400">{f.count} {t('persons')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="space-y-2 pt-4">
                  <button
                    onClick={() => onSelect(selectedLedger.id)}
                    className="w-full py-2 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors"
                  >
                    {t('open', 'Open')}
                  </button>
                  <button
                    onClick={() => onSetDefault(selectedLedger.id)}
                    className="w-full py-2 bg-yellow-50 text-yellow-600 rounded-xl font-medium hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2"
                  >
                    {selectedLedger.isDefault ? <StarOff size={18} /> : <Star size={18} />}
                    {selectedLedger.isDefault ? t('removeDefault', 'Remove Default') : t('setDefault', 'Set as Default')}
                  </button>
                  {activeId !== selectedLedger.id && (
                    <button
                      onClick={() => onDelete(selectedLedger.id)}
                      className="w-full py-2 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 size={18} />
                      {t('removeMember')}
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <p>{t('selectLedger', 'Select a ledger to view details')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};