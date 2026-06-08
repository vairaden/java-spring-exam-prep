---
title: "8. Производительность: кеширование и N+1"
description: "Кеш 1-го и 2-го уровня, query cache, проблема N+1 и способы решения"
---

> Hibernate. Производительность: кеширование, проблема N + 1.

## Уровни кеширования

**Кеш первого уровня (L1)** — `Persistence Context` (Session). Включён **всегда**, работает
в рамках транзакции. Повторный `find(id)` в одной транзакции не идёт в БД. Очищается с
закрытием сессии.

**Кеш второго уровня (L2)** — общий между сессиями/транзакциями, живёт дольше. Не включён по
умолчанию; нужен провайдер (**Ehcache**, Caffeine, Infinispan, Hazelcast):
```java
@Entity
@Cacheable
@org.hibernate.annotations.Cache(usage = CacheConcurrencyStrategy.READ_WRITE)
public class Task { ... }
```
```yaml
spring.jpa.properties.hibernate.cache.use_second_level_cache: true
```
L2 эффективен для **редко меняющихся** справочных данных. Для часто изменяемых — риск
устаревших данных и инвалидации.

**Query cache** — кеширует результаты запросов (id + параметры → список id). Требует
отдельного включения и обычно используется вместе с L2.

## Проблема N+1

Самая частая проблема производительности ORM. При загрузке `N` сущностей с **LAZY**-связью
обращение к связи каждой из них генерирует **отдельный запрос**: 1 (список) + N (по связи) =
**N+1 запросов**.
```java
List<Task> tasks = repo.findAll();            // 1 запрос
for (Task t : tasks)
    t.getAttachments().size();                // +N запросов (по одному на задачу)
```

## Способы решения N+1

**1. JOIN FETCH (JPQL)** — подгрузить связь одним запросом:
```java
@Query("SELECT DISTINCT t FROM Task t LEFT JOIN FETCH t.attachments")
List<Task> findAllWithAttachments();
```

**2. EntityGraph** — декларативно указать, что грузить:
```java
@EntityGraph(attributePaths = "attachments")
List<Task> findAll();
```

**3. Batch fetching** — грузить связи пачками (`IN (?, ?, ...)`) вместо по одной:
```java
@BatchSize(size = 50)               // на сущности/коллекции
// или hibernate.default_batch_fetch_size
```

**4. DTO-проекция** — выбрать сразу нужные поля одним запросом без загрузки сущностей.

## Другие приёмы оптимизации

- **Батчинг вставок/обновлений**: `hibernate.jdbc.batch_size` (+ `SEQUENCE`, а не `IDENTITY`).
- **`@Transactional(readOnly = true)`** — отключает dirty checking для чтений.
- **Пагинация** вместо загрузки всей таблицы (см. вопрос 9).
- Логировать SQL (`hibernate.show_sql`, `spring.jpa.properties.hibernate.format_sql`) и
  считать запросы при разработке, чтобы ловить N+1.

## 🔗 Смежные вопросы
- [Б2.7 — Связи и каскады (fetch)](/block-2/07-associations/)
- [Б2.9 — Пагинация и сортировка](/block-2/09-pagination/)
- [Б2.5 — JPA и Hibernate](/block-2/05-jpa-hibernate/)

## 📚 Материалы
- [Лонгрид 8 — Продвинутый Spring Data JPA](/longreads/08-spring-data-advanced/)
- [Лонгрид 7 — Spring Data JPA и Hibernate](/longreads/07-jpa-hibernate/)
