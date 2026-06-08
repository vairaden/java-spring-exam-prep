---
title: "10. Spring Data Repository, JPQL, HQL"
description: "Derived queries, @Query, JPQL/HQL, native query, кастомные методы"
---

> Spring Data Repository. Добавление новых методов. JPQL, HQL.

## Способы добавить методы в репозиторий

**1. Derived queries (по имени метода)** — Spring парсит имя и строит запрос:
```java
List<Task> findByStatusAndPriorityGreaterThan(Status s, int p);
List<Task> findByTitleContainingIgnoreCase(String part);
Optional<Task> findFirstByOrderByCreatedAtDesc();
long countByStatus(Status s);
boolean existsByTitle(String title);
```
Ключевые слова: `And/Or`, `Between`, `LessThan/GreaterThan`, `Like/Containing`,
`In`, `OrderBy`, `IgnoreCase`, `True/False`, `Null`. Удобно для простых запросов, но
длинные имена нечитаемы.

**2. `@Query` (JPQL)** — явный запрос, когда derived неудобен:
```java
@Query("SELECT t FROM Task t WHERE t.priority > :p ORDER BY t.createdAt DESC")
List<Task> findHighPriority(@Param("p") int p);
```

**3. Native query** — чистый SQL (специфика СУБД, сложные запросы):
```java
@Query(value = "SELECT * FROM tasks WHERE title ILIKE %:q%", nativeQuery = true)
List<Task> search(@Param("q") String q);
```

**4. Модифицирующие запросы** — UPDATE/DELETE:
```java
@Modifying
@Query("UPDATE Task t SET t.status = :s WHERE t.id = :id")
int updateStatus(@Param("id") Long id, @Param("s") Status s);
```
(Требует `@Transactional`; не проходит через dirty checking.)

**5. Кастомная реализация (fragment)** — для сложной логики (Criteria API, несколько шагов):
```java
interface TaskRepositoryCustom { List<Task> complexSearch(Filter f); }
class TaskRepositoryImpl implements TaskRepositoryCustom { /* EntityManager */ }
interface TaskRepository extends JpaRepository<Task, Long>, TaskRepositoryCustom {}
```

**6. Проекции** — возвращать DTO/интерфейс вместо сущности:
```java
interface TaskTitleView { Long getId(); String getTitle(); }
List<TaskTitleView> findByStatus(Status s);
```

## JPQL vs HQL vs SQL

- **JPQL** (Jakarta Persistence Query Language) — **стандарт JPA**, объектно-ориентированный
  язык запросов. Работает с **сущностями и их полями**, а не с таблицами/колонками:
  `SELECT t FROM Task t WHERE t.status = :s` (где `Task` — класс, `status` — поле).
  Переносим между JPA-провайдерами.
- **HQL** (Hibernate Query Language) — «родной» язык Hibernate, **надмножество JPQL** с
  дополнительными возможностями (специфичные функции, более гибкий синтаксис). Привязан к
  Hibernate.
- **SQL (native)** — работает напрямую с таблицами/колонками БД, специфичен для СУБД.

JPQL/HQL транслируются Hibernate в SQL под конкретный диалект. Используй JPQL по умолчанию
(переносимость), native — когда нужны возможности СУБД, недоступные в JPQL.

## 🔗 Смежные вопросы
- [Б2.5 — JPA и Hibernate](/block-2/05-jpa-hibernate/)
- [Б2.9 — Пагинация и сортировка](/block-2/09-pagination/)
- [Б2.8 — Производительность, N+1](/block-2/08-performance/)

## 📚 Материалы
- [Лонгрид 8 — Продвинутый Spring Data JPA](/longreads/08-spring-data-advanced/)
