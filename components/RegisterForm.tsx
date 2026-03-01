import React, { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, UserCircle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';
import { useAuth } from '../contexts/AuthContext';

interface RegisterFormProps {
  onSuccess: () => void;
  onSwitchToLogin: () => void;
}

export const RegisterForm: React.FC<RegisterFormProps> = ({ onSuccess, onSwitchToLogin }) => {
  const { t } = useTranslation();
  const { signUp, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const validatePassword = (pwd: string): boolean => {
    // At least 8 characters, contains letters and numbers
    const regex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;
    return regex.test(pwd);
  };

  const validateForm = (): boolean => {
    if (!email.trim()) {
      setLocalError(t('invalidEmail'));
      return false;
    }
    if (!validatePassword(password)) {
      setLocalError(t('passwordRequirements'));
      return false;
    }
    if (password !== confirmPassword) {
      setLocalError(t('passwordMismatch'));
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
      await signUp(email, password);
      onSuccess();
    } catch {
      setLocalError(t('registerFailed'));
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

      {/* Display Name Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('displayName')}
        </label>
        <div className="relative">
          <UserCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={t('displayNamePlaceholder')}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm"
          />
        </div>
      </div>

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
        <p className="mt-1 text-xs text-gray-500">{t('passwordRequirements')}</p>
      </div>

      {/* Confirm Password Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {t('confirmPassword')}
        </label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type={showConfirmPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder={t('confirmPasswordPlaceholder')}
            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-all text-sm"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      {/* Terms and Privacy */}
      <p className="text-xs text-gray-500">
        {t('termsAgreement')}
      </p>

      {/* Register Button */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-semibold text-sm hover:from-sky-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {loading ? (
          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <UserCircle size={18} />
            {t('register')}
          </>
        )}
      </button>

      {/* Switch to Login */}
      <p className="text-center text-sm text-gray-600 mt-4">
        {t('alreadyHaveAccount')}{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="text-sky-600 hover:text-sky-700 font-semibold"
        >
          {t('login')}
        </button>
      </p>
    </form>
  );
};