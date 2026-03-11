import React, { useState, useEffect } from 'react';
import { X, Link2, Copy, Check, QrCode, Clock, Users, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { createInvitation, getInvitationDetails, acceptInvitation, generateShareLink } from '../services/collaborationService';
import { Invitation } from '../types/firestore';

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  ledgerId?: string;
  ledgerName?: string;
  inviteCode?: string; // For joining mode
  onJoinSuccess?: (ledgerId: string, ledgerName: string) => void;
  forceJoinMode?: boolean; // Force enter join mode
}

type ExpiresOption = '24h' | '7d' | 'never';

export const InviteModal: React.FC<InviteModalProps> = ({
  isOpen,
  onClose,
  ledgerId,
  ledgerName,
  inviteCode: initialInviteCode,
  onJoinSuccess,
  forceJoinMode
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  // Mode: 'create' for creating invites, 'join' for joining via code
  const mode = (initialInviteCode || forceJoinMode) ? 'join' : 'create';

  // Create mode state
  const [expiresOption, setExpiresOption] = useState<ExpiresOption>('7d');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Join mode state
  const [joinCode, setJoinCode] = useState(initialInviteCode || '');
  const [invitationDetails, setInvitationDetails] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joinSuccess, setJoinSuccess] = useState(false);
  const [joinedLedgerName, setJoinedLedgerName] = useState('');

  // Fetch invitation details when joining
  useEffect(() => {
    if (mode === 'join' && initialInviteCode) {
      fetchInvitationDetails(initialInviteCode);
    }
  }, [mode, initialInviteCode]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setCopied(false);
      setJoinError(null);
      setJoinSuccess(false);
      if (mode === 'create' && ledgerId && ledgerName) {
        // Auto-create invitation when opening in create mode
        handleCreateInvite();
      }
    }
  }, [isOpen, mode, ledgerId, ledgerName]);

  // Close on Escape for keyboard accessibility
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const fetchInvitationDetails = async (code: string) => {
    setLoading(true);
    setJoinError(null);
    try {
      const details = await getInvitationDetails(code);
      if (!details) {
        setJoinError(t('invalidInvite'));
      } else if (details.expiresAt) {
        const expiresAt = details.expiresAt.toDate();
        if (expiresAt < new Date()) {
          setJoinError(t('invalidInvite'));
        } else {
          setInvitationDetails(details);
        }
      } else {
        setInvitationDetails(details);
      }
    } catch (err) {
      setJoinError(t('invalidInvite'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!ledgerId || !ledgerName || !user) return;

    setCreating(true);
    setError(null);

    try {
      const expiresHours = expiresOption === '24h' ? 24 : expiresOption === '7d' ? 24 * 7 : undefined;
      const newInvitation = await createInvitation(
        ledgerId,
        ledgerName,
        user.uid,
        user.displayName || 'User'
      );
      setInvitation(newInvitation);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create invitation';
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!invitation) return;

    const shareLink = generateShareLink(invitation.inviteCode);
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleJoinLedger = async () => {
    if (!user || !invitationDetails) return;

    setJoining(true);
    setJoinError(null);

    try {
      const result = await acceptInvitation(
        invitationDetails.inviteCode,
        user.uid,
        user.displayName || 'User'
      );
      setJoinSuccess(true);
      setJoinedLedgerName(result.ledgerName);
      if (onJoinSuccess) {
        onJoinSuccess(result.ledgerId, result.ledgerName);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to join ledger';
      setJoinError(message);
    } finally {
      setJoining(false);
    }
  };

  const handleLookupCode = () => {
    if (joinCode.trim()) {
      fetchInvitationDetails(joinCode.trim());
    }
  };

  if (!isOpen) return null;

  // Create mode UI
  const renderCreateMode = () => (
    <div className="space-y-6">
      {/* Invitation Link */}
      {invitation && (
        <div className="space-y-4">
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <Link2 size={14} className="text-sky-500" />
              {t('inviteLink')}
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={generateShareLink(invitation.inviteCode)}
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 truncate"
              />
              <button
                onClick={handleCopyLink}
                className={`px-4 py-3 rounded-xl transition-all flex items-center gap-2 ${
                  copied
                    ? 'bg-green-500 text-white'
                    : 'bg-sky-500 text-white hover:bg-sky-600'
                }`}
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          {/* Invite Code */}
          <div>
            <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <QrCode size={14} className="text-sky-500" />
              {t('inviteCode')}
            </label>
            <div className="flex items-center justify-center p-4 bg-gray-50 rounded-xl">
              <span className="font-mono text-2xl font-bold text-sky-600 tracking-wider">
                {invitation.inviteCode}
              </span>
            </div>
          </div>

          {/* Expiration Info */}
          {invitation.expiresAt && (
            <div className="flex items-center gap-2 text-sm text-gray-500 bg-orange-50 p-3 rounded-xl">
              <Clock size={16} className="text-orange-500" />
              <span>
                {t('inviteExpires')}: {invitation.expiresAt.toDate().toLocaleString()}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Creating State */}
      {creating && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={32} className="animate-spin text-sky-500" />
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl">
          <AlertCircle size={18} />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {copied && (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl">
          <Check size={18} />
          <span className="text-sm">{t('linkCopied')}</span>
        </div>
      )}
    </div>
  );

  // Join mode UI
  const renderJoinMode = () => (
    <div className="space-y-6">
      {/* Code Input - always show when no invitation details yet */}
      {!invitationDetails && !joinSuccess && (
        <div>
          <label className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
            <Link2 size={14} className="text-sky-500" />
            {t('inviteCode')}
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XXXX-XXXX"
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-600 uppercase tracking-wider"
            />
            <button
              onClick={handleLookupCode}
              disabled={!joinCode.trim() || loading}
              className="px-4 py-3 bg-sky-500 text-white rounded-xl hover:bg-sky-600 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : t('joinLedger')}
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={32} className="animate-spin text-sky-500" />
        </div>
      )}

      {/* Error State */}
      {joinError && (
        <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl">
          <AlertCircle size={18} />
          <span className="text-sm">{joinError}</span>
        </div>
      )}

      {/* Invitation Details */}
      {invitationDetails && !joinSuccess && (
        <div className="space-y-4">
          <div className="p-4 bg-sky-50 rounded-xl text-center">
            <Users size={32} className="mx-auto mb-2 text-sky-500" />
            <p className="text-lg font-bold text-gray-800">{invitationDetails.ledgerName}</p>
            <p className="text-sm text-gray-500">
              {t('invitedBy', { name: invitationDetails.inviterName })}
            </p>
          </div>

          <button
            onClick={handleJoinLedger}
            disabled={joining}
            className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white font-bold rounded-xl hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {joining ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                {t('joining', 'Joining...')}
              </>
            ) : (
              t('joinLedger')
            )}
          </button>
        </div>
      )}

      {/* Success State */}
      {joinSuccess && (
        <div className="text-center py-4">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-500" />
          </div>
          <p className="text-lg font-bold text-gray-800">
            {t('joinSuccess').replace('{{name}}', joinedLedgerName)}
          </p>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Users size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">
                {mode === 'create' ? t('inviteMembers') : t('joinLedger')}
              </h2>
              <p className="text-sky-100 text-xs">
                {mode === 'create' ? t('shareInvite') : t('inviteCode')}
              </p>
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
        <div className="p-6 overflow-y-auto">
          {mode === 'create' ? renderCreateMode() : renderJoinMode()}
        </div>

        {/* Footer */}
        {mode === 'create' && invitation && (
          <div className="p-4 border-t border-gray-100 bg-gray-50/50">
            <button
              onClick={onClose}
              className="w-full py-3 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};