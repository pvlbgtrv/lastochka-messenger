import { useEffect, useRef } from 'react'
import { useChatStore } from '@/store/chat'
import { Copy, Reply, Edit3, Trash2, Share2 } from 'lucide-react'
import type { Message } from '@/types'

interface MessageContextMenuProps {
  message: Message
  position: { x: number; y: number }
  onClose: () => void
}

export default function MessageContextMenu({ message, position, onClose }: MessageContextMenuProps) {
  const { setReplyTo, setContextMenuMessage, deleteMessage, startEditing, startForward } = useChatStore()
  const menuRef = useRef<HTMLDivElement>(null)
  const isOwn = message.senderId === 'me'

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const handleReply = () => { setReplyTo(message); setContextMenuMessage(null); onClose() }
  const handleCopy = () => { navigator.clipboard.writeText(message.text); setContextMenuMessage(null); onClose() }
  const handleEdit = () => { startEditing(message); onClose() }
  const handleForward = () => { startForward(message); onClose() }
  const handleDelete = () => { if (confirm('Удалить сообщение?')) deleteMessage(message); onClose() }

  const menuWidth = 210
  const menuHeight = isOwn ? 210 : 170
  const x = Math.min(position.x, window.innerWidth - menuWidth - 12)
  const y = Math.min(position.y, window.innerHeight - menuHeight - 12)

  const menuItemClass = "w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors rounded-lg"

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white/95 dark:bg-[#1c2733]/95 backdrop-blur-xl rounded-xl shadow-glass-lg border border-gray-100/50 dark:border-gray-700/50 py-1.5 px-1 animate-scale-in"
      style={{ left: x, top: y }}
    >
      <button onClick={handleReply} className={menuItemClass}>
        <Reply size={16} className="text-brand" />
        <span className="font-medium">Ответить</span>
      </button>
      <button onClick={handleCopy} className={menuItemClass}>
        <Copy size={16} className="text-gray-400" />
        <span className="font-medium">Копировать</span>
      </button>
      <button onClick={handleForward} className={menuItemClass}>
        <Share2 size={16} className="text-blue-500" />
        <span className="font-medium">Переслать</span>
      </button>
      <div className="h-px bg-gray-100 dark:bg-gray-700/50 mx-3 my-1" />
      {isOwn && (
        <>
          <button onClick={handleEdit} className={menuItemClass}>
            <Edit3 size={16} className="text-amber-500" />
            <span className="font-medium">Редактировать</span>
          </button>
          <button onClick={handleDelete} className="w-full flex items-center gap-3 px-4 py-2.5 text-[13px] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors rounded-lg font-medium">
            <Trash2 size={16} />
            <span>Удалить</span>
          </button>
        </>
      )}
    </div>
  )
}
