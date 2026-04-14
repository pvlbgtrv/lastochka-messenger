import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import RegisterForm from './RegisterForm'
import { Eye, EyeOff, Shield, Server, Code } from 'lucide-react'

type AuthMode = 'login' | 'register'

const features = [
  { icon: <Code size={15} />, text: 'Открытый исходный код — GPL v3' },
  { icon: <Server size={15} />, text: 'Серверы расположены в России' },
  { icon: <Shield size={15} />, text: 'Без рекламы и скрытого трекинга' },
]

const inputClass =
  'w-full h-12 px-4 rounded-xl bg-gray-50/80 dark:bg-[#242f3d]/60 border border-gray-200/50 dark:border-white/5 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-brand/60 focus:ring-2 focus:ring-brand/10 focus:bg-white dark:focus:bg-[#2a3547] transition-all duration-200 text-[15px]'

export default function LoginScreen() {
  const { login, isLoading, error } = useAuthStore()
  const [mode, setMode] = useState<AuthMode>('login')
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await login(username.trim(), password)
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden">

      {/* ── Левая панель: изображение + фраза ─────────────────── */}
      <div className="hidden lg:flex lg:w-[52%] relative flex-col overflow-hidden flex-shrink-0">
        {/* Фоновое изображение */}
        <img
          src="/slide.jpg"
          alt=""
          className="absolute inset-0 w-full h-full object-cover object-center"
          aria-hidden="true"
        />
        {/* Затемнение сверху вниз */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0D1F]/90 via-[#0B0D1F]/65 to-[#0B0D1F]/40" />

        {/* Контент поверх */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          {/* Логотип */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center shadow-lg flex-shrink-0">
              <img src="/logo.png" alt="Ласточка" className="w-6 h-6 object-contain" />
            </div>
            <span className="text-white text-xl font-bold tracking-tight">Ласточка</span>
          </div>

          {/* Основной текст — по центру */}
          <div className="flex-1 flex flex-col justify-center max-w-md">
            <h2 className="text-4xl xl:text-5xl font-bold text-white leading-tight mb-5">
              Мессенджер,<br />
              которому можно<br />
              <span className="text-brand">доверять.</span>
            </h2>
            <p className="text-white/60 text-lg leading-relaxed mb-10">
              Общайтесь свободно — ваши данные остаются вашими.
            </p>

            {/* Три пункта */}
            <div className="space-y-3">
              {features.map((f) => (
                <div key={f.text} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-brand flex-shrink-0">
                    {f.icon}
                  </div>
                  <span className="text-white/75 text-sm font-medium">{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Низ */}
          <p className="text-white/25 text-xs">
            © {new Date().getFullYear()} Ласточка · Лицензия GPL v3
          </p>
        </div>
      </div>

      {/* ── Правая панель: форма ───────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center overflow-y-auto bg-white dark:bg-[#0e1621] px-6 py-10">
        <div className="w-full max-w-sm">

          {/* Логотип для мобильных */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
              <svg viewBox="0 0 24 24" fill="white" width="20" height="20">
                <path d="M12 3C7 3 3 7 3 12l3-1-1 3c1-1 2.5-1.5 4-1l-1 4 4-2 4 2-1-4c1.5-.5 3 0 4 1l-1-3 3 1c0-5-4-9-9-9z" />
              </svg>
            </div>
            <span className="text-gray-900 dark:text-white text-xl font-bold">Ласточка</span>
          </div>

          {mode === 'login' ? (
            <>
              {/* Заголовок */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  Вход в аккаунт
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Нет аккаунта?{' '}
                  <button
                    onClick={() => setMode('register')}
                    className="text-brand font-semibold hover:underline"
                  >
                    Зарегистрироваться
                  </button>
                </p>
              </div>

              {/* Форма */}
              <form onSubmit={handleSubmit} className="space-y-3">
                <input
                  type="text"
                  placeholder="Логин"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  required
                  className={inputClass}
                />
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Пароль"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className={inputClass}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {error && (
                  <div className="p-3.5 rounded-xl bg-red-50/80 dark:bg-red-900/10 border border-red-100/50 dark:border-red-800/30 animate-slide-down">
                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 rounded-xl bg-gradient-to-r from-brand to-brand-dark hover:shadow-lg hover:shadow-brand/25 disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[15px] transition-all duration-200 mt-2 active:scale-[0.98]"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Вход...
                    </span>
                  ) : 'Войти'}
                </button>

                <div className="text-center pt-1">
                  <a href="#forgot-password" className="text-sm text-gray-400 hover:text-brand transition-colors">
                    Забыли пароль?
                  </a>
                </div>
              </form>
            </>
          ) : (
            <>
              {/* Заголовок регистрации */}
              <div className="mb-8">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                  Создать аккаунт
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Уже есть аккаунт?{' '}
                  <button
                    onClick={() => setMode('login')}
                    className="text-brand font-semibold hover:underline"
                  >
                    Войти
                  </button>
                </p>
              </div>

              <RegisterForm onSuccess={() => {}} />
            </>
          )}
        </div>
      </div>

    </div>
  )
}
