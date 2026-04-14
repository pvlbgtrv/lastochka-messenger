import { getTinode } from './tinode-client'

/**
 * Отправка SMS кода подтверждения
 */
export async function sendSmsCode(phone: string): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()
  
  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }
    
    // Создаём учётную запись с credential (номер телефона)
    // Tinode использует систему credentials для верификакации
    const ctrl = await tn.createAccountBasic('', '', {
      public: {},
      cred: [{
        meth: 'tel',
        val: phone,
      }],
      login: false, // Не логинимся сразу, сначала верификация
    })
    
    if (ctrl.code >= 300) {
      return { 
        success: false, 
        error: ctrl.text || 'Ошибка отправки SMS' 
      }
    }
    
    // Сервер должен отправить SMS с кодом
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка отправки SMS'
    return { success: false, error: msg }
  }
}

/**
 * Проверка SMS кода и завершение регистрации
 */
export async function verifySmsCode(
  phone: string, 
  code: string,
  displayName: string
): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()
  
  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }
    
    // Подтверждаем credential (номер телефона) через acc
    const ctrl = await tn.acc({
      scheme: 'tel',
      secret: `${phone}:${code}`,
      login: false
    })

    if (ctrl.code >= 300) {
      return {
        success: false,
        error: ctrl.text || 'Неверный код подтверждения'
      }
    }
    
    // После верификации создаём полноценный аккаунт
    // Генерируем случайный пароль или используем код как временный пароль
    const tempPassword = `sms_${Date.now()}_${Math.random().toString(36).slice(-6)}`
    
    const registerCtrl = await tn.createAccountBasic(phone, tempPassword, {
      public: { fn: displayName },
      login: true,
      cred: [{
        meth: 'tel',
        val: phone,
      }],
    })
    
    if (registerCtrl.code >= 300) {
      return { 
        success: false, 
        error: registerCtrl.text || 'Ошибка создания аккаунта' 
      }
    }
    
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка проверки кода'
    return { success: false, error: msg }
  }
}

/**
 * Вход по номеру телефона с SMS кодом
 */
export async function loginWithSms(
  phone: string
): Promise<{ success: boolean; error?: string }> {
  const tn = getTinode()
  
  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }
    
    // Запрашиваем отправку SMS кода для входа через acc
    const ctrl = await tn.acc({
      scheme: 'tel',
      secret: phone,
      login: false
    })

    if (ctrl.code >= 300) {
      return {
        success: false,
        error: ctrl.text || 'Ошибка отправки SMS'
      }
    }
    
    return { success: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка отправки SMS'
    return { success: false, error: msg }
  }
}

/**
 * Вход по номеру телефона и коду подтверждения
 */
export async function loginWithSmsCode(
  phone: string,
  code: string
): Promise<{ success: boolean; error?: string; userId?: string }> {
  const tn = getTinode()
  
  try {
    if (!tn.isConnected()) {
      await tn.connect()
    }
    
    // Верифицируем код и получаем доступ через acc
    const ctrl = await tn.acc({
      scheme: 'tel',
      secret: `${phone}:${code}`,
      login: true
    })

    if (ctrl.code >= 300) {
      return {
        success: false,
        error: ctrl.text || 'Неверный код подтверждения'
      }
    }

    // После успешной верификации логинимся
    // Tinode должен автоматически авторизовать после верификации credential
    const userId = tn.getCurrentUserID()
    
    return { 
      success: true,
      userId: userId || undefined,
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Ошибка входа'
    return { success: false, error: msg }
  }
}
