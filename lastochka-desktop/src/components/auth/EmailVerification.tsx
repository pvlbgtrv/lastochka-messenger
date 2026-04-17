import { useState, useRef, useEffect } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'

interface EmailVerificationProps {
  email: string
  onComplete: (code: string) => void
  onBack: () => void
  isLoading: boolean
  error: string | null
  title?: string
  description?: string
}

export default function EmailVerification({
  email,
  onComplete,
  onBack,
  isLoading,
  error,
  title = 'Введите код из письма',
  description = 'Мы отправили код подтверждения на ваш email',
}: EmailVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Форматирование email для отображения (скрываем часть)
  const formatEmailForDisplay = (emailAddr: string) => {
    const [name, domain] = emailAddr.split('@')
    if (!domain) return emailAddr
    
    // Показываем первые 2 символа и ***@domain
    const maskedName = name.length > 2 
      ? name.slice(0, 2) + '***' 
      : name + '**'
    
    return `${maskedName}@${domain}`
  }

  // Автофокус на первом поле
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus()
    }
  }, [])

  const handleChange = (index: number, value: string) => {
    // Разрешаем только цифры и буквы
    if (value && !/^[a-zA-Z0-9]$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value.toUpperCase()
    setCode(newCode)

    // Автопереход к следующему полю
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }

    // Проверка на заполненность всех полей
    const fullCode = newCode.join('')
    if (fullCode.length === 6) {
      onComplete(fullCode)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    // Переход назад при Backspace
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData('text').replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase()
    
    if (pastedData.length === 6) {
      const newCode = pastedData.split('')
      setCode(newCode)
      onComplete(pastedData)
    }
  }

  const inputClass =
    'w-12 h-14 text-center text-xl font-semibold rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 text-gray-900 dark:text-gray-100 outline-none focus:border-brand dark:focus:border-brand transition-colors'

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* Кнопка назад */}
      <button
        onClick={onBack}
        className="self-start flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-6"
        disabled={isLoading}
      >
        <ArrowLeft size={16} />
        Назад
      </button>

      {/* Заголовок */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center mb-4">
          <Mail className="w-8 h-8 text-brand" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        <p className="text-sm font-medium text-brand mt-2">
          {formatEmailForDisplay(email)}
        </p>
      </div>

      {/* Поля ввода кода */}
      <form onSubmit={(e) => e.preventDefault()} className="mb-6">
        <div className="flex gap-2" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="text"
              autoCapitalize="characters"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className={inputClass}
              aria-label={`Символ ${index + 1}`}
            />
          ))}
        </div>
      </form>

      {/* Ошибка */}
      {error && (
        <p className="text-sm text-red-500 dark:text-red-400 text-center mb-4">
          {error}
        </p>
      )}

      {/* Индикатор загрузки */}
      {isLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Проверяем код...
        </p>
      )}

      {/* Повторная отправка */}
      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Не получили письмо?{' '}
          <button 
            className="text-brand dark:text-brand hover:underline font-medium"
            disabled={isLoading}
          >
            Отправить повторно
          </button>
        </p>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
          Проверьте также папку «Спам»
        </p>
      </div>
    </div>
  )
}
