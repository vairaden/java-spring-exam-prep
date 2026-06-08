---
title: "11. Контейнеры сервлетов"
description: "Tomcat, Jetty, Undertow, Netty — модели обработки и отличия"
---

> Контейнеры сервлетов: Tomcat, Jetty, Undertow, Netty.

## Что такое контейнер сервлетов

**Контейнер сервлетов** — рантайм, который принимает TCP/HTTP-соединения, управляет
жизненным циклом сервлетов, пулом потоков и преобразует запрос/ответ в Servlet API
(`HttpServletRequest`/`Response`). В Spring Boot контейнер **встроенный** — приложение
запускается как обычный `jar`.

## Модель Thread-per-request vs Event-loop

- **Thread-per-request (блокирующая)** — на каждый запрос выделяется поток из пула, он
  занят всё время обработки (включая ожидание БД/сети). Просто, но потоки дорогие; под
  высокой конкуррентностью пул исчерпывается. Используется в Spring MVC.
- **Event-loop (неблокирующая)** — небольшое число потоков обрабатывает много соединений
  асинхронно. Эффективно для I/O-bound и большого числа соединений. Используется в Spring WebFlux.

## Tomcat

Стандарт де-факто и **дефолт Spring Boot** (`spring-boot-starter-web`). Зрелый, стабильный,
полная поддержка Servlet API, модель thread-per-request. Хороший выбор для большинства
приложений.

## Jetty

Лёгкий, модульный сервлет-контейнер. Исторически популярен во встраиваемых сценариях и
для long-polling/WebSocket. Тоже блокирующая модель (с асинхронными возможностями).
Альтернатива Tomcat при исключении `spring-boot-starter-tomcat` и добавлении
`spring-boot-starter-jetty`.

## Undertow

Высокопроизводительный контейнер от JBoss/Red Hat на базе **XNIO**. Поддерживает и
блокирующий, и **неблокирующий** режимы, малый расход памяти, хорош под высокой нагрузкой.
Подключается через `spring-boot-starter-undertow`.

## Netty

**Не сервлет-контейнер**, а асинхронный сетевой фреймворк на **event-loop**. Это сервер по
умолчанию для **Spring WebFlux** (реактивный стек). Работает по неблокирующей модели,
масштабируется на большое число соединений малым числом потоков. Не реализует Servlet API —
вместо него реактивные абстракции (`ServerHttpRequest`/`ServerHttpResponse`).

## Сводка

| Сервер | Стек | Модель | Особенность |
|---|---|---|---|
| Tomcat | MVC | thread-per-request | дефолт, зрелый |
| Jetty | MVC | thread-per-request | лёгкий, embeddable |
| Undertow | MVC | блок./неблок. | производительный, лёгкий |
| Netty | WebFlux | event-loop | реактивный, дефолт WebFlux |

## 🔗 Смежные вопросы
- [Б1.10 — DispatcherServlet](/block-1/10-dispatcherservlet/)
- [Б3.2 — Spring WebFlux (Netty, EventLoop)](/block-3/02-webflux/)

## 📚 Материалы
- [Лонгрид 5 — DispatcherServlet и формирование ответов](/longreads/05-dispatcher-responses/)
- [Лонгрид 12 — Реактивный Spring. WebFlux](/longreads/12-webflux/) — Netty и EventLoop
