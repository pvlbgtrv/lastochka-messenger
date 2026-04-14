import { useEffect, useRef, useState, useCallback } from 'react'
import { isToday, isYesterday, format } from 'date-fns'
import { ru } from 'date-fns/locale'
import { ArrowDown } from 'lucide-react'
import { useChatStore } from '@/store/chat'
import MessageBubble from './MessageBubble'
import type { Message } from '@/types'

function dateDivider(date: Date) {
  if (isToday(date)) return 'Сегодня'
  if (isYesterday(date)) return 'Вчера'
  return format(date, 'd MMMM yyyy', { locale: ru })
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
}

export default function MessagesList() {
  const { messages, activeChatId, hasMoreMessages, isLoadingMoreMessages, loadMoreMessages } = useChatStore()

  const rawMsgs: Message[] = activeChatId ? (messages[activeChatId] ?? []) : []
  const msgs = [...rawMsgs].sort((a, b) => {
    const aSeq = a.seq ?? 0
    const bSeq = b.seq ?? 0
    return aSeq - bSeq
  })

  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const prevCountRef = useRef(msgs.length)

  useEffect(() => {
    if (msgs.length === 0 || !containerRef.current) return
    const newMessages = msgs.length > prevCountRef.current
    prevCountRef.current = msgs.length
    if (newMessages && isAtBottomRef.current) {
      const el = containerRef.current
      el.scrollTop = el.scrollHeight
    }
  }, [msgs.length])

  useEffect(() => {
    if (!containerRef.current) return
    requestAnimationFrame(() => {
      if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
    })
    isAtBottomRef.current = true
    prevCountRef.current = msgs.length
  }, [activeChatId])

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    isAtBottomRef.current = distanceFromBottom < 100
    const threshold = 100
    if (scrollTop < threshold && !isLoadingMoreMessages) {
      if (activeChatId && hasMoreMessages[activeChatId]) loadMoreMessages()
    }
  }, [activeChatId, hasMoreMessages, isLoadingMoreMessages, loadMoreMessages])

  const scrollToBottom = () => {
    if (containerRef.current) containerRef.current.scrollTop = containerRef.current.scrollHeight
    isAtBottomRef.current = true
  }

  return (
    <div className="relative flex-1 overflow-hidden">
      <div
        ref={containerRef}
        className="h-full overflow-y-auto px-3 py-4 space-y-1 chat-bg"
        onScroll={handleScroll}
      >
        {isLoadingMoreMessages && (
          <div className="flex justify-center my-4">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-sm">
              <div className="w-4 h-4 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">Загрузка...</span>
            </div>
          </div>
        )}

        {msgs.map((msg, i) => {
          const isOwn = msg.senderId === 'me'
          const prev = msgs[i - 1]
          const showDate = !prev || !isSameDay(prev.ts, msg.ts)
          const next = msgs[i + 1]
          const showTail = !next || next.senderId !== msg.senderId

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex justify-center my-4">
                  <span className="text-[11px] font-semibold text-gray-500/80 dark:text-gray-400/80 bg-white/80 dark:bg-gray-800/60 backdrop-blur-sm px-3.5 py-1.5 rounded-full shadow-sm">
                    {dateDivider(msg.ts)}
                  </span>
                </div>
              )}
              <MessageBubble
                message={msg}
                isOwn={isOwn}
                showTail={showTail}
              />
            </div>
          )
        })}
      </div>

      {/* Scroll-to-bottom FAB with glass effect */}
      {!isAtBottomRef.current && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-5 right-5 w-10 h-10 bg-white/90 dark:bg-gray-800/90 backdrop-blur-xl rounded-full shadow-fab border border-gray-200/50 dark:border-gray-700/50 flex items-center justify-center hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 z-10 active:scale-90 animate-bounce-in"
        >
          <ArrowDown size={18} className="text-gray-600 dark:text-gray-300" />
        </button>
      )}
    </div>
  )
}
