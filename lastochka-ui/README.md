# 🕊️ Ласточка — Веб-кабинет

**Веб-кабинет** — браузерная версия мессенджера Ласточка.

## 📋 Содержание

- [Быстрый старт](#быстрый-старт)
- [Структура](#структура)
- [Аутентификация](#аутентификация)
- [Чаты](#чаты)
- [Группы и каналы](#группы-и-каналы)
- [Админ-панель](#админ-панель)
- [Настройки](#настройки)

---

## 🚀 Быстрый старт

```bash
cd D:\Projects\Messenger\dev\lastochka-ui

# Установка
npm install

# Запуск
npm run dev

# Сборка
npm run build
```

**Адрес:** http://localhost:5173

---

## 📁 Структура

```
src/
├── components/
│   ├── admin/          # Админ-панель
│   │   ├── AdminPanel.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Users.tsx
│   │   ├── Settings.tsx
│   │   └── Logs.tsx
│   ├── auth/           # Аутентификация
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterForm.tsx
│   │   └── EmailVerification.tsx
│   ├── chat/           # Чат
│   │   ├── ChatWindow.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── MessagesList.tsx
│   │   └── MessageInput.tsx
│   ├── layout/         # Layout
│   │   └── Sidebar.tsx
│   ├── sidebar/        # Боковая панель
│   │   ├── ChatList.tsx
│   │   └── ChatItem.tsx
│   └── ui/             # UI компоненты
│       ├── Avatar.tsx
│       ├── UserSearch.tsx
│       ├── CreateGroupModal.tsx
│       ├── MembersPanel.tsx
│       └── ProfileSettings.tsx
├── lib/                # Утилиты
│   ├── email-auth.ts
│   ├── sms-auth.ts
│   ├── phone-utils.ts
│   └── tinode-client.ts
├── store/              # Zustand store
│   ├── auth.ts
│   ├── chat.ts
│   ├── groups.ts
│   └── admin.ts
├── types/              # TypeScript типы
│   ├── index.ts
│   └── admin.ts
├── App.tsx
├── main.tsx
└── tinode.d.ts
```

---

## 🔐 Аутентификация

### Регистрация

**Поля:**
- Логин (3-32 символа, буквы/цифры/подчёркивание)
- Email (валидный формат)
- Телефон (+7 XXX XXX-XX-XX)
- Пароль (минимум 6 символов)
- Подтверждение пароля
- Отображаемое имя (необязательно)

**Проверки:**
```typescript
// Проверка логина на дубликат
const result = await checkLoginAvailability(login)
if (!result.available) {
  setError('Этот логин уже занят')
}

// Проверка телефона на дубликат
const result = await checkPhoneAvailability(phone)
if (!result.available) {
  setError('Этот номер уже зарегистрирован')
}
```

### Вход

```typescript
import { useAuthStore } from '@/store/auth'

const { login } = useAuthStore()
await login('username', 'password')
```

### Настройки профиля

**Вкладка Профиль:**
- Аватар (загрузка файла, макс 5MB)
- Отображаемое имя
- Био/о себе

**Вкладка Безопасность:**
- Текущий пароль
- Новый пароль
- Подтверждение пароля

---

## 💬 Чаты

### Типы чатов

| Тип | Описание | Макс. участников |
|-----|----------|------------------|
| **P2P** | Личная переписка | 2 |
| **Группа** | Групповой чат | 200 000 |
| **Канал** | Публикация контента | Неограниченно |

### Отправка сообщений

```typescript
import { useChatStore } from '@/store/chat'

const { sendMessage } = useChatStore()
await sendMessage('Привет, мир!')
```

### Поиск пользователей

```typescript
import UserSearch from '@/components/ui/UserSearch'

<UserSearch
  showStartChat
  onSelect={(user) => {
    console.log('Выбран пользователь:', user)
  }}
/>
```

---

## 👥 Группы и каналы

### Создание группы

```typescript
import { useGroupsStore } from '@/store/groups'

const { createGroup } = useGroupsStore()

const group = await createGroup({
  name: 'Моя группа',
  description: 'Описание',
  isChannel: false,
  isPublic: false,
  members: ['user1', 'user2'],
})
```

### Создание канала

```typescript
const { createChannel } = useGroupsStore()

const channel = await createChannel({
  name: 'Мой канал',
  description: 'Новости проекта',
  isPublic: true,
  members: [],
})
```

### Управление участниками

```typescript
const { addMember, removeMember, leaveGroup } = useGroupsStore()

// Добавить участника
await addMember('group-id', 'user-id')

// Удалить участника
await removeMember('group-id', 'user-id')

// Покинуть группу
await leaveGroup('group-id')
```

---

## 🛡️ Админ-панель

### Доступ

Только для пользователей с ролью `admin` или `superadmin`.

**Кнопка в Sidebar:**
```tsx
<button onClick={() => onOpenAdmin?.()}>
  <Shield size={20} />
</button>
```

### Дашборд

**Метрики:**
- Пользователи (всего, активные, новые)
- Сообщения (всего, сегодня)
- Группы/каналы
- Хранилище
- API запросы
- Ошибки

**Графики:**
- Активность (день/неделя/месяц)
- Прогресс-бары ресурсов (CPU, RAM, Disk)

### Пользователи

**Функции:**
- Поиск по имени/email/телефону
- Фильтры (роль, статус, сортировка)
- Изменение роли
- Блокировка/разблокировка
- Удаление
- Экспорт (CSV/JSON)

**Роли:**
- `user` — обычный пользователь
- `moderator` — модератор
- `admin` — администратор
- `superadmin` — супер-админ

**Статусы:**
- `active` — активен
- `banned` — заблокирован
- `pending` — ожидание
- `deleted` — удалён

### Логи

**Фильтры:**
- Поиск по пользователю/действию/цели
- Тип действия (14 типов)
- Период дат
- Сортировка

**Экспорт:**
```typescript
const handleExport = () => {
  const data = JSON.stringify(filteredLogs, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
}
```

---

## ⚙️ Настройки

### Общие

- Режим обслуживания
- Регистрация включена/выключена
- Сообщение о техобслуживании

### Пользователи

- Требовать подтверждение email
- Требовать подтверждение телефона
- Разрешить несколько сессий
- Минимальная длина пароля
- Таймаут сессии

### Контент

- Макс. размер файла (50MB)
- Макс. длина сообщения (4096 символов)
- Макс. групп на пользователя (50)
- Макс. каналов на пользователя (100)
- Разрешённые типы файлов

### Безопасность

- Rate limiting (60 запросов/мин)
- Защита от перебора (5 попыток)
- Длительность блокировки (15 мин)

### Уведомления

- Email уведомления
- Push уведомления
- SMTP настройки

### Модерация

- Автомодерация
- Запрещённые слова
- Порог жалоб (10)

---

## 🎨 UI компоненты

### Avatar

```tsx
import Avatar from '@/components/ui/Avatar'

<Avatar name="Иван Петров" size="md" online={true} />
```

### UserSearch

```tsx
import UserSearch from '@/components/ui/UserSearch'

<UserSearch
  showStartChat
  showAddToGroup
  groupId="grp123"
  onSelect={(user) => console.log(user)}
/>
```

### CreateGroupModal

```tsx
import CreateGroupModal from '@/components/ui/CreateGroupModal'

<CreateGroupModal
  isOpen={showModal}
  onClose={() => setShowModal(false)}
  mode="group"
/>
```

### MembersPanel

```tsx
import MembersPanel from '@/components/ui/MembersPanel'

<MembersPanel
  isOpen={showPanel}
  onClose={() => setShowPanel(false)}
  groupId="grp123"
  canAddMembers
  canRemoveMembers
/>
```

---

## 📡 API клиент

### Tinode Client

```typescript
import { getTinode } from '@/lib/tinode-client'

const tn = getTinode()

// Подключение
await tn.connect()

// Вход
await tn.loginBasic('username', 'password')

// Получение темы
const topic = tn.getTopic('grp123')

// Подписка
await topic.subscribe(query)

// Отправка сообщения
const draft = topic.createMessage('Привет!', false)
await topic.publishMessage(draft)
```

### Store

```typescript
import { useAuthStore } from '@/store/auth'
import { useChatStore } from '@/store/chat'
import { useGroupsStore } from '@/store/groups'
import { useAdminStore } from '@/store/admin'
```

---

## 🔧 Конфигурация

### Переменные окружения

Создайте файл `.env` в корне проекта:

```env
VITE_TINODE_HOST=localhost:6060
VITE_TINODE_API_KEY=AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K
VITE_TINODE_SECURE=false
VITE_APP_NAME=Ласточка
```

### TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "jsx": "react-jsx",
    "strict": false,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  }
}
```

---

## 📦 Сборка

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm run preview
```

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 4173
CMD ["npm", "run", "preview"]
```

---

## 🤝 Вклад

### Как помочь

1. Форкните репозиторий
2. Создайте ветку (`git checkout -b feature/amazing-feature`)
3. Закоммитьте изменения (`git commit -m 'Add amazing feature'`)
4. Запушьте (`git push origin feature/amazing-feature`)
5. Создайте Pull Request

### Стандарты кода

- **TypeScript:** strict mode выключен для совместимости
- **Именование:** camelCase для переменных, PascalCase для компонентов
- **Импорты:** сначала npm пакеты, потом локальные файлы

---

**Ласточка** — народный мессенджер с открытым кодом 🕊️

*Сделано с ❤️ для свободного общения*
