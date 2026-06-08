---
title: "2. Spring WebFlux, Netty, EventLoop"
description: "Реактивный веб-стек, аннотации vs функциональный роутинг, Netty, EventLoop, тестирование"
---

> Реактивное программирование. Spring WebFlux. Netty и EventLoop. Тестирование.

## Spring WebFlux

Реактивный, **неблокирующий** веб-стек Spring — альтернатива Spring MVC. Работает на
Reactor (`Mono`/`Flux`), по умолчанию на сервере **Netty** с моделью **event-loop**.
Контроллеры возвращают `Mono`/`Flux` вместо «готовых» объектов.

```java
@RestController
@RequestMapping("/api/tasks")
public class TaskController {
    @GetMapping("/{id}")
    public Mono<TaskDto> get(@PathVariable Long id) {
        return service.findById(id);          // неблокирующий, поток не занят на ожидании БД
    }
    @GetMapping
    public Flux<TaskDto> list() {
        return service.findAll();
    }
}
```

## MVC vs WebFlux

| | Spring MVC | Spring WebFlux |
|---|---|---|
| Модель | thread-per-request (блок.) | event-loop (неблок.) |
| Сервер | Tomcat (по умолч.) | Netty (по умолч.) |
| Типы | объекты, `ResponseEntity` | `Mono`/`Flux` |
| Доступ к БД | JDBC/JPA | R2DBC (реактивный) |
| Когда | CPU-bound, простой код | много I/O, высокая конкуррентность, стриминг |

WebFlux **не быстрее** при малой нагрузке; выигрыш — в масштабируемости под большим числом
одновременных соединений (меньше потоков, меньше памяти).

## Два стиля программирования

- **Аннотационный** (как выше, `@RestController`).
- **Функциональный** (`RouterFunction` + `HandlerFunction`):
```java
@Bean
RouterFunction<ServerResponse> routes(TaskHandler h) {
    return route(GET("/api/tasks/{id}"), h::get)
          .andRoute(POST("/api/tasks"), h::create);
}
```

## Netty и EventLoop

**Netty** — асинхронный сетевой фреймворк (не сервлет-контейнер). В его основе **EventLoop**:
- небольшой пул потоков (обычно по числу CPU-ядер);
- каждый EventLoop-поток в цикле обслуживает **много** соединений, реагируя на готовность
  I/O (через `epoll`/`kqueue`/selector);
- поток **не блокируется** на ожидании сети/БД — он переключается на другие соединения.

**Главное правило**: в EventLoop-потоке **нельзя блокировать** (синхронный JDBC, `Thread.sleep`,
`.block()`). Одна блокирующая операция «замораживает» все соединения этого EventLoop →
обвал производительности. Блокирующий код выносят на `Schedulers.boundedElastic()`.

## Тестирование: WebTestClient

```java
@WebFluxTest(TaskController.class)
class TaskControllerTest {
    @Autowired WebTestClient client;
    @MockBean TaskService service;

    @Test void getReturns200() {
        when(service.findById(1L)).thenReturn(Mono.just(new TaskDto(1L, "t")));
        client.get().uri("/api/tasks/1")
            .exchange()
            .expectStatus().isOk()
            .expectBody().jsonPath("$.title").isEqualTo("t");
    }
}
```
`WebTestClient` — неблокирующий клиент для тестов; для проверки потоков в сервисах —
`StepVerifier`.

## 🔗 Смежные вопросы
- [Б3.1 — Project Reactor](/block-3/01-reactor/)
- [Б3.3 — R2DBC](/block-3/03-r2dbc/)
- [Б3.4 — Реактивные транзакции и путь запроса](/block-3/04-reactive-tx/)
- [Б1.11 — Контейнеры сервлетов (Netty vs Tomcat)](/block-1/11-servlet-containers/)
- [Б1.10 — DispatcherServlet (MVC-аналог пути)](/block-1/10-dispatcherservlet/)

## 📚 Материалы
- [Лонгрид 12 — Реактивный Spring. WebFlux](/longreads/12-webflux/)
