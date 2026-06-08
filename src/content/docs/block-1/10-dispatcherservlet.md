---
title: "10. Servlet, DispatcherServlet, путь запроса"
description: "Servlet API, DispatcherServlet, полный цикл обработки HTTP-запроса в Spring MVC"
---

> Servlet. DispatcherServlet. Путь запроса в Spring MVC. Полный цикл обработки HTTP-запроса.

## Servlet

**Servlet** — Java-объект, обрабатывающий HTTP-запросы в контейнере сервлетов (Tomcat и
др.). Контейнер принимает TCP-соединение, парсит HTTP в `HttpServletRequest`, вызывает
`service()` сервлета (→ `doGet`/`doPost`/...), а ответ собирается в `HttpServletResponse`.
Сервлеты управляются контейнером (создание, пул потоков, жизненный цикл).

## DispatcherServlet (Front Controller)

В Spring MVC есть **один** центральный сервлет — `DispatcherServlet`. Он реализует паттерн
**Front Controller**: все запросы приходят к нему, а он оркеструет обработку, делегируя
специализированным компонентам. Spring Boot регистрирует его автоматически на `/`.

Ключевые делегаты `DispatcherServlet`:
- **HandlerMapping** — по URL/методу находит нужный handler (метод контроллера).
- **HandlerAdapter** — умеет вызвать найденный handler.
- **HandlerInterceptor** — pre/post-обработка (логирование, заголовки, auth).
- **HandlerExceptionResolver** — обработка исключений (`@ControllerAdvice`).
- **HttpMessageConverter** — сериализация/десериализация тела (JSON ↔ объект).
- **ViewResolver** — для MVC с шаблонами (в REST обычно не нужен).

## Полный цикл обработки HTTP-запроса

1. Контейнер (Tomcat) принимает соединение, парсит HTTP → `HttpServletRequest`, выделяет
   поток из пула и передаёт запрос `DispatcherServlet`.
2. **HandlerMapping** определяет handler-метод по пути/методу/заголовкам (через
   `@RequestMapping`).
3. Применяются **`preHandle()`** интерсепторов (могут прервать обработку).
4. **HandlerAdapter** готовит аргументы: разбирает `@PathVariable`, `@RequestParam`,
   десериализует `@RequestBody` через `HttpMessageConverter`, выполняет валидацию (`@Valid`).
5. Вызывается **метод контроллера** → бизнес-логика (Service → Repository).
6. Возвращённый объект конвертируется в тело ответа (`@ResponseBody`/`ResponseEntity` →
   JSON через `HttpMessageConverter`).
7. Применяются **`postHandle()`** и затем **`afterCompletion()`** интерсепторов.
8. Если выброшено исключение — его перехватывает **HandlerExceptionResolver**
   (`@ExceptionHandler`/`@ControllerAdvice`) и формирует ответ.
9. `DispatcherServlet` пишет статус, заголовки и тело в `HttpServletResponse`; Tomcat
   отправляет HTTP-ответ клиенту, поток возвращается в пул.

```
Client → Tomcat → DispatcherServlet → HandlerMapping → Interceptor.preHandle
       → HandlerAdapter (биндинг, валидация) → Controller → Service → Repository
       → MessageConverter (JSON) → Interceptor.postHandle/afterCompletion → Response
```

## 🔗 Смежные вопросы
- [Б1.11 — Контейнеры сервлетов](/block-1/11-servlet-containers/)
- [Б1.12 — Ответы, ResponseEntity, CORS](/block-1/12-responses-cors/)
- [Б1.13 — Контроллеры, DTO, валидация](/block-1/13-controllers-dto/)
- [Б3.4 — Реактивные транзакции и путь запроса](/block-3/04-reactive-tx/)

## 📚 Материалы
- [Лонгрид 5 — DispatcherServlet и формирование ответов](/longreads/05-dispatcher-responses/)
- [Лонгрид 4 — Spring MVC и RESTful-сервисы](/longreads/04-spring-mvc-rest/)
