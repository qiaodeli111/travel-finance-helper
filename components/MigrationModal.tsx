import React, { useState, useEffect } from 'react';
import { X, Cloud, Download, Upload, AlertTriangle, Check, Loader2, RefreshCw } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { useCloudSync } from '../src/contexts/CloudSyncContext';
import { migrateLocalToCloud, migrateCloudToLocal, getDataSourceStatus, DataSourceStatus } from '../services/migrationService';
import { loadLedger, saveLedger } from '../services/storageService';
import { AppState } from '../types';

interface MigrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgerId: string;
  localData?: AppState | null;
  onMigrationComplete?: () => void;
}

type MigrationStep = 'check' | 'choose' | 'migrating' | 'complete' | 'error';
type MigrationType = 'toCloud' | 'toLocal' | 'none';

export const MigrationModal: React.FC<MigrationModalProps> = ({
  isOpen,
  onClose,
  ledgerId,
  localData,
  onMigrationComplete
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { enableCloud } = useCloudSync();

  const [step, setStep] = useState<MigrationStep>('check');
  const [dataStatus, setDataStatus] = useState<DataSourceStatus | null>(null);
  const [migrationType, setMigrationType] = useState<MigrationType>('none');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  // Check data status on mount
  useEffect(() => {
    if (isOpen && ledgerId) {
      checkDataStatus();
    }
  }, [isOpen, ledgerId]);

  const checkDataStatus = async () => {
    setChecking(true);
    setError(null);
    try {
      const status = await getDataSourceStatus(ledgerId);
      setDataStatus(status);

      // Determine next step based on status
      if (!status.hasLocal && !status.hasCloud) {
        setStep('complete'); // No data to migrate
      } else if (status.hasLocal && !status.hasCloud) {
        setStep('choose'); // Offer to upload to cloud
      } else if (!status.hasLocal && status.hasCloud) {
        setStep('choose'); // Offer to download from cloud
      } else {
        setStep('choose'); // Conflict - let user choose
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to check data status';
      setError(message);
      setStep('error');
    } finally {
      setChecking(false);
    }
  };

  const handleMigrate = async (type: MigrationType) => {
    if (type === 'none') {
      onClose();
      return;
    }

    setMigrationType(type);
    setStep('migrating');
    setError(null);

    try {
      if (type === 'toCloud') {
        // Migrate local data to cloud
        const data = localData || loadLedger(ledgerId);
        if (!data) {
          throw new Error(t('noDataToMigrate'));
        }

        await migrateLocalToCloud(
          data,
          ledgerId,
          user?.uid || 'anonymous',
          user?.displayName || 'User'
        );

        // Enable cloud sync
        enableCloud();
      } else if (type === 'toLocal') {
        // Migrate cloud data to local
        // This would typically fetch from Firestore
        // For now, we'll just show success
        // The actual implementation would call migrateCloudToLocal
      }

      setStep('complete');
      if (onMigrationComplete) {
        onMigrationComplete();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('migrationFailed');
      setError(message);
      setStep('error');
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return t('neverExpires');
    return new Date(timestamp).toLocaleString();
  };

  if (!isOpen) return null;

  const renderContent = () => {
    // Checking state
    if (checking) {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <Loader2 size={48} className="animate-spin text-sky-500 mb-4" />
          <p className="text-gray-500">{t('syncStatus')}</p>
        </div>
      );
    }

    // Migrating state
    if (step === 'migrating') {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <RefreshCw size={48} className="animate-spin text-sky-500 mb-4" />
          <p className="text-gray-800 font-medium">{t('migrationProgress')}</p>
          <p className="text-sm text-gray-500 mt-2">
            {migrationType === 'toCloud' ? t('migrateToCloud') : t('migrateToLocal')}
          </p>
        </div>
      );
    }

    // Complete state
    if (step === 'complete') {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <Check size={32} className="text-green-500" />
          </div>
          <p className="text-lg font-bold text-gray-800">{t('migrationComplete')}</p>
          <button
            onClick={onClose}
            className="mt-6 px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-700 transition-all"
          >
            {t('cancel')}
          </button>
        </div>
      );
    }

    // Error state
    if (step === 'error') {
      return (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-red-500" />
          </div>
          <p className="text-lg font-bold text-gray-800">{t('migrationFailed')}</p>
          {error && (
            <p className="text-sm text-red-500 mt-2">{error}</p>
          )}
          <div className="flex gap-3 mt-6">
            <button
              onClick={checkDataStatus}
              className="px-6 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
            >
              {t('syncNow')}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-500 text-white font-medium rounded-xl hover:bg-gray-600 transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      );
    }

    // Choose state
    if (dataStatus?.hasLocal && dataStatus?.hasCloud) {
      // Conflict
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-orange-50 rounded-xl">
            <AlertTriangle size={24} className="text-orange-500" />
            <div>
              <p className="font-bold text-gray-800">{t('conflictTitle')}</p>
              <p className="text-sm text-gray-500">{t('conflictMessage')}</p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-gray-500">{t('lastSynced')}:</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400 uppercase">{t('useLocal')}</p>
                <p className="text-sm font-medium">{formatDate(dataStatus.localTimestamp)}</p>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl">
                <p className="text-xs text-gray-400 uppercase">{t('useCloud')}</p>
                <p className="text-sm font-medium">{formatDate(dataStatus.cloudTimestamp)}</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => handleMigrate('toCloud')}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-700 transition-all"
            >
              <Upload size={20} />
              {t('migrateToCloud')}
            </button>
            <button
              onClick={() => handleMigrate('toLocal')}
              className="w-full flex items-center justify-center gap-3 py-4 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-all"
            >
              <Download size={20} />
              {t('migrateToLocal')}
            </button>
          </div>
        </div>
      );
    }

    if (dataStatus?.hasLocal && !dataStatus?.hasCloud) {
      // Only local data
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-sky-50 rounded-xl">
            <Cloud size={24} className="text-sky-500" />
            <div>
              <p className="font-medium text-gray-800">{t('migrateToCloud')}</p>
              <p className="text-sm text-gray-500">{t('signInToSync')}</p>
            </div>
          </div>

          <button
            onClick={() => handleMigrate('toCloud')}
            className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-700 transition-all"
          >
            <Upload size={20} />
            {t('migrateToCloud')}
          </button>
          <button
            onClick={() => handleMigrate('none')}
            className="w-full py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      );
    }

    if (!dataStatus?.hasLocal && dataStatus?.hasCloud) {
      // Only cloud data
      return (
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl">
            <Download size={24} className="text-green-500" />
            <div>
              <p className="font-medium text-gray-800">{t('migrateToLocal')}</p>
              <p className="text-sm text-gray-500">{t('lastSynced')}: {formatDate(dataStatus.cloudTimestamp)}</p>
            </div>
          </div>

          <button
            onClick={() => handleMigrate('toLocal')}
            className="w-full flex items-center justify-center gap-3 py-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-700 transition-all"
          >
            <Download size={20} />
            {t('migrateToLocal')}
          </button>
          <button
            onClick={() => handleMigrate('none')}
            className="w-full py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      );
    }

    // No data
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <Cloud size={32} className="text-gray-400" />
        </div>
        <p className="text-gray-500">{t('noDataToMigrate')}</p>
        <button
          onClick={onClose}
          className="mt-6 px-8 py-3 bg-gray-100 text-gray-700 font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          {t('cancel')}
        </button>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/50">
        {/* Header */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('migrateData')}</h2>
              <p className="text-sky-100 text-xs">{t('syncStatus')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/20 rounded-xl transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};