import React, { useState, useEffect } from 'react';
import { X, BookOpen, MapPin, Users, Globe, Cloud, CloudOff, Star, StarOff, Trash2, Loader2, Archive, ArchiveRestore, User, AlertTriangle, Download, RefreshCw } from 'lucide-react';
import { useTranslation, getCountryDisplayText } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { useCloudSync } from '../src/contexts/CloudSyncContext';
import { getLedger } from '../services/firestoreService';
import { AppState, Family } from '../types';

interface LedgerMeta {
  id: string;
  name: string;
  lastAccess: number;
  isDefault?: boolean;
  isCloudSynced?: boolean;
  ownerId?: string;
  ownerDisplayName?: string;
  isLocal?: boolean;
  status?: 'active' | 'archived';
  members?: string[];
  isFromCloud?: boolean;  // New: indicates this ledger is from cloud but not yet downloaded
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
  onArchive?: (id: string) => void;
  onUnarchive?: (id: string) => void;
  onDownloadCloudLedger?: (ledgerId: string) => Promise<void>;  // New: callback for downloading cloud ledger
}

export const LedgerManagePanel: React.FC<LedgerManagePanelProps> = ({
  isOpen,
  onClose,
  ledgers,
  activeId,
  onSelect,
  onSetDefault,
  onDelete,
  onRefresh,
  onArchive,
  onUnarchive,
  onDownloadCloudLedger
}) => {
  const { t, language } = useTranslation();
  const { user } = useAuth();
  const { isCloudEnabled, cloudLedgers, isLoadingLedgers, refreshCloudLedgers, loadFromCloud } = useCloudSync();
  const [selectedLedger, setSelectedLedger] = useState<LedgerMeta | null>(null);
  const [ledgerData, setLedgerData] = useState<AppState | null>(null);
  const [loading, setLoading] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Load ledger data from cloud when selected
  useEffect(() => {
    if (selectedLedger) {
      const loadLedgerData = async () => {
        setLoading(true);
        try {
          const cloudLedger = await getLedger(selectedLedger.id);
          if (cloudLedger) {
            // Convert to AppState format
            const appState: AppState = {
              ledgerName: cloudLedger.name,
              expenses: [], // Expenses are loaded separately via subscription
              exchangeRate: cloudLedger.exchangeRate,
              families: cloudLedger.families,
              currencyCode: cloudLedger.currencyCode,
              destination: cloudLedger.destination,
              baseCurrency: cloudLedger.baseCurrency,
              originCountry: cloudLedger.originCountry || '中国',
              lastUpdated: Date.now(),
            };
            setLedgerData(appState);
          }
        } catch (err) {
          console.error('Failed to load ledger from cloud:', err);
        } finally {
          setLoading(false);
        }
      };
      loadLedgerData();
    }
  }, [selectedLedger]);

  // Pure remote: ledgers come directly from props (which are from cloudLedgers)
  const displayLedgers = ledgers;

  // Handle select ledger - pure remote, just select it
  const handleSelectLedger = (ledger: LedgerMeta) => {
    setSelectedLedger(ledger);
  };

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const isOwner = (ledger: LedgerMeta) => {
    return ledger.ownerId && user?.uid === ledger.ownerId;
  };

  const handleArchive = async () => {
    if (!selectedLedger || !onArchive) return;
    setArchiving(true);
    try {
      onArchive(selectedLedger.id);
      setSelectedLedger({
        ...selectedLedger,
        status: 'archived'
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleUnarchive = async () => {
    if (!selectedLedger || !onUnarchive) return;
    setArchiving(true);
    try {
      onUnarchive(selectedLedger.id);
      setSelectedLedger({
        ...selectedLedger,
        status: 'active'
      });
    } finally {
      setArchiving(false);
    }
  };

  const handleDelete = () => {
    if (!selectedLedger) return;
    if (deleteConfirmName !== selectedLedger.name) return;
    onDelete(selectedLedger.id);
    setShowDeleteConfirm(false);
    setDeleteConfirmName('');
    setSelectedLedger(null);
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
              <h2 className="font-bold text-lg">{t('ledgerManage')}</h2>
              <p className="text-sky-100 text-xs">{displayLedgers.length} {t('ledgersCount', 'ledgers')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isCloudEnabled && (
              <button
                onClick={refreshCloudLedgers}
                disabled={isLoadingLedgers}
                className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                title={t('refreshCloudLedgers', 'Refresh cloud ledgers')}
              >
                <RefreshCw size={18} className={isLoadingLedgers ? 'animate-spin' : ''} />
              </button>
            )}
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex h-[60vh]">
          {/* Ledger List */}
          <div className="w-1/2 border-r border-gray-100 overflow-y-auto">
            {isLoadingLedgers && (
              <div className="p-4 text-center text-gray-500">
                <Loader2 size={24} className="animate-spin mx-auto mb-2" />
                <p className="text-sm">{t('loadingCloudLedgers', 'Loading cloud ledgers...')}</p>
              </div>
            )}
            {displayLedgers.map((ledger) => (
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
                  <Cloud size={16} className="text-sky-500" />
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {t('lastSynced')}: {formatDate(ledger.lastAccess)}
                </p>
              </div>
            ))}
            {displayLedgers.length === 0 && !isLoadingLedgers && (
              <div className="p-8 text-center text-gray-400">
                <BookOpen size={48} className="mx-auto mb-3 opacity-50" />
                <p>{t('noLedgers', 'No ledgers yet')}</p>
              </div>
            )}
          </div>

          {/* Ledger Details */}
          <div className="w-1/2 p-4 overflow-y-auto">
            {selectedLedger ? (
              <div className="space-y-4">
                {ledgerData ? (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-lg text-gray-800">{selectedLedger.name}</h3>
                      {selectedLedger.status === 'archived' && (
                        <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs font-medium rounded-lg flex items-center gap-1">
                          <Archive size={12} />
                          {t('archived', 'Archived')}
                        </span>
                      )}
                    </div>

                {/* Owner Info */}
                    {selectedLedger.ownerDisplayName && (
                      <div className="flex items-center gap-2 p-3 bg-sky-50 rounded-xl">
                        <User size={16} className="text-sky-500" />
                        <span className="text-sm text-gray-600">
                          {t('createdBy')}: <span className="font-medium text-gray-800">{selectedLedger.ownerDisplayName}</span>
                        </span>
                      </div>
                    )}

                    {/* Cloud Status */}
                    <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                      <Cloud size={20} className="text-sky-500" />
                      <span className="text-sky-600 font-medium">{t('onlineLedger')}</span>
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
                      {selectedLedger.status !== 'archived' && (
                        <button
                          onClick={() => onSelect(selectedLedger.id)}
                          className="w-full py-2 bg-sky-500 text-white rounded-xl font-medium hover:bg-sky-600 transition-colors"
                        >
                          {t('open', 'Open')}
                        </button>
                      )}

                      <button
                        onClick={() => onSetDefault(selectedLedger.id)}
                        className="w-full py-2 bg-yellow-50 text-yellow-600 rounded-xl font-medium hover:bg-yellow-100 transition-colors flex items-center justify-center gap-2"
                      >
                        {selectedLedger.isDefault ? <StarOff size={18} /> : <Star size={18} />}
                        {selectedLedger.isDefault ? t('removeDefault', 'Remove Default') : t('setDefault', 'Set as Default')}
                      </button>

                      {/* Archive/Unarchive - Only for owners */}
                      {isOwner(selectedLedger) && onArchive && (
                        selectedLedger.status === 'archived' ? (
                          <button
                            onClick={handleUnarchive}
                            disabled={archiving}
                            className="w-full py-2 bg-green-50 text-green-600 rounded-xl font-medium hover:bg-green-100 transition-colors flex items-center justify-center gap-2"
                          >
                            {archiving ? <Loader2 size={18} className="animate-spin" /> : <ArchiveRestore size={18} />}
                            {t('unarchive', 'Unarchive')}
                          </button>
                        ) : (
                          <button
                            onClick={handleArchive}
                            disabled={archiving}
                            className="w-full py-2 bg-orange-50 text-orange-600 rounded-xl font-medium hover:bg-orange-100 transition-colors flex items-center justify-center gap-2"
                          >
                            {archiving ? <Loader2 size={18} className="animate-spin" /> : <Archive size={18} />}
                            {t('archive', 'Archive')}
                          </button>
                        )
                      )}

                      {/* Delete - Only for owners and not active ledger */}
                      {isOwner(selectedLedger) && activeId !== selectedLedger.id && (
                        showDeleteConfirm ? (
                          <div className="space-y-2 p-3 bg-red-50 rounded-xl">
                            <div className="flex items-center gap-2 text-red-600 text-sm">
                              <AlertTriangle size={16} />
                              <span>{t('deleteConfirmMessage', 'Type ledger name to confirm:')}</span>
                            </div>
                            <input
                              type="text"
                              value={deleteConfirmName}
                              onChange={(e) => setDeleteConfirmName(e.target.value)}
                              placeholder={selectedLedger.name}
                              className="w-full px-3 py-2 border border-red-200 rounded-lg text-sm"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setShowDeleteConfirm(false);
                                  setDeleteConfirmName('');
                                }}
                                className="flex-1 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium"
                              >
                                {t('cancel')}
                              </button>
                              <button
                                onClick={handleDelete}
                                disabled={deleteConfirmName !== selectedLedger.name}
                                className="flex-1 py-2 bg-red-500 text-white rounded-lg text-sm font-medium disabled:opacity-50"
                              >
                                {t('delete', 'Delete')}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowDeleteConfirm(true)}
                            className="w-full py-2 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                          >
                            <Trash2 size={18} />
                            {t('deleteLedger', 'Delete Ledger')}
                          </button>
                        )
                      )}

                      {/* Leave ledger for non-owners */}
                      {!isOwner(selectedLedger) && activeId !== selectedLedger.id && (
                        <button
                          onClick={() => onDelete(selectedLedger.id)}
                          className="w-full py-2 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                        >
                          <Trash2 size={18} />
                          {t('leaveLedger', 'Leave Ledger')}
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-400">
                    <p>{t('noData', 'No data available')}</p>
                  </div>
                )}
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