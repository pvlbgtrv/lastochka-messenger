import { useState, useEffect } from 'react'
import {
  MessageCircle,
  Users,
  Search,
  Plus,
  Settings,
  Volume2,
  VolumeX
} from 'lucide-react'
import { useChatStore } from '@/store/chat'
import { useGroupsStore } from '@/store/groups'
import { useAuthStore } from '@/store/auth'
import ChatItem from '../sidebar/ChatItem'
import CreateGroupModal from '../ui/CreateGroupModal'
import SettingsScreen from '../ui/SettingsScreen'
import type { User } from '@/types'

type TabType = 'chats' | 'groups'

export default function Sidebar() {
  const [activeTab, setActiveTab] = useState<TabType>('chats')
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [searchResults, setSearchResults] = useState<User[]>([])
  const [isSearching, setIsSearching] = useState(false)

  const { activeChatId, setActiveChat, chats, toggleSound, playSound } = useChatStore()
  const { groups, searchUsersForInvite } = useGroupsStore()
  const { displayName, avatar } = useAuthStore()

  // FND поиск пользователей с debounce
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    setIsSearching(true)
    const timer = setTimeout(async () => {
      const results = await searchUsersForInvite(searchQuery)
      setSearchResults(results)
      setIsSearching(false)
    }, 400)
    return () => clearTimeout(timer)
  }, [searchQuery, searchUsersForInvite])

  const filteredChats = chats.filter(chat =>
    chat.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredGroups = groups.filter(group =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const tabs = [
    { id: 'chats' as TabType, label: 'Чаты', icon: MessageCircle, count: chats.reduce((acc, c) => acc + (c.unread || 0), 0) },
    { id: 'groups' as TabType, label: 'Группы', icon: Users, count: groups.length },
  ]

  return (
    <>
      {/* Sidebar with glass effect */}
      <aside className="flex flex-col w-full md:w-80 lg:w-96 h-full bg-white/95 dark:bg-[#17212b] backdrop-blur-xl border-r border-gray-200/50 dark:border-gray-800/50">
        {/* Header with gradient border */}
        <div className="p-4 border-b border-gray-100/80 dark:border-gray-800/80">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-bold overflow-hidden shadow-lg shadow-brand/20">
                  {avatar
                    ? <img src={avatar} alt={displayName || ''} className="w-full h-full object-cover" />
                    : displayName?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 border-2 border-white dark:border-[#17212b] rounded-full online-pulse" />
              </div>
              <div>
                <p className="font-semibold text-[15px] text-gray-900 dark:text-gray-100">{displayName || 'Пользователь'}</p>
                <p className="text-[11px] text-green-500 font-medium tracking-wide">Онлайн</p>
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {[
                { icon: playSound ? Volume2 : VolumeX, title: playSound ? 'Отключить звук' : 'Включить звук', action: toggleSound },
                { icon: Settings, title: 'Настройки', action: () => setShowSettings(true) },
              ].map(({ icon: Icon, title, action }) => (
                <button
                  key={title}
                  onClick={action}
                  className="p-2 rounded-lg text-gray-400 dark:text-gray-500 hover:text-brand dark:hover:text-brand hover:bg-brand/5 dark:hover:bg-brand/10 transition-all duration-200"
                  title={title}
                >
                  <Icon size={19} />
                </button>
              ))}
            </div>
          </div>

          {/* Search with modern styling */}
          <div className="relative group">
            <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-brand transition-colors" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-11 pl-11 pr-4 rounded-xl bg-gray-50/80 dark:bg-[#242f3d]/60 border border-gray-200/50 dark:border-gray-700/50 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand/50 focus:bg-white dark:focus:bg-[#2a3547] transition-all duration-200 text-sm"
            />
          </div>
        </div>

        {/* Tabs with modern pill style */}
        <div className="flex gap-1.5 p-3 pb-2 border-b border-gray-100/80 dark:border-gray-800/80 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-brand text-white shadow-lg shadow-brand/25 scale-[1.02]'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100/60 dark:hover:bg-[#242f3d]/60'
              }`}
            >
              <tab.icon size={17} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[11px] px-1.5 py-0.5 rounded-full leading-none font-semibold ${
                  activeTab === tab.id
                    ? 'bg-white/20 text-white'
                    : 'bg-gray-200/80 dark:bg-gray-700/80 text-gray-600 dark:text-gray-300'
                }`}>
                  {tab.count > 99 ? '99+' : tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {/* Чаты */}
          {activeTab === 'chats' && (
            <div className="space-y-0.5">
              {searchQuery.length >= 2 && (
                <>
                  {isSearching ? (
                    <div className="flex flex-col items-center justify-center py-12">
                      <div className="w-8 h-8 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">Поиск...</p>
                    </div>
                  ) : searchResults.length > 0 ? (
                    <>
                      <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider px-3 py-2">Найденные</p>
                      {searchResults.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => { setActiveChat(user.id); setSearchQuery('') }}
                          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-100/80 dark:hover:bg-[#242f3d]/60 active:scale-[0.98] transition-all duration-150 text-left"
                        >
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-white font-semibold flex-shrink-0 shadow-md shadow-brand/20">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-gray-900 dark:text-gray-100 truncate text-[14px]">{user.name}</p>
                            <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{user.id}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                      <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-[#242f3d] flex items-center justify-center mb-3">
                        <Search size={24} className="opacity-40" />
                      </div>
                      <p className="text-sm font-medium">Никого не найдено</p>
                    </div>
                  )}
                </>
              )}

              {searchQuery.length < 2 && (
                filteredChats.length > 0 ? (
                  filteredChats.map((chat) => (
                    <ChatItem
                      key={chat.id}
                      chat={chat}
                      active={chat.id === activeChatId}
                      onClick={() => setActiveChat(chat.id)}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
                    <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#242f3d] flex items-center justify-center mb-4">
                      <MessageCircle size={28} className="opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Нет чатов</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Начните общение</p>
                  </div>
                )
              )}
            </div>
          )}

          {/* Группы */}
          {activeTab === 'groups' && (
            <div className="space-y-0.5">
              <button
                onClick={() => setShowCreateModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-gray-200/60 dark:border-gray-700/60 text-gray-400 dark:text-gray-500 hover:border-brand/50 hover:text-brand dark:hover:text-brand hover:bg-brand/5 dark:hover:bg-brand/10 transition-all duration-200 mb-2"
              >
                <Plus size={18} />
                <span className="text-sm font-medium">Создать группу</span>
              </button>
              {filteredGroups.length > 0 ? (
                filteredGroups.map((group) => (
                  <ChatItem
                    key={group.id}
                    chat={{
                      id: group.id,
                      name: group.name,
                      avatar: group.avatar,
                      isGroup: true,
                      membersCount: group.membersCount,
                    }}
                    active={group.id === activeChatId}
                    onClick={() => setActiveChat(group.id)}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400 dark:text-gray-500">
                  <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-[#242f3d] flex items-center justify-center mb-4">
                    <Users size={28} className="opacity-40" />
                  </div>
                  <p className="text-sm font-medium">Нет групп</p>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* Modal для создания группы */}
      <CreateGroupModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {/* Modal настроек with glass effect */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowSettings(false)}>
          <div className="w-full max-w-2xl h-[80vh] md:max-h-[90vh] bg-white dark:bg-[#17212b] rounded-2xl shadow-glass-lg overflow-hidden animate-scale-in" onClick={(e) => e.stopPropagation()}>
            <SettingsScreen onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </>
  )
}
