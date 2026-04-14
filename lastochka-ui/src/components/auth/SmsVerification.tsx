import { useState, type FormEvent, useRef, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'

interface SmsVerificationProps {
  phone: string
  onComplete: (code: string) => void
  onBack: () => void
  isLoading: boolean
  error: string | null
  title?: string
  description?: string
}

export default function SmsVerification({
  phone,
  onComplete,
  onBack,
  isLoading,
  error,
  title = 'Введите код из SMS',
  description = 'Мы отправили код подтверждения на ваш номер',
}: SmsVerificationProps) {
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Форматирование номера для отображения
  const formatPhoneForDisplay = (phoneNum: string) => {
    const digits = phoneNum.replace(/\D/g, '')
    if (digits.length === 11 && digits.startsWith('7')) {
      return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`
    }
    return phoneNum
  }

  // Автофокус на первом поле
  useEffect(() => {
    if (inputRefs.current[0]) {
      inputRefs.current[0]?.focus()
    }
  }, [])

  const handleChange = (index: number, value: string) => {
    // Разрешаем только цифры
    if (value && !/^\d$/.test(value)) return

    const newCode = [...code]
    newCode[index] = value
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
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    
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
      >
        <ArrowLeft size={16} />
        Назад
      </button>

      {/* Заголовок */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 mx-auto rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-8 h-8 text-brand">
            <path d="M12 18v-6M12 6v.01" strokeLinecap="round" />
            <circle cx="12" cy="12" r="9" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {description}
        </p>
        <p className="text-sm font-medium text-brand mt-2">
          {formatPhoneForDisplay(phone)}
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
              inputMode="numeric"
              pattern="\d*"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className={inputClass}
              aria-label={`Цифра ${index + 1}`}
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
          Не получили код?{' '}
          <button className="text-brand dark:text-brand hover:underline font-medium">
            Отправить повторно
          </button>
        </p>
      </div>
    </div>
  )
}
