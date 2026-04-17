/**
 * Утилиты для работы с номерами телефонов
 */

// Форматирование номера телефона для отображения
export function formatPhoneNumber(value: string): string {
  // Удаляем всё кроме цифр
  const digits = value.replace(/\D/g, '')
  
  // Если начинается с 8, заменяем на +7
  let normalized = digits
  if (normalized.startsWith('8')) {
    normalized = '7' + normalized.slice(1)
  }
  
  // Если не начинается с 7, добавляем 7
  if (!normalized.startsWith('7') && normalized.length > 0) {
    normalized = '7' + normalized
  }
  
  // Форматируем: +7 (XXX) XXX-XX-XX
  if (normalized.length <= 1) {
    return normalized ? `+${normalized}` : ''
  }
  if (normalized.length <= 4) {
    return `+${normalized.slice(0, 1)} (${normalized.slice(1)})`
  }
  if (normalized.length <= 7) {
    return `+${normalized.slice(0, 1)} (${normalized.slice(1, 4)}) ${normalized.slice(4)}`
  }
  if (normalized.length <= 9) {
    return `+${normalized.slice(0, 1)} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7)}`
  }
  return `+${normalized.slice(0, 1)} (${normalized.slice(1, 4)}) ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9, 11)}`
}

// Очистка номера для отправки на сервер
export function cleanPhoneNumber(value: string): string {
  const digits = value.replace(/\D/g, '')
  
  // Если начинается с 8, заменяем на 7
  let cleaned = digits
  if (cleaned.startsWith('8')) {
    cleaned = '7' + cleaned.slice(1)
  }
  
  // Если не начинается с 7, добавляем 7 (для России)
  if (!cleaned.startsWith('7') && cleaned.length > 0) {
    cleaned = '7' + cleaned
  }
  
  return cleaned
}

// Валидация номера телефона (российские номера)
export function isValidPhoneNumber(value: string): boolean {
  const cleaned = cleanPhoneNumber(value)
  // Российские номера: 7 + 10 цифр = 11 цифр
  return cleaned.length === 11 && /^7\d{10}$/.test(cleaned)
}

// Проверка, является ли номер российским
export function isRussianPhone(value: string): boolean {
  const cleaned = cleanPhoneNumber(value)
  return cleaned.startsWith('7') && cleaned.length === 11
}

// Получение маски для ввода
export function getPhoneMask(): string {
  return '+7 (999) 999-99-99'
}

/**
 * Утилиты для работы с email
 */

// Валидация email
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email.trim())
}

// Нормализация email (приведение к нижнему регистру, trim)
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

// Проверка домена email
export function isValidEmailDomain(email: string): boolean {
  const domain = email.split('@')[1]
  if (!domain) return false
  
  // Минимум 2 части (domain.tld)
  const parts = domain.split('.')
  return parts.length >= 2 && parts.every(p => p.length > 0)
}
