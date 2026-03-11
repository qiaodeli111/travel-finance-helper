import React, { useState, useEffect } from 'react';
import { X, User, Save, Loader2, LogIn, LogOut } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../src/contexts/AuthContext';
import { updateUserProfile } from '../src/services/authService';
import { AuthModal } from './AuthModal';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose
}) => {
  const { t } = useTranslation();
  const { user, refreshUser, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    setDisplayName(user?.displayName || '');
  }, [user?.displayName]);

  useEffect(() => {
    if (!isOpen) return;

    setError(null);
    setSuccess(false);

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

  const handleSave = async () => {
    if (!user) {
      setShowAuthModal(true);
      return;
    }

    if (!displayName.trim()) {
      setError(t('displayName') + ' is required');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateUserProfile(displayName.trim());
      if (refreshUser) {
        await refreshUser();
      }
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update profile';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (!signOut) return;

    setLoading(true);
    setError(null);

    try {
      await signOut();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sign out';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/50 max-h-[90vh] flex flex-col">
          <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <User size={20} />
              </div>
              <div>
                <h2 className="font-bold text-lg">{t('userProfile')}</h2>
                <p className="text-sky-100 text-xs">{user ? t('accountSettings') : t('login')}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-sky-500/20">
              <User size={28} />
            </div>

            {user ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('displayName')}
                  </label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder={t('displayNamePlaceholder')}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('email')}
                  </label>
                  <input
                    type="email"
                    value={user.email || ''}
                    readOnly
                    className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-xl text-gray-500"
                  />
                </div>
              </>
            ) : (
              <div className="p-4 bg-sky-50 rounded-2xl text-sm text-gray-600">
                {t('signInToSync')}
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-50 text-green-600 rounded-xl text-sm">
                {t('registerSuccess')}
              </div>
            )}
          </div>

          <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
            <button
              onClick={onClose}
              className="px-6 py-3 text-gray-600 font-semibold hover:bg-gray-200 rounded-2xl transition-colors"
            >
              {t('cancel')}
            </button>

            {user ? (
              <>
                <button
                  onClick={handleSignOut}
                  disabled={loading}
                  className="px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-semibold rounded-2xl transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
                  {t('signOut')}
                </button>
                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    <Save size={18} />
                  )}
                  {t('saveSettings')}
                </button>
              </>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-8 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-bold rounded-2xl shadow-lg shadow-sky-500/25 transition-all flex items-center gap-2"
              >
                <LogIn size={18} />
                {t('login')}
              </button>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        initialMode="login"
      />
    </>
  );
};
