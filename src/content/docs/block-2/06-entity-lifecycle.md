---
title: "6. Жизненный цикл сущности Hibernate"
description: "Состояния transient/managed/detached/removed и переходы"
---

> Hibernate. Жизненный цикл сущности Hibernate.

## Persistence Context

Сущности живут внутри **Persistence Context** (контекст персистентности) — это кеш
первого уровня в рамках `EntityManager`/Session (обычно — в рамках транзакции). Контекст
**отслеживает** управляемые сущности и автоматически синхронизирует их с БД.

## Состояния сущности

**1. Transient (новая/temporary)** — объект создан через `new`, **не связан** с контекстом
и не имеет записи в БД. Hibernate о нём не знает.
```java
Task t = new Task("Buy milk");   // transient
```

**2. Managed / Persistent (управляемая)** — связана с контекстом; все изменения
отслеживаются (**dirty checking**) и попадут в БД при flush/commit.
```java
em.persist(t);          // transient → managed
Task t2 = em.find(Task.class, 1L);   // загружена → managed
t2.setTitle("New");     // изменение зафиксируется автоматически, без save()
```

**3. Detached (отсоединённая)** — была managed, но контекст закрыт (или вызван `detach`/
`clear`). Изменения **не отслеживаются**. Чтобы снова привязать — `merge`.
```java
em.detach(t2);          // managed → detached
// после закрытия транзакции/сессии все сущности становятся detached
Task merged = em.merge(t2);   // detached → managed (возвращает managed-копию)
```

**4. Removed (удалённая)** — помечена на удаление; DELETE выполнится при flush/commit.
```java
em.remove(t2);          // managed → removed
```

## Переходы (диаграмма)

```
   new            persist()           commit/close
[Transient] ───────────────▶ [Managed] ──────────────▶ [Detached]
                                │  ▲                         │
                         remove()│  │ merge()  ◀─────────────┘
                                ▼  │
                            [Removed]
```

## Операции EntityManager

| Метод | Действие |
|---|---|
| `persist(e)` | transient → managed (запланировать INSERT) |
| `find()/getReference()` | загрузить как managed |
| `merge(e)` | detached → managed (копия) |
| `remove(e)` | managed → removed (запланировать DELETE) |
| `detach(e)` | managed → detached |
| `flush()` | синхронизировать контекст с БД (выполнить SQL) |
| `clear()` | отсоединить все сущности |

## Практические следствия

- В managed-состоянии **не нужно вызывать `save()`** — dirty checking сам сделает UPDATE.
- `merge` возвращает **новый** managed-объект; исходный detached остаётся detached.
- `LazyInitializationException` возникает при обращении к lazy-связи у **detached**-сущности
  (контекст уже закрыт) — типичная ошибка при возврате сущности из сервиса в контроллер.

## 🔗 Смежные вопросы
- [Б2.5 — JPA и Hibernate](/block-2/05-jpa-hibernate/)
- [Б2.7 — Связи и каскады](/block-2/07-associations/)
- [Б2.8 — Производительность, N+1 (LazyInitializationException)](/block-2/08-performance/)

## 📚 Материалы
- [Лонгрид 7 — Spring Data JPA и Hibernate](/longreads/07-jpa-hibernate/)
