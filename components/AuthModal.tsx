import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { LoginForm } from './LoginForm';
import { RegisterForm } from './RegisterForm';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'login',
}) => {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);

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

  if (!isOpen) return null;

  const handleSwitchToLogin = () => setMode('login');
  const handleSwitchToRegister = () => setMode('register');

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl border border-white/50 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-5 flex justify-between items-center bg-gradient-to-r from-sky-500 to-blue-600 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <span className="text-xl">✈️</span>
            </div>
            <div>
              <h2 className="font-bold text-lg">
                {mode === 'login' ? t('login') : t('register')}
              </h2>
              <p className="text-sky-100 text-xs">
                {mode === 'login'
                  ? t('continueAsGuest')
                  : t('registerSuccess').replace('!', '')}
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

        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={handleSwitchToLogin}
            className={`flex-1 py-3.5 text-sm font-semibold transition-all relative ${
              mode === 'login'
                ? 'text-sky-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t('login')}
            {mode === 'login' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-blue-600" />
            )}
          </button>
          <button
            onClick={handleSwitchToRegister}
            className={`flex-1 py-3.5 text-sm font-semibold transition-all relative ${
              mode === 'register'
                ? 'text-sky-600'
                : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            {t('register')}
            {mode === 'register' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-sky-500 to-blue-600" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto">
          {mode === 'login' ? (
            <LoginForm onSuccess={onClose} onSwitchToRegister={handleSwitchToRegister} />
          ) : (
            <RegisterForm onSuccess={onClose} onSwitchToLogin={handleSwitchToLogin} />
          )}
        </div>
      </div>
    </div>
  );
};