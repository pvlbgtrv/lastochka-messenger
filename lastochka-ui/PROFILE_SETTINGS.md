# Настройки профиля в Ласточке

## Обзор

Настройки профиля позволяют пользователю управлять своей учётной записью:

- 👤 **Профиль** — имя, аватар, био
- 🔒 **Безопасность** — смена пароля
- 📱 **Контакты** — email и телефон
- ⚙️ **Приватность** — настройки видимости

## Компонент ProfileSettings

### Вкладки

#### 1. Профиль

**Поля:**
- **Аватар** — загрузка изображения (макс 5MB)
- **Отображаемое имя** — как вас видят другие
- **О себе** — краткая информация

**Функции:**
- Предпросмотр аватара
- Редактирование полей
- Сохранение изменений
- Отмена редактирования

#### 2. Безопасность

**Поля:**
- **Текущий пароль**
- **Новый пароль** (минимум 6 символов)
- **Подтверждение пароля**

**Функции:**
- Показать/скрыть пароль
- Валидация сложности пароля
- Проверка совпадения паролей

### Props

```typescript
interface ProfileSettingsProps {
  onClose?: () => void
}
```

## API

### updateProfile

Обновление информации о профиле.

```typescript
import { updateProfile } from '@/lib/email-auth'

const result = await updateProfile({
  displayName: 'Новое имя',
  avatar: 'data:image/png;base64,...',
  bio: 'О себе',
})

if (result.success) {
  console.log('Профиль обновлён')
} else {
  console.error(result.error)
}
```

### changePassword

Смена пароля.

```typescript
import { changePassword } from '@/lib/email-auth'

const result = await changePassword('old-password', 'new-password')

if (result.success) {
  console.log('Пароль изменён')
} else {
  console.error(result.error)
}
```

## Загрузка аватара

### Обработка файла

```typescript
const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return
  
  // Проверка размера (макс 5MB)
  if (file.size > 5 * 1024 * 1024) {
    setError('Размер файла не должен превышать 5MB')
    return
  }
  
  // Проверка типа
  if (!file.type.startsWith('image/')) {
    setError('Загрузите изображение')
    return
  }
  
  // Конвертация в base64
  const reader = new FileReader()
  reader.onload = (event) => {
    setAvatar(event.target?.result as string)
  }
  reader.readAsDataURL(file)
}
```

### Требования к изображению

| Параметр | Значение |
|----------|----------|
| **Формат** | PNG, JPEG, GIF, WebP |
| **Размер** | до 5 MB |
| **Разрешение** | от 100x100 px |
| **Соотношение** | 1:1 (квадрат) |

## Валидация

### Имя

```typescript
if (name.trim().length < 2) {
  error: 'Имя должно быть не менее 2 символов'
}
```

### Пароль

```typescript
// Минимальная длина
if (newPassword.length < 6) {
  error: 'Пароль должен быть не менее 6 символов'
}

// Совпадение
if (newPassword !== confirmPassword) {
  error: 'Пароли не совпадают'
}

// Текущий пароль
if (!currentPassword) {
  error: 'Введите текущий пароль'
}
```

## Интеграция с Tinode

### Обновление профиля

```typescript
const me = tn.getMeTopic()

await me.setMeta({
  desc: {
    public: {
      fn: displayName,      // Отображаемое имя
      photo: {              // Аватар
        type: 'image',
        data: avatarData,
      },
      note: bio,            // Био
    },
  },
})
```

### Смена пароля

```typescript
await tn.setMeta({
  private: {
    password: {
      old: oldPassword,
      new: newPassword,
    },
  },
})
```

## Примеры использования

### Открытие настроек

```typescript
import { useState } from 'react'
import ProfileSettings from '@/components/ui/ProfileSettings'

function App() {
  const [showSettings, setShowSettings] = useState(false)
  
  return (
    <>
      <button onClick={() => setShowSettings(true)}>
        Настройки
      </button>
      
      {showSettings && (
        <ProfileSettings onClose={() => setShowSettings(false)} />
      )}
    </>
  )
}
```

### Интеграция в Sidebar

```typescript
import ProfileSettings from '@/components/ui/ProfileSettings'

function Sidebar() {
  const [showSettings, setShowSettings] = useState(false)
  
  return (
    <>
      {/* Кнопка настроек */}
      <button onClick={() => setShowSettings(true)}>
        <Settings size={20} />
      </button>
      
      {/* Модальное окно */}
      {showSettings && (
        <div className="modal">
          <ProfileSettings onClose={() => setShowSettings(false)} />
        </div>
      )}
    </>
  )
}
```

## Состояния

### Успешное обновление

```typescript
const [success, setSuccess] = useState('')

if (result.success) {
  setSuccess('Профиль успешно обновлён')
  setTimeout(() => setSuccess(''), 3000)
}
```

### Ошибка

```typescript
const [error, setError] = useState('')

if (!result.success) {
  setError(result.error || 'Ошибка обновления')
}
```

### Загрузка

```typescript
const [isLoading, setIsLoading] = useState(false)

setIsLoading(true)
try {
  await updateProfile({...})
} finally {
  setIsLoading(false)
}
```

## Советы по UX

### 1. Debounced сохранение

Автоматическое сохранение через 1 секунду после последнего изменения:

```typescript
useEffect(() => {
  const timer = setTimeout(async () => {
    if (isDirty) {
      await saveProfile()
    }
  }, 1000)
  
  return () => clearTimeout(timer)
}, [name, bio, isDirty])
```

### 2. Предпросмотр изменений

Показ изменений до сохранения:

```typescript
const [preview, setPreview] = useState({
  name: displayName,
  bio: bio,
  avatar: avatar,
})
```

### 3. Подтверждение важных действий

Запрос подтверждения перед сменой пароля:

```typescript
const handleChangePassword = () => {
  if (!window.confirm('Вы уверены, что хотите изменить пароль?')) {
    return
  }
  // Смена пароля
}
```

## Безопасность

### Требования к паролю

- Минимум 6 символов
- Рекомендуется: буквы + цифры
- Не рекомендуется: простые комбинации (123456, password)

### Защита от CSRF

Все запросы на изменение данных должны включать CSRF-токен.

### Сессии

При смене пароля:
- Завершить все другие сессии
- Отправить уведомление на email
- Запросить повторный вход на других устройствах

---

**Ласточка** — народный мессенджер с открытым кодом 🕊️
