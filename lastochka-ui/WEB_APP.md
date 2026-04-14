# Веб-кабинет Ласточки

## Обзор

Веб-кабинет мессенджера Ласточка предоставляет полный функционал для общения:

- 💬 **Личные чаты** — общение один на один
- 👥 **Группы** — групповые чаты с участниками
- 📢 **Каналы** — публикация контента подписчикам
- 🔍 **Поиск** — поиск пользователей и сообщений
- ⚙️ **Настройки** — управление профилем и настройками

## Структура

```
src/
├── components/
│   ├── layout/
│   │   └── Sidebar.tsx          # Боковая панель с навигацией
│   ├── chat/
│   │   ├── ChatHeader.tsx       # Шапка чата
│   │   ├── ChatWindow.tsx       # Окно чата
│   │   ├── MessagesList.tsx     # Список сообщений
│   │   └── MessageInput.tsx     # Ввод сообщений
│   ├── sidebar/
│   │   ├── ChatList.tsx         # Список чатов
│   │   └── ChatItem.tsx         # Элемент чата
│   └── ui/
│       ├── UserSearch.tsx       # Поиск пользователей
│       ├── CreateGroupModal.tsx # Создание группы/канала
│       ├── MembersPanel.tsx     # Панель участников
│       └── Avatar.tsx           # Аватар
├── store/
│   ├── auth.ts                  # Аутентификация
│   ├── chat.ts                  # Чаты и сообщения
│   └── groups.ts                # Группы и каналы
└── types/
    └── index.ts                 # Типы данных
```

## Компоненты

### Sidebar.tsx

Боковая панель с переключением между чатами, группами и каналами.

**Вкладки:**
- **Чаты** — личные и групповые чаты
- **Группы** — управление группами
- **Каналы** — управление каналами

**Функции:**
- Поиск по чатам
- Счётчики непрочитанных
- Быстрое создание групп/каналов

### ChatHeader.tsx

Шапка чата с информацией о собеседнике/группе.

**Отображение:**
- Аватар и имя
- Статус (онлайн/был недавно)
- Для групп: количество участников
- Для каналов: количество подписчиков

**Действия:**
- Поиск по сообщениям
- Показать/скрыть участников
- Меню действий

### ChatWindow.tsx

Основное окно чата.

**Режимы:**
- Пустое состояние (чат не выбран)
- Активный чат с сообщениями

### UserSearch.tsx

Поиск пользователей для добавления в чат или группу.

**Props:**
```typescript
interface UserSearchProps {
  onSelect?: (user: User) => void
  onClose?: () => void
  showStartChat?: boolean    // Показать кнопку "Начать чат"
  showAddToGroup?: boolean   // Показать кнопку "Добавить в группу"
  groupId?: string           // ID группы для добавления
}
```

**Функции:**
- Debounced поиск (300ms)
- Отображение статуса онлайн
- Быстрое добавление в группу

### CreateGroupModal.tsx

Модальное окно создания группы или канала.

**Этапы:**
1. **Информация** — название, описание, тип доступа
2. **Участники** — выбор пользователей

**Props:**
```typescript
interface CreateGroupModalProps {
  isOpen: boolean
  onClose: () => void
  mode: 'group' | 'channel'
}
```

**Параметры создания:**
- Название (обязательно)
- Описание (необязательно)
- Тип доступа (приватный/публичный)
- Участники (необязательно)

### MembersPanel.tsx

Выезжающая панель участников группы/канала.

**Props:**
```typescript
interface MembersPanelProps {
  isOpen: boolean
  onClose: () => void
  groupId: string
  canAddMembers?: boolean
  canRemoveMembers?: boolean
}
```

**Функции:**
- Просмотр списка участников
- Добавление участников (если разрешено)
- Удаление участников (для владельца)
- Выход из группы/канала

## Store

### groups.ts

Управление группами и каналами.

**Состояние:**
```typescript
interface GroupsStore {
  groups: Group[]              // Список групп
  channels: Group[]            // Список каналов
  selectedGroup: Group | null  // Выбранная группа
  isLoading: boolean
  error: string | null
}
```

**Методы:**
- `loadGroups()` — загрузка списка групп
- `loadChannels()` — загрузка списка каналов
- `createGroup(params)` — создание группы
- `createChannel(params)` — создание канала
- `selectGroup(groupId)` — выбор группы
- `addMember(groupId, userId)` — добавление участника
- `removeMember(groupId, userId)` — удаление участника
- `leaveGroup(groupId)` — выход из группы
- `deleteGroup(groupId)` — удаление группы
- `updateGroupInfo(groupId, name, description)` — обновление информации
- `searchUsersForInvite(query)` — поиск пользователей

## Типы данных

### Group

```typescript
interface Group {
  id: string
  name: string
  description?: string
  avatar?: string
  owner: string
  members: GroupMember[]
  created: Date
  isChannel: boolean
  isPublic: boolean
  membersCount: number
}
```

### GroupMember

```typescript
interface GroupMember {
  userId: string
  name: string
  avatar?: string
  role: 'owner' | 'admin' | 'member'
  joined: Date
  online?: boolean
}
```

### CreateGroupParams

```typescript
interface CreateGroupParams {
  name: string
  description?: string
  isChannel: boolean
  isPublic: boolean
  members: string[] // user IDs
  avatar?: string
}
```

## Создание группы

```typescript
import { useGroupsStore } from '@/store/groups'

const { createGroup } = useGroupsStore()

const group = await createGroup({
  name: 'Моя группа',
  description: 'Описание группы',
  isChannel: false,
  isPublic: false,
  members: ['user1', 'user2'],
})
```

## Создание канала

```typescript
import { useGroupsStore } from '@/store/groups'

const { createChannel } = useGroupsStore()

const channel = await createChannel({
  name: 'Мой канал',
  description: 'Описание канала',
  isPublic: true,
  members: [], // Можно без участников
})
```

## Поиск пользователей

```typescript
import { useGroupsStore } from '@/store/groups'

const { searchUsersForInvite } = useGroupsStore()

const users = await searchUsersForInvite('Иван')
// [{ id: 'user1', name: 'Иван', online: true }, ...]
```

## Добавление участника

```typescript
import { useGroupsStore } from '@/store/groups'

const { addMember } = useGroupsStore()

await addMember('group-id', 'user-id')
```

## Отличия групп и каналов

| Параметр | Группа | Канал |
|----------|--------|-------|
| **Цель** | Общение | Публикация контента |
| **Участники** | Могут писать | Только читают (обычно) |
| **Создатель** | Владелец | Администратор |
| **Доступ** | Приватный/Публичный | Приватный/Публичный |
| **Уведомления** | Все сообщения | Только новые посты |

## Типы доступа

### Приватный
- Вход только по приглашению
- Не отображается в поиске
- Участники видны друг другу

### Публичный
- Любой может вступить
- Отображается в поиске
- Можно пригласить ссылку

## Интеграция с Tinode

### Группы

Tinode использует topics с префиксом `grp`:

```typescript
// Создание группы
const groupTopic = tn.getTopic('new')
await groupTopic.save({
  desc: {
    public: {
      fn: 'Название',
      note: 'Описание',
      type: 'group',
    },
  },
  subs: members.map(userId => ({
    user: userId,
    mode: 'RW', // Read-Write
  })),
})
```

### Каналы

```typescript
// Создание канала
const channelTopic = tn.getTopic('new')
await channelTopic.save({
  desc: {
    public: {
      fn: 'Название',
      note: 'Описание',
      type: 'channel',
    },
  },
  subs: members.map(userId => ({
    user: userId,
    mode: 'R', // Read-only
  })),
})
```

## Роли участников

### Owner (Владелец)
- Полный доступ
- Может удалять группу
- Назначать администраторов
- Добавлять/удалять участников

### Admin (Администратор)
- Может добавлять участников
- Может удалять участников (не админов)
- Может редактировать информацию

### Member (Участник)
- Может писать сообщения
- Может приглашать других (если разрешено)
- Может покинуть группу

## Примеры использования

### Создание публичного канала

```typescript
const { createChannel } = useGroupsStore()

const channel = await createChannel({
  name: 'Новости Ласточки',
  description: 'Официальные новости мессенджера',
  isPublic: true,
  members: [],
})

// Переход в канал
const { setActiveChat } = useChatStore.getState()
await setActiveChat(channel.id)
```

### Добавление участника из поиска

```typescript
<UserSearch
  showAddToGroup
  groupId="group-id"
  onSelect={(user) => {
    console.log('Добавлен:', user)
  }}
/>
```

### Просмотр участников

```typescript
const { selectGroup, selectedGroup } = useGroupsStore()

await selectGroup('group-id')
console.log(selectedGroup?.members)
// [{ userId: 'user1', name: 'Иван', role: 'owner', ... }]
```

---

**Ласточка** — народный мессенджер с открытым кодом 🕊️
