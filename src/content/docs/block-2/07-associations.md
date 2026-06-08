---
title: "7. Связи и каскадные операции"
description: "@OneToMany, @ManyToOne, @ManyToMany, владелец связи, cascade, orphanRemoval"
---

> Hibernate. Связи в сущностях и каскадные операции.

## Виды связей

- **`@OneToOne`** — один-к-одному (пользователь ↔ профиль).
- **`@OneToMany` / `@ManyToOne`** — один-ко-многим (задача ↔ её вложения).
- **`@ManyToMany`** — многие-ко-многим (задачи ↔ теги), через связующую таблицу.

```java
@Entity
public class Task {
    @OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<Attachment> attachments = new ArrayList<>();
}

@Entity
public class Attachment {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")          // владелец связи: здесь FK
    private Task task;
}
```

## Владелец связи (owning side)

В двунаправленной связи одна сторона — **владелец** (хранит внешний ключ), другая —
**обратная** (`mappedBy`). Hibernate синхронизирует FK по **владельцу**. Поэтому при
добавлении нужно проставлять обе стороны (helper-метод):
```java
public void addAttachment(Attachment a) {
    attachments.add(a);
    a.setTask(this);   // иначе FK не запишется
}
```
В `@ManyToOne`/`@JoinColumn` владелец — сторона с FK; в `@OneToMany(mappedBy=...)` —
обратная сторона.

## Fetch: EAGER vs LAZY

- **LAZY** — связь грузится по требованию (через прокси). По умолчанию для `@OneToMany`/
  `@ManyToMany`.
- **EAGER** — грузится сразу вместе с сущностью. По умолчанию для `@ManyToOne`/`@OneToOne`.

Рекомендация: делать связи **LAZY** и подгружать явно через `JOIN FETCH`/EntityGraph,
чтобы избежать лишних запросов и проблемы N+1 (см. вопрос 8).

## Каскадные операции (cascade)

Распространяют операции с родителя на связанные сущности:

| CascadeType | Действие |
|---|---|
| `PERSIST` | сохранение родителя → сохраняет детей |
| `MERGE` | merge родителя → merge детей |
| `REMOVE` | удаление родителя → удаляет детей |
| `REFRESH` | обновление из БД распространяется |
| `DETACH` | отсоединение распространяется |
| `ALL` | все вышеперечисленные |

```java
@OneToMany(mappedBy = "task", cascade = CascadeType.ALL, orphanRemoval = true)
```

## orphanRemoval

`orphanRemoval = true` — если дочерняя сущность **удалена из коллекции** родителя, она
удаляется и из БД (становится «сиротой»). Отличие от `CascadeType.REMOVE`: REMOVE
срабатывает при удалении **родителя**, а orphanRemoval — при разрыве связи.
```java
task.getAttachments().remove(att);   // при orphanRemoval=true → DELETE этого attachment
```
Осторожно с `CascadeType.REMOVE`/`ALL` на больших коллекциях и `@ManyToMany` — можно
случайно удалить нужные данные.

## 🔗 Смежные вопросы
- [Б2.5 — JPA и Hibernate](/block-2/05-jpa-hibernate/)
- [Б2.6 — Жизненный цикл сущности](/block-2/06-entity-lifecycle/)
- [Б2.8 — Производительность, N+1 (fetch, JOIN FETCH)](/block-2/08-performance/)

## 📚 Материалы
- [Лонгрид 7 — Spring Data JPA и Hibernate](/longreads/07-jpa-hibernate/)
