import React from 'react';
import { LogIn, UserPlus, Eye } from 'lucide-react';
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
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
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
        <div className="p-6 flex flex-col gap-3">
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

          <button
            onClick={onGuest}
            className="w-full py-3 px-4 text-gray-500 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-gray-50 transition-all"
          >
            <Eye size={20} />
            {t('guestMode', '游客模式体验')}
          </button>
        </div>

        {/* Warning */}
        <div className="px-6 pb-6">
          <p className="text-xs text-center text-orange-500 bg-orange-50 rounded-lg p-3">
            {t('guestModeWarning', '游客模式数据仅保存在当前浏览器，关闭后将丢失')}
          </p>
        </div>
      </div>
    </div>
  );
};