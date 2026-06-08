---
title: "3. R2DBC и проблема блокировки потоков"
description: "Реактивный доступ к БД, почему JDBC не подходит реактивному стеку"
---

> Реактивное программирование. R2DBC. Проблема блокировки потоков в доступе к БД. Проблемы JDBC в реактивном стеке.

## Проблема: JDBC блокирует

**JDBC — синхронный и блокирующий API**: вызов `executeQuery()` блокирует поток до ответа БД.
В реактивном стеке (WebFlux/Netty) это критично: EventLoop-потоков мало, и каждый
блокирующий запрос «замораживает» поток, обслуживающий множество соединений. Преимущества
неблокирующей модели теряются — система деградирует под нагрузкой.

```
WebFlux (Netty, мало потоков) + JDBC (блокирует) = потоки заняты ожиданием БД → обвал
```

Обходной путь с JDBC — выносить запросы на отдельный пул (`Schedulers.boundedElastic()`),
но это возвращает thread-per-request модель «сбоку» и нивелирует смысл реактивности.

## R2DBC

**R2DBC** (Reactive Relational Database Connectivity) — спецификация **реактивного,
неблокирующего** доступа к реляционным БД. Драйвер не блокирует поток: запрос отправляется
асинхронно, поток освобождается, результат приходит как реактивный поток (`Flux`/`Mono`).
Есть драйверы для PostgreSQL, MySQL, MSSQL, H2.

## Spring Data R2DBC

Реактивные репозитории (аналог Spring Data JPA, но **без ORM/Hibernate** — это «лёгкий»
маппинг без кеша персистентности, lazy-loading и dirty checking):
```java
public interface TaskRepository extends ReactiveCrudRepository<Task, Long> {
    Flux<Task> findByStatus(Status status);
}

// сервис
public Mono<Task> getTask(Long id) {
    return repo.findById(id)
        .switchIfEmpty(Mono.error(new TaskNotFoundException(id)));
}
```
```yaml
spring.r2dbc:
  url: r2dbc:postgresql://localhost:5432/app
  username: app
  password: secret
```

## R2DBC vs JDBC/JPA

| | JDBC / Spring Data JPA | R2DBC / Spring Data R2DBC |
|---|---|---|
| Модель | блокирующая | неблокирующая |
| Возврат | объекты/коллекции | `Mono`/`Flux` |
| ORM-возможности | Hibernate (кеш, lazy, dirty check) | нет (простой маппинг) |
| Связи/каскады | да | вручную |
| Когда | классический MVC-стек | реактивный WebFlux-стек |

## Важно

- R2DBC оправдан **только** в полностью реактивном приложении; в обычном MVC он не нужен.
- Нет автоматических связей/`JOIN FETCH` как в JPA — джойны пишутся вручную.
- Весь путь должен быть неблокирующим: смешивать блокирующий JDBC в реактивной цепочке нельзя.

## 🔗 Смежные вопросы
- [Б3.2 — Spring WebFlux](/block-3/02-webflux/)
- [Б3.4 — Реактивные транзакции](/block-3/04-reactive-tx/)
- [Б2.1 — JDBC (блокирующая модель)](/block-2/01-jdbc/)
- [Б2.5 — JPA и Hibernate (что теряем без ORM)](/block-2/05-jpa-hibernate/)

## 📚 Материалы
- [Лонгрид 13 — Асинхронная работа с БД. R2DBC](/longreads/13-r2dbc/)
