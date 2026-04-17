import { useMemo, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { Search, Bird, Settings, Users, Plus } from 'lucide-react'
import ChatItem from './ChatItem'
import CreateGroupModal from './CreateGroupModal'

interface ChatListScreenProps {
  isDesktop?: boolean
}

export default function ChatListScreen({ isDesktop = false }: ChatListScreenProps) {
  const {
    chats,
    searchQuery,
    setSearchQuery,
    setActiveChat,
    openSearch,
    openSettings,
    openCreateGroupModal,
  } = useChatStore()
  const [searchFocused, setSearchFocused] = useState(false)

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats
    const q = searchQuery.toLowerCase()
    const phoneDigits = q.replace(/\D/g, '')
    return chats.filter((chat) => {
      const byText = [chat.name, chat.login, chat.description, chat.id]
        .filter(Boolean)
        .some((field) => field!.toLowerCase().includes(q))
      const byPhone = phoneDigits.length > 0 && !!chat.phone && chat.phone.replace(/\D/g, '').includes(phoneDigits)
      return byText || byPhone
    })
  }, [chats, searchQuery])

  const pinned = filteredChats.filter((c) => c.pinned)
  const unpinned = filteredChats.filter((c) => !c.pinned)

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#f8f9fc] via-[#f0f2f7] to-[#e8ecf3] dark:from-[#0a0f18] dark:via-[#0e1621] dark:to-[#111b27]">
      {/* Header */}
      <header className={clsx(
        'flex items-center justify-between px-4 pb-3',
        isDesktop ? 'pt-6' : 'pt-12 safe-top',
      )}>
        <div>
          <h1 className="text-[28px] font-bold gradient-text">Ласточка</h1>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-0.5">
            {chats.reduce((sum, c) => sum + (c.unread || 0), 0)} непрочитанных
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreateGroupModal}
            className="w-10 h-10 rounded-full bg-white/75 dark:bg-surface-variant-dark/65 flex items-center justify-center tap-target transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
            title="Создать группу"
          >
            <span className="relative inline-flex items-center justify-center">
              <Users size={18} className="text-gray-600 dark:text-gray-300" />
              <Plus size={12} className="absolute -right-1 -bottom-1 text-gray-600 dark:text-gray-300" />
            </span>
          </button>
          <button
            onClick={openSettings}
            className="w-10 h-10 rounded-full bg-white/75 dark:bg-surface-variant-dark/65 flex items-center justify-center tap-target transition-all duration-200 hover:scale-105 active:scale-95 shadow-sm"
          >
            <Settings size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
        </div>
      </header>

      <div className="px-4 pb-2">
        <button
          onClick={openSearch}
          className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand/90 transition-all"
          title="Новый чат: поиск по логину, имени, телефону или названию группы"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <span className="relative inline-flex items-center justify-center">
                <Users size={18} />
                <Search size={12} className="absolute -right-1 -bottom-1" />
              </span>
            </span>
            <span className="text-left min-w-0">
              <span className="block text-[15px] font-semibold leading-tight">Найти пользователя или группу</span>
            </span>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pb-3">
        <div
          className={clsx(
            'flex items-center gap-2.5 px-4 py-2.5 rounded-2xl transition-all duration-200',
            searchFocused
              ? 'bg-white dark:bg-surface-dark shadow-glass'
              : 'bg-white/60 dark:bg-surface-dark/60'
          )}
        >
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            placeholder="Быстрый фильтр по списку чатов"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="flex-1 bg-transparent text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {/* Pinned */}
        {pinned.length > 0 && (
          <div className="mb-2">
            <p className="px-4 py-2 text-[12px] font-semibold text-muted uppercase tracking-wider">
              Закреплённые
            </p>
            {pinned.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                onClick={() => setActiveChat(chat.id)}
              />
            ))}
          </div>
        )}

        {/* All */}
        {unpinned.length > 0 && (
          <div>
            {pinned.length === 0 && (
              <p className="px-4 py-2 text-[12px] font-semibold text-muted uppercase tracking-wider">
                Все чаты
              </p>
            )}
            {unpinned.map((chat) => (
              <ChatItem
                key={chat.id}
                chat={chat}
                onClick={() => setActiveChat(chat.id)}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {filteredChats.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-60">
            <div className="w-20 h-20 rounded-full bg-brand/10 flex items-center justify-center mb-4">
              <Bird size={32} className="text-brand" />
            </div>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'Ничего не найдено' : 'Нет чатов'}
            </p>
          </div>
        )}
      </div>

      {/* Bottom safe area spacer */}
      <div className="safe-bottom" />

      <CreateGroupModal />
    </div>
  )
}

function clsx(...classes: (string | false | undefined | null)[]) {
  return classes.filter(Boolean).join(' ')
}
