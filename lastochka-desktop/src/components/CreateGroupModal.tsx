import { useMemo, useState } from 'react'
import { X, Users } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'

export default function CreateGroupModal() {
  const {
    showCreateGroupModal,
    chats,
    closeCreateGroupModal,
    createGroup,
  } = useChatStore()
  const [groupName, setGroupName] = useState('')
  const [selectedMembers, setSelectedMembers] = useState<string[]>([])
  const [memberSearch, setMemberSearch] = useState('')

  const users = useMemo(() => {
    const candidates = chats.filter((chat) => !chat.isGroup)
    const query = memberSearch.trim().toLowerCase()
    if (!query) return candidates
    const phoneDigits = query.replace(/\D/g, '')
    return candidates.filter((chat) => {
      const byText = [chat.name, chat.login, chat.id]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
      const byPhone = phoneDigits.length > 0 && !!chat.phone && chat.phone.replace(/\D/g, '').includes(phoneDigits)
      return byText || byPhone
    })
  }, [chats, memberSearch])

  if (!showCreateGroupModal) return null

  const toggleMember = (userId: string) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    )
  }

  const handleCreate = () => {
    if (!groupName.trim() || selectedMembers.length === 0) return
    createGroup(groupName, selectedMembers)
    setGroupName('')
    setSelectedMembers([])
    setMemberSearch('')
  }

  const handleClose = () => {
    closeCreateGroupModal()
    setGroupName('')
    setSelectedMembers([])
    setMemberSearch('')
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={handleClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-dark border border-gray-200/60 dark:border-gray-700/40 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200/60 dark:border-gray-700/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand/15 text-brand flex items-center justify-center">
              <Users size={18} />
            </div>
            <h3 className="text-[16px] font-semibold text-gray-900 dark:text-gray-100">Новая группа</h3>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-all"
          >
            <X size={18} className="text-gray-500" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <div>
            <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-2">
              Название группы
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              placeholder="Например: Проект Ласточка"
              className="w-full h-11 rounded-xl px-3.5 bg-gray-50 dark:bg-surface-variant-dark border border-gray-200/70 dark:border-gray-600/40 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand/25"
            />
          </div>

          <div>
            <label className="block text-[13px] font-medium text-gray-600 dark:text-gray-300 mb-2">
              Участники ({selectedMembers.length})
            </label>
            <input
              type="text"
              value={memberSearch}
              onChange={(event) => setMemberSearch(event.target.value)}
              placeholder="Поиск по имени, логину, телефону"
              className="w-full h-10 rounded-xl px-3 mb-2.5 bg-gray-50 dark:bg-surface-variant-dark border border-gray-200/70 dark:border-gray-600/40 text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand/25"
            />
            <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
              {users.length === 0 && (
                <div className="text-sm text-gray-500 dark:text-gray-400 px-1 py-2">
                  Пользователи не найдены
                </div>
              )}
              {users.map((user) => (
                <label
                  key={user.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-surface-variant-dark hover:bg-gray-100 dark:hover:bg-surface-dark transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedMembers.includes(user.id)}
                    onChange={() => toggleMember(user.id)}
                    className="w-4 h-4 accent-brand"
                  />
                  <span className="text-sm text-gray-900 dark:text-gray-100">{user.name}</span>
                  {user.login && (
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">@{user.login}</span>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 flex items-center justify-end gap-2.5">
          <button
            onClick={handleClose}
            className="h-10 px-4 rounded-xl bg-gray-100 dark:bg-surface-variant-dark text-gray-700 dark:text-gray-300 font-medium"
          >
            Отмена
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedMembers.length === 0}
            className="h-10 px-4 rounded-xl bg-brand text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Создать группу
          </button>
        </div>
      </div>
    </div>
  )
}
