---
title: "1. JDBC: Statement, PreparedStatement, ResultSet"
description: "JDBC API, выполнение запросов, транзакции, Driver"
---

> JDBC: Statement, PreparedStatement, ResultSet. Выполнение запросов. Транзакции. Driver.

## Что такое JDBC

**JDBC** (Java Database Connectivity) — низкоуровневый стандартный API для работы с
реляционными БД из Java. Основные абстракции: `Driver`, `Connection`, `Statement`,
`ResultSet`.

## Driver

**Driver** — реализация JDBC под конкретную СУБД (например, `org.postgresql.Driver`),
переводящая вызовы JDBC в протокол БД. Регистрируется автоматически через ServiceLoader
(`META-INF/services`). Соединение получают через `DriverManager` или `DataSource`:
```java
Connection conn = DriverManager.getConnection(
    "jdbc:postgresql://localhost:5432/db", "user", "pass");
```

## Statement

Выполняет **статический** SQL. Уязвим для **SQL-инъекций** при конкатенации параметров:
```java
Statement st = conn.createStatement();
ResultSet rs = st.executeQuery("SELECT * FROM tasks");
// ОПАСНО: "SELECT * FROM tasks WHERE name = '" + userInput + "'"
```

## PreparedStatement

**Предкомпилированный** запрос с параметрами-плейсхолдерами `?`. Преимущества:
- **защита от SQL-инъекций** (параметры передаются отдельно от SQL);
- **производительность** (план запроса переиспользуется);
- удобная типизация параметров.
```java
PreparedStatement ps = conn.prepareStatement(
    "SELECT * FROM tasks WHERE status = ? AND priority > ?");
ps.setString(1, "DONE");
ps.setInt(2, 3);
ResultSet rs = ps.executeQuery();
```
(`CallableStatement` — для хранимых процедур.)

## ResultSet

Курсор по результату `SELECT`. Перебор построчно; колонки по имени/индексу:
```java
while (rs.next()) {
    long id = rs.getLong("id");
    String title = rs.getString("title");
}
```
Методы выполнения: `executeQuery()` → `ResultSet` (SELECT); `executeUpdate()` → число
изменённых строк (INSERT/UPDATE/DELETE); `execute()` — универсальный.

## Транзакции в JDBC

По умолчанию `autoCommit = true` (каждый запрос — отдельная транзакция). Для группировки:
```java
conn.setAutoCommit(false);
try {
    ps1.executeUpdate();
    ps2.executeUpdate();
    conn.commit();              // фиксация
} catch (SQLException e) {
    conn.rollback();            // откат при ошибке
} finally {
    conn.setAutoCommit(true);
}
```

## Управление ресурсами

`Connection`, `Statement`, `ResultSet` — ресурсы, которые **нужно закрывать** (иначе утечки).
Использовать **try-with-resources**:
```java
try (Connection c = ds.getConnection();
     PreparedStatement ps = c.prepareStatement(sql);
     ResultSet rs = ps.executeQuery()) { ... }
```
Минусы «голого» JDBC: много boilerplate, ручное управление ресурсами и транзакциями,
риск инъекций — это решает **Spring JDBC** (см. вопрос 2).

## 🔗 Смежные вопросы
- [Б2.2 — Spring JDBC, JdbcTemplate](/block-2/02-spring-jdbc/)
- [Б2.3 — Транзакции, изоляция, propagation](/block-2/03-transactions/)
- [Б3.3 — R2DBC (почему JDBC блокирует)](/block-3/03-r2dbc/)

## 📚 Материалы
- [Лонгрид 6 — Spring JDBC и JdbcTemplate](/longreads/06-spring-jdbc/)
