import React from 'react';
import { Cloud, CloudOff, RefreshCw, Check, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useCloudSync } from '../src/contexts/CloudSyncContext';

interface SyncIndicatorProps {
  compact?: boolean;
  onSyncClick?: () => void;
}

export const SyncIndicator: React.FC<SyncIndicatorProps> = ({
  compact = false,
  onSyncClick
}) => {
  const { t } = useTranslation();
  const {
    isOnline,
    syncStatus,
    lastSyncAt,
    pendingChanges,
    isCloudEnabled,
    syncNow
  } = useCloudSync();

  const handleSync = async () => {
    if (onSyncClick) {
      onSyncClick();
    } else {
      await syncNow();
    }
  };

  // If cloud sync is not enabled, show enable prompt
  if (!isCloudEnabled) {
    if (compact) return null;
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm">
        <CloudOff size={16} />
        <span>{t('cloudSyncDisabled')}</span>
      </div>
    );
  }

  // Offline status
  if (!isOnline) {
    return (
      <div className={`flex items-center gap-2 ${compact ? 'text-gray-400' : 'text-gray-500 text-sm'}`}>
        <CloudOff size={compact ? 14 : 16} />
        {!compact && <span>{t('offline')}</span>}
        {pendingChanges > 0 && (
          <span className="bg-orange-100 text-orange-600 text-xs px-2 py-0.5 rounded-full">
            {pendingChanges}
          </span>
        )}
      </div>
    );
  }

  // Get status icon and color based on sync status
  const getStatusDisplay = () => {
    switch (syncStatus) {
      case 'syncing':
        return {
          icon: <RefreshCw size={compact ? 14 : 16} className="animate-spin" />,
          color: 'text-blue-500',
          bg: 'bg-blue-50',
          text: t('syncing')
        };
      case 'synced':
        return {
          icon: <Check size={compact ? 14 : 16} />,
          color: 'text-green-500',
          bg: 'bg-green-50',
          text: t('synced')
        };
      case 'error':
        return {
          icon: <AlertCircle size={compact ? 14 : 16} />,
          color: 'text-red-500',
          bg: 'bg-red-50',
          text: t('syncStatus')
        };
      default:
        return {
          icon: <Cloud size={compact ? 14 : 16} />,
          color: 'text-gray-400',
          bg: 'bg-gray-50',
          text: t('syncStatus')
        };
    }
  };

  const status = getStatusDisplay();

  // Format last sync time
  const formatLastSync = () => {
    if (!lastSyncAt) return null;
    const now = new Date();
    const diff = now.getTime() - lastSyncAt.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return t('synced');
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    return lastSyncAt.toLocaleDateString();
  };

  // Compact version for header
  if (compact) {
    return (
      <button
        onClick={handleSync}
        disabled={syncStatus === 'syncing'}
        className={`flex items-center justify-center p-2 hover:bg-white/20 rounded-xl transition-all ${
          syncStatus === 'syncing' ? '' : 'cursor-pointer'
        } ${status.color}`}
        title={`${t('syncStatus')}: ${status.text}${lastSyncAt ? ` - ${t('lastSynced')}: ${formatLastSync()}` : ''}`}
      >
        {status.icon}
        {pendingChanges > 0 && syncStatus !== 'syncing' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 text-white text-xs rounded-full flex items-center justify-center">
            {pendingChanges > 9 ? '9+' : pendingChanges}
          </span>
        )}
      </button>
    );
  }

  // Full version
  return (
    <div className={`flex items-center justify-between p-3 ${status.bg} rounded-2xl`}>
      <div className="flex items-center gap-3">
        <div className={`p-2 ${status.bg} rounded-xl`}>
          <span className={status.color}>{status.icon}</span>
        </div>
        <div>
          <p className={`text-sm font-medium ${status.color}`}>{status.text}</p>
          {lastSyncAt && (
            <p className="text-xs text-gray-400">
              {t('lastSynced')}: {formatLastSync()}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {pendingChanges > 0 && (
          <span className="bg-orange-100 text-orange-600 text-xs px-2 py-1 rounded-full font-medium">
            {t('pendingChanges').replace('{{count}}', String(pendingChanges))}
          </span>
        )}
        <button
          onClick={handleSync}
          disabled={syncStatus === 'syncing'}
          className={`p-2 ${status.bg} ${status.color} rounded-xl hover:opacity-80 transition-opacity disabled:opacity-50`}
          title={t('syncNow')}
        >
          <RefreshCw size={16} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
        </button>
      </div>
    </div>
  );
};