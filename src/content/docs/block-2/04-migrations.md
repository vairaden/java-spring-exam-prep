---
title: "4. Миграции: Flyway / Liquibase"
description: "Версионирование схемы БД, Flyway и Liquibase"
---

> Миграции: Flyway (Liquibase).

## Зачем миграции

**Миграции** версионируют схему БД в коде (в репозитории), обеспечивая воспроизводимое,
автоматическое и согласованное изменение БД во всех окружениях. Решают проблему «у меня на
машине схема одна, на проде другая». Каждая миграция применяется **один раз** и фиксируется
в служебной таблице истории.

## Flyway

Основан на **SQL-скриптах** с соглашением об именовании. Версионные миграции:
```
db/migration/
  V1__create_tasks.sql
  V2__add_priority_column.sql
  V3__create_attachments.sql
```
- `V<версия>__<описание>.sql` — versioned (применяется по возрастанию версии).
- `R__<описание>.sql` — repeatable (применяется при изменении контрольной суммы).

Flyway хранит историю в таблице **`flyway_schema_history`** (версия, checksum, статус).
При старте применяет недостающие миграции. **Checksum** уже применённых миграций менять
нельзя — Flyway это контролирует (новое изменение — новая миграция).

В Spring Boot подключается автоматически:
```gradle
implementation 'org.flywaydb:flyway-core'
implementation 'org.flywaydb:flyway-database-postgresql'
```
```yaml
spring.flyway:
  enabled: true
  locations: classpath:db/migration
```

## Liquibase

Более мощная альтернатива. Миграции (**changeSet**) описываются в **XML/YAML/JSON/SQL** —
абстрактно от СУБД, поэтому один changelog работает на разных БД. Поддерживает **rollback**
(описание отката), теги, контексты, preconditions.
```yaml
databaseChangeLog:
  - changeSet:
      id: 1
      author: dev
      changes:
        - createTable:
            tableName: tasks
            columns:
              - column: { name: id, type: bigint, autoIncrement: true }
              - column: { name: title, type: varchar(255) }
```
История — в таблицах `DATABASECHANGELOG` и `DATABASECHANGELOGLOCK`.

## Flyway vs Liquibase

| | Flyway | Liquibase |
|---|---|---|
| Формат | SQL (и Java) | XML/YAML/JSON/SQL |
| Кросс-СУБД абстракция | нет (чистый SQL) | да |
| Rollback | в Pro/вручную | встроенный |
| Порог входа | низкий | выше |

Flyway проще и ближе к SQL; Liquibase гибче и абстрактнее. Оба интегрированы со Spring Boot
и запускаются автоматически при старте приложения.

## 🔗 Смежные вопросы
- [Б2.5 — JPA и Hibernate (схема и сущности)](/block-2/05-jpa-hibernate/)
- [Б2.2 — Spring JDBC, DataSource](/block-2/02-spring-jdbc/)

## 📚 Материалы
- [Лонгрид 6 — Spring JDBC и JdbcTemplate](/longreads/06-spring-jdbc/)
