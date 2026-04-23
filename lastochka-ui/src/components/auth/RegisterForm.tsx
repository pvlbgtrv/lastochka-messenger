import { useState, type FormEvent, useEffect } from 'react'
import { useAuthStore } from '@/store/auth'
import { cleanPhoneNumber, formatPhoneNumber, isValidPhoneNumber, isValidEmail, normalizeEmail } from '@/lib/phone-utils'
import { Eye, EyeOff } from 'lucide-react'
import { checkAvailability, checkPhoneAvailability, checkLoginAvailability, checkEmailAvailability } from '@/lib/email-auth'

interface RegisterFormProps {
  onSuccess?: () => void
}

export default function RegisterForm({ onSuccess }: RegisterFormProps) {
  const { 
    sendRegistrationEmail, 
    isLoading, 
    error 
  } = useAuthStore()
  
  const [showPassword, setShowPassword] = useState(false)
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false)
  
  // Данные регистрации
  const [login, setLogin] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  
  // Ошибки валидации
  const [loginError, setLoginError] = useState('')
  const [emailError, setEmailError] = useState('')
  const [phoneError, setPhoneError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  
  // Проверка логина на доступность
  const [isCheckingLogin, setIsCheckingLogin] = useState(false)
  const [loginAvailable, setLoginAvailable] = useState<boolean | null>(null)
  
  // Проверка email на доступность
  const [isCheckingEmail, setIsCheckingEmail] = useState(false)
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null)

  // Проверка телефона на доступность
  const [isCheckingPhone, setIsCheckingPhone] = useState(false)
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null)

  // Debounced проверка логина
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (login.length >= 3) {
        setIsCheckingLogin(true)
        const result = await checkLoginAvailability(login)
        setLoginAvailable(result.available)
        setLoginError(result.available ? '' : result.error || 'Этот логин уже занят')
        setIsCheckingLogin(false)
      } else {
        setLoginAvailable(null)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [login])

  // Debounced проверка email
  useEffect(() => {
    setEmailAvailable(null)
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) return
    const timer = setTimeout(async () => {
      setIsCheckingEmail(true)
      const result = await checkEmailAvailability(trimmed)
      setEmailAvailable(result.available)
      setEmailError(result.available ? '' : result.error || 'Этот email уже зарегистрирован')
      setIsCheckingEmail(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [email])

  // Debounced проверка телефона
  useEffect(() => {
    const timer = setTimeout(async () => {
      const cleanedPhone = phone.replace(/\D/g, '')
      if (cleanedPhone.length === 11) {
        setIsCheckingPhone(true)
        const result = await checkPhoneAvailability(cleanedPhone)
        setPhoneAvailable(result.available)
        setPhoneError(result.available ? '' : result.error || 'Этот номер уже зарегистрирован')
        setIsCheckingPhone(false)
      } else {
        setPhoneAvailable(null)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [phone])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value)
    setPhone(formatted)
    setPhoneError('')
  }

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value)
    setEmailError('')
    setEmailAvailable(null)
  }

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value)
    setPasswordError('')
  }

  const handlePasswordConfirmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPasswordConfirm(e.target.value)
  }

  const validateForm = (): boolean => {
    let isValid = true

    // Проверка логина
    if (login.length < 3) {
      setLoginError('Логин должен быть не менее 3 символов')
      isValid = false
    } else if (!/^[a-zA-Z0-9_]+$/.test(login)) {
      setLoginError('Логин может содержать только буквы, цифры и подчёркивание')
      isValid = false
    } else if (loginAvailable === false) {
      setLoginError('Этот логин уже занят')
      isValid = false
    }

    // Проверка email
    if (!isValidEmail(email)) {
      setEmailError('Введите корректный email')
      isValid = false
    } else if (emailAvailable === false) {
      setEmailError('Этот email уже зарегистрирован')
      isValid = false
    }

    // Проверка телефона
    if (!isValidPhoneNumber(phone)) {
      setPhoneError('Введите корректный номер телефона')
      isValid = false
    } else if (phoneAvailable === false) {
      setPhoneError('Этот номер уже зарегистрирован')
      isValid = false
    }

    // Проверка пароля
    if (password.length < 6) {
      setPasswordError('Пароль должен быть не менее 6 символов')
      isValid = false
    } else if (password !== passwordConfirm) {
      setPasswordError('Пароли не совпадают')
      isValid = false
    }

    return isValid
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    // Hard server-side duplicate check on submit to avoid race conditions.
    const normalizedLogin = login.trim().toLowerCase()
    const normalizedEmail = normalizeEmail(email)
    const normalizedPhone = cleanPhoneNumber(phone)

    setIsCheckingLogin(true)
    setIsCheckingEmail(true)
    setIsCheckingPhone(true)
    const availability = await checkAvailability(
      {
        login: normalizedLogin,
        email: normalizedEmail,
        phone: normalizedPhone,
      },
      // In production this endpoint may be unavailable/misrouted.
      // Do not block registration on transport/proxy errors:
      // server-side account creation will still enforce uniqueness.
      { failOpen: true },
    )
    setIsCheckingLogin(false)
    setIsCheckingEmail(false)
    setIsCheckingPhone(false)

    const loginDup = availability.loginAvailable === false
    const emailDup = availability.emailAvailable === false
    const phoneDup = availability.phoneAvailable === false

    if (loginDup || emailDup || phoneDup) {
      if (loginDup) setLoginError('Этот логин уже занят')
      if (emailDup) setEmailError('Этот email уже зарегистрирован')
      if (phoneDup) setPhoneError('Этот номер уже зарегистрирован')
      return
    }

    // Регистрация без верификации email
    await sendRegistrationEmail(
      normalizedLogin,
      password,
      normalizedEmail,
      normalizedPhone,
      displayName.trim() || normalizedLogin
    )
    
    // После успешной регистрации переходим на главную
    onSuccess?.()
  }

  const inputClass =
    'w-full h-12 px-4 rounded-xl bg-white dark:bg-[#242f3d] border border-black/10 dark:border-white/10 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 outline-none focus:border-brand dark:focus:border-brand transition-colors text-[15px]'

  const labelClass = 'block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
  const errorClass = 'text-sm text-red-500 dark:text-red-400 mt-1'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Логин */}
      <div>
        <label className={labelClass}>
          Логин <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="text"
            placeholder="username"
            value={login}
            onChange={(e) => setLogin(e.target.value.toLowerCase().replace(/[^a-zA-Z0-9_]/g, ''))}
            autoComplete="username"
            required
            disabled={isLoading || isCheckingLogin}
            className={`${inputClass} ${loginError ? 'border-red-500' : ''}`}
          />
          {isCheckingLogin && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {loginAvailable === true && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        {loginError && <p className={errorClass}>{loginError}</p>}
        {!loginError && login.length >= 3 && loginAvailable === true && (
          <p className="text-sm text-green-500 mt-1">Логин доступен</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className={labelClass}>
          Email <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="email"
            placeholder="example@mail.ru"
            value={email}
            onChange={handleEmailChange}
            autoComplete="email"
            required
            disabled={isLoading || isCheckingEmail}
            className={`${inputClass} ${emailError ? 'border-red-500' : ''}`}
          />
          {isCheckingEmail && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {emailAvailable === true && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        {emailError && <p className={errorClass}>{emailError}</p>}
        {!emailError && emailAvailable === true && (
          <p className="text-sm text-green-500 mt-1">Email доступен</p>
        )}
      </div>

      {/* Телефон */}
      <div>
        <label className={labelClass}>
          Телефон <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type="tel"
            placeholder="+7 (999) 999-99-99"
            value={phone}
            onChange={handlePhoneChange}
            autoComplete="tel"
            required
            disabled={isLoading || isCheckingPhone}
            className={`${inputClass} ${phoneError ? 'border-red-500' : ''}`}
          />
          {isCheckingPhone && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {phoneAvailable === true && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </div>
        {phoneError && <p className={errorClass}>{phoneError}</p>}
        {!phoneError && phone.length === 18 && phoneAvailable === true && (
          <p className="text-sm text-green-500 mt-1">Номер доступен</p>
        )}
      </div>

      {/* Отображаемое имя */}
      <div>
        <label className={labelClass}>
          Ваше имя <span className="text-gray-400">(необязательно)</span>
        </label>
        <input
          type="text"
          placeholder="Как к вам обращаться"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          autoComplete="name"
          disabled={isLoading}
          className={inputClass}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Будет отображаться в списке контактов. Если не указать, будет использоваться логин.
        </p>
      </div>

      {/* Пароль */}
      <div>
        <label className={labelClass}>
          Пароль <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            placeholder="Минимум 6 символов"
            value={password}
            onChange={handlePasswordChange}
            autoComplete="new-password"
            required
            disabled={isLoading}
            className={`${inputClass} ${passwordError ? 'border-red-500' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {passwordError && <p className={errorClass}>{passwordError}</p>}
      </div>

      {/* Подтверждение пароля */}
      <div>
        <label className={labelClass}>
          Подтверждение пароля <span className="text-red-500">*</span>
        </label>
        <div className="relative">
          <input
            type={showPasswordConfirm ? 'text' : 'password'}
            placeholder="Повторите пароль"
            value={passwordConfirm}
            onChange={handlePasswordConfirmChange}
            autoComplete="new-password"
            required
            disabled={isLoading}
            className={`${inputClass} ${passwordConfirm && password !== passwordConfirm ? 'border-red-500' : ''}`}
          />
          <button
            type="button"
            onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            disabled={isLoading}
          >
            {showPasswordConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        {passwordConfirm && password === passwordConfirm && (
          <p className="text-sm text-green-500 mt-1">Пароли совпадают</p>
        )}
      </div>

      {/* Общая ошибка */}
      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Кнопка отправки */}
      <button
        type="submit"
        disabled={isLoading || isCheckingLogin || isCheckingEmail || isCheckingPhone}
        className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-semibold text-[15px] transition-colors"
      >
        {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
      </button>

      {/* Информация */}
      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
        Регистрируясь, вы принимаете{' '}
        <a href="#terms" className="text-brand hover:underline">
          условия использования
        </a>{' '}
        и{' '}
        <a href="#privacy" className="text-brand hover:underline">
          политику конфиденциальности
        </a>
      </p>
    </form>
  )
}
