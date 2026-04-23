import { memo } from 'react'
import { format } from 'date-fns'
import { isToday, isYesterday } from 'date-fns'
import clsx from 'clsx'
import { Users, BellOff, Pin, CheckCheck, Bot } from 'lucide-react'
import type { Chat } from '@/types'

interface ChatItemProps {
  chat: Chat
  isActive?: boolean
  onClick: () => void
}

function ChatItem({ chat, isActive, onClick }: ChatItemProps) {
  const initials = chat.name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Avatar color based on chat id
  const avatarColor = `hsl(${(chat.id.charCodeAt(2) * 37) % 360}, 50%, 55%)`

  const formatTime = (date?: Date) => {
    if (!date) return ''
    if (isToday(date)) return format(date, 'HH:mm')
    if (isYesterday(date)) return 'Вчера'
    return format(date, 'dd.MM')
  }

  const messagePreview = chat.typing ? 'печатает...' : (chat.lastMessage || '')
  const timeLabel = formatTime(chat.lastMessageTs)

  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 active:scale-[0.98]',
        isActive
          ? 'bg-brand/10 dark:bg-brand/20'
          : 'hover:bg-black/5 dark:hover:bg-white/5'
      )}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-semibold text-sm"
          style={{ background: chat.avatar ? undefined : avatarColor }}
        >
          {chat.avatar ? (
            <img src={chat.avatar} alt={chat.name} className="w-full h-full rounded-full object-cover" />
          ) : (
            initials
          )}
        </div>
        {/* Online indicator */}
        {chat.online && !chat.isGroup && (
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-online rounded-full border-2 border-white dark:border-surface-dark online-pulse" />
        )}
        {/* Group icon */}
        {chat.isGroup && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-brand rounded-full flex items-center justify-center border-2 border-white dark:border-surface-dark">
            <Users size={10} className="text-white" />
          </div>
        )}
        {/* Bot icon */}
        {(chat.botId || chat.isBot) && !chat.isGroup && (
          <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center border-2 border-white dark:border-surface-dark">
            <Bot size={10} className="text-white" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0 flex items-center gap-1.5">
            <h3 className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate">
              {chat.name}
            </h3>
            {(chat.botId || chat.isBot) && (
              <span className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                Бот
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {chat.pinned && <Pin size={14} className="text-muted/60" />}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p
            className={clsx(
              'text-[14px] truncate min-w-0',
              chat.typing
                ? 'text-brand font-medium italic'
                : 'text-gray-500 dark:text-gray-400',
            )}
          >
            {messagePreview}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {timeLabel && (
              <span className="text-[12px] text-muted tabular-nums">
                {timeLabel}
              </span>
            )}
            {chat.muted && <BellOff size={14} className="text-muted/60" />}
            {chat.unread ? (
              <span
                className={clsx(
                  'min-w-[22px] h-[22px] rounded-full flex items-center justify-center text-[12px] font-semibold px-1.5',
                  chat.muted
                    ? 'bg-muted text-white'
                    : 'bg-brand text-white'
                )}
              >
                {chat.unread}
              </span>
            ) : messagePreview && (
              /* Read receipts for own messages */
              messagePreview.startsWith('Вы:') && (
                <CheckCheck size={16} className="text-brand" />
              )
            )}
          </div>
        </div>
      </div>
    </button>
  )
}

export default memo(ChatItem)
