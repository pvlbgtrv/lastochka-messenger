# Логирование в Ласточке

## Обзор

Система логирования записывает все важные действия пользователей и администраторов для:

- 🔍 Аудита безопасности
- 📊 Анализа использования
- 🐛 Отладки проблем
- 📋 Соответствия требованиям

## Типы действий

### Пользовательские

| Действие | Код | Описание |
|----------|-----|----------|
| Вход | `login` | Пользователь вошёл в систему |
| Выход | `logout` | Пользователь вышел из системы |
| Регистрация | `register` | Новый пользователь зарегистрировался |
| Обновление профиля | `update_profile` | Изменены данные профиля |
| Смена пароля | `change_password` | Пользователь сменил пароль |

### Группы и каналы

| Действие | Код | Описание |
|----------|-----|----------|
| Создание группы | `create_group` | Создана новая группа/канал |
| Удаление группы | `delete_group` | Группа удалена |

### Административные

| Действие | Код | Описание |
|----------|-----|----------|
| Блокировка | `ban_user` | Пользователь заблокирован |
| Разблокировка | `unban_user` | Пользователь разблокирован |
| Удаление пользователя | `delete_user` | Аккаунт удалён |
| Изменение настроек | `update_settings` | Изменены настройки системы |
| Отправка уведомления | `send_notification` | Массовая рассылка |
| Экспорт данных | `export_data` | Выгрузка данных |

## Структура лога

```typescript
interface ActivityLog {
  id: string           // Уникальный ID записи
  userId: string       // ID пользователя
  userName: string     // Отображаемое имя
  action: ActionType   // Тип действия
  target: string       // Цель (user/group/system)
  targetId?: string    // ID цели (если есть)
  details?: string     // Дополнительные детали
  ip: string           // IP адрес
  timestamp: Date      // Время действия
}
```

## Примеры записей

### Вход пользователя

```json
{
  "id": "log_1234567890",
  "userId": "user_abc123",
  "userName": "Иван Петров",
  "action": "login",
  "target": "system",
  "ip": "192.168.1.100",
  "timestamp": "2026-03-17T10:30:00Z"
}
```

### Создание группы

```json
{
  "id": "log_1234567891",
  "userId": "user_abc123",
  "userName": "Иван Петров",
  "action": "create_group",
  "target": "group",
  "targetId": "grp_xyz789",
  "details": "Создана группа \"Рабочая\"",
  "ip": "192.168.1.100",
  "timestamp": "2026-03-17T11:45:00Z"
}
```

### Блокировка пользователя (админ)

```json
{
  "id": "log_1234567892",
  "userId": "admin_001",
  "userName": "Администратор",
  "action": "ban_user",
  "target": "user",
  "targetId": "user_def456",
  "details": "Нарушение правил сообщества",
  "ip": "10.0.0.1",
  "timestamp": "2026-03-17T14:20:00Z"
}
```

## Страница логов

### Фильтры

**Поиск:**
- По имени пользователя
- По типу действия
- По цели действия

**Фильтры:**
- Тип действия (все/конкретный)
- Пользователь (все/конкретный)
- Период дат (с/по)

**Сортировка:**
- По времени (возрастанию/убыванию)
- По типу действия

**Пагинация:**
- 25 / 50 / 100 / 200 записей на странице

### Экспорт

```typescript
// Экспорт в JSON
const handleExport = () => {
  const data = JSON.stringify(filteredLogs, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `logs-${new Date().toISOString().split('T')[0]}.json`
  a.click()
  URL.revokeObjectURL(url)
}
```

## API

### Эндпоинты

```
GET /api/admin/logs
  ?action=login          # Фильтр по действию
  &userId=user123        # Фильтр по пользователю
  &from=2026-03-01       # С даты
  &to=2026-03-17         # По дату
  &sort=timestamp        # Сортировка
  &order=desc            # Порядок
  &page=1                # Страница
  &limit=50              # Лимит

DELETE /api/admin/logs   # Очистка логов
```

### Серверная логика

```typescript
// Middleware для логирования действий
async function logAction(
  userId: string,
  action: ActionType,
  target: string,
  details?: string
) {
  const log: ActivityLog = {
    id: generateId(),
    userId,
    userName: await getUserName(userId),
    action,
    target,
    details,
    ip: getRequestIP(),
    timestamp: new Date(),
  }
  
  await db.logs.insert(log)
  
  // Асинхронная отправка в аналитику
  sendToAnalytics(log)
}
```

## Хранение

### Стратегия

```typescript
// Автоматическая очистка старых логов
const RETENTION_DAYS = 90

async function cleanupOldLogs() {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS)
  
  await db.logs.delete({
    timestamp: { lt: cutoffDate }
  })
}
```

### Индексы

```sql
-- Для ускорения поиска
CREATE INDEX idx_logs_timestamp ON logs(timestamp DESC);
CREATE INDEX idx_logs_user ON logs(userId);
CREATE INDEX idx_logs_action ON logs(action);
CREATE INDEX idx_logs_target ON logs(target);
```

## Использование

### Логирование действия

```typescript
import { logAction } from '@/lib/logging'

// При входе
await logAction(userId, 'login', 'system')

// При создании группы
await logAction(userId, 'create_group', 'group', {
  groupId: newGroup.id,
  groupName: newGroup.name,
})

// При блокировке (админ)
await logAction(adminId, 'ban_user', 'user', {
  bannedUserId: userId,
  reason: 'Нарушение правил',
  duration: 7, // дней
})
```

### Поиск логов

```typescript
import { useAdminStore } from '@/store/admin'

const { logs, loadLogs } = useAdminStore()

// Загрузка с фильтрами
await loadLogs({
  action: 'login',
  userId: 'user123',
  from: '2026-03-01',
  to: '2026-03-17',
  limit: 100,
})
```

## Безопасность

### Защита логов

- Доступ только для администраторов
- Логи действий администраторов тоже логируются
- Запрет на удаление отдельных записей
- Только массовая очистка по истечении срока

### Аудит

```typescript
// Проверка прав доступа
async function canAccessLogs(userId: string): Promise<boolean> {
  const user = await getUser(userId)
  return user?.role === 'admin' || user?.role === 'superadmin'
}

// Логирование доступа к логам
await logAction(adminId, 'view_logs', 'system')
```

## Мониторинг

### Оповещения

```typescript
// Подозрительная активность
if (failedLoginAttempts > 10) {
  await sendAlert('Много неудачных попыток входа', {
    userId,
    ip,
    count: failedLoginAttempts,
  })
}

// Массовые действия
if (actionsPerMinute > 100) {
  await sendAlert('Подозрительная активность', {
    userId,
    actions: actionsPerMinute,
  })
}
```

### Метрики

```typescript
// Статистика за период
const stats = {
  totalLogs: await logs.count(),
  byAction: await logs.groupBy('action'),
  byUser: await logs.groupBy('userId'),
  peakHour: await logs.peakHour(),
  avgPerDay: await logs.averagePerDay(),
}
```

## Примеры использования

### Поиск всех входов пользователя

```typescript
const logins = logs.filter(log => 
  log.userId === 'user123' && log.action === 'login'
)
```

### Поиск действий за сегодня

```typescript
const today = new Date().toDateString()
const todayLogs = logs.filter(log =>
  new Date(log.timestamp).toDateString() === today
)
```

### Подсчёт действий по типу

```typescript
const actionCounts = logs.reduce((acc, log) => {
  acc[log.action] = (acc[log.action] || 0) + 1
  return acc
}, {} as Record<string, number>)
```

---

**Ласточка** — народный мессенджер с открытым кодом 🕊️
