import React from 'react';
import { LogIn, UserPlus, Eye, AlertCircle } from 'lucide-react';
import { useTranslation } from '../i18n/useTranslation';

interface LoginPromptModalProps {
  isOpen: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onGuest: () => void;
}

export const LoginPromptModal: React.FC<LoginPromptModalProps> = ({
  isOpen,
  onLogin,
  onRegister,
  onGuest,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 text-center bg-gradient-to-r from-sky-50 to-blue-50">
          <div className="w-16 h-16 bg-gradient-to-br from-sky-400 to-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">
            {t('welcomeTitle', '欢迎使用旅行分账助手')}
          </h2>
          <p className="text-gray-500 mt-2">
            {t('loginPromptSubtitle', '登录后可多设备同步、与好友协作分账')}
          </p>
        </div>

        {/* Actions */}
        <div className="p-6 flex flex-col gap-3 overflow-y-auto">
          <button
            onClick={onLogin}
            className="w-full py-3 px-4 bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-xl font-medium flex items-center justify-center gap-2 hover:from-sky-600 hover:to-blue-700 transition-all"
          >
            <LogIn size={20} />
            {t('login', '登录')}
          </button>

          <button
            onClick={onRegister}
            className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-200 transition-all"
          >
            <UserPlus size={20} />
            {t('register', '注册新账号')}
          </button>

          <div className="relative my-2">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 text-sm text-gray-400">{t('or', '或')}</span>
            </div>
          </div>

          <button
            onClick={onGuest}
            className="w-full py-3 px-4 text-gray-600 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-all border border-gray-200"
          >
            <Eye size={20} />
            {t('guestMode', '游客模式体验')}
          </button>
        </div>

        {/* Warning */}
        <div className="px-6 pb-6">
          <div className="flex items-start gap-2 text-xs text-orange-600 bg-orange-50 rounded-lg p-3">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">{t('guestModeWarningTitle', '游客模式说明')}</p>
              <p className="mt-1 text-orange-500">
                {t('guestModeWarning', '游客模式数据仅保存在当前浏览器会话中，关闭浏览器后将丢失。建议登录账号以保存数据。')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};