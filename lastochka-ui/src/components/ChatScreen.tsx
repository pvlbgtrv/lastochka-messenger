import { useRef, useEffect, useMemo, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { ArrowLeft, MoreVertical, Search, Users, X } from 'lucide-react'
import MessageBubble, { ReactionsBar } from './MessageBubble'
import MessageInput from './MessageInput'
import GroupSettingsModal from './GroupSettingsModal'

const CURRENT_USER_ID = 'usr_me'

interface ChatScreenProps {
  isDesktop?: boolean
}

export default function ChatScreen({ isDesktop = false }: ChatScreenProps) {
  const { 
    activeChatId, 
    goBack, 
    messages, 
    addReaction, 
    removeReaction, 
    openGroupSettingsModal,
    startReply,
    startEdit,
    deleteMessage,
  } = useChatStore()
  const scrollRef = useRef<HTMLDivElement>(null)
  const chat = useChatStore((s) => s.chats.find((c) => c.id === activeChatId))
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{ messageId: string; x: number; y: number } | null>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages[activeChatId || '']?.length])

  const chatMessages = useMemo(
    () => messages[activeChatId || ''] || [],
    [messages, activeChatId]
  )
  const visibleMessages = useMemo(() => {
    const ordered = [...chatMessages].sort((a, b) => a.ts.getTime() - b.ts.getTime())
    const q = searchQuery.trim().toLowerCase()
    if (!q) return ordered
    return ordered.filter((msg) => {
      const text = (msg.text || '').toLowerCase()
      const sender = (msg.senderName || '').toLowerCase()
      return text.includes(q) || sender.includes(q)
    })
  }, [chatMessages, searchQuery])

  const formatDayLabel = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)

    if (day.getTime() === today.getTime()) return 'Сегодня'
    if (day.getTime() === yesterday.getTime()) return 'Вчера'
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
  }

  if (!chat || !activeChatId) return null

  const initials = chat.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const avatarColor = `hsl(${(chat.id.charCodeAt(2) * 37) % 360}, 50%, 55%)`

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-[#f8f9fc] via-[#f0f2f7] to-[#e8ecf3] dark:from-[#0a0f18] dark:via-[#0e1621] dark:to-[#111b27]">
      {/* Header */}
      <header className="flex items-center gap-3 px-3 pt-4 safe-top pb-3 glass-strong dark:glass-strong-dark z-10">
        {!isDesktop && (
          <button
            onClick={goBack}
            className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target"
          >
            <ArrowLeft size={22} className="text-gray-700 dark:text-gray-300" />
          </button>
        )}

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold text-sm flex-shrink-0"
          style={{ background: chat.avatar ? undefined : avatarColor }}
        >
          {chat.avatar ? (
            <img src={chat.avatar} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-[16px] text-gray-900 dark:text-gray-100 truncate">
            {chat.name}
          </h2>
          <p className="text-[12px] text-gray-500 dark:text-gray-400 truncate">
            {chat.typing ? (
              <span className="text-brand font-medium">печатает...</span>
            ) : chat.online ? (
              <span className="text-online">в сети</span>
            ) : chat.isGroup ? (
              <span className="flex items-center gap-1">
                <Users size={11} />
                {chat.membersCount} участников
              </span>
            ) : (
              chat.lastSeenText || 'не в сети'
            )}
          </p>
        </div>

        <button
          onClick={() => setSearchOpen((prev) => !prev)}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-surface-variant-dark/60 hover:bg-white dark:hover:bg-surface-dark transition-all duration-200 tap-target shadow-sm"
        >
          <Search size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
        <button
          onClick={() => {
            if (chat.isGroup) {
              openGroupSettingsModal(chat.id)
            }
          }}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-surface-variant-dark/60 hover:bg-white dark:hover:bg-surface-dark transition-all duration-200 tap-target shadow-sm"
        >
          <MoreVertical size={20} className="text-gray-700 dark:text-gray-300" />
        </button>
      </header>

      {searchOpen && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-xl bg-white/80 dark:bg-surface-variant-dark/80 border border-gray-200/60 dark:border-gray-700/40 px-3 h-10">
            <Search size={16} className="text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Поиск по чату..."
              className="flex-1 bg-transparent text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="w-6 h-6 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X size={14} className="text-gray-500" />
              </button>
            )}
          </div>
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 px-1">
            Найдено: {visibleMessages.length}
          </p>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 pt-4 py-3 pb-4 space-y-1 overscroll-contain">
        {visibleMessages.map((msg, idx) => {
          const prev = visibleMessages[idx - 1]
          const showTail = !prev || prev.senderId !== msg.senderId
          const isOwn = msg.senderId === CURRENT_USER_ID
          const curDay = new Date(msg.ts.getFullYear(), msg.ts.getMonth(), msg.ts.getDate()).getTime()
          const prevDay = prev
            ? new Date(prev.ts.getFullYear(), prev.ts.getMonth(), prev.ts.getDate()).getTime()
            : null
          const showDateSeparator = idx === 0 || curDay !== prevDay

          return (
            <div key={msg.id} className="space-y-1">
              {showDateSeparator && (
                <div className="flex items-center justify-center py-2">
                  <span className="px-3 py-1 rounded-full bg-white/60 dark:bg-surface-variant-dark/60 text-[12px] text-gray-500 dark:text-gray-400 font-medium backdrop-blur-sm">
                    {formatDayLabel(msg.ts)}
                  </span>
                </div>
              )}

              {/* Grouped sender name for first message in group */}
              {!isOwn && showTail && chat.isGroup && (
                <p className="text-[12px] font-semibold text-brand ml-1">
                  {msg.senderName}
                </p>
              )}

              <MessageBubble
                message={msg}
                isOwn={isOwn}
                showTail={showTail}
                onLongPress={() => {
                  // Show context menu at message position
                  setContextMenu({ messageId: msg.id, x: 0, y: 0 })
                }}
                onReactionSelect={(emoji) => {
                  const exists = msg.reactions?.some(
                    (r) => r.emoji === emoji && r.userId === CURRENT_USER_ID
                  )
                  if (exists) {
                    removeReaction(msg.id, emoji)
                  } else {
                    addReaction(msg.id, emoji)
                  }
                }}
              />

              {/* Reactions */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className={isOwn ? 'flex justify-end' : 'flex justify-start'}>
                  <ReactionsBar
                    reactions={msg.reactions}
                    currentUserId={CURRENT_USER_ID}
                    onReactionClick={(emoji) => {
                      const exists = msg.reactions?.some(
                        (r) => r.emoji === emoji && r.userId === CURRENT_USER_ID
                      )
                      if (exists) {
                        removeReaction(msg.id, emoji)
                      } else {
                        addReaction(msg.id, emoji)
                      }
                    }}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Context menu for messages */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setContextMenu(null)}
        >
          <div
            className="absolute bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-2 min-w-[200px]"
            style={{
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                startReply(contextMenu.messageId)
                setContextMenu(null)
              }}
              className="w-full px-4 py-3 text-left text-[14px] text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-surface-variant-dark transition-colors flex items-center gap-3"
            >
              <span className="text-lg">↩️</span>
              Ответить
            </button>
            <button
              onClick={() => {
                const msg = messages[activeChatId!]?.find((m) => m.id === contextMenu.messageId)
                if (msg?.senderId === CURRENT_USER_ID) {
                  startEdit(contextMenu.messageId)
                }
                setContextMenu(null)
              }}
              className="w-full px-4 py-3 text-left text-[14px] text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-surface-variant-dark transition-colors flex items-center gap-3"
            >
              <span className="text-lg">✏️</span>
              Редактировать
            </button>
            <button
              onClick={() => {
                void deleteMessage(contextMenu.messageId)
                setContextMenu(null)
              }}
              className="w-full px-4 py-3 text-left text-[14px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-3"
            >
              <span className="text-lg">🗑️</span>
              Удалить
            </button>
          </div>
        </div>
      )}

      {/* Message Input */}
      <MessageInput />
      <GroupSettingsModal />
    </div>
  )
}
