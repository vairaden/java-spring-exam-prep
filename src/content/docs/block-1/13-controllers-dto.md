---
title: "13. Контроллеры, параметры, DTO, валидация"
description: "@RestController, маппинги, @RequestBody/@PathVariable/@RequestParam, DTO, валидация"
---

> @Controller, @RestController, @RequestMapping, @RequestBody, @ResponseBody, @PathVariable, @RequestParam. Обработка path- и query-параметров. Понятие DTO. Маппинг DTO на Entity. Валидация на уровне контроллеров.

## @Controller vs @RestController

- **`@Controller`** — классический MVC-контроллер: метод возвращает **имя view**, тело пишется
  только если метод/класс помечен `@ResponseBody`.
- **`@RestController`** = `@Controller` + `@ResponseBody` на уровне класса — каждый метод
  возвращает **тело ответа** (обычно JSON). Для REST API используется именно он.

## @RequestMapping и его варианты

Сопоставляет URL и HTTP-метод с методом-обработчиком:
```java
@RestController
@RequestMapping("/api/tasks")           // базовый путь
public class TaskController {
    @GetMapping("/{id}")                 // = @RequestMapping(method = GET)
    @PostMapping
    @PutMapping("/{id}")
    @DeleteMapping("/{id}")
}
```
Атрибуты: `path`, `method`, `params`, `headers`, `consumes` (тип тела запроса),
`produces` (тип ответа).

## @ResponseBody / @RequestBody

- **`@RequestBody`** — десериализует тело запроса (JSON) в объект через `HttpMessageConverter`.
- **`@ResponseBody`** — сериализует возвращаемый объект в тело ответа.

## @PathVariable (path-параметры)

Часть URL-шаблона:
```java
@GetMapping("/{id}")
public TaskResponseDto get(@PathVariable Long id) { ... }   // GET /api/tasks/42
```

## @RequestParam (query-параметры)

Параметры строки запроса `?key=value`:
```java
@GetMapping
public List<TaskResponseDto> list(
        @RequestParam(defaultValue = "0") int page,
        @RequestParam(required = false) String status) { ... }
// GET /api/tasks?page=1&status=DONE
```
Path-параметр идентифицирует ресурс (`/tasks/42`), query-параметр — фильтрует/настраивает
выборку (`?status=DONE&page=1`).

## DTO (Data Transfer Object)

**DTO** — объект для передачи данных между слоями/по сети, отделённый от **Entity** (модели
БД). Зачем разделять:
- не отдавать наружу внутренние/чувствительные поля (пароли, служебные id);
- развязать API-контракт и схему БД (можно менять независимо);
- разные DTO для разных операций: `TaskCreateDto`, `TaskUpdateDto`, `TaskResponseDto`.

## Маппинг DTO ↔ Entity

Преобразование вручную или через библиотеку (**MapStruct**, ModelMapper). MapStruct
генерирует код маппера на этапе компиляции (быстро, типобезопасно):
```java
@Mapper(componentModel = "spring",
        nullValuePropertyMappingStrategy = NullValuePropertyMappingStrategy.IGNORE)
public interface TaskMapper {
    Task toEntity(TaskCreateDto dto);
    TaskResponseDto toDto(Task task);
    void update(@MappingTarget Task entity, TaskUpdateDto dto); // partial update: null игнорируется
}
```

## Валидация на уровне контроллеров

Bean Validation (Jakarta) + `@Valid`/`@Validated`:
```java
public record TaskCreateDto(
    @NotBlank String title,
    @Size(max = 500) String description,
    @Future LocalDateTime dueDate) {}

@PostMapping
public ResponseEntity<TaskResponseDto> create(@RequestBody @Valid TaskCreateDto dto) { ... }
```
- `@Valid` запускает проверку; при ошибке выбрасывается `MethodArgumentNotValidException`
  (→ обычно `400`, обрабатывается в `@ControllerAdvice`).
- **Группы валидации** (`@Validated(OnCreate.class)`) позволяют по-разному проверять
  create и update (например, `id` обязателен только при update).

## 🔗 Смежные вопросы
- [Б1.12 — Ответы, ResponseEntity, CORS](/block-1/12-responses-cors/)
- [Б1.14 — Файлы и состояние](/block-1/14-file-upload-state/)
- [Б1.15 — Обработка ошибок](/block-1/15-error-handling/)
- [Б1.16 — HTTP, REST, OpenAPI](/block-1/16-rest-openapi/)

## 📚 Материалы
- [Лонгрид 4 — Spring MVC и RESTful-сервисы](/longreads/04-spring-mvc-rest/)
