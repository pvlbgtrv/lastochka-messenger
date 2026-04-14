import { useState } from 'react'
import { format } from 'date-fns'
import clsx from 'clsx'
import Icon from '@/components/ui/Icon'
import type { Message } from '@/types'
import FullscreenImageViewer from './FullscreenImageViewer'
import VoiceMessage from './VoiceMessage'

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showTail?: boolean
  onRightClick?: (e: React.MouseEvent, msg: Message) => void
}

export default function MessageBubble({ message, isOwn, showTail, onRightClick }: MessageBubbleProps) {
  const [showFullscreen, setShowFullscreen] = useState(false)

  return (
    <>
      <div
        className={clsx('flex', isOwn ? 'justify-end' : 'justify-start')}
        onContextMenu={(e) => {
          e.preventDefault()
          onRightClick?.(e, message)
        }}
      >
        <div
          className={clsx(
            'relative max-w-[65%] min-w-[80px] px-3.5 pt-2.5 pb-2 animate-slide-up',
            isOwn
              ? 'bg-gradient-to-br from-bubble-own to-[#e8f7d8] dark:from-[#2b5278] dark:to-[#254a6e] rounded-bubble rounded-br-bubble-sm shadow-sm'
              : 'bg-white dark:bg-[#182533] rounded-bubble rounded-bl-bubble-sm shadow-sm border border-gray-100/50 dark:border-gray-700/30',
            showTail && isOwn && 'rounded-br-none',
            showTail && !isOwn && 'rounded-bl-none',
          )}
        >
          {/* Bubble tail */}
          {showTail && (
            <span
              className={clsx(
                'absolute bottom-0 w-3 h-3',
                isOwn
                  ? 'right-[-6px] text-bubble-own dark:text-[#2b5278]'
                  : 'left-[-6px] text-white dark:text-[#182533]',
              )}
            >
              <svg viewBox="0 0 11 20" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="11" height="20" className={clsx(isOwn ? '' : 'scale-x-[-1]')}>
                <path d="M10 0 Q10 20 0 20 Q5 20 10 10 Z" />
              </svg>
            </span>
          )}

          {/* Reply Quote */}
          {message.replyTo && (
            <div className="mb-2 pl-2.5 py-1.5 pr-1.5 rounded-lg border-l-[3px] border-brand/50 bg-brand/5 dark:bg-brand/10">
              <p className="text-[11px] text-brand font-semibold truncate">{message.replyTo.senderName}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{message.replyTo.text}</p>
            </div>
          )}

          {/* Forwarded indicator */}
          {message.text.startsWith('⟮ переслано от') && (
            <div className="mb-2 flex items-center gap-1.5 text-[11px] text-blue-500 dark:text-blue-400 font-medium">
              <svg viewBox="0 0 24 24" fill="none" className="w-3.5 h-3.5" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5-5 5M6 12h12" />
              </svg>
              <span>Переслано</span>
            </div>
          )}

          {/* Voice message */}
          {message.attachments?.[0]?.type === 'audio' && message.attachments[0].url && (
            <VoiceMessage
              audioUrl={message.attachments[0].url}
              duration={message.duration ?? 0}
              isOwn={isOwn}
            />
          )}

          {/* Image */}
          {message.imageUrl && (
            <div
              className="mb-2 rounded-xl overflow-hidden cursor-pointer group relative"
              onClick={() => setShowFullscreen(true)}
            >
              <img
                src={message.imageUrl}
                alt="Изображение"
                className="max-w-[280px] max-h-[280px] object-contain rounded-xl transition-transform duration-200 group-hover:scale-[1.02]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100">
                <div className="w-10 h-10 rounded-full bg-white/80 backdrop-blur-sm flex items-center justify-center shadow-lg">
                  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-gray-700" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                </div>
              </div>
            </div>
          )}

          {/* Upload progress */}
          {message.uploadProgress !== undefined && message.uploadProgress < 1 && (
            <div className="mb-2 w-full bg-gray-200/50 dark:bg-gray-700/50 rounded-full h-1 overflow-hidden">
              <div className="h-full bg-brand rounded-full transition-all duration-500 ease-out" style={{ width: `${message.uploadProgress * 100}%` }} />
            </div>
          )}

          {/* Upload failed */}
          {message.uploadFailed && (
            <p className="text-[11px] text-red-500 mb-1 font-medium">Ошибка отправки</p>
          )}

          {/* Text content */}
          {message.text && !message.text.startsWith('⟮ переслано от') && (
            <p className="text-[14px] leading-relaxed text-gray-900 dark:text-gray-100 break-words whitespace-pre-wrap">
              {message.text}
            </p>
          )}

          {/* Time + read status */}
          <div className={clsx('flex items-center gap-1 float-right ml-2.5 -mb-0.5 relative', 'top-0.5')}>
            {message.edited && (
              <span className="text-[10px] text-gray-400/80 dark:text-gray-500/80 mr-0.5 font-medium">ред.</span>
            )}
            <span className="text-[11px] text-gray-400/80 dark:text-gray-500/80 whitespace-nowrap tabular-nums">
              {format(message.ts, 'HH:mm')}
            </span>
            {isOwn && (
              <span className={clsx('transition-colors', message.read ? 'text-brand' : 'text-gray-300 dark:text-gray-600')}>
                <Icon name={message.read ? 'check_all' : 'check'} size={15} />
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen image viewer */}
      {showFullscreen && message.imageUrl && (
        <FullscreenImageViewer
          url={message.imageUrl}
          onClose={() => setShowFullscreen(false)}
        />
      )}
    </>
  )
}
