import { useEffect, useState, useRef } from 'react'
import { useChatStore } from '@/store/chatStore'
import { Send, Smile, Mic, ImagePlus, X } from 'lucide-react'
import EmojiStickerPicker from './EmojiStickerPicker'

export default function MessageInput() {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const {
    sendMessage,
    replyToMessage,
    editMessage,
    showEmojiPicker,
    showStickerPicker,
    setShowEmojiPicker,
    setShowStickerPicker,
    replyToId,
    editingMessageId,
    startReply,
    startEdit,
    messages,
    activeChatId,
  } = useChatStore()

  // Get reply message info
  const replyMessage = replyToId && activeChatId 
    ? messages[activeChatId]?.find((m) => m.id === replyToId)
    : null

  const handleSend = () => {
    if (text.trim()) {
      if (editingMessageId) {
        void editMessage(editingMessageId, text.trim())
        startEdit(null)
      } else if (replyToId) {
        void replyToMessage(replyToId, text.trim())
        startReply(null)
      } else {
        void sendMessage(text.trim())
      }
      setText('')
    }
  }

  const handlePickImage = () => {
    imageInputRef.current?.click()
  }

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return

    // Send file directly
    void sendMessage('', file)
    // Allow selecting the same file again.
    event.target.value = ''
  }

  const handlePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const items = event.clipboardData?.items
    if (!items || items.length === 0) return

    const imageItem = Array.from(items).find((item) => item.type.startsWith('image/'))
    if (!imageItem) return

    const file = imageItem.getAsFile()
    if (!file) return

    event.preventDefault()
    void sendMessage('', file)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-focus input when reply or edit mode is active
  useEffect(() => {
    if (replyToId || editingMessageId) {
      inputRef.current?.focus()
    }
  }, [replyToId, editingMessageId])

  const showSend = text.trim().length > 0
  const isPickerOpen = showEmojiPicker || showStickerPicker

  useEffect(() => {
    if (!isPickerOpen) return

    const closePickers = () => {
      setShowEmojiPicker(false)
      setShowStickerPicker(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closePickers()
      }
    }

    const handlePointerOutside = (event: MouseEvent | TouchEvent) => {
      const container = containerRef.current
      const target = event.target as Node | null
      if (!container || !target) return
      if (!container.contains(target)) {
        closePickers()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerOutside)
    document.addEventListener('touchstart', handlePointerOutside, { passive: true })

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerOutside)
      document.removeEventListener('touchstart', handlePointerOutside)
    }
  }, [isPickerOpen, setShowEmojiPicker, setShowStickerPicker])

  return (
    <div ref={containerRef} className="safe-bottom">
      {(showEmojiPicker || showStickerPicker) && <EmojiStickerPicker />}

      {/* Reply bar */}
      {replyMessage && (
        <div className="flex items-center gap-2 px-3 py-2 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-brand truncate">
              Ответ: {replyMessage.senderName || 'Пользователь'}
            </p>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
              {replyMessage.text}
            </p>
          </div>
          <button
            type="button"
            onClick={() => startReply(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Editing bar */}
      {editingMessageId && (
        <div className="flex items-center gap-2 px-3 py-2 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-semibold text-brand truncate">
              Редактирование сообщения
            </p>
          </div>
          <button
            type="button"
            onClick={() => startEdit(null)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 transition-all"
          >
            <X size={16} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-end gap-2 px-3 py-2 glass-strong dark:glass-strong-dark border-t border-gray-200/30 dark:border-gray-700/20">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleImageChange}
        />

        {/* Left buttons */}

        <button
          type="button"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 tap-target shadow-sm ${
            showEmojiPicker
              ? 'bg-gradient-to-br from-brand/25 to-brand/15 text-brand ring-1 ring-brand/30'
              : 'bg-white/70 dark:bg-surface-variant-dark/60 text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-surface-dark'
          }`}
        >
          <Smile size={22} />
        </button>

        <button
          type="button"
          onClick={handlePickImage}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-white/70 dark:bg-surface-variant-dark/60 text-gray-500 dark:text-gray-300 hover:bg-white dark:hover:bg-surface-dark transition-all duration-200 tap-target shadow-sm"
          title="Выбрать изображение"
        >
          <ImagePlus size={22} />
        </button>

        {/* Text input */}
        <div className="flex-1 flex items-end bg-white/80 dark:bg-surface-variant-dark/80 rounded-2xl px-4 py-2.5 min-h-[44px]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Сообщение..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-[15px] text-gray-900 dark:text-gray-100 placeholder-gray-400 outline-none max-h-[120px]"
          />
        </div>

        {/* Right button */}
        {showSend ? (
          <button
            onClick={handleSend}
            className="w-10 h-10 rounded-full bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-all duration-200 hover:scale-105 active:scale-95 tap-target shadow-lg shadow-brand/25"
          >
            <Send size={18} />
          </button>
        ) : (
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5 transition-all tap-target"
          >
            <Mic size={22} />
          </button>
        )}
      </div>
    </div>
  )
}
