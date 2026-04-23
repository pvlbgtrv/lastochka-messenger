import { format } from 'date-fns'
import clsx from 'clsx'
import { Check, CheckCheck, Copy } from 'lucide-react'
import { useState } from 'react'
import type { Message, Reaction, ReactionType } from '@/types'
import { useChatStore } from '@/store/chatStore'

// в”Ђв”Ђв”Ђ Markdown renderer в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

type Seg =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'strike'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; url: string }

function normalizeLinkUrl(rawUrl: string): string {
  const url = rawUrl.trim()
  if (!url) return ''
  if (/^(https?:\/\/|mailto:|tel:)/i.test(url)) return url
  return `https://${url}`
}

function parseMarkdown(input: string): Seg[] {
  interface RawSpan { start: number; end: number; seg: Seg }
  const raw: RawSpan[] = []

  const add = (re: RegExp, build: (m: RegExpExecArray) => Seg) => {
    for (const m of input.matchAll(re))
      raw.push({ start: m.index!, end: m.index! + m[0].length, seg: build(m) })
  }

  add(/`([^`\n]+?)`/g,                                              (m) => ({ t: 'code',   v: m[1] }))
  add(/\*\*([^*\n]+?)\*\*/g,                                        (m) => ({ t: 'bold',   v: m[1] }))
  add(/__([^_\n]+?)__/g,                                            (m) => ({ t: 'bold',   v: m[1] }))
  add(/(?<!\*)\*(?!\*)([^*\n]+?)(?<!\*)\*(?!\*)/g,                  (m) => ({ t: 'bold',   v: m[1] }))
  add(/(?<!_)_(?!_)([^_\n]+?)(?<!_)_(?!_)/g,                       (m) => ({ t: 'italic', v: m[1] }))
  add(/~~([^~\n]+?)~~/g,                                            (m) => ({ t: 'strike', v: m[1] }))
  add(/\[([^\]\n]*?)\]\(([^)\n]+?)\)/g, (m) => ({ t: 'link', v: m[1] || m[2], url: m[2] }))

  if (!raw.length) return [{ t: 'text', v: input }]

  raw.sort((a, b) => a.start - b.start || b.end - a.end)
  const spans: RawSpan[] = []
  let cursor = 0
  for (const s of raw) {
    if (s.start >= cursor) { spans.push(s); cursor = s.end }
  }

  const segs: Seg[] = []
  let pos = 0
  for (const s of spans) {
    if (s.start > pos) segs.push({ t: 'text', v: input.slice(pos, s.start) })
    segs.push(s.seg)
    pos = s.end
  }
  if (pos < input.length) segs.push({ t: 'text', v: input.slice(pos) })
  return segs
}

function MarkdownText({
  text,
  className,
  copiedCodeIndex,
  onCopyCode,
}: {
  text: string
  className?: string
  copiedCodeIndex: number | null
  onCopyCode: (code: string, index: number) => void
}) {
  const segs = parseMarkdown(text)
  const hasFormatting = segs.some((s) => s.t !== 'text')

  if (!hasFormatting) {
    return <p className={className}>{text}</p>
  }

  return (
    <div className={className}>
      {segs.map((seg, i) => {
        if (seg.t === 'text')   return seg.v
        if (seg.t === 'bold')   return <strong key={i}>{seg.v}</strong>
        if (seg.t === 'italic') return <em key={i}>{seg.v}</em>
        if (seg.t === 'strike') return <del key={i}>{seg.v}</del>
        if (seg.t === 'code') {
          return (
            <button
              key={i}
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onCopyCode(seg.v, i)
              }}
              className="group relative my-1 block w-full rounded-lg border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/10 px-2.5 py-2 text-left"
            >
              <span className="absolute right-2 top-2 text-gray-500 dark:text-gray-400 opacity-0 transition-opacity group-hover:opacity-100">
                {copiedCodeIndex === i ? <Check size={13} /> : <Copy size={13} />}
              </span>
              <code className="block overflow-x-auto whitespace-pre-wrap break-all text-[13px] font-mono">{seg.v}</code>
            </button>
          )
        }
        if (seg.t === 'link') {
          const href = normalizeLinkUrl(seg.url)
          const label = seg.v || href
          return <a key={i} href={href} target="_blank" rel="noopener noreferrer" className="text-brand underline underline-offset-2 hover:opacity-80">{label}</a>
        }
        return null
      })}
    </div>
  )
}

// в”Ђв”Ђв”Ђ Message Bubble в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

interface MessageBubbleProps {
  message: Message
  isOwn: boolean
  showTail: boolean
  onLongPress: () => void
  onReactionSelect: (emoji: ReactionType) => void
}

const QUICK_REACTIONS: ReactionType[] = ['❤️', '🔥', '😂', '👍', '😮', '😢']

export default function MessageBubble({
  message,
  isOwn,
  showTail,
  onLongPress,
  onReactionSelect,
}: MessageBubbleProps) {
  const { setFullscreenImage, emojiStyle } = useChatStore()
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [copiedCodeIndex, setCopiedCodeIndex] = useState<number | null>(null)

  const copyText = async (value: string) => {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return
    }
    const ta = document.createElement('textarea')
    ta.value = value
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }

  const handleCopyCode = (code: string, index: number) => {
    void copyText(code).then(() => {
      setCopiedCodeIndex(index)
      window.setTimeout(() => setCopiedCodeIndex((current) => (current === index ? null : current)), 1200)
    }).catch(() => {})
  }

  // Quick reaction handlers
  const handleTouchStart = () => {
    const timer = setTimeout(onLongPress, 500)
    return () => clearTimeout(timer)
  }

  return (
    <div
      className={clsx('flex', isOwn ? 'justify-end' : 'justify-start', 'animate-slide-up')}
      onTouchStart={handleTouchStart}
      onTouchEnd={() => {}}
    >
      <div
        className={clsx(
          'relative max-w-[78%] px-3.5 pt-2.5 pb-2',
          isOwn
            ? 'bg-gradient-to-br from-bubble-own to-[#e0e7ff] dark:from-bubble-own-dark dark:to-[#234365] rounded-bubble rounded-br-[6px]'
            : 'bg-white dark:bg-bubble-peer-dark rounded-bubble rounded-bl-[6px] shadow-bubble border border-gray-100/40 dark:border-gray-700/20',
          showTail && isOwn && 'rounded-br-[16px]',
          showTail && !isOwn && 'rounded-bl-[16px]'
        )}
        onClick={() => setShowReactionPicker((prev) => !prev)}
      >
        {showReactionPicker && (
          <div
            className={clsx(
              'absolute -top-12 z-20 rounded-full px-2 py-1.5 bg-white/95 dark:bg-surface-dark/95 border border-gray-200/70 dark:border-gray-700/50 shadow-xl flex items-center gap-1.5',
              isOwn ? 'right-0' : 'left-0',
            )}
            onClick={(event) => event.stopPropagation()}
          >
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  onReactionSelect(emoji)
                  setShowReactionPicker(false)
                }}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  emojiStyle === 'classic'
                    ? 'text-base hover:bg-black/5 dark:hover:bg-white/10'
                    : 'text-sm hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Tail SVG */}
        {showTail && (
          <span
            className={clsx(
              'absolute bottom-0 w-3 h-3',
              isOwn
                ? 'right-[-6px] text-bubble-own dark:text-bubble-own-dark'
                : 'left-[-6px] text-white dark:text-bubble-peer-dark'
            )}
          >
            <svg viewBox="0 0 11 20" fill="currentColor" width="11" height="20" className={clsx(isOwn ? '' : 'scale-x-[-1]')}>
              <path d="M10 0 Q10 20 0 20 Q5 20 10 10 Z" />
            </svg>
          </span>
        )}

        {/* Reply */}
        {message.replyTo && (
          <div className="mb-2 pl-2.5 py-1.5 pr-1.5 rounded-lg border-l-[3px] border-brand/50 bg-brand/5 dark:bg-brand/10">
            <p className="text-[11px] text-brand font-semibold truncate">{message.replyTo.senderName}</p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{message.replyTo.text}</p>
          </div>
        )}

        {/* Sticker */}
        {message.stickerId && (
          <div className="text-[64px] leading-none select-none">
            {message.stickerId}
          </div>
        )}

        {/* Image */}
        {message.imageUrl && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setFullscreenImage(message.imageUrl || null)
            }}
            className="mb-2 rounded-xl overflow-hidden cursor-zoom-in block"
          >
            <img
              src={message.imageUrl}
              alt=""
              className="max-w-[260px] max-h-[260px] object-contain rounded-xl"
              loading="lazy"
            />
          </button>
        )}

        {/* Text */}
        {message.text && (
          <MarkdownText
            text={message.text}
            className="text-[14px] leading-relaxed text-gray-900 dark:text-gray-100 break-words whitespace-pre-wrap"
            copiedCodeIndex={copiedCodeIndex}
            onCopyCode={handleCopyCode}
          />
        )}

        {/* Time + Read status */}
        <div className={clsx('flex items-center gap-1 float-right ml-2.5 -mb-0.5 relative top-[2px]')}>
          {message.edited && (
            <span className="text-[10px] text-gray-400/80 dark:text-gray-500/80 mr-0.5 font-medium">СЂРµРґ.</span>
          )}
          <span className="text-[11px] text-gray-400/80 dark:text-gray-500/80 tabular-nums">
            {format(message.ts, 'HH:mm')}
          </span>
          {isOwn && (
            <span className={clsx('transition-colors', message.read ? 'text-brand' : 'text-gray-300 dark:text-gray-600')}>
              {message.read ? <CheckCheck size={15} /> : <Check size={15} />}
            </span>
          )}
        </div>

        {/* Clear float */}
        <div className="clear-both" />
      </div>
    </div>
  )
}

// в”Ђв”Ђв”Ђ Reactions Bar в”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђв”Ђ

interface ReactionsBarProps {
  reactions: Reaction[]
  currentUserId: string
  onReactionClick: (emoji: ReactionType) => void
}

export function ReactionsBar({ reactions, currentUserId, onReactionClick }: ReactionsBarProps) {
  const { emojiStyle } = useChatStore()
  if (reactions.length === 0) return null

  // Group by emoji
  const grouped = reactions.reduce<Record<string, { count: number; active: boolean }>>((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = { count: 0, active: false }
    acc[r.emoji].count++
    if (r.userId === currentUserId) acc[r.emoji].active = true
    return acc
  }, {})

  return (
    <div className="flex flex-wrap gap-1.5 animate-scale-in">
      {Object.entries(grouped).map(([emoji, data]) => (
        <button
          key={emoji}
          onClick={() => onReactionClick(emoji as ReactionType)}
          className={clsx(
            'flex items-center gap-1 px-2 py-1 rounded-full transition-all duration-200',
            emojiStyle === 'classic' ? 'text-[13px]' : 'text-[12px]',
            data.active
              ? 'bg-brand/15 border border-brand/30'
              : 'bg-white/80 dark:bg-surface-variant-dark/80 border border-gray-200/50 dark:border-gray-600/30 hover:scale-105'
          )}
        >
          <span>{emoji}</span>
          <span className={clsx('font-medium', data.active ? 'text-brand' : 'text-gray-600 dark:text-gray-300')}>
            {data.count}
          </span>
        </button>
      ))}
    </div>
  )
}
