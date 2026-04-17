import { useEffect, useMemo } from 'react'
import { ArrowLeft, Search } from 'lucide-react'
import { useChatStore } from '@/store/chatStore'
import ChatItem from './ChatItem'

export default function SearchScreen() {
  const {
    closeSearch,
    searchQuery,
    setSearchQuery,
    searchUsers,
    searchResults,
    isSearching,
    setActiveChat,
  } = useChatStore()

  useEffect(() => {
    const query = searchQuery.trim()
    const timer = window.setTimeout(() => {
      void searchUsers(query)
    }, 250)
    return () => window.clearTimeout(timer)
  }, [searchQuery, searchUsers])

  const results = useMemo(() => {
    const seen = new Set<string>()
    return searchResults.filter((chat) => {
      if (seen.has(chat.id)) return false
      seen.add(chat.id)
      return true
    })
  }, [searchResults])

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#f8f9fc] via-[#f0f2f7] to-[#e8ecf3] dark:from-[#0a0f18] dark:via-[#0e1621] dark:to-[#111b27]">
      <header className="flex items-center gap-3 px-3 pt-12 pb-3 safe-top glass-strong dark:glass-strong-dark z-10">
        <button
          onClick={() => {
            setSearchQuery('')
            closeSearch()
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target"
        >
          <ArrowLeft size={22} className="text-gray-700 dark:text-gray-300" />
        </button>
        <h1 className="text-[20px] font-bold text-gray-900 dark:text-gray-100">Поиск</h1>
      </header>

      <div className="px-4 pt-[15px] pb-2">
        <p className="text-[13px] text-gray-600 dark:text-gray-300">
          Найти человека или группу по логину, имени, телефону или названию группы
        </p>
      </div>

      <div className="px-4 pb-3">
        <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-surface-dark shadow-glass">
          <Search size={18} className="text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="@login, имя, телефон, название группы"
            className="flex-1 bg-transparent text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto overscroll-contain">
        {isSearching && (
          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Поиск...</div>
        )}

        {!isSearching && searchQuery.trim().length >= 2 && results.length === 0 && (
          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">Ничего не найдено</div>
        )}

        {!isSearching && results.map((chat) => (
          <ChatItem
            key={`result-${chat.id}`}
            chat={chat}
            onClick={() => {
              setActiveChat(chat.id)
              setSearchQuery('')
            }}
          />
        ))}

        {!isSearching && searchQuery.trim().length < 2 && (
          <div className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400">
            Введите минимум 2 символа
          </div>
        )}
      </div>
    </div>
  )
}
