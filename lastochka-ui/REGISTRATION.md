# Регистрация в Ласточке

## Обзор

Ласточка поддерживает регистрацию с полной верификацией пользователя через email.

**Требуемые данные при регистрации:**
1. ✅ Логин (уникальный, проверяется на дубликат)
2. ✅ Email (с верификацией кодом)
3. ✅ Телефон (обязательно, маска +7 XXX XXX-XX-XX)
4. ✅ Пароль (минимум 6 символов)
5. ✅ Подтверждение пароля
6. ⭕ Отображаемое имя (необязательно)

## Процесс регистрации

```
┌─────────────────────┐    ┌──────────────────┐    ┌─────────────────┐
|  Ввод данных        | -> |  Email с кодом   | -> |  Верификация    |
|  (логин, email,     |    |  отправлено      |    |  завершена      |
|   телефон, пароль)  |    |                  |    |  Вход в систему |
└─────────────────────┘    └──────────────────┘    └─────────────────┘
```

## Форма регистрации

### Поля формы

#### 1. Логин
- **Обязательно:** да
- **Минимальная длина:** 3 символа
- **Допустимые символы:** буквы (a-z), цифры (0-9), подчёркивание (_)
- **Проверка:** автоматическая проверка на уникальность (debounce 500ms)
- **Пример:** `ivan_petrov`, `user123`

#### 2. Email
- **Обязательно:** да
- **Формат:** стандартный email (example@domain.com)
- **Проверка:** валидация формата + верификация кодом
- **Пример:** `ivan@mail.ru`

#### 3. Телефон
- **Обязательно:** да
- **Формат:** российский номер +7 (XXX) XXX-XX-XX
- **Маска ввода:** автоматическое форматирование
- **Пример:** `+7 (999) 123-45-67`

#### 4. Пароль
- **Обязательно:** да
- **Минимальная длина:** 6 символов
- **Отображение:** кнопка показать/скрыть

#### 5. Подтверждение пароля
- **Обязательно:** да
- **Проверка:** совпадение с паролем

#### 6. Отображаемое имя
- **Обязательно:** нет
- **По умолчанию:** используется логин
- **Назначение:** отображается в списке контактов

## API

### 1. Проверка логина на доступность

```typescript
import { useAuthStore } from '@/store/auth'

const { checkLogin } = useAuthStore()
const isAvailable = await checkLogin('username')
```

**Что происходит:**
- Проверка логина в базе данных
- Возвращает `true` если логин свободен

### 2. Отправка email для регистрации

```typescript
const { sendRegistrationEmail } = useAuthStore()

await sendRegistrationEmail(
  'username',      // логин
  'password123',   // пароль
  'email@test.com',// email
  '79991234567',   // телефон
  'Имя'            // отображаемое имя
)
```

**Что происходит:**
- Валидация всех данных
- Проверка логина на уникальность
- Создание учётной записи в Tinode
- Отправка email с кодом подтверждения
- Переход в режим ожидания кода

### 3. Проверка email кода

```typescript
const { verifyRegistrationEmail } = useAuthStore()
await verifyRegistrationEmail('123456')
```

**Что происходит:**
- Проверка кода подтверждения
- Активация учётной записи
- Автоматический вход в систему

## Компоненты

### RegisterForm.tsx

Основной компонент формы регистрации.

**Props:**
```typescript
interface RegisterFormProps {
  onSuccess?: () => void  // Callback после успешной регистрации
}
```

**Функции:**
- Валидация всех полей в реальном времени
- Проверка логина на уникальность (debounced)
- Проверка совпадения паролей
- Валидация email и телефона
- Отображение ошибок для каждого поля
- Переключение видимости пароля

**Состояния:**
- `verificationStep: 'none'` — ввод данных
- `verificationStep: 'email-sent'` — ожидание кода
- `verificationStep: 'verified'` — успешно

### EmailVerification.tsx

Компонент ввода кода из email.

**Props:**
```typescript
interface EmailVerificationProps {
  email: string              // Email для отображения (маскированный)
  onComplete: (code) => void // Callback при вводе кода
  onBack: () => void         // Callback при возврате назад
  isLoading: boolean         // Индикатор загрузки
  error: string | null       // Сообщение об ошибке
  title?: string             // Заголовок
  description?: string       // Описание
}
```

**Функции:**
- 6 полей для ввода кода
- Автопереход между полями
- Поддержка вставки из буфера обмена
- Обработка Backspace
- Маскирование email для отображения

### LoginScreen.tsx

Главный экран с переключением между входом и регистрацией.

**Режимы:**
- `login` — форма входа
- `register` — форма регистрации

## Валидация

### Логин

```typescript
// Проверка длины
if (login.length < 3) {
  error: 'Логин должен быть не менее 3 символов'
}

// Проверка символов
if (!/^[a-zA-Z0-9_]+$/.test(login)) {
  error: 'Логин может содержать только буквы, цифры и подчёркивание'
}

// Проверка на дубликат (debounced 500ms)
const available = await checkLogin(login)
if (!available) {
  error: 'Этот логин уже занят'
}
```

### Email

```typescript
import { isValidEmail } from '@/lib/phone-utils'

if (!isValidEmail(email)) {
  error: 'Введите корректный email'
}
```

### Телефон

```typescript
import { isValidPhoneNumber, checkPhoneAvailability } from '@/lib/phone-utils'

// Валидация формата
if (!isValidPhoneNumber(phone)) {
  error: 'Введите корректный номер телефона'
}

// Проверка на дубликат (debounced 500ms)
const result = await checkPhoneAvailability(phone)
if (!result.available) {
  error: 'Этот номер уже зарегистрирован'
}
```

### Пароль

```typescript
if (password.length < 6) {
  error: 'Пароль должен быть не менее 6 символов'
}

if (password !== passwordConfirm) {
  error: 'Пароли не совпадают'
}
```

## Утилиты

### phone-utils.ts

```typescript
import { 
  formatPhoneNumber,      // Форматирование: "+7 (999) 999-99-99"
  cleanPhoneNumber,       // Очистка: "79999999999"
  isValidPhoneNumber,     // Валидация: true/false
  isValidEmail,           // Валидация email: true/false
  normalizeEmail,         // Нормализация: lowercase + trim
} from '@/lib/phone-utils'
```

## Store (auth.ts)

### Состояние

```typescript
interface AuthState {
  isAuthenticated: boolean
  userId: string | null
  displayName: string | null
  isLoading: boolean
  error: string | null
  
  // Для email-верификации
  emailForVerification: string | null
  loginForVerification: string | null
  passwordForVerification: string | null
  verificationStep: 'none' | 'email-sent' | 'verified'

  // Методы
  login: (login, password) => Promise<void>
  checkLogin: (login) => Promise<boolean>
  registerWithProfile: (login, password, email, phone, displayName) => Promise<void>
  sendRegistrationEmail: (login, password, email, phone, displayName) => Promise<void>
  verifyRegistrationEmail: (code) => Promise<void>
  logout: () => Promise<void>
  tryAutoLogin: () => Promise<void>
}
```

## Email-провайдеры

### Настройка на сервере

Для отправки email необходимо настроить SMTP на сервере Tinode.

**Конфигурация SMTP:**

```yaml
# Конфигурация сервера
smtp:
  host: "smtp.mail.ru"
  port: 587
  username: "noreply@lastochka.ru"
  password: "your-password"
  from: "Ласточка <noreply@lastochka.ru>"
  tls: true
```

**Популярные провайдеры для РФ:**
- Mail.ru (smtp.mail.ru)
- Yandex (smtp.yandex.ru)
- SendPulse (smtp.sendpulse.com)
- Unisender (smtp.unisender.com)

### Шаблон письма

**Тема:** Код подтверждения для Ласточки

**Текст:**
```
Здравствуйте!

Ваш код подтверждения для регистрации в мессенджере Ласточка:

123456

Код действителен в течение 10 минут.

Если вы не регистрировались в Ласточке, просто проигнорируйте это письмо.

---
Ласточка — Твой дом в интернете
```

## Безопасность

### Валидация данных

- Проверка уникальности логина (real-time)
- Валидация формата email
- Валидация российского номера телефона
- Проверка сложности пароля (минимум 6 символов)
- Проверка совпадения паролей

### Защита от злоупотреблений

- Rate limiting на отправку email (не чаще 1 раза в минуту)
- Максимум 3 попытки ввода кода
- Блокировка при множественных неудачных попытках
- CSRF-токены для форм

### Хранение данных

- Пароль хешируется на сервере
- Email и телефон шифруются в базе данных
- Токен сессии сохраняется в localStorage

## Пример использования

### Полная регистрация

```typescript
import { useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { isValidEmail, isValidPhoneNumber } from '@/lib/phone-utils'

function RegistrationPage() {
  const [step, setStep] = useState<'form' | 'verification'>('form')
  
  const [formData, setFormData] = useState({
    login: '',
    email: '',
    phone: '',
    displayName: '',
    password: '',
    passwordConfirm: '',
  })
  
  const { sendRegistrationEmail, verifyRegistrationEmail, isLoading, error } = useAuthStore()
  
  const handleSubmit = async () => {
    // Валидация
    if (!isValidEmail(formData.email)) return
    if (!isValidPhoneNumber(formData.phone)) return
    if (formData.password !== formData.passwordConfirm) return
    
    // Отправка
    await sendRegistrationEmail(
      formData.login,
      formData.password,
      formData.email,
      formData.phone,
      formData.displayName
    )
    
    setStep('verification')
  }
  
  const handleVerify = async (code: string) => {
    await verifyRegistrationEmail(code)
    // Регистрация завершена
  }
  
  if (step === 'verification') {
    return (
      <EmailVerification
        email={formData.email}
        onComplete={handleVerify}
        onBack={() => setStep('form')}
        isLoading={isLoading}
        error={error}
      />
    )
  }
  
  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={formData.login}
        onChange={(e) => setFormData({...formData, login: e.target.value})}
        placeholder="Логин"
      />
      <input
        type="email"
        value={formData.email}
        onChange={(e) => setFormData({...formData, email: e.target.value})}
        placeholder="Email"
      />
      <input
        type="tel"
        value={formData.phone}
        onChange={(e) => setFormData({...formData, phone: e.target.value})}
        placeholder="+7 (999) 999-99-99"
      />
      <input
        type="password"
        value={formData.password}
        onChange={(e) => setFormData({...formData, password: e.target.value})}
        placeholder="Пароль"
      />
      <input
        type="password"
        value={formData.passwordConfirm}
        onChange={(e) => setFormData({...formData, passwordConfirm: e.target.value})}
        placeholder="Подтверждение пароля"
      />
      <button type="submit" disabled={isLoading}>
        Зарегистрироваться
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  )
}
```

## Интеграция с бэкендом

### Эндпоинты

Сервер должен поддерживать следующие эндпоинты:

1. **POST /v1/users** — создание учётной записи
2. **POST /v1/creds/email** — запрос кода подтверждения
3. **PUT /v1/creds/email** — проверка кода подтверждения

### Формат запроса

```json
// Создание учётной записи
{
  "login": "username",
  "password": "password123",
  "public": {
    "fn": "Display Name",
    "tel": "79991234567"
  },
  "private": {
    "email": "user@example.com"
  },
  "cred": {
    "email": "user@example.com",
    "tel": "79991234567"
  },
  "login": false
}

// Запрос кода
{
  "email": "user@example.com",
  "op": "add"
}

// Проверка кода
{
  "email": "user@example.com",
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
    "user": "user123",
    "cred": "email:user@example.com"
  }
}
```

## Тестирование

### Тестовые email

Для тестирования без реальной отправки email:

```
test+lastochka@example.com → код: 123456
```

### Mock email-провайдера

```typescript
// В разработке можно использовать mock
export async function sendEmailCode(email: string) {
  if (process.env.NODE_ENV === 'development') {
    console.log(`Email код для ${email}: 123456`)
    return { success: true }
  }
  // Реальная отправка email
}
```

## Отличия от SMS-верификации

| Параметр | Email | SMS |
|----------|-------|-----|
| Стоимость | ~0 ₽ | ~2-5 ₽ за SMS |
| Скорость доставки | 5-30 сек | 1-10 сек |
| Надёжность | Высокая | Средняя |
| Требует телефона | Нет | Да |
| Международная поддержка | Да | Зависит от провайдера |

---

**Ласточка** — народный мессенджер с открытым кодом 🕊️
