import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import {
  User, Camera, Save, X, Eye, EyeOff, Lock,
  Moon, Sun, Volume2, VolumeX, Bell, BellOff,
  LogOut, Shield, Info, Smartphone
} from 'lucide-react'
import { updateProfile, changePassword } from '@/lib/email-auth'
import { getTinode, getAvatarUrl } from '@/lib/tinode-client'

interface SettingsProps {
  onClose?: () => void
}

export default function SettingsScreen({ onClose }: SettingsProps) {
  const { userId, displayName: authDisplayName, avatar: storedAvatar, logout } = useAuthStore()
  const { darkMode, toggleDarkMode, playSound, toggleSound } = useChatStore()

  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'settings'>('settings')

  // Profile state
  const [avatar, setAvatar] = useState(storedAvatar || '')
  const [name, setName] = useState('')
  const [bio, setBio] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  // Security state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Common state
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Загрузка текущих данных из me-топика
  useEffect(() => {
    if (authDisplayName) setName(authDisplayName)
    const me = getTinode().getMeTopic()
    const pub = (me as any).public
    if (pub) {
      if (pub.fn) setName(pub.fn)
      if (pub.note) setBio(pub.note)
      const url = getAvatarUrl(pub.photo)
      if (url) setAvatar(url)
    }
  }, [])

  // ─── Profile actions ──────────────────────────────────────────

  const handleSaveProfile = async () => {
    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await updateProfile({
        displayName: name.trim() || undefined,
        avatar: avatar || undefined,
        bio: bio.trim() || undefined,
      })

      if (result.success) {
        setSuccess('Профиль обновлён')
        setIsEditing(false)
        useAuthStore.setState({ displayName: name.trim() || authDisplayName, avatar: avatar || null })
      } else {
        setError(result.error || 'Ошибка обновления профиля')
      }
    } catch {
      setError('Ошибка обновления профиля')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Security actions ─────────────────────────────────────────

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают')
      return
    }

    setIsLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await changePassword(currentPassword, newPassword)
      if (result.success) {
        setSuccess('Пароль изменён')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(result.error || 'Ошибка смены пароля')
      }
    } catch {
      setError('Ошибка смены пароля')
    } finally {
      setIsLoading(false)
    }
  }

  // ─── Avatar upload ────────────────────────────────────────────

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setError('Размер файла не более 5MB')
      return
    }
    if (!file.type.startsWith('image/')) {
      setError('Загрузите изображение')
      return
    }
    const reader = new FileReader()
    reader.onload = (event) => setAvatar(event.target?.result as string)
    reader.readAsDataURL(file)
  }

  // ─── Logout ───────────────────────────────────────────────────

  const handleLogout = async () => {
    if (confirm('Выйти из аккаунта?')) {
      await logout()
    }
  }

  const displayName = name || authDisplayName || 'Пользователь'
  const inputClass =
    'w-full h-12 px-4 rounded-xl bg-gray-100 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand transition-all'
  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2'

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Настройки</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800">
        {[
          { id: 'settings' as const, label: 'Общие', icon: Smartphone },
          { id: 'profile' as const, label: 'Профиль', icon: User },
          { id: 'security' as const, label: 'Безопасность', icon: Lock },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
              activeTab === tab.id
                ? 'text-brand'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              <tab.icon size={16} />
              {tab.label}
            </div>
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* ═══════════ SETTINGS TAB ═══════════ */}
        {activeTab === 'settings' && (
          <>
            {/* Appearance */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Внешний вид
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    {darkMode ? <Moon size={20} className="text-brand" /> : <Sun size={20} className="text-gray-400" />}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Тёмная тема</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Переключить оформление</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleDarkMode}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      darkMode ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        darkMode ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* Notifications */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                Уведомления
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex items-center gap-3">
                    {playSound ? <Volume2 size={20} className="text-brand" /> : <VolumeX size={20} className="text-gray-400" />}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">Звук уведомлений</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Звуковой сигнал при новых сообщениях</p>
                    </div>
                  </div>
                  <button
                    onClick={toggleSound}
                    className={`w-12 h-7 rounded-full transition-colors relative ${
                      playSound ? 'bg-brand' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <div
                      className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                        playSound ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* About */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
                О приложении
              </h3>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold">
                    Л
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Ласточка</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Версия 1.0.0 (Alpha)</p>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                  Российский суверенный мессенджер с открытым кодом.
                  Аналог Telegram: личные сообщения, группы, каналы, звонки.
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <Shield size={14} />
                  <span>GPL v3 · Данные хранятся в РФ</span>
                </div>
              </div>
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors font-medium"
            >
              <LogOut size={20} />
              Выйти из аккаунта
            </button>
          </>
        )}

        {/* ═══════════ PROFILE TAB ═══════════ */}
        {activeTab === 'profile' && (
          <>
            {/* Avatar */}
            <div className="flex flex-col items-center">
              <div className="relative w-32 h-32 mb-4">
                <div className="w-full h-full rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white text-4xl font-bold overflow-hidden">
                  {avatar ? (
                    <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  ) : (
                    displayName.charAt(0).toUpperCase()
                  )}
                </div>
                <label className="absolute bottom-0 right-0 w-10 h-10 bg-brand hover:bg-brand-dark rounded-full flex items-center justify-center cursor-pointer transition-colors shadow-lg">
                  <Camera size={20} className="text-white" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Нажмите, чтобы загрузить фото</p>
            </div>

            {/* Name */}
            <div>
              <label className={labelClass}>Отображаемое имя</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ваше имя"
                disabled={!isEditing || isLoading}
                className={inputClass}
              />
            </div>

            {/* Bio */}
            <div>
              <label className={labelClass}>О себе</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Расскажите о себе"
                rows={4}
                disabled={!isEditing || isLoading}
                className={`${inputClass} resize-none`}
              />
            </div>

            {/* Buttons */}
            {isEditing ? (
              <div className="flex gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={isLoading}
                  className="flex-1 flex items-center justify-center gap-2 h-12 bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-medium rounded-xl transition-colors"
                >
                  <Save size={20} />
                  {isLoading ? 'Сохранение...' : 'Сохранить'}
                </button>
                <button
                  onClick={() => { setIsEditing(false); setName(authDisplayName || '') }}
                  className="flex-1 flex items-center justify-center gap-2 h-12 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-xl transition-colors"
                >
                  <X size={20} />
                  Отмена
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="w-full h-12 bg-brand hover:bg-brand-dark text-white font-medium rounded-xl transition-colors"
              >
                Редактировать профиль
              </button>
            )}
          </>
        )}

        {/* ═══════════ SECURITY TAB ═══════════ */}
        {activeTab === 'security' && (
          <>
            {/* Current password */}
            <div>
              <label className={labelClass}>Текущий пароль</label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Введите текущий пароль"
                  disabled={isLoading}
                  className={inputClass}
                />
                <button
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showCurrentPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* New password */}
            <div>
              <label className={labelClass}>Новый пароль</label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  disabled={isLoading}
                  className={inputClass}
                />
                <button
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showNewPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Confirm password */}
            <div>
              <label className={labelClass}>Подтверждение пароля</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль"
                  disabled={isLoading}
                  className={inputClass}
                />
                <button
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Messages */}
            {error && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleChangePassword}
              disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
              className="w-full h-12 bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-colors"
            >
              {isLoading ? 'Изменение...' : 'Изменить пароль'}
            </button>

            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Совет:</strong> Используйте надёжный пароль из букв, цифр и специальных символов.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
