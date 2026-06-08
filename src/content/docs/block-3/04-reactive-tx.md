---
title: "4. Реактивные транзакции и путь запроса"
description: "Реактивные транзакции, контекст вместо ThreadLocal, полный путь реактивного запроса"
---

> Реактивное программирование. Реактивные транзакции. Полный путь обработки реактивного запроса.

## Почему обычные транзакции не работают

Классический `@Transactional` хранит транзакцию в **`ThreadLocal`** (привязка к потоку). В
реактивном стеке цепочка выполняется на **разных потоках** EventLoop, поэтому ThreadLocal
теряется. Нужен механизм, передающий транзакционный контекст **через Reactor Context**, а
не через поток.

## Реактивные транзакции

Используются `ReactiveTransactionManager` (например, `R2dbcTransactionManager`) и
**реактивный `@Transactional`** — границы транзакции привязаны к жизненному циклу реактивной
цепочки (подписка/завершение), контекст передаётся через **Reactor Context**.

```java
@Service
public class TransferService {
    @Transactional                                  // реактивная транзакция (R2DBC)
    public Mono<Void> transfer(Long from, Long to, BigDecimal amount) {
        return repo.debit(from, amount)
            .then(repo.credit(to, amount))
            .then();                                 // commit при onComplete, rollback при onError
    }
}
```

Императивный вариант — `TransactionalOperator`:
```java
return txOperator.transactional(
    repo.debit(from, amount).then(repo.credit(to, amount))
);
```

Принцип: транзакция **коммитится** при успешном завершении потока (`onComplete`) и
**откатывается** при `onError`. Всё внутри должно быть неблокирующим и в одной цепочке.

## ThreadLocal → Reactor Context

В реактивном мире вместо `ThreadLocal` используется **`Context`** — иммутабельное
key-value хранилище, привязанное к **подписке** (а не к потоку) и передаваемое вверх по
цепочке. Так пробрасывают транзакцию, `SecurityContext`, MDC/`traceId`:
```java
Mono.deferContextual(ctx -> {
    String traceId = ctx.get("traceId");
    return ...;
});
// запись: .contextWrite(Context.of("traceId", id))
```

## Полный путь реактивного запроса

1. **Netty** принимает соединение в потоке **EventLoop** (неблокирующий I/O).
2. WebFlux формирует `ServerWebExchange` (реактивные `ServerHttpRequest`/`Response`).
3. **WebFilter**'ы (аналог интерсепторов) обрабатывают запрос реактивно; здесь же —
   `SecurityWebFilterChain` (реактивный Security).
4. `HandlerMapping`/`HandlerAdapter` находят и вызывают обработчик; тело декодируется
   реактивно (`Mono`/`Flux`), запускается валидация.
5. Контроллер возвращает **`Mono`/`Flux`** — это **описание** конвейера, ещё не результат.
6. Внутри — реактивные вызовы к БД (**R2DBC**) и внешним сервисам (**WebClient**), всё
   неблокирующее; при необходимости открывается реактивная транзакция.
7. Фреймворк **подписывается** на возвращённый `Publisher`; по мере поступления данных
   результат **кодируется** (JSON) и пишется в ответ потоково, с учётом **backpressure**.
8. EventLoop-поток **не блокируется** на ожидании — он обслуживает другие соединения, пока
   данные не готовы.

```
Netty(EventLoop) → WebFilter → HandlerMapping/Adapter → Controller(Mono/Flux)
   → R2DBC / WebClient (неблокирующе) → subscribe → encode(JSON) + backpressure → Response
```

## 🔗 Смежные вопросы
- [Б3.3 — R2DBC](/block-3/03-r2dbc/)
- [Б3.2 — Spring WebFlux](/block-3/02-webflux/)
- [Б2.3 — Транзакции (императивный аналог)](/block-2/03-transactions/)
- [Б1.10 — DispatcherServlet (путь запроса в MVC)](/block-1/10-dispatcherservlet/)

## 📚 Материалы
- [Лонгрид 13 — Асинхронная работа с БД. R2DBC](/longreads/13-r2dbc/)
- [Лонгрид 12 — Реактивный Spring. WebFlux](/longreads/12-webflux/)
