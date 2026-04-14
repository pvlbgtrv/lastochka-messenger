import { useMemo, useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import ChatItem from './ChatItem'

export default function ChatList() {
  const { chats, activeChatId, setActiveChat, searchQuery, searchUsers, searchResults, isSearching } = useChatStore()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced fnd search when query >= 3 chars
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      searchUsers(searchQuery)
    }, 400)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [searchQuery, searchUsers])

  // Local filter — always shown (filtered by name)
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase()
    const list = q ? chats.filter((c) => c.name.toLowerCase().includes(q)) : chats
    return [...list].sort((a, b) => {
      if (a.pinned && !b.pinned) return -1
      if (!a.pinned && b.pinned) return 1
      const ta = a.lastMessageTs?.getTime() ?? 0
      const tb = b.lastMessageTs?.getTime() ?? 0
      return tb - ta
    })
  }, [chats, searchQuery])

  // fnd results excluding already existing chats
  const existingIds = useMemo(() => new Set(chats.map((c) => c.id)), [chats])
  const newResults = useMemo(
    () => searchResults.filter((r) => !existingIds.has(r.id)),
    [searchResults, existingIds],
  )

  const showSearch = searchQuery.length >= 3

  return (
    <div className="flex-1 overflow-y-auto px-1 py-1 space-y-0.5">
      {/* Existing chats */}
      {filtered.map((chat) => (
        <ChatItem key={chat.id} chat={chat} active={chat.id === activeChatId} onClick={() => setActiveChat(chat.id)} />
      ))}

      {/* Global search results */}
      {showSearch && (
        <>
          {isSearching && (
            <p className="text-center text-xs text-gray-400 dark:text-gray-500 py-3">Поиск...</p>
          )}
          {!isSearching && newResults.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-400 dark:text-gray-500 px-3 pt-3 pb-1 uppercase tracking-wide">
                Найдено
              </p>
              {newResults.map((chat) => (
                <ChatItem key={chat.id} chat={chat} active={chat.id === activeChatId} onClick={() => setActiveChat(chat.id)} />
              ))}
            </>
          )}
          {!isSearching && filtered.length === 0 && newResults.length === 0 && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-8">Ничего не найдено</p>
          )}
        </>
      )}
    </div>
  )
}
