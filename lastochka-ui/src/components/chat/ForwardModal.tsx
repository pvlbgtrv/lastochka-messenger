import { useState, useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import Avatar from '@/components/ui/Avatar'
import { X, Search, Send } from 'lucide-react'

export default function ForwardModal() {
  const { forwardingMessage, forwardTo, cancelForward, chats } = useChatStore()
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search on open
  useEffect(() => {
    if (forwardingMessage) {
      requestAnimationFrame(() => inputRef.current?.focus())
    }
    return () => setSearch('')
  }, [forwardingMessage?.id])

  // Close on Escape
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancelForward()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [cancelForward])

  if (!forwardingMessage) return null

  const filteredChats = search.trim().length > 0
    ? chats.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : chats

  const handleSelect = (chatId: string) => {
    forwardTo(chatId)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Переслать сообщение</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[260px]">
              {forwardingMessage.text}
            </p>
          </div>
          <button
            onClick={cancelForward}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Поиск чата..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-9 pr-4 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand transition-all text-sm"
            />
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat) => (
              <button
                key={chat.id}
                onClick={() => handleSelect(chat.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left"
              >
                <Avatar name={chat.name} src={chat.avatar} size="md" online={chat.online} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{chat.name}</p>
                  {chat.lastMessage && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{chat.lastMessage}</p>
                  )}
                </div>
                <Send size={16} className="text-gray-400 flex-shrink-0" />
              </button>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Search size={32} className="mb-2 opacity-40" />
              <p className="text-sm">Чаты не найдены</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
