---
title: "7. Стереотипные аннотации, скоупы, провайдеры"
description: "@Component и его специализации, scopes, ObjectFactory/ObjectProvider/Provider"
---

> Bean. Стереотипные аннотации. Скоупы бинов. Управление бинами посредством: ObjectFactory, ObjectProvider, Provider.

## Стереотипные аннотации

Помечают класс как бин для component scan. Все производны от `@Component`:

- **`@Component`** — общий стереотип.
- **`@Service`** — слой бизнес-логики (семантический маркер).
- **`@Repository`** — слой доступа к данным; дополнительно включает **трансляцию
  исключений persistence** в `DataAccessException`.
- **`@Controller` / `@RestController`** — веб-слой (обработчики запросов).
- **`@Configuration`** — класс с `@Bean`-методами (тоже компонент).

Чтобы Spring их нашёл, нужен `@ComponentScan` (включён в `@SpringBootApplication`).

## Скоупы бинов

Определяют, сколько экземпляров создаётся и сколько живёт бин:

- **`singleton`** (по умолчанию) — один экземпляр на контейнер.
- **`prototype`** — новый экземпляр на **каждый запрос бина** из контейнера.
- Веб-скоупы (для web-контекста):
  - **`request`** — один на HTTP-запрос;
  - **`session`** — один на HTTP-сессию;
  - **`application`** — один на `ServletContext`;
  - **`websocket`** — на сессию WebSocket.

```java
@Component
@Scope(value = "request", proxyMode = ScopedProxyMode.TARGET_CLASS)
public class RequestScopedBean { ... }
```

## Проблема «короткоживущий бин внутри singleton»

Если внедрить `prototype`/`request`-бин в `singleton`, он внедрится **один раз** при
создании singleton'а и «замёрзнет». Решения:

**1. Scoped proxy** — `proxyMode = TARGET_CLASS`: внедряется прокси, который на каждом
обращении достаёт актуальный экземпляр из нужного скоупа.

**2. `ObjectFactory<T>`** — функциональный интерфейс с `getObject()`; ленивое получение
свежего бина при каждом вызове:
```java
@Autowired ObjectFactory<PrototypeBean> factory;
PrototypeBean b = factory.getObject(); // новый prototype каждый раз
```

**3. `ObjectProvider<T>`** (Spring) — расширение `ObjectFactory` с удобными методами:
`getIfAvailable()`, `getIfUnique()`, `ifAvailable(...)`, поддержка `Stream`. Полезен для
**опциональных** и **множественных** зависимостей без NPE/исключений:
```java
@Autowired ObjectProvider<TaskValidator> validators;
validators.ifAvailable(v -> v.validate(task));
```

**4. `Provider<T>`** (JSR-330, `jakarta.inject.Provider`) — стандартный аналог
`ObjectFactory` с методом `get()`; делает код менее привязанным к Spring API.

Все три (`ObjectFactory`, `ObjectProvider`, `Provider`) решают одну задачу — **отложенное
и повторяемое получение бина**, обходя «замораживание» зависимости в singleton'е.

## 🔗 Смежные вопросы
- [Б1.6 — Жизненный цикл бина](/block-1/06-bean-lifecycle/)
- [Б1.2 — IoC и DI](/block-1/02-ioc-di/)
- [Б1.8 — Аннотации конфигураций](/block-1/08-config-annotations/)

## 📚 Материалы
- [Лонгрид 3 — Стереотипные аннотации и конфигурирование](/longreads/03-stereotypes-config/)
- [Лонгрид 2 — Жизненный цикл бинов](/longreads/02-bean-lifecycle/)
