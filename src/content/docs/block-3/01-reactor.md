---
title: "1. Project Reactor и Reactive Streams"
description: "Реактивное программирование, Mono/Flux, Reactive Streams, backpressure, тестирование"
---

> Реактивное программирование. Project Reactor. Reactive Streams. Тестирование.

## Реактивное программирование

Парадигма работы с **асинхронными потоками данных** в декларативном стиле. Вместо
блокирующего ожидания результата описывается **конвейер** преобразований, который
выполняется при поступлении данных. Цель — высокая пропускная способность на I/O-bound
нагрузке малым числом потоков (неблокирующий I/O).

Принципы (Reactive Manifesto): **отзывчивость**, **устойчивость**, **эластичность**,
**управление сообщениями**.

## Reactive Streams

Стандарт (спецификация) асинхронных потоков с **backpressure**. Четыре интерфейса:
- **`Publisher`** — источник данных.
- **`Subscriber`** — потребитель (`onNext`, `onError`, `onComplete`).
- **`Subscription`** — связь, через неё подписчик **запрашивает** N элементов (`request(n)`).
- **`Processor`** — и Publisher, и Subscriber.

**Backpressure** — ключевая идея: подписчик сам регулирует темп (`request(n)`), чтобы
быстрый продюсер не «затопил» медленного консьюмера. Project Reactor, RxJava, Akka Streams —
реализации этого стандарта.

## Project Reactor

Реактивная библиотека, лежащая в основе Spring WebFlux. Два основных типа `Publisher`:
- **`Mono<T>`** — 0 или 1 элемент (например, один объект или пусто).
- **`Flux<T>`** — 0..N элементов (поток).

```java
Mono<Task> task = repo.findById(id);            // 0..1
Flux<Task> tasks = repo.findAll();              // 0..N

Flux.range(1, 5)
    .map(i -> i * 2)
    .filter(i -> i > 4)
    .flatMap(i -> callAsync(i))                 // асинхронное преобразование
    .subscribe(System.out::println);            // конвейер запускается только при подписке!
```

## Ключевые понятия

- **Lazy**: цепочка не выполняется, пока нет `subscribe()` (или подписки фреймворком).
- **Операторы**: `map`, `flatMap`, `filter`, `zip`, `merge`, `onErrorResume`, `retry`, `timeout`.
- **Schedulers** — на каком пуле выполнять: `subscribeOn`/`publishOn`
  (`Schedulers.boundedElastic()` для блокирующих вызовов, `parallel()` для CPU).
- **Никогда не блокировать** реактивный поток (`block()` в обработчике убивает преимущества).

## Тестирование: StepVerifier

`reactor-test` проверяет поток по шагам, без блокировки:
```java
StepVerifier.create(service.getTasks())
    .expectNext(task1)
    .expectNext(task2)
    .expectComplete()
    .verify();

StepVerifier.create(service.failing())
    .expectError(TaskNotFoundException.class)
    .verify();
```
`StepVerifier.withVirtualTime(...)` тестирует задержки без реального ожидания.

## 🔗 Смежные вопросы
- [Б3.2 — Spring WebFlux](/block-3/02-webflux/)
- [Б3.3 — R2DBC](/block-3/03-r2dbc/)
- [Б3.4 — Реактивные транзакции и путь запроса](/block-3/04-reactive-tx/)

## 📚 Материалы
- [Лонгрид 12 — Реактивный Spring. WebFlux](/longreads/12-webflux/)
