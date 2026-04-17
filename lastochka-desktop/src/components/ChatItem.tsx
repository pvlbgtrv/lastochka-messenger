import { memo } from 'react'
import { format } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'
import { Users, BellOff, Pin, CheckCheck } from 'lucide-react'
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
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / 86400000)
    if (days === 0) return format(date, 'HH:mm')
    if (days === 1) return 'Вчера'
    if (days < 7) return format(date, 'EEE', { locale: ru })
    return format(date, 'dd.MM.yy')
  }

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
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-semibold text-[15px] text-gray-900 dark:text-gray-100 truncate">
            {chat.name}
          </h3>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {chat.pinned && <Pin size={14} className="text-muted/60" />}
            {chat.lastMessageTs && (
              <span className="text-[12px] text-muted tabular-nums">
                {formatTime(chat.lastMessageTs)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-[14px] text-gray-500 dark:text-gray-400 truncate">
            {chat.typing ? (
              <span className="text-brand font-medium italic">печатает...</span>
            ) : (
              chat.lastMessage
            )}
          </p>

          <div className="flex items-center gap-1.5 flex-shrink-0">
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
            ) : chat.lastMessage && (
              /* Read receipts for own messages */
              chat.lastMessage.startsWith('Вы:') && (
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
