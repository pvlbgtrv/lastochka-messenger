import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/auth'
import {
  ArrowLeft,
  Bell,
  Lock,
  Shield,
  Moon,
  Sun,
  Globe,
  HardDrive,
  LogOut,
  Trash2,
  User,
  Palette,
  MessageSquare,
  Smartphone,
  Info,
  Key,
  Smile,
} from 'lucide-react'
import ProfileHeader from './settings/ProfileHeader'
import {
  SettingsSection,
  SettingsItem,
  SettingsToggle,
  SettingsDivider,
} from './settings/SettingsItem'

export default function SettingsScreen() {
  const { goBack, openProfile, darkMode, toggleDarkMode, emojiStyle, setEmojiStyle } = useChatStore()
  const { logout, deleteAccount } = useAuthStore()

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Удалить аккаунт навсегда? Это действие нельзя отменить.')
    if (!confirmed) return
    await deleteAccount()
  }

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#f8f9fc] via-[#f0f2f7] to-[#e8ecf3] dark:from-[#0a0f18] dark:via-[#0e1621] dark:to-[#111b27]">
      {/* Header */}
      <header className="flex items-center gap-3 px-3 pt-12 pb-3 safe-top glass-strong dark:glass-strong-dark z-10">
        <button
          onClick={goBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target"
        >
          <ArrowLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">
          Настройки
        </h1>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Profile */}
        <ProfileHeader />

        {/* Account */}
        <SettingsSection title="Аккаунт">
          <SettingsItem
            icon={<User size={18} />}
            label="Мой профиль"
            description="Имя, фото, статус"
            onClick={openProfile}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Key size={18} />}
            label="Конфиденциальность"
            description="Кто видит мой статус"
            onClick={() => {}}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Lock size={18} />}
            label="Безопасность"
            description="Двухфакторная аутентификация"
            onClick={() => {}}
          />
        </SettingsSection>

        {/* Notifications */}
        <SettingsSection title="Уведомления">
          <SettingsToggle
            icon={<Bell size={18} />}
            label="Уведомления"
            description="Push и звук"
            checked={true}
            onChange={() => {}}
          />
          <SettingsDivider />
          <SettingsToggle
            icon={<MessageSquare size={18} />}
            label="Уведомления в чатах"
            description="Сообщения от контактов"
            checked={true}
            onChange={() => {}}
          />
          <SettingsDivider />
          <SettingsToggle
            icon={<Smartphone size={18} />}
            label="Вибрация"
            checked={true}
            onChange={() => {}}
          />
        </SettingsSection>

        {/* Appearance */}
        <SettingsSection title="Оформление">
          <SettingsItem
            icon={darkMode ? <Sun size={18} /> : <Moon size={18} />}
            label="Тёмная тема"
            right={
              <button
                role="switch"
                aria-checked={darkMode}
                onClick={(e) => {
                  e.stopPropagation()
                  toggleDarkMode()
                }}
                className={`relative w-12 h-7 rounded-full transition-colors duration-200 ${
                  darkMode ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    darkMode && 'translate-x-5'
                  }`}
                />
              </button>
            }
            onClick={toggleDarkMode}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Palette size={18} />}
            label="Цвет акцента"
            description="Индиго"
            onClick={() => {}}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Smile size={18} />}
            label="Стиль эмодзи"
            description={emojiStyle === 'classic' ? 'Классика' : 'Минимал'}
            right={
              <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-surface-variant-dark gap-0.5">
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEmojiStyle('classic')
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    emojiStyle === 'classic'
                      ? 'bg-white dark:bg-surface-dark text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Классика
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setEmojiStyle('minimal')
                  }}
                  className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                    emojiStyle === 'minimal'
                      ? 'bg-white dark:bg-surface-dark text-gray-800 dark:text-gray-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  Минимал
                </button>
              </div>
            }
            onClick={() => setEmojiStyle(emojiStyle === 'classic' ? 'minimal' : 'classic')}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Globe size={18} />}
            label="Язык"
            description="Русский"
            onClick={() => {}}
          />
        </SettingsSection>

        {/* Storage */}
        <SettingsSection title="Данные и память">
          <SettingsItem
            icon={<HardDrive size={18} />}
            label="Использование памяти"
            description="2.4 ГБ из 5 ГБ"
            onClick={() => {}}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Shield size={18} />}
            label="Автозагрузка медиа"
            description="Wi-Fi и мобильные данные"
            onClick={() => {}}
          />
        </SettingsSection>

        {/* About */}
        <SettingsSection title="О приложении">
          <SettingsItem
            icon={<Info size={18} />}
            label="Версия"
            description="Ласточка 1.0.0 (прототип)"
          />
        </SettingsSection>

        {/* Logout */}
        <div className="mx-4 mb-6">
          <button
            onClick={() => void handleDeleteAccount()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-red-100/90 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold text-[15px] hover:bg-red-200 dark:hover:bg-red-900/40 active:scale-[0.98] transition-all mb-3"
            title="Операция необратима"
          >
            <Trash2 size={18} />
            Удалить аккаунт (необратимо)
          </button>
          <button
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 font-semibold text-[15px] hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.98] transition-all"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>

        {/* Safe area */}
        <div className="safe-bottom" />
      </div>
    </div>
  )
}
