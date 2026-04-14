import { useState, useEffect, useRef } from 'react'
import { format, isToday, isYesterday } from 'date-fns'
import { ru } from 'date-fns/locale'
import clsx from 'clsx'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { useChatStore } from '@/store/chat'
import { Pin, PinOff, Volume2, VolumeX } from 'lucide-react'
import type { Chat } from '@/types'

interface ChatItemProps {
  chat: Chat
  active: boolean
  onClick: () => void
}

function formatTime(date: Date) {
  if (isToday(date)) return format(date, 'HH:mm')
  if (isYesterday(date)) return 'вчера'
  return format(date, 'd MMM', { locale: ru })
}

export default function ChatItem({ chat, active, onClick }: ChatItemProps) {
  const { toggleMute, togglePin } = useChatStore()
  const [showContext, setShowContext] = useState(false)
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 })
  const ctxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showContext) return
    const handleClick = (e: MouseEvent) => {
      if (ctxRef.current && !ctxRef.current.contains(e.target as Node)) {
        setShowContext(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showContext])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextPos({ x: e.clientX, y: e.clientY })
    setShowContext(true)
  }

  return (
    <>
      <button
        onClick={onClick}
        onContextMenu={handleContextMenu}
        className={clsx(
          'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98] text-left group',
          active
            ? 'bg-brand/10 dark:bg-brand/15 text-brand shadow-sm'
            : 'hover:bg-gray-50/80 dark:hover:bg-gray-800/40 text-gray-900 dark:text-gray-100'
        )}
      >
        <div className="relative flex-shrink-0">
          <Avatar name={chat.name} src={chat.avatar} size="md" online={chat.online} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              {chat.pinned && (
                <Pin size={13} className={clsx('flex-shrink-0', active ? 'text-brand/60' : 'text-gray-300 dark:text-gray-600')} />
              )}
              <span className={clsx('font-semibold truncate text-[14px] leading-tight', active ? 'text-brand' : '')}>
                {chat.name}
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {chat.muted && (
                <VolumeX size={13} className={clsx('flex-shrink-0', active ? 'text-brand/60' : 'text-gray-300 dark:text-gray-600')} />
              )}
              {chat.lastMessageTs && (
                <span className={clsx('text-[11px] tabular-nums', active ? 'text-brand/70' : 'text-gray-400 dark:text-gray-500')}>
                  {formatTime(chat.lastMessageTs)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className={clsx('text-[13px] truncate leading-tight', active ? 'text-brand/70' : 'text-gray-500 dark:text-gray-400')}>
              {chat.lastMessage ?? ''}
            </p>
            {!!chat.unread && chat.unread > 0 && (
              <span className={clsx(
                'flex-shrink-0 min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center transition-all',
                active
                  ? 'bg-brand text-white shadow-md shadow-brand/30'
                  : chat.muted
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    : 'bg-brand text-white shadow-md shadow-brand/25'
              )}>
                {chat.unread > 99 ? '99+' : chat.unread}
              </span>
            )}
          </div>
        </div>
      </button>

      {/* Context menu */}
      {showContext && (
        <div
          ref={ctxRef}
          className="fixed z-50 bg-white dark:bg-[#1c2733] rounded-xl shadow-glass border border-gray-100 dark:border-gray-700/50 py-1.5 min-w-[180px] animate-scale-in"
          style={{ left: Math.min(contextPos.x, window.innerWidth - 200), top: Math.min(contextPos.y, window.innerHeight - 130) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={(e) => { e.stopPropagation(); togglePin(chat.id); setShowContext(false) }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            {chat.pinned ? <PinOff size={16} className="text-amber-500" /> : <Pin size={16} className="text-brand" />}
            <span>{chat.pinned ? 'Открепить' : 'Закрепить'}</span>
          </button>
          <div className="h-px bg-gray-100 dark:bg-gray-700/50 mx-3 my-1" />
          <button
            onClick={(e) => { e.stopPropagation(); toggleMute(chat.id); setShowContext(false) }}
            className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            {chat.muted ? <Volume2 size={16} className="text-brand" /> : <VolumeX size={16} className="text-gray-400" />}
            <span>{chat.muted ? 'Включить уведомления' : 'Отключить уведомления'}</span>
          </button>
        </div>
      )}
    </>
  )
}
