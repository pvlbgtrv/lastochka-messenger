import { create } from 'zustand'
import {
  getTinode,
  saveAuthToken,
  loadAuthToken,
  removeAuthToken,
  getAvatarUrl,
} from '@/lib/tinode-client'
import { useChatStore } from './chatStore'
import { cleanPhoneNumber, normalizeEmail } from '@/lib/phone-utils'
import { 
  verifyEmailCode, 
  registerWithFullProfile,
  completeRegistration,
  checkLoginAvailability,
} from '@/lib/email-auth'

interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  displayName: string | null
  avatar: string | null
  isLoading: boolean
  error: string | null
  
  // Для email-верификации
  emailForVerification: string | null
  loginForVerification: string | null
  passwordForVerification: string | null
  verificationStep: 'none' | 'email-sent' | 'verified'

  // Вход по логину/паролю
  login: (login: string, password: string) => Promise<void>
  
  // Проверка логина на доступность
  checkLogin: (login: string) => Promise<boolean>
  
  // Регистрация с полным профилем (email, телефон, пароль)
  registerWithProfile: (
    login: string,
    password: string,
    email: string,
    phone: string,
    displayName: string
  ) => Promise<boolean>
  
  // Отправка email кода для регистрации
  sendRegistrationEmail: (
    login: string,
    password: string,
    email: string,
    phone: string,
    displayName: string
  ) => Promise<boolean>
  
  // Проверка email кода при регистрации
  verifyRegistrationEmail: (code: string) => Promise<void>
  
  logout: () => Promise<void>
  deleteAccount: () => Promise<void>
  tryAutoLogin: () => Promise<void>
}

// Called after successful authentication to subscribe to the 'me' topic
// and start receiving contact list updates.
function onLoginSuccess() {
  const tn = getTinode()
  const userId = tn.getCurrentUserID()

  // Get display name via me topic meta callback
  const me = tn.getMeTopic()
  me.onMetaDesc = (desc: unknown) => {
    const pub = (desc as { public?: { fn?: string; photo?: { type?: string; data?: string; ref?: string } } } | undefined)?.public
    if (pub?.fn) {
      useAuthStore.setState({ displayName: pub.fn })
    }
    useAuthStore.setState({ avatar: getAvatarUrl(pub?.photo) ?? null })
  }

  useAuthStore.setState({
    isAuthenticated: true,
    userId,
    isLoading: false,
    error: null,
    emailForVerification: null,
    loginForVerification: null,
    passwordForVerification: null,
    verificationStep: 'verified',
  })

  // Persist auth token
  const token = tn.getAuthToken()
  if (token) saveAuthToken(token)

  // Initialize chat store with Tinode connection
  useChatStore.getState().initFromTinode()
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  userId: null,
  displayName: null,
  avatar: null,
  isLoading: false,
  error: null,
  emailForVerification: null,
  loginForVerification: null,
  passwordForVerification: null,
  verificationStep: 'none',

  // Вход по логину/паролю (классический)
  login: async (login, password) => {
    set({ isLoading: true, error: null })
    const tn = getTinode()
    try {
      // Connect if not already connected
      if (!tn.isConnected()) {
        await tn.connect()
      }
      // Login with basic credentials
      const ctrl = await tn.loginBasic(login, password)
      if (ctrl.code >= 300) {
        set({ isLoading: false, error: 'Неверный логин или пароль' })
        return
      }
      onLoginSuccess()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка входа'
      set({ isLoading: false, error: msg })
    }
  },

  // Проверка логина на доступность
  checkLogin: async (login) => {
    const result = await checkLoginAvailability(login)
    return result.available
  },

  // Отправка email для регистрации
  sendRegistrationEmail: async (login, password, email, phone, displayName) => {
    set({ isLoading: true, error: null })
    
    const normalizedEmail = normalizeEmail(email)
    const cleanedPhone = cleanPhoneNumber(phone)
    
    // Создаём учётную запись
    const result = await registerWithFullProfile(
      login,
      password,
      normalizedEmail,
      cleanedPhone,
      displayName
    )
    
    if (result.success) {
      // Успешная регистрация - сразу логинимся
      onLoginSuccess()
      return true
    } else if (result.error) {
      set({ isLoading: false, error: result.error })
      return false
    }

    set({ isLoading: false, error: 'Ошибка регистрации' })
    return false
  },

  // Регистрация с полным профилем
  registerWithProfile: async (login, password, email, phone, displayName) => {
    return get().sendRegistrationEmail(login, password, email, phone, displayName)
  },

  // Проверка email кода при регистрации
  verifyRegistrationEmail: async (code) => {
    const { emailForVerification, loginForVerification, passwordForVerification } = get()
    
    if (!emailForVerification || !loginForVerification || !passwordForVerification) {
      set({ error: 'Данные регистрации не найдены' })
      return
    }
    
    set({ isLoading: true, error: null })
    
    // Проверяем код
    const verifyResult = await verifyEmailCode(emailForVerification, code)
    
    if (!verifyResult.success) {
      set({ 
        isLoading: false, 
        error: verifyResult.error || 'Неверный код подтверждения' 
      })
      return
    }
    
    // После успешной верификации логинимся
    const loginResult = await completeRegistration(loginForVerification, passwordForVerification)
    
    if (loginResult.success) {
      onLoginSuccess()
    } else {
      set({ 
        isLoading: false, 
        error: loginResult.error || 'Ошибка завершения регистрации' 
      })
    }
  },
  
  logout: async () => {
    const tn = getTinode()
    try {
      // Unsubscribe from active topics
      useChatStore.getState().cleanup()
      await tn.logout()
    } catch {
      // ignore
    }
    removeAuthToken()
    set({ 
      isAuthenticated: false, 
      userId: null, 
      displayName: null, 
      error: null,
      emailForVerification: null,
      loginForVerification: null,
      passwordForVerification: null,
      verificationStep: 'none',
    })
  },

  deleteAccount: async () => {
    const tn = getTinode()
    try {
      const me = tn.getMeTopic()
      await me.delTopic(true)
    } catch {
      // ignore and continue local cleanup
    }

    try {
      useChatStore.getState().cleanup()
      await tn.logout()
    } catch {
      // ignore
    }

    removeAuthToken()
    set({
      isAuthenticated: false,
      userId: null,
      displayName: null,
      avatar: null,
      isLoading: false,
      error: null,
      emailForVerification: null,
      loginForVerification: null,
      passwordForVerification: null,
      verificationStep: 'none',
    })
  },

  tryAutoLogin: async () => {
    const token = loadAuthToken()
    if (!token) return

    set({ isLoading: true })
    const tn = getTinode()
    // Attach saved token
    tn.setAuthToken(token)

    // Setup reconnect callback — on any connection event try to re-auth with token
    tn.onConnect = async () => {
      try {
        const ctrl = await tn.loginToken(token.token)
        if (ctrl.code < 300) {
          onLoginSuccess()
        } else {
          removeAuthToken()
          set({ isLoading: false })
        }
      } catch {
        removeAuthToken()
        set({ isLoading: false })
      }
    }

    tn.onDisconnect = () => {
      useAuthStore.setState((s) => ({
        isAuthenticated: s.isAuthenticated, // keep auth state, we'll reconnect
      }))
    }

    try {
      await tn.connect()
    } catch {
      set({ isLoading: false })
    }
  },
}))
