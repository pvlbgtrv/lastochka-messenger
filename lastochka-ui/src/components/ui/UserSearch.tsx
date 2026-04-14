import { useState, useEffect } from 'react'
import { Search, User, UserPlus, MessageCircle, X } from 'lucide-react'
import { useChatStore } from '@/store/chat'
import { useGroupsStore } from '@/store/groups'
import type { User as UserType } from '@/types'

interface UserSearchProps {
  onSelect?: (user: UserType) => void
  onClose?: () => void
  showStartChat?: boolean
  showAddToGroup?: boolean
  groupId?: string
}

export default function UserSearch({ 
  onSelect, 
  onClose, 
  showStartChat = true,
  showAddToGroup = false,
  groupId 
}: UserSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserType[]>([])
  const [isSearching, setIsSearching] = useState(false)
  
  const { searchUsers } = useChatStore()
  const { searchUsersForInvite, addMember } = useGroupsStore()

  // Debounced поиск
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length < 2) {
        setResults([])
        return
      }

      setIsSearching(true)
      
      try {
        // Поиск через FND topic
        const users = await searchUsersForInvite(query)
        setResults(users)
      } catch (err) {
        console.error('Search failed:', err)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [query, searchUsersForInvite])

  const handleStartChat = async (user: UserType) => {
    // Создаём P2P чат с пользователем
    const { setActiveChat } = useChatStore.getState()
    await setActiveChat(user.id)
    onSelect?.(user)
  }

  const handleAddToGroup = async (user: UserType) => {
    if (!groupId) return
    
    try {
      await addMember(groupId, user.id)
      onSelect?.(user)
    } catch (err) {
      console.error('Failed to add member:', err)
    }
  }

  return (
    <div className="w-full max-w-md">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          Поиск пользователей
        </h2>
        {onClose && (
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={20} className="text-gray-500" />
          </button>
        )}
      </div>

      {/* Поле поиска */}
      <div className="relative mb-4">
        <Search 
          size={20} 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" 
        />
        <input
          type="text"
          placeholder="Поиск по имени или логину..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full h-12 pl-10 pr-4 rounded-xl bg-gray-100 dark:bg-gray-800 border-0 text-gray-900 dark:text-white placeholder-gray-400 outline-none focus:ring-2 focus:ring-brand transition-all"
          autoFocus
        />
      </div>

      {/* Результаты */}
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {isSearching && (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-gray-500 dark:text-gray-400">Поиск...</p>
          </div>
        )}

        {!isSearching && query.length >= 2 && results.length === 0 && (
          <div className="text-center py-8">
            <User size={40} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Пользователи не найдены
            </p>
          </div>
        )}

        {results.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors group"
          >
            <div className="flex items-center gap-3">
              {/* Аватар */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-semibold flex-shrink-0">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover rounded-full" />
                ) : (
                  user.name.charAt(0).toUpperCase()
                )}
              </div>

              {/* Информация */}
              <div className="min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">
                  {user.name}
                </p>
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <span className={`w-2 h-2 rounded-full ${user.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                  {user.online ? 'Онлайн' : 'Не в сети'}
                </div>
              </div>
            </div>

            {/* Действия */}
            <div className="flex items-center gap-2">
              {showStartChat && (
                <button
                  onClick={() => handleStartChat(user)}
                  className="p-2 text-brand hover:bg-brand/10 rounded-lg transition-colors"
                  title="Начать чат"
                >
                  <MessageCircle size={18} />
                </button>
              )}
              {showAddToGroup && (
                <button
                  onClick={() => handleAddToGroup(user)}
                  className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                  title="Добавить в группу"
                >
                  <UserPlus size={18} />
                </button>
              )}
              {onSelect && !showStartChat && !showAddToGroup && (
                <button
                  onClick={() => onSelect(user)}
                  className="px-3 py-1.5 text-sm bg-brand text-white rounded-lg hover:bg-brand-dark transition-colors"
                >
                  Выбрать
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Подсказка */}
      {query.length < 2 && (
        <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
          Введите минимум 2 символа для поиска
        </p>
      )}
    </div>
  )
}
