# Архитектура Ласточки

> Документ для технических аудиторов и разработчиков, изучающих устройство системы.

---

## Содержание

1. [Обзор системы](#1-обзор-системы)
2. [Компоненты и их роли](#2-компоненты-и-их-роли)
3. [Потоки данных](#3-потоки-данных)
4. [Безопасность и шифрование](#4-безопасность-и-шифрование)
5. [Что открыто, что закрыто](#5-что-открыто-что-закрыто)
6. [Зависимости](#6-зависимости)
7. [Принятые архитектурные решения](#7-принятые-архитектурные-решения)

---

## 1. Обзор системы

```
  Клиенты
  ──────────────────────────────────────────────────
  [Web]  [Android]  [Desktop]  [iOS]
    │         │          │        │
    └────┬────┘          │        │
         │               └────────┘
         │
         │ wss:// (WebSocket + TLS 1.3)
         │ https:// (REST для загрузки медиа)
         ▼
  ──────────────────────────────────────────────────
  Инфраструктура
  ──────────────────────────────────────────────────
  ┌─────────────────────────────────────────────┐
  │               Nginx                          │
  │  TLS-терминация, rate limiting (req/s),      │
  │  проксирование на Tinode и Compliance        │
  └───────────────┬─────────────────────────────┘
                  │
      ┌───────────┴───────────┐
      │                       │
  ┌───▼────────────┐   ┌──────▼──────────────┐
  │  Tinode Server │   │  Compliance Service  │
  │  (Go, форк)    │   │  (Go, закрытый)      │
  │  порт 6060     │   │  порт 8080           │
  └───────┬────────┘   └──────┬───────────────┘
          │                   │
    ┌─────┴──────┐      ┌─────┴──────┐
    │            │      │            │
 PostgreSQL   Redis   ComplianceDB  MinIO
 (сообщения, (сессии, (audit_log,  (медиа,
  топики,     кэш)    gov data)    файлы)
  пользов.)
```

---

## 2. Компоненты и их роли

### lastochka-server (Go, форк Tinode)

**Путь:** `lastochka-server/`  
**Лицензия:** GPL v3  
**Оригинал:** [github.com/tinode/chat](https://github.com/tinode/chat)

Основной backend для обмена сообщениями. Реализует:
- Протокол Tinode поверх WebSocket (JSON)
- Аутентификацию: `basic` (login/bcrypt-hash)
- Модель данных: Users → Topics (p2p, grp, fnd, me)
- REST API: `/v0/file/u/` — загрузка медиа, `/v0/health` — healthcheck
- Push-уведомления через FCM (опционально)
- Поиск пользователей через `fnd`-топик и теги

**Наши патчи** относительно upstream Tinode:
- Конфигурация для PostgreSQL (вместо MySQL по умолчанию)
- Настройка кластеризации
- MinIO как S3-бэкенд для медиа

Diff от upstream смотрите через `git log` в `lastochka-server/`.

### lastochka-ui (React)

**Путь:** `lastochka-ui/`  
**Лицензия:** Apache 2.0  
**Стек:** React 18 + TypeScript + Zustand + Tailwind CSS + Vite + tinode-sdk

Написан с нуля. Не является форком Tinodius или другого официального клиента.

Ключевые части:
| Путь | Назначение |
|------|-----------|
| `src/lib/tinode-client.ts` | Singleton-обёртка над tinode-sdk |
| `src/store/` | Zustand stores: auth, chats, ui |
| `src/components/chat/` | Основной UI чата |
| `src/components/admin/` | Панель администратора |
| `src/hooks/` | useMessages, useTyping, useOnlineStatus |

### lastochka-android (Kotlin + Compose)

**Путь:** `lastochka-android/`  
**Лицензия:** Apache 2.0

MVVM-архитектура:
```
UI (Compose) → ViewModel → Repository → TinodeHttpClient (OkHttp WebSocket) + Room DB
```

**Не является форком** Android-клиента Tinode (Tindroid). Написан с нуля с использованием tinodesdk.jar.

### lastochka-desktop (Electron)

**Путь:** `lastochka-desktop/`  
**Лицензия:** Apache 2.0

Electron-обёртка над той же кодовой базой, что и `lastochka-ui`, с адаптациями:
- Нативные уведомления ОС
- Автозапуск
- Tray-иконка

### lastochka-ios (Swift)

**Путь:** `lastochka-ios/`  
**Лицензия:** Apache 2.0  
**Основа:** форк [tinode/ios](https://github.com/tinode/ios)

Статус: ⏳ В разработке. Адаптация официального iOS-клиента Tinode.

### Compliance Service

**Путь:** не в этом репозитории  
**Лицензия:** проприетарная (не GPL)

Отдельный Go-сервис. Назначение: выполнение требований ФЗ-152 (хранение audit-лога, TOTP 2FA для государственных запросов). Хранит метаданные — не содержимое сообщений.

Причина закрытости: юридические требования и ограничения.

---

## 3. Потоки данных

### Отправка текстового сообщения

```
Пользователь вводит текст → UI (Zustand store)
  → tinode-sdk.publish(topic, drafty_content)
    → WebSocket → Nginx (TLS) → Tinode Server
      → PostgreSQL: INSERT INTO messages
        → Tinode Server → WebSocket → получатель
```

Сообщение никогда не проходит через Compliance-сервис.

### Загрузка изображения

```
Пользователь выбирает файл → сжатие на клиенте (canvas API)
  → multipart POST /v0/file/u/ → Tinode Server
    → MinIO (S3) → возвращает URL
      → tinode-sdk.publish с ref на URL
```

### Авторизация

```
login/password → tinode-sdk.loginBasic()
  → WebSocket hi + login пакеты → Tinode Server
    → bcrypt.Compare(password, hash) в PostgreSQL
      → session token (JWT-подобный) → localStorage / DataStore
```

### Поиск пользователей

```
Запрос → tinode-sdk.subscribe('fnd', ...) + setMeta(query)
  → Tinode Server → PostgreSQL: SELECT ... WHERE tags @> ARRAY[query]
    → результаты топиков → клиент
```

---

## 4. Безопасность и шифрование

### Transport Security

- **TLS 1.3** на всём входящем трафике (Nginx с Let's Encrypt)
- HSTS preload, HSTS max-age=31536000
- Заголовки: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy`

### Хранение паролей

- bcrypt с cost factor 11 (в Tinode по умолчанию)
- Пароль никогда не хранится в открытом виде

### Сессионные токены

- Tinode генерирует собственные токены (см. `lastochka-server/server/auth/`)
- Срок жизни: 7 дней по умолчанию
- Хранение: localStorage (Web), DataStore (Android)

### E2E шифрование

**Не реализовано.** Сообщения хранятся на сервере в незашифрованном виде.  
Это стандартное поведение Tinode. E2E — в backlog.

### Rate Limiting

- Nginx: 100 req/s per IP на `/v0/`
- Compliance: 10 req/s per IP (chi-rate)

---

## 5. Что открыто, что закрыто

| Компонент | Статус | Обоснование |
|-----------|--------|-------------|
| `lastochka-server/` | Открыт (GPL v3) | Форк открытого Tinode, GPL обязателен |
| `lastochka-ui/` | Открыт (Apache 2.0) | Наш код |
| `lastochka-android/` | Открыт (Apache 2.0) | Наш код |
| `lastochka-desktop/` | Открыт (Apache 2.0) | Наш код |
| `lastochka-ios/` | Открыт (Apache 2.0) | Форк открытого tinode/ios |
| Compliance Service | **Закрыт** | Юридические требования ФЗ-152 |
| Конфигурация production (`.env`) | **Закрыта** | Секреты (ключи, пароли) |
| Nginx-конфиг production | Закрыт | IP-адреса серверов |

---

## 6. Зависимости

### Tinode-сервер (Go)

Основные внешние зависимости из `lastochka-server/go.mod`:
- `jackc/pgx` — PostgreSQL драйвер
- `go-redis/redis` — Redis клиент
- `minio/minio-go` — MinIO/S3 клиент
- `appleboy/go-fcm` — Firebase Cloud Messaging

### Web-клиент (npm)

Основные из `lastochka-ui/package.json`:
- `tinode/tinode-sdk` — официальный SDK Tinode
- `react` 18 — UI framework
- `zustand` — state management
- `tailwindcss` — стили
- `lucide-react` — иконки

Нет: аналитических SDK, рекламных библиотек, трекеров.

### Android

Основные:
- `tinodesdk.jar` — официальный SDK Tinode для Android
- `androidx.compose.*` — Jetpack Compose
- `com.google.dagger:hilt` — DI
- `androidx.room.*` — локальная БД
- `com.squareup.okhttp3` — WebSocket

Нет: Firebase Analytics, Crashlytics, рекламных SDK.  
FCM (`firebase-messaging`) — только для push-уведомлений, опционально.

---

## 7. Принятые архитектурные решения

### ADR-001: PostgreSQL вместо MySQL

Tinode поддерживает оба. Выбран PostgreSQL из-за лучшей поддержки массивов (для тегов поиска `users.tags @>`) и более широкого распространения в РФ-хостинге.

### ADR-002: Compliance-сервис как отдельный бинарник

Не встроен в Tinode-форк, чтобы:
1. Не загрязнять GPL-код проприетарной логикой
2. Независимое масштабирование
3. Возможность аудита Tinode-форка отдельно от compliance-логики

### ADR-003: Web-клиент написан с нуля (не форк Tinodius)

Официальный веб-клиент Tinode (Tinodius) использует AngularJS. Мы выбрали React + TypeScript для более современного стека и glassmorphism-дизайна.

### ADR-004: Android написан с нуля (не форк Tindroid)

Tindroid (официальный Android-клиент) использует XML layouts + Java. Мы выбрали Kotlin + Jetpack Compose для современного Material 3 UI.

### ADR-005: MinIO для медиа

Избегаем зависимости от облачных провайдеров (AWS S3, GCS). MinIO развёрнут на том же сервере, совместим с S3 API.

### ADR-006: Chat Bot API как отдельный сервис + управление только через Web UI

Принято решение реализовать чат-ботов через отдельный сервис `bot-gateway`, расположенный рядом с Tinode, а не внутри Tinode и не внутри Compliance.

Причины:
1. Изоляция bot-логики и токенов от Tinode core.
2. Независимое масштабирование и rate-limiting для bot traffic.
3. Ускорение разработки Bot API без усложнения Tinode fork.

Ограничение интерфейсов управления:
1. Создание и управление ботами выполняется только через веб-интерфейс (раздел `Чат-боты`).
2. Мобильные клиенты (Android/iOS/Desktop как UI-обёртка) не предоставляют функций создания/управления ботами.
3. Runtime-вызовы Bot API для самих ботов выполняются по токену через `bot-gateway`.
