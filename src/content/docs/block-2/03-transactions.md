---
title: "3. Транзакции, изоляция, propagation"
description: "Императивные и декларативные транзакции, уровни изоляции, propagation"
---

> Императивные и декларативные транзакции в Spring JDBC. Уровни изоляции. Propagation.

## Транзакция и ACID

Транзакция — атомарная единица работы с БД, обладающая свойствами **ACID**: Atomicity
(всё или ничего), Consistency, Isolation, Durability.

## Императивные транзакции

Управление вручную через `TransactionTemplate` или `PlatformTransactionManager`:
```java
transactionTemplate.execute(status -> {
    repo.debit(from, amount);
    repo.credit(to, amount);
    return null;   // исключение → автоматический rollback
});
```
Подходит для тонкого контроля границ транзакции, но многословно.

## Декларативные транзакции

Через аннотацию **`@Transactional`** — Spring оборачивает метод прокси, открывая транзакцию
до и коммитя/откатывая после:
```java
@Service
public class TransferService {
    @Transactional
    public void transfer(Long from, Long to, BigDecimal amount) {
        repo.debit(from, amount);
        repo.credit(to, amount);
    }   // commit при норм. завершении; rollback при RuntimeException
}
```
Нюансы:
- По умолчанию откат **только на `RuntimeException`/`Error`** (не на checked!). Менять:
  `@Transactional(rollbackFor = Exception.class)`.
- Работает **через прокси** → не срабатывает при self-invocation (вызов внутри того же класса).
- `readOnly = true` — оптимизация для read-методов.

## Уровни изоляции

Определяют, насколько транзакции видят изменения друг друга (борьба с аномалиями):

| Уровень | Dirty read | Non-repeatable read | Phantom read |
|---|---|---|---|
| READ_UNCOMMITTED | возможен | возможен | возможен |
| READ_COMMITTED | нет | возможен | возможен |
| REPEATABLE_READ | нет | нет | возможен |
| SERIALIZABLE | нет | нет | нет |

- **Dirty read** — чтение незакоммиченных данных.
- **Non-repeatable read** — повторное чтение строки даёт другое значение (её изменили).
- **Phantom read** — повторный запрос возвращает новые строки (их вставили).

Чем выше изоляция — тем меньше аномалий, но больше блокировок и хуже конкуррентность.
`READ_COMMITTED` — дефолт в PostgreSQL. Задаётся: `@Transactional(isolation = Isolation.REPEATABLE_READ)`.

## Propagation (распространение)

Как метод ведёт себя относительно **существующей** транзакции:

- **`REQUIRED`** (по умолчанию) — присоединиться к текущей или создать новую.
- **`REQUIRES_NEW`** — **приостановить** текущую и открыть новую независимую (свой
  commit/rollback). Для аудита/логов, которые должны сохраниться даже при откате основной.
- **`SUPPORTS`** — выполнить в транзакции, если она есть, иначе без неё.
- **`NOT_SUPPORTED`** — выполнить вне транзакции (приостановить текущую).
- **`MANDATORY`** — требует существующую, иначе исключение.
- **`NEVER`** — требует отсутствие транзакции.
- **`NESTED`** — вложенная транзакция через savepoint (откат до точки внутри внешней).

```java
@Transactional(propagation = Propagation.REQUIRES_NEW)
public void writeAuditLog(...) { ... }   // сохранится независимо от внешней транзакции
```

## 🔗 Смежные вопросы
- [Б2.2 — Spring JDBC, JdbcTemplate](/block-2/02-spring-jdbc/)
- [Б2.5 — JPA и Hibernate](/block-2/05-jpa-hibernate/)
- [Б1.5 — Spring AOP и прокси (@Transactional)](/block-1/05-aop-proxies/)
- [Б3.4 — Реактивные транзакции](/block-3/04-reactive-tx/)

## 📚 Материалы
- [Лонгрид 6 — Spring JDBC и JdbcTemplate](/longreads/06-spring-jdbc/)
