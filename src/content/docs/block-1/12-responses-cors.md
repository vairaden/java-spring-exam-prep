---
title: "12. Формирование ответов, ResponseEntity, CORS"
description: "ResponseEntity, кастомные заголовки, CORS"
---

> Формирование ответов. ResponseEntity. Кастомные хедеры в ответах. CORS (cross-origin resource sharing).

## Способы формирования ответа

- Вернуть **объект** + `@ResponseBody`/`@RestController` → тело сериализуется в JSON
  через `HttpMessageConverter`, статус по умолчанию `200`.
- `@ResponseStatus(HttpStatus.CREATED)` — задать статус декларативно.
- **`ResponseEntity<T>`** — полный контроль над статусом, заголовками и телом.

## ResponseEntity

Обёртка над ответом: статус-код + заголовки + тело. Гибкий способ формирования ответа:
```java
@PostMapping("/tasks")
public ResponseEntity<TaskResponseDto> create(@RequestBody @Valid TaskCreateDto dto) {
    TaskResponseDto created = service.create(dto);
    return ResponseEntity
        .status(HttpStatus.CREATED)
        .header("X-Resource-Id", created.id().toString())
        .location(URI.create("/api/tasks/" + created.id()))
        .body(created);
}

// 204 без тела
return ResponseEntity.noContent().build();
// 404
return ResponseEntity.notFound().build();
```

## Кастомные заголовки

Способы добавить заголовки в ответ:
```java
// 1. Через ResponseEntity
ResponseEntity.ok().header("X-Total-Count", String.valueOf(total)).body(list);

// 2. Через HttpServletResponse
response.setHeader("X-API-Version", "v1");

// 3. Глобально через HandlerInterceptor.preHandle (до коммита ответа!)
response.addHeader("X-API-Version", apiVersion);
```
Важно: добавлять заголовки нужно **до записи тела** (до коммита ответа). В
`afterCompletion()` ответ уже отправлен — заголовок не применится.

## CORS (Cross-Origin Resource Sharing)

Браузерный механизм безопасности: по умолчанию JS не может слать запросы на **другой
origin** (схема+хост+порт). Сервер разрешает кросс-доменные запросы через заголовки
`Access-Control-Allow-Origin` и др. Для «непростых» запросов браузер сначала шлёт
**preflight** `OPTIONS`.

Настройка в Spring:
```java
// Точечно на контроллере/методе
@CrossOrigin(origins = "http://localhost:3000")
@RestController
public class TaskController { ... }
```
```java
// Глобально
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins("http://localhost:3000")
            .allowedMethods("GET", "POST", "PUT", "DELETE")
            .allowedHeaders("*")
            .exposedHeaders("X-Total-Count", "X-API-Version") // какие заголовки видны JS
            .allowCredentials(true);                            // куки/Authorization
    }
}
```
Нюанс: при `allowCredentials(true)` нельзя использовать `allowedOrigins("*")` — нужно
указывать конкретные origin'ы (или `allowedOriginPatterns`). Кастомные заголовки видны
фронтенду только если перечислены в `exposedHeaders`.

## 🔗 Смежные вопросы
- [Б1.10 — DispatcherServlet](/block-1/10-dispatcherservlet/)
- [Б1.13 — Контроллеры, DTO, валидация](/block-1/13-controllers-dto/)
- [Б1.15 — Обработка ошибок](/block-1/15-error-handling/)

## 📚 Материалы
- [Лонгрид 5 — DispatcherServlet и формирование ответов](/longreads/05-dispatcher-responses/)
