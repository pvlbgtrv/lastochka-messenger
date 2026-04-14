import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { useChatStore } from '@/store/chat'
import { X, Check } from 'lucide-react'

export default function InlineEditBar() {
  const { editingMessage, submitEdit, cancelEditing } = useChatStore()
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Sync text when editing message changes
  useEffect(() => {
    if (editingMessage) {
      setText(editingMessage.text)
      // Focus input after mount
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [editingMessage?.id])

  if (!editingMessage) return null

  const handleSubmit = () => {
    submitEdit(text)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    if (e.key === 'Escape') {
      cancelEditing()
    }
  }

  return (
    <div className="border-t border-brand/30 dark:border-brand-dark/30 bg-brand/5 dark:bg-brand-dark/5">
      {/* Edit header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-brand/10 dark:border-brand-dark/10">
        <div className="w-1 h-8 rounded-full bg-brand flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-xs text-brand font-medium">Редактирование сообщения</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate opacity-70">
            {editingMessage.text}
          </p>
        </div>
        <button
          onClick={cancelEditing}
          className="p-1 hover:bg-brand/10 dark:hover:bg-brand-dark/10 rounded-full transition-colors"
        >
          <X size={16} className="text-gray-400" />
        </button>
      </div>

      {/* Edit input */}
      <div className="flex items-end gap-2 px-4 py-3">
        <textarea
          ref={inputRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={() => {
            const ta = inputRef.current
            if (ta) {
              ta.style.height = 'auto'
              ta.style.height = Math.min(ta.scrollHeight, 150) + 'px'
            }
          }}
          placeholder="Отредактируйте сообщение"
          className="flex-1 bg-input-field dark:bg-input-field-dark rounded-2xl px-3 py-2 resize-none outline-none text-[14.5px] text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 leading-relaxed max-h-[150px] overflow-y-auto scrollbar-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="w-10 h-10 flex items-center justify-center rounded-full bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all text-white flex-shrink-0 shadow-bubble"
        >
          <Check size={20} />
        </button>
      </div>
    </div>
  )
}
