---
title: "5. JPA и Hibernate"
description: "ORM, принцип работы Hibernate, аннотации маппинга, JPA-репозитории"
---

> JPA и Hibernate. Принцип работы Hibernate. @Table, @Id, @GeneratedValue, @Column. JPA-репозитории в Spring.

## ORM, JPA, Hibernate, Spring Data — как связаны

- **ORM** (Object-Relational Mapping) — концепция отображения объектов на таблицы.
- **JPA** (Jakarta Persistence API) — **спецификация** (стандарт) ORM: аннотации,
  `EntityManager`, JPQL. Сама по себе ничего не делает.
- **Hibernate** — самая популярная **реализация** JPA (ORM-движок).
- **Spring Data JPA** — надстройка над JPA/Hibernate: автогенерация репозиториев.

```
Spring Data JPA → JPA (спецификация) → Hibernate (реализация) → JDBC → БД
```

## Принцип работы Hibernate

Hibernate отображает **сущности** (классы) на таблицы и автоматически генерирует SQL.
Ключевые механизмы:
- **Persistence Context (контекст персистентности)** — кеш первого уровня внутри
  `EntityManager`/Session: отслеживает управляемые сущности.
- **Dirty checking** — при коммите Hibernate сравнивает текущее состояние управляемых
  сущностей со снимком и генерирует UPDATE только для изменённых.
- **Lazy loading** — связи грузятся по требованию через прокси.
- **Write-behind** — SQL откладывается и выполняется пакетно при flush/commit.

## Аннотации маппинга

```java
@Entity
@Table(name = "tasks")                    // имя таблицы (по умолчанию — имя класса)
public class Task {

    @Id                                   // первичный ключ
    @GeneratedValue(strategy = GenerationType.IDENTITY)  // стратегия генерации
    private Long id;

    @Column(name = "title", nullable = false, length = 255)  // настройка колонки
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    @Enumerated(EnumType.STRING)
    private Priority priority;

    @CreationTimestamp
    private LocalDateTime createdAt;
}
```

**`@GeneratedValue` — стратегии генерации ключа:**
- `IDENTITY` — auto-increment колонка БД (не работает с JDBC-батчингом вставок).
- `SEQUENCE` — последовательность БД (рекомендуется для PostgreSQL; поддерживает батч).
- `AUTO` — Hibernate выбирает по диалекту.
- `TABLE` — отдельная таблица-счётчик (устаревший, медленный).

## JPA-репозитории в Spring Data

Объявляешь **интерфейс** — Spring Data генерирует реализацию в рантайме:
```java
public interface TaskRepository extends JpaRepository<Task, Long> {
    // готовые методы: save, findById, findAll, delete, count, ...
    List<Task> findByStatus(Status status);          // derived query — SQL по имени метода
    List<Task> findByPriorityGreaterThan(int p);
}
```
Иерархия: `Repository` → `CrudRepository` → `PagingAndSortingRepository` → `JpaRepository`
(добавляет `flush`, `saveAll`, `findAll(Sort)` и др.).

## 🔗 Смежные вопросы
- [Б2.6 — Жизненный цикл сущности](/block-2/06-entity-lifecycle/)
- [Б2.7 — Связи и каскады](/block-2/07-associations/)
- [Б2.8 — Производительность, N+1](/block-2/08-performance/)
- [Б2.10 — Spring Data, JPQL/HQL](/block-2/10-spring-data/)
- [Б2.2 — Spring JDBC (уровень ниже)](/block-2/02-spring-jdbc/)

## 📚 Материалы
- [Лонгрид 7 — Spring Data JPA и Hibernate](/longreads/07-jpa-hibernate/)
