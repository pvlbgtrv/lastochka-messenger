import { useState, useEffect } from 'react'
import { useChatStore } from '@/store/chat'
import { useGroupsStore } from '@/store/groups'
import Avatar from '@/components/ui/Avatar'
import { X, MessageCircle, Phone, Video, User, Trash2, Copy } from 'lucide-react'
import { getTinode, contactDisplayName } from '@/lib/tinode-client'

interface ContactInfoProps {
  contactId: string  // topic name (usrXXX, grpXXX, chnXXX)
  onClose: () => void
  onOpenChat?: () => void
}

export default function ContactInfo({ contactId, onClose, onOpenChat }: ContactInfoProps) {
  const { chats, setActiveChat } = useChatStore()
  const { selectedGroup, selectGroup } = useGroupsStore()

  const chat = chats.find((c) => c.id === contactId)
  const isGroup = contactId.startsWith('grp')
  const isChannel = contactId.startsWith('chn')
  const isP2P = !isGroup && !isChannel

  // Загружаем данные группы если нужно
  useEffect(() => {
    if ((isGroup || isChannel) && !selectedGroup) {
      selectGroup(contactId)
    }
  }, [contactId, isGroup, isChannel])

  const displayName = chat?.name || contactId
  const avatarUrl = chat?.avatar
  const online = isP2P ? (chat?.online ?? false) : undefined
  const membersCount = chat?.membersCount || selectedGroup?.membersCount || 0
  const description = chat?.description || selectedGroup?.description

  const handleOpenChat = () => {
    setActiveChat(contactId)
    onOpenChat?.()
  }

  const handleCopyId = () => {
    navigator.clipboard.writeText(contactId)
  }

  const handleDeleteChat = () => {
    if (confirm('Удалить чат? Это действие нельзя отменить.')) {
      const tn = getTinode()
      const topic = tn.getTopic(contactId)
      topic.delTopic(true).then(() => {
        setActiveChat(null)
        onClose()
      }).catch((err: unknown) => {
        console.error('Failed to delete chat', err)
      })
    }
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800 sticky top-0 bg-white dark:bg-gray-900 z-10">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Информация</h2>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Profile section */}
      <div className="flex flex-col items-center py-8 border-b border-gray-200 dark:border-gray-800">
        <Avatar
          name={displayName}
          src={avatarUrl}
          size="xl"
          online={online}
        />
        <h3 className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">{displayName}</h3>
        {online && (
          <p className="text-sm text-green-500 mt-1">в сети</p>
        )}
        {isGroup && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {membersCount} участников
          </p>
        )}
        {isChannel && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {membersCount} подписчиков
          </p>
        )}
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center px-8 max-w-md">
            {description}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="py-2">
        {/* Написать */}
        <button
          onClick={handleOpenChat}
          className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <MessageCircle size={22} className="text-brand" />
          <span className="text-gray-900 dark:text-white">Написать</span>
        </button>

        {/* Позвонить (stub) */}
        <button
          disabled
          className="w-full flex items-center gap-4 px-6 py-4 opacity-50 cursor-not-allowed"
        >
          <Phone size={22} className="text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">Позвонить</span>
          <span className="ml-auto text-xs text-gray-400">скоро</span>
        </button>

        {/* Видеозвонок (stub) */}
        <button
          disabled
          className="w-full flex items-center gap-4 px-6 py-4 opacity-50 cursor-not-allowed"
        >
          <Video size={22} className="text-gray-400" />
          <span className="text-gray-500 dark:text-gray-400">Видеозвонок</span>
          <span className="ml-auto text-xs text-gray-400">скоро</span>
        </button>
      </div>

      {/* Media, links, files (stub) */}
      <div className="py-2 border-t border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Медиа, ссылки и файлы
          </h4>
          <div className="grid grid-cols-3 gap-1">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center"
              >
                <span className="text-xs text-gray-400">—</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="py-2 border-t border-gray-200 dark:border-gray-800">
        <div className="px-6 py-4">
          <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            Подробная информация
          </h4>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <User size={18} className="text-gray-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">ID</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{contactId}</span>
                <button
                  onClick={handleCopyId}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors"
                >
                  <Copy size={14} className="text-gray-400" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="py-4 border-t border-gray-200 dark:border-gray-800 mt-auto">
        <button
          onClick={handleDeleteChat}
          className="w-full flex items-center justify-center gap-3 px-6 py-3 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          <Trash2 size={18} />
          <span>Удалить чат</span>
        </button>
      </div>
    </div>
  )
}
