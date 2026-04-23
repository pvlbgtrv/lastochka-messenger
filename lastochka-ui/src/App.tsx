import { useEffect, useState } from 'react'
import { useChatStore } from '@/store/chatStore'
import { useAuthStore } from '@/store/auth'
import ChatListScreen from '@/components/ChatListScreen'
import ChatScreen from '@/components/ChatScreen'
import SettingsScreen from '@/components/SettingsScreen'
import SearchScreen from '@/components/SearchScreen'
import BotsScreen from '@/components/BotsScreen'
import FullscreenImageViewer from '@/components/FullscreenImageViewer'
import { Bird } from 'lucide-react'
import LoginScreen from '@/components/auth/LoginScreen'

export default function App() {
  const { view, darkMode, fullscreenImage, activeChatId } = useChatStore()
  const { isAuthenticated, isLoading, tryAutoLogin } = useAuthStore()
  const isDesktop = useDesktopLayout()

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  useEffect(() => {
    void tryAutoLogin()
  }, [tryAutoLogin])

  if (isLoading && !isAuthenticated) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <LoginScreen />
  }

  const showSettings = view === 'settings' || view === 'profile'
  const showSearch = view === 'search'
  const showBots = view === 'bots'

  if (showSettings || showSearch || showBots) {
    const standalone = showSearch ? <SearchScreen /> : showBots ? <BotsScreen /> : <SettingsScreen />
    return (
      <div className="h-full w-full overflow-hidden relative">
        {isDesktop ? (
          <div className="h-full w-full max-w-[1600px] mx-auto p-3 md:p-4 lg:p-6">
            <div className="h-full rounded-3xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/30 bg-white/50 dark:bg-[#0e1621]/60 border border-white/30 dark:border-white/10 backdrop-blur-sm">
              {standalone}
            </div>
          </div>
        ) : (
          standalone
        )}
      </div>
    )
  }

  return (
    <div className="h-full w-full overflow-hidden relative">
      {isDesktop ? (
        <div className="h-full w-full max-w-[1600px] mx-auto p-3 md:p-4 lg:p-6">
          <div className="h-full grid grid-cols-[360px_1fr] gap-4">
            <div className="h-full rounded-3xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/30">
              <ChatListScreen isDesktop />
            </div>
            <div className="h-full rounded-3xl overflow-hidden shadow-2xl shadow-black/10 dark:shadow-black/30 bg-white/50 dark:bg-[#0e1621]/60 border border-white/30 dark:border-white/10 backdrop-blur-sm">
              {activeChatId ? (
                <ChatScreen isDesktop />
              ) : (
                <EmptyDesktopState />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative h-full w-full">
          {view === 'chatList' && <ChatListScreen />}
          {view === 'chat' && <ChatScreen />}
        </div>
      )}

      {/* Fullscreen image modal */}
      {fullscreenImage && <FullscreenImageViewer />}
    </div>
  )
}

function useDesktopLayout(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 1024px)').matches)

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const onChange = (event: MediaQueryListEvent) => {
      setIsDesktop(event.matches)
    }
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  return isDesktop
}

function EmptyDesktopState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-brand/10 flex items-center justify-center mb-5">
        <Bird size={36} className="text-brand" />
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ласточка Web</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 max-w-sm">
        Выберите чат слева, чтобы открыть переписку. Интерфейс адаптирован для mobile, web и desktop.
      </p>
    </div>
  )
}
