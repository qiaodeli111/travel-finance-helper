import React, { useState, useEffect } from 'react';
import { Cloud, Merge, FilePlus, AlertTriangle, Check, Loader2, X } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { useCloudSync } from '../src/contexts/CloudSyncContext';
import { createLedger, addMember, getLedger } from '../services/firestoreService';
import { AppState } from '../types';

interface GuestLedger {
  id: string;
  name: string;
  data: AppState;
  createdAt: number;
}

interface GuestLedgerSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  guestLedgers: GuestLedger[];
  onSyncComplete: () => void;
}

interface SyncDecision {
  ledgerId: string;
  action: 'merge' | 'new' | 'skip';
  newName?: string;
}

export const GuestLedgerSyncModal: React.FC<GuestLedgerSyncModalProps> = ({
  isOpen,
  onClose,
  guestLedgers,
  onSyncComplete,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { cloudLedgers, isCloudEnabled } = useCloudSync();
  const [syncDecisions, setSyncDecisions] = useState<Record<string, SyncDecision>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<string>('');
  const [conflictLedgers, setConflictLedgers] = useState<GuestLedger[]>([]);

  // Check for conflicts when modal opens
  useEffect(() => {
    if (isOpen && guestLedgers.length > 0) {
      const conflicts: GuestLedger[] = [];
      guestLedgers.forEach(gl => {
        const hasConflict = cloudLedgers.some(cl => cl.name === gl.name);
        if (hasConflict) {
          conflicts.push(gl);
        }
      });
      setConflictLedgers(conflicts);

      // Initialize default decisions
      const decisions: Record<string, SyncDecision> = {};
      guestLedgers.forEach(gl => {
        const hasConflict = cloudLedgers.some(cl => cl.name === gl.name);
        decisions[gl.id] = {
          ledgerId: gl.id,
          action: hasConflict ? 'new' : 'new', // Default to creating new
          newName: hasConflict ? generateNewName(gl.name) : gl.name,
        };
      });
      setSyncDecisions(decisions);
    }
  }, [isOpen, guestLedgers, cloudLedgers]);

  const generateNewName = (baseName: string): string => {
    const now = new Date();
    const timestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    return `${baseName}-${timestamp}`;
  };

  const handleDecisionChange = (ledgerId: string, action: 'merge' | 'new' | 'skip') => {
    setSyncDecisions(prev => {
      const gl = guestLedgers.find(g => g.id === ledgerId);
      return {
        ...prev,
        [ledgerId]: {
          ledgerId,
          action,
          newName: action === 'new' ? generateNewName(gl?.name || 'Ledger') : prev[ledgerId]?.newName,
        },
      };
    });
  };

  const handleSync = async () => {
    if (!user || !isCloudEnabled) return;

    setSyncing(true);
    setSyncProgress(t('syncStarting', 'Starting sync...'));

    try {
      for (const gl of guestLedgers) {
        const decision = syncDecisions[gl.id];
        if (decision.action === 'skip') continue;

        setSyncProgress(t('syncingLedger', { name: gl.name, defaultValue: `Syncing "${gl.name}"...` }));

        if (decision.action === 'new') {
          // Create new ledger with potentially renamed name
          const ledgerName = decision.newName || generateNewName(gl.name);

          await createLedger({
            id: gl.id,
            name: ledgerName,
            ownerId: user.uid,
            destination: gl.data.destination,
            currencyCode: gl.data.currencyCode,
            baseCurrency: gl.data.baseCurrency,
            exchangeRate: gl.data.exchangeRate,
            families: gl.data.families,
            originCountry: gl.data.originCountry,
          } as any);

          // Add user as member
          const memberId = `${gl.id}_${user.uid}`;
          await addMember(gl.id, {
            id: memberId,
            ledgerId: gl.id,
            userId: user.uid,
            role: 'owner',
            displayName: user.displayName || user.email?.split('@')[0] || 'User',
          } as any);

          // Upload expenses
          for (const expense of gl.data.expenses) {
            const { createExpense } = await import('../services/firestoreService');
            await createExpense(gl.id, {
              id: expense.id,
              ledgerId: gl.id,
              createdBy: user.uid,
              createdByDisplayName: user.displayName || 'User',
              date: expense.date,
              description: expense.description,
              amount: expense.amount,
              category: expense.category,
              payerId: expense.payerId,
              sharedWithFamilyIds: expense.sharedWithFamilyIds || [],
            } as any);
          }
        } else if (decision.action === 'merge') {
          // Find the existing ledger with the same name
          const existingLedger = cloudLedgers.find(cl => cl.name === gl.name);
          if (existingLedger) {
            // Add expenses to existing ledger
            for (const expense of gl.data.expenses) {
              const { createExpense } = await import('../services/firestoreService');
              await createExpense(existingLedger.id, {
                id: expense.id,
                ledgerId: existingLedger.id,
                createdBy: user.uid,
                createdByDisplayName: user.displayName || 'User',
                date: expense.date,
                description: expense.description,
                amount: expense.amount,
                category: expense.category,
                payerId: expense.payerId,
                sharedWithFamilyIds: expense.sharedWithFamilyIds || [],
              } as any);
            }
          }
        }
      }

      setSyncProgress(t('syncComplete', 'Sync complete!'));
      setTimeout(() => {
        onSyncComplete();
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Sync failed:', err);
      setSyncProgress(t('syncFailed', 'Sync failed. Please try again.'));
    } finally {
      setSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Cloud size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('syncGuestLedgers', 'Sync Guest Ledgers')}</h2>
              <p className="text-sky-100 text-xs">{guestLedgers.length} {t('ledgersToSync', 'ledgers to sync')}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {conflictLedgers.length > 0 && (
            <div className="mb-4 p-3 bg-orange-50 rounded-xl flex items-start gap-2">
              <AlertTriangle size={20} className="text-orange-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-700">
                {t('conflictWarning', 'Some ledgers have the same name as your cloud ledgers. Choose how to handle them.')}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {guestLedgers.map(gl => {
              const hasConflict = conflictLedgers.some(c => c.id === gl.id);
              const decision = syncDecisions[gl.id];

              return (
                <div key={gl.id} className={`p-4 rounded-xl border ${hasConflict ? 'border-orange-200 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-medium text-gray-800">{gl.name}</h3>
                      <p className="text-xs text-gray-500">
                        {gl.data.expenses.length} {t('expenses', 'expenses')} • {t('created', 'Created')}: {new Date(gl.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    {hasConflict && (
                      <span className="px-2 py-1 bg-orange-100 text-orange-600 text-xs rounded-lg">
                        {t('nameConflict', 'Name conflict')}
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name={`decision-${gl.id}`}
                        checked={decision?.action === 'new'}
                        onChange={() => handleDecisionChange(gl.id, 'new')}
                        className="text-sky-500"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <FilePlus size={14} />
                          {t('uploadAsNew', 'Upload as new ledger')}
                        </span>
                        {hasConflict && decision?.newName && (
                          <span className="text-xs text-gray-500 block ml-5">
                            → {decision.newName}
                          </span>
                        )}
                      </div>
                    </label>

                    {hasConflict && (
                      <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer">
                        <input
                          type="radio"
                          name={`decision-${gl.id}`}
                          checked={decision?.action === 'merge'}
                          onChange={() => handleDecisionChange(gl.id, 'merge')}
                          className="text-sky-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
                          <Merge size={14} />
                          {t('mergeExpenses', 'Merge expenses into existing ledger')}
                        </span>
                      </label>
                    )}

                    <label className="flex items-center gap-2 p-2 rounded-lg hover:bg-white cursor-pointer">
                      <input
                        type="radio"
                        name={`decision-${gl.id}`}
                        checked={decision?.action === 'skip'}
                        onChange={() => handleDecisionChange(gl.id, 'skip')}
                        className="text-sky-500"
                      />
                      <span className="text-sm font-medium text-gray-500 flex items-center gap-1">
                        <X size={14} />
                        {t('skipSync', 'Skip (discard)')}
                      </span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Progress */}
        {syncing && (
          <div className="px-4 pb-2">
            <div className="flex items-center gap-2 p-3 bg-sky-50 rounded-xl">
              <Loader2 size={18} className="animate-spin text-sky-500" />
              <span className="text-sm text-sky-700">{syncProgress}</span>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={syncing}
            className="px-4 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors disabled:opacity-50"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-6 py-2 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl shadow-lg hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
          >
            {syncing ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('syncing', 'Syncing...')}
              </>
            ) : (
              <>
                <Cloud size={18} />
                {t('syncToCloud', 'Sync to Cloud')}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};