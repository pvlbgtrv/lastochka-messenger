import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useGroupsStore } from '@/store/groups'
import { useNetworkMonitor } from '@/hooks/useNetworkMonitor'
import Sidebar from '@/components/layout/Sidebar'
import ChatWindow from '@/components/chat/ChatWindow'
import LoginScreen from '@/components/auth/LoginScreen'
import MembersPanel from '@/components/ui/MembersPanel'
import { Wifi, WifiOff } from 'lucide-react'

export default function App() {
  const { isAuthenticated, isLoading, tryAutoLogin } = useAuthStore()
  const { darkMode } = useChatStore()
  const network = useNetworkMonitor()

  useEffect(() => {
    tryAutoLogin()
  }, [tryAutoLogin])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  if (isLoading && !isAuthenticated) {
    return (
      <div className="flex h-full items-center justify-center bg-chat dark:bg-chat-dark">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-400 dark:text-gray-500">Подключение...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  return <ChatLayout />
}

function ChatLayout() {
  const { activeChatId } = useChatStore()
  const { selectedGroup, selectGroup } = useGroupsStore()
  const network = useNetworkMonitor()
  const [mobileView, setMobileView] = useState<'sidebar' | 'chat'>('sidebar')
  const [showMembersPanel, setShowMembersPanel] = useState(false)

  // When a chat is opened, switch to chat view on mobile
  useEffect(() => {
    if (activeChatId) {
      setMobileView('chat')
    }
  }, [activeChatId])

  // Загружаем данные группы при открытии панели участников
  const handleToggleMembers = async () => {
    if (!showMembersPanel && activeChatId && activeChatId.startsWith('grp')) {
      await selectGroup(activeChatId)
    }
    setShowMembersPanel((v) => !v)
  }

  // Закрываем панель участников при смене чата
  useEffect(() => {
    setShowMembersPanel(false)
  }, [activeChatId])

  return (
    <div className="flex h-full w-full overflow-hidden relative">
      {/* Offline Banner */}
      {!network.isOnline && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-red-500/90 backdrop-blur-xl text-white px-5 py-2.5 flex items-center gap-2.5 text-sm font-medium shadow-glass-lg rounded-xl animate-slide-down">
          <WifiOff size={16} />
          <span>Нет подключения</span>
          {network.reconnectCount > 0 && (
            <span className="text-xs opacity-80">
              (#{network.reconnectCount})
            </span>
          )}
        </div>
      )}

      {/* Reconnecting banner */}
      {network.isOnline && network.lastReconnectAttempt && network.reconnectCount > 0 && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 bg-brand/90 backdrop-blur-xl text-white px-5 py-2.5 flex items-center gap-2.5 text-sm font-medium shadow-glass-lg rounded-xl animate-slide-down">
          <Wifi size={16} className="animate-pulse" />
          <span>Переподключение...</span>
        </div>
      )}

      {/* Sidebar - full width on mobile, fixed width on desktop */}
      <div
        className={[
          'flex-col h-full w-full flex-shrink-0',
          mobileView === 'sidebar' ? 'flex' : 'hidden',
          'md:flex md:w-80 lg:w-96',
        ].join(' ')}
      >
        <Sidebar />
      </div>

      {/* Chat area - full screen on mobile, flex-1 on desktop */}
      <div
        className={[
          'flex flex-col h-full w-full min-w-0',
          mobileView === 'chat' ? 'flex' : 'hidden',
          'md:flex',
        ].join(' ')}
      >
        <ChatWindow
          onBack={() => setMobileView('sidebar')}
          showMembers={showMembersPanel}
          onToggleMembers={handleToggleMembers}
        />
      </div>

      {/* Панель участников (для групп) */}
      {selectedGroup && showMembersPanel && (
        <MembersPanel
          isOpen={showMembersPanel}
          onClose={() => setShowMembersPanel(false)}
          groupId={selectedGroup.id}
          canAddMembers
          canRemoveMembers
        />
      )}
    </div>
  )
}
