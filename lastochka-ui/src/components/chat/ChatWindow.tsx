import { useState, useEffect } from 'react'
import { useChatStore } from '@/store/chat'
import ChatHeader from './ChatHeader'
import MessagesList from './MessagesList'
import MessageInput from './MessageInput'
import MessageContextMenu from './MessageContextMenu'
import InlineEditBar from './InlineEditBar'
import ForwardModal from './ForwardModal'
import ContactInfo from '@/components/ui/ContactInfo'

interface ChatWindowProps {
  onBack?: () => void
  showMembers?: boolean
  onToggleMembers?: () => void
}

export default function ChatWindow({ onBack, showMembers, onToggleMembers }: ChatWindowProps) {
  const { activeChatId, contextMenuMessage, contextMenuPosition, setContextMenuMessage } = useChatStore()
  const [showContactInfo, setShowContactInfo] = useState(false)
  const { editingMessage, cancelEditing } = useChatStore()

  // Cancel editing when switching chats
  useEffect(() => {
    cancelEditing()
  }, [activeChatId])

  if (!activeChatId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-chat dark:bg-chat-dark chat-bg opacity-60">
        <div className="text-center space-y-3 opacity-60">
          <div className="w-24 h-24 mx-auto rounded-full bg-brand/20 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="w-12 h-12 text-brand" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3C7 3 3 7 3 12l3-1-1 3c1-1 2.5-1.5 4-1l-1 4 4-2 4 2-1-4c1.5-.5 3 0 4 1l-1-3 3 1c0-5-4-9-9-9z" />
            </svg>
          </div>
          <p className="text-2xl font-semibold text-gray-600 dark:text-gray-300">Ласточка</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs">
            Выберите чат, чтобы начать общение
          </p>
        </div>
      </div>
    )
  }

  // If showing contact info
  if (showContactInfo) {
    return (
      <ContactInfo
        contactId={activeChatId}
        onClose={() => setShowContactInfo(false)}
        onOpenChat={() => setShowContactInfo(false)}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full min-w-0 bg-chat dark:bg-chat-dark chat-bg">
      <ChatHeader
        onBack={onBack}
        showMembers={showMembers}
        onToggleMembers={onToggleMembers}
        onOpenContactInfo={() => setShowContactInfo(true)}
      />
      <MessagesList />
      <InlineEditBar />
      <MessageInput />

      {/* Context Menu */}
      {contextMenuMessage && contextMenuPosition && (
        <MessageContextMenu
          message={contextMenuMessage}
          position={contextMenuPosition}
          onClose={() => setContextMenuMessage(null)}
        />
      )}

      {/* Forward Modal */}
      <ForwardModal />
    </div>
  )
}
