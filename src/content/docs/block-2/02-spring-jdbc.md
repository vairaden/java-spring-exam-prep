---
title: "2. Spring JDBC, DataSource, JdbcTemplate"
description: "Connection pool, DataSource, JdbcTemplate"
---

> Spring JDBC. Connection pool. DataSource. JdbcTemplate.

## Зачем Spring JDBC

Spring JDBC убирает boilerplate «голого» JDBC: управление соединениями/ресурсами,
обработку `SQLException`, маппинг строк. Разработчик пишет только SQL и логику маппинга.

## DataSource

**`DataSource`** — фабрика соединений, абстракция над получением `Connection`. В отличие от
`DriverManager`, `DataSource` управляет **пулом** соединений и конфигурируется через бины.
В Spring Boot создаётся автоматически из `spring.datasource.*`:
```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/app
    username: app
    password: secret
```

## Connection pool

Открытие физического соединения с БД — **дорогая** операция (TCP + аутентификация). **Пул**
заранее создаёт набор соединений и переиспользует их: `getConnection()` берёт свободное из
пула, `close()` возвращает обратно (не закрывает физически). Это резко повышает throughput.

**HikariCP** — пул по умолчанию в Spring Boot (быстрый, лёгкий). Настройка:
```yaml
spring.datasource.hikari:
  maximum-pool-size: 10
  minimum-idle: 2
  connection-timeout: 30000
  max-lifetime: 1800000
```

## JdbcTemplate

Центральный класс Spring JDBC. Берёт соединение из `DataSource`, выполняет SQL, маппит
результат, закрывает ресурсы, транслирует `SQLException` → `DataAccessException`
(unchecked).

**Запросы (SELECT):**
```java
// Один объект
Task task = jdbc.queryForObject(
    "SELECT * FROM tasks WHERE id = ?",
    (rs, rowNum) -> new Task(rs.getLong("id"), rs.getString("title")),
    id);

// Список
List<Task> tasks = jdbc.query("SELECT * FROM tasks", rowMapper);

// Скаляр
int count = jdbc.queryForObject("SELECT count(*) FROM tasks", Integer.class);
```

**Изменения (INSERT/UPDATE/DELETE):**
```java
int updated = jdbc.update(
    "UPDATE tasks SET status = ? WHERE id = ?", "DONE", id);
```

**RowMapper** — функция «строка `ResultSet` → объект». Можно использовать
`BeanPropertyRowMapper` для автомаппинга по именам полей.

## Дополнительные шаблоны

- **`NamedParameterJdbcTemplate`** — именованные параметры `:name` вместо `?` (читабельнее):
```java
named.update("INSERT INTO tasks(title) VALUES (:title)",
    new MapSqlParameterSource("title", "Buy milk"));
```
- **`SimpleJdbcInsert`** — упрощённая вставка с возвратом сгенерированного ключа.

## 🔗 Смежные вопросы
- [Б2.1 — JDBC](/block-2/01-jdbc/)
- [Б2.3 — Транзакции, изоляция, propagation](/block-2/03-transactions/)
- [Б2.5 — JPA и Hibernate](/block-2/05-jpa-hibernate/)
- [Б1.9 — Properties (конфигурация DataSource)](/block-1/09-properties/)

## 📚 Материалы
- [Лонгрид 6 — Spring JDBC и JdbcTemplate](/longreads/06-spring-jdbc/)
