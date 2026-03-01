import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../contexts/AuthContext';

interface LoginFormProps {
  onSuccess: () => void;
  onSwitchToRegister: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onSuccess, onSwitchToRegister }) => {
  const { t } = useTranslation();
  const { signIn, signInAnonymously, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setLocalError(t('invalidEmail'));
      return false;
    }
    if (!password.trim()) {
      setLocalError(t('password'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (!validateForm()) return;

    try {
      await signIn(email, password);
      onSuccess();
    } catch {
      setLocalError(t('loginFailed'));
    }
  };

  const handleAnonymousLogin = async () => {
    clearError();
    setLocalError(null);
    try {
      await signInAnonymously();
      onSuccess();
    } catch {
      setLocalError(t('loginFailed'));
    }
  };

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {displayError && (
        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm">
          {displayError}
        </div>
      )}

      {/* Email Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('email')}
        </label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('emailPlaceholder')}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

      {/* Password Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('password')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('passwordPlaceholder')}
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Forgot Password Link */}
      <div className="text-right">
        <button
          type="button"
          className="text-sm text-sky-600 hover:text-sky-700 font-medium"
        >
          {t('forgotPassword')}
        </button>
      </div>

      {/* Login Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Lock size={18} />
            {t('login')}
          </>
        )}
      </button>

      {/* Divider */}
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-4 bg-white text-gray-500">{t('continueAsGuest')}</span>
        </div>
      </div>

      {/* Anonymous Login Button */}
      <button
        type="button"
        onClick={handleAnonymousLogin}
        disabled={loading}
        className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold text-sm hover:bg-gray-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <User size={18} />
        {t('continueAsGuest')}
      </button>

      {/* Switch to Register */}
      <p className="text-center text-sm text-gray-600 mt-4">
        {t('noAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="text-sky-600 hover:text-sky-700 font-semibold"
        >
          {t('register')}
        </button>
      </p>
    </form>
  );
};