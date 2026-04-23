import { getTinode } from './tinode-client'
import { cleanPhoneNumber } from './phone-utils'

function buildRegistrationTags(login: string, displayName: string): string[] {
  const tags = new Set<string>()
  const normalizedLogin = login.trim().toLowerCase()
  const nameTokens = displayName
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)

  // IMPORTANT:
  // basic/email/tel are restricted tags on this Tinode deployment.
  // Sending them in account create request causes 403:
  // "attempt to directly assign restricted tags".
  // Keep only non-restricted tags from profile name/login.
  if (normalizedLogin) tags.add(`name:${normalizedLogin}`)
  for (const token of nameTokens) {
    tags.add(`fn:${token}`)
    tags.add(`name:${token}`)
  }
  return Array.from(tags)
}

/**
 * Отправка email кода подтверждения
 */
export async function sendEmailCode(email: string): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()

  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }

    // Tinode не имеет прямого API для reqCred в SDK
    // Используем acc() для запроса кода подтверждения
    const ctrl = await tn.acc({
      scheme: 'email',
      secret: email,
      login: false
    })

    if (ctrl.code >= 300) {
      return {
        success: false,
        error: ctrl.text || 'Ошибка отправки email'
      }
    }

    // Сервер должен отправить email с кодом
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка отправки email'
    return { success: false, error: msg }
  }
}

/**
 * Проверка email кода и завершение верификации
 */
export async function verifyEmailCode(
  email: string,
  code: string
): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()

  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }

    // Подтверждаем credential (email) через acc с кодом
    const ctrl = await tn.acc({
      scheme: 'email',
      secret: `${email}:${code}`,
      login: false
    })

    if (ctrl.code >= 300) {
      return {
        success: false,
        error: ctrl.text || 'Неверный код подтверждения'
      }
    }

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка проверки кода'
    return { success: false, error: msg }
  }
}

/**
 * Проверка логина, email и телефона на доступность
 * Использует серверный API эндпоинт /v1/check-availability
 */
export async function checkAvailability(params: {
  login?: string
  email?: string
  phone?: string
}, options?: { failOpen?: boolean }): Promise<{
  loginAvailable: boolean
  emailAvailable: boolean
  phoneAvailable: boolean
  error?: string
}> {
  const failOpen = options?.failOpen ?? true
  const url = '/v1/check-availability'
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    })
    
    if (!response.ok) {
      throw new Error('Ошибка проверки доступности')
    }
    
    const data = await response.json()
    return {
      loginAvailable: data.login_available ?? true,
      emailAvailable: data.email_available ?? true,
      phoneAvailable: data.phone_available ?? true,
      error: data.error,
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка проверки доступности'
    return {
      loginAvailable: failOpen,
      emailAvailable: failOpen,
      phoneAvailable: failOpen,
      error: msg,
    }
  }
}

/**
 * Проверка логина на доступность
 */
export async function checkLoginAvailability(login: string): Promise<{ available: boolean; error?: string }> {
  const result = await checkAvailability({ login })
  return {
    available: result.loginAvailable,
    error: result.loginAvailable ? undefined : (result.error || 'Этот логин уже занят'),
  }
}

/**
 * Проверка email на доступность
 */
export async function checkEmailAvailability(email: string): Promise<{ available: boolean; error?: string }> {
  const result = await checkAvailability({ email })
  return {
    available: result.emailAvailable,
    error: result.emailAvailable ? undefined : (result.error || 'Этот email уже зарегистрирован'),
  }
}

/**
 * Проверка телефона на доступность
 */
export async function checkPhoneAvailability(phone: string): Promise<{ available: boolean; error?: string }> {
  const result = await checkAvailability({ phone })
  return {
    available: result.phoneAvailable,
    error: result.phoneAvailable ? undefined : (result.error || 'Этот номер уже зарегистрирован'),
  }
}

/**
 * Обновление профиля пользователя
 */
export async function updateProfile(params: {
  displayName?: string
  avatar?: string
  bio?: string
}): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()

  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }

    const me = tn.getMeTopic()

    await me.setMeta({
      desc: {
        public: {
          fn: params.displayName,
          photo: params.avatar ? (() => {
            // params.avatar — Data URL: "data:image/jpeg;base64,/9j/..."
            // Tinode хранит {type: "image/jpeg", data: "<raw base64>"}
            const match = params.avatar!.match(/^data:([^;]+);base64,(.+)$/)
            if (match) return { type: match[1] || 'image/jpeg', data: match[2] || '' }
            return { type: 'image/jpeg', data: params.avatar! }
          })() : undefined,
          note: params.bio,
        },
      },
    })

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка обновления профиля'
    return { success: false, error: msg }
  }
}

/**
 * Смена пароля
 */
export async function changePassword(
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()

  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }

    // Tinode использует схему обновления пароля через setMeta на me topic
    const me = tn.getMeTopic()
    
    const ctrl = await me.setMeta({
      private: {
        password: {
          old: oldPassword,
          new: newPassword,
        },
      },
    })

    const ctrlCode = (ctrl as { code?: number } | undefined)?.code ?? 0
    if (ctrlCode >= 300) {
      return {
        success: false,
        error: (ctrl as { text?: string }).text || 'Ошибка смены пароля'
      }
    }

    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка смены пароля'
    return { success: false, error: msg }
  }
}

/**
 * Полная регистрация с email, телефоном и паролем
 */
export async function registerWithFullProfile(
  login: string,
  password: string,
  email: string,
  phone: string,
  displayName: string
): Promise<{ success: boolean; error?: string; requiresVerification?: boolean }> {
  const tn = getTinode()

  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }

    // Создаём учётную запись через createAccountBasic
    // email передаётся как credential для верификации
    // search tags: basic/login, fn/name token(s), tel/phone, email
    const tags = buildRegistrationTags(login, displayName)
    const cleanedPhone = cleanPhoneNumber(phone)
    const e164Phone = cleanedPhone ? `+${cleanedPhone}` : ''
    const cred: Array<{ meth: string; val: string }> = [{ meth: 'email', val: email }]
    if (e164Phone) {
      cred.push({ meth: 'tel', val: e164Phone })
    }
    const ctrl = await tn.createAccountBasic(login, password, {
      public: { fn: displayName },
      tags,
      cred,
      login: true,
    })

    if (ctrl.code >= 300) {
      if (ctrl.code === 409) {
        return {
          success: false,
          error: 'Этот логин уже зарегистрирован. Пожалуйста, выберите другой.'
        }
      }
      return {
        success: false,
        error: (ctrl as { code: number; text: string }).text || 'Ошибка регистрации'
      }
    }

    // Успешная регистрация и вход
    return {
      success: true,
      requiresVerification: false,
    }
  } catch (err: unknown) {
    // Tinode SDK бросает объекты с полем code при серверных ошибках
    const errObj = err as { code?: number; message?: string }
    if (errObj.code === 409) {
      return {
        success: false,
        error: 'Этот логин уже зарегистрирован. Пожалуйста, выберите другой.'
      }
    }
    const msg = err instanceof Error ? err.message : 'Ошибка регистрации'
    return { success: false, error: msg }
  }
}

/**
 * Завершение регистрации после верификации email
 */
export async function completeRegistration(
  login: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()
  
  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }
    
    // Логинимся после успешной верификации
    const ctrl = await tn.loginBasic(login, password)
    
    if (ctrl.code >= 300) {
      return { 
        success: false, 
        error: ctrl.text || 'Ошибка входа' 
      }
    }
    
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка завершения регистрации'
    return { success: false, error: msg }
  }
}
