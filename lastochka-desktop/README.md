# Ласточка Web Prototype

Новая веб-версия интерфейса на базе `mobile-prototype`.

## Запуск

```bash
cd web-prototype
npm install
# при необходимости:
# cp .env.example .env.local
npm run dev
```

## Сборка

```bash
npm run build
```

## Что адаптировано под web/desktop

- На экранах `>= 1024px` включается split-view:
  - слева список чатов
  - справа активный чат или empty-state
- На мобильных экранах сохранена навигация прототипа (chat list -> chat -> back).
- Экран настроек открывается отдельно в обоих режимах.
