# Аутентификация в Ласточке

## Обзор

Ласточка поддерживает два способа аутентификации:

1. **Классическая** — логин и пароль
2. **По номеру телефона** — SMS-код подтверждения

## Регистрация по номеру телефона

### Процесс регистрации

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
|  Ввод номера    | -> |  SMS с кодом     | -> |  Верификация    |
|  телефона       |    |  отправлено      |    |  завершена      |
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### API

#### 1. Отправка SMS для регистрации

```typescript
import { useAuthStore } from '@/store/auth'

const { sendRegistrationSms } = useAuthStore()
await sendRegistrationSms('+7 (999) 999-99-99')
```

**Что происходит:**
- Валидация номера телефона
- Подключение к Tinode
- Создание учётной записи с credential (номер телефона)
- Отправка SMS кода подтверждения

#### 2. Проверка SMS кода

```typescript
const { verifyRegistrationSms } = useAuthStore()
await verifyRegistrationSms('123456', 'Имя пользователя')
```

**Что происходит:**
- Проверка кода подтверждения
- Создание полноценного аккаунта
- Автоматический вход в систему

### Утилиты для работы с телефоном

```typescript
import { 
  formatPhoneNumber,      // Форматирование для отображения
  cleanPhoneNumber,       // Очистка для отправки на сервер
  isValidPhoneNumber,     // Валидация номера
} from '@/lib/phone-utils'

// Примеры
formatPhoneNumber('79999999999')     // "+7 (999) 999-99-99"
cleanPhoneNumber('+7 (999)...')      // "79999999999"
isValidPhoneNumber('+7 (999)...')    // true
```

## Вход по номеру телефона

### Процесс входа

```typescript
import { useAuthStore } from '@/store/auth'

const { loginByPhone, loginWithSmsCode } = useAuthStore()

// 1. Запрос SMS кода
await loginByPhone('+7 (999) 999-99-99')

// 2. Ввод кода из SMS
await loginWithSmsCode('123456')
```

## Классическая аутентификация

### Вход по логину/паролю

```typescript
const { login } = useAuthStore()
await login('username', 'password')
```

### Регистрация по логину/паролю

```typescript
// Пока не реализовано через отдельный метод
// Используйте login с новым логином
```

## Компоненты

### LoginScreen.tsx

Основной компонент экрана входа/регистрации.

**Режимы работы:**
- `phone-login` — вход по номеру телефона
- `phone-register` — регистрация по номеру телефона
- `login` — вход по логину/паролю
- `register` — регистрация по логину/паролю

**Состояния:**
- `verificationStep: 'none'` — ввод номера/логина
- `verificationStep: 'sms-sent'` — ожидание SMS кода
- `verificationStep: 'verified'` — успешная верификация

### SmsVerification.tsx

Компонент ввода SMS кода.

**Props:**
```typescript
interface SmsVerificationProps {
  phone: string              // Номер телефона для отображения
  onComplete: (code) => void // Callback при вводе кода
  onBack: () => void         // Callback при возврате назад
  isLoading: boolean         // Индикатор загрузки
  error: string | null       // Сообщение об ошибке
  title?: string             // Заголовок
  description?: string       // Описание
}
```

**Функции:**
- Автофокус на первом поле
- Автопереход между полями
- Поддержка вставки кода из буфера обмена
- Обработка Backspace для возврата назад

## Store (auth.ts)

### Состояние

```typescript
interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  displayName: string | null
  isLoading: boolean
  error: string | null
  
  // Для SMS-верификации
  phoneForVerification: string | null
  verificationStep: 'none' | 'sms-sent' | 'verified'

  // Методы
  login: (login, password) => Promise<void>
  registerByPhone: (phone, displayName) => Promise<void>
  sendRegistrationSms: (phone) => Promise<void>
  verifyRegistrationSms: (code, displayName) => Promise<void>
  loginByPhone: (phone) => Promise<void>
  loginWithSmsCode: (code) => Promise<void>
  logout: () => Promise<void>
  tryAutoLogin: () => Promise<void>
}
```

## SMS-провайдеры

### Настройка

Для отправки SMS необходимо настроить SMS-провайдера на стороне сервера Tinode.

**Популярные провайдеры для РФ:**
- SMS.ru
- SMS Pilot
- Prostor SMS
- Telesign

### Конфигурация на сервере

В конфигурации сервера Tinode укажите:

```yaml
sms:
  provider: "sms.ru"
  api_key: "your-api-key"
  sender: "Lastochka"
```

## Безопасность

### Валидация номеров

- Проверка формата российского номера (+7 XXX XXX-XX-XX)
- Очистка от спецсимволов перед отправкой
- Проверка длины номера (11 цифр)

### Защита от злоупотреблений

- Rate limiting на отправку SMS (не чаще 1 раза в минуту)
- Максимум 3 попытки ввода кода
- Блокировка при множественных неудачных попытках

### Хранение токенов

- Токен сохраняется в localStorage
- Токен автоматически обновляется при продлении сессии
- При logout токен удаляется

## Пример использования

### Полная регистрация по номеру телефона

```typescript
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { formatPhoneNumber, isValidPhoneNumber } from '@/lib/phone-utils'

function RegistrationForm() {
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [code, setCode] = useState('')
  
  const { sendRegistrationSms, verifyRegistrationSms, isLoading, error } = useAuthStore()
  
  const handleSendSms = async () => {
    if (!isValidPhoneNumber(phone)) return
    await sendRegistrationSms(phone)
  }
  
  const handleVerify = async () => {
    await verifyRegistrationSms(code, displayName)
  }
  
  return (
    <form>
      <input
        type="tel"
        value={phone}
        onChange={(e) => setPhone(formatPhoneNumber(e.target.value))}
        placeholder="+7 (999) 999-99-99"
      />
      <input
        type="text"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        placeholder="Ваше имя"
      />
      <button onClick={handleSendSms} disabled={isLoading}>
        Получить код
      </button>
      
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Код из SMS"
        maxLength={6}
      />
      <button onClick={handleVerify} disabled={isLoading}>
        Подтвердить
      </button>
      
      {error && <p className="error">{error}</p>}
    </form>
  )
}
```

## Интеграция с бэкендом

### Эндпоинты

Сервер должен поддерживать следующие эндпоинты:

1. **POST /v1/creds/tel** — запрос кода подтверждения
2. **PUT /v1/creds/tel** — проверка кода подтверждения

### Формат запроса

```json
// Запрос SMS кода
{
  "tel": "79999999999",
  "op": "add"
}

// Проверка кода
{
  "tel": "79999999999",
  "val": "123456",
  "op": "add"
}
```

### Формат ответа

```json
{
  "code": 200,
  "text": "OK",
  "params": {
    "cred": "tel:79999999999"
  }
}
```

## Тестирование

### Тестовые номера

Для тестирования без реальной отправки SMS:

```
+7 (999) 000-00-01 → код: 123456
+7 (999) 000-00-02 → код: 654321
```

### Mock SMS-провайдера

```typescript
// В разработке можно использовать mock
export async function sendSmsCode(phone: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`SMS код для ${phone}: 123456`)
    return { success: true }
  }
  // Реальная отправка SMS
}
```

---

**Ласточка** — народный мессенджер с открытым кодом 🕊️
