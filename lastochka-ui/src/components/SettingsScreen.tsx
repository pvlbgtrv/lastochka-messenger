import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/auth'
import { changePassword, updateProfile } from '@/lib/email-auth'
import { useUserSettingsStore, type AccentColor } from '@/store/userSettingsStore'
import BotsScreen from './BotsScreen'
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
  User,
  Palette,
  MessageSquare,
  Smartphone,
  Info,
  Key,
  Smile,
  Bot,
  Camera,
  Check,
} from 'lucide-react'
import {
  SettingsSection,
  SettingsItem,
  SettingsToggle,
  SettingsDivider,
} from './settings/SettingsItem'

type DetailView = 'none' | 'privacy' | 'security' | 'appearance' | 'accent' | 'language' | 'storage' | 'about' | 'bots'

export default function SettingsScreen() {
  const {
    view,
    goBack,
    openSettings,
    openProfile,
    darkMode,
    toggleDarkMode,
    emojiStyle,
    setEmojiStyle,
  } = useChatStore()
  const { logout, displayName, avatar, userId } = useAuthStore()
  const {
    notificationsEnabled,
    chatNotificationsEnabled,
    vibrationEnabled,
    privacyShowStatus,
    privacyAllowSearch,
    privacyReadReceipts,
    security2FA,
    language,
    accentColor,
    mediaAutoload,
    setNotificationsEnabled,
    setChatNotificationsEnabled,
    setVibrationEnabled,
    setPrivacyShowStatus,
    setPrivacyAllowSearch,
    setPrivacyReadReceipts,
    setSecurity2FA,
    setLanguage,
    setAccentColor,
    cycleMediaAutoload,
  } = useUserSettingsStore()

  const [detailView, setDetailView] = useState<DetailView>('none')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileSuccess, setProfileSuccess] = useState('')
  const [passwordBusy, setPasswordBusy] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [profileName, setProfileName] = useState(displayName || '')
  const [profileBio, setProfileBio] = useState('')
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(avatar || null)

  useEffect(() => {
    if (view !== 'settings') setDetailView('none')
  }, [view])

  useEffect(() => {
    setProfileName(displayName || '')
  }, [displayName])

  useEffect(() => {
    setAvatarDataUrl(avatar || null)
  }, [avatar])

  const memoryUsageText = useMemo(() => {
    let bytes = 0
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (!key) continue
      const value = localStorage.getItem(key) || ''
      bytes += key.length + value.length
    }
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(2)} МБ (local cache)`
  }, [darkMode, emojiStyle, accentColor, language, mediaAutoload])

  const accentLabel = accentColor === 'indigo'
    ? 'Индиго'
    : accentColor === 'emerald'
      ? 'Изумруд'
      : 'Роза'
  const languageLabel = language === 'ru' ? 'Русский' : 'English'
  const mediaAutoloadLabel = mediaAutoload === 'all'
    ? 'Wi‑Fi и мобильные данные'
    : mediaAutoload === 'wifi'
      ? 'Только Wi‑Fi'
      : 'Выключено'

  const handleBack = () => {
    if (detailView !== 'none') {
      setDetailView('none')
      return
    }
    goBack()
  }

  const onPickAvatar = () => {
    fileInputRef.current?.click()
  }

  const onAvatarSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      setAvatarDataUrl(result)
    }
    reader.readAsDataURL(file)
  }

  const saveProfile = async () => {
    const safeName = profileName.trim()
    if (!safeName) {
      setProfileError('Имя не может быть пустым')
      return
    }
    setSavingProfile(true)
    setProfileError('')
    setProfileSuccess('')
    const result = await updateProfile({
      displayName: safeName,
      avatar: avatarDataUrl || undefined,
      bio: profileBio.trim() || undefined,
    })
    setSavingProfile(false)
    if (!result.success) {
      setProfileError(result.error || 'Не удалось сохранить профиль')
      return
    }
    useAuthStore.setState({ displayName: safeName, avatar: avatarDataUrl })
    setProfileSuccess('Профиль сохранён')
  }

  const submitPasswordChange = async () => {
    if (!oldPassword || !newPassword) {
      setPasswordError('Заполните текущий и новый пароль')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('Новый пароль должен быть не менее 6 символов')
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Подтверждение пароля не совпадает')
      return
    }
    setPasswordBusy(true)
    setPasswordError('')
    setPasswordSuccess('')
    const result = await changePassword(oldPassword, newPassword)
    setPasswordBusy(false)
    if (!result.success) {
      setPasswordError(result.error || 'Не удалось сменить пароль')
      return
    }
    setOldPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordSuccess('Пароль успешно изменён')
  }

  const renderDetail = () => {
    if (view === 'profile') {
      const name = profileName.trim() || 'Пользователь'
      const initials = name
        .split(' ')
        .map((w) => w[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)

      return (
        <div className="px-4 py-5 space-y-5">
          <div className="flex flex-col items-center">
            <div className="relative">
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt={name} className="w-24 h-24 rounded-full object-cover shadow-lg" />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-brand to-purple-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                  {initials}
                </div>
              )}
              <button
                onClick={onPickAvatar}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white dark:bg-surface-dark border-2 border-brand flex items-center justify-center shadow-md"
              >
                <Camera size={14} className="text-brand" />
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={onAvatarSelected} className="hidden" />
            {userId && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 font-mono">ID: {userId}</p>}
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Имя
              <input
                value={profileName}
                onChange={(e) => setProfileName(e.target.value)}
                className="mt-1 w-full h-11 px-3 rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 outline-none"
                placeholder="Ваше имя"
              />
            </label>

            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              О себе
              <textarea
                value={profileBio}
                onChange={(e) => setProfileBio(e.target.value)}
                className="mt-1 w-full min-h-[96px] px-3 py-2 rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 outline-none"
                placeholder="Короткий статус"
              />
            </label>

            {profileError && <p className="text-sm text-red-500">{profileError}</p>}
            {profileSuccess && <p className="text-sm text-green-500">{profileSuccess}</p>}

            <button
              onClick={() => void saveProfile()}
              disabled={savingProfile}
              className="w-full h-11 rounded-xl bg-brand text-white font-semibold disabled:opacity-60"
            >
              {savingProfile ? 'Сохраняем...' : 'Сохранить профиль'}
            </button>
          </div>
        </div>
      )
    }

    if (detailView === 'privacy') {
      return (
        <div className="pt-4">
          <SettingsSection title="Конфиденциальность">
            <SettingsToggle
              icon={<User size={18} />}
              label="Показывать статус"
              description="Онлайн и время последнего визита"
              checked={privacyShowStatus}
              onChange={setPrivacyShowStatus}
            />
            <SettingsDivider />
            <SettingsToggle
              icon={<Globe size={18} />}
              label="Доступен в поиске"
              description="По логину и номеру телефона"
              checked={privacyAllowSearch}
              onChange={setPrivacyAllowSearch}
            />
            <SettingsDivider />
            <SettingsToggle
              icon={<Check size={18} />}
              label="Отчёты о прочтении"
              description="Показывать, что вы прочитали сообщение"
              checked={privacyReadReceipts}
              onChange={setPrivacyReadReceipts}
            />
          </SettingsSection>
        </div>
      )
    }

    if (detailView === 'security') {
      return (
        <div className="pt-4 px-4 space-y-4">
          <SettingsSection title="Безопасность аккаунта">
            <SettingsToggle
              icon={<Shield size={18} />}
              label="2FA"
              description="Дополнительная проверка входа"
              checked={security2FA}
              onChange={setSecurity2FA}
            />
          </SettingsSection>

          <div className="glass dark:glass-dark rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Сменить пароль</h3>
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Текущий пароль"
              className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 outline-none"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Новый пароль"
              className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 outline-none"
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Повторите новый пароль"
              className="w-full h-11 px-3 rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 outline-none"
            />
            {passwordError && <p className="text-sm text-red-500">{passwordError}</p>}
            {passwordSuccess && <p className="text-sm text-green-500">{passwordSuccess}</p>}
            <button
              onClick={() => void submitPasswordChange()}
              disabled={passwordBusy}
              className="w-full h-11 rounded-xl bg-brand text-white font-semibold disabled:opacity-60"
            >
              {passwordBusy ? 'Обновляем...' : 'Обновить пароль'}
            </button>
          </div>
        </div>
      )
    }

    if (detailView === 'accent') {
      return (
        <div className="pt-4">
          <SettingsSection title="Цвет акцента">
            {[
              { key: 'indigo', label: 'Индиго', color: 'bg-indigo-500' },
              { key: 'emerald', label: 'Изумруд', color: 'bg-emerald-500' },
              { key: 'rose', label: 'Роза', color: 'bg-rose-500' },
            ].map((item) => (
              <div key={item.key}>
                <SettingsItem
                  icon={<span className={`w-4 h-4 rounded-full ${item.color}`} />}
                  label={item.label}
                  right={accentColor === item.key ? <Check size={18} className="text-brand" /> : undefined}
                  onClick={() => setAccentColor(item.key as AccentColor)}
                />
                <SettingsDivider />
              </div>
            ))}
          </SettingsSection>
        </div>
      )
    }

    if (detailView === 'language') {
      return (
        <div className="pt-4">
          <SettingsSection title="Язык">
            <SettingsItem
              icon={<Globe size={18} />}
              label="Русский"
              right={language === 'ru' ? <Check size={18} className="text-brand" /> : undefined}
              onClick={() => setLanguage('ru')}
            />
            <SettingsDivider />
            <SettingsItem
              icon={<Globe size={18} />}
              label="English"
              right={language === 'en' ? <Check size={18} className="text-brand" /> : undefined}
              onClick={() => setLanguage('en')}
            />
          </SettingsSection>
        </div>
      )
    }

    if (detailView === 'storage') {
      return (
        <div className="pt-4">
          <SettingsSection title="Данные и память">
            <SettingsItem
              icon={<HardDrive size={18} />}
              label="Использование памяти"
              description={memoryUsageText}
            />
            <SettingsDivider />
            <SettingsItem
              icon={<Shield size={18} />}
              label="Автозагрузка медиа"
              description={mediaAutoloadLabel}
              onClick={cycleMediaAutoload}
            />
          </SettingsSection>
        </div>
      )
    }

    if (detailView === 'appearance') {
      return (
        <div className="pt-4">
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
              description={accentLabel}
              onClick={() => setDetailView('accent')}
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
              description={languageLabel}
              onClick={() => setDetailView('language')}
            />
          </SettingsSection>
        </div>
      )
    }

    if (detailView === 'about') {
      return (
        <div className="pt-4">
          <SettingsSection title="О приложении">
            <SettingsItem
              icon={<Info size={18} />}
              label="Версия"
              description="Ласточка 1.0.0 (web)"
            />
          </SettingsSection>
        </div>
      )
    }

    if (detailView === 'bots') {
      return <BotsScreen embedded />
    }

    return null
  }

  const renderMainList = () => (
    <>
      <div className="pt-2">
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
            description="Кто видит ваш профиль"
            onClick={() => setDetailView('privacy')}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Lock size={18} />}
            label="Безопасность"
            description="Пароль и 2FA"
            onClick={() => setDetailView('security')}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Bot size={18} />}
            label="Чат-боты"
            description="Создание и API ключи"
            onClick={() => setDetailView('bots')}
          />
        </SettingsSection>

        <SettingsSection title="Уведомления">
          <SettingsToggle
            icon={<Bell size={18} />}
            label="Уведомления"
            description="Push и звук"
            checked={notificationsEnabled}
            onChange={setNotificationsEnabled}
          />
          <SettingsDivider />
          <SettingsToggle
            icon={<MessageSquare size={18} />}
            label="Уведомления в чатах"
            description="Сообщения от контактов"
            checked={chatNotificationsEnabled}
            onChange={setChatNotificationsEnabled}
          />
          <SettingsDivider />
          <SettingsToggle
            icon={<Smartphone size={18} />}
            label="Вибрация"
            checked={vibrationEnabled}
            onChange={setVibrationEnabled}
          />
        </SettingsSection>

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
            description={accentLabel}
            onClick={() => setDetailView('accent')}
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
            description={languageLabel}
            onClick={() => setDetailView('language')}
          />
        </SettingsSection>

        <SettingsSection title="Данные и память">
          <SettingsItem
            icon={<HardDrive size={18} />}
            label="Использование памяти"
            description={memoryUsageText}
            onClick={() => setDetailView('storage')}
          />
          <SettingsDivider />
          <SettingsItem
            icon={<Shield size={18} />}
            label="Автозагрузка медиа"
            description={mediaAutoloadLabel}
            onClick={() => setDetailView('storage')}
          />
        </SettingsSection>

        <SettingsSection title="О приложении">
          <SettingsItem
            icon={<Info size={18} />}
            label="Версия"
            description="Ласточка 1.0.0 (web)"
          />
        </SettingsSection>

        <div className="mx-4 mb-6">
          <button
            onClick={() => void logout()}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl bg-red-50 dark:bg-red-900/20 text-red-500 font-semibold text-[15px] hover:bg-red-100 dark:hover:bg-red-900/30 active:scale-[0.98] transition-all"
          >
            <LogOut size={18} />
            Выйти
          </button>
        </div>
      </div>
    </>
  )

  const isDetailMode = view === 'profile' || detailView !== 'none'
  const headerTitle = view === 'profile'
    ? 'Профиль'
    : detailView === 'privacy'
      ? 'Конфиденциальность'
        : detailView === 'security'
          ? 'Безопасность'
          : detailView === 'appearance'
            ? 'Оформление'
          : detailView === 'accent'
            ? 'Цвет акцента'
          : detailView === 'language'
            ? 'Язык'
            : detailView === 'storage'
              ? 'Данные и память'
              : detailView === 'about'
                ? 'О приложении'
                : detailView === 'bots'
                  ? 'Чат-боты'
              : 'Настройки'

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#f8f9fc] via-[#f0f2f7] to-[#e8ecf3] dark:from-[#0a0f18] dark:via-[#0e1621] dark:to-[#111b27]">
      <header className="flex items-center gap-3 px-3 pt-12 pb-3 safe-top glass-strong dark:glass-strong-dark z-10">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target"
        >
          <ArrowLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">
          {headerTitle}
        </h1>
      </header>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        <div className="hidden lg:grid lg:grid-cols-[320px_1fr] gap-4 px-4 pt-4 pb-3">
          <aside className="glass dark:glass-dark rounded-2xl border border-black/5 dark:border-white/10 p-3 h-fit">
            <div className="space-y-1">
              <button
                onClick={openProfile}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  view === 'profile'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Профиль
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('privacy')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'privacy'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Конфиденциальность
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('security')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'security'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Безопасность
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('appearance')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'appearance'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Оформление
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('accent')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'accent'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Цвет акцента
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('language')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'language'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Язык
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('storage')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'storage'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Данные и память
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('about')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'about'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                О приложении
              </button>
              <button
                onClick={() => {
                  openSettings()
                  setDetailView('bots')
                }}
                className={`w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  detailView === 'bots'
                    ? 'bg-brand/15 text-brand'
                    : 'hover:bg-black/5 dark:hover:bg-white/5 text-gray-700 dark:text-gray-300'
                }`}
              >
                Чат-боты
              </button>
              <button
                onClick={() => void logout()}
                className="w-full flex items-center justify-start text-left px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                Выйти
              </button>
            </div>
          </aside>

          <section className="glass dark:glass-dark rounded-2xl border border-black/5 dark:border-white/10 overflow-y-auto">
            {isDetailMode ? renderDetail() : renderMainList()}
          </section>
        </div>

        <div className="lg:hidden w-full">
          {isDetailMode ? renderDetail() : renderMainList()}
        </div>

        <div className="safe-bottom" />
      </div>
    </div>
  )
}
