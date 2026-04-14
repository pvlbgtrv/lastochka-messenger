import { useChatStore } from '@/store/chat'
import { useGroupsStore } from '@/store/groups'
import Avatar from '@/components/ui/Avatar'
import Icon from '@/components/ui/Icon'
import { Users, ArrowLeft } from 'lucide-react'

interface ChatHeaderProps {
  onBack?: () => void
  showMembers?: boolean
  onToggleMembers?: () => void
  onOpenContactInfo?: () => void
}

export default function ChatHeader({ onBack, showMembers, onToggleMembers, onOpenContactInfo }: ChatHeaderProps) {
  const { chats, activeChatId, typingUsers, typingNames } = useChatStore()
  const { selectedGroup } = useGroupsStore()
  const chat = chats.find((c) => c.id === activeChatId)

  if (!chat) return null

  const isGroup = chat.isGroup || (selectedGroup && !selectedGroup.isChannel)
  const isP2P = !isGroup

  const typingUserIds = activeChatId ? Array.from(typingUsers[activeChatId] || new Set()) : []
  const typingText = typingUserIds.length > 0
    ? typingUserIds.map(id => typingNames[id as string] || 'Пользователь').join(', ') + (typingUserIds.length === 1 ? ' печатает' : ' печатают')
    : ''

  let subtitle = ''
  if (typingText) {
    subtitle = typingText
  } else if (isGroup) {
    subtitle = `${chat.membersCount || selectedGroup?.membersCount || 0} участников`
  } else {
    subtitle = chat.online ? 'в сети' : 'был(а) недавно'
  }

  return (
    <header className="flex items-center gap-3 px-3 h-16 bg-white/90 dark:bg-[#17212b] backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-800/50 flex-shrink-0">
      {onBack && (
        <button
          onClick={onBack}
          className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/60 text-gray-500 dark:text-gray-400 transition-all duration-200 active:scale-90"
        >
          <ArrowLeft size={21} />
        </button>
      )}

      <div
        className="cursor-pointer transition-transform duration-200 active:scale-95"
        onClick={() => onOpenContactInfo?.()}
      >
        <Avatar name={chat.name} src={chat.avatar} size="md" online={isP2P ? chat.online : undefined} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-semibold text-[15px] leading-tight text-gray-900 dark:text-white truncate">
            {chat.name}
          </p>
          {isGroup && <Users size={15} className="text-gray-400 dark:text-gray-500 flex-shrink-0" />}
        </div>
        <p className={`text-[12px] truncate transition-all duration-200 ${
          typingText
            ? 'text-brand dark:text-brand-dark font-medium animate-pulse'
            : 'text-gray-400 dark:text-gray-500'
        }`}>
          {subtitle}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/60 text-gray-400 dark:text-gray-500 transition-all duration-200 active:scale-90">
          <Icon name="search" size={19} />
        </button>

        {isGroup && onToggleMembers && (
          <button
            onClick={onToggleMembers}
            className={`w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 active:scale-90 ${
              showMembers
                ? 'bg-brand/10 text-brand'
                : 'hover:bg-gray-100/80 dark:hover:bg-gray-800/60 text-gray-400 dark:text-gray-500'
            }`}
            title={showMembers ? 'Скрыть участников' : 'Показать участников'}
          >
            <Users size={19} />
          </button>
        )}

        <button className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-gray-100/80 dark:hover:bg-gray-800/60 text-gray-400 dark:text-gray-500 transition-all duration-200 active:scale-90">
          <Icon name="more_vert" size={19} />
        </button>
      </div>
    </header>
  )
}
