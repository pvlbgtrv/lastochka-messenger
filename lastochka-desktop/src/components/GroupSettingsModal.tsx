import { useEffect, useMemo, useState } from 'react'
import { Copy, Link2, Plus, RefreshCcw, Users, X } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'

const PRESET_ICONS = ['👥', '💼', '🚀', '❤️', '🎯', '🔥', '📌', '🕊️']

export default function GroupSettingsModal() {
  const {
    chats,
    showGroupSettingsModal,
    activeGroupSettingsId,
    groupSettings,
    closeGroupSettingsModal,
    updateGroupSettings,
    updateGroupProfile,
    addGroupMember,
    removeGroupMember,
    regenerateGroupInviteLink,
  } = useChatStore()

  const [copied, setCopied] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupDescription, setGroupDescription] = useState('')
  const [memberSearch, setMemberSearch] = useState('')

  const group = useMemo(
    () => chats.find((chat) => chat.id === activeGroupSettingsId),
    [chats, activeGroupSettingsId],
  )

  const settings = activeGroupSettingsId ? groupSettings[activeGroupSettingsId] : undefined
  const availableUsers = useMemo(() => {
    if (!settings) return []
    const existingIds = new Set(settings.members.map((member) => member.id))
    const query = memberSearch.trim().toLowerCase()
    const phoneDigits = query.replace(/\D/g, '')
    return chats
      .filter((chat) => !chat.isGroup && !existingIds.has(chat.id))
      .filter((chat) => {
        if (!query) return true
        const byText = [chat.name, chat.login, chat.id]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(query))
        const byPhone = phoneDigits.length > 0 && !!chat.phone && chat.phone.replace(/\D/g, '').includes(phoneDigits)
        return byText || byPhone
      })
  }, [chats, settings, memberSearch])

  useEffect(() => {
    if (!group) return
    setGroupName(group.name || '')
    setGroupDescription(group.description || '')
    setMemberSearch('')
  }, [group?.id])

  if (!showGroupSettingsModal || !group || !settings) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(settings.inviteLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch {
      // no-op for unsupported clipboard API
    }
  }

  const handleSaveProfile = () => {
    if (!group) return
    void updateGroupProfile(group.id, {
      name: groupName,
      description: groupDescription,
    })
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={closeGroupSettingsModal}
    >
      <div
        className="w-full max-w-lg rounded-2xl bg-white dark:bg-surface-dark border border-gray-200/60 dark:border-gray-700/40 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/40">
          <h3 className="text-[17px] font-semibold text-gray-900 dark:text-gray-100">Настройки группы</h3>
          <button
            onClick={closeGroupSettingsModal}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-5">
          <div className="space-y-2.5">
            <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Профиль группы</p>
            <input
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Название группы"
              className="w-full h-11 rounded-xl px-3 bg-gray-50 dark:bg-surface-variant-dark border border-gray-200/60 dark:border-gray-700/40 text-sm text-gray-800 dark:text-gray-100"
            />
            <input
              type="text"
              value={groupDescription}
              onChange={(event) => setGroupDescription(event.target.value)}
              placeholder="Описание группы"
              className="w-full h-11 rounded-xl px-3 bg-gray-50 dark:bg-surface-variant-dark border border-gray-200/60 dark:border-gray-700/40 text-sm text-gray-800 dark:text-gray-100"
            />
            <button
              onClick={handleSaveProfile}
              className="h-10 px-4 rounded-xl bg-brand text-white text-sm font-medium"
            >
              Сохранить профиль
            </button>
          </div>

          <div>
            <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-2">Иконка группы</p>
            <div className="flex items-center gap-2 flex-wrap">
              {PRESET_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => updateGroupSettings(group.id, { icon })}
                  className={`w-10 h-10 rounded-xl text-xl flex items-center justify-center transition-all ${
                    settings.icon === icon
                      ? 'bg-brand/20 ring-2 ring-brand/35'
                      : 'bg-gray-100 dark:bg-surface-variant-dark hover:bg-gray-200 dark:hover:bg-surface-dark'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-2">Тип группы</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => updateGroupSettings(group.id, { groupType: 'public' })}
                className={`h-11 rounded-xl text-sm font-medium transition-all ${
                  settings.groupType === 'public'
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 dark:bg-surface-variant-dark text-gray-700 dark:text-gray-300'
                }`}
              >
                Публичная
              </button>
              <button
                onClick={() => updateGroupSettings(group.id, { groupType: 'private' })}
                className={`h-11 rounded-xl text-sm font-medium transition-all ${
                  settings.groupType === 'private'
                    ? 'bg-brand text-white'
                    : 'bg-gray-100 dark:bg-surface-variant-dark text-gray-700 dark:text-gray-300'
                }`}
              >
                Приватная
              </button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users size={14} className="text-gray-500" />
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">
                Участники ({settings.members.length})
              </p>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {settings.members.map((member) => (
                <div
                  key={member.id}
                  className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-surface-variant-dark text-sm text-gray-800 dark:text-gray-100 flex items-center justify-between gap-3"
                >
                  <span>{member.name}</span>
                  {member.id !== 'usr_me' && (
                    <button
                      onClick={() => removeGroupMember(group.id, member.id)}
                      className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-300"
                      title="Удалить участника"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-2">
              Добавить участников
            </p>
            <input
              type="text"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Поиск по имени, логину, телефону"
              className="w-full h-10 rounded-xl px-3 mb-2.5 bg-gray-50 dark:bg-surface-variant-dark border border-gray-200/60 dark:border-gray-700/40 text-sm text-gray-800 dark:text-gray-100"
            />
            <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
              {availableUsers.length === 0 && (
                <div className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-surface-variant-dark text-sm text-gray-500 dark:text-gray-400">
                  Нет пользователей для добавления
                </div>
              )}
              {availableUsers.map((user) => (
                <div
                  key={user.id}
                  className="px-3 py-2 rounded-lg bg-gray-50 dark:bg-surface-variant-dark text-sm text-gray-800 dark:text-gray-100 flex items-center justify-between gap-3"
                >
                  <div>
                    <div>{user.name}</div>
                    {user.login && <div className="text-xs text-gray-500 dark:text-gray-400">@{user.login}</div>}
                  </div>
                  <button
                    onClick={() => addGroupMember(group.id, user.id)}
                    className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-brand/15 text-brand"
                    title="Добавить участника"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-2 mb-2">
              <Link2 size={14} className="text-gray-500" />
              <p className="text-[13px] font-medium text-gray-600 dark:text-gray-300">Пригласительная ссылка</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={settings.inviteLink}
                readOnly
                className="flex-1 h-11 rounded-xl px-3 bg-gray-50 dark:bg-surface-variant-dark border border-gray-200/60 dark:border-gray-700/40 text-sm text-gray-800 dark:text-gray-100"
              />
              <button
                onClick={handleCopy}
                className="h-11 px-3 rounded-xl bg-gray-100 dark:bg-surface-variant-dark text-gray-700 dark:text-gray-200"
                title="Копировать"
              >
                <Copy size={16} />
              </button>
              <button
                onClick={() => regenerateGroupInviteLink(group.id)}
                className="h-11 px-3 rounded-xl bg-gray-100 dark:bg-surface-variant-dark text-gray-700 dark:text-gray-200"
                title="Обновить ссылку"
              >
                <RefreshCcw size={16} />
              </button>
            </div>
            {copied && <p className="text-xs text-brand mt-1.5">Ссылка скопирована</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
