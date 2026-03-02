import React, { useState, useEffect } from 'react';
import { X, Users, Crown, Shield, Eye, Trash2, AlertCircle, Loader2 } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { getLedgerMembers, updateMemberRole, removeMemberFromLedger, checkPermission } from '../services/collaborationService';
import { LedgerMember } from '../types/firestore';

interface MembersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  ledgerId: string;
  ownerId: string;
}

type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

export const MembersPanel: React.FC<MembersPanelProps> = ({
  isOpen,
  onClose,
  ledgerId,
  ownerId
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();

  const [members, setMembers] = useState<LedgerMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState<string | null>(null);

  // Get current user's role
  const currentMember = members.find(m => m.userId === user?.uid);
  const currentUserRole = currentMember?.role as MemberRole | undefined;
  const canManage = currentUserRole && checkPermission(currentUserRole, 'manage_members');

  // Fetch members on mount
  useEffect(() => {
    if (isOpen && ledgerId) {
      fetchMembers();
    }
  }, [isOpen, ledgerId]);

  const fetchMembers = async () => {
    setLoading(true);
    setError(null);
    try {
      const memberList = await getLedgerMembers(ledgerId);
      setMembers(memberList);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load members';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (memberId: string, userId: string, newRole: MemberRole) => {
    if (newRole === 'owner') return; // Can't change to owner

    setActionLoading(memberId);
    setError(null);

    try {
      await updateMemberRole(ledgerId, userId, newRole);
      // Update local state
      setMembers(prev => prev.map(m =>
        m.id === memberId ? { ...m, role: newRole } : m
      ));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update role';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    setActionLoading(memberId);
    setError(null);

    try {
      await removeMemberFromLedger(ledgerId, userId);
      // Update local state
      setMembers(prev => prev.filter(m => m.id !== memberId));
      setShowRemoveConfirm(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to remove member';
      setError(message);
    } finally {
      setActionLoading(null);
    }
  };

  // Get role icon and color
  const getRoleDisplay = (role: MemberRole) => {
    switch (role) {
      case 'owner':
        return {
          icon: <Crown size={14} />,
          color: 'text-yellow-600 bg-yellow-50',
          label: t('owner')
        };
      case 'admin':
        return {
          icon: <Shield size={14} />,
          color: 'text-blue-600 bg-blue-50',
          label: t('admin')
        };
      case 'viewer':
        return {
          icon: <Eye size={14} />,
          color: 'text-gray-600 bg-gray-50',
          label: t('viewer')
        };
      default:
        return {
          icon: <Users size={14} />,
          color: 'text-green-600 bg-green-50',
          label: t('memberRole')
        };
    }
  };

  // Format join date
  const formatJoinDate = (timestamp: { seconds: number; nanoseconds: number } | null) => {
    if (!timestamp) return '';
    const date = new Date(timestamp.seconds * 1000);
    return date.toLocaleDateString();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/50">
        {/* Header */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Users size={20} />
            </div>
            <div>
              <h2 className="font-bold text-lg">{t('members')}</h2>
              <p className="text-sky-100 text-xs">{members.length} {t('persons')}</p>
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
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-500 bg-red-50 p-3 rounded-xl mb-4">
              <AlertCircle size={18} />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={32} className="animate-spin text-sky-500" />
            </div>
          )}

          {/* Members List */}
          {!loading && (
            <div className="space-y-3">
              {members.map(member => {
                const roleDisplay = getRoleDisplay(member.role as MemberRole);
                const isOwner = member.userId === ownerId;
                const isCurrentUser = member.userId === user?.uid;
                const isLoading = actionLoading === member.id;

                return (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    {/* Avatar */}
                    <div className="w-10 h-10 bg-gradient-to-br from-sky-400 to-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                      {(member.displayName || 'U')[0].toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-800 truncate">
                          {member.displayName || 'Unknown'}
                        </p>
                        {isCurrentUser && (
                          <span className="text-xs text-sky-500 font-medium">
                            ({t('userProfile')})
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        {t('memberSince')}: {formatJoinDate(member.joinedAt as any)}
                      </p>
                    </div>

                    {/* Role Badge / Selector */}
                    {canManage && !isOwner ? (
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, member.userId, e.target.value as MemberRole)}
                        disabled={isLoading}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border-0 cursor-pointer ${roleDisplay.color} disabled:opacity-50`}
                      >
                        <option value="admin">{t('admin')}</option>
                        <option value="member">{t('memberRole')}</option>
                        <option value="viewer">{t('viewer')}</option>
                      </select>
                    ) : (
                      <span className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium ${roleDisplay.color}`}>
                        {roleDisplay.icon}
                        {roleDisplay.label}
                      </span>
                    )}

                    {/* Remove Button */}
                    {canManage && !isOwner && !isCurrentUser && (
                      <button
                        onClick={() => setShowRemoveConfirm(member.id)}
                        disabled={isLoading}
                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title={t('removeMember')}
                      >
                        {isLoading ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    )}

                    {/* Remove Confirmation */}
                    {showRemoveConfirm === member.id && (
                      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                              <AlertCircle size={20} className="text-red-500" />
                            </div>
                            <div>
                              <p className="font-bold text-gray-800">{t('removeMember')}</p>
                              <p className="text-sm text-gray-500">{t('removeMemberConfirm')}</p>
                            </div>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={() => setShowRemoveConfirm(null)}
                              className="flex-1 py-2 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors"
                            >
                              {t('cancel')}
                            </button>
                            <button
                              onClick={() => handleRemoveMember(member.id, member.userId)}
                              className="flex-1 py-2 bg-red-500 text-white font-medium rounded-xl hover:bg-red-600 transition-colors"
                            >
                              {t('removeMember')}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Empty State */}
          {!loading && members.length === 0 && (
            <div className="text-center py-8">
              <Users size={48} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500">{t('members')}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="w-full py-3 text-gray-600 font-semibold hover:bg-gray-200 rounded-xl transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
};